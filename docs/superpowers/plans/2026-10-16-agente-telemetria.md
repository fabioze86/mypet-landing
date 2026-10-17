# Telemetria do agente /agente — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** registrar provedor, modelo, latência, tokens e passos de cada resposta do agente `/agente`, e gravar em `agent_events` todo turno que não vira resposta normal (com o texto da pergunta), mais um `turn_started` para o "aguardando resposta" ao vivo.

**Architecture:** colunas novas em `agent_messages` (linha `assistant`) e tabela nova `agent_events` no Supabase hub_catalogo. Um módulo `agent-events.ts` grava eventos sem nunca lançar erro. `agent-stream.ts` passa a informar quem respondeu e quem caiu; `ai-usage-limits.ts` expõe o motivo do bloqueio; `agent-server.ts` liga tudo.

**Tech Stack:** Next.js 16, AI SDK 7.0.19 (`streamText`, `toUIMessageStream`), Supabase (Postgres, `pg_cron`), Vitest 4, pnpm workspace (`@mypet/core`).

**Spec:** `docs/superpowers/specs/2026-10-16-agente-telemetria-design.md`

## Global Constraints

- A telemetria nunca muda o que o usuário recebe: status HTTP, códigos e mensagens de erro idênticos aos atuais.
- Falha ao gravar evento ou métrica: só `console.error` com prefixo `[agent-events]` (ou o já existente `[agent-conversations]`), nunca lança.
- Todo evento leva `question` = texto da pergunta (`messageText(message)`), inclusive `quota_blocked`.
- `detail.error` resumido: só a mensagem, no máximo 500 caracteres, sem stack.
- Retenção: job `pg_cron` diário às 03:00 UTC apaga `agent_events` com mais de 90 dias. Conversas e mensagens não têm prazo.
- `agent_events`: RLS ligado, `revoke all ... from anon, authenticated`. O signup do Supabase Auth está aberto; `authenticated` vale como "qualquer pessoa".
- Sem `after()` do Next: nos caminhos sem stream, o evento é gravado com `await` antes de devolver a resposta; nos caminhos com stream, as promessas são aguardadas no `onEnd`.
- Comentários e mensagens de log em português, no estilo dos arquivos `agent-*.ts`.
- A árvore de trabalho pode ter mudanças de outras tarefas: cada commit adiciona só os arquivos da task (`git add <arquivos>`; nunca `git add -A`).
- Comando de teste do pacote: `pnpm --filter @mypet/core exec vitest run <arquivo>` (rodar da raiz `C:\Projetos\mypet-landing`).

## Arquivos

| arquivo | ação | responsabilidade |
|---|---|---|
| `supabase/migrations/20261017120000_agent_telemetry.sql` | criar | colunas em `agent_messages`, tabela `agent_events`, job de retenção |
| `packages/core/src/agent-events.ts` | criar | tipos de evento, `summarizeError`, `buildEventRow`, `recordAgentEvent` |
| `packages/core/src/agent-events.test.ts` | criar | testes do módulo |
| `packages/core/src/agent-stream.ts` | modificar | devolver `{ stream, provider, index, failures }` |
| `packages/core/src/agent-stream.test.ts` | modificar | adaptar ao retorno novo + testes de `failures` |
| `packages/core/src/ai-usage-limits.ts` | modificar | `checkAiQuota` com `{ response, reason }` |
| `packages/core/src/ai-usage-limits.test.ts` | modificar | testes do motivo |
| `packages/core/src/agent-conversations.ts` | modificar | `saveTurn` aceita `metrics` |
| `packages/core/src/agent-conversations.test.ts` | modificar | teste de `metrics` |
| `packages/core/src/agent-server.ts` | modificar | capturar eventos e métricas |
| `packages/core/src/agent-server.test.ts` | modificar | mocks novos + um caso por evento |
| `docs/superpowers/specs/2026-10-16-agente-telemetria-design.md` | modificar | trocar `after()` pela regra de await; regra de `aborted` |

---

### Task 1: Migration de telemetria

**Files:**
- Create: `supabase/migrations/20261017120000_agent_telemetry.sql`

**Interfaces:**
- Produces: colunas `agent_messages.provider, model, latency_ms, first_token_ms, input_tokens, output_tokens, steps`; tabela `public.agent_events (id, created_at, conversation_id, channel, mode, buyer_id, ip_hash, kind, detail, question, provider, latency_ms)`; job `agent_events_retention`.

- [ ] **Step 1: Escrever a migration**

```sql
-- Telemetria do agente /agente (apps/mypet).
--
-- agent_messages ganha as métricas da resposta (só na linha 'assistant'):
-- quem respondeu, quanto demorou e quanto custou. agent_events guarda o que não
-- vira resposta normal (erro, aborto, resposta vazia, cota, conversa proibida,
-- duplicada, troca de provedor) e o turn_started, que o dashboard usa para
-- mostrar "aguardando resposta" ao vivo. Todos os eventos guardam o texto da
-- pergunta. Retenção: 90 dias para agent_events; mensagens sem prazo.
-- Acesso só pelo service role, como as demais tabelas do agente.

alter table public.agent_messages
  add column if not exists provider text,
  add column if not exists model text,
  add column if not exists latency_ms integer,
  add column if not exists first_token_ms integer,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists steps integer;

-- conversation_id e buyer_id sem FK: o evento pode ser de uma conversa que
-- nunca foi criada (cota) ou que não pertence a quem pediu (proibida).
create table if not exists public.agent_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  conversation_id uuid null,
  channel text not null,
  mode text null check (mode in ('visitante', 'cliente')),
  buyer_id uuid null,
  ip_hash text not null,
  kind text not null check (kind in (
    'turn_started', 'quota_blocked', 'conversation_forbidden', 'duplicate_message',
    'provider_fallback', 'provider_error', 'aborted', 'empty_reply'
  )),
  detail jsonb not null default '{}'::jsonb,
  question text null,
  provider text null,
  latency_ms integer null
);

create index if not exists agent_events_created
  on public.agent_events (created_at desc);
create index if not exists agent_events_kind_created
  on public.agent_events (kind, created_at desc);
create index if not exists agent_events_conversation
  on public.agent_events (conversation_id, created_at desc)
  where conversation_id is not null;

alter table public.agent_events enable row level security;
revoke all on table public.agent_events from anon, authenticated;

-- Retenção: cron.schedule com o mesmo nome substitui o job existente.
create extension if not exists pg_cron;

select cron.schedule(
  'agent_events_retention',
  '0 3 * * *',
  $cron$delete from public.agent_events where created_at < now() - interval '90 days'$cron$
);
```

- [ ] **Step 2: Conferir sintaxe sem aplicar**

A aplicação no banco é a Task 7 (depois do código revisado). Aqui só revisar: o arquivo começa com comentário, usa `if not exists` em tudo e o job tem nome fixo.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261017120000_agent_telemetry.sql
git commit -m "feat(agente): migration de telemetria (métricas em agent_messages, agent_events, retenção 90 dias)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Módulo `agent-events.ts`

