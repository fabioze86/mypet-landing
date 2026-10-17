# Painel de conversas do agente — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** tela `/agente` no `apps/admin` com a lista ao vivo das conversas do agente `/agente`, indicadores do período e uma página por conversa com a linha do tempo completa.

**Architecture:** uma migration dá leitura das tabelas do agente só a quem está em `admin_users` (RLS), publica as tabelas no Realtime e cria uma view de resumo e uma função de indicadores (ambas `security invoker`). O admin lê com a sessão do usuário (Server Components, como Pedidos) e um componente cliente assina o Realtime com a mesma sessão para recarregar a página.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents: true`), React 19, Tailwind 4, `@supabase/ssr` 0.8, `@supabase/supabase-js` 2, Vitest 4, Postgres/Supabase.

**Spec:** `docs/superpowers/specs/2026-10-17-agente-dashboard-design.md`

## Global Constraints

- Acesso só para quem está em `admin_users` (admin e editor), garantido por RLS: `exists (select 1 from public.admin_users where id = auth.uid())`. O signup do Supabase Auth é aberto: `authenticated` vale como "qualquer pessoa". `anon` sem acesso nenhum.
- O painel é só leitura: nenhuma escrita no banco.
- Não usar `public.is_admin_or_editor()` (aceita papel vindo de `user_metadata`).
- Canal fixo `mypetbrasil`.
- "Conversando agora": `updated_at` nos últimos 5 minutos. "Aguardando resposta": `turn_started` nos últimos 60 segundos sem fechamento (mensagem `user` com o mesmo `message_id`, ou evento `provider_error`/`aborted`/`empty_reply` mais novo). "Aguardando" tem precedência.
- Período `hoje` começa às 00:00 de São Paulo (UTC−3, sem horário de verão).
- Ao vivo: recarga agrupada em 1 segundo; aba oculta não recarrega (marca pendente e recarrega ao voltar); recarga a cada 30 segundos quando há selo na tela ou o Realtime falhou.
- Custo sempre rotulado como estimativa; modelo fora da tabela → "sem preço".
- Next 16 com `cacheComponents: true`: conteúdo dinâmico da página fica num componente `async` embrulhado em `<Suspense fallback={null}>` pelo `export default`, como `apps/admin/app/(dashboard)/pedidos/page.tsx`. `params` e `searchParams` são `Promise`.
- Antes de escrever código de página, ler o guia relevante em `apps/admin/node_modules/next/dist/docs/01-app/` (regra do `AGENTS.md`).
- Textos de interface, comentários e logs em português, no estilo do admin.
- A árvore de trabalho pode ter mudanças de outras sessões: cada commit adiciona só os arquivos da task (`git add <arquivos>`; nunca `git add -A`).
- Testes do admin: `pnpm --filter admin exec vitest run <arquivo>` (da raiz `C:\Projetos\mypet-landing`). Tipos: `pnpm --filter admin exec tsc --noEmit`.

## Arquivos

| arquivo | ação | responsabilidade |
|---|---|---|
| `supabase/migrations/20261017130000_agent_dashboard.sql` | criar | policies, Realtime, view de resumo, função de indicadores |
| `apps/admin/lib/agent-pricing.ts` | criar | preços por modelo, custo estimado, formatação em US$ |
| `apps/admin/lib/agent-pricing.test.ts` | criar | testes do custo |
| `apps/admin/lib/agent-dashboard.ts` | criar | filtros, selo ao vivo, linha do tempo, rótulos de ferramenta e evento, formatação |
| `apps/admin/lib/agent-dashboard.test.ts` | criar | testes da lógica |
| `apps/admin/app/(dashboard)/agente/live-refresh.tsx` | criar | assinatura do Realtime e recarga |
| `apps/admin/app/(dashboard)/agente/page.tsx` | criar | lista + indicadores + filtros |
| `apps/admin/app/(dashboard)/agente/[id]/page.tsx` | criar | conversa |
| `apps/admin/app/(dashboard)/layout.tsx` | modificar | item "Conversas do agente" no menu |

---

### Task 1: Migration do painel

**Files:**
- Create: `supabase/migrations/20261017130000_agent_dashboard.sql`

**Interfaces:**
- Produces:
  - policies `agent_conversations_admin_select`, `agent_messages_admin_select`, `agent_events_admin_select`;
  - as três tabelas em `supabase_realtime`;
  - view `public.v_agent_conversation_summary (id, channel, started_as, buyer_id, created_at, updated_at, empresa, message_count, first_question, became_client, failure_count, order_number, order_status)`;
  - função `public.agent_dashboard_indicators(p_channel text, p_since timestamptz, p_mode text default null) returns table (conversations int, failures int, fallbacks int, quota_blocks int, avg_first_token_ms int, usage jsonb)`, com `usage` = `[{ model, input_tokens, output_tokens }]`.

- [ ] **Step 1: Escrever a migration**

```sql
-- Painel de conversas do agente (apps/admin, /agente).
--
-- Leitura das tabelas do agente só para quem está em admin_users: o signup do
-- Supabase Auth é aberto, então authenticated sozinho vale como "qualquer
-- pessoa". Mesmo critério de orders_admin_all e buyers_admin_select. Nada de
-- escrita: quem grava continua sendo só o servidor do agente (service role).
-- O Realtime aplica a RLS de cada assinante, então só administradores recebem
-- os eventos. A view e a função são security invoker pelo mesmo motivo.

