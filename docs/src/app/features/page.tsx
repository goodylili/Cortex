"use client";

import { Footer } from "../Footer";
import { CodeBlock } from "../components/CodeBlock";
import { FeaturesDemo } from "../components/FeaturesDemo";

const muted = { color: "var(--muted)" } as const;

export default function FeaturesPage() {
  return (
    <>
      <article className="article">
        <header>
          <h1>Concepts</h1>
          <p className="tagline">
            How Cortex turns sources into durable, recallable memory
          </p>
        </header>

        <section>
          <h2 id="memory-not-chat">Memory, Not Chat History</h2>
          <p>
            Cortex is a local-first persistent memory layer and multi-agent OS
            for AI. It is built on one idea: AI should not lose your context
            every time the session, tool, or model changes. A chat transcript is
            a flat log that grows until it is truncated. Cortex is the opposite
            &mdash; it ingests sources, extracts durable <code>Memory</code>{" "}
            records, stores them on infrastructure you control, recalls the right
            ones later, and corrects itself over time.
          </p>
          <p>
            The difference is structure and durability. A memory has text, tags,
            a confidence score, provenance back to its source, and timestamps.
            Corrections become current truth rather than competing facts, and the
            same memory plane is reachable across interfaces, models, and agents.
          </p>
          <FeaturesDemo />
        </section>

        <section>
          <h2 id="artifact-types">Artifact Types</h2>
          <p>
            Every persisted artifact is JSON, addressed by a content hash, and
            (on the live path) Seal-encrypted before it reaches Walrus. The core
            types are defined in <code>src/core/models.ts</code>:
          </p>
          <ul>
            <li>
              <strong>Source</strong> &mdash; a raw input you gave Cortex: a
              note, document, image, audio, video, URL, or structured payload.
            </li>
            <li>
              <strong>Memory</strong> &mdash; a single durable extracted memory
              with text, tags, confidence, provenance, and timestamps.
            </li>
            <li>
              <strong>Extraction</strong> &mdash; the result of running a model
              over one source, carrying a summary and the memories it produced.
            </li>
            <li>
              <strong>MemoryDiff</strong> &mdash; a structured consolidation
              result whose operations can consolidate, pattern, prune, or verify
              memories, each citing its evidence.
            </li>
            <li>
              <strong>NamespaceManifest</strong> &mdash; the per-namespace
              pointer record holding the current <code>head</code>, the version
              chain, and the blob ids of every source, extraction, and diff.
            </li>
          </ul>
          <p style={muted}>
            See the <a href="/schema">Data Model</a> page for the full field-level
            definitions.
          </p>
        </section>

        <section>
          <h2 id="local-first">Local-First &amp; Mock vs Live</h2>
          <p>
            The <code>Cortex</code> facade is embedded directly &mdash; desktop
            and mobile run it in-process, and there is no HTTP backend. The only
            server in the system is the MCP connector, which lets external agents
            reach the same memory through the same facade.
          </p>
          <p>
            With no live credentials configured, Cortex runs in{" "}
            <strong>mock mode</strong>. That makes the whole pipeline usable for
            development without Sui, Walrus, Seal, or MemWal. When the live path
            is configured, Cortex uses:
          </p>
          <ul>
            <li>
              <strong>Sui</strong> for identity and coordination
            </li>
            <li>
              <strong>Walrus</strong> for durable artifact storage
            </li>
            <li>
              <strong>Seal</strong> for encryption and access gating
            </li>
            <li>
              <strong>MemWal</strong> for persistent memory namespaces and recall
            </li>
          </ul>
          <p>
            The same code path runs in both modes; only the clients behind the
            facade change.
          </p>
        </section>

        <section>
          <h2 id="ingestion">Ingestion &amp; Extraction</h2>
          <p>
            You give Cortex a source, it stores it, and a model extracts memories
            from it. The facade exposes both a generic <code>ingest</code> and a
            convenience <code>ingestText</code>:
          </p>
          <CodeBlock
            language="typescript"
            code={`import { openCortex } from "@cortex/core";

const cortex = openCortex();

// quickest path: ingest a note inline
await cortex.ingestText("Shipped the Walrus storage path today", "devlog");

// or ingest any source kind
await cortex.ingest({
  type: "note",
  uri: "inline://devlog",
  title: "devlog",
  text: "Shipped the Walrus storage path today",
});`}
          />
          <p style={muted}>
            Ingestion stores the <code>Source</code>, runs the extractor to
            produce an <code>Extraction</code>, and persists the resulting{" "}
            <code>Memory</code> records into the namespace.
          </p>
        </section>

        <section>
          <h2 id="recall">Recall</h2>
          <p>
            Recall is how context comes back out. <code>recall(query, limit)</code>{" "}
            returns the memories most relevant to a query from the current
            namespace, and <code>memories()</code> returns the full live set.
          </p>
          <CodeBlock
            language="typescript"
            code={`const hits = await cortex.recall("walrus storage", 5);
const all = await cortex.memories();`}
          />
          <p style={muted}>
            See <a href="/output">Memory Views</a> for the derived read views built
            on top of recall.
          </p>
        </section>

        <section>
          <h2 id="consolidation">Consolidation (the &ldquo;Dream&rdquo;)</h2>
          <p>
            Memory is not append-only. Cortex periodically consolidates &mdash; a
            process it calls the <em>dream</em>. <code>dream()</code> proposes a{" "}
            <code>MemoryDiff</code> over a window of memories; applying it merges
            duplicates, records patterns, prunes stale memories, and re-verifies
            others. Each operation cites the evidence it acted on.
          </p>
          <CodeBlock
            language="typescript"
            code={`// propose a diff and apply it in one step
await cortex.dreamAndApply();

// or inspect the diff first
const { diff } = await cortex.dream();
await cortex.apply(diff);`}
          />
          <p style={muted}>
            The diff carries a <code>parentHead</code> as an optimistic-concurrency
            guard, so a stale consolidation cannot overwrite newer state.
          </p>
        </section>

        <section>
          <h2 id="verification">Verification</h2>
          <p>
            On the live path, durability is checkable. <code>verify()</code>{" "}
            confirms that the artifacts referenced by the namespace are actually
            fetchable from storage &mdash; that the blobs behind your memories
            still resolve. Individual memories also carry a <code>verified</code>{" "}
            flag set by the <code>verify</code> diff operation, so trust is part of
            the data, not a separate ledger.
          </p>
          <CodeBlock
            language="typescript"
            code={`const report = await cortex.verify();`}
          />
        </section>

        <section>
          <h2 id="multi-agent">Multi-Agent State</h2>
          <p>
            Because the memory plane is shared and inspectable, it doubles as
            coordination state for multiple agents. The repo includes the
            foundations for durable agent workflows: a shared task board, a
            message bus, memory-backed context, and MCP access so external hosts
            reach the same state.
          </p>
          <p>
            Agents read and write the same namespaced memory rather than passing
            opaque context between themselves. State can be durable, inspectable,
            and permissioned &mdash; a shared brain behind tools and agents
            instead of a per-session scratchpad.
          </p>
          <p style={muted}>
            External agents connect through the <a href="/mcp">MCP server</a>,
            which exposes recall, remember, ingest, forget, verify, and dream
            alongside the derived read views.
          </p>
        </section>
      </article>

      <Footer />
    </>
  );
}
