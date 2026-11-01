-- Checkout de varejo (azpetshop): pedido pago online, com entrega e pagamento.

alter table public.orders drop constraint orders_channel_check;
alter table public.orders add constraint orders_channel_check
  check (channel in ('mypetbrasil', 'distribuidora', 'azpetshop'));

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pendente', 'confirmado', 'entregue', 'cancelado',
                    'aguardando_pagamento', 'pago', 'enviado', 'expirado'));

alter table public.orders
  add column customer_cpf text,
  add column customer_email text,
  add column subtotal numeric(12,2),
  add column shipping_price numeric(12,2),
  add column total numeric(12,2),
  add column access_token text;

create unique index orders_access_token_key on public.orders (access_token) where access_token is not null;

create table public.order_shipping (
  order_id uuid primary key references public.orders (id) on delete cascade,
  cep text not null,
  logradouro text not null,
  numero text not null,
  complemento text,
  bairro text not null,
  cidade text not null,
  uf text not null,
  service_id integer not null,
  service_name text not null,
  price numeric(12,2) not null,
  delivery_days integer,
  tracking_code text,
  shipped_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  provider text not null default 'asaas',
  asaas_checkout_id text unique,
  checkout_url text,
  amount numeric(12,2) not null,
  status text not null default 'ACTIVE',
  last_event_id text,
  last_event_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotência do webhook: cada evento do Asaas é gravado uma única vez.
create table public.payment_webhook_events (
  id text primary key,
  event text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.order_shipping enable row level security;
alter table public.order_payments enable row level security;
alter table public.payment_webhook_events enable row level security;

create policy order_shipping_admin_all on public.order_shipping
  for all using (exists (select 1 from public.admin_users where admin_users.id = auth.uid()));
create policy order_payments_admin_all on public.order_payments
  for all using (exists (select 1 from public.admin_users where admin_users.id = auth.uid()));
-- payment_webhook_events: sem política (só service role).

-- Baixa o estoque dos itens de um pedido pago (chamada só pelo servidor).
create function public.decrement_order_stock(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products p
     set stock_qty = greatest(coalesce(p.stock_qty, 0) - oi.qty, 0)
    from public.order_items oi
   where oi.order_id = p_order_id
     and oi.product_id = p.id;
$$;

revoke all on function public.decrement_order_stock(uuid) from public, anon, authenticated;
