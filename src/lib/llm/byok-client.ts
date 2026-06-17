import type { Provider } from "./models";

const DEFAULT_MAX_TOKENS = 1200;
const ANTHROPIC_VERSION = "2023-06-01";

export interface ByokCompleteArgs {
  provider: Provider;
  apiId: string;
  baseUrl: string;
  apiKey: string;
  system: string;
  user: string;
  maxTokens?: number;
}

export interface ByokResult {
  text: string;
  ok: boolean;
  reason?: string;
}

const callAnthropic = async (args: ByokCompleteArgs): Promise<ByokResult> => {
  const res = await fetch(`${args.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": args.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: args.apiId,
      max_tokens: args.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
    }),
  });
  if (!res.ok) return { text: "", ok: false, reason: `status ${res.status}` };
  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";
  return text.trim()
    ? { text: text.trim(), ok: true }
    : { text: "", ok: false, reason: "empty" };
};

const callOpenAiStyle = async (args: ByokCompleteArgs): Promise<ByokResult> => {
  const res = await fetch(`${args.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.apiId,
      max_tokens: args.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });
  if (!res.ok) return { text: "", ok: false, reason: `status ${res.status}` };
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  return text.trim()
    ? { text: text.trim(), ok: true }
    : { text: "", ok: false, reason: "empty" };
};

export const completeByok = async (
  args: ByokCompleteArgs,
): Promise<ByokResult> => {
  try {
    return args.provider === "anthropic"
      ? await callAnthropic(args)
      : await callOpenAiStyle(args);
  } catch (err) {
    return {
      text: "",
      ok: false,
      reason: `fetch-failed: ${(err as Error).message}`,
    };
  }
};
