// Owner-side reads/writes for a shared on-chain agent task-board. The cortex::workspace
// contract holds a shared Workspace object that carries two Walrus blob pointers:
// tasks_blob (the AgentTask[] board) and bus_blob (the AgentMessage[] message bus).
// Both blobs are Seal-encrypted under an identity that PREFIXES the 32-byte Workspace
// object id, so the contract's seal_approve (owner-or-delegate, "id starts with ws id")
// gates decryption. A free-form scope suffix ("tasks"/"bus") namespaces the two blobs
// under the one workspace id. Unlike the session path in ./sessions, these blobs are
// workspace-scoped Seal (keyed to the shared object), not wallet-scoped, so we run our
// own encrypt -> writeBlob and readBlob -> decrypt rather than reusing putBlob/getBlob.

"use client";

import { SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, SUI_CLOCK_OBJECT_ID, toHex } from "@mysten/sui/utils";
import type { LoopRun } from "@cortex/core/loops";
import type { AgentMessage, AgentTask } from "../agents";
import { getSealClient, getSuiClient, getWalrusClient } from "./clients";
import { CORTEX_ENV } from "./env";
import { objectJson } from "./graphql";
import { loadSettingValue, saveSettingValue } from "./sessions";
import type { PrivySuiSigner } from "./signer";

export const WORKSPACE_SETTING_KEY = "agents:workspace";
const WORKSPACE_MODULE = "workspace";
const TASKS_SCOPE = "tasks";
const BUS_SCOPE = "bus";
const LOOPS_SCOPE = "loops";
const SUI_OBJECT_ID_BYTES = 32;
const SESSION_TTL_MIN = 10;
const SHARED_OWNER_KIND = "Shared";
const CREATED_ID_OPERATION = "Created";

function workspaceTarget(fn: string): string {
  return `${CORTEX_ENV.packageId}::${WORKSPACE_MODULE}::${fn}`;
}

function objectIdBytes(objectId: string): Uint8Array {
  const bytes = fromHex(objectId.startsWith("0x") ? objectId.slice(2) : objectId);
  if (bytes.length !== SUI_OBJECT_ID_BYTES) {
    throw new Error(
      `Expected a ${SUI_OBJECT_ID_BYTES}-byte Sui object id, got ${bytes.length} bytes`,
    );
  }
  return bytes;
}

// identity = (32-byte workspace object id) ‖ utf8(scope). seal_approve only checks the
// id starts with the workspace id, so the scope suffix is free to namespace blobs.
function scopedIdentity(workspaceId: string, scope: string): Uint8Array {
  const id = objectIdBytes(workspaceId);
  const suffix = new TextEncoder().encode(scope);
  const identity = new Uint8Array(id.length + suffix.length);
  identity.set(id, 0);
  identity.set(suffix, id.length);
  return identity;
}

async function encryptScoped(
  workspaceId: string,
  scope: string,
  plaintext: string,
): Promise<Uint8Array> {
  const identity = scopedIdentity(workspaceId, scope);
  const { encryptedObject } = await getSealClient().encrypt({
    threshold: CORTEX_ENV.seal.threshold,
    packageId: CORTEX_ENV.packageId,
    id: toHex(identity),
    data: new TextEncoder().encode(plaintext),
  });
  return encryptedObject;
}

async function decryptScoped(
  signer: PrivySuiSigner,
  workspaceId: string,
  scope: string,
  blob: Uint8Array,
): Promise<string> {
  const address = signer.toSuiAddress();
  const identity = scopedIdentity(workspaceId, scope);

  const sessionKey = await SessionKey.create({
    address,
    packageId: CORTEX_ENV.packageId,
    ttlMin: SESSION_TTL_MIN,
    signer,
    suiClient: getSuiClient(),
  });

  const tx = new Transaction();
  tx.moveCall({
    target: workspaceTarget("seal_approve"),
    arguments: [
      tx.pure.vector("u8", Array.from(identity)),
      tx.object(workspaceId),
    ],
  });
  const txBytes = await tx.build({
    client: getSuiClient(),
    onlyTransactionKind: true,
  });

  const decrypted = await getSealClient().decrypt({
    data: blob,
    sessionKey,
    txBytes,
  });
  return new TextDecoder().decode(decrypted);
}

interface ChangedObjectEffect {
  objectId: string;
  idOperation: string;
  outputOwner?: { $kind?: string } | null;
}

interface ExecutionEffects {
  changedObjects?: ChangedObjectEffect[];
}

// create_workspace shares exactly one object; find the newly-created Shared object in
// the transaction effects and return its id.
function createdWorkspaceId(effects: ExecutionEffects | undefined): string {
  const created = (effects?.changedObjects ?? []).find(
    (obj) =>
      obj.idOperation === CREATED_ID_OPERATION &&
      obj.outputOwner?.$kind === SHARED_OWNER_KIND,
  );
  if (!created) {
    throw new Error(
      "create_workspace did not surface a newly-shared Workspace object in the transaction effects",
    );
  }
  return created.objectId;
}

