import type { Modality, Provider } from "./models";
import { loadFfmpeg } from "@/lib/cortex/extract-video";
import { fetchFile } from "@ffmpeg/util";

export type MediaOutput = "image" | "video" | "gif";

export interface GenerateArgs {
  provider: Provider;
  apiId: string;
  baseUrl: string;
  apiKey: string;
  prompt: string;
  output: MediaOutput;
}

export type GenerateEvent =
  | { phase: "start" }
  | { phase: "progress"; progress: number }
  | { phase: "partial"; dataUrl: string; mime: string; progress: number }
  | { phase: "done"; dataUrl: string; mime: string }
  | { phase: "error"; reason: string };

export type GenerateListener = (event: GenerateEvent) => void;

export const outputModality = (output: MediaOutput): Modality =>
  output === "image" ? "image" : "video";

const IMAGE_MIME = "image/png";
const VIDEO_MIME = "video/mp4";
const GIF_MIME = "image/gif";
const PARTIAL_IMAGE_COUNT = 3;
const VIDEO_POLL_INTERVAL_MS = 2500;
const VIDEO_POLL_MAX_ATTEMPTS = 120;
const VIDEO_SUBMIT_PROGRESS = 5;
const VIDEO_FETCH_PROGRESS = 95;
const GIF_CONVERT_START = 96;
const GIF_FPS = 12;
const GIF_WIDTH = 480;

const dataUrl = (mime: string, b64: string): string => `data:${mime};base64,${b64}`;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const readSse = async (
  body: ReadableStream<Uint8Array>,
  onData: (json: unknown) => void,
): Promise<void> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame
        .split("\n")
        .find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice("data:".length).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        onData(JSON.parse(payload));
      } catch {
        /* ignore keep-alive / non-JSON frames */
      }
    }
  }
};

interface OpenAiImageEvent {
  type?: string;
  partial_image_b64?: string;
  partial_image_index?: number;
  result?: string;
  b64_json?: string;
}

const generateOpenAiImage = async (
  args: GenerateArgs,
  emit: GenerateListener,
): Promise<void> => {
  const res = await fetch(`${args.baseUrl}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.apiId,
      stream: true,
      input: args.prompt,
      tools: [
        { type: "image_generation", partial_images: PARTIAL_IMAGE_COUNT },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    emit({ phase: "error", reason: `status ${res.status}` });
    return;
  }
  let final = "";
  await readSse(res.body, (json) => {
    const ev = json as OpenAiImageEvent;
    if (ev.type === "response.image_generation_call.partial_image") {
      const b64 = ev.partial_image_b64;
      if (!b64) return;
      const index = ev.partial_image_index ?? 0;
      emit({
        phase: "partial",
        dataUrl: dataUrl(IMAGE_MIME, b64),
        mime: IMAGE_MIME,
        progress: Math.min(
          90,
          Math.round(((index + 1) / (PARTIAL_IMAGE_COUNT + 1)) * 100),
        ),
      });
      return;
    }
    if (
      ev.type === "response.image_generation_call.completed" ||
      ev.type === "response.completed"
    ) {
      const b64 = ev.result ?? ev.b64_json;
      if (b64) final = b64;
    }
  });
  if (!final) {
    emit({ phase: "error", reason: "no image returned" });
    return;
  }
  emit({ phase: "done", dataUrl: dataUrl(IMAGE_MIME, final), mime: IMAGE_MIME });
};

interface OpenAiImagesResponse {
  data?: { b64_json?: string; url?: string }[];
}

const generateImagesEndpoint = async (
  args: GenerateArgs,
  emit: GenerateListener,
): Promise<void> => {
  emit({ phase: "start" });
  const res = await fetch(`${args.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.apiId,
      prompt: args.prompt,
      response_format: "b64_json",
    }),
  });
  if (!res.ok) {
    emit({ phase: "error", reason: `status ${res.status}` });
    return;
  }
  const data = (await res.json()) as OpenAiImagesResponse;
  const first = data.data?.[0];
  if (first?.b64_json) {
    emit({
      phase: "done",
      dataUrl: dataUrl(IMAGE_MIME, first.b64_json),
      mime: IMAGE_MIME,
    });
    return;
  }
  if (first?.url) {
    const blob = await (await fetch(first.url)).blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    emit({
      phase: "done",
      dataUrl: dataUrl(blob.type || IMAGE_MIME, bytesToBase64(bytes)),
      mime: blob.type || IMAGE_MIME,
    });
    return;
  }
  emit({ phase: "error", reason: "no image returned" });
};

