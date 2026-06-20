// Read the user's knowledge-base files from chain. Each KbFile object records the
// Walrus blob id (as u256), name and mime; we turn that into a fast aggregator
// download URL. This is the source of truth for the Knowledge view and the file
// nodes shown in the brain map.

"use client";

import { blobIdFromInt } from "@mysten/walrus";
import { getAccountId } from "./account";
import { CORTEX_ENV } from "./env";
import { fileUrl } from "./files";
import { objectJson } from "./graphql";

export interface KbFileInfo {
  id: string;
  name: string;
  mime: string;
  blobId: string;
  size: number;
  url: string;
}

// GraphQL inlines nested Move structs as plain JSON objects (no `.fields`).
interface KbJson {
  name?: string;
  mime?: string;
  walrus?: { blob_id?: string | number; size?: string | number };
}

// VecSet<ID> serializes as { contents: [id, ...] } (or a bare array, defensively).
function vecSetIds(value: unknown): string[] {
  const entries = Array.isArray(value)
    ? value
    : ((value as { contents?: unknown } | null | undefined)?.contents ?? []);
  return Array.isArray(entries)
    ? entries.filter((e): e is string => typeof e === "string")
    : [];
}

// KbFile objects are shared on chain (transfer::share_object), so they don't show
// up under the owner's owned objects. The Account holds the authoritative set of
// the user's KbFile ids (account.kb_files), so read those and fetch each object.
export async function listKbFiles(owner: string): Promise<KbFileInfo[]> {
  if (!CORTEX_ENV.packageId) return [];
  const accountId = await getAccountId(owner);
  if (!accountId) return [];
  const account = await objectJson(accountId);
  const ids = vecSetIds(account?.kb_files);
  if (ids.length === 0) return [];

  const objects = await Promise.all(ids.map((id) => objectJson(id)));
  const files: KbFileInfo[] = [];
  for (let i = 0; i < ids.length; i++) {
    const fields = objects[i] as KbJson | null;
    const blobInt = fields?.walrus?.blob_id;
    if (blobInt === undefined) continue;
    const blobId = blobIdFromInt(String(blobInt));
    files.push({
      id: ids[i],
      name: String(fields?.name ?? "file"),
      mime: String(fields?.mime ?? ""),
      blobId,
      size: Number(fields?.walrus?.size ?? 0),
      url: fileUrl(blobId),
    });
  }
  return files;
}
