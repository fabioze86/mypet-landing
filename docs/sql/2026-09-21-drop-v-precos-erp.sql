-- Remove o espelho de preços do Bling, desativado em 2026-09-21.
--
-- Contexto: `public.v_precos_erp` (criada em 2026-08-28, ver
-- docs/sql/2026-08-28-create-v-precos-erp.sql) expunha o espelho diário do
-- Bling (`product_prices`) para o site precificar o canal mypetbrasil. O
-- Bling foi desativado e todo o código que consultava essa view foi removido
-- (packages/core/src/{catalog-utils,catalog,catalog-line-items,balcao,offers}.ts
-- e apps/admin/app/(dashboard)/balcao/[id]/page.tsx) — mypetbrasil precifica
-- hoje só por `product_channel_prices`. Sem dependentes (nenhuma view/função
-- referencia `v_precos_erp`), portanto seguro remover.
--
-- Aplicar no projeto Supabase hsguyfiyqpuligijcjlw.

drop view if exists public.v_precos_erp;

-- Rollback (recria a view; não repovoa product_prices, que é do sync do Bling):
--   create or replace view public.v_precos_erp
--   with (security_invoker = false) as
--   select
--     referencia    as reference,
--     preco         as preco,
--     atualizado_em as atualizado_em
--   from public.product_prices
--   where preco is not null;
--   grant select on public.v_precos_erp to anon, authenticated;
