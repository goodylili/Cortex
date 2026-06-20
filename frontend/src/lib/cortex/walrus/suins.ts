// SuiNS usernames for Cortex. The project owns the parent domain (cortex.sui) and
// hands each user a *leaf* subname `<username>.<parent>` that points at their Sui
// address. Leaves carry no NFT  -  the parent registration keeps control  -  so claiming
// is a single server-signed transaction (see /api/suins/claim). This module does the
// browser-side work: normalize/validate a username, resolve a name to an address
// (used by memory-sharing to turn a typed handle into a recipient), and POST a claim.

"use client";

import { SuinsClient } from "@mysten/suins";
import { CORTEX_ENV } from "./env";
import { getSuiClient } from "./clients";

// SuiNS labels are lowercase a-z/0-9/hyphen; the leaf label must satisfy the same
// length bounds the registry enforces for second-level labels.
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 63;
const USERNAME_PATTERN = /^[a-z0-9-]+$/;
const CLAIM_ENDPOINT = "/api/suins/claim";

// Lowercase + trim, then assert the shape. Throws an actionable error so the UI can
// surface exactly why a handle was rejected rather than failing silently on-chain.
export function normalizeUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (
    normalized.length < USERNAME_MIN_LENGTH ||
    normalized.length > USERNAME_MAX_LENGTH
  ) {
    throw new Error(
      `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`,
    );
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new Error(
      "Username may only contain lowercase letters, numbers and hyphens",
    );
  }
  if (normalized.startsWith("-") || normalized.endsWith("-")) {
    throw new Error("Username may not start or end with a hyphen");
  }
  return normalized;
}

// `great` -> `great.cortex.sui`. The parent comes from env so the deployment owns it.
export function toSuinsName(username: string): string {
  return `${normalizeUsername(username)}.${CORTEX_ENV.suinsParent}`;
}

let suinsClient: SuinsClient | undefined;

// Read-only SuiNS client over the shared Sui gRPC client; network drives which
// package set (mainnet/testnet) the SDK targets.
function getSuinsClient(): SuinsClient {
  if (!suinsClient) {
    suinsClient = new SuinsClient({
      client: getSuiClient(),
      network: CORTEX_ENV.network,
    });
  }
  return suinsClient;
}

// Resolve a full SuiNS name (e.g. `bob.cortex.sui`) to its target Sui address.
// Returns null on not-found / unset target / any network failure  -  never throws  -  so
// callers (memory-sharing) can fall back to treating the input as a raw address.
export async function resolveSuinsAddress(
  name: string,
): Promise<string | null> {
  try {
    const record = await getSuinsClient().getNameRecord(name);
    const target = record?.targetAddress;
    return target && target.length > 0 ? target : null;
  } catch {
    return null;
  }
}

export interface ClaimResult {
  name: string;
  address: string;
  digest?: string;
}

// Ask the server (which holds the parent domain) to mint the leaf subname pointing
// at `address` (the claimant's Sui address). The username is validated client-side
// first for a fast error; the server re-validates and re-checks the address.
export async function claimUsername(
  username: string,
  address: string,
): Promise<ClaimResult> {
  normalizeUsername(username);

  const res = await fetch(CLAIM_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, address, network: CORTEX_ENV.network }),
  });

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Claim failed (${res.status})`;
    throw new Error(message);
  }

  return data as ClaimResult;
}
