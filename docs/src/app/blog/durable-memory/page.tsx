"use client";

import Link from "next/link";
import { Footer } from "../../Footer";

export default function DurableMemoryPage(): React.JSX.Element {
  return (
    <>
      <article className="article">
        <header>
          <p
            style={{
              fontSize: "0.6875rem",
              fontWeight: 300,
              color: "var(--muted)",
              margin: "0 0 0.5rem 0",
            }}
          >
            June 19, 2026
          </p>
          <h1>Why Memory Should Be Durable</h1>
          <p className="tagline">Inspectable, content-addressed, consolidated over time</p>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <p style={{ margin: 0 }}>
            Most AI memory today is a black box. Something is stored, somewhere, in a shape
            you cannot see, and retrieved by rules you cannot audit. That is fine until it
            recalls the wrong thing, holds onto a fact you corrected weeks ago, or quietly
            loses everything when the backend changes.
          </p>
          <p style={{ margin: 0 }}>
            Cortex takes the opposite stance. Memory is a set of structured artifacts you
            can read, address by hash, and watch evolve. Hidden context is a liability;
            durable, inspectable context is an asset.
          </p>
        </div>

        <section>
          <h2 id="inspectable">Inspectable by default</h2>
          <p>
            Every piece of state in Cortex is a typed artifact —{" "}
            <Link href="/schema">Source, Memory, Extraction, MemoryDiff</Link>, and the
            NamespaceManifest that ties them together. There is no opaque embedding blob
            standing in for &ldquo;what the model remembers.&rdquo; You can list memories,
            see their tags and confidence, and trace each one back to the source it came
            from.
          </p>
        </section>

        <section>
          <h2 id="content-addressed">Content-addressed storage</h2>
          <p>
            Artifacts are addressed by the hash of their bytes. The same content always
            yields the same id, which makes state verifiable: you can fetch a blob straight
            from storage and confirm it is exactly what was committed. The{" "}
            <Link href="/api#verify">verify</Link> step does precisely this — it pulls every
            blob in the manifest from the Walrus aggregator and reports what is reachable.
          </p>
        </section>

        <section>
          <h2 id="consolidation">Consolidation, not accumulation</h2>
          <p>
            A memory system that only ever appends becomes a junk drawer. Cortex{" "}
            <Link href="/api#consolidate">consolidates</Link>: it merges duplicates,
            promotes recurring observations into patterns, prunes the stale, and verifies
            what still holds. Crucially, each proposed change is committed as a diff{" "}
            <em>before</em> anything mutates, and applied only after a concurrency check —
            so consolidation is reversible and never a surprise.
          </p>
        </section>

        <section>
          <h2 id="portable">Portable across tools and models</h2>
          <p>
            Because the artifacts are durable and the schema is fixed, the same memory plane
            can be reached from the desktop app, the mobile app, or any external agent over
            the <Link href="/mcp">MCP server</Link>. Switch models, switch tools — the
            context stays. That is what makes Cortex a substrate rather than a feature of
            one chat window.
          </p>
          <p>
            Read more in <Link href="/blog/introducing-cortex">Introducing Cortex</Link>,
            or jump straight to the <Link href="/api">Core API</Link>.
          </p>
        </section>
      </article>

      <Footer />
    </>
  );
}
