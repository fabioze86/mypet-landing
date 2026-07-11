import type { CatalogProduct } from "./catalog-utils";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

export type AssistantProfileGuess = {
  label: "pet_shop" | "banho_tosa" | "outro";
  confidence: "alta" | "baixa";
};

export type AssistantProfileOption = { label: string; value: string };

export type AssistantResult =
  | {
      ok: true;
      reply: string;
      products: CatalogProduct[];
      profileGuess?: AssistantProfileGuess;
      profileOptions?: AssistantProfileOption[];
    }
  | { ok: false; error: string };

const GENERIC_CLIENT_ERROR = "Não entendi sua mensagem. Tente reformular.";
const GENERIC_SERVER_ERROR = "Não foi possível processar sua mensagem agora. Tente novamente em instantes.";
const NETWORK_ERROR = "Não foi possível conectar. Verifique sua internet e tente novamente.";

export async function askAssistant(
  channel: string,
  messages: AssistantMessage[],
): Promise<AssistantResult> {
  let res: Response;
  try {
    res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, messages }),
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  const data = await res.json().catch(() => null);

  if (res.ok && data?.ok) {
    return data as AssistantResult;
  }

  if (res.status >= 400 && res.status < 500) {
    return {
      ok: false,
      error: typeof data?.error?.message === "string" ? data.error.message : GENERIC_CLIENT_ERROR,
    };
  }

  return { ok: false, error: GENERIC_SERVER_ERROR };
}
