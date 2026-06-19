// The consolidation agent. Two implementations: a deterministic rule-based one
// (no creds, for the demo/tests) and an Anthropic-backed one with strict JSON.
// Every operation must cite evidence or it is dropped.

import type { Config } from "./config";
import type { DiffOperation, Memory } from "./models";
import { z } from "zod";

export const CONSOLIDATION_SYSTEM_PROMPT = `You consolidate a person's memory. Given recent extracted memories and the current memory state, produce a minimal set of operations that improve quality. Respond with ONLY a JSON array, no fences:
- {"type":"consolidate","mergeIds":[..],"into":{"text":".."},"confidence":0..1,"evidence":[".."]}
- {"type":"pattern","text":"..","confidence":0..1,"evidence":[".."],"incidents":N}
- {"type":"prune","targetId":"..","reason":"..","confidence":0..1,"evidence":[".."]}
- {"type":"verify","targetId":"..","verifiedAt":"ISO","confidence":0..1,"evidence":[".."]}
Rules: every operation MUST cite at least one source/memory id in evidence. Find cross-source patterns no single item states. Prefer fewer, higher-confidence operations. Never prune unless directly contradicted.`;

const OpSchema = z.array(
  z
    .object({
      type: z.enum(["consolidate", "pattern", "prune", "verify"]),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string()).min(1),
    })
    .passthrough(),
);

export function parseDiffResponse(text: string): DiffOperation[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = OpSchema.parse(JSON.parse(cleaned));
  return parsed as unknown as DiffOperation[];
}

export interface Consolidator {
  readonly name: string;

  consolidate(
    memories: Memory[],
    evidenceIds: string[],
    now: string,
  ): Promise<DiffOperation[]>;
}

/** Deterministic consolidation: dedupe near-identical memories + verify repeats. */
export class RuleConsolidator implements Consolidator {
  readonly name = "rule-based";

  async consolidate(
    memories: Memory[],
    evidenceIds: string[],
    now: string,
  ): Promise<DiffOperation[]> {
    const live = memories.filter((m) => !m.tombstone);
    const ev = evidenceIds.length
      ? evidenceIds
      : live.map((m) => m.sourceId ?? m.id).slice(0, 1);
    const ops: DiffOperation[] = [];
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .split(/\s+/)
        .filter(Boolean);
    const seen: { key: Set<string>; ids: string[]; text: string }[] = [];
    for (const m of live) {
      const words = new Set(norm(m.text));
      const hit = seen.find((g) => {
        const inter = [...g.key].filter((w) => words.has(w)).length;
        return inter / Math.max(1, Math.min(g.key.size, words.size)) > 0.6;
      });
      if (hit) hit.ids.push(m.id);
      else seen.push({ key: words, ids: [m.id], text: m.text });
    }
    for (const g of seen) {
      if (g.ids.length >= 2) {
        ops.push({
          type: "consolidate",
          mergeIds: g.ids,
          into: { text: g.text },
          confidence: 0.9,
          evidence: ev,
        });
      }
    }
    return ops;
  }
}

/** Anthropic-backed consolidation. */
export class AnthropicConsolidator implements Consolidator {
  readonly name = "anthropic";

  constructor(private cfg: Config) {}

  async consolidate(
    memories: Memory[],
    evidenceIds: string[],
    _now: string,
  ): Promise<DiffOperation[]> {
    const body = `# Current memory\n${memories
      .filter((m) => !m.tombstone)
      .map((m) => `[${m.id}] ${m.text}`)
      .join("\n")}\n\n# Evidence ids\n${evidenceIds.join(", ")}`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.cfg.models.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.cfg.models.chat,
        max_tokens: 2048,
        system: CONSOLIDATION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: body }],
      }),
    });
    if (!res.ok)
      throw new Error(
        `anthropic consolidate: ${res.status} ${await res.text()}`,
      );
    const data = (await res.json()) as { content: { text?: string }[] };
    return parseDiffResponse(data.content.map((c) => c.text ?? "").join(""));
  }
}

export function createConsolidator(cfg: Config): Consolidator {
  return cfg.models.anthropicApiKey
    ? new AnthropicConsolidator(cfg)
    : new RuleConsolidator();
}
