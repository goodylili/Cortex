// Canonical model registry  -  the single source of truth for the chat/studio
// picker and the server-side LLM caller. Eight text models across four providers.
// `apiId` is the provider's model id; change it here if a provider renames a model.

export type Provider = "anthropic" | "openai" | "xai" | "google";

export type Modality = "text" | "image" | "video";

export interface ModelSpec {
  id: string;
  name: string;
  prov: string;
  provider: Provider;
  apiId: string;
  price: string;
  desc: string;
  kind?: Modality;
}

export const modelKind = (m: { kind?: Modality }): Modality => m.kind ?? "text";

export const LLM_MODELS: ModelSpec[] = [
  {
    id: "claude-opus-4-8",
    name: "Claude Opus 4.8",
    prov: "Anthropic",
    provider: "anthropic",
    apiId: "claude-opus-4-8",
    price: "$$$",
    desc: "Deepest reasoning for hard questions",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    prov: "Anthropic",
    provider: "anthropic",
    apiId: "claude-sonnet-4-6",
    price: "$$",
    desc: "Balanced, great for everyday recall",
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    prov: "Anthropic",
    provider: "anthropic",
    apiId: "claude-haiku-4-5-20251001",
    price: "$",
    desc: "Fast and light for quick answers",
  },
  {
    id: "gpt-5.1",
    name: "GPT-5.1",
    prov: "OpenAI",
    provider: "openai",
    apiId: "gpt-5.1",
    price: "$$$",
    desc: "OpenAI's general-purpose flagship",
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 mini",
    prov: "OpenAI",
    provider: "openai",
    apiId: "gpt-5-mini",
    price: "$",
    desc: "Quick, cheap everyday chat",
  },
  {
    id: "grok-4",
    name: "Grok 4",
    prov: "xAI",
    provider: "xai",
    apiId: "grok-4",
    price: "$$",
    desc: "Fast, current, conversational",
  },
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro",
    prov: "Google",
    provider: "google",
    apiId: "gemini-3-pro",
    price: "$$",
    desc: "Long-context, multimodal",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    prov: "Google",
    provider: "google",
    apiId: "gemini-2.5-flash",
    price: "$",
    desc: "Lightning-fast with real capability",
  },
];

export const DEFAULT_MODEL: ModelSpec = LLM_MODELS.find(
  (m) => m.id === "gemini-2.5-flash",
)!;

export function modelByName(name?: string): ModelSpec {
  if (!name) return DEFAULT_MODEL;
  return LLM_MODELS.find((m) => m.name === name || m.id === name) ?? DEFAULT_MODEL;
}
