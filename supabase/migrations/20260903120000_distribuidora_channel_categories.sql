create table if not exists public.channel_categories (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  name text not null,
  slug text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, slug)
);

create table if not exists public.product_channel_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  channel text not null,
  category_id uuid not null references public.channel_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, channel)
);

create index if not exists product_channel_categories_category_idx
  on public.product_channel_categories (channel, category_id);

insert into public.channel_categories (channel, name, slug, sort_order)
values
  ('ffa_fabrica', 'Kits', 'kits', 1),
  ('ffa_fabrica', 'Peitorais e Coleiras', 'peitorais-e-coleiras', 2),
  ('ffa_fabrica', 'Camas e colchonetes', 'camas-e-colchonetes', 3),
  ('ffa_fabrica', 'Laços', 'lacos', 4),
  ('ffa_fabrica', 'Roupas', 'roupas', 5)
on conflict (channel, slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.channel_categories enable row level security;
alter table public.product_channel_categories enable row level security;

create policy "public reads channel categories" on public.channel_categories
  for select to anon using (true);
create policy "admins manage channel categories" on public.channel_categories
  for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
create policy "public reads product channel categories" on public.product_channel_categories
  for select to anon using (true);
create policy "admins manage product channel categories" on public.product_channel_categories
  for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
