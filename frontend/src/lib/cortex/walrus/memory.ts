// Walrus Memory (MemWal)  -  the live memory plane. The relayer handles embedding,
// Seal encryption, Walrus upload and vector search; the SDK only signs with an
// Ed25519 delegate key. Each user has their own MemWal account, and each device
// holds its OWN delegate key, derived deterministically from the user's wallet
// signature plus a non-secret per-device salt. The private delegate key is never
// written to storage  -  it lives only in an in-memory session cache, re-derived on
// demand. The keystore persists only the account id, the device salt, and the
// public keys of registered delegates.

"use client";

import { MemWal } from "@mysten-incubation/memwal";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64, toHex } from "@mysten/sui/utils";
import { CORTEX_ENV, memwalProxyUrl } from "./env";
import { isMeaningfulMemory } from "../logic";
import { objectJson, firstEventBySender } from "./graphql";
import type { PrivySuiSigner } from "./signer";
import { toWalletSigner } from "./signer";
import { getSuiClient } from "./clients";

const KEYSTORE_PREFIX = "cortex.memwal.";
const DEVICE_ID_KEY = "cortex.device.id";
const DELEGATE_LABEL_PREFIX = "cortex:memwal:v1:";
const DEVICE_KEY_LABEL = "Cortex device";
const ED25519_SECRET_KEY_LENGTH = 32;
const MCP_DELEGATE_LABEL = "Cortex MCP";
// recall() is top-K with no relevance floor, so a small namespace returns its
// closest rows even when they're unrelated. Drop anything at/above this distance
// (>= 0.7 is "usually unrelated") so the brain only ingests clearly-relevant hits.
const RECALL_MAX_DISTANCE = 0.7;
// recall() only searches the relayer's LOCAL vector index; the durable copies of
// every memory live on Walrus. restore() rebuilds the missing index rows from
// Walrus (newest-first, single-shot, skipping already-indexed blobs), so this is
// the cap on how many on-chain blobs a single rehydration inspects. Restore costs
// "seconds per blob" on a cold cache, so the cap stays modest (the memwal skill
// recommends <=50 for interactive flows) and the rebuild runs once per session.
const RESTORE_LIMIT = 50;
const RECALL_LIMIT = 200;

export interface MemoryCreds {
  accountId: string;
  deviceId?: string;
  registered?: string[];
  delegateKey?: string;
}

export interface RecalledMemory {
  blobId: string;
  text: string;
  distance: number;
}

interface DeviceKey {
  privateKey: string;
  publicKey: string;
}

const deviceKeyCache = new Map<string, DeviceKey>();

function keystoreKey(userKey: string): string {
  return KEYSTORE_PREFIX + userKey;
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return crypto.randomUUID();
  }
}

export function loadMemoryCreds(userKey: string): MemoryCreds | null {
  try {
    const raw = localStorage.getItem(keystoreKey(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MemoryCreds>;
    if (!parsed.accountId) return null;
    return {
      accountId: parsed.accountId,
      deviceId: parsed.deviceId,
      registered: Array.isArray(parsed.registered) ? parsed.registered : [],
      delegateKey: parsed.delegateKey,
    };
  } catch {
    return null;
  }
}

// Drop every stored MemWal credential (all users on this device). Used on
// sign-out so no account id / device id / delegate registration is left behind.
export function clearMemoryCreds(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(KEYSTORE_PREFIX)) localStorage.removeItem(k);
    }
  } catch {}
  deviceKeyCache.clear();
  restoreInFlight.clear();
}

export function saveMemoryCreds(userKey: string, creds: MemoryCreds): void {
  try {
    localStorage.setItem(
      keystoreKey(userKey),
      JSON.stringify({
        accountId: creds.accountId,
        deviceId: creds.deviceId,
        registered: creds.registered ?? [],
      }),
    );
  } catch {
    /* storage unavailable  -  memory stays in-session only */
  }
}

export function memoryProvisioned(userKey: string): boolean {
  return loadMemoryCreds(userKey) !== null;
}

