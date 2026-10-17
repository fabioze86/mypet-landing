-- ============================================================================
-- ATENÇÃO: NÃO APLICAR antes de:
--   1. o deploy do código que lê preço com service_role (getCatalogClient em
--      packages/core/src/supabase.ts) estar no ar em TODOS os apps; e
--   2. SUPABASE_SERVICE_ROLE_KEY estar configurada em cada projeto da Vercel
--      que mostra preço: mypet, distribuidora, madpet, azpetshop e
--      distribuidora-instagram.
-- Aplicada antes disso, os sites passam a mostrar "Preço sob consulta".
-- ============================================================================
--
-- A chave anon é pública, e a policy product_channel_prices_select_public
-- deixava qualquer pessoa baixar a tabela de preços de todos os canais pela
-- API do Supabase, sem passar pelos sites. Os sites leem preço no servidor
-- com service_role, que ignora RLS; o admin lê com a sessão dele.
--
-- O GRANT de SELECT para anon fica de propósito: as consultas do catálogo
-- fazem embed de product_channel_prices, e sem o grant a consulta inteira
-- falharia. Sem policy, o embed só volta vazio.

drop policy if exists product_channel_prices_select_public on public.product_channel_prices;

create policy product_channel_prices_select_admin on public.product_channel_prices
  for select to authenticated
  using (exists (select 1 from public.admin_users where admin_users.id = auth.uid()));
