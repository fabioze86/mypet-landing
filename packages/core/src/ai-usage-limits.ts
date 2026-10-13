import { createHash } from "node:crypto";
import { getHubServiceClient } from "./supabase";

// Teto de uso dos assistentes de IA, para que abuso não vire custo imprevisto
// no provedor. Contagem no Supabase (função consume_ai_quota), pois a Vercel
// roda várias instâncias e contador em memória não vale entre elas.

export type AiScope = "assistant" | "duvidas";

export type AiLimits = {
  ipBurstMax: number;
  ipBurstWindowSeconds: number;
  ipDailyMax: number;
  globalDailyMax: number;
};

const DEFAULT_LIMITS: Record<AiScope, AiLimits> = {
  // Assistente de compras (/loja): usa ferramentas e até 5 passos por pergunta.
  assistant: { ipBurstMax: 15, ipBurstWindowSeconds: 600, ipDailyMax: 80, globalDailyMax: 2000 },
  // Dúvidas da home: público anônimo, respostas curtas.
  duvidas: { ipBurstMax: 8, ipBurstWindowSeconds: 600, ipDailyMax: 30, globalDailyMax: 1000 },
};

function envInt(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

// Ajuste sem deploy de código: AI_LIMIT_DUVIDAS_IP_BURST, AI_LIMIT_DUVIDAS_IP_DAILY,
// AI_LIMIT_DUVIDAS_GLOBAL_DAILY (idem com ASSISTANT).
export function getAiLimits(scope: AiScope): AiLimits {
  const prefix = `AI_LIMIT_${scope.toUpperCase()}`;
  const base = DEFAULT_LIMITS[scope];
  return {
    ipBurstMax: envInt(`${prefix}_IP_BURST`) ?? base.ipBurstMax,
    ipBurstWindowSeconds: base.ipBurstWindowSeconds,
    ipDailyMax: envInt(`${prefix}_IP_DAILY`) ?? base.ipDailyMax,
    globalDailyMax: envInt(`${prefix}_GLOBAL_DAILY`) ?? base.globalDailyMax,
  };
}

export function hashClientIp(headers: Headers): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

const LIMIT_MESSAGES: Record<string, string> = {
  ip_burst: "Você enviou muitas perguntas seguidas. Aguarde alguns minutos e tente de novo.",
  ip_daily: "Você atingiu o limite de perguntas de hoje. Volte amanhã ou fale com o nosso time pelo WhatsApp.",
  global_daily: "O assistente está temporariamente indisponível. Tente novamente mais tarde.",
};

function errorResponse(status: number, code: string, message: string, headers?: HeadersInit): Response {
  return Response.json({ ok: false, error: { code, message } }, { status, headers });
}

/**
 * Consome uma unidade da cota. Devolve null se pode seguir, ou a Response de
 * erro pronta (429 limite, 503 desligado/indisponível). Falha fechada: sem
 * conseguir contar, não chama a IA.
 */
export async function consumeAiQuota(
  scope: AiScope,
  channel: string,
  headers: Headers,
): Promise<Response | null> {
  if (process.env.AI_ASSISTANTS_DISABLED === "true") {
    return errorResponse(503, "AI_DISABLED", LIMIT_MESSAGES.global_daily);
  }

  const limits = getAiLimits(scope);
  let result: string | null = null;
  try {
    const { data, error } = await getHubServiceClient().rpc("consume_ai_quota", {
      p_scope: scope,
      p_channel: channel,
      p_ip_hash: hashClientIp(headers),
      p_ip_burst_max: limits.ipBurstMax,
      p_ip_burst_window_seconds: limits.ipBurstWindowSeconds,
      p_ip_daily_max: limits.ipDailyMax,
      p_global_daily_max: limits.globalDailyMax,
    });
    if (error) throw new Error(error.message);
    result = typeof data === "string" ? data : null;
  } catch (error) {
    console.error(`[ai-usage-limits] falha ao consumir cota (${scope}):`, error);
    return errorResponse(503, "UNAVAILABLE", "Não foi possível responder agora. Tente novamente em instantes.");
  }

  if (result === "ok") return null;

  if (result === "global_daily") {
    console.warn(`[ai-usage-limits] teto diário global atingido (${scope}/${channel})`);
  }
  const message = LIMIT_MESSAGES[result ?? ""] ?? LIMIT_MESSAGES.global_daily;
  const retryAfter = result === "ip_burst" ? String(limits.ipBurstWindowSeconds) : "3600";
  return errorResponse(429, "RATE_LIMITED", message, { "Retry-After": retryAfter });
}
