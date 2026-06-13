// Cortex domain models. Every persisted artifact is JSON, Seal-encrypted before
// it hits Walrus, and addressed by its blob id (content hash). Lock these early —
// the whole system (backend, desktop, mobile) agrees on them.

export type SourceKind =
  | "note"
  | "document"
  | "image"
  | "audio"
  | "video"
  | "url"
  | "structured";

/** A raw input the user gave Cortex: a file, a note, a page. */
export interface Source {
  kind: "cortex.source.v1";
  id: string; // src_xxxx
  namespace: string;
  type: SourceKind;
  uri: string; // path or URL
  title?: string;
  contentHash: string; // sha256 of the bytes
  bytes: number;
  addedAt: string; // ISO
  blobId?: string; // Walrus blob of the raw source, if stored
}

/** A single durable memory, usually extracted from a Source. */
export interface Memory {
  id: string; // mem_xxxx
  namespace: string;
  text: string;
  sourceId?: string;
  tags: string[];
  when: string; // the time the memory is *about*
  createdAt: string;
  agent: string; // who/what wrote it
  via?: "extract" | "remember" | "consolidate" | "pattern" | string;
  confidence: number;
  verified?: boolean;
  dream?: boolean;
  tombstone?: boolean;
  note?: string;
}

/** The output of running an extractor over one Source. */
export interface Extraction {
  kind: "cortex.extraction.v1";
  id: string; // ext_xxxx
  namespace: string;
  sourceId: string;
  model: string;
  summary: string;
  memories: Memory[];
  createdAt: string;
}

/** A consolidation operation produced by the agent; each cites its evidence. */
export type DiffOperation =
  | {
      type: "consolidate";
      mergeIds: string[];
      into: { text: string };
      confidence: number;
      evidence: string[];
    }
  | {
      type: "pattern";
      text: string;
      confidence: number;
      evidence: string[];
      incidents: number;
    }
  | {
      type: "prune";
      targetId: string;
      reason: string;
      confidence: number;
      evidence: string[];
    }
  | {
      type: "verify";
      targetId: string;
      verifiedAt: string;
      confidence: number;
      evidence: string[];
    };

export type DiffOpType = DiffOperation["type"];

export interface MemoryDiff {
  kind: "cortex.diff.v1";
  diffId: string; // drm_xxxx
  namespace: string;
  window: { from: string; to: string };
  model: string;
  parentHead: string; // optimistic-concurrency guard
  inputs: string[]; // source / extraction blob ids = evidence
  operations: DiffOperation[];
  createdAt: string;
}

export interface VersionRef {
  hash: string;
  parent: string;
  writer: string;
  suiTxn: string;
  diffId?: string;
  at: string;
}

/** Per-namespace pointer record. A Walrus blob, referenced from Sui. */
export interface NamespaceManifest {
  kind: "cortex.manifest.v1";
  namespace: string;
  head: string;
  versions: VersionRef[];
  sources: string[]; // blob ids
  extractions: string[]; // blob ids
  diffs: string[]; // blob ids
}

// ---- derived artifacts -------------------------------------------------------

export interface Digest {
  kind: "cortex.digest.v1";
  namespace: string;
  period: { from: string; to: string };
  summary: string;
  highlights: string[];
  createdAt: string;
}

export interface Connection {
  from: string; // memory id
  to: string; // memory id
  relation: string;
  confidence: number;
}
export interface ConnectionsArtifact {
  kind: "cortex.connections.v1";
  namespace: string;
  connections: Connection[];
  createdAt: string;
}

export interface ChangeEntry {
  memoryId: string;
  change: "added" | "verified" | "superseded" | "tombstoned";
  at: string;
  note?: string;
}
export interface ChangesArtifact {
  kind: "cortex.changes.v1";
  namespace: string;
  changes: ChangeEntry[];
  createdAt: string;
}

export interface TagsArtifact {
  kind: "cortex.tags.v1";
  namespace: string;
  tags: { tag: string; count: number }[];
  createdAt: string;
}

export type Artifact =
  | Source
  | Extraction
  | MemoryDiff
  | NamespaceManifest
  | Digest
  | ConnectionsArtifact
  | ChangesArtifact
  | TagsArtifact;

export type ArtifactKind = Artifact["kind"];
