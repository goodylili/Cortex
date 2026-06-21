// On-chain memory plane backed by the cortex::memory Move module: each memory is a
// Seal-encrypted Walrus blob recorded as a shared MemoryEntry object (mirrors the
// cortex::walrus KbFile write/read path in files.ts). This is gated entirely behind
// CORTEX_ENV.memoryModuleEnabled (NEXT_PUBLIC_CORTEX_MEMORY_MODULE=1): until the
// upgraded package is published the flag stays off and every function here is a
// no-op, so the live MemWal memory flow is unchanged.

"use client";

import { Transaction } from "@mysten/sui/transactions";
import { SessionKey } from "@mysten/seal";
import { blobIdFromInt, blobIdToInt } from "@mysten/walrus";
import { fromHex, SUI_CLOCK_OBJECT_ID, toHex } from "@mysten/sui/utils";
import { CORTEX_ENV } from "./env";
import { isMeaningfulMemory } from "../logic";
import { getSealClient, getSuiClient, getWalrusClient } from "./clients";
import { allEventsBySender, objectJson } from "./graphql";
import { withWalrusWrite } from "./write-lock";
import { trackWalrusWrite } from "./inflight";
import type { PrivySuiSigner } from "./signer";

const CONTENT_HASH_LENGTH = 32;
const SESSION_TTL_MIN = 30;
// The cortex contracts record encoding as their own enum (ENCODING_RS2 = 0) and
// reject anything >= ENCODING_COUNT (= 1), so only 0 is accepted; every Walrus blob
// is RedStuff/RS2 (see files.ts CONTRACT_ENCODING_RS2).
const CONTRACT_ENCODING_RS2 = 0;
const ADDED_EVENT = "memory::MemoryAdded";
const REMOVED_EVENT = "memory::MemoryRemoved";
const NO_BLOB_SENTINEL = "";

export interface OnChainMemory {
  id: string;
  text: string;
  facet: string;
  blobId: string;
}

function memoryModuleReady(): boolean {
  return CORTEX_ENV.memoryModuleEnabled && CORTEX_ENV.packageId.length > 0;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const input = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(digest);
}

// Mirrors cortex::seal::derive_identity(scope, resource) = id_bytes(scope) || resource.
function deriveIdentity(accountId: string, resource: string): Uint8Array {
  const scope = fromHex(
    accountId.startsWith("0x") ? accountId.slice(2) : accountId,
  );
  const res = new TextEncoder().encode(resource);
  const out = new Uint8Array(scope.length + res.length);
  out.set(scope, 0);
  out.set(res, scope.length);
  return out;
}

