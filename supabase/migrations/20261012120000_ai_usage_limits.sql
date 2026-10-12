-- Limites de uso dos assistentes de IA (/api/assistant e /api/duvidas).
--
-- As rotas são públicas e cada chamada custa tokens no provedor de IA. Como a
-- Vercel roda várias instâncias, o contador fica aqui: cada pergunta aceita
-- grava uma linha e consume_ai_quota decide, de forma atômica, se ainda há
-- cota por IP (rajada e dia) e global por dia (teto de custo do canal).
-- Acesso só pelo service role (server-side); anon/authenticated não leem nem
-- executam nada.

create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  scope text not null,
  channel text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_ip
  on public.ai_usage_events (scope, channel, ip_hash, created_at desc);
create index if not exists ai_usage_events_global
  on public.ai_usage_events (scope, channel, created_at desc);

alter table public.ai_usage_events enable row level security;
revoke all on table public.ai_usage_events from anon, authenticated;

-- Retorna 'ok' (e registra o uso) ou o limite estourado:
-- 'ip_burst' | 'ip_daily' | 'global_daily'. Uso bloqueado não é registrado.
create or replace function public.consume_ai_quota(
  p_scope text,
  p_channel text,
  p_ip_hash text,
  p_ip_burst_max integer,
  p_ip_burst_window_seconds integer,
  p_ip_daily_max integer,
  p_global_daily_max integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_burst integer;
  v_ip_daily integer;
  v_global integer;
begin
  -- Serializa por escopo+canal para que pedidos simultâneos não furem o teto.
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || p_scope || ':' || p_channel));

  select count(*) into v_global
    from ai_usage_events
   where scope = p_scope and channel = p_channel
     and created_at > now() - interval '1 day';
  if v_global >= p_global_daily_max then
    return 'global_daily';
  end if;

  select count(*) filter (where created_at > now() - make_interval(secs => p_ip_burst_window_seconds)),
         count(*)
    into v_ip_burst, v_ip_daily
    from ai_usage_events
   where scope = p_scope and channel = p_channel and ip_hash = p_ip_hash
     and created_at > now() - interval '1 day';
  if v_ip_burst >= p_ip_burst_max then
    return 'ip_burst';
  end if;
  if v_ip_daily >= p_ip_daily_max then
    return 'ip_daily';
  end if;

  insert into ai_usage_events (scope, channel, ip_hash) values (p_scope, p_channel, p_ip_hash);

  -- Limpeza ocasional: só a janela de 1 dia importa para os limites.
  if random() < 0.01 then
    delete from ai_usage_events where created_at < now() - interval '3 days';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.consume_ai_quota(text, text, text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_ai_quota(text, text, text, integer, integer, integer, integer)
  to service_role;
