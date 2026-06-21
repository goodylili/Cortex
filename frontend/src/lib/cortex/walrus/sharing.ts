// Client-side encrypted memory sharing against the cortex::sharing contract. An owner
// bundles a CHOSEN subset of their memories, Seal-encrypts the bundle under an identity
// PREFIXED by the share object's own id, stores it on Walrus, and grants named
// recipients read access. A recipient decrypts the bundle as a delegate of THIS share
// only (via seal_approve)  -  never the owner's wider account memory.
//
// Write path: create_share (DRAFT, surfaces the share object id) -> derive the Seal
// identity from that id -> sha256 + Seal-encrypt the bundle -> Walrus writeBlob ->
// set_bundle (DRAFT -> ACTIVE). Read path: objectJson(share) -> Walrus readBlob ->
// rebuild the identity -> SessionKey + seal_approve -> decrypt -> JSON.parse.
//
// Scoping is the security boundary: the encryption identity is
// id_bytes(shareId) ‖ utf8(RESOURCE), byte-identical to the contract's
// seal::derive_identity(shareId, RESOURCE). The contract enforces the share-id prefix
// in both set_bundle (EBadScope) and seal_approve (EBadIdentity), so a recipient of one
// share can never craft an identity reaching another share or the owner's account.

"use client";

import { SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, SUI_CLOCK_OBJECT_ID, toHex } from "@mysten/sui/utils";
import { blobIdFromInt, blobIdToInt } from "@mysten/walrus";
import { getSealClient, getSuiClient, getWalrusClient } from "./clients";
import { withWalrusWrite } from "./write-lock";
import { CORTEX_ENV } from "./env";
import { moduleEvents, objectJson } from "./graphql";
import type { PrivySuiSigner } from "./signer";

const SHARING_MODULE = "sharing";
// Fixed Seal resource suffix; the scope is always the SHARE object id, so this only
// namespaces the bundle under that id. Must match what set_bundle/seal_approve expect.
const SHARE_RESOURCE = "shared-memory:v1";
const CONTENT_HASH_LENGTH = 32;
const SUI_OBJECT_ID_BYTES = 32;
// The cortex::walrus contract accepts only its own ENCODING_RS2 = 0; the Walrus
// SDK numbers RS2 differently, which aborts new_ref with EUnknownEncoding. Every
// Walrus blob is RS2, so record the contract's code.
const CONTRACT_ENCODING_RS2 = 0;
const SESSION_TTL_MIN = 10;
const SHARED_OWNER_KIND = "Shared";
const CREATED_ID_OPERATION = "Created";
const STATUS_ACTIVE = 1;

// One shared memory the owner chose to include in a bundle. Mirrors the brain's Memory
// shape narrowly  -  only the fields a recipient needs to surface it in their own brain.
export interface SharedMemoryItem {
  id: string;
  text: string;
  tags: string[];
  ts: number;
  facet?: string;
  tier?: number;
  origin?: string;
}

// A lightweight on-chain summary of a share, for list views (owner's outbox / recipient
// inbox). status: 0=DRAFT, 1=ACTIVE, 2=REVOKED.
export interface ShareSummary {
  id: string;
  title: string;
  ownerHandle: string;
  status: number;
  itemCount: number;
  recipientCount: number;
}

function sharingTarget(fn: string): string {
  return `${CORTEX_ENV.packageId}::${SHARING_MODULE}::${fn}`;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const input = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(digest);
}

function objectIdBytes(objectId: string): Uint8Array {
  const bytes = fromHex(
    objectId.startsWith("0x") ? objectId.slice(2) : objectId,
  );
  if (bytes.length !== SUI_OBJECT_ID_BYTES) {
    throw new Error(
      `Expected a ${SUI_OBJECT_ID_BYTES}-byte Sui object id, got ${bytes.length} bytes`,
    );
  }
  return bytes;
}

// identity = (32-byte share object id) ‖ utf8(resource). Byte-identical to the contract's
// seal::derive_identity(shareId, resource); the scope is the SHARE id, not the account.
function deriveIdentity(shareId: string, resource: string): Uint8Array {
  const scope = objectIdBytes(shareId);
  const res = new TextEncoder().encode(resource);
  const out = new Uint8Array(scope.length + res.length);
  out.set(scope, 0);
  out.set(res, scope.length);
  return out;
}

interface ChangedObjectEffect {
  objectId: string;
  idOperation: string;
  outputOwner?: { $kind?: string } | null;
}

interface ExecutionEffects {
  changedObjects?: ChangedObjectEffect[];
}

