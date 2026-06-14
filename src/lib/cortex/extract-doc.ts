// Document → text, client-side. PDF (pdfjs), DOCX (mammoth) and XLSX/XLS (SheetJS)
// are parsed in the browser; the extracted text is then distilled into memories.
// All parsers are dynamically imported so they stay out of the main bundle.

"use client";

function ext(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

interface PdfTextItem {
  str?: string;
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
    pages.push(
      content.items
        .map((item) => (item as PdfTextItem).str ?? "")
        .join(" ")
        .trim(),
    );
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
