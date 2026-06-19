"use client";

import { Footer } from "../Footer";
import { CodeBlock } from "../components/CodeBlock";
import { SchemaDiagram } from "../components/SchemaDiagram";

const muted = { color: "var(--muted)" } as const;

export default function SchemaPage() {
  return (
    <>
      <article className="article">
        <header>
          <h1>Data Model</h1>
          <p className="tagline">
            The artifact types Cortex persists, and how they relate
          </p>
        </header>

        <section>
          <h2 id="overview">Overview</h2>
          <p>
            Cortex&apos;s domain model is defined in{" "}
            <code>src/core/models.ts</code>. Every persisted artifact is JSON,
            addressed by its blob id (a content hash), and &mdash; on the live
            path &mdash; Seal-encrypted before it is written to Walrus. These
            types are the contract the whole system agrees on: backend, desktop,
            mobile, and the MCP connector.
          </p>
          <p>
            A <strong>Source</strong> is processed by an{" "}
            <strong>Extraction</strong>, which yields <strong>Memory</strong>{" "}
            records. Consolidation produces a <strong>MemoryDiff</strong> over
            those memories. The <strong>NamespaceManifest</strong> is the pointer
            record that ties everything together by blob id.
          </p>
          <SchemaDiagram />
        </section>

        <section>
          <h2 id="source">Source</h2>
          <p>
            A raw input you gave Cortex: a file, a note, or a page. The{" "}
            <code>type</code> is one of <code>note</code>, <code>document</code>,{" "}
            <code>image</code>, <code>audio</code>, <code>video</code>,{" "}
            <code>url</code>, or <code>structured</code>.
          </p>
          <CodeBlock
            language="typescript"
            code={`export type SourceKind =
  | "note"
  | "document"
  | "image"
  | "audio"
  | "video"
  | "url"
  | "structured";

export interface Source {
  kind: "cortex.source.v1";
  id: string;          // src_xxxx
  namespace: string;
  type: SourceKind;
  uri: string;         // path or URL
  title?: string;
  contentHash: string; // sha256 of the bytes
  bytes: number;
  addedAt: string;     // ISO
  blobId?: string;     // Walrus blob of the raw source, if stored
}`}
          />
        </section>

        <section>
          <h2 id="memory">Memory</h2>
          <p>
            A single durable memory, usually extracted from a <code>Source</code>.{" "}
            <code>when</code> is the time the memory is <em>about</em>;{" "}
            <code>createdAt</code> is when it was written. The <code>via</code>{" "}
            field records how it came to exist, and the{" "}
            <code>verified</code>, <code>dream</code>, and <code>tombstone</code>{" "}
            flags carry trust and lifecycle state.
          </p>
          <CodeBlock
            language="typescript"
            code={`export interface Memory {
  id: string;        // mem_xxxx
  namespace: string;
  text: string;
  sourceId?: string;
  tags: string[];
  when: string;      // the time the memory is *about*
  createdAt: string;
  agent: string;     // who/what wrote it
  via?: "extract" | "remember" | "consolidate" | "pattern" | string;
  confidence: number;
  verified?: boolean;
  dream?: boolean;
  tombstone?: boolean;
  note?: string;
}`}
          />
        </section>

        <section>
          <h2 id="extraction">Extraction</h2>
          <p>
            The output of running an extractor over one source. It records the{" "}
            <code>model</code> used, a <code>summary</code>, and the array of{" "}
            <code>memories</code> it produced.
          </p>
          <CodeBlock
            language="typescript"
            code={`export interface Extraction {
  kind: "cortex.extraction.v1";
  id: string;        // ext_xxxx
  namespace: string;
  sourceId: string;
  model: string;
  summary: string;
  memories: Memory[];
  createdAt: string;
}`}
          />
        </section>

        <section>
          <h2 id="memory-diff">MemoryDiff</h2>
          <p>
            A consolidation result produced by the agent during a{" "}
            <em>dream</em>. Each <code>MemoryDiff</code> carries a{" "}
            <code>window</code>, a <code>parentHead</code> (an
            optimistic-concurrency guard), the <code>inputs</code> it read as
            evidence, and an array of <code>operations</code>. Every operation
            cites the <code>evidence</code> blob ids it acted on.
          </p>
          <CodeBlock
            language="typescript"
            code={`export type DiffOperation =
  | { type: "consolidate"; mergeIds: string[]; into: { text: string };
      confidence: number; evidence: string[] }
  | { type: "pattern"; text: string; confidence: number;
      evidence: string[]; incidents: number }
  | { type: "prune"; targetId: string; reason: string;
      confidence: number; evidence: string[] }
  | { type: "verify"; targetId: string; verifiedAt: string;
      confidence: number; evidence: string[] };

export interface MemoryDiff {
  kind: "cortex.diff.v1";
  diffId: string;        // drm_xxxx
  namespace: string;
  window: { from: string; to: string };
  model: string;
  parentHead: string;    // optimistic-concurrency guard
  inputs: string[];      // source / extraction blob ids = evidence
  operations: DiffOperation[];
  createdAt: string;
}`}
          />
        </section>

        <section>
          <h2 id="namespace-manifest">NamespaceManifest</h2>
          <p>
            The per-namespace pointer record: a Walrus blob referenced from Sui.
            It holds the current <code>head</code>, the <code>versions</code>{" "}
            chain, and the blob ids of every <code>source</code>,{" "}
            <code>extraction</code>, and <code>diff</code>. Each{" "}
            <code>VersionRef</code> links a hash to its parent, the writer, and
            the Sui transaction that committed it.
          </p>
          <CodeBlock
            language="typescript"
            code={`export interface VersionRef {
  hash: string;
  parent: string;
  writer: string;
  suiTxn: string;
  diffId?: string;
  at: string;
}

export interface NamespaceManifest {
  kind: "cortex.manifest.v1";
  namespace: string;
  head: string;
  versions: VersionRef[];
  sources: string[];     // blob ids
  extractions: string[]; // blob ids
  diffs: string[];       // blob ids
}`}
          />
        </section>

        <section>
          <h2 id="typescript">TypeScript Surface</h2>
          <p>
            All artifact kinds are unioned into a single <code>Artifact</code>{" "}
            type, discriminated by its <code>kind</code> tag. The derived read
            views (digest, connections, changes, tags) are artifacts too &mdash;
            see <a href="/output">Memory Views</a> for what they contain.
          </p>
          <CodeBlock
            language="typescript"
            copyable
            code={`export type Artifact =
  | Source
  | Extraction
  | MemoryDiff
  | NamespaceManifest
  | Digest
  | ConnectionsArtifact
  | ChangesArtifact
  | TagsArtifact;

export type ArtifactKind = Artifact["kind"];`}
          />
        </section>

        <section>
          <h2 id="example">Example</h2>
          <p>
            A <code>Source</code>, the <code>Extraction</code> it produced, and
            one of the resulting <code>Memory</code> records:
          </p>
          <CodeBlock
            language="json"
            code={`{
  "kind": "cortex.source.v1",
  "id": "src_9f2a",
  "namespace": "default",
  "type": "note",
  "uri": "inline://devlog",
  "title": "devlog",
  "contentHash": "e3b0c44298fc1c149afbf4c8996fb924...",
  "bytes": 38,
  "addedAt": "2026-06-19T14:02:11.000Z",
  "blobId": "0xWAL_7c1d..."
}`}
          />
          <CodeBlock
            language="json"
            code={`{
  "kind": "cortex.extraction.v1",
  "id": "ext_4b81",
  "namespace": "default",
  "sourceId": "src_9f2a",
  "model": "claude",
  "summary": "Devlog note about shipping the Walrus storage path.",
  "memories": [
    {
      "id": "mem_1c30",
      "namespace": "default",
      "text": "Shipped the Walrus storage path.",
      "sourceId": "src_9f2a",
      "tags": ["walrus", "storage", "devlog"],
      "when": "2026-06-19T00:00:00.000Z",
      "createdAt": "2026-06-19T14:02:12.000Z",
      "agent": "extractor",
      "via": "extract",
      "confidence": 0.82
    }
  ],
  "createdAt": "2026-06-19T14:02:12.000Z"
}`}
          />
        </section>
      </article>

      <Footer />
    </>
  );
}
