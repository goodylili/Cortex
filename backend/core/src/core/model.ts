// Provider-agnostic chat completion for the server-side runtime (extraction,
// consolidation, agent + loop reasoning). Anthropic uses its native Messages API;
// Google (Gemini) uses its OpenAI-compatible endpoint. Returns ok:false with a reason
// instead of throwing so callers can fall back to heuristics when no key is configured.

import type { Config, ModelProvider } from "./config";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const GOOGLE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const CRITIC_MODELS: Record<ModelProvider, [string, string]> = {
  anthropic: ["claude-opus-4-8", "claude-sonnet-4-6"],
  google: ["gemini-3-pro", "gemini-2.5-flash"],
};

export interface ChatRequest {
  system: string;
  user: string;
  model?: string;
  maxTokens: number;
}

export interface ChatResult {
  ok: boolean;
  text: string;
  reason?: string;
}

function providerKey(cfg: Config): string {
  return cfg.models.provider === "google"
    ? cfg.models.googleApiKey
    : cfg.models.anthropicApiKey;
}

export function hasModelKey(cfg: Config): boolean {
  return !!providerKey(cfg);
}

// A model id distinct from the builder's cfg.models.chat within the active provider, so
// adversarial verification is never the same model grading its own work.
export function criticModel(cfg: Config): string {
  const [primary, alternate] = CRITIC_MODELS[cfg.models.provider];
  return cfg.models.chat === primary ? alternate : primary;
}

async function callAnthropic(
  key: string,
  model: string,
  req: ChatRequest,
): Promise<ChatResult> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    }),
  });
  if (!res.ok)
    return { ok: false, text: "", reason: `anthropic ${res.status} ${res.statusText}` };
  const data = (await res.json()) as { content?: { text?: string }[] };
  return { ok: true, text: (data.content ?? []).map((p) => p.text ?? "").join("") };
}

async function callGoogle(
  key: string,
  model: string,
  req: ChatRequest,
): Promise<ChatResult> {
  const res = await fetch(GOOGLE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    }),
  });
  if (!res.ok)
    return { ok: false, text: "", reason: `google ${res.status} ${res.statusText}` };
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return { ok: true, text: data.choices?.[0]?.message?.content ?? "" };
}

export async function chatComplete(
  cfg: Config,
  req: ChatRequest,
): Promise<ChatResult> {
  const key = providerKey(cfg);
  if (!key)
    return {
      ok: false,
      text: "",
      reason: `no ${cfg.models.provider} api key configured`,
    };
  const model = req.model ?? cfg.models.chat;
  try {
    return cfg.models.provider === "google"
      ? await callGoogle(key, model, req)
      : await callAnthropic(key, model, req);
  } catch (err) {
    return { ok: false, text: "", reason: `fetch-failed: ${(err as Error).message}` };
  }
}
