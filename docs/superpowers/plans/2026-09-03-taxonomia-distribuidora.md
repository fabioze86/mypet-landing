# Taxonomia exclusiva da Distribuidora Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à Distribuidora cinco categorias próprias e permitir a classificação de seus produtos no Admin sem afetar a taxonomia global.

**Architecture:** As categorias pertencentes ao canal ficam em `channel_categories`; a tabela de associação `product_channel_categories` determina a categoria de cada produto em um canal. O core expõe consultas explícitas por canal, e somente `apps/distribuidora` troca para elas. O Admin atualiza as associações usando a sessão autenticada existente.

**Tech Stack:** Next.js 16.2.6 App Router, TypeScript, Supabase/Postgres, Vitest, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-03-taxonomia-distribuidora-design.md`

## Global Constraints

- Não alterar os dados ou os consumidores da tabela global `categories`.
- A taxonomia inicial de `ffa_fabrica` é plana e contém exatamente Kits, Peitorais e Coleiras, Camas e colchonetes, Laços e Roupas.
- Um produto pode ter no máximo uma categoria no mesmo canal.
- Produtos não classificados não aparecem nas categorias da Distribuidora.
- Toda escrita exige a sessão de `admin_users` já usada no Admin.

---

### Task 1: Schema e taxonomia inicial

**Files:**
- Create: `supabase/migrations/20260903120000_distribuidora_channel_categories.sql`

**Interfaces:**
- Produces: `public.channel_categories(id, channel, name, slug, sort_order, created_at, updated_at)`.
- Produces: `public.product_channel_categories(product_id, channel, category_id, created_at, updated_at)` com unicidade em `(product_id, channel)`.

- [ ] **Step 1: Escrever a migração idempotente**

```sql
create table public.channel_categories (
  id uuid primary key default gen_random_uuid(), channel public.channel not null,
  name text not null, slug text not null, sort_order integer not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (channel, slug)
);
create table public.product_channel_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  channel public.channel not null,
  category_id uuid not null references public.channel_categories(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (product_id, channel)
);
insert into public.channel_categories (channel, name, slug, sort_order) values
  ('ffa_fabrica', 'Kits', 'kits', 1), ('ffa_fabrica', 'Peitorais e Coleiras', 'peitorais-e-coleiras', 2),
  ('ffa_fabrica', 'Camas e colchonetes', 'camas-e-colchonetes', 3), ('ffa_fabrica', 'Laços', 'lacos', 4),
  ('ffa_fabrica', 'Roupas', 'roupas', 5)
on conflict (channel, slug) do update set name = excluded.name, sort_order = excluded.sort_order;
```

- [ ] **Step 2: Aplicar RLS e políticas**

```sql
alter table public.channel_categories enable row level security;
create policy "public reads channel categories" on public.channel_categories for select to anon using (true);
create policy "admins manage channel categories" on public.channel_categories for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
```

Repita a política de leitura e a política administrativa para `product_channel_categories`.

- [ ] **Step 3: Verificar localmente a sintaxe e aplicar a migração no ambiente Supabase configurado**

Run: `pnpm exec supabase db push`

Expected: as duas tabelas e as cinco linhas de `ffa_fabrica` são criadas, sem alteração em `categories`.

### Task 2: Consultas de catálogo por categoria de canal

**Files:**
- Modify: `packages/core/src/catalog-utils.ts`
- Modify: `packages/core/src/catalog.ts`
- Modify: `packages/core/src/catalog.test.ts`

**Interfaces:**
- Produces: `ChannelCategory` com `id`, `channel`, `name`, `slug`, `sortOrder`.
- Produces: `getChannelCategories(channel: string): Promise<CategoryNode[]>`.
- Produces: `getCatalogByChannelCategory({ channel, categorySlug, page }): Promise<CatalogResult>`.

- [ ] **Step 1: Escrever testes que simulam as respostas Supabase**

```ts
it("retorna somente categorias do canal solicitado em ordem", async () => {
  // mock da consulta channel_categories para ffa_fabrica
  await expect(getChannelCategories("ffa_fabrica")).resolves.toMatchObject([
    { name: "Kits", slug: "kits", parentId: null },
  ]);
});

it("lista apenas produtos associados ao slug e canal", async () => {
  await expect(getCatalogByChannelCategory({ channel: "ffa_fabrica", categorySlug: "kits", page: 1 }))
    .resolves.toMatchObject({ total: 1 });
});
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

Run: `pnpm --filter @mypet/core test -- catalog.test.ts`

Expected: falha porque os exports ainda não existem.

- [ ] **Step 3: Implementar tipos e consultas**

```ts
export async function getChannelCategories(channel: string): Promise<CategoryNode[]> {
  // select id, name, slug, sort_order from channel_categories
  // eq channel, order sort_order; mapear parentId: null e level: 1
}

export async function getCatalogByChannelCategory(params: {
  channel: string; categorySlug: string; page: number;
}): Promise<CatalogResult | null> {
  // resolve categoria pelo channel + slug e consulta products com join
  // product_channel_categories!inner(channel, category_id), além dos joins atuais.
}
```

