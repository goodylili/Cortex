"use client";

import { useEffect, useState } from "react";

const STAGES = [
  {
    key: "ingest",
    label: "Ingest",
    caption: "A note, file, or URL comes in.",
    lines: [
      { tone: "in", text: "note · standup-2026-06-19.md" },
      { tone: "in", text: "doc  · pricing-v3.pdf" },
      { tone: "in", text: "url  · github.com/acme/api" },
    ],
  },
  {
    key: "extract",
    label: "Extract",
    caption: "Cortex pulls durable memories out of each source.",
    lines: [
      { tone: "mem", text: "“Ship API v3 before the July launch.”" },
      { tone: "mem", text: "“Pricing moves to usage-based in v3.”" },
      { tone: "mem", text: "“Acme repo is the source of truth.”" },
    ],
  },
  {
    key: "store",
    label: "Store",
    caption: "Artifacts persist on infrastructure you control.",
    lines: [
      { tone: "store", text: "walrus · blob committed" },
      { tone: "store", text: "seal   · encrypted + gated" },
      { tone: "store", text: "memwal · namespace head advanced" },
    ],
  },
  {
    key: "recall",
    label: "Recall",
    caption: "Any agent or model gets the right context back, later.",
    lines: [
      { tone: "q", text: "recall(\"what changes for the July launch?\")" },
      { tone: "mem", text: "→ API v3 ships before launch" },
      { tone: "mem", text: "→ pricing becomes usage-based" },
    ],
  },
] as const;

const toneColor: Record<string, string> = {
  in: "var(--muted)",
  mem: "var(--ink)",
  store: "var(--muted)",
  q: "var(--ink)",
};

export function HeroDemo() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  const current = STAGES[stage];

  return (
    <div className="cortex-hero">
      <style>{`
        .cortex-hero {
          margin: 1.5rem 0 0.5rem;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--surface);
          overflow: hidden;
        }
        .cortex-hero-rail {
          display: flex;
          border-bottom: 1px solid var(--line);
        }
        .cortex-hero-step {
          flex: 1;
          padding: 0.625rem 0.5rem;
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          text-align: center;
          color: var(--faint);
          background: var(--surface);
          border-right: 1px solid var(--line);
          transition: color 0.3s ease, background 0.3s ease;
        }
        .cortex-hero-step:last-child { border-right: none; }
        .cortex-hero-step.active {
          color: var(--ink);
          background: var(--surface2);
        }
        .cortex-hero-step .dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          margin-right: 0.4rem;
          background: var(--faint);
          vertical-align: middle;
          transition: background 0.3s ease;
        }
        .cortex-hero-step.active .dot { background: var(--ink); }
        .cortex-hero-body {
          padding: 1rem 1.125rem 1.125rem;
          min-height: 9.5rem;
        }
        .cortex-hero-caption {
          font-size: 0.8125rem;
          color: var(--muted);
          margin: 0 0 0.875rem;
        }
        .cortex-hero-lines {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .cortex-hero-line {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          line-height: 1.4;
          padding: 0.375rem 0.625rem;
          border-radius: 6px;
          background: var(--surface2);
          border: 1px solid var(--line);
          opacity: 0;
          transform: translateY(4px);
          animation: cortexLineIn 0.4s ease forwards;
        }
        @keyframes cortexLineIn {
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="cortex-hero-rail" role="presentation">
        {STAGES.map((s, i) => (
          <div
            key={s.key}
            className={`cortex-hero-step ${i === stage ? "active" : ""}`}
          >
            <span className="dot" />
            {s.label}
          </div>
        ))}
      </div>

      <div className="cortex-hero-body">
        <p className="cortex-hero-caption">{current.caption}</p>
        <div className="cortex-hero-lines" key={current.key}>
          {current.lines.map((line, i) => (
            <div
              key={i}
              className="cortex-hero-line"
              style={{
                color: toneColor[line.tone],
                animationDelay: `${i * 0.09}s`,
              }}
            >
              {line.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
