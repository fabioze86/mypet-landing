import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn((modelId: string) => ({ provider: "google", modelId })),
}));
vi.mock("@ai-sdk/google-vertex", () => ({
  vertex: vi.fn((modelId: string) => ({ provider: "google-vertex", modelId })),
}));
vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn((modelId: string) => ({ provider: "openai", modelId })),
}));
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn((modelId: string) => ({ provider: "anthropic", modelId })),
}));

import { getAssistantModelChain, isSelectableModel } from "./ai-provider";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("getAssistantModelChain", () => {
  it("por padrão tenta OpenAI primeiro e cai para Google Gemini em seguida", () => {
    expect(getAssistantModelChain()).toEqual([
      { provider: "openai", model: { provider: "openai", modelId: "gpt-4o-mini" } },
      { provider: "google", model: { provider: "google", modelId: "gemini-2.5-flash" } },
    ]);
  });

  it("com AI_PROVIDER definido, usa só esse provedor, sem fallback", () => {
    vi.stubEnv("AI_PROVIDER", "anthropic");
    vi.stubEnv("AI_MODEL", "claude-opus-4-8");
    expect(getAssistantModelChain()).toEqual([
      { provider: "anthropic", model: { provider: "anthropic", modelId: "claude-opus-4-8" } },
    ]);
  });

  it("usa o modelo padrão do provedor forçado quando AI_MODEL não é definido", () => {
    vi.stubEnv("AI_PROVIDER", "google-vertex");
    expect(getAssistantModelChain()).toEqual([
      { provider: "google-vertex", model: { provider: "google-vertex", modelId: "gemini-2.5-flash" } },
    ]);
  });

  it("lança erro para um provedor forçado desconhecido", () => {
    vi.stubEnv("AI_PROVIDER", "cohere");
    expect(() => getAssistantModelChain()).toThrow(
      'AI_PROVIDER desconhecido: "cohere". Use "google", "google-vertex", "openai" ou "anthropic".',
    );
  });

  it("com override (painel admin), usa só o provedor/modelo indicados, sem fallback e ignorando AI_PROVIDER", () => {
    vi.stubEnv("AI_PROVIDER", "anthropic");
    expect(getAssistantModelChain({ provider: "openai", model: "gpt-4o" })).toEqual([
      { provider: "openai", model: { provider: "openai", modelId: "gpt-4o" } },
    ]);
  });
});

describe("isSelectableModel", () => {
  it("aceita um modelo da lista permitida do provedor", () => {
    expect(isSelectableModel("openai", "gpt-4o-mini")).toBe(true);
  });

  it("rejeita um modelo fora da lista permitida", () => {
    expect(isSelectableModel("openai", "gpt-4-turbo-super-caro")).toBe(false);
  });
});