// Read a blob straight from the public Walrus aggregator (CDN-style GET), the same
// browser read path files.ts uses; for sealed memories these bytes are ciphertext.
async function fetchBlob(blobId: string): Promise<Uint8Array> {
  const response = await fetch(
    `${CORTEX_ENV.walrusAggregator}/v1/blobs/${blobId}`,
  );
  if (!response.ok) {
    throw new Error(
      `Walrus aggregator returned ${response.status} for blob ${blobId}`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

// The SealRef.identity vector stored on the entry already equals
// id_bytes(account_id) || resource, exactly the `id` seal_approve expects. Read it
// back from the entry object (GraphQL inlines the nested struct as plain JSON, where
// a vector<u8> arrives as an array of numbers).
function identityBytesFromJson(json: Record<string, unknown>): number[] | null {
  const seal = json.seal as { identity?: unknown } | undefined;
  const raw = seal?.identity;
  if (!Array.isArray(raw)) return null;
  const bytes = raw.filter((n): n is number => typeof n === "number");
  return bytes.length > 0 ? bytes : null;
}

// Store one memory on chain: Seal-encrypt the text, write it to Walrus, and record a
// MemoryEntry via memory::add_memory in a single transaction. The resource is the
// content hash, so identical text reuses a deterministic identity (and distinct text
// gets a distinct one). No-op (sentinel) until the module is enabled + deployed.
export async function recordMemoryOnChain(
  signer: PrivySuiSigner,
  accountId: string,
  text: string,
  facet: string,
  tags: string[],
): Promise<{ entryId?: string; blobId: string }> {
  if (!memoryModuleReady() || !isMeaningfulMemory(text)) {
    return { blobId: NO_BLOB_SENTINEL };
  }

  const bytes = new TextEncoder().encode(text);
  const contentHash = await sha256(bytes);
  if (contentHash.length !== CONTENT_HASH_LENGTH) {
    throw new Error(
      `Expected a ${CONTENT_HASH_LENGTH}-byte content hash, got ${contentHash.length}`,
    );
  }
  const resource = toHex(contentHash);
  const identity = deriveIdentity(accountId, resource);

  // The memory module's code lives at the UPGRADED package id, so move-call targets
  // (and the seal_approve target) use callPkg. But @mysten/seal requires the FIRST
  // version of the package for encrypt/SessionKey (it rejects any other as "not the
  // first version"); the key server still resolves seal_approve from any version in
  // the lineage. So Seal is scoped to the original packageId, calls go to callPkg.
  const callPkg = CORTEX_ENV.memoryPackageId;

  const work = (async () => {
    const { encryptedObject } = await getSealClient().encrypt({
      threshold: CORTEX_ENV.seal.threshold,
      packageId: CORTEX_ENV.packageId,
      id: toHex(identity),
      data: bytes,
    });

    const { blobId, blobObject } = await withWalrusWrite(() =>
      getWalrusClient().writeBlob({
        blob: encryptedObject,
        deletable: true,
        epochs: CORTEX_ENV.walrusEpochs,
        signer,
      }),
    );

    const size = Number(blobObject.size);
    const endEpoch = blobObject.storage.end_epoch;

    const tx = new Transaction();
    const walrusRef = tx.moveCall({
      target: `${callPkg}::walrus::new_ref`,
      arguments: [
        tx.pure.u256(blobIdToInt(blobId)),
        tx.pure.u64(BigInt(size)),
        tx.pure.u32(endEpoch),
        tx.pure.u8(CONTRACT_ENCODING_RS2),
      ],
    });
    const sealId = tx.moveCall({
      target: `${callPkg}::seal::derive_identity`,
      arguments: [tx.pure.id(accountId), tx.pure.string(resource)],
    });
    const sealRef = tx.moveCall({
      target: `${callPkg}::seal::new_ref`,
      arguments: [sealId, tx.pure.u8(CORTEX_ENV.seal.threshold)],
    });
    tx.moveCall({
      target: `${callPkg}::memory::add_memory`,
      arguments: [
        tx.object(accountId),
        walrusRef,
        sealRef,
        tx.pure.vector("u8", Array.from(contentHash)),
        tx.pure.string(facet),
        tx.pure.vector("string", tags),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    await signer.signAndExecuteTransaction({
      transaction: tx,
      client: getSuiClient(),
    });
    return { blobId };
  })();

  return trackWalrusWrite(work);
}

// Read every live on-chain memory for the owner: reconstruct the set from the
// MemoryAdded event log (minus those whose MemoryRemoved event fired), then for each
// entry Seal-decrypt its Walrus blob under a seal_approve check built against the
// entry's own stored identity. Entries that fail to decrypt are skipped. Returns []
// until the module is enabled + deployed.
export async function listMemoriesOnChain(
  signer: PrivySuiSigner,
  owner: string,
): Promise<OnChainMemory[]> {
  if (!memoryModuleReady()) return [];

  // Event type tags carry the package's ORIGINAL id, but after an upgrade the runtime
  // id differs; query both candidate ids and merge so enumeration is correct
  // regardless of which the type tag resolved to.
  const callPkg = CORTEX_ENV.memoryPackageId;
  const typePkgs = Array.from(
    new Set([CORTEX_ENV.packageId, callPkg].filter((p) => p.length > 0)),
  );
  const [addedLists, removedLists] = await Promise.all([
    Promise.all(typePkgs.map((p) => allEventsBySender(`${p}::${ADDED_EVENT}`, owner))),
    Promise.all(
      typePkgs.map((p) => allEventsBySender(`${p}::${REMOVED_EVENT}`, owner)),
    ),
  ]);
  const added = addedLists.flat();
  const removed = removedLists.flat();

  const removedIds = new Set<string>();
  for (const { json } of removed) {
    const id = json.entry_id;
    if (typeof id === "string" && id) removedIds.add(id);
  }

  type Pending = { entryId: string; blobId: string; facet: string; ts: number };
  const pending: Pending[] = [];
  const seen = new Set<string>();
  for (const { json } of added) {
    const entryId = json.entry_id;
    const blobIdInt = json.blob_id;
    if (typeof entryId !== "string" || !entryId) continue;
    if (removedIds.has(entryId) || seen.has(entryId)) continue;
    if (blobIdInt === undefined || blobIdInt === null) continue;
    seen.add(entryId);
    pending.push({
      entryId,
      blobId: blobIdFromInt(String(blobIdInt)),
      facet: typeof json.facet === "string" ? json.facet : "",
      ts: Number(json.timestamp_ms ?? 0),
    });
  }
  if (pending.length === 0) return [];

  pending.sort((a, b) => b.ts - a.ts);

  const suiClient = getSuiClient();
  // Seal requires the first-version package id (see recordMemoryOnChain); the
  // seal_approve move call below still targets callPkg where the module lives.
  const sessionKey = await SessionKey.create({
    address: signer.toSuiAddress(),
    packageId: CORTEX_ENV.packageId,
    ttlMin: SESSION_TTL_MIN,
    signer,
    suiClient,
  });

  const decoder = new TextDecoder();
  const out: OnChainMemory[] = [];
  for (const item of pending) {
    try {
      const json = await objectJson(item.entryId);
      if (!json) continue;
      const identityBytes = identityBytesFromJson(json);
      if (!identityBytes) continue;

      const data = await fetchBlob(item.blobId);
      const tx = new Transaction();
      tx.moveCall({
        target: `${callPkg}::memory::seal_approve`,
        arguments: [
          tx.pure.vector("u8", identityBytes),
          tx.object(item.entryId),
        ],
      });
      const txBytes = await tx.build({
        client: suiClient,
        onlyTransactionKind: true,
      });
      const plain = await getSealClient().decrypt({
        data,
        sessionKey,
        txBytes,
      });
      out.push({
        id: item.entryId,
        text: decoder.decode(plain),
        facet: item.facet,
        blobId: item.blobId,
      });
    } catch {
      /* unreadable entry (decrypt/read failure)  -  skip, keep the rest */
    }
  }
  return out;
}

// Delete an on-chain memory the caller owns via memory::remove_memory. No-op until
// the module is enabled + deployed.
export async function removeMemoryOnChain(
  signer: PrivySuiSigner,
  entryId: string,
): Promise<void> {
  if (!memoryModuleReady()) return;
  const tx = new Transaction();
  tx.moveCall({
    target: `${CORTEX_ENV.memoryPackageId}::memory::remove_memory`,
    arguments: [tx.object(entryId), tx.object(SUI_CLOCK_OBJECT_ID)],
  });
  await signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
}