// Build an Ed25519 delegate key from a deterministic per-device seed. The seed is
// SHA-256(signer.sign(label)), where the label salts in a non-secret device id so
// each device gets a distinct key. Same wallet + device => same key, so the key is
// reproducible without ever being stored. The MemWal SDK expects the private key as
// plain hex of the 32-byte Ed25519 seed (matching generateDelegateKey().privateKey)
// and the public key as plain hex of the 32-byte raw key.
async function deriveDelegateKey(
  signer: PrivySuiSigner,
  deviceId: string,
): Promise<{ privateKey: string; publicKey: string }> {
  const label = new TextEncoder().encode(DELEGATE_LABEL_PREFIX + deviceId);
  const signature = await signer.sign(label);
  const seedBuffer = await crypto.subtle.digest("SHA-256", signature);
  const seed = new Uint8Array(seedBuffer);
  if (seed.length !== ED25519_SECRET_KEY_LENGTH) {
    throw new Error(
      `Derived delegate seed must be ${ED25519_SECRET_KEY_LENGTH} bytes, got ${seed.length}`,
    );
  }
  const keypair = Ed25519Keypair.fromSecretKey(seed);
  return {
    privateKey: toHex(seed),
    publicKey: toHex(keypair.getPublicKey().toRawBytes()),
  };
}

async function ensureDeviceKey(
  userKey: string,
  signer: PrivySuiSigner,
  deviceId: string,
): Promise<DeviceKey> {
  const derived = await deriveDelegateKey(signer, deviceId);
  deviceKeyCache.set(userKey, derived);
  return derived;
}

export function getMemoryClient(
  userKey: string,
  namespace: string,
): MemWal | null {
  const creds = loadMemoryCreds(userKey);
  if (!creds) return null;
  const device = deviceKeyCache.get(userKey);
  if (!device) return null;
  return MemWal.create({
    key: device.privateKey,
    accountId: creds.accountId,
    serverUrl: memwalProxyUrl(CORTEX_ENV.network),
    namespace,
  });
}

