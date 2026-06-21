import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, LLM_MODELS, modelByName } from "@/lib/llm/models";

describe("modelByName", () => {
  it("returns the default model when no name is given", () => {
    expect(modelByName()).toBe(DEFAULT_MODEL);
  });

  it("matches a model by its display name", () => {
    expect(modelByName("Grok 4").id).toBe("grok-4");
  });

  it("matches a model by its id", () => {
    expect(modelByName("gpt-5.1").name).toBe("GPT-5.1");
  });

  it("falls back to the default for an unknown name", () => {
    expect(modelByName("does-not-exist")).toBe(DEFAULT_MODEL);
  });
});

describe("DEFAULT_MODEL", () => {
  it("is Gemini 2.5 Flash (the free-tier default)", () => {
    expect(DEFAULT_MODEL.id).toBe("gemini-2.5-flash");
  });
});

describe("LLM_MODELS", () => {
  it("registers eight models", () => {
    expect(LLM_MODELS).toHaveLength(8);
  });

  it("has unique ids across the registry", () => {
    expect(new Set(LLM_MODELS.map((m) => m.id)).size).toBe(LLM_MODELS.length);
  });

  it("gives every model an api id", () => {
    expect(LLM_MODELS.every((m) => m.apiId.length > 0)).toBe(true);
  });
});
