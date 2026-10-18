import Link from "next/link";
import { Suspense } from "react";
import { requireAdminSession } from "@/lib/auth";
import {
  AGENT_CHANNEL,
  AWAITING_WINDOW_MS,
  LIVE_WINDOW_MS,
  TERMINAL_EVENT_KINDS,
  awaitingConversations,
  formatDateTime,
  formatSeconds,
  liveBadge,
  parseFilters,
  periodStart,
  whoLabel,
  type LiveBadge,
  type TurnStart,
  type TurnTerminalEvent,
  type TurnUserMessage,
} from "@/lib/agent-dashboard";
import { formatUsd, totalCostUsd, type ModelUsage } from "@/lib/agent-pricing";
import { LiveRefresh } from "./live-refresh";

type SearchParams = { periodo?: string; modo?: string; falhas?: string };

type SummaryRow = {
  id: string;
  started_as: "visitante" | "cliente";
  buyer_id: string | null;
  empresa: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  first_question: string | null;
  became_client: boolean;
  failure_count: number;
  order_number: number | string | null;
  order_status: string | null;
};

type Indicators = {
  conversations: number;
  failures: number;
  fallbacks: number;
  quota_blocks: number;
  avg_first_token_ms: number | null;
  usage: ModelUsage[] | null;
};

const SUMMARY_COLUMNS =
  "id, started_as, buyer_id, empresa, created_at, updated_at, message_count, first_question, became_client, failure_count, order_number, order_status";

const BADGE: Record<Exclude<LiveBadge, null>, { label: string; className: string }> = {
  aguardando: { label: "aguardando", className: "bg-amber-100 text-amber-800" },
  conversando: { label: "ao vivo", className: "bg-emerald-100 text-emerald-800" },
};

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-800">{value}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

