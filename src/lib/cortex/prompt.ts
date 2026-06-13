// Prompt Studio — turn selected memories into a ready-to-use prompt for any AI.
// Deterministic templating; the value is grounding the prompt in what you've
// actually kept, with provenance.

import type { Memory } from "./logic";

export type PromptFormat = "system" | "markdown" | "xml" | "json" | "claudemd";
export const FORMATS: {
  id: PromptFormat;
  name: string;
  sub: string;
  file: string;
}[] = [
  {
    id: "system",
    name: "System prompt",
    sub: "markdown",
    file: "system-prompt.md",
  },
  { id: "markdown", name: "Briefing", sub: "markdown", file: "briefing.md" },
  { id: "xml", name: "Claude XML", sub: "tagged context", file: "context.xml" },
  { id: "json", name: "API context", sub: "json", file: "context.json" },
  {
    id: "claudemd",
    name: "CLAUDE.md",
    sub: "project memory",
    file: "CLAUDE.md",
  },
];

export interface CompileInput {
  task: string;
  memories: Memory[];
}

function provenance(mems: Memory[]): string {
  const kept = mems.filter((m) => m.kept).length;
  return `cortex · ${mems.length} memories (${kept} kept close) · ${new Date().toISOString().slice(0, 10)}`;
}

export function compilePrompt(
  format: PromptFormat,
  { task, memories }: CompileInput,
): string {
  const goal = task.trim() || "Help me using what I already know.";
  const prov = provenance(memories);
  switch (format) {
    case "system":
      return [
        "# System prompt",
        "",
        "## What I need",
        goal,
        "",
        "## What I already know (treat as ground truth, cite when used)",
        ...memories.map((m) => `- ${m.text}`),
        "",
        `<!-- ${prov} -->`,
      ].join("\n");
    case "markdown":
      return [
        `# Briefing`,
        ``,
        `**Task:** ${goal}`,
        ``,
        `## What I know`,
        ...memories.map((m) => `- ${m.text}`),
        ``,
        `> ${prov}`,
      ].join("\n");
    case "xml":
      return [
        `<context source="cortex">`,
        `  <task>${goal}</task>`,
        `  <memories>`,
        ...memories.map(
          (m) =>
            `    <memory${m.kept ? ' kept="true"' : ""}>${m.text}</memory>`,
        ),
        `  </memories>`,
        `  <!-- ${prov} -->`,
        `</context>`,
      ].join("\n");
    case "json":
      return JSON.stringify(
        {
          kind: "cortex.prompt",
          task: goal,
          memories: memories.map((m) => ({
            text: m.text,
            tags: m.tags,
            kept: !!m.kept,
          })),
          provenance: prov,
        },
        null,
        2,
      );
    case "claudemd":
      return [
        `# CLAUDE.md`,
        ``,
        `> Synced from Cortex. ${prov}`,
        ``,
        `## What this is about`,
        goal,
        ``,
        `## Things I know`,
        ...memories.map((m) => `- ${m.text}`),
      ].join("\n");
  }
}
