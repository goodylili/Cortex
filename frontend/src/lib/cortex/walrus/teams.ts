// Client-side bindings for the standalone `teams::team` Move package: create teams,
// manage membership and roles, and re-point the team's feed / memory Walrus blobs.
// These mirror the transaction shape used by sharing.ts / workspace.ts and stay inert
// until the teams package is published and `NEXT_PUBLIC_CORTEX_TEAMS_PACKAGE_ID_*` is
// set (guarded by teamsOnchainEnabled). The Teams workspace runs from the local store
// regardless; this layer is how it syncs to chain once the package is live.
//
// The feed and memory blobs are Seal-encrypted under a team-scoped identity before
// upload (same scheme as sharing.ts: id_bytes(teamId) ‖ utf8(resource)); this module
// only records the resulting blob id on-chain, so a stored id leaks nothing.

"use client";

import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { getSuiClient } from "./clients";
import { CORTEX_ENV } from "./env";
import { moduleEvents, objectJson } from "./graphql";
import type { PrivySuiSigner } from "./signer";
import type { TeamRole } from "../teams";

const TEAM_MODULE = "team";
const CREATED_ID_OPERATION = "Created";
const SHARED_OWNER_KIND = "Shared";
const ROLE_CODE: Record<TeamRole, number> = { member: 0, admin: 1 };

// status: 0=ACTIVE, 1=ARCHIVED (mirrors teams::team STATUS_*).
export interface OnchainTeamSummary {
  id: string;
  name: string;
  ownerHandle: string;
  owner: string;
  status: number;
  memberCount: number;
}

function teamsTarget(fn: string): string {
  return `${CORTEX_ENV.teamsPackageId}::${TEAM_MODULE}::${fn}`;
}

interface ChangedObjectEffect {
  objectId: string;
  idOperation: string;
  outputOwner?: { $kind?: string } | null;
}
interface ExecutionEffects {
  changedObjects?: ChangedObjectEffect[];
}

function effectsOf(
  exec: Awaited<ReturnType<PrivySuiSigner["signAndExecuteTransaction"]>>,
): ExecutionEffects | undefined {
  return exec.$kind === "Transaction"
    ? (exec.Transaction.effects as ExecutionEffects | undefined)
    : (exec.FailedTransaction.effects as ExecutionEffects | undefined);
}

// create_team shares exactly one object; return the newly-created Shared Team's id.
function createdSharedObjectId(effects: ExecutionEffects | undefined): string {
  const created = (effects?.changedObjects ?? []).find(
    (obj) =>
      obj.idOperation === CREATED_ID_OPERATION &&
      obj.outputOwner?.$kind === SHARED_OWNER_KIND,
  );
  if (!created) {
    throw new Error(
      "create_team did not surface a newly-shared Team object in the transaction effects",
    );
  }
  return created.objectId;
}

async function run(
  signer: PrivySuiSigner,
  build: (tx: Transaction) => void,
): Promise<ExecutionEffects | undefined> {
  const tx = new Transaction();
  build(tx);
  const exec = await signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
  return effectsOf(exec);
}

// Open a new team; the caller becomes owner + first admin. Returns the Team object id.
export async function createTeamOnchain(
  signer: PrivySuiSigner,
  accountId: string,
  name: string,
): Promise<string> {
  const effects = await run(signer, (tx) =>
    tx.moveCall({
      target: teamsTarget("create_team"),
      arguments: [
        tx.object(accountId),
        tx.pure.string(name),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    }),
  );
  return createdSharedObjectId(effects);
}

export async function addMemberByAddressOnchain(
  signer: PrivySuiSigner,
  teamId: string,
  member: string,
  memberName: string,
  role: TeamRole,
): Promise<void> {
  await run(signer, (tx) =>
    tx.moveCall({
      target: teamsTarget("add_member_by_address"),
      arguments: [
        tx.object(teamId),
        tx.pure.address(member),
        tx.pure.string(memberName),
        tx.pure.u8(ROLE_CODE[role]),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    }),
  );
}

export async function addMemberByHandleOnchain(
  signer: PrivySuiSigner,
  teamId: string,
  handle: string,
  role: TeamRole,
): Promise<void> {
  await run(signer, (tx) =>
    tx.moveCall({
      target: teamsTarget("add_member_by_handle"),
      arguments: [
        tx.object(teamId),
        tx.object(CORTEX_ENV.registryId),
        tx.pure.string(handle),
        tx.pure.u8(ROLE_CODE[role]),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    }),
  );
}

export async function removeMemberOnchain(
  signer: PrivySuiSigner,
  teamId: string,
  member: string,
): Promise<void> {
  await run(signer, (tx) =>
    tx.moveCall({
      target: teamsTarget("remove_member"),
      arguments: [
        tx.object(teamId),
        tx.pure.address(member),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    }),
  );
}

export async function setRoleOnchain(
  signer: PrivySuiSigner,
  teamId: string,
  member: string,
  role: TeamRole,
): Promise<void> {
  await run(signer, (tx) =>
    tx.moveCall({
      target: teamsTarget("set_role"),
      arguments: [
        tx.object(teamId),
        tx.pure.address(member),
        tx.pure.u8(ROLE_CODE[role]),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    }),
  );
}

export async function archiveTeamOnchain(
  signer: PrivySuiSigner,
  teamId: string,
): Promise<void> {
  await run(signer, (tx) =>
    tx.moveCall({
      target: teamsTarget("archive_team"),
      arguments: [tx.object(teamId), tx.object(SUI_CLOCK_OBJECT_ID)],
    }),
  );
}

// Re-point the team feed (chat / handoff log) or memory index to an already-uploaded,
// Seal-encrypted Walrus blob. Any active member may call these.
export async function setTeamFeedOnchain(
  signer: PrivySuiSigner,
  teamId: string,
  blobId: string,
): Promise<void> {
  await run(signer, (tx) =>
    tx.moveCall({
      target: teamsTarget("set_feed_blob"),
      arguments: [
        tx.object(teamId),
        tx.pure.string(blobId),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    }),
  );
}

export async function setTeamMemoryOnchain(
  signer: PrivySuiSigner,
  teamId: string,
  blobId: string,
): Promise<void> {
  await run(signer, (tx) =>
    tx.moveCall({
      target: teamsTarget("set_memory_blob"),
      arguments: [
        tx.object(teamId),
        tx.pure.string(blobId),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    }),
  );
}

function vecSetSize(v: unknown): number {
  if (v && typeof v === "object" && "contents" in v) {
    const c = (v as { contents?: unknown }).contents;
    return Array.isArray(c) ? c.length : 0;
  }
  return 0;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// List the teams a given address owns, discovered from TeamCreated events and hydrated
// with each team object's current on-chain state.
export async function loadMyTeamsOnchain(
  owner: string,
): Promise<OnchainTeamSummary[]> {
  const events = await moduleEvents(
    `${CORTEX_ENV.teamsPackageId}::${TEAM_MODULE}::TeamCreated`,
  );
  const mine = events.filter((e) => asString(e.json.owner) === owner);
  const out: OnchainTeamSummary[] = [];
  for (const e of mine) {
    const id = asString(e.json.team_id);
    if (!id) continue;
    const obj = await objectJson(id);
    if (!obj) continue;
    out.push({
      id,
      name: asString(obj.name) || asString(e.json.name),
      ownerHandle: asString(obj.owner_handle) || asString(e.json.owner_handle),
      owner: asString(obj.owner) || owner,
      status: Number(obj.status ?? 0),
      memberCount: vecSetSize(obj.members),
    });
  }
  return out;
}
