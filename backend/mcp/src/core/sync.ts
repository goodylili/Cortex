// The pipelines. ingestSource: source -> extract -> store memories + manifest.
// runDream: load memory -> consolidate -> COMMIT diff to Walrus (nothing mutated)
// applyDiff: gated mutate against MemWal after a parent-head concurrency check.

import type { Clients } from "../../sui/app/clients";
import type { Config } from "./config";
import type { Extraction, MemoryDiff, Source, SourceKind } from "./models";
import { contentHash, newId, stateHash } from "./crypto";
import { putArtifact, getArtifact } from "../../sui/app/clients";
import {
  loadManifest,
  saveManifest,
  withSource,
  withExtraction,
  withDiff,
  withVersion,
  versionFromDiff,
} from "../../sui/app/manifest";
import { extractSource, type RawInput } from "./extractor";
import { createConsolidator, type Consolidator } from "./agent";

export interface IngestInput {
  type: SourceKind;
  uri: string;
  title?: string;
  text?: string;
  bytes?: Uint8Array;
  hint?: string;
}

export interface IngestResult {
  source: Source;
  extraction: Extraction;
  memoryIds: string[];
}

/** Add a source, extract memories, persist everything, update the manifest. */
export async function ingestSource(
  c: Clients,
  cfg: Config,
  input: IngestInput,
): Promise<IngestResult> {
  const ns = cfg.namespace;
  const bytes = input.bytes ?? new TextEncoder().encode(input.text ?? "");
  const source: Source = {
    kind: "cortex.source.v1",
    id: newId("src"),
    namespace: ns,
    type: input.type,
    uri: input.uri,
    title: input.title,
    contentHash: contentHash(bytes),
    bytes: bytes.length,
    addedAt: new Date().toISOString(),
  };
  const srcBlob = await putArtifact(c, source);
  source.blobId = srcBlob;

  const raw: RawInput = {
    text: input.text,
    bytes: input.bytes,
    hint: input.hint,
  };
  const extraction = await extractSource(cfg, source, raw);
  const extBlob = await putArtifact(c, extraction);

  // write extracted memories into the live memory plane
  const memoryIds: string[] = [];
  for (const m of extraction.memories) {
    const { memoryId } = await c.memwal.remember(ns, m.text, {
      agent: "extractor",
      via: "extract",
      tags: m.tags,
    });
    memoryIds.push(memoryId);
  }

  let manifest = await loadManifest(c, ns);
  manifest = withExtraction(withSource(manifest, srcBlob), extBlob);
  await saveManifest(c, manifest);

  return { source, extraction, memoryIds };
}

export interface DreamResult {
  diff: MemoryDiff;
  diffBlobId: string;
}

/** Consolidate. Commits the diff to Walrus BEFORE anything mutates. */
export async function runDream(
  c: Clients,
  cfg: Config,
  opts: {
    window?: { from: string; to: string };
    consolidator?: Consolidator;
  } = {},
): Promise<DreamResult> {
  const ns = cfg.namespace;
  const now = new Date().toISOString();
  const window = opts.window ?? { from: "0000", to: "9999" };
  const consolidator = opts.consolidator ?? createConsolidator(cfg);

  let manifest = await loadManifest(c, ns);
  const { head, memories } = await c.memwal.restore(ns);
  const evidence = manifest.extractions.length
    ? manifest.extractions
    : manifest.sources;
  const operations = await consolidator.consolidate(memories, evidence, now);

  const diff: MemoryDiff = {
    kind: "cortex.diff.v1",
    diffId: "drm_" + stateHash([ns, now, ...evidence]),
    namespace: ns,
    window,
    model: consolidator.name,
    parentHead: head,
    inputs: evidence,
    operations,
    createdAt: now,
  };
  const diffBlobId = await putArtifact(c, diff);
  manifest = withDiff(manifest, diffBlobId);
  await saveManifest(c, manifest);
  return { diff, diffBlobId };
}

export interface ApplyResult {
  newHead: string;
  suiTxn: string;
  applied: number;
}

/** Gated apply with a parent-head concurrency check. */
export async function applyDiff(
  c: Clients,
  diff: MemoryDiff,
): Promise<ApplyResult> {
  const ns = diff.namespace;
  const before = await c.memwal.restore(ns);
  if (before.head !== diff.parentHead)
    throw new Error(
      `head moved (${before.head} != ${diff.parentHead}); re-run the dream`,
    );

  let applied = 0;
  for (const op of diff.operations) {
    if (op.type === "consolidate") {
      await c.memwal.remember(ns, op.into.text, {
        agent: "cortex",
        via: "consolidate",
        dream: true,
      });
      for (const id of op.mergeIds)
        await c.memwal.tombstone(ns, id, `superseded (${diff.diffId})`);
      applied++;
    } else if (op.type === "pattern") {
      await c.memwal.remember(ns, op.text, {
        agent: "cortex",
        via: "pattern",
        dream: true,
      });
      applied++;
    } else if (op.type === "prune") {
      await c.memwal.tombstone(ns, op.targetId, op.reason);
      applied++;
    } else if (op.type === "verify") {
      await c.memwal.stampVerified(ns, op.targetId, op.verifiedAt);
      applied++;
    }
  }
  const after = await c.memwal.restore(ns);
  const manifest = await loadManifest(c, ns);
  const saved = await saveManifest(
    c,
    withVersion(
      manifest,
      versionFromDiff(diff, after.head, "cortex", "pending"),
    ),
  );
  return { newHead: after.head, suiTxn: saved.suiTxn, applied };
}

/** Verify: fetch every blob straight from the aggregator (relayer bypassed). */
export async function verify(
  c: Clients,
  cfg: Config,
): Promise<{ fetched: number; total: number; head: string }> {
  const manifest = await loadManifest(c, cfg.namespace);
  const blobs = [
    ...manifest.sources,
    ...manifest.extractions,
    ...manifest.diffs,
  ];
  let fetched = 0;
  for (const b of blobs) {
    try {
      await c.walrus.getBlob(b);
      fetched++;
    } catch {
      /* not reachable */
    }
  }
  return { fetched, total: blobs.length, head: manifest.head };
}

export async function getExtraction(
  c: Clients,
  blobId: string,
): Promise<Extraction> {
  return getArtifact<Extraction>(c, blobId, "cortex.extraction.v1");
}