interface VideoJobResponse {
  id?: string;
  status?: string;
  progress?: number;
}

const generateVideoBytes = async (
  args: GenerateArgs,
  emit: GenerateListener,
): Promise<Uint8Array | null> => {
  emit({ phase: "start" });
  const submit = await fetch(`${args.baseUrl}/videos`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({ model: args.apiId, prompt: args.prompt }),
  });
  if (!submit.ok) {
    emit({ phase: "error", reason: `status ${submit.status}` });
    return null;
  }
  const job = (await submit.json()) as VideoJobResponse;
  if (!job.id) {
    emit({ phase: "error", reason: "no job id returned" });
    return null;
  }
  emit({ phase: "progress", progress: VIDEO_SUBMIT_PROGRESS });
  for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
    const poll = await fetch(`${args.baseUrl}/videos/${job.id}`, {
      headers: { authorization: `Bearer ${args.apiKey}` },
    });
    if (!poll.ok) {
      emit({ phase: "error", reason: `status ${poll.status}` });
      return null;
    }
    const status = (await poll.json()) as VideoJobResponse;
    if (typeof status.progress === "number") {
      emit({
        phase: "progress",
        progress: Math.min(VIDEO_FETCH_PROGRESS, Math.round(status.progress)),
      });
    }
    if (status.status === "failed") {
      emit({ phase: "error", reason: "video job failed" });
      return null;
    }
    if (status.status === "completed" || status.status === "succeeded") {
      emit({ phase: "progress", progress: VIDEO_FETCH_PROGRESS });
      const content = await fetch(
        `${args.baseUrl}/videos/${job.id}/content`,
        { headers: { authorization: `Bearer ${args.apiKey}` } },
      );
      if (!content.ok) {
        emit({ phase: "error", reason: `status ${content.status}` });
        return null;
      }
      return new Uint8Array(await content.arrayBuffer());
    }
  }
  emit({ phase: "error", reason: "video job timed out" });
  return null;
};

const generateVideo = async (
  args: GenerateArgs,
  emit: GenerateListener,
): Promise<void> => {
  const bytes = await generateVideoBytes(args, emit);
  if (!bytes) return;
  emit({
    phase: "done",
    dataUrl: dataUrl(VIDEO_MIME, bytesToBase64(bytes)),
    mime: VIDEO_MIME,
  });
};

const generateGif = async (
  args: GenerateArgs,
  emit: GenerateListener,
): Promise<void> => {
  const bytes = await generateVideoBytes(args, emit);
  if (!bytes) return;
  emit({ phase: "progress", progress: GIF_CONVERT_START });
  const ff = await loadFfmpeg();
  await ff.writeFile("gen_input.mp4", await fetchFile(new Blob([new Uint8Array(bytes)])));
  await ff.exec([
    "-i",
    "gen_input.mp4",
    "-vf",
    `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos`,
    "gen_output.gif",
  ]);
  const out = (await ff.readFile("gen_output.gif")) as Uint8Array;
  emit({
    phase: "done",
    dataUrl: dataUrl(GIF_MIME, bytesToBase64(out)),
    mime: GIF_MIME,
  });
};

const OPENAI_COMPATIBLE_IMAGE: Provider[] = ["openai", "xai"];
const OPENAI_COMPATIBLE_VIDEO: Provider[] = ["openai"];

const unsupportedReason = (output: MediaOutput, provider: Provider): string =>
  `${output} generation needs an OpenAI-compatible endpoint; the ${provider} provider does not expose one`;

export const generateMedia = async (
  args: GenerateArgs,
  emit: GenerateListener,
): Promise<void> => {
  try {
    if (args.output === "image") {
      if (!OPENAI_COMPATIBLE_IMAGE.includes(args.provider)) {
        emit({ phase: "error", reason: unsupportedReason("image", args.provider) });
        return;
      }
      if (args.provider === "openai") {
        await generateOpenAiImage(args, emit);
        return;
      }
      await generateImagesEndpoint(args, emit);
      return;
    }
    if (!OPENAI_COMPATIBLE_VIDEO.includes(args.provider)) {
      emit({ phase: "error", reason: unsupportedReason(args.output, args.provider) });
      return;
    }
    if (args.output === "gif") {
      await generateGif(args, emit);
      return;
    }
    await generateVideo(args, emit);
  } catch (err) {
    emit({ phase: "error", reason: (err as Error).message });
  }
};