**Files:**
- Create: `packages/core/src/agent-events.ts`
- Test: `packages/core/src/agent-events.test.ts`

**Interfaces:**
- Consumes: `AgentMode` de `./agent-prompt`; `fakeSupabase` de `./test-utils/fake-supabase` (testes).
- Produces:
  ```ts
  export type AgentEventKind = "turn_started" | "quota_blocked" | "conversation_forbidden" | "duplicate_message" | "provider_fallback" | "provider_error" | "aborted" | "empty_reply";
  export type AgentEventContext = { conversationId: string | null; channel: string; mode: AgentMode | null; buyerId: string | null; ipHash: string; question: string | null };
  export type AgentEvent = { kind: AgentEventKind; detail?: Record<string, unknown>; provider?: string | null; latencyMs?: number | null };
  export function summarizeError(error: unknown): string;
  export function buildEventRow(context: AgentEventContext, event: AgentEvent): Record<string, unknown>;
  export function recordAgentEvent(supabase: SupabaseClient | null, context: AgentEventContext, event: AgentEvent): Promise<void>;
  ```

- [ ] **Step 1: Escrever o teste que falha**

`packages/core/src/agent-events.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { fakeSupabase } from "./test-utils/fake-supabase";
import { buildEventRow, recordAgentEvent, summarizeError, type AgentEventContext } from "./agent-events";

vi.spyOn(console, "error").mockImplementation(() => {});

const context: AgentEventContext = {
  conversationId: "conv-1",
  channel: "mypetbrasil",
  mode: "visitante",
  buyerId: null,
  ipHash: "h",
  question: "Tem shampoo?",
};

describe("summarizeError", () => {
  it("usa a mensagem do Error, sem stack", () => {
    expect(summarizeError(new Error("provedor fora do ar"))).toBe("provedor fora do ar");
  });
  it("aceita string e objeto", () => {
    expect(summarizeError("429")).toBe("429");
    expect(summarizeError({ status: 500 })).toBe('{"status":500}');
  });
  it("aceita undefined", () => {
    expect(summarizeError(undefined)).toBe("undefined");
  });
  it("corta em 500 caracteres", () => {
    expect(summarizeError("x".repeat(800))).toHaveLength(500);
  });
});

describe("buildEventRow", () => {
  it("monta a linha com contexto e evento", () => {
    expect(
      buildEventRow(context, { kind: "provider_fallback", detail: { failed_provider: "openai" }, provider: "google", latencyMs: 120 }),
    ).toEqual({
      conversation_id: "conv-1",
      channel: "mypetbrasil",
      mode: "visitante",
      buyer_id: null,
      ip_hash: "h",
      kind: "provider_fallback",
      detail: { failed_provider: "openai" },
      question: "Tem shampoo?",
      provider: "google",
      latency_ms: 120,
    });
  });
  it("sem detail, provider e latência: valores padrão", () => {
    const row = buildEventRow(context, { kind: "aborted" });
    expect(row.detail).toEqual({});
    expect(row.provider).toBeNull();
    expect(row.latency_ms).toBeNull();
  });
});

describe("recordAgentEvent", () => {
  it("insere em agent_events", async () => {
    const { client, calls } = fakeSupabase({ agent_events: [{}] });
    await recordAgentEvent(client, context, { kind: "turn_started", detail: { message_id: "m1" } });
    expect(calls).toContainEqual({
      table: "agent_events",
      method: "insert",
      args: [buildEventRow(context, { kind: "turn_started", detail: { message_id: "m1" } })],
    });
  });
  it("erro do banco não lança", async () => {
    const { client } = fakeSupabase({ agent_events: [{ error: { message: "down" } }] });
    await expect(recordAgentEvent(client, context, { kind: "aborted" })).resolves.toBeUndefined();
  });
  it("cliente que lança não propaga o erro", async () => {
    const broken = { from: () => { throw new Error("sem cliente"); } } as never;
    await expect(recordAgentEvent(broken, context, { kind: "aborted" })).resolves.toBeUndefined();
  });
  it("sem cliente, não faz nada", async () => {
    await expect(recordAgentEvent(null, context, { kind: "aborted" })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-events.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-events"`.

- [ ] **Step 3: Implementar**

