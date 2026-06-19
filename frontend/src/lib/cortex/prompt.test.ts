import { describe, expect, it } from "vitest";
import type { Memory } from "@/lib/cortex/logic";
import { buildSpec, compilePrompt } from "@/lib/cortex/prompt";

const mem = (over: Partial<Memory>): Memory => ({
  id: over.id ?? "m",
  text: over.text ?? "",
  tags: over.tags ?? [],
  ts: over.ts ?? 0,
  createdAt: over.createdAt ?? 0,
  source: over.source ?? "note",
  ...over,
});

describe("buildSpec", () => {
  it("carries the trimmed task through as the goal", () => {
    expect(buildSpec("role", { task: "  do a thing  ", memories: [] }).task).toBe(
      "do a thing",
    );
  });

  it("falls back to a default goal when the task is blank", () => {
    expect(buildSpec("role", { task: "", memories: [] }).task).toBe(
      "Help me using what I already know.",
    );
  });

  it("routes kept memories into standing preferences", () => {
    const spec = buildSpec("role", {
      task: "x",
      memories: [mem({ text: "I prefer dark mode", kept: true })],
    });
    expect(spec.standing).toEqual(["I prefer dark mode"]);
  });

  it("routes non-standing memories into context", () => {
    const spec = buildSpec("role", {
      task: "x",
      memories: [mem({ text: "passing detail" })],
    });
    expect(spec.context).toEqual(["passing detail"]);
  });

  it("marks the rag style as cited", () => {
    expect(buildSpec("rag", { task: "x", memories: [] }).cited).toBe(true);
  });

  it("seeds a single demo for the one-shot style", () => {
    const spec = buildSpec("one", {
      task: "x",
      memories: [mem({ text: "a" }), mem({ text: "b" })],
    });
    expect(spec.demos).toEqual(["a"]);
  });

  it("prepends modality framing for image prompts", () => {
    const spec = buildSpec("role", {
      task: "x",
      memories: [],
      modality: "image",
    });
    expect(spec.system).toContain("IMAGE-generation model");
  });
});

describe("compilePrompt", () => {
  it("emits parseable JSON for the json type", () => {
    const out = compilePrompt("role", "json", { task: "summarize", memories: [] });
    expect(JSON.parse(out).kind).toBe("cortex.prompt");
  });

  it("includes the task line in plain output", () => {
    expect(
      compilePrompt("role", "plain", { task: "summarize", memories: [] }),
    ).toContain("Task: summarize");
  });

  it("renders a heading for the markdown type", () => {
    expect(
      compilePrompt("role", "markdown", { task: "x", memories: [] }),
    ).toContain("# Role prompting prompt");
  });
});
