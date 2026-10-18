import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatPrice } from "@mypet/core/catalog-utils";
import { requireAdminSession } from "@/lib/auth";
import {
  EVENT_COLUMNS,
  MESSAGE_COLUMNS,
  TERMINAL_EVENT_KINDS,
  awaitingConversations,
  buildTimeline,
  describeToolPart,
  eventLabel,
  formatDateTime,
  formatSeconds,
  toolParts,
  whoLabel,
  type StoredEvent,
  type StoredMessage,
} from "@/lib/agent-dashboard";
import { estimateCostUsd, formatUsd } from "@/lib/agent-pricing";
import { ORDERS_SELECT, orderTotal, type OrderRow } from "@/lib/orders";
import { LiveRefresh } from "../live-refresh";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TONE: Record<"error" | "warning" | "info", string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-slate-200 bg-slate-50 text-slate-600",
};

type Summary = {
  id: string;
  started_as: "visitante" | "cliente";
  buyer_id: string | null;
  empresa: string | null;
  created_at: string;
  became_client: boolean;
};

function MessageMeta({ message }: { message: StoredMessage }) {
  const cost = estimateCostUsd(message.model, message.input_tokens, message.output_tokens);
  const parts = [
    message.provider,
    message.model,
    formatSeconds(message.latency_ms),
    message.input_tokens !== null && message.output_tokens !== null
      ? `${message.input_tokens}/${message.output_tokens} tokens`
      : null,
    cost !== null ? `${formatUsd(cost)} (estimativa)` : null,
  ].filter((part): part is string => !!part);
  if (parts.length === 0) return null;
  return <p className="mt-1 text-xs text-slate-400">{parts.join(" · ")}</p>;
}

function Tools({ message }: { message: StoredMessage }) {
  const tools = toolParts(message.parts);
  if (tools.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {tools.map((tool, index) => (
        <details key={index} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
          <summary className="cursor-pointer">{describeToolPart(tool)}</summary>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] text-slate-500">
            {JSON.stringify({ entrada: tool.input ?? null, saida: tool.output ?? null }, null, 2)}
          </pre>
        </details>
      ))}
    </div>
  );
}

async function ConversaContent({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdminSession();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const { data: summaryData, error: summaryError } = await supabase
    .from("v_agent_conversation_summary")
    .select("id, started_as, buyer_id, empresa, created_at, became_client")
    .eq("id", id)
    .maybeSingle();
  if (summaryError) {
    return <p className="text-sm text-red-600">Erro ao carregar a conversa: {summaryError.message}</p>;
  }
  if (!summaryData) notFound();
  const summary = summaryData as Summary;

  const [messagesResult, eventsResult, ordersResult] = await Promise.all([
    supabase.from("agent_messages").select(MESSAGE_COLUMNS).eq("conversation_id", id).order("created_at").limit(500),
    supabase.from("agent_events").select(EVENT_COLUMNS).eq("conversation_id", id).order("created_at").limit(500),
    supabase
      .from("orders")
      .select(ORDERS_SELECT)
      .eq("agent_conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const messages = (messagesResult.data ?? []) as unknown as StoredMessage[];
  const events = (eventsResult.data ?? []) as unknown as StoredEvent[];
  const order = ((ordersResult.data ?? []) as unknown as OrderRow[])[0] ?? null;
  const now = new Date();
  const awaiting = awaitingConversations(
    events
      .filter((event) => event.kind === "turn_started")
      .map((event) => ({ conversation_id: id, detail: event.detail, created_at: event.created_at })),
    messages
      .filter((message) => message.role === "user")
      .map((message) => ({ conversation_id: id, message_id: message.message_id, created_at: message.created_at })),
    events
      .filter((event) => (TERMINAL_EVENT_KINDS as readonly string[]).includes(event.kind))
      .map((event) => ({ conversation_id: id, created_at: event.created_at })),
    now,
  ).has(id);
  const timeline = buildTimeline(messages, events);
  const error = messagesResult.error ?? eventsResult.error ?? ordersResult.error;
  const total = order ? orderTotal(order) : null;

  return (
    <div className="max-w-3xl">
      <LiveRefresh
        supabaseUrl={process.env.SUPABASE_URL ?? ""}
        supabaseAnonKey={process.env.SUPABASE_ANON_KEY ?? ""}
        conversationId={id}
        hasLive={awaiting}
      />

      <Link href="/agente" className="text-sm text-slate-500 hover:underline">
        ← Conversas do agente
      </Link>
      <div className="mb-6 mt-2">
        <h1 className="text-xl font-bold text-slate-800">{whoLabel(summary.empresa, summary.buyer_id)}</h1>
        <p className="text-sm text-slate-500">
          Início {formatDateTime(summary.created_at)} · começou como {summary.started_as}
          {summary.became_client && " · virou cliente"}
        </p>
        {order && (
          <p className="mt-1 text-sm text-slate-600">
            Pedido {order.number != null ? `#${order.number}` : "sem número"} · {order.status}
            {total !== null && ` · ${formatPrice(total)}`}
          </p>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar a conversa: {error.message}</p>}

      <div className="flex flex-col gap-3">
        {timeline.map((item) => {
          if (item.type === "event") {
            const label = eventLabel(item.event);
            return (
              <div key={`e-${item.event.id}`} className={`rounded-lg border px-3 py-2 text-xs ${TONE[label.tone]}`}>
                <p className="font-semibold">
                  {formatDateTime(item.event.created_at)} · {label.text}
                </p>
                {item.event.question && <p className="mt-1">Pergunta: {item.event.question}</p>}
              </div>
            );
          }
          const message = item.message;
          const isUser = message.role === "user";
          return (
            <div key={`m-${message.id}`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  isUser ? "bg-slate-800 text-white" : "border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content || "—"}</p>
                <p className={`mt-1 text-[11px] ${isUser ? "text-slate-300" : "text-slate-400"}`}>
                  {formatDateTime(message.created_at)} · {message.mode}
                </p>
                {!isUser && <Tools message={message} />}
                {!isUser && <MessageMeta message={message} />}
              </div>
            </div>
          );
        })}
        {awaiting && <p className="text-sm italic text-amber-700">aguardando resposta…</p>}
        {timeline.length === 0 && !error && <p className="text-sm text-slate-400">Conversa sem mensagens.</p>}
      </div>
    </div>
  );
}

export default function ConversaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <ConversaContent params={params} />
    </Suspense>
  );
}
