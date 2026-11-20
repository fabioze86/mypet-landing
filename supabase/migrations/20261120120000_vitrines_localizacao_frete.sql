-- Vitrines Linha de Fábrica e Catálogo completo (apps/mypet).
-- buyers é compartilhada com apps/distribuidora: todas as colunas são opcionais.

alter table public.buyers
  add column if not exists uf text,
  add column if not exists municipio text,
  add column if not exists cep text,
  add column if not exists localizacao_status text,
  add column if not exists localizado_em timestamptz;

alter table public.buyers drop constraint if exists buyers_localizacao_status_check;
alter table public.buyers add constraint buyers_localizacao_status_check
  check (localizacao_status is null or localizacao_status in ('localizado', 'nao_localizado'));

alter table public.orders
  add column if not exists vitrine text,
  add column if not exists shipping_mode text;

alter table public.orders drop constraint if exists orders_vitrine_check;
alter table public.orders add constraint orders_vitrine_check
  check (vitrine is null or vitrine in ('completo', 'fabrica'));

alter table public.orders drop constraint if exists orders_shipping_mode_check;
alter table public.orders add constraint orders_shipping_mode_check
  check (shipping_mode is null or shipping_mode in ('normal', 'prioritaria', 'a_combinar'));
