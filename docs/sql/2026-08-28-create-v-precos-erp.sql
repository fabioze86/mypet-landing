-- Expõe o espelho diário de preços do Bling (product_prices) para o site.
--
-- Contexto: product_prices tem RLS habilitado SEM nenhuma policy, então o papel
-- `anon` (chave do site) não lê a tabela diretamente. Esta view roda com direitos
-- do dono (security_invoker = false), espelhando o padrão de v_agent_catalog_products,
-- e expõe só as colunas necessárias para precificar o canal mypetbrasil.
--
-- Aplicar no projeto Supabase hsguyfiyqpuligijcjlw.

create or replace view public.v_precos_erp
with (security_invoker = false) as
select
  referencia    as reference,
  preco         as preco,
  atualizado_em as atualizado_em
from public.product_prices
where preco is not null;

grant select on public.v_precos_erp to anon, authenticated;

-- Rollback:
--   drop view public.v_precos_erp;