`packages/core/src/agent-events.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-events.test.ts`
Expected: PASS (11 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-events.ts packages/core/src/agent-events.test.ts
git commit -m "feat(agente): módulo de eventos do agente (agent_events)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `openStreamWithFallback` informa quem respondeu e quem caiu

**Files:**
- Modify: `packages/core/src/agent-stream.ts` (arquivo inteiro, 67 linhas)
- Test: `packages/core/src/agent-stream.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type StreamFailure = { provider: string; error: unknown };
  export type StreamOpenResult<T> =
    | { stream: ReadableStream<T>; provider: string; index: number; failures: StreamFailure[] }
    | { stream: null; failures: StreamFailure[] };
  export async function openStreamWithFallback<T extends { type: string }>(candidates: StreamCandidate<T>[]): Promise<StreamOpenResult<T>>;
  ```
  `failures` lista, em ordem, os provedores que falharam antes do primeiro conteúdo. Para `abort`, `error` é a string `"abortado (timeout ou cancelamento)"`.

- [ ] **Step 1: Adaptar os testes existentes e escrever os novos**

Em `packages/core/src/agent-stream.test.ts`, trocar cada `const stream = await openStreamWithFallback(...)` por `const { stream } = await openStreamWithFallback(...)` (9 ocorrências; `readAll(stream!)` e `expect(stream).toBeNull()` continuam iguais). Depois, dentro do `describe`, acrescentar:

```ts
  it("informa o provedor vencedor e o índice, sem falhas", async () => {
    const result = await openStreamWithFallback([{ provider: "openai", open: () => streamOf(ok) }]);
    expect(result.stream).not.toBeNull();
    expect(result).toMatchObject({ provider: "openai", index: 0, failures: [] });
  });

  it("lista os provedores que caíram antes do vencedor", async () => {
    const result = await openStreamWithFallback([
      {
        provider: "openai",
        open: () => {
          throw new Error("sem chave");
        },
      },
      { provider: "google-vertex", open: () => streamOf([{ type: "start" }, { type: "error", error: "429" }]) },
      { provider: "google", open: () => streamOf(ok) },
    ]);
    expect(result).toMatchObject({ provider: "google", index: 2 });
    expect(result.failures.map((f) => f.provider)).toEqual(["openai", "google-vertex"]);
    expect((result.failures[0].error as Error).message).toBe("sem chave");
    expect(result.failures[1].error).toBe("429");
  });

  it("todos falham: stream null e todas as falhas", async () => {
    const result = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf([{ type: "start" }, { type: "abort" }]) },
      { provider: "google", open: () => streamOf([{ type: "error", error: "y" }]) },
    ]);
    expect(result.stream).toBeNull();
    expect(result.failures).toEqual([
      { provider: "openai", error: "abortado (timeout ou cancelamento)" },
      { provider: "google", error: "y" },
    ]);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-stream.test.ts`
Expected: FAIL — os testes antigos quebram (`stream` é `undefined` na desestruturação) e os novos falham.

- [ ] **Step 3: Implementar**

Substituir `packages/core/src/agent-stream.ts` inteiro por:

```ts
// Com streaming, só dá para trocar de provedor enquanto nada foi enviado ao
// navegador. Este helper lê o começo do stream: se o provedor falhar antes da
// primeira parte de conteúdo, tenta o próximo; depois disso, segue com ele.
// Devolve também quem respondeu e quem caiu, para a telemetria do agente.

export type StreamCandidate<T> = { provider: string; open: () => ReadableStream<T> };

export type StreamFailure = { provider: string; error: unknown };

export type StreamOpenResult<T> =
  | { stream: ReadableStream<T>; provider: string; index: number; failures: StreamFailure[] }
  | { stream: null; failures: StreamFailure[] };

const PRELUDE_TYPES = new Set(["start", "start-step"]);
const ABORTED = "abortado (timeout ou cancelamento)";

export async function openStreamWithFallback<T extends { type: string }>(
  candidates: StreamCandidate<T>[],
): Promise<StreamOpenResult<T>> {
  const failures: StreamFailure[] = [];

  for (const [index, candidate] of candidates.entries()) {
    let reader: ReadableStreamDefaultReader<T>;
    try {
      reader = candidate.open().getReader();
    } catch (error) {
      console.error(`[agent-stream] provedor "${candidate.provider}" falhou ao abrir:`, error);
      failures.push({ provider: candidate.provider, error });
      continue;
    }

    const buffered: T[] = [];
    let failure: { error: unknown } | null = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value.type === "error" || value.type === "abort") {
          const error = value.type === "abort" ? ABORTED : (value as { error?: unknown }).error;
          console.error(`[agent-stream] provedor "${candidate.provider}" falhou antes de responder:`, error);
          failure = { error };
          break;
        }
        buffered.push(value);
        if (!PRELUDE_TYPES.has(value.type)) break;
      }
    } catch (error) {
      console.error(`[agent-stream] provedor "${candidate.provider}" falhou antes de responder:`, error);
      failure = { error };
    }

    if (failure) {
      failures.push({ provider: candidate.provider, error: failure.error });
      reader.cancel().catch(() => {});
      continue;
    }

    const stream = new ReadableStream<T>({
      start(controller) {
        for (const part of buffered) controller.enqueue(part);
      },
      async pull(controller) {
        try {
          const { value, done } = await reader.read();
          if (done) controller.close();
          else controller.enqueue(value);
        } catch (error) {
          controller.error(error);
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });
    return { stream, provider: candidate.provider, index, failures };
  }
  return { stream: null, failures };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-stream.test.ts`
Expected: PASS (12 testes).

`agent-server.ts` ainda usa o retorno antigo e vai quebrar a checagem de tipos; isso é corrigido na Task 6. Não rodar `tsc` do pacote aqui.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-stream.ts packages/core/src/agent-stream.test.ts
git commit -m "feat(agente): fallback de provedor informa vencedor e falhas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `checkAiQuota` expõe o motivo do bloqueio

**Files:**
- Modify: `packages/core/src/ai-usage-limits.ts:72-113` (função `consumeAiQuota`)
- Test: `packages/core/src/ai-usage-limits.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type QuotaBlockReason = "disabled" | "unavailable" | "ip_burst" | "ip_daily" | "global_daily";
  export type QuotaBlock = { response: Response; reason: QuotaBlockReason };
  export async function checkAiQuota(scope: AiScope, channel: string, headers: Headers, subjectKey?: string): Promise<QuotaBlock | null>;
  // consumeAiQuota: assinatura e comportamento inalterados.
  ```

- [ ] **Step 1: Escrever o teste que falha**

No `import` do topo de `packages/core/src/ai-usage-limits.test.ts`, incluir `checkAiQuota`:

```ts
import { checkAiQuota, consumeAiQuota, getAiLimits, hashClientIp } from "./ai-usage-limits";
```

E acrescentar no fim do arquivo:

```ts
describe("checkAiQuota", () => {
  it("liberado: null", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });
    expect(await checkAiQuota("duvidas", "mypetbrasil", headers())).toBeNull();
  });

  it.each(["ip_burst", "ip_daily", "global_daily"] as const)("limite %s: motivo e 429", async (limit) => {
    rpc.mockResolvedValue({ data: limit, error: null });
    const blocked = await checkAiQuota("duvidas", "mypetbrasil", headers());
    expect(blocked?.reason).toBe(limit);
    expect(blocked?.response.status).toBe(429);
  });

  it("resultado desconhecido conta como global_daily", async () => {
    rpc.mockResolvedValue({ data: "outra_coisa", error: null });
    expect((await checkAiQuota("duvidas", "mypetbrasil", headers()))?.reason).toBe("global_daily");
  });

  it("desligado por env: disabled e 503", async () => {
    vi.stubEnv("AI_ASSISTANTS_DISABLED", "true");
    const blocked = await checkAiQuota("duvidas", "mypetbrasil", headers());
    expect(blocked?.reason).toBe("disabled");
    expect(blocked?.response.status).toBe(503);
  });

  it("falha ao contar: unavailable e 503", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    const blocked = await checkAiQuota("duvidas", "mypetbrasil", headers());
    expect(blocked?.reason).toBe("unavailable");
    expect(blocked?.response.status).toBe(503);
  });

  it("consumeAiQuota devolve a mesma Response", async () => {
    rpc.mockResolvedValue({ data: "ip_daily", error: null });
    const res = await consumeAiQuota("duvidas", "mypetbrasil", headers());
    expect(res?.status).toBe(429);
    expect((await res!.json()).error.code).toBe("RATE_LIMITED");
  });
});
```

Se `vi.spyOn(console, ...)` ainda não silencia os logs nesse arquivo, ignore: os testes passam com logs.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/ai-usage-limits.test.ts`
Expected: FAIL — `checkAiQuota is not a function`.

- [ ] **Step 3: Implementar**

Em `packages/core/src/ai-usage-limits.ts`, substituir o bloco do comentário `/** Consome uma unidade da cota...` até o fim do arquivo por:

```ts
export type QuotaBlockReason = "disabled" | "unavailable" | "ip_burst" | "ip_daily" | "global_daily";
export type QuotaBlock = { response: Response; reason: QuotaBlockReason };

const LIMIT_REASONS = new Set<QuotaBlockReason>(["ip_burst", "ip_daily", "global_daily"]);

/**
 * Consome uma unidade da cota. Devolve null se pode seguir, ou o bloqueio com
 * a Response de erro pronta (429 limite, 503 desligado/indisponível) e o
 * motivo, para a telemetria. Falha fechada: sem conseguir contar, não chama a
 * IA. Com `subjectKey` (id do comprador), a cota individual é por comprador em
 * vez de por IP.
 */
export async function checkAiQuota(
  scope: AiScope,
  channel: string,
  headers: Headers,
  subjectKey?: string,
): Promise<QuotaBlock | null> {
  if (process.env.AI_ASSISTANTS_DISABLED === "true") {
    return { response: errorResponse(503, "AI_DISABLED", LIMIT_MESSAGES.global_daily), reason: "disabled" };
  }

  const limits = getAiLimits(scope);
  let result: string | null = null;
  try {
    const { data, error } = await getHubServiceClient().rpc("consume_ai_quota", {
      p_scope: scope,
      p_channel: channel,
      p_ip_hash: subjectKey ? shortHash(`buyer:${subjectKey}`) : hashClientIp(headers),
      p_ip_burst_max: limits.ipBurstMax,
      p_ip_burst_window_seconds: limits.ipBurstWindowSeconds,
      p_ip_daily_max: limits.ipDailyMax,
      p_global_daily_max: limits.globalDailyMax,
    });
    if (error) throw new Error(error.message);
    result = typeof data === "string" ? data : null;
  } catch (error) {
    console.error(`[ai-usage-limits] falha ao consumir cota (${scope}):`, error);
    return {
      response: errorResponse(503, "UNAVAILABLE", "Não foi possível responder agora. Tente novamente em instantes."),
      reason: "unavailable",
    };
  }

  if (result === "ok") return null;

  if (result === "global_daily") {
    console.warn(`[ai-usage-limits] teto diário global atingido (${scope}/${channel})`);
  }
  const reason: QuotaBlockReason = LIMIT_REASONS.has(result as QuotaBlockReason)
    ? (result as QuotaBlockReason)
    : "global_daily";
  const message = LIMIT_MESSAGES[result ?? ""] ?? LIMIT_MESSAGES.global_daily;
  const retryAfter = result === "ip_burst" ? String(limits.ipBurstWindowSeconds) : "3600";
  return { response: errorResponse(429, "RATE_LIMITED", message, { "Retry-After": retryAfter }), reason };
}

/** Como checkAiQuota, mas devolve só a Response de erro (ou null). */
export async function consumeAiQuota(
  scope: AiScope,
  channel: string,
  headers: Headers,
  subjectKey?: string,
): Promise<Response | null> {
  return (await checkAiQuota(scope, channel, headers, subjectKey))?.response ?? null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/ai-usage-limits.test.ts`
Expected: PASS (testes antigos inalterados + 8 novos).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ai-usage-limits.ts packages/core/src/ai-usage-limits.test.ts
git commit -m "feat(ai): checkAiQuota expõe o motivo do bloqueio da cota

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `saveTurn` grava métricas na linha `assistant`

**Files:**
- Modify: `packages/core/src/agent-conversations.ts:132-149`
- Test: `packages/core/src/agent-conversations.test.ts` (dentro de `describe("saveTurn")`)

**Interfaces:**
- Produces:
  ```ts
  export type TurnMetrics = {
    provider: string;
    model: string | null;
    latencyMs: number;
    firstTokenMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    steps: number | null;
  };
  // saveTurn(supabase, { conversationId, mode, messages, metrics?: TurnMetrics })
  ```

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar dentro de `describe("saveTurn", ...)`, depois do teste "pergunta do usuário não sobrescreve...":

```ts
  it("métricas vão só na linha do assistente", async () => {
    const { client, calls } = fakeSupabase({ agent_messages: [{}, {}], agent_conversations: [{}] });
    await saveTurn(client, {
      conversationId: "conv-1",
      mode: "cliente",
      messages: [user, reply],
      metrics: {
        provider: "openai",
        model: "gpt-x",
        latencyMs: 1200,
        firstTokenMs: 300,
        inputTokens: 500,
        outputTokens: 80,
        steps: 2,
      },
    });
    const [userRows, replyRows] = calls
      .filter((c) => c.method === "upsert")
      .map((c) => c.args[0] as Record<string, unknown>[]);
    expect(userRows[0]).not.toHaveProperty("provider");
    expect(replyRows[0]).toMatchObject({
      provider: "openai",
      model: "gpt-x",
      latency_ms: 1200,
      first_token_ms: 300,
      input_tokens: 500,
      output_tokens: 80,
      steps: 2,
    });
  });

  it("sem métricas, a linha do assistente não ganha colunas novas", async () => {
    const { client, calls } = fakeSupabase({ agent_messages: [{}, {}], agent_conversations: [{}] });
    await saveTurn(client, { conversationId: "conv-1", mode: "cliente", messages: [user, reply] });
    const replyRows = calls.filter((c) => c.method === "upsert")[1].args[0] as Record<string, unknown>[];
    expect(replyRows[0]).not.toHaveProperty("provider");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-conversations.test.ts`
Expected: FAIL no teste "métricas vão só na linha do assistente" (`provider` ausente).

- [ ] **Step 3: Implementar**

Em `packages/core/src/agent-conversations.ts`, logo antes de `export async function saveTurn`, acrescentar:

```ts
export type TurnMetrics = {
  provider: string;
  model: string | null;
  latencyMs: number;
  firstTokenMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  steps: number | null;
};

function metricColumns(metrics: TurnMetrics) {
  return {
    provider: metrics.provider,
    model: metrics.model,
    latency_ms: metrics.latencyMs,
    first_token_ms: metrics.firstTokenMs,
    input_tokens: metrics.inputTokens,
    output_tokens: metrics.outputTokens,
    steps: metrics.steps,
  };
}
```

Trocar a assinatura e o `.map` de `saveTurn`:

```ts
export async function saveTurn(
  supabase: SupabaseClient,
  input: { conversationId: string; mode: AgentMode; messages: UIMessage[]; metrics?: TurnMetrics },
): Promise<void> {
  const base = Date.now();
  // Horários explícitos e crescentes: no mesmo insert o default now() empataria
  // e a ordem do histórico ficaria ambígua.
  const rows = input.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message, index) => ({
      conversation_id: input.conversationId,
      message_id: message.id,
      role: message.role,
      content: messageText(message),
      parts: message.parts,
      mode: input.mode,
      created_at: new Date(base + index).toISOString(),
      // Métricas da resposta: só na linha do assistente.
      ...(message.role === "assistant" && input.metrics ? metricColumns(input.metrics) : {}),
    }));
```

O resto da função fica igual.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-conversations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-conversations.ts packages/core/src/agent-conversations.test.ts
git commit -m "feat(agente): saveTurn grava métricas da resposta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Ligar a telemetria no `agent-server.ts`

**Files:**
- Modify: `packages/core/src/agent-server.ts` (handler inteiro, linhas 1-190)
- Modify: `packages/core/src/agent-server.test.ts`
- Modify: `docs/superpowers/specs/2026-10-16-agente-telemetria-design.md`

**Interfaces:**
- Consumes: `recordAgentEvent`, `summarizeError`, `AgentEvent`, `AgentEventContext` (Task 2); `openStreamWithFallback` → `StreamOpenResult` (Task 3); `checkAiQuota` → `QuotaBlock` (Task 4); `saveTurn` com `metrics: TurnMetrics`, e `messageText` (Task 5 / já existente).
- Produces: `export function failedTurnEvent(input: { isAborted: boolean; finishReason?: string }): AgentEvent` — regra: `isAborted` ou `finishReason` ausente → `aborted` (o AI SDK chama `onEnd` sem `finishReason` quando o navegador desconecta); `"error"` → `provider_error` com `detail.finish_reason`; qualquer outro → `empty_reply` com `detail.finish_reason`.

- [ ] **Step 1: Ajustar os mocks e testes existentes**

Em `packages/core/src/agent-server.test.ts`:

1. Trocar o mock de `./ai-usage-limits`:

```ts
vi.mock("./ai-usage-limits", () => ({ checkAiQuota: vi.fn(async () => null), hashClientIp: () => "iphash" }));
```

2. Acrescentar o mock de eventos, logo abaixo dos outros `vi.mock`:

```ts
// Eventos: summarizeError real, gravação registrada.
vi.mock("./agent-events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./agent-events")>();
  return { ...actual, recordAgentEvent: vi.fn(async () => {}) };
});
```

3. Trocar os imports:

```ts
import { checkAiQuota } from "./ai-usage-limits";
import { recordAgentEvent } from "./agent-events";
import { createAgentHandler, failedTurnEvent, shouldSaveTurn, type AgentBuyer } from "./agent-server";
```

(remover o import de `consumeAiQuota`).

4. Substituir `consumeAiQuota` por `checkAiQuota` nos testes "falha ao identificar comprador...", "cota: visitante por IP...", "400 para corpo inválido..." (as asserções `toHaveBeenCalledWith` / `toHaveBeenLastCalledWith` / `not.toHaveBeenCalled` ficam iguais, só muda o nome).

5. No teste "cota estourada: não chama a IA", trocar o `mockResolvedValueOnce` por:

```ts
    (checkAiQuota as Mock).mockResolvedValueOnce({
      response: Response.json({ ok: false, error: { code: "RATE_LIMITED", message: "Aguarde." } }, { status: 429 }),
      reason: "ip_burst",
    });
```

6. Acrescentar, depois de `useModels`, o helper:

```ts
// Eventos gravados: [contexto, evento] de cada chamada a recordAgentEvent.
function recorded() {
  return (recordAgentEvent as Mock).mock.calls.map(([, context, event]) => ({ context, event }));
}
const kinds = () => recorded().map((r) => r.event.kind);
```

- [ ] **Step 2: Escrever os testes novos**

Acrescentar no fim do arquivo:

```ts
describe("telemetria", () => {
  it("caso feliz: turn_started com a pergunta e métricas na resposta", async () => {
    useModels(textModel("Oi."));
    await (await handler()(makeRequest(validBody))).text();
    await vi.waitFor(() => expect(saveTurn).toHaveBeenCalled());

    expect(kinds()).toEqual(["turn_started"]);
    const [{ context, event }] = recorded();
    expect(event.detail).toEqual({ message_id: "m1" });
    expect(context).toEqual({
      conversationId,
      channel: "mypetbrasil",
      mode: "visitante",
      buyerId: null,
      ipHash: "iphash",
      question: "Tem shampoo?",
    });

    const [, saved] = (saveTurn as Mock).mock.calls[0];
    expect(saved.metrics).toMatchObject({
      provider: "openai",
      model: "mock-model-id",
      inputTokens: 1,
      outputTokens: 1,
      steps: 1,
    });
    expect(saved.metrics.latencyMs).toBeGreaterThanOrEqual(0);
    expect(saved.metrics.firstTokenMs).toBeGreaterThanOrEqual(0);
  });

  it("com ferramenta: soma tokens e conta os passos", async () => {
    useModels(searchThenTextModel("Encontrei."));
    await (await handler()(makeRequest(validBody))).text();
    await vi.waitFor(() => expect(saveTurn).toHaveBeenCalled());
    const [, saved] = (saveTurn as Mock).mock.calls[0];
    expect(saved.metrics).toMatchObject({ inputTokens: 2, outputTokens: 2, steps: 2 });
  });

  it("cota negada: quota_blocked com motivo e pergunta, sem turn_started", async () => {
    useModels(textModel("Oi."));
    (checkAiQuota as Mock).mockResolvedValueOnce({
      response: Response.json({ ok: false, error: { code: "RATE_LIMITED", message: "Aguarde." } }, { status: 429 }),
      reason: "ip_daily",
    });
    const res = await handler()(makeRequest(validBody));
    expect(res.status).toBe(429);
    expect(recorded()).toEqual([
      {
        context: expect.objectContaining({ question: "Tem shampoo?", conversationId }),
        event: { kind: "quota_blocked", detail: { reason: "ip_daily" } },
      },
    ]);
  });

  it("conversa proibida: conversation_forbidden", async () => {
    useModels(textModel("Oi."));
    (ensureConversation as Mock).mockResolvedValueOnce("forbidden");
    const res = await handler({ id: "b2", empresa: null })(makeRequest(validBody));
    expect(res.status).toBe(403);
    expect(kinds()).toEqual(["conversation_forbidden"]);
    expect(recorded()[0].context).toMatchObject({ buyerId: "b2", mode: "cliente" });
  });

  it("mensagem duplicada: duplicate_message", async () => {
    useModels(textModel("Oi."));
    (loadHistory as Mock).mockResolvedValueOnce([
      { id: "m1", role: "user", parts: [{ type: "text", text: "Tem shampoo?" }] },
    ]);
    const res = await handler()(makeRequest(validBody));
    expect(res.status).toBe(409);
    expect(recorded().map((r) => r.event)).toEqual([{ kind: "duplicate_message", detail: { message_id: "m1" } }]);
  });

  it("troca de provedor: provider_fallback e métricas do vencedor", async () => {
    useModels(failingModel(), textModel("Resposta do Gemini."));
    await (await handler()(makeRequest(validBody))).text();
    await vi.waitFor(() => expect(saveTurn).toHaveBeenCalled());

    expect(kinds()).toEqual(["turn_started", "provider_fallback"]);
    expect(recorded()[1].event).toEqual({
      kind: "provider_fallback",
      provider: "google",
      detail: { failed_provider: "openai", error: "provedor fora do ar" },
    });
    expect((saveTurn as Mock).mock.calls[0][1].metrics.provider).toBe("google");
  });

  it("todos os provedores falham: provider_error com as falhas", async () => {
    useModels(failingModel(), failingModel());
    const res = await handler()(makeRequest(validBody));
    expect(res.status).toBe(502);
    expect(kinds()).toEqual(["turn_started", "provider_error"]);
    expect(recorded()[1].event.detail).toEqual({
      failures: [
        { provider: "openai", error: "provedor fora do ar" },
        { provider: "google", error: "provedor fora do ar" },
      ],
    });
  });

  it("configuração inválida do provedor: provider_error", async () => {
    (getAssistantModelChain as Mock).mockImplementationOnce(() => {
      throw new Error('AI_PROVIDER desconhecido: "x"');
    });
    const res = await handler()(makeRequest(validBody));
    expect(res.status).toBe(502);
    expect(recorded().map((r) => r.event)).toEqual([
      { kind: "provider_error", detail: { failures: [{ provider: "config", error: 'AI_PROVIDER desconhecido: "x"' }] } },
    ]);
  });

  it("resposta vazia: empty_reply", async () => {
    useModels(
      new MockLanguageModelV4({
        doStream: async () => ({ stream: simulateReadableStream({ chunks: [finish("stop")] }) }),
      }),
    );
    await (await handler()(makeRequest(validBody))).text();
    await vi.waitFor(() => expect(kinds()).toContain("empty_reply"));
    expect(recorded().find((r) => r.event.kind === "empty_reply")!.event).toMatchObject({
      detail: { finish_reason: "stop" },
      provider: "openai",
    });
  });

  it("erro no meio do stream: provider_error com finish_reason", async () => {
    useModels(
      new MockLanguageModelV4({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: "text-start" as const, id: "t1" },
              { type: "text-delta" as const, id: "t1", delta: "Parcial" },
              { type: "error" as const, error: new Error("caiu") },
            ],
          }),
        }),
      }),
    );
    await (await handler()(makeRequest(validBody))).text();
    await vi.waitFor(() => expect(kinds()).toContain("provider_error"));
    expect(recorded().find((r) => r.event.kind === "provider_error")!.event.detail).toEqual({ finish_reason: "error" });
  });

  it("desconexão no meio da resposta: aborted", async () => {
    useModels(
      new MockLanguageModelV4({
        doStream: async () => ({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "text-start", id: "t1" });
              controller.enqueue({ type: "text-delta", id: "t1", delta: "Parcial" });
            },
          }),
        }),
      }),
    );
    const res = await handler()(makeRequest(validBody));
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    await vi.waitFor(() => expect(kinds()).toContain("aborted"));
  });

  it("falha ao gravar evento não muda a resposta", async () => {
    useModels(textModel("Oi."));
    (recordAgentEvent as Mock).mockRejectedValueOnce(new Error("não deveria acontecer"));
    const res = await handler()(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Oi.");
  });
});

