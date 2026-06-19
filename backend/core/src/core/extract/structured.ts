// Shared extraction contract + the structured-output prompt and validation.
// Every modality extractor returns a { summary, memories[] }. The model is forced
// to emit strict JSON; we parse defensively and validate.

import { z } from "zod";

export interface ExtractedMemory {
  text: string;
  tags: string[];
  when: string;
  confidence: number;
}

export interface ExtractResult {
  summary: string;
  memories: ExtractedMemory[];
}

export const EXTRACT_SYSTEM_PROMPT = `You extract durable, atomic memories from a piece of content. Respond with ONLY JSON, no preamble or fences, matching:
{"summary": string, "memories": [{"text": string, "tags": string[], "when": string (ISO-8601 or ""), "confidence": number 0..1}]}
Rules:
- Each memory is one self-contained fact or preference worth remembering later.
- Prefer specific, dated facts. Skip transient chatter.
- "when" is the time the memory is about, "" if unknown.`;

const Schema = z.object({
  summary: z.string(),
  memories: z.array(
    z.object({
      text: z.string().min(1),
      tags: z.array(z.string()).default([]),
      when: z.string().default(""),
      confidence: z.number().min(0).max(1).default(0.7),
    }),
  ),
});

export function parseExtraction(text: string): ExtractResult {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    throw new Error("extraction response was not valid JSON");
  }
  const r = Schema.parse(obj);
  return { summary: r.summary, memories: r.memories };
}

/** Deterministic fallback: turn raw text into rough memories without a model.
 *  Splits on sentence/line boundaries so the demo runs with no API key. */
export function heuristicExtract(text: string, hint = ""): ExtractResult {
  const chunks = text
    .split(/[\n.]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 16)
    .slice(0, 8);
  return {
    summary: (hint ? hint + ": " : "") + (chunks[0] ?? text.slice(0, 80)),
    memories: chunks.map((c) => ({
      text: c,
      tags: hint ? [hint] : [],
      when: "",
      confidence: 0.6,
    })),
  };
}
