"use client";

import { useState } from "react";
import { Footer } from "../Footer";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  items: FAQItem[];
}

const faqCategories: FAQCategory[] = [
  {
    title: "Basics",
    items: [
      {
        question: "What is Cortex?",
        answer: "Cortex is a local-first persistent memory layer and multi-agent operating system for AI. It ingests your notes, files, and other sources, extracts durable memories from them, stores artifacts on infrastructure you control, recalls the right context later, and improves over time through consolidation and correction. The goal is simple: AI should not lose your context every time the session, tool, or model changes."
      },
      {
        question: "How is this different from chat history?",
        answer: "Chat history is an opaque, per-tool transcript. It cannot be read by another agent, it never reconciles corrections, and it disappears when you switch tools. Cortex stores structured memories with text, tags, confidence, and provenance, in a namespace any agent can recall from. Corrections become current truth instead of competing facts, and state is inspectable rather than hidden."
      },
      {
        question: "How is this different from a vector database?",
        answer: "A vector DB is a retrieval primitive &mdash; you still have to design ingestion, extraction, consolidation, and storage around it. Cortex is the full memory system: it extracts durable <code>Memory</code> artifacts from raw sources, consolidates them over time (merging duplicates, verifying, pruning), tracks versions in a namespace manifest, and exposes recall plus derived views. You can think of recall as the query layer and the rest as the substrate that keeps memory true and durable."
      },
      {
        question: "What are the three surfaces?",
        answer: "Cortex is one memory plane reachable from three places: a <code>Next.js</code> frontend app for capturing and browsing memory, a local core runtime with a CLI that exposes the <code>Cortex</code> facade, and an MCP server that lets external agents and hosts reach the same memory."
      },
    ]
  },
  {
    title: "Running it",
    items: [
      {
        question: "Do I need a wallet or credentials to run Cortex?",
        answer: "No. Cortex runs in mock mode by default. When no live credentials are configured, the entire pipeline &mdash; ingest, extract, recall, consolidate, verify &mdash; works on your machine with no wallet, keys, or blockchain. The CLI even prints a <code>(mock mode)</code> banner so you always know which path you are on."
      },
      {
        question: "What is mock mode vs. live mode?",
        answer: "Mock mode is the default and needs no setup &mdash; use it for development, UI work, and iterating on the memory pipeline. Live mode turns on once the required infrastructure config is present, and runs durable storage and coordinated identity on real infrastructure. You enable it by filling in the frontend <code>.env.local</code> and the runtime <code>config/config.yaml</code>."
      },
      {
        question: "How do I run the demo?",
        answer: "From the repo root, run <code>pnpm --filter @cortex/core demo</code> (also wired to <code>pnpm demo</code>). It seeds sample sources, extracts memories, runs consolidation, applies the resulting diff, and verifies artifact fetchability &mdash; all in mock mode. It is the fastest way to see the whole pipeline run end to end."
      },
      {
        question: "Can I self-host Cortex?",
        answer: "Yes. The core runtime is local-first by design &mdash; desktop and mobile embed it directly, and there is no central HTTP backend. The only server in the system is the MCP connector, which you run yourself. On the live path, storage and coordination run on infrastructure you control rather than a vendor&apos;s servers."
      },
    ]
  },
  {
    title: "Storage and security",
    items: [
      {
        question: "What is stored, and where?",
        answer: "Cortex stores structured artifacts: <code>Source</code> records, extracted <code>Memory</code> objects, <code>Extraction</code> results, <code>MemoryDiff</code> consolidation records, and a <code>NamespaceManifest</code> that tracks versions. In mock mode these live locally. In live mode, durable artifacts are stored on Walrus, memory namespaces are persisted through MemWal, and coordination is anchored on Sui."
      },
      {
        question: "Is my data encrypted?",
        answer: "On the live path, yes. Cortex uses Seal for encryption and access gating, so artifacts stored on Walrus are encrypted and access is permissioned rather than public. Identity and access coordination are handled on Sui. In mock mode everything stays on your machine."
      },
      {
        question: "What are Walrus, Seal, and MemWal?",
        answer: "They are the live-path building blocks. <strong>Walrus</strong> is decentralized durable blob storage for artifacts. <strong>Seal</strong> provides encryption and threshold-based access gating so only authorized parties can decrypt. <strong>MemWal</strong> provides persistent memory namespaces and recall on top of that storage. <strong>Sui</strong> ties them together for identity and coordination."
      },
    ]
  },
  {
    title: "Agents and integration",
    items: [
      {
        question: "How do agents share memory?",
        answer: "Every surface talks to the same <code>Cortex</code> facade over the same namespace, so memory written by one agent is recallable by another. The MCP server exposes that shared plane to external agents, and the repo includes foundations for durable multi-agent workflows &mdash; a shared task board, a message bus, and memory-backed context &mdash; so agents coordinate over shared state rather than isolated transcripts."
      },
      {
        question: "How do I connect Claude Code or Cursor?",
        answer: "Run the MCP server (<code>pnpm start:mcp</code> or <code>pnpm dev:mcp</code>) and point your MCP client at it. Any host that speaks the Model Context Protocol &mdash; Claude Code, Cursor, and others &mdash; can connect and gain recall, remember, ingest, verify, and consolidation tools over your Cortex memory. See the MCP Server page for client setup and authorization."
      },
      {
        question: "What tools does the MCP server expose?",
        answer: "Memory operations like recall, remember, ingest, forget, verify, and consolidate (dream), plus derived read views such as tags, digest, connections, extraction, and timeline. It also exposes agent and task collaboration primitives over shared state and outbound bridge tools like fetch and notifications."
      },
      {
        question: "What does consolidation (dream) do?",
        answer: "Consolidation, called <em>dream</em>, periodically reviews memory and produces a structured <code>MemoryDiff</code>: it merges duplicates, verifies claims, prunes stale entries, and surfaces patterns. Applying the diff advances the namespace head. This is how corrections become current truth and memory stays coherent over time instead of accumulating contradictions."
      },
    ]
  },
];

