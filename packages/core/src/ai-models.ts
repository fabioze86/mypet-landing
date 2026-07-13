export type AssistantProvider = "google" | "google-vertex" | "openai" | "anthropic";

// Modelos que o painel admin pode selecionar manualmente (teto de custo: nada fora desta lista).
export const SELECTABLE_MODELS: Record<AssistantProvider, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o"],
  google: ["gemini-2.5-flash", "gemini-2.5-pro"],
  "google-vertex": ["gemini-2.5-flash", "gemini-2.5-pro"],
  anthropic: ["claude-haiku-4-5", "claude-sonnet-5"],
};

export function isAssistantProvider(value: string): value is AssistantProvider {
  return value === "google" || value === "google-vertex" || value === "openai" || value === "anthropic";
}

export function isSelectableModel(provider: AssistantProvider, modelId: string): boolean {
  return SELECTABLE_MODELS[provider].includes(modelId);
}