export async function createWorkspace(
  signer: PrivySuiSigner,
  accountId: string,
): Promise<string> {
  const tx = new Transaction();
  tx.moveCall({
    target: workspaceTarget("create_workspace"),
    arguments: [tx.object(accountId), tx.object(SUI_CLOCK_OBJECT_ID)],
  });
  const exec = await signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
  const effects =
    exec.$kind === "Transaction"
      ? (exec.Transaction.effects as ExecutionEffects | undefined)
      : (exec.FailedTransaction.effects as ExecutionEffects | undefined);
  return createdWorkspaceId(effects);
}

// Resolve the user's Workspace object id: the on-chain Account setting is the source
// of truth (so the browser, the backend, and the MCP all read the same id), falling
// back to the build-time NEXT_PUBLIC_CORTEX_WORKSPACE_ID env when no setting is set.
export async function getWorkspaceId(accountId: string): Promise<string | null> {
  const fromSetting = await loadSettingValue(accountId, WORKSPACE_SETTING_KEY);
  if (fromSetting) return fromSetting;
  return CORTEX_ENV.workspaceId.length > 0 ? CORTEX_ENV.workspaceId : null;
}

// One-time setup: create the shared Workspace object on chain and persist its id to
// the user's Account settings so every reader (browser, backend, MCP) resolves it.
// Idempotent  -  returns the existing id when one is already recorded.
export async function setupWorkspace(
  signer: PrivySuiSigner,
  accountId: string,
): Promise<string> {
  const existing = await loadSettingValue(accountId, WORKSPACE_SETTING_KEY);
  if (existing) return existing;
  const workspaceId = await createWorkspace(signer, accountId);
  await saveSettingValue(signer, accountId, WORKSPACE_SETTING_KEY, workspaceId);
  return workspaceId;
}

async function setBlob(
  signer: PrivySuiSigner,
  workspaceId: string,
  fn: string,
  scope: string,
  data: unknown,
): Promise<void> {
  const sealed = await encryptScoped(workspaceId, scope, JSON.stringify(data));
  const { blobId } = await getWalrusClient().writeBlob({
    blob: sealed,
    deletable: true,
    epochs: CORTEX_ENV.walrusEpochs,
    signer,
  });
  const tx = new Transaction();
  tx.moveCall({
    target: workspaceTarget(fn),
    arguments: [
      tx.object(workspaceId),
      tx.pure.string(blobId),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  await signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
}

async function loadBlob<T>(
  signer: PrivySuiSigner,
  workspaceId: string,
  blobField: string,
  scope: string,
): Promise<T[] | null> {
  const json = await objectJson(workspaceId);
  const blobId = json?.[blobField];
  if (typeof blobId !== "string" || blobId.length === 0) return null;

  const blob = await getWalrusClient().readBlob({ blobId });
  const plaintext = await decryptScoped(signer, workspaceId, scope, blob);
  const parsed: unknown = JSON.parse(plaintext);
  if (!Array.isArray(parsed)) {
    throw new Error(
      `Workspace ${blobField} did not decode to an array of items`,
    );
  }
  return parsed as T[];
}

export async function saveWorkspaceTasks(
  signer: PrivySuiSigner,
  workspaceId: string,
  tasks: AgentTask[],
): Promise<void> {
  await setBlob(signer, workspaceId, "owner_set_tasks", TASKS_SCOPE, tasks);
}

export async function loadWorkspaceTasks(
  signer: PrivySuiSigner,
  workspaceId: string,
): Promise<AgentTask[] | null> {
  return loadBlob<AgentTask>(signer, workspaceId, "tasks_blob", TASKS_SCOPE);
}

export async function saveWorkspaceLoops(
  signer: PrivySuiSigner,
  workspaceId: string,
  runs: LoopRun[],
): Promise<void> {
  await setBlob(signer, workspaceId, "owner_set_loops", LOOPS_SCOPE, runs);
}

export async function loadWorkspaceLoops(
  signer: PrivySuiSigner,
  workspaceId: string,
): Promise<LoopRun[] | null> {
  return loadBlob<LoopRun>(signer, workspaceId, "loops_blob", LOOPS_SCOPE);
}

export async function saveWorkspaceBus(
  signer: PrivySuiSigner,
  workspaceId: string,
  messages: AgentMessage[],
): Promise<void> {
  await setBlob(signer, workspaceId, "owner_set_bus", BUS_SCOPE, messages);
}

export async function loadWorkspaceBus(
  signer: PrivySuiSigner,
  workspaceId: string,
): Promise<AgentMessage[] | null> {
  return loadBlob<AgentMessage>(signer, workspaceId, "bus_blob", BUS_SCOPE);
}

async function delegateCall(
  signer: PrivySuiSigner,
  workspaceId: string,
  fn: string,
  delegate: string,
): Promise<void> {
  const tx = new Transaction();
  tx.moveCall({
    target: workspaceTarget(fn),
    arguments: [
      tx.object(workspaceId),
      tx.pure.address(delegate),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  await signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
}

export async function grantWorkspaceDelegate(
  signer: PrivySuiSigner,
  workspaceId: string,
  delegate: string,
): Promise<void> {
  await delegateCall(signer, workspaceId, "grant_delegate", delegate);
}

export async function revokeWorkspaceDelegate(
  signer: PrivySuiSigner,
  workspaceId: string,
  delegate: string,
): Promise<void> {
  await delegateCall(signer, workspaceId, "revoke_delegate", delegate);
}