// create_share shares exactly one object; find the newly-created Shared object in the
// transaction effects and return its id (mirrors workspace.ts createdWorkspaceId).
function createdSharedObjectId(effects: ExecutionEffects | undefined): string {
  const created = (effects?.changedObjects ?? []).find(
    (obj) =>
      obj.idOperation === CREATED_ID_OPERATION &&
      obj.outputOwner?.$kind === SHARED_OWNER_KIND,
  );
  if (!created) {
    throw new Error(
      "create_share did not surface a newly-shared MemoryShare object in the transaction effects",
    );
  }
  return created.objectId;
}

function effectsOf(
  exec: Awaited<ReturnType<PrivySuiSigner["signAndExecuteTransaction"]>>,
): ExecutionEffects | undefined {
  return exec.$kind === "Transaction"
    ? (exec.Transaction.effects as ExecutionEffects | undefined)
    : (exec.FailedTransaction.effects as ExecutionEffects | undefined);
}

// Open a new share in DRAFT (no bundle yet) and return its object id so the caller can
// derive the share-scoped Seal identity and attach a bundle via setShareBundle.
export async function createShare(
  signer: PrivySuiSigner,
  accountId: string,
  title: string,
): Promise<string> {
  const tx = new Transaction();
  tx.moveCall({
    target: sharingTarget("create_share"),
    arguments: [
      tx.object(accountId),
      tx.pure.string(title),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  const exec = await signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
  return createdSharedObjectId(effectsOf(exec));
}

// Encrypt the chosen items under the share-scoped identity, store on Walrus, and attach
// the bundle (DRAFT/ACTIVE -> ACTIVE). Re-keying is just another call here.
export async function setShareBundle(
  signer: PrivySuiSigner,
  shareId: string,
  items: SharedMemoryItem[],
): Promise<void> {
  const plaintext = new TextEncoder().encode(JSON.stringify(items));
  const contentHash = await sha256(plaintext);
  if (contentHash.length !== CONTENT_HASH_LENGTH) {
    throw new Error(
      `Expected a ${CONTENT_HASH_LENGTH}-byte content hash, got ${contentHash.length}`,
    );
  }

  const identity = deriveIdentity(shareId, SHARE_RESOURCE);
  const { encryptedObject } = await getSealClient().encrypt({
    threshold: CORTEX_ENV.seal.threshold,
    packageId: CORTEX_ENV.packageId,
    id: toHex(identity),
    data: plaintext,
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
  const encoding = CONTRACT_ENCODING_RS2;

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
    arguments: [tx.pure.id(shareId), tx.pure.string(SHARE_RESOURCE)],
  });
  const sealRef = tx.moveCall({
    target: `${CORTEX_ENV.packageId}::seal::new_ref`,
    arguments: [sealId, tx.pure.u8(CORTEX_ENV.seal.threshold)],
  });
  tx.moveCall({
    target: sharingTarget("set_bundle"),
    arguments: [
      tx.object(shareId),
      walrusRef,
      sealRef,
      tx.pure.vector("u8", Array.from(contentHash)),
      tx.pure.u64(BigInt(items.length)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  await signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
}

// Grant a recipient by raw address, with a display name the owner supplies.
export async function shareWithAddress(
  signer: PrivySuiSigner,
  shareId: string,
  recipient: string,
  recipientName: string,
): Promise<void> {
  const tx = new Transaction();
  tx.moveCall({
    target: sharingTarget("share_with_address"),
    arguments: [
      tx.object(shareId),
      tx.pure.address(recipient),
      tx.pure.string(recipientName),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  await signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
}

// owner-signed call taking (share, recipient, clock): unshare a single recipient.
async function recipientCall(
  signer: PrivySuiSigner,
  shareId: string,
  fn: string,
  recipient: string,
): Promise<void> {
  const tx = new Transaction();
  tx.moveCall({
    target: sharingTarget(fn),
    arguments: [
      tx.object(shareId),
      tx.pure.address(recipient),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  await signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
}

// Revoke a single recipient's access; the share stays live for everyone else.
export async function unshare(
  signer: PrivySuiSigner,
  shareId: string,
  recipient: string,
): Promise<void> {
  await recipientCall(signer, shareId, "unshare", recipient);
}

// Retire the whole share. seal_approve then denies every recipient (owner keeps access).
export async function revokeShare(
  signer: PrivySuiSigner,
  shareId: string,
): Promise<void> {
  const tx = new Transaction();
  tx.moveCall({
    target: sharingTarget("revoke"),
    arguments: [tx.object(shareId), tx.object(SUI_CLOCK_OBJECT_ID)],
  });
  await signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
}

// GraphQL inlines Move structs as plain JSON. A VecSet serializes as { contents: [...] }
// and a VecMap as { contents: [{ key, value }, ...] }; be defensive about both shapes
// (mirrors extractDelegatePublicKeys in ./memory).
function vecSetSize(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  const contents = (value as { contents?: unknown } | null | undefined)
    ?.contents;
  return Array.isArray(contents) ? contents.length : 0;
}

function vecSetHas(value: unknown, member: string): boolean {
  const entries = Array.isArray(value)
    ? value
    : ((value as { contents?: unknown } | null | undefined)?.contents ?? []);
  if (!Array.isArray(entries)) return false;
  const want = member.toLowerCase();
  return entries.some(
    (entry) => typeof entry === "string" && entry.toLowerCase() === want,
  );
}

interface ShareJson {
  title?: string;
  owner?: string;
  owner_handle?: string;
  status?: string | number;
  item_count?: string | number;
  recipients?: unknown;
  walrus?: { blob_id?: string | number } | null;
}

function summarize(id: string, json: Record<string, unknown>): ShareSummary {
  const fields = json as ShareJson;
  return {
    id,
    title: String(fields.title ?? ""),
    ownerHandle: String(fields.owner_handle ?? ""),
    status: Number(fields.status ?? 0),
    itemCount: Number(fields.item_count ?? 0),
    recipientCount: vecSetSize(fields.recipients),
  };
}

// Shares this owner created, read from ShareCreated events then hydrated with the share
// object's current on-chain state (so status/counts reflect later set_bundle/unshare).
export async function loadMyShares(owner: string): Promise<ShareSummary[]> {
  const events = await moduleEvents(`${sharingTarget("ShareCreated")}`);
  const ids = new Set<string>();
  for (const { sender, json } of events) {
    const eventOwner = typeof json.owner === "string" ? json.owner : sender;
    const shareId = typeof json.share_id === "string" ? json.share_id : null;
    if (shareId && eventOwner === owner) ids.add(shareId);
  }

  const summaries: ShareSummary[] = [];
  for (const id of ids) {
    const json = await objectJson(id);
    if (json) summaries.push(summarize(id, json));
  }
  return summaries;
}

// Shares granted TO this recipient, read from RecipientAdded events then filtered to
// those whose on-chain object STILL lists the recipient and is ACTIVE  -  so unshared and
// revoked shares drop off the inbox.
export async function loadReceivedShares(
  recipient: string,
): Promise<ShareSummary[]> {
  const events = await moduleEvents(`${sharingTarget("RecipientAdded")}`);
  const ids = new Set<string>();
  for (const { json } of events) {
    const eventRecipient =
      typeof json.recipient === "string" ? json.recipient : null;
    const shareId = typeof json.share_id === "string" ? json.share_id : null;
    if (shareId && eventRecipient === recipient) ids.add(shareId);
  }

  const summaries: ShareSummary[] = [];
  for (const id of ids) {
    const json = await objectJson(id);
    if (!json) continue;
    const fields = json as ShareJson;
    const active = Number(fields.status ?? 0) === STATUS_ACTIVE;
    if (active && vecSetHas(fields.recipients, recipient)) {
      summaries.push(summarize(id, json));
    }
  }
  return summaries;
}

// Read + Seal-decrypt a share's bundle. Reads the Walrus blob id (u256) off the share
// object, rebuilds the share-scoped identity, runs seal_approve under a short-lived
// SessionKey, decrypts, and parses the SharedMemoryItem[] bundle.
export async function decryptShareBundle(
  signer: PrivySuiSigner,
  shareId: string,
): Promise<SharedMemoryItem[]> {
  const json = await objectJson(shareId);
  const blobInt = (json as ShareJson | null)?.walrus?.blob_id;
  if (blobInt === undefined || blobInt === null) {
    throw new Error(`Share ${shareId} has no bundle attached yet`);
  }
  const blobId = blobIdFromInt(String(blobInt));
  const data = await getWalrusClient().readBlob({ blobId });

  const suiClient = getSuiClient();
  const sessionKey = await SessionKey.create({
    address: signer.toSuiAddress(),
    packageId: CORTEX_ENV.packageId,
    ttlMin: SESSION_TTL_MIN,
    signer,
    suiClient,
  });

  const identity = deriveIdentity(shareId, SHARE_RESOURCE);
  const tx = new Transaction();
  tx.moveCall({
    target: sharingTarget("seal_approve"),
    arguments: [
      tx.pure.vector("u8", Array.from(identity)),
      tx.object(shareId),
    ],
  });
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

  const decrypted = await getSealClient().decrypt({
    data,
    sessionKey,
    txBytes,
  });
  const parsed: unknown = JSON.parse(new TextDecoder().decode(decrypted));
  if (!Array.isArray(parsed)) {
    throw new Error(`Share ${shareId} bundle did not decode to an array`);
  }
  return parsed as SharedMemoryItem[];
}