async function AgenteContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireAdminSession();
  const filters = parseFilters(await searchParams);
  const now = new Date();
  const since = periodStart(filters.period, now).toISOString();
  const liveSince = new Date(now.getTime() - LIVE_WINDOW_MS).toISOString();
  const awaitingSince = new Date(now.getTime() - AWAITING_WINDOW_MS).toISOString();

  let listQuery = supabase
    .from("v_agent_conversation_summary")
    .select(SUMMARY_COLUMNS)
    .eq("channel", AGENT_CHANNEL)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (filters.mode) listQuery = listQuery.eq("started_as", filters.mode);
  if (filters.onlyFailures) listQuery = listQuery.gt("failure_count", 0);

  const [list, indicatorsResult, liveCount, starts] = await Promise.all([
    listQuery,
    supabase
      .rpc("agent_dashboard_indicators", { p_channel: AGENT_CHANNEL, p_since: since, p_mode: filters.mode })
      .single(),
    supabase
      .from("agent_conversations")
      .select("id", { count: "exact", head: true })
      .eq("channel", AGENT_CHANNEL)
      .gte("updated_at", liveSince),
    supabase
      .from("agent_events")
      .select("conversation_id, detail, created_at")
      .eq("channel", AGENT_CHANNEL)
      .eq("kind", "turn_started")
      .gte("created_at", awaitingSince),
  ]);

  // "Aguardando": turn_started recentes e o que pode ter fechado cada um.
  const startRows = (starts.data ?? []) as TurnStart[];
  const startIds = [...new Set(startRows.map((row) => row.conversation_id).filter((id): id is string => !!id))];
  let awaiting = new Set<string>();
  let awaitingError: { message: string } | null = null;
  if (startIds.length > 0) {
    const [users, terminals] = await Promise.all([
      supabase
        .from("agent_messages")
        .select("conversation_id, message_id, created_at")
        .in("conversation_id", startIds)
        .eq("role", "user")
        .gte("created_at", awaitingSince),
      supabase
        .from("agent_events")
        .select("conversation_id, created_at")
        .in("conversation_id", startIds)
        .in("kind", [...TERMINAL_EVENT_KINDS])
        .gte("created_at", awaitingSince),
    ]);
    awaitingError = users.error ?? terminals.error;
    awaiting = awaitingConversations(
      startRows,
      (users.data ?? []) as TurnUserMessage[],
      (terminals.data ?? []) as TurnTerminalEvent[],
      now,
    );
  }

  const rows = (list.data ?? []) as unknown as SummaryRow[];
  const indicators = indicatorsResult.data as Indicators | null;
  const cost = totalCostUsd(indicators?.usage ?? []);
  const inputTokens = (indicators?.usage ?? []).reduce((sum, u) => sum + Number(u.input_tokens), 0);
  const outputTokens = (indicators?.usage ?? []).reduce((sum, u) => sum + Number(u.output_tokens), 0);
  const badges = new Map(rows.map((row) => [row.id, liveBadge(row.updated_at, awaiting.has(row.id), now)]));
  const hasLive = (liveCount.count ?? 0) > 0 || awaiting.size > 0;
  const error = list.error ?? indicatorsResult.error ?? liveCount.error ?? starts.error ?? awaitingError;
  const tokens = new Intl.NumberFormat("pt-BR");

  return (
    <div>
      <LiveRefresh
        supabaseUrl={process.env.SUPABASE_URL ?? ""}
        supabaseAnonKey={process.env.SUPABASE_ANON_KEY ?? ""}
        hasLive={hasLive}
      />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Conversas do agente</h1>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-3">
        <select name="periodo" defaultValue={filters.period} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="hoje">Hoje</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
        <select name="modo" defaultValue={filters.mode ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os modos</option>
          <option value="visitante">Visitante</option>
          <option value="cliente">Cliente</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="falhas" value="1" defaultChecked={filters.onlyFailures} />
          Só com falha
        </label>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar conversas: {error.message}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card label="Conversas" value={String(indicators?.conversations ?? 0)} />
        <Card label="Conversando agora" value={String(liveCount.count ?? 0)} hint="últimos 5 min" />
        <Card label="Aguardando resposta" value={String(awaiting.size)} />
        <Card label="Falhas" value={String(indicators?.failures ?? 0)} hint="erro, aborto, vazia" />
        <Card label="Trocas de provedor" value={String(indicators?.fallbacks ?? 0)} />
        <Card label="Bloqueios por cota" value={String(indicators?.quota_blocks ?? 0)} />
        <Card
          label="Primeira resposta"
          value={formatSeconds(indicators?.avg_first_token_ms ?? null) ?? "—"}
          hint="média"
        />
        <Card
          label="Tokens"
          value={`${tokens.format(inputTokens)} / ${tokens.format(outputTokens)}`}
          hint="entrada / saída"
        />
        <Card
          label="Custo"
          value={formatUsd(cost.costUsd)}
          hint={cost.unpricedModels.length > 0 ? `estimativa; sem preço: ${cost.unpricedModels.join(", ")}` : "estimativa"}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3">Início</th>
              <th className="px-4 py-3">Última atividade</th>
              <th className="px-4 py-3">Quem</th>
              <th className="px-4 py-3">Modo</th>
              <th className="px-4 py-3 text-right">Mensagens</th>
              <th className="px-4 py-3">Primeira pergunta</th>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3 text-right">Falhas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const badge = badges.get(row.id) ?? null;
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {badge && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[badge].className}`}>
                        {BADGE[badge].label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(row.updated_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/agente/${row.id}`} className="font-semibold text-slate-700 hover:underline">
                      {whoLabel(row.empresa, row.buyer_id)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {row.started_as}
                    {row.became_client && <span className="ml-1 text-xs text-emerald-700">(virou cliente)</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{row.message_count}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-600">{row.first_question ?? "—"}</td>
                  <td className="px-4 py-3">{row.order_number != null ? `#${row.order_number}` : "—"}</td>
                  <td className={`px-4 py-3 text-right ${row.failure_count > 0 ? "font-semibold text-red-600" : ""}`}>
                    {row.failure_count}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                  Nenhuma conversa no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AgentePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={null}>
      <AgenteContent searchParams={searchParams} />
    </Suspense>
  );
}
