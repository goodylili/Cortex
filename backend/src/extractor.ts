// Dispatches a Source to the right modality extractor, then (when an API key is
// present) refines via a model with strict JSON output. Falls back to heuristics.

import type { Config } from "./config.js";
import type { Extraction, Memory, Source } from "./models.js";
import { newId } from "./crypto.js";
import { EXTRACT_SYSTEM_PROMPT, parseExtraction, type ExtractResult } from "./extract/structured.js";
import { extractDocument } from "./extract/document.js";
import { extractImage } from "./extract/image.js";
import { extractAudio } from "./extract/audio.js";
import { extractVideo } from "./extract/video.js";

async function modelRefine(cfg: Config, content: string): Promise<ExtractResult | null> {
  if (!cfg.models.anthropicApiKey || !content.trim()) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cfg.models.anthropicApiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: cfg.models.extract, max_tokens: 1024, system: EXTRACT_SYSTEM_PROMPT, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`anthropic extract: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { content: { text?: string }[] };
  return parseExtraction(data.content.map((c) => c.text ?? "").join(""));
}

export interface RawInput {
  text?: string; // document/audio/video transcript text
  bytes?: Uint8Array; // image
  hint?: string;
}

export async function extractSource(cfg: Config, source: Source, raw: RawInput): Promise<Extraction> {
  let base: ExtractResult;
  switch (source.type) {
    case "image":
      base = await extractImage(raw.bytes ?? new Uint8Array(), raw.hint ?? source.title);
      break;
    case "audio":
      base = await extractAudio(raw.text ?? "", raw.hint ?? source.title);
      break;
    case "video":
      base = await extractVideo(raw.text ?? "", raw.hint ?? source.title);
      break;
    default:
      base = await extractDocument(raw.text ?? "", source.title ?? "");
  }
  // refine with a model when available; otherwise keep the heuristic result
  const refined = (await modelRefine(cfg, raw.text ?? source.title ?? "").catch(() => null)) ?? base;

  const now = new Date().toISOString();
  const memories: Memory[] = refined.memories.map((m) => ({
    id: newId("mem"),
    namespace: source.namespace,
    text: m.text,
    sourceId: source.id,
    tags: m.tags,
    when: m.when || now,
    createdAt: now,
    agent: "extractor",
    via: "extract",
    confidence: m.confidence,
  }));
  return {
    kind: "cortex.extraction.v1",
    id: newId("ext"),
    namespace: source.namespace,
    sourceId: source.id,
    model: cfg.models.anthropicApiKey ? cfg.models.extract : "heuristic",
    summary: refined.summary,
    memories,
    createdAt: now,
  };
}