do $$
declare
  t text;
begin
  foreach t in array array['agent_conversations', 'agent_messages', 'agent_events'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (exists (select 1 from public.admin_users where id = auth.uid()))',
      t || '_admin_select', t
    );
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Uma linha por conversa, para a lista do painel.
create or replace view public.v_agent_conversation_summary
with (security_invoker = true) as
select
  c.id,
  c.channel,
  c.started_as,
  c.buyer_id,
  c.created_at,
  c.updated_at,
  b.empresa,
  (select count(*) from public.agent_messages m where m.conversation_id = c.id)::int as message_count,
  (select left(m.content, 160)
     from public.agent_messages m
    where m.conversation_id = c.id and m.role = 'user'
    order by m.created_at
    limit 1) as first_question,
  (c.started_as = 'visitante' and exists (
     select 1 from public.agent_messages m where m.conversation_id = c.id and m.mode = 'cliente'
  )) as became_client,
  (select count(*)
     from public.agent_events e
    where e.conversation_id = c.id and e.kind in ('provider_error', 'aborted', 'empty_reply'))::int as failure_count,
  o.number as order_number,
  o.status as order_status
from public.agent_conversations c
left join public.buyers b on b.id = c.buyer_id
left join lateral (
  select number, status
    from public.orders
   where agent_conversation_id = c.id
   order by created_at desc
   limit 1
) o on true;

revoke all on public.v_agent_conversation_summary from anon;
grant select on public.v_agent_conversation_summary to authenticated;

-- Indicadores do período numa linha. p_mode nulo = todos os modos.
create or replace function public.agent_dashboard_indicators(
  p_channel text,
  p_since timestamptz,
  p_mode text default null
) returns table (
  conversations int,
  failures int,
  fallbacks int,
  quota_blocks int,
  avg_first_token_ms int,
  usage jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from agent_conversations c
      where c.channel = p_channel and c.updated_at >= p_since
        and (p_mode is null or c.started_as = p_mode))::int,
    (select count(*) from agent_events e
      where e.channel = p_channel and e.created_at >= p_since
        and (p_mode is null or e.mode = p_mode)
        and e.kind in ('provider_error', 'aborted', 'empty_reply'))::int,
    (select count(*) from agent_events e
      where e.channel = p_channel and e.created_at >= p_since
        and (p_mode is null or e.mode = p_mode)
        and e.kind = 'provider_fallback')::int,
    (select count(*) from agent_events e
      where e.channel = p_channel and e.created_at >= p_since
        and (p_mode is null or e.mode = p_mode)
        and e.kind = 'quota_blocked')::int,
    (select round(avg(m.first_token_ms))::int
       from agent_messages m
       join agent_conversations c on c.id = m.conversation_id
      where c.channel = p_channel and m.role = 'assistant' and m.created_at >= p_since
        and (p_mode is null or m.mode = p_mode)),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'model', u.model, 'input_tokens', u.input_tokens, 'output_tokens', u.output_tokens)), '[]'::jsonb)
       from (
         select m.model,
                sum(coalesce(m.input_tokens, 0))::bigint as input_tokens,
                sum(coalesce(m.output_tokens, 0))::bigint as output_tokens
           from agent_messages m
           join agent_conversations c on c.id = m.conversation_id
          where c.channel = p_channel and m.role = 'assistant' and m.created_at >= p_since
            and m.model is not null
            and (p_mode is null or m.mode = p_mode)
          group by m.model
       ) u)
$$;

revoke all on function public.agent_dashboard_indicators(text, timestamptz, text) from public, anon;
grant execute on function public.agent_dashboard_indicators(text, timestamptz, text) to authenticated;
```

- [ ] **Step 2: Revisar sem aplicar**

A aplicação no banco é a Task 7. Conferir: idempotente (`drop policy if exists`, checagem da publicação, `create or replace`), comentários em português, nenhuma permissão de escrita, `anon` revogado da view e da função.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261017130000_agent_dashboard.sql
git commit -m "feat(admin): migration do painel de conversas do agente (RLS de admin, Realtime, resumo e indicadores)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Preços e custo estimado

**Files:**
- Create: `apps/admin/lib/agent-pricing.ts`
- Test: `apps/admin/lib/agent-pricing.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const MODEL_PRICES_USD_PER_MILLION: Record<string, { input: number; output: number }>;
  export function estimateCostUsd(model: string | null, inputTokens: number | null, outputTokens: number | null): number | null;
  export type ModelUsage = { model: string; input_tokens: number; output_tokens: number };
  export function totalCostUsd(usage: ModelUsage[]): { costUsd: number; unpricedModels: string[] };
  export function formatUsd(value: number): string;
  ```

- [ ] **Step 1: Escrever o teste que falha**

`apps/admin/lib/agent-pricing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MODEL_PRICES_USD_PER_MILLION, estimateCostUsd, formatUsd, totalCostUsd } from "./agent-pricing";

