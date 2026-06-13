// Audio extractor. Live path transcribes then extracts; offline path stubs it.
import { type ExtractResult, heuristicExtract } from "./structured.js";

export async function extractAudio(transcript: string, hint = ""): Promise<ExtractResult> {
  if (transcript) return heuristicExtract(transcript, hint || "audio");
  return { summary: `audio: ${hint || "clip"}`, memories: [{ text: `Recorded audio: ${hint || "clip"}`, tags: ["audio"], when: "", confidence: 0.5 }] };
}
