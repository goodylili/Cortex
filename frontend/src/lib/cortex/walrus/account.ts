// The cortex::account contract is the source of truth for a user's Account. The
// Account object is owned on chain, so we read it back by owner+type rather than
// caching an id locally. `ensureAccount` discovers it, registering one on chain
// (account::register) if the caller doesn't have one yet.

"use client";

import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { CORTEX_ENV } from "./env";
import { getSuiClient } from "./clients";
import { objectJson, ownedObjects } from "./graphql";
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

// The auto-generated handle ensureAccount() registers when none is claimed yet.
function autoHandle(owner: string): string {
  return `cortex_${owner.slice(2, 10)}`;
}

// The caller's user-claimed handle from chain, or null if they only have the
// auto-generated default (so the UI shows a real claimed name, not cortex_xxxx).
export async function getClaimedHandle(owner: string): Promise<string | null> {
  const accountId = await getAccountId(owner);
  if (!accountId) return null;
  const json = await objectJson(accountId);
  const handle = typeof json?.handle === "string" ? json.handle : "";
  return handle && handle !== autoHandle(owner) ? handle : null;
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

// Set the Account's handle (account::set_handle). The handle is the cortex username;
// when a user claims a SuiNS subname we set it here too so the on-chain owner_handle
// (and thus a memory share's provenance) reads as `<handle>.cortex.sui`. The registry
// enforces handle uniqueness, mirroring the SuiNS namespace.
export async function setHandle(opts: {
  signer: PrivySuiSigner;
  accountId: string;
  handle: string;
}): Promise<{ digest: string }> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CORTEX_ENV.packageId}::account::set_handle`,
    arguments: [
      tx.object(CORTEX_ENV.registryId),
      tx.object(opts.accountId),
      tx.pure.string(opts.handle),
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

// One account per owner, resolved once per session. Several flows (saveProfile,
// markOnboarded, the background sync) call ensureAccount around the same time;
// register() aborts EAlreadyRegistered on a second call, and GraphQL lags tx
// finality, so without this they'd double-register and abort. Cache the id and
// single-flight concurrent calls so registration happens exactly once.
const accountIdCache = new Map<string, string>();
const accountInflight = new Map<string, Promise<string>>();

// Discover the caller's Account, registering one on chain if absent. Returns the
// on-chain Account object id.
export function ensureAccount(opts: {
  signer: PrivySuiSigner;
  memwalAccountId: string;
  displayName: string;
  handle: string;
  bio?: string;
}): Promise<string> {
  const owner = opts.signer.toSuiAddress();
  const cached = accountIdCache.get(owner);
  if (cached) return Promise.resolve(cached);
  const pending = accountInflight.get(owner);
  if (pending) return pending;

  const run = (async () => {
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
  })()
    .then((id) => {
      accountIdCache.set(owner, id);
      return id;
    })
    .finally(() => accountInflight.delete(owner));

  accountInflight.set(owner, run);
  return run;
}
