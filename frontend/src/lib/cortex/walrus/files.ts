// Storing files to Walrus, tied to the cortex::walrus contract. Write path:
// sha256 -> (optional) Seal-encrypt -> Walrus writeBlob -> record a KbFile object
// on chain (new_ref + new_ref + add_kb_file), all signed by the Privy wallet.
// Read path: fetch the blob from a public aggregator (the independence check) and,
// for sealed blobs, decrypt via Seal after a seal_approve check.

"use client";

import { Transaction } from "@mysten/sui/transactions";
import { SessionKey } from "@mysten/seal";
import { blobIdToInt } from "@mysten/walrus";
import { fromHex, SUI_CLOCK_OBJECT_ID, toHex } from "@mysten/sui/utils";
import { CORTEX_ENV, contractsEnabled, sealEnabled } from "./env";
import { getSealClient, getSuiClient, getWalrusClient } from "./clients";
import { digestOf, type PrivySuiSigner } from "./signer";

const CONTENT_HASH_LENGTH = 32;
const SESSION_TTL_MIN = 60;
// The cortex::walrus contract records encoding as its own enum (ENCODING_RS2 = 0)
// and rejects anything >= ENCODING_COUNT (= 1), so it accepts only 0. The Walrus
// SDK numbers RS2 differently, which made new_ref abort with EUnknownEncoding.
// Every Walrus blob is RedStuff/RS2, so map them all to the contract's RS2 code.
const CONTRACT_ENCODING_RS2 = 0;

export interface StoredFile {
  blobId: string;
  size: number;
  endEpoch: number;
  encoding: number;
  contentHash: string;
  sealed: boolean;
  persisted: boolean;
  digest?: string;
  kbFileId?: string;
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

export async function storeFile(opts: {
  signer: PrivySuiSigner;
  accountId: string;
  file: { name: string; mime: string; bytes: Uint8Array };
}): Promise<StoredFile> {
  const { signer, accountId, file } = opts;
  const contentHash = await sha256(file.bytes);
  if (contentHash.length !== CONTENT_HASH_LENGTH) {
    throw new Error(
      `Expected a ${CONTENT_HASH_LENGTH}-byte content hash, got ${contentHash.length}`,
    );
  }

  const sealed = sealEnabled();
  const identity = deriveIdentity(accountId, file.name);
  let payload = file.bytes;
  if (sealed) {
    const { encryptedObject } = await getSealClient().encrypt({
      threshold: CORTEX_ENV.seal.threshold,
      packageId: CORTEX_ENV.packageId,
      id: toHex(identity),
      data: file.bytes,
    });
    payload = encryptedObject;
  }

  const { blobId, blobObject } = await getWalrusClient().writeBlob({
    blob: payload,
    deletable: false,
    epochs: CORTEX_ENV.walrusEpochs,
    signer,
  });

  const size = Number(blobObject.size);
  const endEpoch = blobObject.storage.end_epoch;
  const encoding = CONTRACT_ENCODING_RS2;
  const result: StoredFile = {
    blobId,
    size,
    endEpoch,
    encoding,
    contentHash: toHex(contentHash),
    sealed,
    persisted: false,
  };

  if (!contractsEnabled()) return result;

  const tx = new Transaction();
  const walrusRef = tx.moveCall({
    target: `${CORTEX_ENV.packageId}::walrus::new_ref`,
    arguments: [
      tx.pure.u256(blobIdToInt(blobId)),
      tx.pure.u64(BigInt(size)),
      tx.pure.u32(endEpoch),
      tx.pure.u8(encoding),
    ],
  });
  const sealId = tx.moveCall({
    target: `${CORTEX_ENV.packageId}::seal::derive_identity`,
    arguments: [tx.pure.id(accountId), tx.pure.string(file.name)],
  });
  const sealRef = tx.moveCall({
    target: `${CORTEX_ENV.packageId}::seal::new_ref`,
    arguments: [sealId, tx.pure.u8(CORTEX_ENV.seal.threshold)],
  });
  tx.moveCall({
    target: `${CORTEX_ENV.packageId}::walrus::add_kb_file`,
    arguments: [
      tx.object(accountId),
      tx.pure.string(file.name),
      tx.pure.string(file.mime),
      walrusRef,
      sealRef,
      tx.pure.vector("u8", Array.from(contentHash)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  const exec = await signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
  result.digest = digestOf(exec);
  result.persisted = true;
  return result;
}

// Fast direct download URL via the public Walrus aggregator (CDN-style GET). Use
// this as an href for unencrypted blobs  -  no SDK round-trip needed.
export function fileUrl(blobId: string): string {
  return `${CORTEX_ENV.walrusAggregator}/v1/blobs/${blobId}`;
}

// Raw fetch straight from Walrus  -  works without Cortex, the independence check.
export async function fetchBlob(blobId: string): Promise<Uint8Array> {
  return getWalrusClient().readBlob({ blobId });
}

// Read + Seal-decrypt a sealed blob. Builds the seal_approve transaction the key
// servers verify against, then decrypts under a short-lived SessionKey.
export async function fetchSealedFile(opts: {
  signer: PrivySuiSigner;
  blobId: string;
  kbFileId: string;
  accountId: string;
  name: string;
}): Promise<Uint8Array> {
  const data = await fetchBlob(opts.blobId);
  const suiClient = getSuiClient();
  const sessionKey = await SessionKey.create({
    address: opts.signer.toSuiAddress(),
    packageId: CORTEX_ENV.packageId,
    ttlMin: SESSION_TTL_MIN,
    signer: opts.signer,
    suiClient,
  });

  const identity = deriveIdentity(opts.accountId, opts.name);
  const tx = new Transaction();
  tx.moveCall({
    target: `${CORTEX_ENV.packageId}::walrus::seal_approve`,
    arguments: [
      tx.pure.vector("u8", Array.from(identity)),
      tx.object(opts.kbFileId),
    ],
  });
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

  return getSealClient().decrypt({ data, sessionKey, txBytes });
}
