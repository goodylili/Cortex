// Read the user's knowledge-base files from chain. Each KbFile object records the
// Walrus blob id (as u256), name and mime; we turn that into a fast aggregator
// download URL. This is the source of truth for the Knowledge view and the file
// nodes shown in the brain map.

"use client";

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { blobIdFromInt } from "@mysten/walrus";
import { CORTEX_ENV } from "./env";
import { fileUrl } from "./files";

export interface KbFileInfo {
  id: string;
  name: string;
  mime: string;
  blobId: string;
  size: number;
  url: string;
}

interface KbObject {
  objectId?: string;
  content?: {
    fields?: {
      name?: string;
      mime?: string;
      walrus?: { fields?: { blob_id?: string | number; size?: string | number } };
    };
  };
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

export async function listKbFiles(owner: string): Promise<KbFileInfo[]> {
  if (!CORTEX_ENV.packageId) return [];
  const res = (await readClient().getOwnedObjects({
    owner,
    filter: { StructType: `${CORTEX_ENV.packageId}::walrus::KbFile` },
    options: { showContent: true },
  })) as { data?: { data?: KbObject }[] };

  const files: KbFileInfo[] = [];
  for (const item of res.data ?? []) {
    const data = item.data;
    const fields = data?.content?.fields;
    const blobInt = fields?.walrus?.fields?.blob_id;
    if (!data?.objectId || !fields || blobInt === undefined) continue;
    const blobId = blobIdFromInt(String(blobInt));
    files.push({
      id: data.objectId,
      name: String(fields.name ?? "file"),
      mime: String(fields.mime ?? ""),
      blobId,
      size: Number(fields.walrus?.fields?.size ?? 0),
      url: fileUrl(blobId),
    });
  }
  return files;
}
