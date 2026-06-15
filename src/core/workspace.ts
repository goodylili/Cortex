// Server (MCP) side of the shared `Workspace` agent task-board. Cortex acts as the
// executor here: it holds the on-chain `ExecutorCap` and the Ed25519 delegate
// keypair, so it can write the task board and message bus on behalf of the agents
// and decrypt their Seal-protected blobs as a registered delegate. The browser
// owns the same object and writes from the user's Privy wallet; this module mirrors
// that flow but signs with the delegate keypair. Everything degrades cleanly when
// the live infra (Seal servers, package id, registry, executor cap) is unset.

import type { Config } from "./config";
import type { Clients } from "../../sui/app/clients";
import type { AgentMessageRecord, AgentTaskRecord } from "./agents";
import { importExternal } from "./external";

const SUI_ADDRESS_BYTES = 32;
const TASKS_SCOPE = "tasks";
const BUS_SCOPE = "bus";
const CLOCK_OBJECT_ID = "0x6";
const SESSION_TTL_MIN = 10;
const SET_TASKS_FN = "workspace::executor_set_tasks";
const SET_BUS_FN = "workspace::executor_set_bus";
const SEAL_APPROVE_FN = "workspace::seal_approve";
const KEY_SERVER_WEIGHT = 1;
const SCOPE_TEXT = new TextEncoder();

function missingLiveDeps(cfg: Config): string[] {
  const need: [string, string | number | string[]][] = [
    ["seal.policyPackage", cfg.seal.policyPackage],
    ["seal.serverIds", cfg.seal.serverIds],
    ["accessRegistryId", cfg.accessRegistryId],
    ["executorCapId", cfg.executorCapId],
    ["delegateKey", cfg.delegateKey],
  ];
  return need
    .filter(([, v]) => (Array.isArray(v) ? v.length === 0 : !v))
    .map(([k]) => k);
}

function objectIdBytes(workspaceId: string): Uint8Array {
  const hex = workspaceId.startsWith("0x")
    ? workspaceId.slice(2)
    : workspaceId;
  if (hex.length !== SUI_ADDRESS_BYTES * 2) {
    throw new Error(
      `workspace id must be a ${SUI_ADDRESS_BYTES}-byte hex object id, got ${hex.length} hex chars`,
    );
  }
  const bytes = new Uint8Array(SUI_ADDRESS_BYTES);
  for (let i = 0; i < SUI_ADDRESS_BYTES; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function sealIdentity(workspaceId: string, scope: string): Uint8Array {
  const idBytes = objectIdBytes(workspaceId);
  const scopeBytes = SCOPE_TEXT.encode(scope);
  const identity = new Uint8Array(idBytes.length + scopeBytes.length);
  identity.set(idBytes, 0);
  identity.set(scopeBytes, idBytes.length);
  return identity;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] as number).toString(16).padStart(2, "0");
  }
  return out;
}

interface SealRuntime {
  sealClient: any;
  suiClient: any;
  signer: any;
  address: string;
}

async function sealRuntime(cfg: Config): Promise<SealRuntime> {
  const [sui, seal, ed] = await Promise.all([
    importExternal("@mysten/sui/client"),
    importExternal("@mysten/seal"),
    importExternal("@mysten/sui/keypairs/ed25519"),
  ]);
  const suiClient = new sui.SuiClient({ url: cfg.sui.rpc });
  const signer = ed.Ed25519Keypair.fromSecretKey(cfg.delegateKey);
  const sealClient = new seal.SealClient({
    suiClient,
    serverConfigs: cfg.seal.serverIds.map((objectId) => ({
      objectId,
      weight: KEY_SERVER_WEIGHT,
    })),
  });
  return { sealClient, suiClient, signer, address: signer.toSuiAddress() };
}

async function sealEncryptJson(
  cfg: Config,
  workspaceId: string,
  scope: string,
  payload: unknown,
): Promise<Uint8Array> {
  const { sealClient } = await sealRuntime(cfg);
  const id = toHex(sealIdentity(workspaceId, scope));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const { encryptedObject } = await sealClient.encrypt({
    threshold: cfg.seal.threshold,
    packageId: cfg.seal.policyPackage,
    id,
    data,
  });
  return encryptedObject;
}