describe("failedTurnEvent", () => {
  it("abortado ou sem finishReason → aborted", () => {
    expect(failedTurnEvent({ isAborted: true, finishReason: "stop" })).toEqual({ kind: "aborted" });
    expect(failedTurnEvent({ isAborted: false, finishReason: undefined })).toEqual({ kind: "aborted" });
  });
  it("error → provider_error", () => {
    expect(failedTurnEvent({ isAborted: false, finishReason: "error" })).toEqual({
      kind: "provider_error",
      detail: { finish_reason: "error" },
    });
  });
  it("outro → empty_reply", () => {
    expect(failedTurnEvent({ isAborted: false, finishReason: "stop" })).toEqual({
      kind: "empty_reply",
      detail: { finish_reason: "stop" },
    });
  });
});
```

Observação sobre "falha ao gravar evento não muda a resposta": `recordAgentEvent` real nunca rejeita; o teste força a rejeição para provar que o handler também não depende disso. Por isso o handler usa `safely()` (abaixo) em toda gravação de evento.

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-server.test.ts`
Expected: FAIL — `failedTurnEvent` não exportado, `checkAiQuota` não usado pelo handler, nenhum evento gravado.

- [ ] **Step 4: Implementar**

Substituir `packages/core/src/agent-server.ts` inteiro por:

