import type { AssistantMessage } from "./assistant-client";

export type SupportAssistantResult = { ok: true; reply: string } | { ok: false; error: string };

const GENERIC_CLIENT_ERROR = "Não entendi sua pergunta. Tente reformular.";
const GENERIC_SERVER_ERROR = "Não foi possível responder agora. Tente novamente em instantes.";
const NETWORK_ERROR = "Não foi possível conectar. Verifique sua internet e tente novamente.";

export async function askSupportAssistant(
  channel: string,
  messages: AssistantMessage[],
): Promise<SupportAssistantResult> {
  let res: Response;
  try {
    res = await fetch("/api/duvidas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, messages }),
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  const data = await res.json().catch(() => null);

  if (res.ok && data?.ok && typeof data.reply === "string") {
    return { ok: true, reply: data.reply };
  }

  if (res.status >= 400 && res.status < 500) {
    return {
      ok: false,
      error: typeof data?.error?.message === "string" ? data.error.message : GENERIC_CLIENT_ERROR,
    };
  }

  return { ok: false, error: GENERIC_SERVER_ERROR };
}