async function sealDecryptJson(
  cfg: Config,
  workspaceId: string,
  scope: string,
  blob: Uint8Array,
): Promise<unknown> {
  const { sealClient, suiClient, signer, address } = await sealRuntime(cfg);
  const identity = sealIdentity(workspaceId, scope);
  const txMod: any = await importExternal("@mysten/sui/transactions");

  const sessionKey = await (
    await importExternal("@mysten/seal")
  ).SessionKey.create({
    address,
    packageId: cfg.seal.policyPackage,
    ttlMin: SESSION_TTL_MIN,
    signer,
    suiClient,
  });

  const tx = new txMod.Transaction();
  tx.moveCall({
    target: `${cfg.seal.policyPackage}::${SEAL_APPROVE_FN}`,
    arguments: [
      tx.pure.vector("u8", Array.from(identity)),
      tx.object(workspaceId),
    ],
  });
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

  const decrypted = await sealClient.decrypt({
    data: blob,
    sessionKey,
    txBytes,
  });
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function readBlobField(
  cfg: Config,
  workspaceId: string,
  field: "tasks_blob" | "bus_blob",
): Promise<string | null> {
  const sui: any = await importExternal("@mysten/sui/client");
  const suiClient = new sui.SuiClient({ url: cfg.sui.rpc });
  const res = await suiClient.getObject({
    id: workspaceId,
    options: { showContent: true },
  });
  const content = res?.data?.content;
  if (!content || content.dataType !== "moveObject") return null;
  const blob = content.fields?.[field];
  return typeof blob === "string" && blob.length > 0 ? blob : null;
}

async function setBlobOnChain(
  cfg: Config,
  workspaceId: string,
  fnTarget: string,
  blob: string,
): Promise<void> {
  const [sui, ed, txMod] = await Promise.all([
    importExternal("@mysten/sui/client"),
    importExternal("@mysten/sui/keypairs/ed25519"),
    importExternal("@mysten/sui/transactions"),
  ]);
  const suiClient = new sui.SuiClient({ url: cfg.sui.rpc });
  const signer = ed.Ed25519Keypair.fromSecretKey(cfg.delegateKey);
  const tx = new txMod.Transaction();
  tx.moveCall({
    target: `${cfg.seal.policyPackage}::${fnTarget}`,
    arguments: [
      tx.object(cfg.accessRegistryId),
      tx.object(cfg.executorCapId),
      tx.object(workspaceId),
      tx.pure.string(blob),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  await suiClient.signAndExecuteTransaction({ signer, transaction: tx });
}

function requireLive(cfg: Config, action: string): void {
  const missing = missingLiveDeps(cfg);
  if (missing.length > 0) {
    throw new Error(
      `cannot ${action}: missing live config ${missing.join(", ")}. Set these before writing the workspace as the executor.`,
    );
  }
}

async function readScope<T>(
  c: Clients,
  cfg: Config,
  workspaceId: string,
  scope: string,
  field: "tasks_blob" | "bus_blob",
): Promise<T[] | null> {
  if (missingLiveDeps(cfg).length > 0) return null;
  try {
    const blobId = await readBlobField(cfg, workspaceId, field);
    if (!blobId) return null;
    const bytes = await c.walrus.getBlob(blobId);
    const parsed = await sealDecryptJson(cfg, workspaceId, scope, bytes);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

async function writeScope(
  c: Clients,
  cfg: Config,
  workspaceId: string,
  scope: string,
  fnTarget: string,
  payload: unknown[],
  action: string,
): Promise<void> {
  requireLive(cfg, action);
  const sealed = await sealEncryptJson(cfg, workspaceId, scope, payload);
  const blobId = await c.walrus.putBlob(sealed);
  await setBlobOnChain(cfg, workspaceId, fnTarget, blobId);
}

export async function readWorkspaceTasks(
  c: Clients,
  cfg: Config,
  workspaceId: string,
): Promise<AgentTaskRecord[] | null> {
  return readScope<AgentTaskRecord>(
    c,
    cfg,
    workspaceId,
    TASKS_SCOPE,
    "tasks_blob",
  );
}

export async function writeWorkspaceTasks(
  c: Clients,
  cfg: Config,
  workspaceId: string,
  tasks: AgentTaskRecord[],
): Promise<void> {
  return writeScope(
    c,
    cfg,
    workspaceId,
    TASKS_SCOPE,
    SET_TASKS_FN,
    tasks,
    "write workspace tasks",
  );
}

export async function readWorkspaceBus(
  c: Clients,
  cfg: Config,
  workspaceId: string,
): Promise<AgentMessageRecord[] | null> {
  return readScope<AgentMessageRecord>(
    c,
    cfg,
    workspaceId,
    BUS_SCOPE,
    "bus_blob",
  );
}

export async function writeWorkspaceBus(
  c: Clients,
  cfg: Config,
  workspaceId: string,
  messages: AgentMessageRecord[],
): Promise<void> {
  return writeScope(
    c,
    cfg,
    workspaceId,
    BUS_SCOPE,
    SET_BUS_FN,
    messages,
    "write workspace bus",
  );
}
