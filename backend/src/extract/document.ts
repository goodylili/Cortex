// Document extractor: notes, markdown, PDFs, text. Reads UTF-8 text and extracts.
import { type ExtractResult, heuristicExtract } from "./structured.js";

export async function extractDocument(
  text: string,
  title = "",
): Promise<ExtractResult> {
  return heuristicExtract(text, title || "document");
}
