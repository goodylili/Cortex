// Dispatches a Source to the right modality extractor, then (when an API key is
// present) refines via a model with strict JSON output. Falls back to heuristics.

import type { Config } from "./config";
import type { Extraction, Memory, Source } from "./models";
import { newId } from "./crypto";
import { chatComplete, hasModelKey } from "./model";
import {
  EXTRACT_SYSTEM_PROMPT,
  parseExtraction,
  type ExtractResult,
} from "./extract/structured";
import { extractDocument } from "./extract/document";
import { extractImage } from "./extract/image";
import { extractAudio } from "./extract/audio";
import { extractVideo } from "./extract/video";

async function modelRefine(
  cfg: Config,
  content: string,
): Promise<ExtractResult | null> {
  if (!hasModelKey(cfg) || !content.trim()) return null;
  const res = await chatComplete(cfg, {
    system: EXTRACT_SYSTEM_PROMPT,
    user: content,
    model: cfg.models.extract,
    maxTokens: 1024,
  });
  if (!res.ok) throw new Error(`extract: ${res.reason}`);
  return parseExtraction(res.text);
}

export interface RawInput {
  text?: string; // document/audio/video transcript text
  bytes?: Uint8Array; // image
  hint?: string;
}

export async function extractSource(
  cfg: Config,
  source: Source,
  raw: RawInput,
): Promise<Extraction> {
  let base: ExtractResult;
  switch (source.type) {
    case "image":
      base = await extractImage(
        raw.bytes ?? new Uint8Array(),
        raw.hint ?? source.title,
      );
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
  const refined =
    (await modelRefine(cfg, raw.text ?? source.title ?? "").catch(
      () => null,
    )) ?? base;

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
    model: hasModelKey(cfg) ? cfg.models.extract : "heuristic",
    summary: refined.summary,
    memories,
    createdAt: now,
  };
}
