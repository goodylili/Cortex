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
import { toHex } from "@mysten/sui/utils";
import { CORTEX_ENV } from "./env";
import { objectJson } from "./graphql";
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
    serverUrl: CORTEX_ENV.memwal.serverUrl,
    namespace,
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
    const { addDelegateKey } = await import(
      "@mysten-incubation/memwal/account"
    );
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

// Fetch every stored memory for display (Memories view + brain). Unlike recall,
// this applies NO distance filter (we want the whole set, not a relevance slice)
// and uses a broad " " query, which the relayer accepts where empty is rejected.
export async function allMemoriesLive(
  userKey: string,
  namespace: string,
  limit = 500,
): Promise<RecalledMemory[]> {
  const memwal = getMemoryClient(userKey, namespace);
  if (!memwal) return [];
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
  const { createAccount, addDelegateKey } = await import(
    "@mysten-incubation/memwal/account"
  );
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

function normalizeDelegatePublicKey(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.startsWith("0x") ? value.slice(2) : value;
    return /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length > 0
      ? trimmed.toLowerCase()
      : null;
  }
  if (Array.isArray(value) && value.every((n) => typeof n === "number")) {
    return toHex(Uint8Array.from(value as number[]));
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

  const { removeDelegateKey } = await import(
    "@mysten-incubation/memwal/account"
  );
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