- [ ] **Step 4: Rodar os testes do core**

Run: `pnpm --filter @mypet/core test`

Expected: PASS.

### Task 3: Listagem e navegação somente na Distribuidora

**Files:**
- Modify: `apps/distribuidora/app/page.tsx`
- Modify: `apps/distribuidora/app/categoria/[slug]/page.tsx`
- Modify: `apps/distribuidora/app/sitemap.ts`
- Modify: `apps/distribuidora/app/produtos/[id]/page.tsx`
- Modify: páginas da Distribuidora que montam `SiteNav`
- Create or modify: testes das páginas da Distribuidora afetadas

**Interfaces:**
- Consumes: `getChannelCategories("ffa_fabrica")` e `getCatalogByChannelCategory` da Task 2.
- Produces: menu, chips, sitemap e rota de categoria restritos às categorias da Distribuidora.

- [ ] **Step 1: Escrever testes de página para a nova fonte de categorias**

```ts
vi.mock("@mypet/core/catalog", () => ({
  getChannelCategories: async () => [{ id: "kits", name: "Kits", slug: "kits", parentId: null, level: 1, sortOrder: 1 }],
}));
```

- [ ] **Step 2: Confirmar a falha dos testes**

Run: `pnpm --filter distribuidora test`

Expected: falha até que as páginas consumam a nova função.

- [ ] **Step 3: Trocar apenas a Distribuidora para categorias por canal**

```ts
const categories = await getChannelCategories(clientConfig.catalogChannel);
```

Na rota de categoria, use `getCatalogByChannelCategory`; se retornar `null`, chame `notFound()`. Atualize o sitemap usando a mesma lista. Não altere imports ou chamadas equivalentes em outros apps.

- [ ] **Step 4: Rodar build e testes da Distribuidora**

Run: `pnpm --filter distribuidora test && pnpm --filter distribuidora build`

Expected: PASS.

### Task 4: Administração da classificação da Distribuidora

**Files:**
- Create: `apps/admin/app/(dashboard)/distribuidora-categorias/actions.ts`
- Create: `apps/admin/app/(dashboard)/distribuidora-categorias/page.tsx`
- Modify: `apps/admin/app/(dashboard)/layout.tsx`
- Create: `apps/admin/app/(dashboard)/distribuidora-categorias/actions.test.ts`

**Interfaces:**
- Consumes: `requireAdminSession()`, `channel_categories`, `product_channel_links` e `product_channel_categories`.
- Produces: rota administrativa `/distribuidora-categorias` e action `assignDistribuidoraCategory(formData)`.

- [ ] **Step 1: Escrever testes da action**

```ts
it("recusa categoria de outro canal", async () => {
  // mocka requireAdminSession e category channel diferente de ffa_fabrica
  await expect(assignDistribuidoraCategory(formData)).rejects.toThrow("Categoria inválida");
});

it("faz upsert da categoria de produto no canal ffa_fabrica", async () => {
  // espera upsert com onConflict: "product_id,channel"
});
```

- [ ] **Step 2: Confirmar a falha dos testes**

Run: `pnpm --filter admin test -- distribuidora-categorias/actions.test.ts`

Expected: falha até a action existir.

- [ ] **Step 3: Criar a action com validação de propriedade de canal**

```ts
const channel = "ffa_fabrica";
// validar UUID de productId/categoryId;
// confirmar que categoryId pertence a channel_categories.channel;
// confirmar product_channel_links contém o produto nesse channel;
await supabase.from("product_channel_categories").upsert(
  { product_id: productId, channel, category_id: categoryId },
  { onConflict: "product_id,channel" },
);
updateTag("catalog");
```

- [ ] **Step 4: Criar a página e item de navegação**

Exibir as cinco categorias, produtos ativos ligados a `ffa_fabrica`, a categoria atual e um `<select>` para salvar a classificação. Incluir filtro “Sem categoria” como padrão para facilitar a primeira triagem. Adicionar no `NAV` o link `Categorias Distribuidora` para `/distribuidora-categorias`.

- [ ] **Step 5: Executar testes e build do Admin**

Run: `pnpm --filter admin test && pnpm --filter admin build`

Expected: PASS.

### Task 5: Verificação integrada

**Files:**
- Modify: testes necessários descobertos nas tarefas anteriores.

- [ ] **Step 1: Validar invariantes no banco**

```sql
select channel, name, slug, sort_order
from public.channel_categories
where channel = 'ffa_fabrica'
order by sort_order;
```

Expected: cinco linhas, na ordem definida.

- [ ] **Step 2: Testar manualmente o ciclo de classificação**

1. No Admin, atribuir “Kits” a um produto da Distribuidora.
2. Abrir a home e confirmar que “Kits” aparece no menu/chips.
3. Abrir `/categoria/kits` e confirmar que o produto aparece.
4. Conferir uma página de outro app e confirmar que suas categorias não mudaram.

- [ ] **Step 3: Executar a verificação completa**

Run: `pnpm lint && pnpm test && pnpm --filter distribuidora build && pnpm --filter admin build`

Expected: PASS.