```ts
import type { NextRequest } from "next/server";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type LanguageModel,
  type LanguageModelUsage,
  type ToolSet,
  type UIMessage,
} from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAssistantModelChain } from "./ai-provider";
import { checkAiQuota, hashClientIp } from "./ai-usage-limits";
import { buildCatalogTool } from "./agent-catalog-tool";
import { buildCustomerTools } from "./agent-customer-tools";
import {
  ensureConversation,
  loadHistory,
  messageText,
  saveTurn,
  type ConversationAccess,
} from "./agent-conversations";
import { recordAgentEvent, summarizeError, type AgentEvent, type AgentEventContext } from "./agent-events";
import { buildAgentInstructions, type AgentFaqItem, type AgentMode } from "./agent-prompt";
import { parseAgentRequest } from "./agent-request";
import { openStreamWithFallback } from "./agent-stream";
import { getArtigosAjudaPublicados } from "./help-center";
import { rejectForeignRequest } from "./request-guards";
import { getHubServiceClient } from "./supabase";

// Agente /agente: um agente com dois modos. O modo vem só do cookie (via
// resolveBuyer); o histórico vem do banco; o navegador manda só a pergunta nova.
// Telemetria: métricas da resposta em agent_messages e o resto em agent_events
// (agent-events.ts). Nada disso muda o que o usuário recebe.

export type AgentBuyer = { id: string; empresa: string | null };

export type AgentConfig = {
  channel: string;
  siteName: string;
  faq: readonly AgentFaqItem[];
  resolveBuyer: (req: NextRequest) => Promise<AgentBuyer | null>;
};

const AGENT_TIMEOUT = { totalMs: 45_000, chunkMs: 15_000 };
const MAX_STEPS = 5;
const MAX_REPLY_TOKENS = 600;
// Quanto esperar pelo uso de tokens no fim da resposta antes de gravar sem ele.
const USAGE_WAIT_MS = 2_000;
const UNAVAILABLE_MESSAGE = "Não foi possível responder agora. Tente novamente em instantes.";

// Só o necessário do resultado do streamText. Os getters são preguiçosos: ler
// totalUsage de um provedor que falhou criaria uma promessa rejeitada sem dono.
type UsageSource = { totalUsage: PromiseLike<LanguageModelUsage>; steps: PromiseLike<unknown[]> };

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

async function safeResolveBuyer(config: AgentConfig, req: NextRequest): Promise<AgentBuyer | null> {
  try {
    return await config.resolveBuyer(req);
  } catch (error) {
    console.error("[agent] falha ao identificar comprador:", error);
    return null;
  }
}

async function validateHistory(messages: UIMessage[], tools: ToolSet): Promise<UIMessage[]> {
  try {
    return await validateUIMessages({ messages, tools: tools as Parameters<typeof validateUIMessages>[0]["tools"] });
  } catch (error) {
    console.error("[agent] histórico inválido, seguindo só com a pergunta atual:", error);
    return messages.slice(-1);
  }
}

// Valor de uma promessa com limite de tempo; null se não vier a tempo ou falhar.
async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function modelIdOf(model: LanguageModel): string | null {
  return typeof model === "string" ? model : (model as { modelId?: string }).modelId ?? null;
}

// Só grava o turno quando a resposta terminou bem e tem texto: respostas
// abortadas, com erro ou vazias deixariam no histórico uma mensagem inválida.
export function shouldSaveTurn({
  isAborted,
  finishReason,
  responseMessage,
}: {
  isAborted: boolean;
  finishReason?: string;
  responseMessage: UIMessage;
}): boolean {
  if (isAborted || finishReason == null || finishReason === "error") return false;
  return responseMessage.parts.some((part) => part.type === "text" && part.text.trim().length > 0);
}

// Evento de um turno que não foi gravado. Sem finishReason é desconexão: o AI
// SDK chama onEnd pelo cancel do stream, sem a parte "abort".
export function failedTurnEvent({ isAborted, finishReason }: { isAborted: boolean; finishReason?: string }): AgentEvent {
  if (isAborted || finishReason == null) return { kind: "aborted" };
  if (finishReason === "error") return { kind: "provider_error", detail: { finish_reason: finishReason } };
  return { kind: "empty_reply", detail: { finish_reason: finishReason } };
}

export function createAgentHandler(config: AgentConfig) {
  return async function POST(req: NextRequest): Promise<Response> {
    const t0 = Date.now();
    const foreign = rejectForeignRequest(req);
    if (foreign) return foreign;

    const parsed = parseAgentRequest(await req.json().catch(() => null));
    if (!parsed.ok) return errorResponse(400, "INVALID_INPUT", parsed.message);
    const { id, message, cart } = parsed.value;

    const buyer = await safeResolveBuyer(config, req);
    const mode: AgentMode = buyer ? "cliente" : "visitante";
    const ipHash = hashClientIp(req.headers);

    let supabase: SupabaseClient | null = null;
    try {
      supabase = getHubServiceClient();
    } catch (error) {
      console.error("[agent] Supabase indisponível:", error);
    }

    const eventContext: AgentEventContext = {
      conversationId: id,
      channel: config.channel,
      mode,
      buyerId: buyer?.id ?? null,
      ipHash,
      question: messageText(message),
    };
    // recordAgentEvent já não lança; o catch aqui garante que nenhuma falha de
    // telemetria chegue à resposta.
    const logEvent = (event: AgentEvent): Promise<void> =>
      recordAgentEvent(supabase, eventContext, event).catch((error) => {
        console.error("[agent-events] falha inesperada:", error);
      });

    const blocked = buyer
      ? await checkAiQuota("agente_cliente", config.channel, req.headers, buyer.id)
      : await checkAiQuota("duvidas", config.channel, req.headers);
    if (blocked) {
      await logEvent({ kind: "quota_blocked", detail: { reason: blocked.reason } });
      return blocked.response;
    }

    const access: ConversationAccess = supabase
      ? await ensureConversation(supabase, { id, channel: config.channel, buyerId: buyer?.id ?? null, ipHash, mode })
      : "unavailable";
    if (access === "forbidden") {
      await logEvent({ kind: "conversation_forbidden" });
      return errorResponse(403, "CONVERSATION_FORBIDDEN", "Esta conversa não está disponível. Comece uma nova.");
    }
    const store = access === "ok" ? supabase : null;

    const catalogTool = buildCatalogTool({ channel: config.channel, showPrices: mode === "cliente" });
    // Visitante não recebe as ferramentas de pedido; o comprador delas é o do cookie.
    const tools: ToolSet = buyer
      ? { buscar_produtos: catalogTool, ...buildCustomerTools({ channel: config.channel, buyerId: buyer.id }) }
      : { buscar_produtos: catalogTool };
    const history = store
      ? await loadHistory(store, id, mode === "visitante" ? { onlyMode: "visitante" } : {})
      : [];
    // Cada envio do navegador usa um id novo; id repetido (reenvio ou id de uma
    // resposta) deixaria o histórico inconsistente.
    if (history.some((item) => item.id === message.id)) {
      await logEvent({ kind: "duplicate_message", detail: { message_id: message.id } });
      return errorResponse(409, "MESSAGE_DUPLICATE", "Esta mensagem já foi enviada. Comece uma nova conversa.");
    }
    const messages = await validateHistory([...history, message], tools);

    let instructions: string;
    let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
    let chain: ReturnType<typeof getAssistantModelChain>;
    try {
      const artigos = await getArtigosAjudaPublicados();
      instructions = buildAgentInstructions({
        siteName: config.siteName,
        mode,
        empresa: buyer?.empresa ?? null,
        cart: mode === "cliente" ? cart : [],
        faq: config.faq,
        artigos,
      });
      modelMessages = await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true });
      chain = getAssistantModelChain();
    } catch (error) {
      console.error("[agent] falha ao preparar a chamada ao modelo:", error);
      await logEvent({
        kind: "provider_error",
        detail: { failures: [{ provider: "config", error: summarizeError(error) }] },
      });
      return errorResponse(502, "AI_PROVIDER_ERROR", UNAVAILABLE_MESSAGE);
    }

    // Sem await: o "aguardando resposta" do dashboard precisa do evento já no
    // envio. As gravações pendentes são aguardadas no fim (onEnd ou 502), para
    // a função não terminar com o insert no meio.
    const pending: Promise<void>[] = [logEvent({ kind: "turn_started", detail: { message_id: message.id } })];

    const results: UsageSource[] = [];
    const opened = await openStreamWithFallback(
      chain.map((candidate, index) => ({
        provider: candidate.provider,
        open: () => {
          const result = streamText({
            model: candidate.model,
            instructions,
            messages: modelMessages,
            tools,
            stopWhen: isStepCount(MAX_STEPS),
            maxOutputTokens: MAX_REPLY_TOKENS,
            maxRetries: 1,
            // chunkMs: provedor que para de mandar trechos aborta e, antes do
            // primeiro conteúdo, cai no próximo provedor (agent-stream.ts).
            timeout: AGENT_TIMEOUT,
            // Cliente desconectou: para a chamada ao provedor.
            abortSignal: req.signal,
            // As conversas ficam no Supabase; nada guardado do lado da OpenAI.
            providerOptions: { openai: { store: false } },
            onError: ({ error }) => console.error(`[agent] erro no provedor "${candidate.provider}":`, error),
          });
          results[index] = result;
          return result.stream;
        },
      })),
    );
    const firstTokenMs = Date.now() - t0;
    const failures = opened.failures.map((failure) => ({
      provider: failure.provider,
      error: summarizeError(failure.error),
    }));

    if (!opened.stream) {
      pending.push(logEvent({ kind: "provider_error", detail: { failures } }));
      await Promise.all(pending);
      return errorResponse(502, "AI_PROVIDER_ERROR", UNAVAILABLE_MESSAGE);
    }

    const winner = chain[opened.index];
    for (const failure of failures) {
      pending.push(
        logEvent({
          kind: "provider_fallback",
          provider: winner.provider,
          detail: { failed_provider: failure.provider, error: failure.error },
        }),
      );
    }

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: opened.stream,
        tools,
        originalMessages: messages,
        generateMessageId: () => crypto.randomUUID(),
        onError: () => UNAVAILABLE_MESSAGE,
        onEnd: async ({ isAborted, finishReason, responseMessage }) => {
          const latencyMs = Date.now() - t0;
          if (!shouldSaveTurn({ isAborted, finishReason, responseMessage })) {
            pending.push(logEvent({ ...failedTurnEvent({ isAborted, finishReason }), provider: winner.provider, latencyMs }));
          } else if (store) {
            const source = results[opened.index];
            const [usage, steps] = await Promise.all([
              withTimeout(source.totalUsage, USAGE_WAIT_MS),
              withTimeout(source.steps, USAGE_WAIT_MS),
            ]);
            await saveTurn(store, {
              conversationId: id,
              mode,
              messages: [message, responseMessage],
              metrics: {
                provider: winner.provider,
                model: modelIdOf(winner.model),
                latencyMs,
                firstTokenMs,
                inputTokens: usage?.inputTokens ?? null,
                outputTokens: usage?.outputTokens ?? null,
                steps: steps?.length ?? null,
              },
            });
          }
          await Promise.all(pending);
        },
      }),
    });
  };
}
```

