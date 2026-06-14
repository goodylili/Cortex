// Read the user's knowledge-base files from chain. Each KbFile object records the
// Walrus blob id (as u256), name and mime; we turn that into a fast aggregator
// download URL. This is the source of truth for the Knowledge view and the file
// nodes shown in the brain map.

"use client";

import { blobIdFromInt } from "@mysten/walrus";
import { CORTEX_ENV } from "./env";
import { fileUrl } from "./files";
import { ownedObjects } from "./graphql";

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

export async function listKbFiles(owner: string): Promise<KbFileInfo[]> {
  if (!CORTEX_ENV.packageId) return [];
  const owned = await ownedObjects(
    owner,
    `${CORTEX_ENV.packageId}::walrus::KbFile`,
  );

  const files: KbFileInfo[] = [];
  for (const { id, json } of owned) {
    const fields = json as KbJson;
    const blobInt = fields.walrus?.blob_id;
    if (blobInt === undefined) continue;
    const blobId = blobIdFromInt(String(blobInt));
    files.push({
      id,
      name: String(fields.name ?? "file"),
      mime: String(fields.mime ?? ""),
      blobId,
      size: Number(fields.walrus?.size ?? 0),
      url: fileUrl(blobId),
    });
  }
  return files;
}