function FAQToggle({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="faq-item">
      <button className="faq-question" onClick={onToggle} aria-expanded={isOpen}>
        <span>{item.question}</span>
        <span className={`faq-icon ${isOpen ? 'open' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <div className={`faq-answer ${isOpen ? 'open' : ''}`}>
        <div className="faq-answer-inner">
          <p dangerouslySetInnerHTML={{ __html: item.answer }} />
        </div>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const handleToggle = (key: string) => {
    setOpenKey(openKey === key ? null : key);
  };

  return (
    <>
      <style>{`
        .faq-category {
          margin-top: 0.5rem;
        }
        .faq-category + .faq-category {
          margin-top: 1.5rem;
        }
        .faq-category h2 {
          margin-bottom: 0.25rem;
        }
        .faq-item {
          border-bottom: 1px solid var(--line);
        }
        .faq-item:last-child {
          border-bottom: none;
        }
        .faq-question {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.625rem 0;
          font-size: 0.75rem;
          font-weight: 300;
          color: var(--muted);
          text-align: left;
          cursor: pointer;
          transition: color 0.15s ease;
        }
        .faq-question:hover {
          color: var(--ink);
        }
        .faq-icon {
          flex-shrink: 0;
          color: var(--faint);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s ease;
        }
        .faq-icon.open {
          transform: rotate(180deg);
          color: var(--muted);
        }
        .faq-answer {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .faq-answer.open {
          grid-template-rows: 1fr;
        }
        .faq-answer-inner {
          overflow: hidden;
        }
        .faq-answer-inner p {
          padding-bottom: 1rem;
          font-size: 0.8125rem;
          line-height: 1.6;
          color: var(--muted);
        }
        .faq-answer-inner p + p {
          padding-top: 0;
          margin-top: -0.5rem;
        }
        .faq-answer-inner code {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          background: var(--surface2);
          padding: 0.1rem 0.3rem;
          border-radius: 0.25rem;
          color: var(--ink);
        }
        .faq-link {
          color: var(--accent-ink);
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .faq-link:hover {
          color: var(--muted);
        }
      `}</style>
      <article className="article">
        <header>
          <h1>FAQ</h1>
          <p className="tagline">Common questions about Cortex</p>
        </header>

        {faqCategories.map((category, catIndex) => (
          <div key={catIndex} className="faq-category">
            <h2>{category.title}</h2>
            {category.items.map((faq, itemIndex) => {
              const key = `${catIndex}-${itemIndex}`;
              return (
                <FAQToggle
                  key={key}
                  item={faq}
                  isOpen={openKey === key}
                  onToggle={() => handleToggle(key)}
                />
              );
            })}
          </div>
        ))}
      </article>

      <Footer />
    </>
  );
}