describe("estimateCostUsd", () => {
  it("gpt-4o-mini: 1M de entrada e 1M de saída", () => {
    expect(estimateCostUsd("gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(0.75, 6);
  });
  it("gemini-2.5-flash e claude-haiku-4-5 estão na tabela", () => {
    expect(estimateCostUsd("gemini-2.5-flash", 1_000_000, 0)).toBeCloseTo(MODEL_PRICES_USD_PER_MILLION["gemini-2.5-flash"].input, 6);
    expect(estimateCostUsd("claude-haiku-4-5", 0, 1_000_000)).toBeCloseTo(MODEL_PRICES_USD_PER_MILLION["claude-haiku-4-5"].output, 6);
  });
  it("tokens nulos contam como zero", () => {
    expect(estimateCostUsd("gpt-4o-mini", null, null)).toBe(0);
  });
  it("modelo desconhecido ou ausente → null", () => {
    expect(estimateCostUsd("modelo-x", 10, 10)).toBeNull();
    expect(estimateCostUsd(null, 10, 10)).toBeNull();
  });
});

describe("totalCostUsd", () => {
  it("soma os modelos com preço e lista os sem preço", () => {
    const result = totalCostUsd([
      { model: "gpt-4o-mini", input_tokens: 1_000_000, output_tokens: 0 },
      { model: "modelo-x", input_tokens: 500, output_tokens: 500 },
    ]);
    expect(result.costUsd).toBeCloseTo(0.15, 6);
    expect(result.unpricedModels).toEqual(["modelo-x"]);
  });
  it("lista vazia → zero", () => {
    expect(totalCostUsd([])).toEqual({ costUsd: 0, unpricedModels: [] });
  });
});

describe("formatUsd", () => {
  it("duas casas, padrão brasileiro", () => {
    expect(formatUsd(1.5)).toBe("US$ 1,50");
  });
  it("zero", () => {
    expect(formatUsd(0)).toBe("US$ 0,00");
  });
  it("valor positivo abaixo de 1 centavo", () => {
    expect(formatUsd(0.0004)).toBe("< US$ 0,01");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter admin exec vitest run lib/agent-pricing.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-pricing"`.

- [ ] **Step 3: Conferir os preços**

Conferir nas páginas oficiais (`https://openai.com/api/pricing/`, `https://ai.google.dev/gemini-api/docs/pricing`, `https://www.anthropic.com/pricing`) o preço por milhão de tokens de `gpt-4o-mini`, `gemini-2.5-flash` (texto, sem cache) e `claude-haiku-4-5`. Se divergir da tabela abaixo, use o valor oficial no código e ajuste os testes que dependem dele (o primeiro teste usa gpt-4o-mini 0,15 + 0,60 = 0,75; o de `totalCostUsd`, 0,15). Sem acesso à web, mantenha a tabela e registre no relatório que os preços não foram conferidos.

- [ ] **Step 4: Implementar**

`apps/admin/lib/agent-pricing.ts`:

```ts
// Preço em US$ por milhão de tokens (entrada/saída) dos modelos que o agente
// /agente usa. Conferido em 2026-10-17 nas páginas de preço dos provedores;
// atualizar à mão quando mudar. O painel mostra o custo sempre como estimativa.
export const MODEL_PRICES_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export type ModelUsage = { model: string; input_tokens: number; output_tokens: number };

/** Custo estimado em US$; null quando o modelo não está na tabela. */
export function estimateCostUsd(
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (!model) return null;
  const price = MODEL_PRICES_USD_PER_MILLION[model];
  if (!price) return null;
  return ((inputTokens ?? 0) * price.input + (outputTokens ?? 0) * price.output) / 1_000_000;
}

export function totalCostUsd(usage: ModelUsage[]): { costUsd: number; unpricedModels: string[] } {
  let costUsd = 0;
  const unpricedModels: string[] = [];
  for (const row of usage) {
    const cost = estimateCostUsd(row.model, Number(row.input_tokens), Number(row.output_tokens));
    if (cost === null) unpricedModels.push(row.model);
    else costUsd += cost;
  }
  return { costUsd, unpricedModels };
}

const USD = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return "< US$ 0,01";
  return `US$ ${USD.format(value)}`;
}
```

`Number(...)` em `totalCostUsd` porque o `bigint` do Postgres pode chegar como texto no JSON.

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter admin exec vitest run lib/agent-pricing.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 6: Commit**

```bash
git add apps/admin/lib/agent-pricing.ts apps/admin/lib/agent-pricing.test.ts
git commit -m "feat(admin): preços por modelo e custo estimado do agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lógica do painel (`agent-dashboard.ts`)

**Files:**
- Create: `apps/admin/lib/agent-dashboard.ts`
- Test: `apps/admin/lib/agent-dashboard.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const AGENT_CHANNEL = "mypetbrasil";
  export const LIVE_WINDOW_MS: number;       // 5 min
  export const AWAITING_WINDOW_MS: number;   // 60 s
  export const TERMINAL_EVENT_KINDS: readonly ["provider_error", "aborted", "empty_reply"];
  export type Period = "hoje" | "7d" | "30d";
  export type ModeFilter = "visitante" | "cliente" | null;
  export type DashboardFilters = { period: Period; mode: ModeFilter; onlyFailures: boolean };
  export function parseFilters(params: { periodo?: string; modo?: string; falhas?: string }): DashboardFilters;
  export function periodStart(period: Period, now: Date): Date;
  export type TurnStart = { conversation_id: string | null; detail: Record<string, unknown> | null; created_at: string };
  export type TurnUserMessage = { conversation_id: string; message_id: string; created_at: string };
  export type TurnTerminalEvent = { conversation_id: string | null; created_at: string };
  export function awaitingConversations(starts: TurnStart[], userMessages: TurnUserMessage[], terminals: TurnTerminalEvent[], now: Date): Set<string>;
  export type LiveBadge = "aguardando" | "conversando" | null;
  export function liveBadge(updatedAt: string, awaiting: boolean, now: Date): LiveBadge;
  export type StoredMessage = { id: string; message_id: string; role: "user" | "assistant"; content: string; parts: unknown; mode: string; created_at: string; provider: string | null; model: string | null; latency_ms: number | null; first_token_ms: number | null; input_tokens: number | null; output_tokens: number | null; steps: number | null };
  export type StoredEvent = { id: number; kind: string; detail: Record<string, unknown> | null; question: string | null; provider: string | null; latency_ms: number | null; created_at: string };
  export const MESSAGE_COLUMNS: string;
  export const EVENT_COLUMNS: string;
  export type TimelineItem = { type: "message"; at: string; message: StoredMessage } | { type: "event"; at: string; event: StoredEvent };
  export function buildTimeline(messages: StoredMessage[], events: StoredEvent[]): TimelineItem[];
  export type ToolPart = { type: string; input?: unknown; output?: unknown };
  export function toolParts(parts: unknown): ToolPart[];
  export function describeToolPart(part: ToolPart): string;
  export function eventLabel(event: StoredEvent): { text: string; tone: "error" | "warning" | "info" };
  export function whoLabel(empresa: string | null, buyerId: string | null): string;
  export function formatSeconds(ms: number | null): string | null;
  export function formatDateTime(iso: string): string;
  ```

- [ ] **Step 1: Escrever o teste que falha**

`apps/admin/lib/agent-dashboard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  awaitingConversations,
  buildTimeline,
  describeToolPart,
  eventLabel,
  formatDateTime,
  formatSeconds,
  liveBadge,
  parseFilters,
  periodStart,
  toolParts,
  whoLabel,
  type StoredEvent,
  type StoredMessage,
} from "./agent-dashboard";

const now = new Date("2026-10-17T15:00:00Z"); // 12:00 em São Paulo
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("parseFilters", () => {
  it("padrão: hoje, todos os modos, sem filtro de falha", () => {
    expect(parseFilters({})).toEqual({ period: "hoje", mode: null, onlyFailures: false });
  });
  it("lê valores válidos", () => {
    expect(parseFilters({ periodo: "7d", modo: "cliente", falhas: "1" })).toEqual({
      period: "7d",
      mode: "cliente",
      onlyFailures: true,
    });
  });
  it("valores inválidos caem no padrão", () => {
    expect(parseFilters({ periodo: "ontem", modo: "admin", falhas: "sim" })).toEqual({
      period: "hoje",
      mode: null,
      onlyFailures: false,
    });
  });
});

describe("periodStart", () => {
  it("hoje: 00:00 de São Paulo (03:00 UTC)", () => {
    expect(periodStart("hoje", now).toISOString()).toBe("2026-10-17T03:00:00.000Z");
  });
  it("hoje logo depois da meia-noite UTC ainda é o dia anterior em São Paulo", () => {
    expect(periodStart("hoje", new Date("2026-10-17T01:30:00Z")).toISOString()).toBe("2026-10-16T03:00:00.000Z");
  });
  it("7d e 30d: agora menos N dias", () => {
    expect(periodStart("7d", now).toISOString()).toBe("2026-10-10T15:00:00.000Z");
    expect(periodStart("30d", now).toISOString()).toBe("2026-09-17T15:00:00.000Z");
  });
});

describe("awaitingConversations", () => {
  const start = (conversation_id: string, message_id: string, msAgo: number) => ({
    conversation_id,
    detail: { message_id },
    created_at: ago(msAgo),
  });

  it("turno aberto há menos de 60 s → aguardando", () => {
    expect([...awaitingConversations([start("c1", "m1", 10_000)], [], [], now)]).toEqual(["c1"]);
  });
  it("fechado pela mensagem do usuário com o mesmo message_id", () => {
    const users = [{ conversation_id: "c1", message_id: "m1", created_at: ago(2_000) }];
    expect(awaitingConversations([start("c1", "m1", 10_000)], users, [], now).size).toBe(0);
  });
  it("mensagem do usuário com outro message_id não fecha", () => {
    const users = [{ conversation_id: "c1", message_id: "m0", created_at: ago(2_000) }];
    expect(awaitingConversations([start("c1", "m1", 10_000)], users, [], now).has("c1")).toBe(true);
  });
  it("fechado por evento terminal mais novo que o início", () => {
    const terminals = [{ conversation_id: "c1", created_at: ago(5_000) }];
    expect(awaitingConversations([start("c1", "m1", 10_000)], [], terminals, now).size).toBe(0);
  });
  it("evento terminal mais antigo que o início não fecha", () => {
    const terminals = [{ conversation_id: "c1", created_at: ago(20_000) }];
    expect(awaitingConversations([start("c1", "m1", 10_000)], [], terminals, now).has("c1")).toBe(true);
  });
  it("turn_started com mais de 60 s não conta", () => {
    expect(awaitingConversations([start("c1", "m1", 61_000)], [], [], now).size).toBe(0);
  });
  it("vale só o turno mais recente da conversa", () => {
    const users = [{ conversation_id: "c1", message_id: "m2", created_at: ago(1_000) }];
    const starts = [start("c1", "m1", 30_000), start("c1", "m2", 5_000)];
    expect(awaitingConversations(starts, users, [], now).size).toBe(0);
  });
  it("ignora turn_started sem conversa", () => {
    expect(awaitingConversations([{ conversation_id: null, detail: null, created_at: ago(1_000) }], [], [], now).size).toBe(0);
  });
});

describe("liveBadge", () => {
  it("aguardando tem precedência", () => {
    expect(liveBadge(ago(1_000), true, now)).toBe("aguardando");
  });
  it("conversando dentro de 5 minutos", () => {
    expect(liveBadge(ago(4 * 60_000), false, now)).toBe("conversando");
  });
  it("nada depois de 5 minutos", () => {
    expect(liveBadge(ago(6 * 60_000), false, now)).toBeNull();
  });
});

const message = (id: string, created_at: string, role: "user" | "assistant" = "user"): StoredMessage => ({
  id,
  message_id: id,
  role,
  content: "texto",
  parts: [],
  mode: "visitante",
  created_at,
  provider: null,
  model: null,
  latency_ms: null,
  first_token_ms: null,
  input_tokens: null,
  output_tokens: null,
  steps: null,
});
const event = (id: number, kind: string, created_at: string, detail: Record<string, unknown> = {}): StoredEvent => ({
  id,
  kind,
  detail,
  question: "Tem shampoo?",
  provider: null,
  latency_ms: null,
  created_at,
});

describe("buildTimeline", () => {
  it("ordena por horário, omite turn_started e mantém falhas", () => {
    const items = buildTimeline(
      [message("a", "2026-10-17T10:00:02Z", "assistant"), message("u", "2026-10-17T10:00:01Z")],
      [event(1, "turn_started", "2026-10-17T10:00:00Z"), event(2, "aborted", "2026-10-17T10:00:03Z")],
    );
    expect(items.map((i) => (i.type === "message" ? i.message.id : i.event.kind))).toEqual(["u", "a", "aborted"]);
  });
  it("empate de horário: mensagem antes do evento", () => {
    const items = buildTimeline([message("u", "2026-10-17T10:00:01Z")], [event(1, "quota_blocked", "2026-10-17T10:00:01Z")]);
    expect(items.map((i) => i.type)).toEqual(["message", "event"]);
  });
});

describe("toolParts e describeToolPart", () => {
  it("filtra só partes de ferramenta", () => {
    const parts = [{ type: "text", text: "Oi" }, { type: "tool-buscar_produtos", input: { query: "x" } }, null, "lixo"];
    expect(toolParts(parts).map((p) => p.type)).toEqual(["tool-buscar_produtos"]);
    expect(toolParts("não é lista")).toEqual([]);
  });
  it("buscar_produtos com total", () => {
    expect(
      describeToolPart({ type: "tool-buscar_produtos", input: { query: "shampoo" }, output: { total: 6, produtos: [] } }),
    ).toBe("Buscou produtos: 'shampoo' → 6 resultados");
  });
  it("buscar_produtos com 1 resultado e sem total usa produtos.length", () => {
    expect(
      describeToolPart({ type: "tool-buscar_produtos", input: { query: "ração" }, output: { produtos: [{}] } }),
    ).toBe("Buscou produtos: 'ração' → 1 resultado");
  });
  it("buscar_produtos sem saída", () => {
    expect(describeToolPart({ type: "tool-buscar_produtos", input: { query: "x" } })).toBe("Buscou produtos: 'x'");
  });
  it("ferramentas de pedido e desconhecida", () => {
    expect(describeToolPart({ type: "tool-alterar_pedido" })).toBe("Alterou o pedido");
    expect(describeToolPart({ type: "tool-sugerir_reposicao" })).toBe("Sugeriu reposição");
    expect(describeToolPart({ type: "tool-status_pedidos" })).toBe("Consultou pedidos");
    expect(describeToolPart({ type: "tool-outra_coisa" })).toBe("outra_coisa");
  });
});

describe("eventLabel", () => {
  it("falhas em vermelho", () => {
    expect(eventLabel(event(1, "provider_error", "x"))).toEqual({ text: "Erro do provedor", tone: "error" });
    expect(eventLabel(event(1, "aborted", "x"))).toEqual({ text: "Resposta interrompida", tone: "error" });
    expect(eventLabel(event(1, "empty_reply", "x"))).toEqual({ text: "Resposta vazia", tone: "error" });
  });
  it("troca de provedor e cota com detalhe", () => {
    expect(eventLabel({ ...event(1, "provider_fallback", "x", { failed_provider: "openai" }), provider: "google" })).toEqual({
      text: "Troca de provedor: openai falhou, google respondeu",
      tone: "warning",
    });
    expect(eventLabel(event(1, "quota_blocked", "x", { reason: "ip_burst" }))).toEqual({
      text: "Bloqueado pela cota (ip_burst)",
      tone: "warning",
    });
  });
  it("conversa proibida, duplicada e tipo desconhecido", () => {
    expect(eventLabel(event(1, "conversation_forbidden", "x")).tone).toBe("warning");
    expect(eventLabel(event(1, "duplicate_message", "x"))).toEqual({ text: "Mensagem duplicada recusada", tone: "info" });
    expect(eventLabel(event(1, "novo_tipo", "x"))).toEqual({ text: "novo_tipo", tone: "info" });
  });
});

describe("formatação", () => {
  it("whoLabel", () => {
    expect(whoLabel("Pet Shop X", "b1")).toBe("Pet Shop X");
    expect(whoLabel(null, "b1")).toBe("Cliente sem empresa");
    expect(whoLabel(null, null)).toBe("Visitante");
  });
  it("formatSeconds", () => {
    expect(formatSeconds(3429)).toBe("3,4 s");
    expect(formatSeconds(null)).toBeNull();
  });
  it("formatDateTime no horário de São Paulo", () => {
    expect(formatDateTime("2026-10-17T10:31:44Z")).toBe("17/10 07:31");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter admin exec vitest run lib/agent-dashboard.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-dashboard"`.

- [ ] **Step 3: Implementar**

`apps/admin/lib/agent-dashboard.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter admin exec vitest run lib/agent-dashboard.test.ts`
Expected: PASS (todos). Se `formatDateTime` falhar só pelo formato do Node (ex.: `"17/10, 07:31"` com caractere diferente), ajuste o `.replace` para produzir exatamente `"17/10 07:31"`, sem mudar o teste.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/agent-dashboard.ts apps/admin/lib/agent-dashboard.test.ts
git commit -m "feat(admin): lógica do painel do agente (filtros, selo ao vivo, linha do tempo)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Componente ao vivo (`live-refresh.tsx`)

**Files:**
- Create: `apps/admin/app/(dashboard)/agente/live-refresh.tsx`

**Interfaces:**
- Produces:
  ```tsx
  export function LiveRefresh(props: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    conversationId?: string;
    hasLive: boolean;
  }): JSX.Element | null;
  ```

O admin não tem ambiente de teste de componentes (jsdom); a verificação desta task é por tipos e, na Task 7, no navegador.

- [ ] **Step 1: Ler a documentação**

Ler `apps/admin/node_modules/next/dist/docs/01-app/` sobre `useRouter().refresh()` em Client Components (Next 16) e conferir em `apps/admin/node_modules/@supabase/ssr` a assinatura de `createBrowserClient(url, key)`.

- [ ] **Step 2: Implementar**

`apps/admin/app/(dashboard)/agente/live-refresh.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

// Mantém o painel do agente ao vivo: assina o Realtime das tabelas do agente
// com a sessão do admin (a RLS só entrega eventos a quem está em admin_users)
// e recarrega os dados do servidor. Aba oculta não recarrega: marca pendente e
// recarrega quando o usuário volta.

const REFRESH_DEBOUNCE_MS = 1_000;
const POLL_MS = 30_000;
const TABLES = ["agent_conversations", "agent_messages", "agent_events"] as const;

export function LiveRefresh({
  supabaseUrl,
  supabaseAnonKey,
  conversationId,
  hasLive,
}: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  conversationId?: string;
  hasLive: boolean;
}) {
  const router = useRouter();
  const [unavailable, setUnavailable] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refreshNow = () => {
      if (document.hidden) {
        pendingRef.current = true;
        return;
      }
      pendingRef.current = false;
      router.refresh();
    };
    const schedule = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (active) refreshNow();
      }, REFRESH_DEBOUNCE_MS);
    };
    const onVisibility = () => {
      if (!document.hidden && pendingRef.current) refreshNow();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    let channel = supabase.channel(conversationId ? `agente-conversa-${conversationId}` : "agente-lista");
    for (const table of TABLES) {
      const column = table === "agent_conversations" ? "id" : "conversation_id";
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(conversationId ? { filter: `${column}=eq.${conversationId}` } : {}),
        },
        schedule,
      );
    }
    channel.subscribe((status) => {
      if (!active) return;
      if (status === "SUBSCRIBED") setUnavailable(false);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("[agente] falha na assinatura do Realtime:", status);
        setUnavailable(true);
      }
    });

    return () => {
      active = false;
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [router, supabaseUrl, supabaseAnonKey, conversationId]);

  // Selos expiram com o tempo (5 min / 60 s) e o Realtime pode falhar: nesses
  // casos recarrega também em intervalo fixo.
  useEffect(() => {
    if (!hasLive && !unavailable) return;
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [hasLive, unavailable, router]);

  if (!unavailable) return null;
  return (
    <p className="mb-4 text-xs text-amber-700">
      Atualização ao vivo indisponível; a página recarrega a cada 30 segundos.
    </p>
  );
}
```

Se o TypeScript reclamar da sobrecarga de `channel.on("postgres_changes", ...)` por causa do objeto de filtro montado com spread, monte o objeto antes com o tipo `{ event: "*"; schema: string; table: string; filter?: string }` e passe a variável.

- [ ] **Step 3: Checar tipos**

Run: `pnpm --filter admin exec tsc --noEmit`
Expected: sem erros em `app/(dashboard)/agente/live-refresh.tsx`. Erros pré-existentes em outros arquivos, se houver, ficam registrados no relatório e não são corrigidos.

- [ ] **Step 4: Commit**

```bash
git add "apps/admin/app/(dashboard)/agente/live-refresh.tsx"
git commit -m "feat(admin): componente ao vivo do painel do agente (Realtime + recarga)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Lista `/agente` e item no menu

**Files:**
- Create: `apps/admin/app/(dashboard)/agente/page.tsx`
- Modify: `apps/admin/app/(dashboard)/layout.tsx` (array `NAV`)

**Interfaces:**
- Consumes:
  - de `@/lib/agent-dashboard`: `AGENT_CHANNEL`, `AWAITING_WINDOW_MS`, `LIVE_WINDOW_MS`, `TERMINAL_EVENT_KINDS`, `awaitingConversations`, `formatDateTime`, `formatSeconds`, `liveBadge`, `parseFilters`, `periodStart`, `whoLabel`, `TurnStart`, `TurnUserMessage`, `TurnTerminalEvent`, `LiveBadge`;
  - de `@/lib/agent-pricing`: `formatUsd`, `totalCostUsd`, `ModelUsage`;
  - `LiveRefresh` (Task 4); `requireAdminSession` de `@/lib/auth`;
  - view `v_agent_conversation_summary` e RPC `agent_dashboard_indicators` (Task 1).

- [ ] **Step 1: Ler a documentação**

Ler em `apps/admin/node_modules/next/dist/docs/01-app/` o guia de `searchParams` em Pages e de `cacheComponents`/`Suspense` (Next 16). Conferir o padrão em `apps/admin/app/(dashboard)/pedidos/page.tsx`.

- [ ] **Step 2: Implementar a página**

`apps/admin/app/(dashboard)/agente/page.tsx`:

```tsx
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
  const error = list.error ?? indicatorsResult.error;
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
```

- [ ] **Step 3: Item no menu**

Em `apps/admin/app/(dashboard)/layout.tsx`, no array `NAV`, inserir logo depois de `{ href: "/pedidos", label: "Pedidos" },`:

```ts
  { href: "/agente", label: "Conversas do agente" },
```

- [ ] **Step 4: Checar tipos e testes**

Run: `pnpm --filter admin exec tsc --noEmit`
Expected: sem erros em `app/(dashboard)/agente/page.tsx` e `app/(dashboard)/layout.tsx`.

Run: `pnpm --filter admin test`
Expected: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add "apps/admin/app/(dashboard)/agente/page.tsx" "apps/admin/app/(dashboard)/layout.tsx"
git commit -m "feat(admin): lista ao vivo das conversas do agente com indicadores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Conversa `/agente/[id]`

**Files:**
- Create: `apps/admin/app/(dashboard)/agente/[id]/page.tsx`

**Interfaces:**
- Consumes:
  - de `@/lib/agent-dashboard`: `AWAITING_WINDOW_MS` (indireto via `awaitingConversations`), `EVENT_COLUMNS`, `MESSAGE_COLUMNS`, `TERMINAL_EVENT_KINDS`, `awaitingConversations`, `buildTimeline`, `describeToolPart`, `eventLabel`, `formatDateTime`, `formatSeconds`, `toolParts`, `whoLabel`, `StoredEvent`, `StoredMessage`;
  - de `@/lib/agent-pricing`: `estimateCostUsd`, `formatUsd`;
  - de `@/lib/orders`: `ORDERS_SELECT`, `orderTotal`, `OrderRow`; `formatPrice` de `@mypet/core/catalog-utils`;
  - `LiveRefresh` (Task 4); `requireAdminSession`.

- [ ] **Step 1: Ler a documentação**

Ler em `apps/admin/node_modules/next/dist/docs/01-app/` o guia de rotas dinâmicas (`params` como `Promise`) e `notFound()` no Next 16. Conferir o padrão em `apps/admin/app/(dashboard)/balcao/[id]/page.tsx`.

- [ ] **Step 2: Implementar**

`apps/admin/app/(dashboard)/agente/[id]/page.tsx`:

```tsx
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
  const error = messagesResult.error ?? eventsResult.error;
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

      {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar mensagens: {error.message}</p>}

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
```

Confirme que `formatPrice` existe em `@mypet/core/catalog-utils` (é usado em `apps/admin/app/(dashboard)/pedidos/page.tsx`); se a assinatura for diferente de `(value: number) => string`, adapte a chamada.

- [ ] **Step 3: Checar tipos e testes**

Run: `pnpm --filter admin exec tsc --noEmit`
Expected: sem erros em `app/(dashboard)/agente/[id]/page.tsx`.

Run: `pnpm --filter admin test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/admin/app/(dashboard)/agente/[id]/page.tsx"
git commit -m "feat(admin): página da conversa do agente com linha do tempo, ferramentas e falhas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Aplicar, verificar e publicar

**Files:** nenhum arquivo novo.

- [ ] **Step 1: Aplicar a migration**

Pelo MCP do Supabase: `apply_migration` no projeto `hsguyfiyqpuligijcjlw`, nome `agent_dashboard`, com o conteúdo de `supabase/migrations/20261017130000_agent_dashboard.sql`.

- [ ] **Step 2: Verificar acesso**

Usuário `authenticated` fora de `admin_users` (uuid inexistente):

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
select
  (select count(*) from public.agent_conversations) as conversas,
  (select count(*) from public.agent_messages) as mensagens,
  (select count(*) from public.agent_events) as eventos,
  (select count(*) from public.v_agent_conversation_summary) as resumo,
  (select conversations from public.agent_dashboard_indicators('mypetbrasil', now() - interval '30 days', null)) as indicador;
rollback;
-- esperado: 0, 0, 0, 0, 0
```

Administrador (pegar um id real com `select id from public.admin_users limit 1;` e usar no `sub`):

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<id de admin_users>","role":"authenticated"}', true);
select
  (select count(*) from public.agent_conversations) as conversas,
  (select count(*) from public.v_agent_conversation_summary) as resumo,
  (select conversations from public.agent_dashboard_indicators('mypetbrasil', now() - interval '30 days', null)) as indicador;
rollback;
-- esperado: números iguais às contagens reais (maiores que 0)
```

Privilégios e Realtime:

```sql
select has_table_privilege('anon', 'public.agent_messages', 'select') as anon_msgs,
       has_table_privilege('anon', 'public.v_agent_conversation_summary', 'select') as anon_view,
       has_function_privilege('anon', 'public.agent_dashboard_indicators(text, timestamptz, text)', 'execute') as anon_fn,
       has_table_privilege('authenticated', 'public.agent_messages', 'insert') as auth_insert;
-- esperado: false, false, false, false

select tablename from pg_publication_tables
 where pubname = 'supabase_realtime' and tablename like 'agent_%' order by 1;
-- esperado: agent_conversations, agent_events, agent_messages
```

- [ ] **Step 3: Deploy**

Pedir confirmação ao usuário antes do `git push` (a Vercel publica a partir da `main`). Acompanhar o status do projeto `mypet-landing-admin` no GitHub (`gh api repos/fabioze86/mypet-landing/commits/<sha>/statuses`).

- [ ] **Step 4: Verificar no navegador**

Pedir ao usuário que abra `/agente` no admin, confira a lista e os indicadores, abra uma conversa, e faça uma pergunta no `/agente` do site com a lista aberta: a conversa deve subir para o topo com o selo "aguardando" e depois "ao vivo", sem recarregar a página. Registrar o resultado.
