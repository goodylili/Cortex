import {
  LLM_MODELS,
  type Modality,
  type ModelSpec,
  type Provider,
} from "./models";

export interface ProviderInfo {
  id: Provider;
  label: string;
  baseUrl: string;
  keyPlaceholder: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    keyPlaceholder: "sk-ant-…",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyPlaceholder: "sk-…",
  },
  {
    id: "xai",
    label: "xAI",
    baseUrl: "https://api.x.ai/v1",
    keyPlaceholder: "xai-…",
  },
  {
    id: "google",
    label: "Google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyPlaceholder: "AIza…",
  },
];

export const providerInfo = (p: Provider): ProviderInfo =>
  PROVIDERS.find((x) => x.id === p)!;

export const providerModels = (p: Provider): ModelSpec[] =>
  LLM_MODELS.filter((m) => m.provider === p);

export interface CustomModel {
  id: string;
  label: string;
  provider: Provider;
  apiId: string;
  baseUrl: string;
  createdAt: number;
  kind?: Modality;
}

export const customModelId = (provider: Provider, apiId: string): string =>
  `byok:${provider}:${apiId}`;

export const toModelSpec = (m: CustomModel): ModelSpec => ({
  id: m.id,
  name: m.label,
  prov: providerInfo(m.provider).label,
  provider: m.provider,
  apiId: m.apiId,
  price: "BYOK",
  desc: `${providerInfo(m.provider).label} · your key`,
  kind: m.kind ?? "text",
});
