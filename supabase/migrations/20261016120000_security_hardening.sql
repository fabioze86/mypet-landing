-- Endurecimento de segurança (auditoria de 2026-10-16).
--
-- A chave anon é pública (NEXT_PUBLIC_SUPABASE_ANON_KEY vai para o navegador)
-- e o signup do Supabase Auth está aberto, então anon e authenticated valem
-- como "qualquer pessoa na internet". Esta migration só fecha o que nenhum app
-- deste repositório lê com essas roles; os sistemas internos (hub) leem estas
-- views com service_role, que não é afetada por revoke nem por RLS.
--
-- Fica para uma etapa seguinte, porque exige mudar o código do catálogo:
-- product_channel_prices e v_produtos_resolvidos, lidos com a anon key por
-- packages/core/src/catalog.ts, offers.ts, balcao.ts e catalog-line-items.ts.

-- 1. Views security definer que expunham custo e preço de todos os canais.
--    product_source_cost_comparison tem preço de custo por fornecedor.
revoke all on public.product_source_cost_comparison from anon, authenticated;
revoke all on public.v_precos_canal from anon, authenticated;
revoke all on public.v_product_channel_view from anon, authenticated;
revoke all on public.v_agent_catalog_products from anon, authenticated;
revoke all on public.v_agent_family_catalog from anon, authenticated;
revoke all on public.v_agent_search_gaps from anon, authenticated;
revoke all on public.v_active_brands from anon, authenticated;
revoke all on public.catalogo from anon, authenticated;

-- 2. Tabela de controle do Prisma: sem RLS e com escrita para anon.
--    Sem policies, só service_role e o dono (postgres) acessam.
alter table public._prisma_migrations enable row level security;
revoke all on public._prisma_migrations from anon, authenticated;

-- 3. Termos digitados pelos clientes no agente: só o service_role lê.
drop policy if exists agent_search_log_leitura on public.agent_search_log;
revoke all on public.agent_search_log from anon, authenticated;

-- 4. Funções security definer de busca do agente: devolvem preço de qualquer
--    canal. Ninguém deste repositório as chama com a role authenticated.
revoke execute on function public.buscar_produtos_agente(text, public.channel_kind, text, integer) from public, anon, authenticated;
revoke execute on function public.buscar_familias_agente(text, public.channel_kind, text, integer) from public, anon, authenticated;
revoke execute on function public.buscar_produtos_por_referencias(text[], public.channel_kind) from public, anon, authenticated;

-- 5. push_subscriptions: o UPDATE para anon com using (true) deixava qualquer
--    pessoa trocar endpoint e chaves de todas as inscrições. A gravação passou
--    para o servidor com service_role (packages/core/src/push-server.ts), então
--    anon e authenticated não precisam de acesso nenhum.
--    ATENÇÃO: aplicar só depois do deploy da distribuidora com esse código.
drop policy if exists push_subscriptions_insert_publico on public.push_subscriptions;
drop policy if exists push_subscriptions_update_publico on public.push_subscriptions;
revoke all on public.push_subscriptions from anon, authenticated;
