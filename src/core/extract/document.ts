// Document extractor: notes, markdown, PDFs, text. Reads UTF-8 text and extracts.
// Scanned-PDF OCR fallback lives client-side (src/lib/cortex/extract-doc.ts),
// where a DOM canvas can rasterize pages. Server-side this function only ever
// receives an already-decoded string, so when the text is below
// MIN_DOCUMENT_TEXT_CHARS we cannot rasterize: a real fallback would require raw
// PDF bytes plumbed through ingest plus a non-DOM rasterizer (forbidden deps).
// We therefore extract over whatever text exists rather than fail.
import { type ExtractResult, heuristicExtract } from "./structured";

const MIN_DOCUMENT_TEXT_CHARS = 16;

export function isLikelyScannedDocument(text: string): boolean {
  return text.trim().length < MIN_DOCUMENT_TEXT_CHARS;
}

export async function extractDocument(
  text: string,
  title = "",
): Promise<ExtractResult> {
  return heuristicExtract(text, title || "document");
}
