-- Campanhas de oferta para o hotsite de tráfego Instagram (apps/distribuidora-instagram).
-- Referenciam produtos existentes do Hub Catálogo; preço de tabela nunca é salvo aqui —
-- é sempre resolvido ao vivo a partir do preço real do produto no canal.

create table public.offer_campaigns (
  id uuid primary key default gen_random_uuid(),
  channel public.channel not null,
  slug text not null,
  title text,
  subtitle text,
  badge text,
  coupon_code text,
  coupon_description text,
  coupon_discount_pct numeric check (coupon_discount_pct is null or (coupon_discount_pct >= 0 and coupon_discount_pct <= 100)),
  coupon_valid_until timestamptz,
  freight_message text,
  primary_cta_label text,
  secondary_cta_label text,
  hero_priority int not null default 0,
  flash_offer boolean not null default false,
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, slug)
);
create index offer_campaigns_channel_active_idx on public.offer_campaigns (channel, active);

create table public.offer_campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.offer_campaigns(id) on delete cascade,
  product_id uuid not null references public.products(id),
  promotional_price numeric not null check (promotional_price > 0),
  min_quantity int not null default 1 check (min_quantity >= 1),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (campaign_id, product_id)
);
create index offer_campaign_items_campaign_idx on public.offer_campaign_items (campaign_id, sort_order);

-- RLS
alter table public.offer_campaigns enable row level security;
alter table public.offer_campaign_items enable row level security;

-- Leitura pública (sem filtro de data — a vigência é resolvida em packages/core,
-- igual ao Balcão de Negócios); escrita só admin.
create policy "anon reads offer campaigns" on public.offer_campaigns
  for select to anon using (true);
create policy "anon reads offer campaign items" on public.offer_campaign_items
  for select to anon using (true);
create policy "admins manage offer campaigns" on public.offer_campaigns
  for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
create policy "admins manage offer campaign items" on public.offer_campaign_items
  for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
