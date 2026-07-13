import { google } from "@ai-sdk/google";
import { vertex } from "@ai-sdk/google-vertex";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { isAssistantProvider, type AssistantProvider } from "./ai-models";

export { SELECTABLE_MODELS, isAssistantProvider, isSelectableModel } from "./ai-models";
export type { AssistantProvider } from "./ai-models";

const DEFAULT_MODEL_BY_PROVIDER: Record<AssistantProvider, string> = {
  google: "gemini-2.5-flash",
  "google-vertex": "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
};

const DEFAULT_FALLBACK_CHAIN: AssistantProvider[] = ["openai", "google"];

function buildModel(provider: AssistantProvider, modelId?: string): LanguageModel {
  const id = modelId ?? DEFAULT_MODEL_BY_PROVIDER[provider];
  switch (provider) {
    case "google":
      return google(id);
    case "google-vertex":
      return vertex(id);
    case "openai":
      return openai(id);
    case "anthropic":
      return anthropic(id);
  }
}

export type AssistantModelCandidate = { provider: AssistantProvider; model: LanguageModel };
export type AssistantModelOverride = { provider: AssistantProvider; model: string };

// Sem AI_PROVIDER, tenta OpenAI e cai para Google Gemini se o primeiro falhar.
// `override` (painel admin) força um único provedor/modelo específico, sem fallback.
export function getAssistantModelChain(override?: AssistantModelOverride): AssistantModelCandidate[] {
  if (override) {
    return [{ provider: override.provider, model: buildModel(override.provider, override.model) }];
  }

  const providerEnv = process.env.AI_PROVIDER;

  if (providerEnv) {
    if (!isAssistantProvider(providerEnv)) {
      throw new Error(
        `AI_PROVIDER desconhecido: "${providerEnv}". Use "google", "google-vertex", "openai" ou "anthropic".`,
      );
    }
    return [{ provider: providerEnv, model: buildModel(providerEnv, process.env.AI_MODEL) }];
  }

  return DEFAULT_FALLBACK_CHAIN.map((provider) => ({ provider, model: buildModel(provider) }));
}
