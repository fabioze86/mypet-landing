// Lógica do painel de conversas do agente /agente (/agente no admin): filtros,
// selo ao vivo, linha do tempo e rótulos. Sem I/O: as páginas buscam os dados
// e passam para cá.

export const AGENT_CHANNEL = "mypetbrasil";
export const LIVE_WINDOW_MS = 5 * 60_000;
export const AWAITING_WINDOW_MS = 60_000;
export const TERMINAL_EVENT_KINDS = ["provider_error", "aborted", "empty_reply"] as const;

const TIME_ZONE = "America/Sao_Paulo";
// São Paulo sem horário de verão desde 2019: UTC−3 fixo.
const SAO_PAULO_OFFSET = "-03:00";
const DAY_MS = 24 * 60 * 60_000;

export type Period = "hoje" | "7d" | "30d";
export type ModeFilter = "visitante" | "cliente" | null;
export type DashboardFilters = { period: Period; mode: ModeFilter; onlyFailures: boolean };

const PERIODS: readonly Period[] = ["hoje", "7d", "30d"];

export function parseFilters(params: { periodo?: string; modo?: string; falhas?: string }): DashboardFilters {
  const period = PERIODS.includes(params.periodo as Period) ? (params.periodo as Period) : "hoje";
  const mode = params.modo === "visitante" || params.modo === "cliente" ? params.modo : null;
  return { period, mode, onlyFailures: params.falhas === "1" };
}

export function periodStart(period: Period, now: Date): Date {
  if (period === "7d") return new Date(now.getTime() - 7 * DAY_MS);
  if (period === "30d") return new Date(now.getTime() - 30 * DAY_MS);
  // en-CA formata como AAAA-MM-DD.
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
  return new Date(`${day}T00:00:00${SAO_PAULO_OFFSET}`);
}

export type TurnStart = { conversation_id: string | null; detail: Record<string, unknown> | null; created_at: string };
export type TurnUserMessage = { conversation_id: string; message_id: string; created_at: string };
export type TurnTerminalEvent = { conversation_id: string | null; created_at: string };

// Turno aberto: o turn_started mais recente da conversa, com menos de 60 s, sem
// a pergunta gravada (mesmo message_id) nem evento terminal depois dele.
export function awaitingConversations(
  starts: TurnStart[],
  userMessages: TurnUserMessage[],
  terminals: TurnTerminalEvent[],
  now: Date,
): Set<string> {
  const cutoff = now.getTime() - AWAITING_WINDOW_MS;
  const latest = new Map<string, TurnStart>();
  for (const start of starts) {
    if (!start.conversation_id) continue;
    if (Date.parse(start.created_at) < cutoff) continue;
    const current = latest.get(start.conversation_id);
    if (!current || Date.parse(start.created_at) > Date.parse(current.created_at)) {
      latest.set(start.conversation_id, start);
    }
  }

  const awaiting = new Set<string>();
  for (const [conversationId, start] of latest) {
    const messageId = typeof start.detail?.message_id === "string" ? start.detail.message_id : null;
    const answered = userMessages.some(
      (m) => m.conversation_id === conversationId && messageId !== null && m.message_id === messageId,
    );
    const failed = terminals.some(
      (t) => t.conversation_id === conversationId && Date.parse(t.created_at) >= Date.parse(start.created_at),
    );
    if (!answered && !failed) awaiting.add(conversationId);
  }
  return awaiting;
}

export type LiveBadge = "aguardando" | "conversando" | null;

export function liveBadge(updatedAt: string, awaiting: boolean, now: Date): LiveBadge {
  if (awaiting) return "aguardando";
  return now.getTime() - Date.parse(updatedAt) <= LIVE_WINDOW_MS ? "conversando" : null;
}

export type StoredMessage = {
  id: string;
  message_id: string;
  role: "user" | "assistant";
  content: string;
  parts: unknown;
  mode: string;
  created_at: string;
  provider: string | null;
  model: string | null;
  latency_ms: number | null;
  first_token_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  steps: number | null;
};