Pontos de atenção para quem implementa:
- `results[index] = result` guarda o objeto do `streamText` sem ler `totalUsage`/`steps`. Ler esses getters de um provedor que falhou cria uma promessa rejeitada sem `catch`, e o Vitest falha com "Unhandled Rejection".
- Se o TypeScript reclamar ao atribuir `result` a `UsageSource` (por causa dos genéricos de `steps`), tipar como `results[index] = result as unknown as UsageSource`.
- O teste "banco indisponível" continua válido: `ensureConversation` devolve `"unavailable"`, então `store` é `null` e nada é gravado em `agent_messages`. Os eventos ainda tentam o cliente de serviço, que é o comportamento desejado.

- [ ] **Step 5: Rodar os testes do servidor**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-server.test.ts`
Expected: PASS (todos os antigos + 13 de `telemetria` + 3 de `failedTurnEvent`).

Se o teste "desconexão no meio da resposta: aborted" falhar por `onEnd` não ser chamado, conferir se o `cancel` do `TransformStream` do AI SDK (`node_modules/.pnpm/ai@7.0.19_zod@4.4.3/node_modules/ai/dist/index.js`, função de `toUIMessageStream`, `async cancel() { await callOnEnd(); }`) é alcançado pelo `reader.cancel()` através de `createUIMessageStreamResponse`. Não mudar o comportamento de produção para fazer o teste passar; se o `onEnd` não roda no cancelamento, registrar isso na especificação (o dashboard cobre pelo limite de 60 s) e remover o teste.

- [ ] **Step 6: Rodar a suíte inteira do pacote e checar tipos**

Run: `pnpm --filter @mypet/core test`
Expected: PASS em todos os arquivos.

Run: `pnpm --filter @mypet/core exec tsc --noEmit`
Expected: sem erros. Se o pacote não tiver `tsconfig` próprio para `tsc`, rodar `pnpm --filter mypet exec tsc --noEmit` (o app compila o core).

- [ ] **Step 7: Atualizar a especificação**

Em `docs/superpowers/specs/2026-10-16-agente-telemetria-design.md`:

1. Trocar o parágrafo que começa com "- Executado depois da resposta, via `after()`" por:

```markdown
- Sem `after()` do Next (lança fora do escopo de requisição e não traz ganho
  aqui): nos caminhos sem stream (429, 403, 409, 502) o evento é gravado com
  `await` antes da resposta; nos caminhos com stream, as promessas pendentes
  são aguardadas no `onEnd`.
