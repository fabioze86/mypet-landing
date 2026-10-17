-- A chave anon é pública, e a policy product_channel_prices_select_public
-- deixava qualquer pessoa baixar a tabela de preços de todos os canais pela
-- API do Supabase, sem passar pelos sites. Os apps deste repositório leem
-- preço no servidor com service_role (getCatalogClient em
-- packages/core/src/supabase.ts), que ignora RLS; o admin lê com a sessão dele.
--
-- Exceção: o canal azpetshop continua legível por anon. A loja azpetshop roda
-- fora da Vercel e ainda lê preço com a anon key; esses preços já são públicos
-- na própria loja (modo carrinho). Quando ela passar a ler com service_role,
-- remover a policy product_channel_prices_select_azpetshop.
--
-- O GRANT de SELECT para anon fica de propósito: as consultas do catálogo
-- fazem embed de product_channel_prices, e sem o grant a consulta inteira
-- falharia. Sem policy, o embed só volta vazio.

drop policy if exists product_channel_prices_select_public on public.product_channel_prices;

create policy product_channel_prices_select_azpetshop on public.product_channel_prices
  for select to anon, authenticated
  using (channel = 'azpetshop');

create policy product_channel_prices_select_admin on public.product_channel_prices
  for select to authenticated
  using (exists (select 1 from public.admin_users where admin_users.id = auth.uid()));
