// The list of MCP clients (e.g. Claude) the user has connected via managed OAuth.
// It is the durable, owned record behind the dashboard's "connected apps" list:
// one account setting holding a JSON array, written on consent and pruned on
// revoke. The real authority is still the on-chain delegate grant; this record
// only lets the user see and name what they have connected.

"use client";

import { loadSettingValue, saveSettingValue } from "./sessions";
import type { PrivySuiSigner } from "./signer";

export const CONNECTIONS_KEY = "mcp:connections";

export interface ConnectionRecord {
  id: string;
  client: string;
  clientId?: string;
  createdAt: number;
}

export async function listConnectionsFor(
  accountId: string,
): Promise<ConnectionRecord[]> {
  const raw = await loadSettingValue(accountId, CONNECTIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ConnectionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveConnection(
  signer: PrivySuiSigner,
  accountId: string,
  record: ConnectionRecord,
): Promise<ConnectionRecord[]> {
  const current = await listConnectionsFor(accountId);
  const next = [record, ...current.filter((c) => c.id !== record.id)];
  await saveSettingValue(
    signer,
    accountId,
    CONNECTIONS_KEY,
    JSON.stringify(next),
  );
  return next;
}

export async function removeConnection(
  signer: PrivySuiSigner,
  accountId: string,
  id: string,
): Promise<ConnectionRecord[]> {
  const next = (await listConnectionsFor(accountId)).filter((c) => c.id !== id);
  await saveSettingValue(
    signer,
    accountId,
    CONNECTIONS_KEY,
    JSON.stringify(next),
  );
  return next;
}

export async function clearConnections(
  signer: PrivySuiSigner,
  accountId: string,
): Promise<void> {
  await saveSettingValue(signer, accountId, CONNECTIONS_KEY, JSON.stringify([]));
}
