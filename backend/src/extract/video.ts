// Video extractor. Live path samples frames + transcript; offline path stubs it.
import { type ExtractResult, heuristicExtract } from "./structured.js";

export async function extractVideo(
  transcript: string,
  hint = "",
): Promise<ExtractResult> {
  if (transcript) return heuristicExtract(transcript, hint || "video");
  return {
    summary: `video: ${hint || "clip"}`,
    memories: [
      {
        text: `Watched/recorded video: ${hint || "clip"}`,
        tags: ["video"],
        when: "",
        confidence: 0.5,
      },
    ],
  };
}
