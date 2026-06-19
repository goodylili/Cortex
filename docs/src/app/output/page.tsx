"use client";

import { Footer } from "../Footer";
import { CodeBlock } from "../components/CodeBlock";

const muted = { color: "var(--muted)" } as const;

export default function OutputPage() {
  return (
    <>
      <article className="article">
        <header>
          <h1>Memory Views</h1>
          <p className="tagline">
            The derived read views the Cortex facade produces over your memory
          </p>
        </header>

        <section>
          <h2 id="overview">Overview</h2>
          <p>
            Raw <code>Memory</code> records are the source of truth, but you rarely
            read them flat. The <code>Cortex</code> facade in{" "}
            <code>src/core/cortex.ts</code> derives a handful of views on top of
            the live memory set &mdash; recall, tags, digest, timeline,
            connections, and head. Each is computed on demand from the current
            namespace; tombstoned memories are excluded from the derived
            artifacts.
          </p>
          <CodeBlock
            language="typescript"
            code={`import { openCortex } from "@cortex/core";

const cortex = openCortex();`}
          />
        </section>

        <section>
          <h2 id="recall">Recall</h2>
          <p>
            <code>recall(query, limit?)</code> returns the memories most relevant
            to a query from the current namespace. With an empty query it returns
            the working set; <code>memories()</code> returns every live memory.
          </p>
          <CodeBlock
            language="typescript"
            code={`const hits = await cortex.recall("walrus storage", 5);
const all = await cortex.memories();`}
          />
          <p style={muted}>
            Returns <code>Memory[]</code> &mdash; see the{" "}
            <a href="/schema#memory">Data Model</a> for the shape.
          </p>
        </section>

        <section>
          <h2 id="tags">Tags</h2>
          <p>
            <code>tags()</code> rolls the live memories into a tag cloud: each
            distinct tag with its occurrence count, sorted most-frequent first.
          </p>
          <CodeBlock
            language="typescript"
            code={`const tags = await cortex.tags();`}
          />
          <CodeBlock
            language="json"
            code={`{
  "kind": "cortex.tags.v1",
  "namespace": "default",
  "tags": [
    { "tag": "walrus", "count": 4 },
    { "tag": "storage", "count": 3 },
    { "tag": "devlog", "count": 2 }
  ],
  "createdAt": "2026-06-19T14:10:00.000Z"
}`}
          />
        </section>

        <section>
          <h2 id="digest">Digest</h2>
          <p>
            <code>digest(period?)</code> summarizes the memories whose{" "}
            <code>when</code> falls in a period and surfaces a few highlights. The
            period defaults to everything (<code>{"{ from: \"0000\", to: \"9999\" }"}</code>),
            and the summary counts memories and distinct topics in range.
          </p>
          <CodeBlock
            language="typescript"
            code={`const digest = await cortex.digest({
  from: "2026-06-01",
  to: "2026-06-30",
});`}
          />
          <CodeBlock
            language="json"
            code={`{
  "kind": "cortex.digest.v1",
  "namespace": "default",
  "period": { "from": "2026-06-01", "to": "2026-06-30" },
  "summary": "6 memories in this period across 9 topics.",
  "highlights": [
    "Shipped the Walrus storage path.",
    "Seal encryption gates blobs before upload."
  ],
  "createdAt": "2026-06-19T14:10:00.000Z"
}`}
          />
        </section>

        <section>
          <h2 id="timeline">Timeline</h2>
          <p>
            <code>timeline()</code> returns the namespace&apos;s version chain
            &mdash; the <code>versions</code> array from the{" "}
            <a href="/schema#namespace-manifest">NamespaceManifest</a>. Each entry
            is a <code>VersionRef</code> linking a hash to its parent, the writer,
            the Sui transaction that committed it, and the diff that produced it.
          </p>
          <CodeBlock
            language="typescript"
            code={`const versions = await cortex.timeline();`}
          />
          <CodeBlock
            language="json"
            code={`[
  {
    "hash": "0xH2...",
    "parent": "0xH1...",
    "writer": "0xUSER...",
    "suiTxn": "0xTXN...",
    "diffId": "drm_77c9",
    "at": "2026-06-19T14:08:00.000Z"
  }
]`}
          />
        </section>

        <section>
          <h2 id="connections">Connections</h2>
          <p>
            <code>connections()</code> links memories that share tags. For each
            pair with overlapping tags it emits a <code>Connection</code> whose{" "}
            <code>relation</code> lists the shared tags and whose{" "}
            <code>confidence</code> scales with how many they share. It is a
            lightweight, offline graph &mdash; capped at 200 connections.
          </p>
          <CodeBlock
            language="typescript"
            code={`const graph = await cortex.connections();`}
          />
          <CodeBlock
            language="json"
            code={`{
  "kind": "cortex.connections.v1",
  "namespace": "default",
  "connections": [
    {
      "from": "mem_1c30",
      "to": "mem_2a44",
      "relation": "shares:walrus,storage",
      "confidence": 1
    }
  ],
  "createdAt": "2026-06-19T14:10:00.000Z"
}`}
          />
        </section>

        <section>
          <h2 id="head">Head</h2>
          <p>
            <code>head()</code> returns the current head pointer for the namespace
            &mdash; the hash of the latest committed version. It is the same value
            a <code>MemoryDiff</code> guards against with its{" "}
            <code>parentHead</code>, so reading it lets you confirm you are
            consolidating against the newest state.
          </p>
          <CodeBlock
            language="typescript"
            code={`const head = await cortex.head();
// => "0xH2..."`}
          />
        </section>
      </article>

      <Footer />
    </>
  );
}
