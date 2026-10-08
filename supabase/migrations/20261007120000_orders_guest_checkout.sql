-- Pedido sem login (distribuidora): o comprador é identificado pelos dados
-- digitados no carrinho; buyer_id só é preenchido quando há sessão.
alter table public.orders alter column buyer_id drop not null;

alter table public.orders
  add column customer_name text,
  add column customer_company text,
  add column customer_whatsapp text,
  add column customer_cnpj text,
  add column number bigint generated always as identity (start with 1001);

alter table public.orders add constraint orders_number_key unique (number);

-- Preço unitário calculado no servidor no momento do pedido (snapshot).
alter table public.order_items add column unit_price numeric(12,2);
