"use client";

import Link from "next/link";
import { Footer } from "../../Footer";

export default function IntroducingCortexPage(): React.JSX.Element {
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
          <h1>Introducing Cortex</h1>
          <p className="tagline">A local-first persistent memory layer for AI</p>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <p style={{ margin: 0 }}>
            AI loses your context every time the session ends, the tool changes, or the
            model is swapped. You re-explain the same things over and over. The work an
            agent did yesterday is gone today.
          </p>

          <p style={{ margin: 0 }}>
            Cortex is built around one idea: that context should outlive any single chat.
            It ingests notes, files, and other sources, extracts durable memories from
            them, stores those artifacts on infrastructure you control, recalls the right
            context later, and improves over time through consolidation.
          </p>
        </div>

        <section>
          <h2 id="memory-not-chat">Memory, not chat history</h2>
          <p>
            Cortex is not a chatbot wrapper or a prompt library. It is a memory system with
            structured artifacts and durable state. A <code>Source</code> is a raw input —
            a note, document, image, audio file, URL, or structured payload. An{" "}
            <code>Extraction</code> turns that source into <code>Memory</code> records, each
            with text, tags, confidence, provenance, and timestamps.
          </p>
          <p>
            Every artifact is JSON, content-addressed by its hash, and (on the live path)
            encrypted before it is stored. See the <Link href="/schema">data model</Link>{" "}
            for the full set of types.
          </p>
        </section>

        <section>
          <h2 id="pipeline">From source to recall</h2>
          <p>
            The <Link href="/api">Cortex facade</Link> wraps the whole pipeline behind a
            small surface. You hand it a source; it stores the source, extracts memories,
            and writes them into a namespace you can recall from later.
          </p>
          <div style={{ marginTop: "0.75rem", fontSize: "0.8125rem", lineHeight: 1.7, background: "var(--surface)", padding: "1rem 1.25rem", borderRadius: "0.5rem", fontFamily: "var(--font-mono)" }}>
            <p style={{ margin: "0.375rem 0", color: "var(--ink)" }}>
              await cortex.ingestText(&quot;Decided to use Walrus for blob storage.&quot;);
            </p>
            <p style={{ margin: "0.375rem 0", color: "var(--muted)" }}>
              // later, in a different session, a different tool...
            </p>
            <p style={{ margin: "0.375rem 0", color: "var(--ink)" }}>
              const hits = await cortex.recall(&quot;storage&quot;);
            </p>
          </div>
          <p style={{ marginTop: "0.75rem" }}>
            With no live credentials configured, this all runs in <strong>mock mode</strong>
            {" "}— so you can exercise the full pipeline locally before wiring up any
            infrastructure.
          </p>
        </section>

        <section>
          <h2 id="consolidation">Memory that improves itself</h2>
          <p>
            Raw memories accumulate noise: duplicates, stale facts, corrections that
            contradict earlier ones. Cortex periodically <em>consolidates</em>. A{" "}
            <Link href="/api#consolidate">dream pass</Link> proposes operations — merge
            related memories, surface a recurring pattern, prune what is stale, verify what
            still holds — and commits that diff to durable storage <em>before</em> anything
            mutates. Applying it is gated by a concurrency check.
          </p>
          <p>
            The result is that corrections become current truth instead of competing facts,
            and the state stays inspectable rather than hidden inside an opaque store.
          </p>
        </section>

        <section>
          <h2 id="local-first">Local-first, user-controlled</h2>
          <p>
            There is no HTTP backend. The desktop and mobile apps embed the runtime
            directly. The only server is the <Link href="/mcp">MCP connector</Link>, which
            lets external agents and hosts reach the same memory plane through the same
            facade.
          </p>
          <p>
            When you do configure the live path, Cortex uses Sui for identity and
            coordination, Walrus for durable artifact storage, Seal for encryption and
            access gating, and MemWal for persistent, recallable namespaces. State is
            durable, inspectable, and permissioned — and it can move across interfaces,
            agents, and models.
          </p>
        </section>

        <section>
          <h2 id="whats-next">What&rsquo;s next</h2>
          <p>
            Cortex is an active build. The memory core, MCP server, and multi-agent
            foundations are wired end-to-end; other surfaces are still evolving. Follow
            along in the <Link href="/changelog">changelog</Link>.
          </p>
          <p>
            To get started, <Link href="/install">install Cortex</Link> and explore the{" "}
            <Link href="/api">Core API</Link>.
          </p>
        </section>
      </article>

      <Footer />
    </>
  );
}
