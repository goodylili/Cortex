// Document → text, client-side. PDF (pdfjs), DOCX (mammoth) and XLSX/XLS (SheetJS)
// are parsed in the browser; the extracted text is then distilled into memories.
// All parsers are dynamically imported so they stay out of the main bundle.

"use client";

import type { PDFPageProxy } from "pdfjs-dist";

const MIN_PAGE_TEXT_CHARS = 16;
const OCR_RENDER_SCALE = 2;
const OCR_IMAGE_MIME = "image/png";
const OCR_PROMPT =
  "This is a scanned document page. Transcribe all readable text verbatim as plain text for memory. If there is no text, reply with nothing.";
const DATA_URL_PREFIX = /^data:[^;]+;base64,/;

function ext(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

interface PdfTextItem {
  str?: string;
}

async function ocrPage(page: PDFPageProxy): Promise<string> {
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const canvasContext = canvas.getContext("2d");
  if (!canvasContext) return "";
  await page.render({ canvas, canvasContext, viewport }).promise;
  const dataBase64 = canvas
    .toDataURL(OCR_IMAGE_MIME)
    .replace(DATA_URL_PREFIX, "");
  if (!dataBase64) return "";
  try {
    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        images: [{ dataBase64, mime: OCR_IMAGE_MIME }],
        prompt: OCR_PROMPT,
      }),
    });
    const d = await res.json();
    return d.ok && d.text ? (d.text as string).trim() : "";
  } catch {
    return "";
  }
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => (item as PdfTextItem).str ?? "")
      .join(" ")
      .trim();
    if (text.length >= MIN_PAGE_TEXT_CHARS) {
      pages.push(text);
      continue;
    }
    const ocr = await ocrPage(page);
    pages.push(ocr || text);
  }
  return pages.filter(Boolean).join("\n\n").trim();
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });
  return value.trim();
}

async function extractSpreadsheet(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer());
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    return sheet ? `# ${name}\n${XLSX.utils.sheet_to_csv(sheet)}` : "";
  })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export async function extractDoc(file: File): Promise<string> {
  const e = ext(file.name);
  if (e === "pdf" || file.type === "application/pdf") return extractPdf(file);
  if (e === "docx" || file.type.includes("wordprocessingml")) {
    return extractDocx(file);
  }
  if (e === "xlsx" || e === "xls" || file.type.includes("spreadsheetml")) {
    return extractSpreadsheet(file);
  }
  return file.text();
}
