import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentMode } from "./agent-prompt";

// Eventos do agente /agente em agent_events (service role): o que não vira
// resposta normal, mais o turn_started do "aguardando resposta" ao vivo.
// Gravar evento nunca derruba a resposta: falhas só vão para o log.

export type AgentEventKind =
  | "turn_started"
  | "quota_blocked"
  | "conversation_forbidden"
  | "duplicate_message"
  | "provider_fallback"
  | "provider_error"
  | "aborted"
  | "empty_reply";

export type AgentEventContext = {
  conversationId: string | null;
  channel: string;
  mode: AgentMode | null;
  buyerId: string | null;
  ipHash: string;
  question: string | null;
};

export type AgentEvent = {
  kind: AgentEventKind;
  detail?: Record<string, unknown>;
  provider?: string | null;
  latencyMs?: number | null;
};

const MAX_ERROR_LENGTH = 500;

// Só a mensagem, sem stack: o detalhe vai para o banco e para o dashboard.
export function summarizeError(error: unknown): string {
  let raw: string;
  if (error instanceof Error) raw = error.message;
  else if (typeof error === "string") raw = error;
  else {
    try {
      raw = JSON.stringify(error) ?? String(error);
    } catch {
      raw = String(error);
    }
  }
  return raw.slice(0, MAX_ERROR_LENGTH);
}

export function buildEventRow(context: AgentEventContext, event: AgentEvent): Record<string, unknown> {
  return {
    conversation_id: context.conversationId,
    channel: context.channel,
    mode: context.mode,
    buyer_id: context.buyerId,
    ip_hash: context.ipHash,
    kind: event.kind,
    detail: event.detail ?? {},
    question: context.question,
    provider: event.provider ?? null,
    latency_ms: event.latencyMs ?? null,
  };
}

export async function recordAgentEvent(
  supabase: SupabaseClient | null,
  context: AgentEventContext,
  event: AgentEvent,
): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from("agent_events").insert(buildEventRow(context, event));
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error(`[agent-events] falha ao gravar "${event.kind}":`, error);
  }
}
