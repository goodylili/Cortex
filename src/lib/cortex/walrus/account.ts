// The cortex::account contract is the source of truth for a user's Account. The
// Account object is owned on chain, so we read it back by owner+type rather than
// caching an id locally. `ensureAccount` discovers it, registering one on chain
// (account::register) if the caller doesn't have one yet.

"use client";

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { CORTEX_ENV } from "./env";
import { getSuiClient } from "./clients";
import { digestOf, type PrivySuiSigner } from "./signer";

const REGISTER_LOOKUP_RETRIES = 6;
const REGISTER_LOOKUP_DELAY_MS = 800;

function accountType(): string {
  return `${CORTEX_ENV.packageId}::account::Account`;
}

let reader: SuiJsonRpcClient | undefined;
function readClient(): SuiJsonRpcClient {
  if (!reader) {
    reader = new SuiJsonRpcClient({
      url: getJsonRpcFullnodeUrl(CORTEX_ENV.network),
      network: CORTEX_ENV.network,
    });
  }
  return reader;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Read the caller's Account object id straight from chain (null if none yet).
export async function getAccountId(owner: string): Promise<string | null> {
  const owned = (await readClient().getOwnedObjects({
    owner,
    filter: { StructType: accountType() },
    options: { showType: true },
  })) as { data?: { data?: { objectId?: string } }[] };
  return owned.data?.[0]?.data?.objectId ?? null;
}

export async function registerAccount(opts: {
  signer: PrivySuiSigner;
  memwalAccountId: string;
  displayName: string;
  handle: string;
  bio: string;
}): Promise<{ digest: string }> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CORTEX_ENV.packageId}::account::register`,
    arguments: [
      tx.object(CORTEX_ENV.registryId),
      tx.pure.id(opts.memwalAccountId),
      tx.pure.string(opts.displayName),
      tx.pure.string(opts.handle),
      tx.pure.string(opts.bio),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  const exec = await opts.signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
  return { digest: digestOf(exec) };
}

// Discover the caller's Account, registering one on chain if absent. Returns the
// on-chain Account object id.
export async function ensureAccount(opts: {
  signer: PrivySuiSigner;
  memwalAccountId: string;
  displayName: string;
  handle: string;
  bio?: string;
}): Promise<string> {
  const owner = opts.signer.toSuiAddress();
  const existing = await getAccountId(owner);
  if (existing) return existing;

  await registerAccount({
    signer: opts.signer,
    memwalAccountId: opts.memwalAccountId,
    displayName: opts.displayName,
    handle: opts.handle,
    bio: opts.bio ?? "",
  });

  for (let i = 0; i < REGISTER_LOOKUP_RETRIES; i++) {
    await delay(REGISTER_LOOKUP_DELAY_MS);
    const id = await getAccountId(owner);
    if (id) return id;
  }
  throw new Error(
    "Registered the account on chain but it has not been indexed yet; try again in a moment",
  );
}