```

2. Na lista "Pontos de captura", trocar o item do `turn_started` (que cita a "Exceção ao `after()`") por:

```markdown
- Logo antes de chamar o modelo → `turn_started`. O insert é disparado sem
  `await` antes do stream, e a promessa é aguardada no `onEnd` (ou no caminho
  do 502), para a função não morrer com o insert pendente. Não soma latência
  à resposta.
```

3. Na tabela de tipos de evento, trocar a linha `aborted` por:

```markdown
| `aborted` | `onEnd` com `isAborted = true` ou sem `finishReason` (o AI SDK chama `onEnd` sem `finishReason` quando o navegador desconecta) | `{}` |
```

4. No mesmo bloco de captura, acrescentar depois de "Id repetido → `duplicate_message`.":

```markdown
- Falha ao preparar a chamada (configuração do provedor inválida) →
  `provider_error` com `failures: [{ provider: "config", error }]`.
```

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/agent-server.ts packages/core/src/agent-server.test.ts docs/superpowers/specs/2026-10-16-agente-telemetria-design.md
git commit -m "feat(agente): telemetria de eventos e métricas no handler do agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Aplicar a migration e verificar em produção

**Files:** nenhum arquivo novo.

- [ ] **Step 1: Aplicar a migration no hub_catalogo**

Pelo MCP do Supabase: `apply_migration` no projeto `hsguyfiyqpuligijcjlw`, nome `agent_telemetry`, com o conteúdo de `supabase/migrations/20261017120000_agent_telemetry.sql`.

- [ ] **Step 2: Conferir o schema e o job**

```sql
select column_name from information_schema.columns
 where table_name = 'agent_messages'
   and column_name in ('provider','model','latency_ms','first_token_ms','input_tokens','output_tokens','steps');
