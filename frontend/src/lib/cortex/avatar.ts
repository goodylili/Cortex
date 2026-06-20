// Deterministic generated avatars (no external assets). A stable seed (wallet
// address, agent id, model id) maps to a fixed two-tone gradient, so the same
// identity always renders the same "profile picture".

import { LLM_MODELS, type Provider } from "@/lib/llm/models";

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function avatarGradient(seed: string): string {
  const h = hashSeed(seed || "cortex");
  const a = h % 360;
  const b = (a + 80 + ((h >> 9) % 80)) % 360;
  return `linear-gradient(135deg, hsl(${a} 68% 56%), hsl(${b} 70% 44%))`;
}

export function initialsOf(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

// The provider of a chat model by its display name (built-in or BYOK custom).
export function modelProvider(
  name: string,
  customModels: { label: string; provider: Provider }[],
): Provider | undefined {
  const builtin = LLM_MODELS.find((m) => m.name === name);
  if (builtin) return builtin.provider;
  return customModels.find((c) => c.label === name)?.provider;
}

const PROVIDER_GLYPH: Record<Provider, string> = {
  anthropic: "C",
  openai: "O",
  xai: "X",
  google: "G",
};

export function providerGlyph(p: Provider): string {
  return PROVIDER_GLYPH[p];
}
