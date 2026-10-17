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
