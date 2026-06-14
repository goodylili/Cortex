// Turn any uploaded file into text context for memory. Images go to a cheap vision
// model, audio is transcribed, text is read directly. Video is handled separately
// via ffmpeg.wasm (extract-video). Everything stays low-cost: one cheap model call
// per item, no redundant processing.

"use client";

const TEXT_LIKE = /\.(txt|md|markdown|csv|json|log|html?|rtf|tsv|ya?ml)$/i;
const BASE64_CHUNK = 0x8000;

export type FileKind = "image" | "audio" | "video" | "text" | "unknown";

export function kindOf(file: File): FileKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (TEXT_LIKE.test(file.name) || file.type.startsWith("text/")) return "text";
  return "unknown";
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  }
  return btoa(binary);
}

export async function describeImage(file: File): Promise<string> {
  const dataBase64 = await fileToBase64(file);
  const res = await fetch("/api/vision", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      images: [{ dataBase64, mime: file.type || "image/png" }],
    }),
  });
  const d = await res.json();
  if (!d.ok || !d.text) {
    throw new Error(
      d.reason === "no-key"
        ? "Set a vision model key (Gemini/Anthropic/OpenAI) to read images"
        : "Couldn't read that image",
    );
  }
  return d.text as string;
}

export async function transcribeAudio(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name || "audio");
  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  const d = await res.json();
  if (!d.ok || !d.text) {
    throw new Error(
      d.reason === "no-key"
        ? "Set OPENAI_API_KEY to transcribe audio"
        : "Couldn't transcribe that audio",
    );
  }
  return d.text as string;
}

export async function extractContent(file: File): Promise<string> {
  switch (kindOf(file)) {
    case "image":
      return describeImage(file);
    case "audio":
      return transcribeAudio(file);
    case "text":
      return file.text();
    case "video": {
      const { extractVideo } = await import("./extract-video");
      return extractVideo(file);
    }
    default:
      throw new Error(`${file.name}: unsupported file type`);
  }
}
