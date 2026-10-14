-- Conversas do agente /agente (apps/mypet).
--
-- Cada conversa tem id gerado no navegador (useChat). buyer_id fica nulo
-- enquanto a pessoa é visitante e é preenchido quando ela se cadastra no meio
-- da conversa (mede a conversão de leads pelo agente). agent_messages guarda as
-- UI messages completas (parts) para recarregar o histórico no servidor — o
-- navegador nunca manda o histórico, só a pergunta nova.
-- Acesso só pelo service role (server-side); anon/authenticated não leem nada.

create table if not exists public.agent_conversations (
  id uuid primary key,
  channel text not null,
  buyer_id uuid null references public.buyers(id) on delete set null,
  ip_hash text not null,
  started_as text not null check (started_as in ('visitante', 'cliente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_conversations_buyer
  on public.agent_conversations (buyer_id, updated_at desc);
create index if not exists agent_conversations_channel_updated
  on public.agent_conversations (channel, updated_at desc);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  message_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  parts jsonb not null,
  mode text not null check (mode in ('visitante', 'cliente')),
  created_at timestamptz not null default now(),
  unique (conversation_id, message_id)
);

create index if not exists agent_messages_conversation
  on public.agent_messages (conversation_id, created_at desc);

alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
revoke all on table public.agent_conversations from anon, authenticated;
revoke all on table public.agent_messages from anon, authenticated;
