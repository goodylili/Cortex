"use client";

import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";

import { Logo } from "@/components/logo";

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
    feature: "Sovereignity",
    detail: "Built on Sui with Walrus storage and Seal encryption",
    cortex: "Yes",
    supermemory: "No",
    cortexTone: "strong",
    supermemoryTone: "muted",
  },
];

function SupermemoryLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="14"
        y="14"
        width="92"
        height="92"
        rx="24"
        stroke="currentColor"
        strokeWidth="8"
      />
      <path
        d="M41 41h38c6.6 0 12 5.4 12 12s-5.4 12-12 12H53c-6.6 0-12 5.4-12 12s5.4 12 12 12h26"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CapabilityPill({
  value,
  tone,
}: {
  value: string;
  tone: "strong" | "soft" | "muted";
}) {
  if (tone === "muted") {
    return (
      <span className="inline-flex min-w-[108px] items-center justify-center gap-2 rounded-full border border-ink/10 bg-transparent px-3 py-1 text-center text-xs font-medium uppercase tracking-[0.2em] text-ink/35">
        <Minus className="h-3.5 w-3.5" />
        {value}
      </span>
    );
  }

  if (tone === "soft") {
    return (
      <span className="inline-flex min-w-[108px] items-center justify-center gap-2 rounded-full border border-ink/15 bg-ink/[0.04] px-3 py-1 text-center text-xs font-medium uppercase tracking-[0.2em] text-ink/60">
        <Check className="h-3.5 w-3.5" />
        {value}
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-[108px] items-center justify-center gap-2 rounded-full border border-white/15 bg-white px-3 py-1 text-center text-xs font-medium uppercase tracking-[0.2em] text-[#0A0A0A]">
      <Check className="h-3.5 w-3.5" />
      {value}
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
              further with Sovereignity, shared memory,
              prompts, loops, multi-agent coordination, and dreams.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[calc(var(--r)*1.6)] border border-ink/10 bg-ink/[0.03] shadow-[0_20px_80px_rgba(0,0,0,0.12)]"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left">
                  <th className="min-w-[320px] border-b border-ink/10 px-6 py-5 md:px-8" />
                  <th className="min-w-[240px] border-b border-l border-r border-[#262626] bg-[#0A0A0A] px-6 py-5 text-white md:px-8">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Logo variant="white" className="h-7 w-7 shrink-0" />
                        <div className="flex flex-col items-start">
                          <span className="text-xl font-medium tracking-tight text-white">
                            Cortex
                          </span>
                        </div>
                      </div>
                    </div>
                  </th>
                  <th className="min-w-[220px] border-b border-ink/10 px-6 py-5 text-ink/65 md:px-8">
                    <div className="flex items-center justify-center gap-3 text-center">
                      <SupermemoryLogo className="h-7 w-7 shrink-0 text-ink/75" />
                      <span className="text-xl font-medium text-ink">Supermemory</span>
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {ROWS.map((row, index) => (
                  <motion.tr
                    key={row.feature}
                    className="align-top"
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{
                      duration: 0.5,
                      delay: index * 0.04,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <td className="border-b border-ink/10 px-6 py-5 md:px-8">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-base font-medium text-ink">
                          {row.feature}
                        </span>
                        <span className="max-w-md text-sm leading-relaxed text-ink/50">
                          {row.detail}
                        </span>
                      </div>
                    </td>

                    <td className="border-b border-l border-r border-[#262626] bg-[#0A0A0A] px-6 py-5 text-white md:px-8">
                      <div className="flex items-center justify-center">
                      <CapabilityPill
                        value={row.cortex}
                        tone={row.cortexTone ?? "strong"}
                      />
                      </div>
                    </td>

                    <td className="border-b border-ink/10 px-6 py-5 md:px-8">
                      <div className="flex items-center justify-center">
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
