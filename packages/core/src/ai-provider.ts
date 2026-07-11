import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export type AssistantProvider = "google" | "openai" | "anthropic";

const DEFAULT_PROVIDER: AssistantProvider = "google";

const DEFAULT_MODEL_BY_PROVIDER: Record<AssistantProvider, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
};

function isAssistantProvider(value: string): value is AssistantProvider {
  return value === "google" || value === "openai" || value === "anthropic";
}

export function getAssistantModel(): LanguageModel {
  const providerEnv = process.env.AI_PROVIDER ?? DEFAULT_PROVIDER;

  if (!isAssistantProvider(providerEnv)) {
    throw new Error(
      `AI_PROVIDER desconhecido: "${providerEnv}". Use "google", "openai" ou "anthropic".`,
    );
  }

  const modelId = process.env.AI_MODEL ?? DEFAULT_MODEL_BY_PROVIDER[providerEnv];

  switch (providerEnv) {
    case "google":
      return google(modelId);
    case "openai":
      return openai(modelId);
    case "anthropic":
      return anthropic(modelId);
  }
}
