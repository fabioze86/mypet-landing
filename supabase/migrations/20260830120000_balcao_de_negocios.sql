-- Balcão de Negócios: regras de desconto por volume + solicitações sob validação comercial.
-- Escopo desta entrega: canal mypetbrasil. Estrutura channel-keyed para estender depois.

-- Regras: uma por escopo (categoria inteira OU sku específico).
create table public.balcao_rules (
  id uuid primary key default gen_random_uuid(),
  channel public.channel not null,
  scope text not null check (scope in ('categoria', 'sku')),
  category_id uuid references public.categories(id) on delete cascade,
  product_reference text,
  excluded boolean not null default false,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'categoria' and category_id is not null and product_reference is null)
    or (scope = 'sku' and product_reference is not null and category_id is null)
  ),
  check (not excluded or scope = 'sku'),
  unique nulls not distinct (channel, scope, category_id, product_reference)
);

-- Faixas de uma regra: quantidade mínima + percentual de desconto.
create table public.balcao_rule_tiers (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.balcao_rules(id) on delete cascade,
  min_qty int not null check (min_qty >= 1),
  discount_pct numeric not null default 0 check (discount_pct >= 0),
  unique (rule_id, min_qty)
);

-- Cabeçalho da solicitação + snapshot do contexto do comprador.
create table public.balcao_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id),
  channel public.channel not null,
  logistics text not null check (logistics in ('retirada', 'frete_proprio')),
  note text,
  status text not null default 'enviada'
    check (status in ('enviada', 'em_analise', 'aprovada', 'ajustada', 'recusada', 'expirada')),
  buyer_snapshot jsonb not null,
  total_estimated numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index balcao_requests_status_idx on public.balcao_requests (status, created_at desc);
create index balcao_requests_buyer_idx on public.balcao_requests (buyer_id, created_at desc);

-- Fotografia imutável por linha da solicitação.
create table public.balcao_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.balcao_requests(id) on delete cascade,
  product_id uuid not null,
  product_reference text not null,
  product_name_snapshot text not null,
  qty int not null check (qty >= 1),
  base_price_snapshot numeric not null,
  tier_min_qty_snapshot int,
  volume_discount_pct_snapshot numeric not null default 0,
  logistics_discount_pct_snapshot numeric not null default 0,
  unit_price_estimated numeric not null,
  line_total_estimated numeric not null
);
create index balcao_request_items_request_idx on public.balcao_request_items (request_id);

-- Histórico de ações da equipe sobre a solicitação.
create table public.balcao_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.balcao_requests(id) on delete cascade,
  actor uuid references public.admin_users(id),
  action text not null
    check (action in ('criada', 'em_analise', 'aprovada', 'ajustada', 'recusada', 'expirada')),
  payload jsonb,
  created_at timestamptz not null default now()
);
create index balcao_request_events_request_idx on public.balcao_request_events (request_id, created_at);

-- RLS
alter table public.balcao_rules enable row level security;
alter table public.balcao_rule_tiers enable row level security;
alter table public.balcao_requests enable row level security;
alter table public.balcao_request_items enable row level security;
alter table public.balcao_request_events enable row level security;

-- Regras e faixas: leitura pública (o site calcula a estimativa e marca elegibilidade
-- com a anon key); escrita só admin.
create policy "anon reads balcao rules" on public.balcao_rules
  for select to anon using (true);
create policy "anon reads balcao rule tiers" on public.balcao_rule_tiers
  for select to anon using (true);
create policy "admins manage balcao rules" on public.balcao_rules
  for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
create policy "admins manage balcao rule tiers" on public.balcao_rule_tiers
  for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));

-- Solicitações: sem acesso anon. Site grava via service role (bypassa RLS).
-- Admin autenticado lê tudo, atualiza status e grava eventos.
create policy "admins read balcao requests" on public.balcao_requests
  for select to authenticated using (auth.uid() in (select id from public.admin_users));
create policy "admins update balcao requests" on public.balcao_requests
  for update to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
create policy "admins read balcao request items" on public.balcao_request_items
  for select to authenticated using (auth.uid() in (select id from public.admin_users));
create policy "admins manage balcao request events" on public.balcao_request_events
  for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
