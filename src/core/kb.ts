// Executor-gated KbFile operations, mirroring workspace.ts. The MCP service holds
// the on-chain ExecutorCap and the Ed25519 delegate keypair, so it can manage
// access and storage lifetime on a user's shared KbFile without owning it. Both
// Move entrypoints assert access::assert_executor first, so a revoked cap is
// rejected on chain. Everything degrades cleanly when the live infra is unset.

import type { Config } from "./config";
import { importExternal } from "./external";

const CLOCK_OBJECT_ID = "0x6";
const GRANT_ACCESS_FN = "walrus::executor_grant_access";
const RENEW_FN = "walrus::executor_renew";

function missingExecutorDeps(cfg: Config): string[] {
  const need: [string, string][] = [
    ["seal.policyPackage", cfg.seal.policyPackage],
    ["accessRegistryId", cfg.accessRegistryId],
    ["executorCapId", cfg.executorCapId],
    ["delegateKey", cfg.delegateKey],
  ];
  return need.filter(([, v]) => !v).map(([k]) => k);
}

function requireExecutor(cfg: Config, action: string): void {
  const missing = missingExecutorDeps(cfg);
  if (missing.length > 0) {
    throw new Error(
      `cannot ${action}: missing executor config ${missing.join(", ")}. Set these before acting on a KbFile as the executor.`,
    );
  }
}

async function executeKbCall(
  cfg: Config,
  fnTarget: string,
  kbFileId: string,
  pureArgs: (tx: any) => unknown[],
): Promise<string> {
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
      tx.object(kbFileId),
      ...pureArgs(tx),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  const res = await suiClient.signAndExecuteTransaction({
    signer,
    transaction: tx,
  });
  return res.digest;
}

export async function executorGrantKbAccess(
  cfg: Config,
  kbFileId: string,
  delegate: string,
): Promise<string> {
  requireExecutor(cfg, "grant KbFile access");
  return executeKbCall(cfg, GRANT_ACCESS_FN, kbFileId, (tx) => [
    tx.pure.address(delegate),
  ]);
}

export async function executorRenewKbFile(
  cfg: Config,
  kbFileId: string,
  newEndEpoch: number,
): Promise<string> {
  requireExecutor(cfg, "renew KbFile");
  return executeKbCall(cfg, RENEW_FN, kbFileId, (tx) => [
    tx.pure.u32(newEndEpoch),
  ]);
}
