// Server-side multi-provider completion. Dispatches to Anthropic, OpenAI, xAI, or
// Gemini based on the model's provider. Keys are read from server env (never
// NEXT_PUBLIC). Returns ok:false (with a reason) instead of throwing so callers can
// fall back gracefully when a key is missing or a provider errors.

import { DEFAULT_MODEL, type ModelSpec, type Provider } from "./models";

const DEFAULT_MAX_TOKENS = 1200;
const ANTHROPIC_VERSION = "2023-06-01";

export interface ImageInput {
  dataBase64: string;
  mime: string;
}

export interface CompleteArgs {
  model: ModelSpec;
  system: string;
  user: string;
  maxTokens?: number;
  images?: ImageInput[];
}

export interface CompleteResult {
  text: string;
  ok: boolean;
  reason?: string;
}

interface OpenAiStyle {
  base: string;
  key: string | undefined;
  tokenParam: "max_tokens" | "max_completion_tokens";
}

function openAiStyle(provider: Provider): OpenAiStyle {
  switch (provider) {
    case "openai":
      return {
        base: "https://api.openai.com/v1",
        key: process.env.OPENAI_API_KEY,
        tokenParam: "max_completion_tokens",
      };
    case "xai":
      return {
        base: "https://api.x.ai/v1",
        key: process.env.XAI_API_KEY,
        tokenParam: "max_tokens",
      };
    default:
      return {
        base: "https://generativelanguage.googleapis.com/v1beta/openai",
        key: process.env.GEMINI_API_KEY,
        tokenParam: "max_tokens",
      };
  }
}

async function callAnthropic(args: CompleteArgs): Promise<CompleteResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { text: "", ok: false, reason: "no-key" };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: args.model.apiId,
      max_tokens: args.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: args.system,
      messages: [
        {
          role: "user",
          content: args.images?.length
            ? [
                { type: "text", text: args.user },
                ...args.images.map((img) => ({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: img.mime,
                    data: img.dataBase64,
                  },
                })),
              ]
            : args.user,
        },
      ],
    }),
  });
  if (!res.ok) return { text: "", ok: false, reason: `status ${res.status}` };
  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";
  return text.trim()
    ? { text: text.trim(), ok: true }
    : { text: "", ok: false, reason: "empty" };
}

async function callOpenAiStyle(args: CompleteArgs): Promise<CompleteResult> {
  const style = openAiStyle(args.model.provider);
  if (!style.key) return { text: "", ok: false, reason: "no-key" };
  const userContent = args.images?.length
    ? [
        { type: "text", text: args.user },
        ...args.images.map((img) => ({
          type: "image_url",
          image_url: { url: `data:${img.mime};base64,${img.dataBase64}` },
        })),
      ]
    : args.user;
  const body: Record<string, unknown> = {
    model: args.model.apiId,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: userContent },
    ],
  };
  body[style.tokenParam] = args.maxTokens ?? DEFAULT_MAX_TOKENS;
  const res = await fetch(`${style.base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${style.key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { text: "", ok: false, reason: `status ${res.status}` };
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  return text.trim()
    ? { text: text.trim(), ok: true }
    : { text: "", ok: false, reason: "empty" };
}

export function hasProviderKey(provider: Provider): boolean {
  switch (provider) {
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "xai":
      return !!process.env.XAI_API_KEY;
    case "google":
      return !!process.env.GEMINI_API_KEY;
  }
}

export async function complete(args: CompleteArgs): Promise<CompleteResult> {
  // Free-tier safety net: if the chosen built-in model's provider has no server
  // key (e.g. a Gemini-only deploy where the user picked Claude/GPT/Grok), fall
  // back to the default Gemini model so users get a real answer instead of a
  // route-level template. BYOK custom models never reach the server, so this only
  // affects built-in picks the server can't actually run.
  const model =
    !hasProviderKey(args.model.provider) && hasProviderKey(DEFAULT_MODEL.provider)
      ? DEFAULT_MODEL
      : args.model;
  const call = { ...args, model };
  try {
    return model.provider === "anthropic"
      ? await callAnthropic(call)
      : await callOpenAiStyle(call);
  } catch (err) {
    return { text: "", ok: false, reason: `fetch-failed: ${(err as Error).message}` };
  }
}