-- esperado: 7 linhas

select relrowsecurity from pg_class where relname = 'agent_events';
-- esperado: true

select has_table_privilege('anon', 'public.agent_events', 'select') as anon_le,
       has_table_privilege('authenticated', 'public.agent_events', 'select') as auth_le;
-- esperado: false, false

select jobname, schedule from cron.job where jobname = 'agent_events_retention';
-- esperado: 1 linha, '0 3 * * *'
```

- [ ] **Step 3: Deploy**

Pedir confirmação ao usuário antes do `git push` (a Vercel publica a partir da `main`). Depois do push, aguardar o deploy do `apps/mypet`.

- [ ] **Step 4: Verificar com uma conversa real**

Fazer uma pergunta em `/agente` no site em produção e consultar:

```sql
select role, provider, model, latency_ms, first_token_ms, input_tokens, output_tokens, steps, created_at
  from agent_messages order by created_at desc limit 2;
-- esperado: linha 'assistant' com provider, model, latências e tokens preenchidos

select kind, detail, question, created_at from agent_events order by created_at desc limit 5;
-- esperado: um 'turn_started' com detail.message_id e a pergunta
```

- [ ] **Step 5: Registrar o resultado**

Relatar ao usuário os valores observados (provedor, latência, tokens). Nada a commitar nesta task.
