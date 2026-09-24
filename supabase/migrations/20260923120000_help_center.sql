-- ============================================================================
-- Central de Ajuda — Fase 1
-- mypet-landing · projeto Supabase hub_catalogo
--
-- Ver docs/superpowers/specs/2026-09-23-central-de-ajuda-design.md.
--
-- Fase 1 apenas: conteúdo próprio desta central, sem relação com
-- comercial.regras_comerciais do Hub (repositório hub-clientes, projeto
-- Supabase "Clientes"). A Fase 2 (spec futura) decide como o agente de
-- WhatsApp passa a consultar esta central.
--
-- RLS segue o padrão já usado em `categories`/`banners`: escrita só para
-- `authenticated` que exista em `admin_users` (é assim que
-- apps/admin/lib/auth.ts autentica, com o client de sessão, não service
-- role); leitura pública restrita ao que está publicado.
-- ============================================================================

create table public.categorias_ajuda (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  titulo         text not null,
  descricao      text not null,
  icone          text not null,
  ordem          integer not null default 0,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);

create table public.artigos_ajuda (
  id             uuid primary key default gen_random_uuid(),
  categoria_id   uuid not null references public.categorias_ajuda(id) on delete restrict,
  slug           text not null unique,
  titulo         text not null,
  resumo         text not null default '',
  corpo_markdown text not null default '',
  palavras_chave text not null default '',
  status         text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  ordem          integer not null default 0,
  nota_interna   text,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);

create index idx_artigos_ajuda_categoria_status
  on public.artigos_ajuda (categoria_id, status, ordem);

alter table public.categorias_ajuda enable row level security;
alter table public.artigos_ajuda enable row level security;

create policy "categorias_ajuda_admin_write" on public.categorias_ajuda
  for all to authenticated
  using (exists (select 1 from admin_users where admin_users.id = auth.uid()))
  with check (exists (select 1 from admin_users where admin_users.id = auth.uid()));

create policy "categorias_ajuda_leitura_publica" on public.categorias_ajuda
  for select to anon
  using (true);

create policy "artigos_ajuda_admin_write" on public.artigos_ajuda
  for all to authenticated
  using (exists (select 1 from admin_users where admin_users.id = auth.uid()))
  with check (exists (select 1 from admin_users where admin_users.id = auth.uid()));

create policy "artigos_ajuda_leitura_publicada" on public.artigos_ajuda
  for select to anon
  using (status = 'publicado');
