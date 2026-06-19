"use client";

function Node({ title, sub }: { title: string; sub: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.15rem",
        padding: "0.6rem 0.85rem",
        background: "var(--surface)",
        border: "1px solid var(--line2)",
        borderRadius: "8px",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-head)",
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--ink)",
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.6875rem",
          color: "var(--faint)",
        }}
      >
        {sub}
      </span>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: "var(--muted)",
        flex: "0 0 auto",
        gap: "0.1rem",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.625rem",
          color: "var(--faint)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "1rem", lineHeight: 1 }} aria-hidden="true">
        →
      </span>
    </div>
  );
}

export function SchemaDiagram() {
  return (
    <div
      role="img"
      aria-label="Cortex artifacts: a Source is processed into an Extraction, which produces Memories. Consolidation produces a MemoryDiff over those Memories. The NamespaceManifest indexes the blob ids of all artifacts."
      style={{
        width: "100%",
        marginTop: "1.5rem",
        marginBottom: "1rem",
        padding: "1.25rem",
        background: "var(--surface2)",
        border: "1px solid var(--line)",
        borderRadius: "12px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.65rem",
        }}
      >
        <Node title="Source" sub="cortex.source.v1" />
        <Arrow label="extract" />
        <Node title="Extraction" sub="cortex.extraction.v1" />
        <Arrow label="yields" />
        <Node title="Memory[]" sub="durable, tagged" />
        <Arrow label="consolidate" />
        <Node title="MemoryDiff" sub="cortex.diff.v1" />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          flexWrap: "wrap",
        }}
      >
        <Node title="NamespaceManifest" sub="cortex.manifest.v1" />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6875rem",
            color: "var(--muted)",
          }}
        >
          head + version chain → indexes sources, extractions, and diffs by blob id
        </span>
      </div>
    </div>
  );
}
