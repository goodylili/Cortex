// Image extractor. Live path sends the image to a vision model; the offline path
// records a caption-shaped memory from any alt/filename hint.
import { type ExtractResult } from "./structured.js";

export async function extractImage(
  _bytes: Uint8Array,
  hint = "",
): Promise<ExtractResult> {
  const t = hint || "image";
  return {
    summary: `image: ${t}`,
    memories: [
      {
        text: `Saved an image: ${t}`,
        tags: ["image"],
        when: "",
        confidence: 0.5,
      },
    ],
  };
}
