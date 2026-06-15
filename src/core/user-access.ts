// Reads an authorized user's on-chain Account object. The MCP holds its own admin
// wallet (cfg.delegateKey); once a user grants it via account::grant_admin, the MCP
// can read that user's public profile, the MemWal account pointer, and the durable
// context pointers stored in the account's settings VecMap. Loosely typed + lazily
// imported (the Sui SDK is an optional peer); degrades to null rather than crashing.

import type { Config } from "./config";
import { importExternal } from "./external";

const ACCOUNT_STRUCT_SUFFIX = "::account::Account";

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
    const sui: any = await importExternal("@mysten/sui/client");
    const client = new sui.SuiClient({ url: cfg.sui.rpc });
    const owned = await client.getOwnedObjects({
      owner,
      filter: {
        StructType: `${cfg.seal.policyPackage}${ACCOUNT_STRUCT_SUFFIX}`,
      },
      options: { showContent: true },
    });
    const entries: any[] = owned?.data ?? [];
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
      memwalAccountId: fields?.memwalAccountId ?? "",
      settings,
    };
  } catch {
    return null;
  }
}
