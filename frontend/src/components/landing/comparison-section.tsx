"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

interface ComparisonRow {
  feature: string;
  detail: string;
  cortex: string;
  supermemory: string;
  cortexTone?: "strong" | "soft";
  supermemoryTone?: "soft" | "muted";
}

const HEADLINE = "Why Cortex wins the memory layer";

const ROWS: ComparisonRow[] = [
  {
    feature: "Memory recall",
    detail: "Persistent memory search and retrieval across saved context",
    cortex: "Best Fit",
    supermemory: "Yes",
    cortexTone: "strong",
    supermemoryTone: "soft",
  },
  {
    feature: "Document and media ingestion",
    detail: "Bring in notes, files, links, audio, images, and video",
    cortex: "Best Fit",
    supermemory: "Yes",
    cortexTone: "strong",
    supermemoryTone: "soft",
  },
  {
    feature: "Shared memory",
    detail: "Identity-scoped encrypted collaboration between people and agents",
    cortex: "Native",
    supermemory: "No",
    cortexTone: "strong",
    supermemoryTone: "muted",
  },
  {
    feature: "Prompt generation",
    detail: "Generate grounded prompts directly from saved memory",
    cortex: "Native",
    supermemory: "No",
    cortexTone: "strong",
    supermemoryTone: "muted",
  },
  {
    feature: "Loop generation",
    detail: "Turn memory into agentic workflows and iterative runs",
    cortex: "Native",
    supermemory: "No",
    cortexTone: "strong",
    supermemoryTone: "muted",
  },
  {
    feature: "Multi-agent interface",
    detail: "Specialist agents work over one shared memory graph",
    cortex: "Native",
    supermemory: "No",
    cortexTone: "strong",
    supermemoryTone: "muted",
  },
  {
    feature: "Dreams",
    detail: "Memory-derived insight and synthesis across your graph",
    cortex: "Native",
    supermemory: "No",
    cortexTone: "strong",
    supermemoryTone: "muted",
  },
  {
    feature: "Elastic brain",
    detail:
      "Learns from use, runs consolidation sweeps, folds duplicates, and fades weak signals to reduce memory bloat over time",
    cortex: "Native",
    supermemory: "No",
    cortexTone: "strong",
    supermemoryTone: "muted",
  },
  {
    feature: "Sovereignity",
    detail: "Built on Sui with Walrus storage and Seal encryption",
    cortex: "Yes",
    supermemory: "No",
    cortexTone: "strong",
    supermemoryTone: "muted",
  },
];

function CapabilityPill({
  value,
  tone,
}: {
  value: string;
  tone: "strong" | "soft" | "muted";
}) {
  const Icon = tone === "muted" ? X : Check;

  if (tone === "muted") {
    return (
      <span
        aria-label={value}
        title={value}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r)] border border-ink/10 bg-transparent text-ink/35"
      >
        <Icon className="h-4 w-4" />
        <span className="sr-only">{value}</span>
      </span>
    );
  }

  if (tone === "soft") {
    return (
      <span
        aria-label={value}
        title={value}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r)] border border-ink/15 bg-ink/[0.04] text-ink/60"
      >
        <Icon className="h-4 w-4" />
        <span className="sr-only">{value}</span>
      </span>
    );
  }

  return (
    <span
      aria-label={value}
      title={value}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r)] border border-white/15 bg-white text-[#0A0A0A]"
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">{value}</span>
    </span>
  );
}

export function ComparisonSection() {
  return (
    <section
      id="compare"
      className="w-full border-b border-ink/10 bg-canvas py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 flex flex-col gap-6 md:mb-16"
        >
          <div className="flex w-fit items-center gap-3 rounded-[var(--r)] border border-ink/20 bg-ink/10 px-4 py-2">
            <div className="h-2.5 w-2.5 bg-ink" />
            <span className="text-sm font-medium tracking-wide text-ink/70">
              Comparison
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h2 className="max-w-4xl text-balance text-4xl font-normal leading-[1.05] tracking-tight text-ink md:text-5xl lg:text-6xl">
                {HEADLINE.split(" ").map((word, i) => (
                  <motion.span
                    key={i}
                    initial={{ filter: "blur(10px)", opacity: 0 }}
                    whileInView={{ filter: "blur(0px)", opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="mr-[0.25em] inline-block"
                  >
                    {word}
                  </motion.span>
                ))}
              </h2>
            </div>

            <p className="max-w-xl text-balance text-base leading-relaxed text-ink/60 md:text-lg lg:justify-self-end">
              Cortex covers the same core memory jobs users expect, then goes
              further with an elastic brain that learns from usage, reduces
              memory bloat through consolidation sweeps, and layers
              Sovereignity, shared memory, prompts, loops, agents, and dreams
              on top.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[var(--r)] border border-ink/10 bg-ink/[0.03] shadow-[0_20px_80px_rgba(0,0,0,0.12)]"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left">
                  <th className="min-w-[320px] border-b border-ink/10 px-6 py-5 align-middle md:px-8" />
                  <th className="min-w-[240px] border-b border-l border-r border-[#262626] bg-[#0A0A0A] px-6 py-5 align-middle text-white md:px-8">
                    <div className="flex min-h-[76px] items-center justify-center text-center">
                      <span className="text-2xl font-semibold tracking-tight text-white md:text-[2rem]">
                        Cortex
                      </span>
                    </div>
                  </th>
                  <th className="min-w-[220px] border-b border-ink/10 px-6 py-5 align-middle text-ink/65 md:px-8">
                    <div className="flex min-h-[76px] items-center justify-center text-center">
                      <span className="text-2xl font-semibold tracking-tight text-ink md:text-[2rem]">
                        Supermemory
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {ROWS.map((row, index) => (
                  <motion.tr
                    key={row.feature}
                    className="align-middle"
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{
                      duration: 0.5,
                      delay: index * 0.04,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <td className="border-b border-ink/10 px-6 py-5 align-middle md:px-8">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-base font-medium text-ink">
                          {row.feature}
                        </span>
                        <span className="max-w-md text-sm leading-relaxed text-ink/50">
                          {row.detail}
                        </span>
                      </div>
                    </td>

                    <td className="border-b border-l border-r border-[#262626] bg-[#0A0A0A] px-6 py-5 align-middle text-white md:px-8">
                      <div className="flex min-h-[72px] items-center justify-center">
                        <CapabilityPill
                          value={row.cortex}
                          tone={row.cortexTone ?? "strong"}
                        />
                      </div>
                    </td>

                    <td className="border-b border-ink/10 px-6 py-5 align-middle md:px-8">
                      <div className="flex min-h-[72px] items-center justify-center">
                        <CapabilityPill
                          value={row.supermemory}
                          tone={row.supermemoryTone ?? "soft"}
                        />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
