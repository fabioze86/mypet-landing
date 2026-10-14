-- product_channel_prices estava sem RLS e com grants padrão: a chave pública
-- (anon, exposta no navegador) e qualquer usuário logado (ex.: comprador da
-- distribuidora via Supabase Auth) conseguiam inserir, alterar e apagar preços.
--
-- Leitura continua pública (catálogos dos sites leem preços com a chave anon).
-- Escrita só pelo servidor: service role / postgres (bypassam RLS). Nenhuma
-- política de escrita para anon/authenticated, e os grants de escrita são
-- revogados (TRUNCATE não passa por RLS, então também é revogado).

alter table public.product_channel_prices enable row level security;

drop policy if exists product_channel_prices_select_public on public.product_channel_prices;
create policy product_channel_prices_select_public on public.product_channel_prices
  for select to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on table public.product_channel_prices from anon, authenticated;
