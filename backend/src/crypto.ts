// Content hashing, the memory state hash, id generation, and the blob codec
// (encode/decode with a kind guard so a Source can never be read as a Diff).

import { createHash, randomBytes } from "node:crypto";
import type { Artifact, Memory } from "./models.js";

const KINDS: ReadonlySet<string> = new Set<Artifact["kind"]>([
  "cortex.source.v1",
  "cortex.extraction.v1",
  "cortex.diff.v1",
  "cortex.manifest.v1",
  "cortex.digest.v1",
  "cortex.connections.v1",
  "cortex.changes.v1",
  "cortex.tags.v1",
]);

export function contentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

/** Deterministic 6-hex memory state hash (FNV-1a). The concurrency token. */
export function stateHash(parts: string[]): string {
  let h = 0x811c9dc5;
  const s = parts.join(" ");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 6);
}

export function memoryHead(memories: Pick<Memory, "id" | "text" | "verified" | "tombstone">[]): string {
  const live = memories
    .filter((m) => !m.tombstone)
    .map((m) => `${m.id}:${m.verified ? "v" : ""}:${m.text}`)
    .sort();
  return stateHash(live);
}

export function encode(artifact: Artifact): Uint8Array {
  if (!artifact || !KINDS.has(artifact.kind)) throw new Error(`encode: unknown kind ${(artifact as { kind?: string })?.kind}`);
  return new TextEncoder().encode(JSON.stringify(artifact));
}

export function decode<T extends Artifact = Artifact>(bytes: Uint8Array, expectedKind?: T["kind"]): T {
  let obj: unknown;
  try {
    obj = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("decode: not valid JSON");
  }
  const kind = (obj as { kind?: unknown })?.kind;
  if (typeof kind !== "string" || !KINDS.has(kind)) throw new Error(`decode: unknown kind ${String(kind)}`);
  if (expectedKind && kind !== expectedKind) throw new Error(`decode: expected ${expectedKind}, got ${kind}`);
  return obj as T;
}
