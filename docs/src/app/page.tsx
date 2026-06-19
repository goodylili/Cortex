"use client";

import Link from "next/link";
import { Footer } from "./Footer";
import { HeroDemo } from "./components/HeroDemo";

export default function CortexOverview() {
  return (
    <>
      <article className="article" style={{ paddingTop: "3.75rem" }}>
        <header>
          <h1 style={{ fontSize: "2rem", lineHeight: 1.15, marginBottom: "0.5rem" }}>
            A persistent memory layer
            <br />
            for AI.
          </h1>
          <p className="tagline">
            Cortex is a local-first memory layer and multi-agent operating system. It keeps your
            context when the session, tool, or model changes &mdash; ingesting your notes and files,
            extracting durable memories, storing them on infrastructure you control, and recalling
            the right context later.
          </p>
        </header>

        <HeroDemo />

        <section>
          <h2>The problem</h2>
          <p>
            Every AI session starts from zero. Close the tab, switch models, or move to a different
            tool, and the context is gone. You re-explain the same project, the same preferences, the
            same decisions &mdash; over and over. Chat history is not memory: it is an opaque,
            per-tool transcript that no other agent can read and that never reconciles corrections.
          </p>
        </section>

        <section>
          <h2>What Cortex does</h2>
          <p>
            Cortex sits underneath your agents and tools as a shared brain. You give it a source, it
            extracts durable memories, persists them in a namespace, and recalls them later for any
            agent or model that asks. The pipeline has four stages:
          </p>
          <ol>
            <li>
              <strong>Ingest</strong> &mdash; hand Cortex a note, document, image, audio, video, URL,
              or structured payload.
            </li>
            <li>
              <strong>Extract</strong> &mdash; Cortex turns each source into structured memories with
              text, tags, confidence, and provenance.
            </li>
            <li>
              <strong>Store</strong> &mdash; artifacts persist in a namespace, on the local mock path
              by default or on your own infrastructure when live.
            </li>
            <li>
              <strong>Recall</strong> &mdash; later, any agent recalls the right memories by query,
              along with derived views like tags, digests, and timelines.
            </li>
          </ol>
        </section>

        <section>
          <h2>Memory, not chat history</h2>
          <p>
            Cortex is a memory system with structured artifacts and durable state, not a chatbot
            wrapper. The central types are a <code>Source</code> (a raw input), a <code>Memory</code>{" "}
            (a durable extracted fact with provenance), an <code>Extraction</code> (the result of
            processing a source), a <code>MemoryDiff</code> (a structured consolidation result), and a{" "}
            <code>NamespaceManifest</code> (the per-namespace pointer record for versions and
            artifacts).
          </p>
          <p>
            Because state is structured and inspectable, corrections become current truth instead of
            competing facts. Cortex periodically consolidates memory &mdash; merging duplicates,
            verifying claims, pruning the stale, and surfacing patterns &mdash; through a step it calls{" "}
            <em>dream</em>.
          </p>
        </section>

        <section>
          <h2>Local-first by default</h2>
          <p>
            With no live credentials configured, Cortex runs in <strong>mock mode</strong>. The whole
            pipeline &mdash; ingest, extract, recall, consolidate, verify &mdash; works on your
            machine with no wallet, no keys, and no blockchain. That makes it usable for development
            and product work immediately.
          </p>
          <p>When the live path is configured, Cortex uses user-controlled infrastructure:</p>
          <ul>
            <li>
              <strong>Sui</strong> &mdash; identity and coordination
            </li>
            <li>
              <strong>Walrus</strong> &mdash; durable artifact storage
            </li>
            <li>
              <strong>Seal</strong> &mdash; encryption and access gating
            </li>
            <li>
              <strong>MemWal</strong> &mdash; persistent memory namespaces and recall
            </li>
          </ul>
        </section>

        <section>
          <h2>Three surfaces</h2>
          <p>Cortex is one memory plane reachable from three places:</p>
          <ul>
            <li>
              <strong>Frontend app</strong> &mdash; a Next.js product experience for capturing and
              browsing memory.
            </li>
            <li>
              <strong>Core runtime + CLI</strong> &mdash; the local-first <code>Cortex</code> facade
              and command-line flows for ingest, recall, consolidation, and verification.
            </li>
            <li>
              <strong>MCP server</strong> &mdash; lets external agents and hosts (Claude, Cursor, and
              other MCP clients) reach the same memory.
            </li>
          </ul>
        </section>

        <section className="quickstart-links">
          <p>
            <Link href="/install" className="styled-link">
              Install and run Cortex <span className="arrow">&rarr;</span>
            </Link>
          </p>
          <p>
            <Link href="/features" className="styled-link">
              Read the core concepts <span className="arrow">&rarr;</span>
            </Link>
          </p>
          <p>
            <Link href="/mcp" className="styled-link">
              Connect an agent over MCP <span className="arrow">&rarr;</span>
            </Link>
          </p>
        </section>
      </article>

      <Footer />
    </>
  );
}
