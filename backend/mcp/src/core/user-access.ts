// Reads an authorized user's on-chain Account object. The MCP holds its own admin
// wallet (cfg.delegateKey); once a user grants it via account::grant_admin, the MCP
// can read that user's public profile, the MemWal account pointer, and the durable
// context pointers stored in the account's settings VecMap. The read goes straight
// to the fullnode over JSON-RPC (no SDK client): @mysten/sui v2 dropped the
// `SuiClient` constructor from `@mysten/sui/client`, so the old `new SuiClient()`
// path threw and silently degraded every account read to null. Degrades to null
// rather than crashing.

import type { Config } from "./config";

const ACCOUNT_STRUCT_SUFFIX = "::account::Account";
const OWNED_PAGE_LIMIT = 50;

export interface UserAccount {
  accountId: string;
  owner: string;
  profile: { displayName: string; handle: string; bio: string };
  memwalAccountId: string;
  settings: Record<string, string>;
}

export async function readUserAccount(
  cfg: Config,
  owner: string,
): Promise<UserAccount | null> {
  if (!cfg.seal.policyPackage) return null;
  try {
    const res = await fetch(cfg.sui.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getOwnedObjects",
        params: [
          owner,
          {
            filter: {
              StructType: `${cfg.seal.policyPackage}${ACCOUNT_STRUCT_SUFFIX}`,
            },
            options: { showContent: true },
          },
          null,
          OWNED_PAGE_LIMIT,
        ],
      }),
    });
    const body = (await res.json()) as {
      result?: { data?: any[] };
    };
    const entries: any[] = body?.result?.data ?? [];
    const first = entries.find((e) => e?.data?.content?.fields);
    if (!first) return null;
    const data = first.data;
    const fields = data?.content?.fields ?? {};
    const profileFields = fields?.profile?.fields ?? {};
    const settingsContents: any[] =
      fields?.settings?.fields?.contents ?? [];
    const settings: Record<string, string> = {};
    for (const entry of settingsContents) {
      const key = entry?.fields?.key;
      const value = entry?.fields?.value;
      if (typeof key === "string") settings[key] = value ?? "";
    }
    return {
      accountId: data?.objectId ?? "",
      owner: fields?.owner ?? owner,
      profile: {
        displayName: profileFields?.display_name ?? "",
        handle: profileFields?.handle ?? "",
        bio: profileFields?.bio ?? "",
      },
      memwalAccountId: fields?.memwal_account_id ?? "",
      settings,
    };
  } catch {
    return null;
  }
}
