// Video → context, entirely client-side via ffmpeg.wasm. We extract a downsampled
// mono audio track (→ transcript) and sample sparse frames (→ one batched vision
// call). Cost stays low: at most a handful of frames and one model call each for
// audio and visuals. Uses the single-threaded ffmpeg core so no COOP/COEP headers
// are required; the wasm is fetched on demand, not bundled.

"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { transcribeAudio } from "./extract";

const CORE_VERSION = "0.12.10";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;
const FRAME_INTERVAL_SEC = 10;
const MAX_FRAMES = 6;
const BASE64_CHUNK = 0x8000;

let ffmpeg: FFmpeg | undefined;

export async function loadFfmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  const ff = new FFmpeg();
  await ff.load({
    coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ffmpeg = ff;
  return ff;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  }
  return btoa(binary);
}

async function describeFrames(
  frames: { dataBase64: string; mime: string }[],
): Promise<string> {
  if (!frames.length) return "";
  const res = await fetch("/api/vision", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      images: frames,
      prompt:
        "These are frames sampled in order from a video. Describe what happens across them as concise factual context for memory.",
    }),
  });
  const d = await res.json();
  return d.ok && d.text ? (d.text as string) : "";
}

export async function extractVideo(file: File): Promise<string> {
  const ff = await loadFfmpeg();
  const input = "input_" + (file.name.replace(/[^\w.]/g, "_") || "video");
  await ff.writeFile(input, await fetchFile(file));

  let transcript = "";
  try {
    await ff.exec(["-i", input, "-vn", "-ac", "1", "-ar", "16000", "audio.mp3"]);
    const audio = (await ff.readFile("audio.mp3")) as Uint8Array;
    if (audio.length) {
      transcript = await transcribeAudio(
        new File([new Uint8Array(audio)], "audio.mp3", { type: "audio/mpeg" }),
      );
    }
  } catch {
    /* video may have no audio track */
  }

  const frames: { dataBase64: string; mime: string }[] = [];
  try {
    await ff.exec([
      "-i",
      input,
      "-vf",
      `fps=1/${FRAME_INTERVAL_SEC}`,
      "-frames:v",
      String(MAX_FRAMES),
      "frame_%03d.jpg",
    ]);
    for (let i = 1; i <= MAX_FRAMES; i++) {
      const name = `frame_${String(i).padStart(3, "0")}.jpg`;
      try {
        const data = (await ff.readFile(name)) as Uint8Array;
        frames.push({ dataBase64: bytesToBase64(data), mime: "image/jpeg" });
      } catch {
        break;
      }
    }
  } catch {
    /* no extractable frames */
  }
  const visual = await describeFrames(frames);

  const parts: string[] = [];
  if (transcript) parts.push(`Transcript:\n${transcript}`);
  if (visual) parts.push(`Visuals:\n${visual}`);
  if (!parts.length) {
    throw new Error("Couldn't extract audio or frames from that video");
  }
  return parts.join("\n\n");
}
