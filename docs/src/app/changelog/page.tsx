"use client";

import { Footer } from "../Footer";
import { ReactNode } from "react";

type ChangeType = "added" | "fixed" | "improved" | "removed";

interface Change {
  type: ChangeType;
  text: ReactNode;
}

interface Release {
  version: string;
  date: string;
  summary?: ReactNode;
  changes?: Change[];
}

const badgeLabels: Record<ChangeType, string> = {
  added: "Added",
  fixed: "Fixed",
  improved: "Improved",
  removed: "Removed",
};

const releases: Release[] = [
  {
    version: "Unreleased",
    date: "In progress",
    summary: (
      <>
        Active build toward an extensible Cortex foundation. Some surfaces are wired
        end-to-end; others are still evolving. This list tracks what currently works.
      </>
    ),
    changes: [
      {
        type: "added",
        text: (
          <>
            Memory core — the <a href="/api" className="styled-link">Cortex facade</a> with{" "}
            <code>ingest</code>, <code>recall</code>, consolidation
            ({" "}<code>dream</code> / <code>apply</code>), derived views, and{" "}
            <code>verify</code>
          </>
        ),
      },
      {
        type: "added",
        text: (
          <>
            Structured <a href="/schema" className="styled-link">data model</a> — Source,
            Memory, Extraction, MemoryDiff, and NamespaceManifest, all content-addressed
          </>
        ),
      },
      {
        type: "added",
        text: (
          <>
            Two-stage consolidation — diffs are committed to Walrus before any mutation,
            and applied behind an optimistic parent-head concurrency check
          </>
        ),
      },
      {
        type: "added",
        text: (
          <>
            <a href="/mcp" className="styled-link">MCP server</a> — external agents reach
            the same memory plane through the facade (recall, remember, ingest, dream,
            verify, plus derived read views)
          </>
        ),
      },
      {
        type: "added",
        text: "Multi-agent foundations — shared task board, message bus, and memory-backed context for durable agent workflows",
      },
      {
        type: "added",
        text: (
          <>
            Live storage path — Sui for coordination, Walrus for durable artifacts, Seal
            for encryption and access gating, and MemWal for persistent namespaces
          </>
        ),
      },
      {
        type: "added",
        text: "Demo pipeline — seeds sample sources, consolidates, applies the diff, and verifies fetchability outside the web UI",
      },
      {
        type: "improved",
        text: (
          <>
            Mock mode is the default — Cortex runs with no Sui, Walrus, Seal, or MemWal
            credentials, so the full memory pipeline is testable locally
          </>
        ),
      },
    ],
  },
];

export default function ChangelogPage(): React.JSX.Element {
  return (
    <>
      <article className="article">
        <header>
          <h1>Changelog</h1>
          <p className="tagline">What has shipped, and what is in progress</p>
        </header>

        {releases.map((release) => (
          <section key={release.version}>
            <h2 style={{ fontSize: "1.125rem" }}>
              <span
                className="sketchy-underline"
                style={{ "--marker-color": "var(--accent-ink)" } as React.CSSProperties}
              >
                {release.version}
              </span>
              <span
                style={{
                  fontWeight: 300,
                  color: "var(--muted)",
                  marginLeft: "0.5rem",
                  fontSize: "0.8125rem",
                }}
              >
                {release.date}
              </span>
            </h2>

            {release.summary && <p>{release.summary}</p>}

            {release.changes && release.changes.length > 0 && (
              <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {(["added", "improved", "fixed", "removed"] as ChangeType[]).map((type) => {
                  const items = release.changes!.filter((c) => c.type === type);
                  if (items.length === 0) return null;
                  return (
                    <div key={type}>
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          marginBottom: "0.5rem",
                        }}
                      >
                        {badgeLabels[type]}
                      </div>
                      <ul>
                        {items.map((change, j) => (
                          <li key={j}>{change.text}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </article>

      <Footer />
    </>
  );
}
