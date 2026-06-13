// The namespace manifest: a Walrus blob holding the pointer record, referenced
// from Sui. Read current -> append -> write new blob -> record pointer on chain.

import type { Clients } from "./db.js";
import type { MemoryDiff, NamespaceManifest, VersionRef } from "./models.js";
import { putArtifact, getArtifact } from "./db.js";

export function emptyManifest(namespace: string): NamespaceManifest {
  return { kind: "cortex.manifest.v1", namespace, head: "000000", versions: [], sources: [], extractions: [], diffs: [] };
}

export async function loadManifest(c: Clients, namespace: string): Promise<NamespaceManifest> {
  let ptr;
  try {
    ptr = await c.sui.readManifestPointer(namespace);
  } catch {
    return emptyManifest(namespace);
  }
  if (!ptr?.manifestBlobId) return emptyManifest(namespace);
  return getArtifact<NamespaceManifest>(c, ptr.manifestBlobId, "cortex.manifest.v1");
}

export async function saveManifest(c: Clients, m: NamespaceManifest): Promise<{ manifestBlobId: string; suiTxn: string }> {
  const manifestBlobId = await putArtifact(c, m);
  const suiTxn = await c.sui.recordManifest(m.namespace, manifestBlobId);
  return { manifestBlobId, suiTxn };
}

export const withSource = (m: NamespaceManifest, b: string): NamespaceManifest => ({ ...m, sources: [b, ...m.sources] });
export const withExtraction = (m: NamespaceManifest, b: string): NamespaceManifest => ({ ...m, extractions: [b, ...m.extractions] });
export const withDiff = (m: NamespaceManifest, b: string): NamespaceManifest => ({ ...m, diffs: [b, ...m.diffs] });
export const withVersion = (m: NamespaceManifest, v: VersionRef): NamespaceManifest => ({ ...m, head: v.hash, versions: [v, ...m.versions] });

export function versionFromDiff(diff: MemoryDiff, newHead: string, writer: string, suiTxn: string): VersionRef {
  return { hash: newHead, parent: diff.parentHead, writer, suiTxn, diffId: diff.diffId, at: diff.createdAt };
}
