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
