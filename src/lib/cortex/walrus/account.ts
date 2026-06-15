// The cortex::account contract is the source of truth for a user's Account. The
// Account object is owned on chain, so we read it back by owner+type rather than
// caching an id locally. `ensureAccount` discovers it, registering one on chain
// (account::register) if the caller doesn't have one yet.

"use client";

import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { CORTEX_ENV } from "./env";
import { getSuiClient } from "./clients";
import { ownedObjects } from "./graphql";
import { digestOf, type PrivySuiSigner } from "./signer";

const REGISTER_LOOKUP_RETRIES = 6;
const REGISTER_LOOKUP_DELAY_MS = 800;

function accountType(): string {
  return `${CORTEX_ENV.packageId}::account::Account`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Read the caller's Account object id straight from chain (null if none yet).
export async function getAccountId(owner: string): Promise<string | null> {
  const owned = await ownedObjects(owner, accountType());
  return owned[0]?.id ?? null;
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

// Grant an address admin (delegate) read access over the caller's Account. The
// delegate is recorded on chain (account::grant_admin), which lets the holder
// derive a Seal key for the Account's encrypted artifacts.
export async function grantAdmin(opts: {
  signer: PrivySuiSigner;
  accountId: string;
  delegate: string;
}): Promise<{ digest: string }> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CORTEX_ENV.packageId}::account::grant_admin`,
    arguments: [
      tx.object(opts.accountId),
      tx.pure.address(opts.delegate),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  const exec = await opts.signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
  return { digest: digestOf(exec) };
}

// Revoke a previously granted admin delegate from the caller's Account.
export async function revokeAdmin(opts: {
  signer: PrivySuiSigner;
  accountId: string;
  delegate: string;
}): Promise<{ digest: string }> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CORTEX_ENV.packageId}::account::revoke_admin`,
    arguments: [
      tx.object(opts.accountId),
      tx.pure.address(opts.delegate),
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
