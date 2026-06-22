// Browser read-through cache for durable Walrus/Sui state. Both layers are pure
// accelerators over the authoritative on-chain + Walrus copies, never a substitute:
// the chain pointer remains the source of truth and is always read to reconcile.
//
// 1. Blob cache, keyed by the content-addressed Walrus blob id. A blob id maps to
//    exactly one immutable ciphertext, so its decrypted JSON can be cached with zero
//    staleness risk: a reload that still points at the same blob id skips the
//    aggregator GET and the (expensive) Seal/AES decrypt entirely. A pointer that
//    moves to a new blob id simply misses and fetches the new content.
//
// 2. State snapshot, keyed by wallet address + logical key. The last hydrated value
//    for a source, used to paint real content on a fresh reload before the chain
//    read returns. Shown optimistically and always overwritten by a successful
//    network load, so it is only ever a head-start, not a trusted copy.

"use client";

const BLOB_PREFIX = "cortex.blob.";
const STATE_PREFIX = "cortex.state.";

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function pruneBlobCache(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(BLOB_PREFIX)) localStorage.removeItem(k);
    }
  } catch {}
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Out of quota: the blob cache is the largest and fully regenerable layer, so
    // drop it and retry once before giving up (caching is best-effort).
    pruneBlobCache();
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
}

function parse(raw: string | null): unknown | undefined {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function getCachedBlob(blobId: string): unknown | undefined {
  return parse(lsGet(BLOB_PREFIX + blobId));
}

export function setCachedBlob(blobId: string, data: unknown): void {
  lsSet(BLOB_PREFIX + blobId, JSON.stringify(data));
}

export function getCachedState(
  address: string,
  key: string,
): unknown | undefined {
  return parse(lsGet(`${STATE_PREFIX}${address}.${key}`));
}

export function setCachedState(
  address: string,
  key: string,
  data: unknown,
): void {
  lsSet(`${STATE_PREFIX}${address}.${key}`, JSON.stringify(data));
}
