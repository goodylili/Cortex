// Walrus Memory (MemWal) — the live memory plane. The relayer handles embedding,
// Seal encryption, Walrus upload and vector search; the SDK only signs with an
// Ed25519 delegate key. Each user has their own MemWal account + delegate key,
// kept in a per-user keystore. Provisioning (account + delegate key) is optional
// and only runs when an embedding key is supplied at call time.

"use client";

import { MemWal } from "@mysten-incubation/memwal";
import { CORTEX_ENV } from "./env";
import type { PrivySuiSigner } from "./signer";
import { toWalletSigner } from "./signer";
import { getSuiClient } from "./clients";

const KEYSTORE_PREFIX = "cortex.memwal.";

export interface MemoryCreds {
  accountId: string;
  delegateKey: string;
}

export interface RecalledMemory {
  blobId: string;
  text: string;
  distance: number;
}

function keystoreKey(userKey: string): string {
  return KEYSTORE_PREFIX + userKey;
}

export function loadMemoryCreds(userKey: string): MemoryCreds | null {
  try {
    const raw = localStorage.getItem(keystoreKey(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MemoryCreds>;
    return parsed.accountId && parsed.delegateKey
      ? { accountId: parsed.accountId, delegateKey: parsed.delegateKey }
      : null;
  } catch {
    return null;
  }
}

export function saveMemoryCreds(userKey: string, creds: MemoryCreds): void {
  try {
    localStorage.setItem(keystoreKey(userKey), JSON.stringify(creds));
  } catch {
    /* storage unavailable — memory stays in-session only */
  }
}

export function memoryProvisioned(userKey: string): boolean {
  return loadMemoryCreds(userKey) !== null;
}

export function getMemoryClient(
  userKey: string,
  namespace: string,
): MemWal | null {
  const creds = loadMemoryCreds(userKey);
  if (!creds) return null;
  return MemWal.create({
    key: creds.delegateKey,
    accountId: creds.accountId,
    serverUrl: CORTEX_ENV.memwal.serverUrl,
    namespace,
  });
}

// Ensure this user has a usable Walrus Memory account, provisioning one on chain
// the first time. Returns false (memory stays local-only) when the memwal contract
// ids aren't configured. Subsequent calls are cheap — they short-circuit on the
// existing creds.
export async function ensureMemory(
  userKey: string,
  signer: PrivySuiSigner,
): Promise<boolean> {
  if (memoryProvisioned(userKey)) return true;
  if (!CORTEX_ENV.memwal.packageId || !CORTEX_ENV.memwal.registryId) {
    return false;
  }
  await provisionMemory({
    userKey,
    signer,
    memwalPackageId: CORTEX_ENV.memwal.packageId,
    memwalRegistryId: CORTEX_ENV.memwal.registryId,
  });
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
  const { results } = await memwal.recall({ query, limit });
  return results.map((r) => ({
    blobId: r.blob_id,
    text: r.text,
    distance: r.distance,
  }));
}

// One-time provisioning: generate a delegate key, create the MemWal account on
// chain (signed by the Privy wallet), authorize the delegate key, and persist the
// creds for this user. The relayer handles embeddings, so no embedding key is
// needed here.
export async function provisionMemory(opts: {
  userKey: string;
  signer: PrivySuiSigner;
  memwalPackageId: string;
  memwalRegistryId: string;
  label?: string;
}): Promise<MemoryCreds> {
  const { createAccount, addDelegateKey, generateDelegateKey } = await import(
    "@mysten-incubation/memwal/account"
  );
  const walletSigner = toWalletSigner(opts.signer);
  const suiClient = getSuiClient();

  const delegate = await generateDelegateKey();
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
    publicKey: delegate.publicKey,
    label: opts.label ?? "Cortex web",
    walletSigner,
    suiClient,
    suiNetwork: CORTEX_ENV.network,
  });

  const creds: MemoryCreds = {
    accountId: account.accountId,
    delegateKey: delegate.privateKey,
  };
  saveMemoryCreds(opts.userKey, creds);
  return creds;
}

const MCP_DELEGATE_LABEL = "Cortex MCP";

// Authorize the Cortex MCP's MemWal delegate key on this user's account so the MCP
// can recall/remember the user's memory in the SAME namespaces the app uses. MemWal
// Seal-encrypts per namespace and gates access by the account's delegate-key list,
// so authorizing the MCP's public delegate key (set via env, e.g.
// NEXT_PUBLIC_CORTEX_MCP_MEMWAL_PUBKEY) lets the MCP read/write that memory without
// making anything public. The MCP's private delegate key never leaves the server —
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