export type StoredEvent = {
  id: number;
  kind: string;
  detail: Record<string, unknown> | null;
  question: string | null;
  provider: string | null;
  latency_ms: number | null;
  created_at: string;
};

export const MESSAGE_COLUMNS =
  "id, message_id, role, content, parts, mode, created_at, provider, model, latency_ms, first_token_ms, input_tokens, output_tokens, steps";
export const EVENT_COLUMNS = "id, kind, detail, question, provider, latency_ms, created_at";

export type TimelineItem =
  | { type: "message"; at: string; message: StoredMessage }
  | { type: "event"; at: string; event: StoredEvent };

// turn_started não vira linha: só alimenta o "aguardando resposta".
export function buildTimeline(messages: StoredMessage[], events: StoredEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...messages.map((message) => ({ type: "message" as const, at: message.created_at, message })),
    ...events
      .filter((event) => event.kind !== "turn_started")
      .map((event) => ({ type: "event" as const, at: event.created_at, event })),
  ];
  return items.sort((a, b) => {
    const diff = Date.parse(a.at) - Date.parse(b.at);
    if (diff !== 0) return diff;
    if (a.type === b.type) return 0;
    return a.type === "message" ? -1 : 1;
  });
}

export type ToolPart = { type: string; input?: unknown; output?: unknown };

export function toolParts(parts: unknown): ToolPart[] {
  if (!Array.isArray(parts)) return [];
  return parts.filter(
    (part): part is ToolPart =>
      typeof part === "object" && part !== null && typeof (part as { type?: unknown }).type === "string" &&
      (part as { type: string }).type.startsWith("tool-"),
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function describeToolPart(part: ToolPart): string {
  const name = part.type.slice("tool-".length);
  switch (name) {
    case "buscar_produtos": {
      const query = asRecord(part.input)?.query;
      const label = typeof query === "string" ? `Buscou produtos: '${query}'` : "Buscou produtos";
      const output = asRecord(part.output);
      if (!output) return label;
      const total =
        typeof output.total === "number" ? output.total : Array.isArray(output.produtos) ? output.produtos.length : null;
      if (total === null) return label;
      return `${label} → ${total} ${total === 1 ? "resultado" : "resultados"}`;
    }
    case "alterar_pedido":
      return "Alterou o pedido";
    case "sugerir_reposicao":
      return "Sugeriu reposição";
    case "status_pedidos":
      return "Consultou pedidos";
    default:
      return name;
  }
}

export function eventLabel(event: StoredEvent): { text: string; tone: "error" | "warning" | "info" } {
  const detail = event.detail ?? {};
  switch (event.kind) {
    case "provider_error":
      return { text: "Erro do provedor", tone: "error" };
    case "aborted":
      return { text: "Resposta interrompida", tone: "error" };
    case "empty_reply":
      return { text: "Resposta vazia", tone: "error" };
    case "provider_fallback":
      return {
        text: `Troca de provedor: ${String(detail.failed_provider ?? "?")} falhou, ${event.provider ?? "?"} respondeu`,
        tone: "warning",
      };
    case "quota_blocked":
      return { text: `Bloqueado pela cota (${String(detail.reason ?? "?")})`, tone: "warning" };
    case "conversation_forbidden":
      return { text: "Conversa recusada (pertence a outro comprador)", tone: "warning" };
    case "duplicate_message":
      return { text: "Mensagem duplicada recusada", tone: "info" };
    default:
      return { text: event.kind, tone: "info" };
  }
}

export function whoLabel(empresa: string | null, buyerId: string | null): string {
  if (empresa) return empresa;
  return buyerId ? "Cliente sem empresa" : "Visitante";
}

const SECONDS = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatSeconds(ms: number | null): string | null {
  return ms === null ? null : `${SECONDS.format(ms / 1000)} s`;
}

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso)).replace(",", "");
}