// Recover the user's existing MemWalAccount by owner. The account object is a
// SHARED object (so it can't be found by an owned-objects read), but the contract
// allows exactly one per address and emits a permanent `AccountCreated { owner,
// account_id }` event on creation. We read that event back by sender, so the
// durable account is always discoverable even after the local cred cache is
// cleared (sign-out). Returns null only when memory was genuinely never
// provisioned. This is what keeps a user's memories from vanishing on re-login:
// we reuse the on-chain account instead of provisioning a fresh, empty one.
export async function findMemwalAccountId(
  owner: string,
): Promise<string | null> {
  if (!CORTEX_ENV.memwal.packageId) return null;
  try {
    const json = await firstEventBySender(
      `${CORTEX_ENV.memwal.packageId}::account::AccountCreated`,
      owner,
    );
    const id = json?.account_id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

// Authorize this device's delegate public key on a recovered account when it is
// not already in the on-chain delegate list (a brand-new device). The original
// device's key is already registered, so this is a no-op + no transaction there.
async function authorizeDeviceIfMissing(
  accountId: string,
  publicKey: string,
  signer: PrivySuiSigner,
): Promise<void> {
  const json = await objectJson(accountId);
  const registered = json ? extractDelegatePublicKeys(json) : [];
  if (registered.includes(publicKey.toLowerCase())) return;
  const { addDelegateKey } = await import("@mysten-incubation/memwal/account");
  await addDelegateKey({
    packageId: CORTEX_ENV.memwal.packageId,
    accountId,
    publicKey,
    label: DEVICE_KEY_LABEL,
    walletSigner: toWalletSigner(signer),
    suiClient: getSuiClient(),
    suiNetwork: CORTEX_ENV.network,
  });
}

// Ensure this user has a usable Walrus Memory account AND that this device's
// delegate key is authorized on it. The private delegate key is derived in memory
// (never persisted). On first use the MemWal account is created (signed by the
// Privy wallet) and the device key authorized; on later devices/sessions only the
// missing device key is added. Migrates legacy creds by scrubbing any at-rest
// delegateKey. Returns false (memory stays local-only) when memwal contract ids
// aren't configured.
export async function ensureMemory(
  userKey: string,
  signer: PrivySuiSigner,
): Promise<boolean> {
  if (!CORTEX_ENV.memwal.packageId || !CORTEX_ENV.memwal.registryId) {
    return false;
  }

  const deviceId = getDeviceId();
  const existing = loadMemoryCreds(userKey);

  if (!existing) {
    // The local cred cache is empty (first run on this device, or after a
    // sign-out cleared it). Recover the durable on-chain account before creating
    // a new one, so a returning user keeps every memory they ever stored.
    const recovered = await findMemwalAccountId(signer.toSuiAddress());
    if (recovered) {
      const device = await ensureDeviceKey(userKey, signer, deviceId);
      await authorizeDeviceIfMissing(recovered, device.publicKey, signer);
      saveMemoryCreds(userKey, {
        accountId: recovered,
        deviceId,
        registered: [device.publicKey],
      });
      return true;
    }
    await provisionMemory({
      userKey,
      signer,
      memwalPackageId: CORTEX_ENV.memwal.packageId,
      memwalRegistryId: CORTEX_ENV.memwal.registryId,
    });
    return true;
  }

  const device = await ensureDeviceKey(userKey, signer, deviceId);
  const registered = existing.registered ?? [];
  const hasLegacyKey = existing.delegateKey !== undefined;

  if (!registered.includes(device.publicKey)) {
    const { addDelegateKey } =
      await import("@mysten-incubation/memwal/account");
    await addDelegateKey({
      packageId: CORTEX_ENV.memwal.packageId,
      accountId: existing.accountId,
      publicKey: device.publicKey,
      label: DEVICE_KEY_LABEL,
      walletSigner: toWalletSigner(signer),
      suiClient: getSuiClient(),
      suiNetwork: CORTEX_ENV.network,
    });
    saveMemoryCreds(userKey, {
      accountId: existing.accountId,
      deviceId,
      registered: [...registered, device.publicKey],
    });
    return true;
  }

  if (existing.deviceId !== deviceId || hasLegacyKey) {
    saveMemoryCreds(userKey, {
      accountId: existing.accountId,
      deviceId,
      registered,
    });
  }
  return true;
}

export async function rememberLive(
  userKey: string,
  namespace: string,
  text: string,
): Promise<{ blobId: string } | null> {
  if (!isMeaningfulMemory(text)) return null;
  const memwal = getMemoryClient(userKey, namespace);
  if (!memwal) return null;
  const result = await memwal.rememberAndWait(text);
  return { blobId: result.blob_id };
}

export async function recallLive(
  userKey: string,
  namespace: string,
  query: string,
  limit = 8,
): Promise<RecalledMemory[]> {
  const memwal = getMemoryClient(userKey, namespace);
  if (!memwal) return [];
  const { results } = await memwal.recall({
    query,
    limit,
    maxDistance: RECALL_MAX_DISTANCE,
  });
  return results.map((r) => ({
    blobId: r.blob_id,
    text: r.text,
    distance: r.distance,
  }));
}

// One in-flight restore per (user, namespace), so repeated allMemories() calls
// (sign-in load, the ask fallback, view switches) share a SINGLE rebuild instead of
// each kicking off its own multi-second Walrus scan and piling up. Resolves to the
// promise once started; cleared only on sign-out (clearMemoryCreds).
const restoreInFlight = new Map<string, Promise<number>>();

function restoreKey(userKey: string, namespace: string): string {
  return `${userKey}::${namespace}`;
}

// Rebuild this namespace's relayer-side index from the durable Walrus copies so
// recall can see the whole set. recall() searches only the relayer's LOCAL vector
// index, which can be empty or partial after a sign-out/in, a relayer restart, or
// writes made from another device  -  even though every memory's encrypted blob
// still lives on Walrus. restore() pulls those blobs back, decrypts, re-embeds and
// inserts the missing rows; it is idempotent (already-indexed blobs are skipped
// cheaply). Single-flight + memoized per session: the heavy rebuild happens at most
// once. Returns how many on-chain blobs the relayer saw, or 0 when memory isn't
// usable / restore fails.
export function restoreMemories(
  userKey: string,
  namespace: string,
  limit = RESTORE_LIMIT,
): Promise<number> {
  const key = restoreKey(userKey, namespace);
  const existing = restoreInFlight.get(key);
  if (existing) return existing;
  const run = (async () => {
    const memwal = getMemoryClient(userKey, namespace);
    if (!memwal) return 0;
    try {
      const { total } = await memwal.restore(namespace, limit);
      return total;
    } catch {
      return 0;
    }
  })();
  restoreInFlight.set(key, run);
  return run;
}

// Fetch every stored memory for display (Memories view + brain). It first restores
// the relayer index from Walrus (once per session) so nothing the user ever saved
// is missing, then reads it back. Unlike recall, this applies NO distance filter
// (we want the whole set, not a relevance slice) and uses a broad " " query, which
// the relayer accepts where empty is rejected.
export async function allMemoriesLive(
  userKey: string,
  namespace: string,
  limit = RECALL_LIMIT,
): Promise<RecalledMemory[]> {
  const memwal = getMemoryClient(userKey, namespace);
  if (!memwal) return [];
  await restoreMemories(userKey, namespace);
  const { results } = await memwal.recall({ query: " ", limit });
  return results.map((r) => ({
    blobId: r.blob_id,
    text: r.text,
    distance: r.distance,
  }));
}

// One-time provisioning: derive this device's delegate key in memory, create the
// MemWal account on chain (signed by the Privy wallet), authorize the device's
// public key, and persist the creds (account id + device id + registered public
// keys)  -  never the private key. The relayer handles embeddings, so no embedding
// key is needed here.
export async function provisionMemory(opts: {
  userKey: string;
  signer: PrivySuiSigner;
  memwalPackageId: string;
  memwalRegistryId: string;
  label?: string;
}): Promise<MemoryCreds> {
  const { createAccount, addDelegateKey } =
    await import("@mysten-incubation/memwal/account");
  const walletSigner = toWalletSigner(opts.signer);
  const suiClient = getSuiClient();
  const deviceId = getDeviceId();
  const device = await ensureDeviceKey(opts.userKey, opts.signer, deviceId);

  const account = await createAccount({
    packageId: opts.memwalPackageId,
    registryId: opts.memwalRegistryId,
    walletSigner,
    suiClient,
    suiNetwork: CORTEX_ENV.network,
  });
  await addDelegateKey({
    packageId: opts.memwalPackageId,
    accountId: account.accountId,
    publicKey: device.publicKey,
    label: opts.label ?? DEVICE_KEY_LABEL,
    walletSigner,
    suiClient,
    suiNetwork: CORTEX_ENV.network,
  });

  const creds: MemoryCreds = {
    accountId: account.accountId,
    deviceId,
    registered: [device.publicKey],
  };
  saveMemoryCreds(opts.userKey, creds);
  return creds;
}

// Authorize the Cortex MCP's MemWal delegate key on this user's account so the MCP
// can recall/remember the user's memory in the SAME namespaces the app uses. MemWal
// Seal-encrypts per namespace and gates access by the account's delegate-key list,
// so authorizing the MCP's public delegate key (set via env, e.g.
// NEXT_PUBLIC_CORTEX_MCP_MEMWAL_PUBKEY) lets the MCP read/write that memory without
// making anything public. The MCP's private delegate key never leaves the server  -
// only its public key is passed here. Returns false (no-op) when memwal isn't
// configured or the user has no MemWal account yet.
export async function authorizeMemoryDelegate(opts: {
  userKey: string;
  signer: PrivySuiSigner;
  delegatePublicKey: string;
  label?: string;
}): Promise<boolean> {
  if (!CORTEX_ENV.memwal.packageId || !CORTEX_ENV.memwal.registryId) {
    return false;
  }
  if (!opts.delegatePublicKey) {
    throw new Error(
      "authorizeMemoryDelegate requires a non-empty delegatePublicKey (the MCP's public delegate key, e.g. NEXT_PUBLIC_CORTEX_MCP_MEMWAL_PUBKEY)",
    );
  }
  const ready = await ensureMemory(opts.userKey, opts.signer);
  if (!ready) return false;
  const creds = loadMemoryCreds(opts.userKey);
  if (!creds) return false;

  // Idempotent: MemWal's account::add_delegate_key aborts (code 0) when the key is
  // already registered, so re-authorizing the MCP would fail. Skip the add when this
  // delegate is already on the account's key list.
  const target = normalizeDelegatePublicKey(opts.delegatePublicKey);
  if (target) {
    try {
      const json = await objectJson(creds.accountId);
      if (json && extractDelegatePublicKeys(json).includes(target)) return true;
    } catch {
      /* couldn't read the list  -  fall through and attempt the add */
    }
  }

  const { addDelegateKey } = await import("@mysten-incubation/memwal/account");
  await addDelegateKey({
    packageId: CORTEX_ENV.memwal.packageId,
    accountId: creds.accountId,
    publicKey: opts.delegatePublicKey,
    label: opts.label ?? MCP_DELEGATE_LABEL,
    walletSigner: toWalletSigner(opts.signer),
    suiClient: getSuiClient(),
    suiNetwork: CORTEX_ENV.network,
  });
  return true;
}

// Normalize a delegate public key to lowercase hex of its 32 raw bytes. On-chain
// the key is stored base64 (e.g. "LkecG3...="), while our derived device key is
// hex; both must compare equal, so decode base64 to bytes first and fall back to
// treating the string as hex. This is what lets recovery recognize a device key
// that is already authorized (and skip a redundant, possibly aborting, add).
function normalizeDelegatePublicKey(value: unknown): string | null {
  if (typeof value === "string" && value.length) {
    try {
      const bytes = fromBase64(value);
      if (bytes.length === ED25519_SECRET_KEY_LENGTH) {
        return toHex(bytes).toLowerCase();
      }
    } catch {
      /* not base64  -  fall through to the hex interpretation */
    }
    const trimmed = value.startsWith("0x") ? value.slice(2) : value;
    return /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length > 0
      ? trimmed.toLowerCase()
      : null;
  }
  if (Array.isArray(value) && value.every((n) => typeof n === "number")) {
    return toHex(Uint8Array.from(value as number[])).toLowerCase();
  }
  return null;
}

function extractDelegatePublicKeys(json: Record<string, unknown>): string[] {
  const raw = json.delegate_keys ?? json.delegateKeys;
  const entries = Array.isArray(raw)
    ? raw
    : ((raw as { contents?: unknown })?.contents ?? []);
  if (!Array.isArray(entries)) return [];
  const out: string[] = [];
  for (const entry of entries) {
    const candidate =
      typeof entry === "object" && entry !== null
        ? ((entry as Record<string, unknown>).public_key ??
          (entry as Record<string, unknown>).publicKey ??
          (entry as Record<string, unknown>).key ??
          (entry as { value?: { public_key?: unknown } }).value?.public_key)
        : entry;
    const normalized = normalizeDelegatePublicKey(candidate);
    if (normalized) out.push(normalized);
  }
  return out;
}

// Best-effort read of the on-chain MemWalAccount's delegate-key list, flagging the
// entry that matches this device's derived public key. Degrades to [] on any
// failure (missing creds, unreachable node, unexpected object shape) rather than
// throwing  -  callers use this for display only.
export async function listMemoryDelegates(
  userKey: string,
): Promise<{ publicKey: string; isThisDevice: boolean }[]> {
  try {
    const creds = loadMemoryCreds(userKey);
    if (!creds) return [];
    const thisDevice = deviceKeyCache.get(userKey)?.publicKey.toLowerCase();
    const json = await objectJson(creds.accountId);
    if (!json) return [];
    return extractDelegatePublicKeys(json).map((publicKey) => ({
      publicKey,
      isThisDevice: thisDevice !== undefined && publicKey === thisDevice,
    }));
  } catch {
    return [];
  }
}

// Revoke a delegate key from this user's MemWal account, signed by the Privy
// wallet. The SDK exposes removeDelegateKey, so this calls it and prunes the key
// from the persisted registered list. Returns false (never throws) when memwal
// isn't configured or the user has no account yet.
export async function revokeMemoryDelegate(opts: {
  userKey: string;
  signer: PrivySuiSigner;
  publicKey: string;
}): Promise<boolean> {
  if (!CORTEX_ENV.memwal.packageId || !CORTEX_ENV.memwal.registryId) {
    return false;
  }
  const creds = loadMemoryCreds(opts.userKey);
  if (!creds) return false;

  const { removeDelegateKey } =
    await import("@mysten-incubation/memwal/account");
  await removeDelegateKey({
    packageId: CORTEX_ENV.memwal.packageId,
    accountId: creds.accountId,
    publicKey: opts.publicKey,
    walletSigner: toWalletSigner(opts.signer),
    suiClient: getSuiClient(),
    suiNetwork: CORTEX_ENV.network,
  });
  const normalized = normalizeDelegatePublicKey(opts.publicKey);
  saveMemoryCreds(opts.userKey, {
    accountId: creds.accountId,
    deviceId: creds.deviceId,
    registered: (creds.registered ?? []).filter(
      (k) => k.toLowerCase() !== (normalized ?? opts.publicKey.toLowerCase()),
    ),
  });
  return true;
}
