import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn((modelId: string) => ({ provider: "google", modelId })),
}));
vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn((modelId: string) => ({ provider: "openai", modelId })),
}));
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn((modelId: string) => ({ provider: "anthropic", modelId })),
}));

import { getAssistantModel } from "./ai-provider";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("getAssistantModel", () => {
  it("usa Google Gemini 2.5 Flash por padrão", () => {
    expect(getAssistantModel()).toEqual({ provider: "google", modelId: "gemini-2.5-flash" });
  });

  it("usa o provedor e o modelo definidos por variável de ambiente", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_MODEL", "gpt-4o");
    expect(getAssistantModel()).toEqual({ provider: "openai", modelId: "gpt-4o" });
  });

  it("usa o modelo padrão do provedor quando AI_MODEL não é definido", () => {
    vi.stubEnv("AI_PROVIDER", "anthropic");
    expect(getAssistantModel()).toEqual({ provider: "anthropic", modelId: "claude-haiku-4-5" });
  });

  it("lança erro para um provedor desconhecido", () => {
    vi.stubEnv("AI_PROVIDER", "cohere");
    expect(() => getAssistantModel()).toThrow(
      'AI_PROVIDER desconhecido: "cohere". Use "google", "openai" ou "anthropic".',
    );
  });
});
