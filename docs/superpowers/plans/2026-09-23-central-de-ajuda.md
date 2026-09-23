# Central de Ajuda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a Central de Ajuda (Fase 1): tabelas em `hub_catalogo`, CRUD no admin (`apps/admin`) e página pública com busca em `apps/mypet` (`/central-de-ajuda`), com os 48 artigos do protótipo como seed em rascunho.

**Architecture:** Duas tabelas novas (`categorias_ajuda`, `artigos_ajuda`) no schema `public` do projeto Supabase `hub_catalogo`, RLS no padrão já usado por `categories`/`banners` (escrita só para `authenticated` que existe em `admin_users`; leitura pública só do que está `publicado`). Leitura pública cacheada em `packages/core/src/help-center.ts` (mesmo padrão de `catalog.ts`/`banners.ts`, `"use cache"` + `cacheTag`). Admin em `apps/admin/app/(dashboard)/central-ajuda` segue exatamente o padrão de `categorias/` (Server Actions + Zod + client de sessão do admin, sem service role). Página pública em `apps/mypet/app/central-de-ajuda` reaproveita `LANDING_STYLES`/`pa-*` e `PaIcon`.

**Tech Stack:** Next.js 16 (Cache Components / `"use cache"` + `updateTag`), Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Zod, Vitest + Testing Library, `@phosphor-icons/react`, `marked` (nova dependência, só em `apps/mypet`).

## Global Constraints

- Projeto Supabase: `hub_catalogo` (`hsguyfiyqpuligijcjlw`), schema `public`, sem prefixo de schema nas queries.
- Sem editor rico: corpo do artigo é Markdown num `<textarea>`.
- Todo artigo nasce com `status = 'rascunho'`; nada aparece em `/central-de-ajuda` sem publicação explícita pelo admin.
- Sem exclusão de categoria/artigo nesta versão — só edição e, para artigo, alternar `rascunho`/`publicado`.
- `nota_interna` do artigo nunca é lido pelas páginas públicas nem pelas funções em `packages/core` — só pelas páginas do admin.
- Sem mudanças em `hub-clientes` nem em `comercial.regras_comerciais` (Fase 2, fora deste plano).
- Sem mudanças em `/perguntas-frequentes` além de um link novo para `/central-de-ajuda`.
- Fonte do conteúdo seed: os 48 artigos do Artifact `central-de-ajuda-mypet.html`, já revisados pelo dono em 2026-09-23 (5% à vista, atacado só para lojista, Show Room com pedido mínimo R$ 150, sem personalização).

---

## Task 1: Migration — tabelas e RLS

**Files:**
- Create: `supabase/migrations/20260923120000_help_center.sql`

**Interfaces:**
- Produces: tabelas `public.categorias_ajuda` e `public.artigos_ajuda`, usadas por todas as tasks seguintes.

- [ ] **Step 1: Escrever a migration**

```sql
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
```

- [ ] **Step 2: Aplicar a migration**

Use a ferramenta MCP do Supabase (`mcp__claude_ai_Supabase__apply_migration`) com:
- `project_id`: `hsguyfiyqpuligijcjlw`
- `name`: `help_center`
- `query`: o SQL do Step 1

- [ ] **Step 3: Verificar**

Rode (`mcp__claude_ai_Supabase__execute_sql`, mesmo `project_id`):

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('categorias_ajuda', 'artigos_ajuda')
order by tablename, policyname;
```

Esperado: 4 linhas — `categorias_ajuda_admin_write` (ALL/authenticated), `categorias_ajuda_leitura_publica` (SELECT/anon), `artigos_ajuda_admin_write` (ALL/authenticated), `artigos_ajuda_leitura_publicada` (SELECT/anon).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260923120000_help_center.sql
git commit -m "feat(db): cria categorias_ajuda e artigos_ajuda

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Exportar `escapeOrFilterValue` de `catalog-line-items.ts`

Reaproveita a função de escape de filtro `.or()` já usada na busca de catálogo, em vez de duplicar a mesma lógica na busca da central de ajuda (Task 3).

**Files:**
- Modify: `packages/core/src/catalog-line-items.ts:52`
- Test: `packages/core/src/catalog-line-items.test.ts`

**Interfaces:**
- Produces: `export function escapeOrFilterValue(value: string): string`

- [ ] **Step 1: Escrever o teste**

Adicione ao fim de `packages/core/src/catalog-line-items.test.ts`:

```ts
import { escapeOrFilterValue } from "./catalog-line-items";

describe("escapeOrFilterValue", () => {
  it("escapa vírgula e parênteses, que são estruturais no filtro .or()", () => {
    expect(escapeOrFilterValue("ração (kg), 10")).toBe("ração \\(kg\\)\\, 10");
  });

  it("não mexe em texto sem caracteres estruturais", () => {
    expect(escapeOrFilterValue("tapete higienico")).toBe("tapete higienico");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @mypet/core test -- catalog-line-items`
Expected: FAIL — `escapeOrFilterValue` não é exportado.

- [ ] **Step 3: Exportar a função**

Em `packages/core/src/catalog-line-items.ts:52`, troque:

```ts
function escapeOrFilterValue(value: string): string {
```

por:

```ts
export function escapeOrFilterValue(value: string): string {
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @mypet/core test -- catalog-line-items`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog-line-items.ts packages/core/src/catalog-line-items.test.ts
git commit -m "refactor(core): exporta escapeOrFilterValue para reuso na central de ajuda

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `packages/core/src/help-center.ts` — leitura pública cacheada

**Files:**
- Create: `packages/core/src/help-center.ts`
- Test: `packages/core/src/help-center.test.ts`
- Modify: `packages/core/package.json` (bloco `exports`)

**Interfaces:**
- Consumes: `getHubClient()` de `./supabase`; `escapeOrFilterValue` de `./catalog-line-items` (Task 2).
- Produces:
  - `type CategoriaAjuda = { id: string; slug: string; titulo: string; descricao: string; icone: string; ordem: number }`
  - `type ArtigoAjudaResumo = { id: string; categoriaId: string; slug: string; titulo: string; resumo: string; ordem: number }`
  - `type ArtigoAjuda = ArtigoAjudaResumo & { corpoMarkdown: string }`
  - `getCategoriasAjuda(): Promise<CategoriaAjuda[]>`
  - `getCategoriaAjudaBySlug(slug: string): Promise<CategoriaAjuda | null>`
  - `getArtigosAjudaPublicadosPorCategoria(categoriaId: string): Promise<ArtigoAjudaResumo[]>`
  - `getArtigoAjudaPublicadoBySlug(slug: string): Promise<ArtigoAjuda | null>`
  - `buscarArtigosAjudaPublicados(termo: string): Promise<ArtigoAjudaResumo[]>`

- [ ] **Step 1: Escrever o teste**

Crie `packages/core/src/help-center.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
}));

let rows: unknown[] = [];
const calls: Record<string, unknown> = {};

vi.mock("./supabase", () => {
  return {
    getHubClient: () => {
      const builder: Record<string, unknown> = {};
      const chain = (name: string) => (...args: unknown[]) => {
        calls[name] = args;
        return builder;
      };
      builder.select = chain("select");
      builder.eq = (...args: unknown[]) => {
        calls["eq"] = [...((calls["eq"] as unknown[][] | undefined) ?? []), args];
        return builder;
      };
      builder.or = chain("or");
      builder.order = chain("order");
      builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) => {
        resolve({ data: rows, error: null });
      };
      return { from: chain("from") };
    },
  };
});

import {
  getCategoriasAjuda,
  getCategoriaAjudaBySlug,
  getArtigosAjudaPublicadosPorCategoria,
  getArtigoAjudaPublicadoBySlug,
  buscarArtigosAjudaPublicados,
} from "./help-center";

beforeEach(() => {
  rows = [];
  for (const k of Object.keys(calls)) delete calls[k];
});

describe("getCategoriasAjuda", () => {
  it("ordena por ordem e mapeia snake_case para camelCase", async () => {
    rows = [{ id: "c1", slug: "precos", titulo: "Preços", descricao: "Pedido mínimo e descontos", icone: "Tag", ordem: 3 }];
    const result = await getCategoriasAjuda();
    expect(calls["from"]).toEqual(["categorias_ajuda"]);
    expect(calls["order"]).toEqual(["ordem", { ascending: true }]);
    expect(result).toEqual([{ id: "c1", slug: "precos", titulo: "Preços", descricao: "Pedido mínimo e descontos", icone: "Tag", ordem: 3 }]);
  });
});

describe("getCategoriaAjudaBySlug", () => {
  it("filtra por slug e devolve a primeira linha", async () => {
    rows = [{ id: "c1", slug: "precos", titulo: "Preços", descricao: "d", icone: "Tag", ordem: 0 }];
    const result = await getCategoriaAjudaBySlug("precos");
    expect(calls["eq"]).toContainEqual(["slug", "precos"]);
    expect(result?.id).toBe("c1");
  });

  it("devolve null quando não há linha", async () => {
    rows = [];
    const result = await getCategoriaAjudaBySlug("nao-existe");
    expect(result).toBeNull();
  });
});

describe("getArtigosAjudaPublicadosPorCategoria", () => {
  it("filtra por categoria_id e por status publicado", async () => {
    rows = [{ id: "a1", categoria_id: "c1", slug: "pedido-minimo", titulo: "Pedido mínimo", resumo: "r", ordem: 0 }];
    const result = await getArtigosAjudaPublicadosPorCategoria("c1");
    expect(calls["eq"]).toContainEqual(["categoria_id", "c1"]);
    expect(calls["eq"]).toContainEqual(["status", "publicado"]);
    expect(result).toEqual([{ id: "a1", categoriaId: "c1", slug: "pedido-minimo", titulo: "Pedido mínimo", resumo: "r", ordem: 0 }]);
  });
});

describe("getArtigoAjudaPublicadoBySlug", () => {
  it("filtra por slug e por status publicado, incluindo o corpo", async () => {
    rows = [{ id: "a1", categoria_id: "c1", slug: "pedido-minimo", titulo: "t", resumo: "r", ordem: 0, corpo_markdown: "## Olá" }];
    const result = await getArtigoAjudaPublicadoBySlug("pedido-minimo");
    expect(calls["eq"]).toContainEqual(["slug", "pedido-minimo"]);
    expect(calls["eq"]).toContainEqual(["status", "publicado"]);
    expect(result?.corpoMarkdown).toBe("## Olá");
  });
});

describe("buscarArtigosAjudaPublicados", () => {
  it("busca por título, resumo e palavras-chave, só entre os publicados", async () => {
    rows = [];
    await buscarArtigosAjudaPublicados("pedido mínimo");
    expect(calls["or"]).toEqual([
      "titulo.ilike.%pedido mínimo%,resumo.ilike.%pedido mínimo%,palavras_chave.ilike.%pedido mínimo%",
    ]);
    expect(calls["eq"]).toContainEqual(["status", "publicado"]);
  });

  it("escapa vírgula e parênteses no termo de busca", async () => {
    rows = [];
    await buscarArtigosAjudaPublicados("caixa (transporte), pequena");
    expect(calls["or"]).toEqual([
      "titulo.ilike.%caixa \\(transporte\\)\\, pequena%,resumo.ilike.%caixa \\(transporte\\)\\, pequena%,palavras_chave.ilike.%caixa \\(transporte\\)\\, pequena%",
    ]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @mypet/core test -- help-center`
Expected: FAIL — `./help-center` não existe.

- [ ] **Step 3: Implementar**

Crie `packages/core/src/help-center.ts`:

```ts
import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import { escapeOrFilterValue } from "./catalog-line-items";

export type CategoriaAjuda = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  icone: string;
  ordem: number;
};

export type ArtigoAjudaResumo = {
  id: string;
  categoriaId: string;
  slug: string;
  titulo: string;
  resumo: string;
  ordem: number;
};

export type ArtigoAjuda = ArtigoAjudaResumo & {
  corpoMarkdown: string;
};

type RawCategoria = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  icone: string;
  ordem: number;
};

type RawArtigoResumo = {
  id: string;
  categoria_id: string;
  slug: string;
  titulo: string;
  resumo: string;
  ordem: number;
};

type RawArtigo = RawArtigoResumo & { corpo_markdown: string };

function mapCategoria(row: RawCategoria): CategoriaAjuda {
  return {
    id: row.id,
    slug: row.slug,
    titulo: row.titulo,
    descricao: row.descricao,
    icone: row.icone,
    ordem: row.ordem,
  };
}

function mapArtigoResumo(row: RawArtigoResumo): ArtigoAjudaResumo {
  return {
    id: row.id,
    categoriaId: row.categoria_id,
    slug: row.slug,
    titulo: row.titulo,
    resumo: row.resumo,
    ordem: row.ordem,
  };
}

function mapArtigo(row: RawArtigo): ArtigoAjuda {
  return { ...mapArtigoResumo(row), corpoMarkdown: row.corpo_markdown };
}

const ARTIGO_RESUMO_SELECT = "id, categoria_id, slug, titulo, resumo, ordem";
const ARTIGO_SELECT = `${ARTIGO_RESUMO_SELECT}, corpo_markdown`;

export async function getCategoriasAjuda(): Promise<CategoriaAjuda[]> {
  "use cache";
  cacheLife("days");
  cacheTag("central-ajuda");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("categorias_ajuda")
    .select("id, slug, titulo, descricao, icone, ordem")
    .order("ordem", { ascending: true });

  if (error) {
    console.error("[help-center] erro ao listar categorias:", error.message);
    return [];
  }
  return ((data as RawCategoria[] | null) ?? []).map(mapCategoria);
}

export async function getCategoriaAjudaBySlug(slug: string): Promise<CategoriaAjuda | null> {
  "use cache";
  cacheLife("days");
  cacheTag("central-ajuda");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("categorias_ajuda")
    .select("id, slug, titulo, descricao, icone, ordem")
    .eq("slug", slug);

  if (error) {
    console.error("[help-center] erro ao buscar categoria:", error.message);
    return null;
  }
  const row = (data as RawCategoria[] | null)?.[0];
  return row ? mapCategoria(row) : null;
}

export async function getArtigosAjudaPublicadosPorCategoria(
  categoriaId: string,
): Promise<ArtigoAjudaResumo[]> {
  "use cache";
  cacheLife("days");
  cacheTag("central-ajuda");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("artigos_ajuda")
    .select(ARTIGO_RESUMO_SELECT)
    .eq("categoria_id", categoriaId)
    .eq("status", "publicado")
    .order("ordem", { ascending: true });

  if (error) {
    console.error("[help-center] erro ao listar artigos:", error.message);
    return [];
  }
  return ((data as RawArtigoResumo[] | null) ?? []).map(mapArtigoResumo);
}

export async function getArtigoAjudaPublicadoBySlug(slug: string): Promise<ArtigoAjuda | null> {
  "use cache";
  cacheLife("days");
  cacheTag("central-ajuda");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("artigos_ajuda")
    .select(ARTIGO_SELECT)
    .eq("slug", slug)
    .eq("status", "publicado");

  if (error) {
    console.error("[help-center] erro ao buscar artigo:", error.message);
    return null;
  }
  const row = (data as RawArtigo[] | null)?.[0];
  return row ? mapArtigo(row) : null;
}

/**
 * Busca dinâmica — sem "use cache": cada termo geraria uma entrada de cache
 * própria, e o valor de cachear buscas raras não compensa isso.
 */
export async function buscarArtigosAjudaPublicados(termo: string): Promise<ArtigoAjudaResumo[]> {
  const supabase = getHubClient();
  const seguro = escapeOrFilterValue(termo);
  const { data, error } = await supabase
    .from("artigos_ajuda")
    .select(ARTIGO_RESUMO_SELECT)
    .eq("status", "publicado")
    .or(`titulo.ilike.%${seguro}%,resumo.ilike.%${seguro}%,palavras_chave.ilike.%${seguro}%`)
    .order("ordem", { ascending: true });

  if (error) {
    console.error("[help-center] erro ao buscar artigos:", error.message);
    return [];
  }
  return ((data as RawArtigoResumo[] | null) ?? []).map(mapArtigoResumo);
}
```

- [ ] **Step 4: Registrar o export path**

Em `packages/core/package.json`, dentro de `"exports"`, adicione (ordem alfabética, ao lado de `"./features"`):

```json
    "./help-center": "./src/help-center.ts",
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm --filter @mypet/core test -- help-center`
Expected: PASS (7 testes)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/help-center.ts packages/core/src/help-center.test.ts packages/core/package.json
git commit -m "feat(core): leitura publica cacheada da central de ajuda

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Ícones novos em `PaIcon`

**Files:**
- Modify: `apps/mypet/app/_components/pre-access/icon.tsx`
- Test: `apps/mypet/app/_components/pre-access/icon.test.tsx`

**Interfaces:**
- Produces: `PaIcon` passa a aceitar `name` igual a `"Flag"`, `"UserCircle"`, `"Tag"`, `"ArrowsClockwise"`, `"Receipt"` ou `"Handshake"`, além dos já existentes.

- [ ] **Step 1: Escrever o teste**

Adicione ao fim de `apps/mypet/app/_components/pre-access/icon.test.tsx`:

```ts
  it("renderiza os ícones novos da central de ajuda", () => {
    for (const name of ["Flag", "UserCircle", "Tag", "ArrowsClockwise", "Receipt", "Handshake"]) {
      const { container } = render(<PaIcon name={name} />);
      expect(container.querySelector("svg")).not.toBeNull();
    }
  });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter mypet test -- icon`
Expected: FAIL — os 6 nomes novos não existem no `MAP`, `PaIcon` devolve `null` para eles.

- [ ] **Step 3: Adicionar os ícones**

Em `apps/mypet/app/_components/pre-access/icon.tsx`, troque o bloco de import e o `MAP`:

```ts
import type { ComponentType } from "react";
import {
  ArrowsClockwise,
  CreditCard,
  CurrencyCircleDollar,
  Flag,
  Handshake,
  IdentificationCard,
  LockKeyOpen,
  MagnifyingGlass,
  Package,
  Receipt,
  ShoppingCart,
  Star,
  Storefront,
  Tag,
  Truck,
  Headset,
  Stack,
  UserCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { IconProps } from "@phosphor-icons/react";

const MAP: Record<string, ComponentType<IconProps>> = {
  ArrowsClockwise,
  CreditCard,
  CurrencyCircleDollar,
  Flag,
  Handshake,
  IdentificationCard,
  LockKeyOpen,
  MagnifyingGlass,
  Package,
  Receipt,
  ShoppingCart,
  Star,
  Storefront,
  Tag,
  Truck,
  Headset,
  Stack,
  UserCircle,
};
```

(o resto do arquivo, a função `PaIcon`, não muda.)

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter mypet test -- icon`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/_components/pre-access/icon.tsx apps/mypet/app/_components/pre-access/icon.test.tsx
git commit -m "feat(mypet): adiciona icones da central de ajuda ao PaIcon

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Admin — categorias_ajuda (listar + criar + editar)

**Files:**
- Create: `apps/admin/app/(dashboard)/central-ajuda/actions.ts`
- Create: `apps/admin/app/(dashboard)/central-ajuda/page.tsx`
- Create: `apps/admin/app/(dashboard)/central-ajuda/[categoriaId]/page.tsx` (só a parte de editar a categoria; a lista de artigos entra na Task 6)
- Modify: `apps/admin/app/(dashboard)/layout.tsx:5-11` (adiciona item no `NAV`)

**Interfaces:**
- Consumes: `requireAdminSession` de `@/lib/auth`; `slugify`, `isDuplicateSlugError` de `@/lib/categories`.
- Produces:
  - `ICONES_AJUDA` (array de 11 strings, também usado pela Task 6/7 para o `<select>`)
  - `createCategoriaAjuda(formData: FormData): Promise<void>`
  - `updateCategoriaAjuda(id: string, formData: FormData): Promise<void>`

Sem teste automatizado nesta task — o resto de `apps/admin/app` (páginas e Server Actions) não tem teste unitário no repositório hoje (só `apps/admin/lib/*.test.ts` tem); a verificação é rodar o app e conferir na tela (Step 6).

- [ ] **Step 1: Nav**

Em `apps/admin/app/(dashboard)/layout.tsx:5-11`, o array `NAV` fica:

```ts
const NAV = [
  { href: "/clientes", label: "Clientes" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/categorias", label: "Categorias" },
  { href: "/distribuidora-categorias", label: "Categorias Distribuidora" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/central-ajuda", label: "Central de Ajuda" },
  { href: "/funcionalidades", label: "Funcionalidades" },
];
```

- [ ] **Step 2: Server Actions**

Crie `apps/admin/app/(dashboard)/central-ajuda/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { slugify, isDuplicateSlugError } from "@/lib/categories";

export const ICONES_AJUDA = [
  "Flag",
  "UserCircle",
  "Package",
  "Tag",
  "ShoppingCart",
  "CreditCard",
  "Truck",
  "Storefront",
  "ArrowsClockwise",
  "Receipt",
  "Handshake",
] as const;

const CategoriaSchema = z.object({
  titulo: z.string().min(1, "Informe o título."),
  slug: z.string().min(1, "Informe o slug."),
  descricao: z.string().min(1, "Informe a descrição."),
  icone: z.enum(ICONES_AJUDA),
  ordem: z.coerce.number().int().default(0),
});

export async function createCategoriaAjuda(formData: FormData): Promise<void> {
  const { supabase, name } = await requireAdminSession();

  const parsed = CategoriaSchema.safeParse({
    titulo: formData.get("titulo"),
    slug: formData.get("slug") || slugify(String(formData.get("titulo") ?? "")),
    descricao: formData.get("descricao"),
    icone: formData.get("icone"),
    ordem: formData.get("ordem"),
  });
  if (!parsed.success) return;

  const { error } = await supabase.from("categorias_ajuda").insert({
    titulo: parsed.data.titulo,
    slug: parsed.data.slug,
    descricao: parsed.data.descricao,
    icone: parsed.data.icone,
    ordem: parsed.data.ordem,
    atualizado_por: name,
  });

  if (error) {
    if (isDuplicateSlugError(error)) {
      redirect("/central-ajuda?error=slug_duplicado");
    }
    console.error("[admin/central-ajuda] erro ao criar categoria:", error.message);
    redirect("/central-ajuda?error=falha_ao_salvar");
  }

  updateTag("central-ajuda");
  redirect("/central-ajuda");
}

export async function updateCategoriaAjuda(id: string, formData: FormData): Promise<void> {
  const { supabase, name } = await requireAdminSession();

  const parsed = CategoriaSchema.safeParse({
    titulo: formData.get("titulo"),
    slug: formData.get("slug"),
    descricao: formData.get("descricao"),
    icone: formData.get("icone"),
    ordem: formData.get("ordem"),
  });
  if (!parsed.success) return;

  const { error } = await supabase
    .from("categorias_ajuda")
    .update({
      titulo: parsed.data.titulo,
      slug: parsed.data.slug,
      descricao: parsed.data.descricao,
      icone: parsed.data.icone,
      ordem: parsed.data.ordem,
      atualizado_por: name,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (isDuplicateSlugError(error)) {
      redirect(`/central-ajuda/${id}?error=slug_duplicado`);
    }
    console.error("[admin/central-ajuda] erro ao editar categoria:", error.message);
    redirect(`/central-ajuda/${id}?error=falha_ao_salvar`);
  }

  updateTag("central-ajuda");
  redirect("/central-ajuda");
}
```

- [ ] **Step 3: Página de listagem**

Crie `apps/admin/app/(dashboard)/central-ajuda/page.tsx`:

```tsx
import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { createCategoriaAjuda, ICONES_AJUDA } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  slug_duplicado: "Já existe uma categoria com esse slug. Escolha outro.",
  falha_ao_salvar: "Não foi possível salvar a categoria. Tente novamente.",
};

type CategoriaRow = {
  id: string;
  titulo: string;
  slug: string;
  ordem: number;
  artigos: { count: number }[];
};

export default async function CentralAjudaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { error } = await searchParams;

  const { data: categorias } = await supabase
    .from("categorias_ajuda")
    .select("id, titulo, slug, ordem, artigos_ajuda(count)")
    .order("ordem", { ascending: true });

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Central de Ajuda</h1>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={createCategoriaAjuda} className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Título</label>
          <input name="titulo" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug (opcional)</label>
          <input name="slug" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Descrição</label>
          <input name="descricao" required className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ícone</label>
          <select name="icone" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {ICONES_AJUDA.map((icone) => (
              <option key={icone} value={icone}>{icone}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
          <input name="ordem" type="number" defaultValue={0} className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Criar categoria
        </button>
      </form>

      <table className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Título</th>
            <th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3">Artigos</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {((categorias ?? []) as CategoriaRow[]).map((categoria) => (
            <tr key={categoria.id} className="border-b border-slate-100">
              <td className="px-4 py-3">{categoria.titulo}</td>
              <td className="px-4 py-3 text-slate-500">{categoria.slug}</td>
              <td className="px-4 py-3">{categoria.artigos?.[0]?.count ?? 0}</td>
              <td className="px-4 py-3">
                <Link href={`/central-ajuda/${categoria.id}`} className="text-sm font-semibold text-slate-700 underline">
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Página de edição da categoria (sem a lista de artigos ainda — Task 6 completa este arquivo)**

Crie `apps/admin/app/(dashboard)/central-ajuda/[categoriaId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { ICONES_AJUDA, updateCategoriaAjuda } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  slug_duplicado: "Já existe uma categoria com esse slug. Escolha outro.",
  falha_ao_salvar: "Não foi possível salvar a categoria. Tente novamente.",
};

export default async function EditCategoriaAjudaPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoriaId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { categoriaId } = await params;
  const { error } = await searchParams;

  const { data: categoria } = await supabase
    .from("categorias_ajuda")
    .select("id, titulo, slug, descricao, icone, ordem")
    .eq("id", categoriaId)
    .single();
  if (!categoria) notFound();

  const updateWithId = updateCategoriaAjuda.bind(null, categoriaId);

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-xl font-bold text-slate-800">Editar categoria</h1>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={updateWithId} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Título</label>
          <input name="titulo" defaultValue={categoria.titulo} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug</label>
          <input name="slug" defaultValue={categoria.slug} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Descrição</label>
          <input name="descricao" defaultValue={categoria.descricao} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ícone</label>
          <select name="icone" defaultValue={categoria.icone} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {ICONES_AJUDA.map((icone) => (
              <option key={icone} value={icone}>{icone}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
          <input name="ordem" type="number" defaultValue={categoria.ordem} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Salvar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter admin build`
Expected: build sem erro de tipo (pode falhar por falta de variáveis de ambiente locais — nesse caso, rode `pnpm --filter admin exec tsc --noEmit` em vez disso).

- [ ] **Step 6: Verificação manual**

Rode `pnpm --filter admin dev`, entre logado em `/central-ajuda`, crie uma categoria de teste (ex.: título "Teste", descrição "teste", ícone `Flag`) e confirme que ela aparece na tabela e que "Editar" abre o formulário preenchido. Apague a linha de teste direto no banco (`delete from categorias_ajuda where slug = 'teste'`) antes de seguir.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/app/\(dashboard\)/layout.tsx apps/admin/app/\(dashboard\)/central-ajuda
git commit -m "feat(admin): CRUD de categorias da central de ajuda

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Admin — artigos_ajuda (listar dentro da categoria + criar)

**Files:**
- Create: `apps/admin/app/(dashboard)/central-ajuda/[categoriaId]/artigos-actions.ts`
- Modify: `apps/admin/app/(dashboard)/central-ajuda/[categoriaId]/page.tsx` (Task 5) — acrescenta a lista de artigos e o form de criação

**Interfaces:**
- Consumes: `slugify`, `isDuplicateSlugError` de `@/lib/categories`; `requireAdminSession`.
- Produces:
  - `createArtigoAjuda(categoriaId: string, formData: FormData): Promise<void>`
  - `alternarStatusArtigoAjuda(id: string, categoriaId: string, formData: FormData): Promise<void>` — lê `formData.get("novoStatus")` (`"publicado" | "rascunho"`); ao publicar, recusa se `resumo` ou `corpo_markdown` estiverem vazios, redirecionando com `?error=artigo_incompleto`.

- [ ] **Step 1: Server Actions de artigo**

Crie `apps/admin/app/(dashboard)/central-ajuda/[categoriaId]/artigos-actions.ts`:

```ts
"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { slugify, isDuplicateSlugError } from "@/lib/categories";

const NovoArtigoSchema = z.object({
  titulo: z.string().min(1, "Informe o título."),
  slug: z.string().min(1, "Informe o slug."),
});

export async function createArtigoAjuda(categoriaId: string, formData: FormData): Promise<void> {
  const { supabase, name } = await requireAdminSession();

  const parsed = NovoArtigoSchema.safeParse({
    titulo: formData.get("titulo"),
    slug: formData.get("slug") || slugify(String(formData.get("titulo") ?? "")),
  });
  if (!parsed.success) return;

  const { data, error } = await supabase
    .from("artigos_ajuda")
    .insert({
      categoria_id: categoriaId,
      titulo: parsed.data.titulo,
      slug: parsed.data.slug,
      atualizado_por: name,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isDuplicateSlugError(error)) {
      redirect(`/central-ajuda/${categoriaId}?error=slug_duplicado`);
    }
    console.error("[admin/central-ajuda] erro ao criar artigo:", error?.message);
    redirect(`/central-ajuda/${categoriaId}?error=falha_ao_salvar`);
  }

  updateTag("central-ajuda");
  redirect(`/central-ajuda/${categoriaId}/${data.id}`);
}

export async function alternarStatusArtigoAjuda(
  id: string,
  categoriaId: string,
  formData: FormData,
): Promise<void> {
  const { supabase } = await requireAdminSession();
  const novoStatus = String(formData.get("novoStatus") ?? "");
  if (novoStatus !== "publicado" && novoStatus !== "rascunho") return;

  if (novoStatus === "publicado") {
    const { data: artigo } = await supabase
      .from("artigos_ajuda")
      .select("resumo, corpo_markdown")
      .eq("id", id)
      .single();
    if (!artigo?.resumo?.trim() || !artigo?.corpo_markdown?.trim()) {
      redirect(`/central-ajuda/${categoriaId}?error=artigo_incompleto`);
    }
  }

  const { error } = await supabase
    .from("artigos_ajuda")
    .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[admin/central-ajuda] erro ao alternar status:", error.message);
    redirect(`/central-ajuda/${categoriaId}?error=falha_ao_salvar`);
  }

  updateTag("central-ajuda");
  redirect(`/central-ajuda/${categoriaId}`);
}
```

- [ ] **Step 2: Completar a página da categoria com a lista de artigos**

Em `apps/admin/app/(dashboard)/central-ajuda/[categoriaId]/page.tsx`, acrescente os imports:

```ts
import Link from "next/link";
import { createArtigoAjuda, alternarStatusArtigoAjuda } from "./artigos-actions";
```

e, dentro de `EditCategoriaAjudaPage`, adicione ao `ERROR_MESSAGES`:

```ts
  artigo_incompleto: "Preencha resumo e corpo do artigo antes de publicar.",
```

e, após a query de `categoria` e antes do `return`, busque os artigos:

```ts
  const { data: artigos } = await supabase
    .from("artigos_ajuda")
    .select("id, titulo, slug, status, ordem")
    .eq("categoria_id", categoriaId)
    .order("ordem", { ascending: true });
```

e, dentro do `return`, logo depois do `</form>` que edita a categoria, adicione:

```tsx
      <h2 className="mb-4 mt-10 text-lg font-bold text-slate-800">Artigos</h2>

      <form
        action={createArtigoAjuda.bind(null, categoriaId)}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Título do artigo novo</label>
          <input name="titulo" required className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug (opcional)</label>
          <input name="slug" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Criar artigo (rascunho)
        </button>
      </form>

      <table className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Título</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {(artigos ?? []).map((artigo) => (
            <tr key={artigo.id} className="border-b border-slate-100">
              <td className="px-4 py-3">{artigo.titulo}</td>
              <td className="px-4 py-3">
                <span className={artigo.status === "publicado" ? "text-emerald-600" : "text-amber-600"}>
                  {artigo.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <Link href={`/central-ajuda/${categoriaId}/${artigo.id}`} className="text-sm font-semibold text-slate-700 underline">
                  Editar
                </Link>
              </td>
              <td className="px-4 py-3">
                <form action={alternarStatusArtigoAjuda.bind(null, artigo.id, categoriaId)}>
                  <input type="hidden" name="novoStatus" value={artigo.status === "publicado" ? "rascunho" : "publicado"} />
                  <button type="submit" className="rounded-lg px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    {artigo.status === "publicado" ? "Despublicar" : "Publicar"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter admin exec tsc --noEmit`
Expected: sem erro

- [ ] **Step 4: Verificação manual**

Em `/central-ajuda/[categoriaId]` de uma categoria de teste, crie um artigo (nasce rascunho), clique "Publicar" sem preencher resumo/corpo e confirme o erro `artigo_incompleto`. Depois edite direto no banco (`update artigos_ajuda set resumo='r', corpo_markdown='c' where id = '...'`) e clique "Publicar" de novo — confirme que o status vira `publicado`. Apague a linha de teste antes de seguir.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/\(dashboard\)/central-ajuda
git commit -m "feat(admin): criar e publicar/despublicar artigos da central de ajuda

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Admin — editar artigo (formulário completo)

**Files:**
- Create: `apps/admin/app/(dashboard)/central-ajuda/[categoriaId]/[artigoId]/page.tsx`
- Create: `apps/admin/app/(dashboard)/central-ajuda/[categoriaId]/[artigoId]/actions.ts`

**Interfaces:**
- Consumes: `slugify`, `isDuplicateSlugError` de `@/lib/categories`.
- Produces: `updateArtigoAjuda(id: string, categoriaId: string, formData: FormData): Promise<void>`

- [ ] **Step 1: Server Action de edição**

Crie `apps/admin/app/(dashboard)/central-ajuda/[categoriaId]/[artigoId]/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { isDuplicateSlugError } from "@/lib/categories";

const ArtigoSchema = z.object({
  titulo: z.string().min(1, "Informe o título."),
  slug: z.string().min(1, "Informe o slug."),
  resumo: z.string(),
  corpoMarkdown: z.string(),
  palavrasChave: z.string(),
  notaInterna: z.string(),
  ordem: z.coerce.number().int().default(0),
});

export async function updateArtigoAjuda(
  id: string,
  categoriaId: string,
  formData: FormData,
): Promise<void> {
  const { supabase, name } = await requireAdminSession();

  const parsed = ArtigoSchema.safeParse({
    titulo: formData.get("titulo"),
    slug: formData.get("slug"),
    resumo: formData.get("resumo") ?? "",
    corpoMarkdown: formData.get("corpoMarkdown") ?? "",
    palavrasChave: formData.get("palavrasChave") ?? "",
    notaInterna: formData.get("notaInterna") ?? "",
    ordem: formData.get("ordem"),
  });
  if (!parsed.success) return;

  const { error } = await supabase
    .from("artigos_ajuda")
    .update({
      titulo: parsed.data.titulo,
      slug: parsed.data.slug,
      resumo: parsed.data.resumo,
      corpo_markdown: parsed.data.corpoMarkdown,
      palavras_chave: parsed.data.palavrasChave,
      nota_interna: parsed.data.notaInterna || null,
      ordem: parsed.data.ordem,
      atualizado_por: name,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (isDuplicateSlugError(error)) {
      redirect(`/central-ajuda/${categoriaId}/${id}?error=slug_duplicado`);
    }
    console.error("[admin/central-ajuda] erro ao editar artigo:", error.message);
    redirect(`/central-ajuda/${categoriaId}/${id}?error=falha_ao_salvar`);
  }

  updateTag("central-ajuda");
  redirect(`/central-ajuda/${categoriaId}`);
}
```

- [ ] **Step 2: Página de edição**

Crie `apps/admin/app/(dashboard)/central-ajuda/[categoriaId]/[artigoId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { updateArtigoAjuda } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  slug_duplicado: "Já existe um artigo com esse slug. Escolha outro.",
  falha_ao_salvar: "Não foi possível salvar o artigo. Tente novamente.",
};

export default async function EditArtigoAjudaPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoriaId: string; artigoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { categoriaId, artigoId } = await params;
  const { error } = await searchParams;

  const { data: artigo } = await supabase
    .from("artigos_ajuda")
    .select("id, titulo, slug, resumo, corpo_markdown, palavras_chave, nota_interna, ordem, status")
    .eq("id", artigoId)
    .single();
  if (!artigo) notFound();

  const updateWithIds = updateArtigoAjuda.bind(null, artigoId, categoriaId);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-bold text-slate-800">Editar artigo</h1>
      <p className="mb-6 text-sm text-slate-500">
        Status atual: <span className={artigo.status === "publicado" ? "text-emerald-600" : "text-amber-600"}>{artigo.status}</span>
        {" — para publicar ou despublicar, volte para a lista da categoria."}
      </p>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={updateWithIds} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Título</label>
          <input name="titulo" defaultValue={artigo.titulo} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug</label>
          <input name="slug" defaultValue={artigo.slug} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Resumo</label>
          <input name="resumo" defaultValue={artigo.resumo} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Corpo (Markdown)</label>
          <textarea
            name="corpoMarkdown"
            defaultValue={artigo.corpo_markdown}
            rows={20}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Palavras-chave (separadas por espaço)</label>
          <input name="palavrasChave" defaultValue={artigo.palavras_chave} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nota interna (não aparece pro público)</label>
          <textarea
            name="notaInterna"
            defaultValue={artigo.nota_interna ?? ""}
            rows={3}
            className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
          <input name="ordem" type="number" defaultValue={artigo.ordem} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="self-start rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Salvar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter admin exec tsc --noEmit`
Expected: sem erro

- [ ] **Step 4: Verificação manual**

Edite o artigo de teste criado na Task 6: preencha resumo, corpo em Markdown (ex.: `## Título\n\n- item 1\n- item 2`) e nota interna; salve; confirme que volta para a lista da categoria com os dados salvos ao reabrir "Editar".

- [ ] **Step 5: Commit**

```bash
git add "apps/admin/app/(dashboard)/central-ajuda/[categoriaId]/[artigoId]"
git commit -m "feat(admin): formulario completo de edicao de artigo da central de ajuda

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Estilos públicos — `LANDING_STYLES`

**Files:**
- Modify: `apps/mypet/app/_components/pre-access/styles.ts`

**Interfaces:**
- Produces: classes `.pa-help-grid`, `.pa-help-card`, `.pa-help-icon`, `.pa-help-list`, `.pa-help-list a`, `.pa-help-article`, `.pa-help-article table`, `.pa-help-search`, usadas pelas Tasks 10–13.

- [ ] **Step 1: Acrescentar a seção de estilos**

No fim de `apps/mypet/app/_components/pre-access/styles.ts`, antes do fechamento da template string (depois da regra `@media (max-width: 560px)` no final do arquivo), adicione:

```css

  /* central de ajuda */
  .pa-help-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 28px; }
  .pa-help-card { display: flex; flex-direction: column; gap: 10px; text-decoration: none; }
  .pa-help-icon { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: var(--pa-r-pill); background: var(--pa-green-soft); color: var(--pa-green-dark); }
  .pa-help-card h3 { font-family: var(--pa-geist); font-weight: 600; color: var(--pa-navy); font-size: 16px; margin: 0; }
  .pa-help-card p { color: var(--pa-muted); font-size: 13px; line-height: 1.5; margin: 0; }

  .pa-help-list { margin-top: 24px; border-top: 1px solid var(--pa-line); }
  .pa-help-list a { display: block; padding: 18px 4px; border-bottom: 1px solid var(--pa-line); text-decoration: none; }
  .pa-help-list a:hover .pa-help-list-title { color: var(--pa-green-dark); }
  .pa-help-list-title { display: block; font-family: var(--pa-geist); font-weight: 600; font-size: 15px; color: var(--pa-navy); }
  .pa-help-list-sub { display: block; margin-top: 4px; color: var(--pa-muted); font-size: 13px; }
  .pa-help-empty { color: var(--pa-muted); font-size: 14px; padding: 24px 0; }

  .pa-help-article { max-width: 68ch; }
  .pa-help-article h1 { font-family: var(--pa-geist); font-weight: 700; color: var(--pa-navy); font-size: clamp(24px, 3.2vw, 32px); margin: 0 0 20px; }
  .pa-help-article h3 { font-family: var(--pa-geist); font-weight: 600; color: var(--pa-navy); font-size: 18px; margin: 24px 0 8px; }
  .pa-help-article p { color: var(--pa-ink); font-size: 15px; line-height: 1.7; margin: 0 0 14px; }
  .pa-help-article ul, .pa-help-article ol { margin: 0 0 14px; padding-left: 22px; color: var(--pa-ink); font-size: 15px; line-height: 1.7; }
  .pa-help-article li { margin-bottom: 6px; }
  .pa-help-article strong { color: var(--pa-navy); }
  .pa-help-article table { border-collapse: collapse; width: 100%; margin: 4px 0 16px; font-size: 14px; }
  .pa-help-article th, .pa-help-article td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--pa-line); }
  .pa-help-article th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--pa-muted); }
  .pa-help-article blockquote { margin: 0 0 16px; padding: 12px 16px; background: var(--pa-green-soft); border-radius: var(--pa-r-input); color: var(--pa-ink); font-size: 14px; }
  .pa-help-related { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--pa-line); }
  .pa-help-related h4 { font-family: var(--pa-geist); font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--pa-muted); margin: 0 0 10px; }
  .pa-help-related a { display: block; color: var(--pa-green-dark); font-weight: 600; font-size: 14px; text-decoration: none; margin-bottom: 6px; }

  .pa-help-search { display: flex; gap: 10px; max-width: 480px; }
  .pa-help-search input { flex: 1; padding: 12px 14px; border: 1.5px solid var(--pa-line); border-radius: var(--pa-r-input); font-size: 15px; font-family: inherit; }
  .pa-help-search button { padding: 12px 20px; border: 0; border-radius: var(--pa-r-input); background: var(--pa-green); color: #fff; font-family: var(--pa-geist); font-weight: 600; cursor: pointer; }
  .pa-help-search button:hover { background: var(--pa-green-dark); }
`;
```

Atenção: a última linha do arquivo hoje é `` `; `` fechando a template string — mova esse fechamento para depois do bloco novo (não duplique o `` `; ``).

- [ ] **Step 2: Confirmar que o arquivo ainda é um módulo válido**

Run: `pnpm --filter mypet exec tsc --noEmit`
Expected: sem erro de sintaxe

- [ ] **Step 3: Commit**

```bash
git add apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(mypet): estilos da central de ajuda publica

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Renderizador de Markdown

**Files:**
- Create: `apps/mypet/app/central-de-ajuda/markdown.ts`
- Test: `apps/mypet/app/central-de-ajuda/markdown.test.ts`
- Modify: `apps/mypet/package.json` (dependência `marked`)

**Interfaces:**
- Produces: `renderizarMarkdown(corpo: string): string`

- [ ] **Step 1: Adicionar a dependência**

Em `apps/mypet/package.json`, dentro de `"dependencies"` (ordem alfabética, antes de `"next"`):

```json
    "marked": "^15.0.7",
```

Run: `pnpm install`

- [ ] **Step 2: Escrever o teste**

Crie `apps/mypet/app/central-de-ajuda/markdown.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderizarMarkdown } from "./markdown";

describe("renderizarMarkdown", () => {
  it("converte título, negrito e lista", () => {
    const html = renderizarMarkdown("## Pedido mínimo\n\n**R$ 250,00** na capital.\n\n- item 1\n- item 2");
    expect(html).toContain("<h2>Pedido mínimo</h2>");
    expect(html).toContain("<strong>R$ 250,00</strong>");
    expect(html).toContain("<li>item 1</li>");
  });

  it("converte tabela", () => {
    const html = renderizarMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("converte link", () => {
    const html = renderizarMarkdown("[texto](/central-de-ajuda/a/pedido-minimo)");
    expect(html).toBe('<p><a href="/central-de-ajuda/a/pedido-minimo">texto</a></p>\n');
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `pnpm --filter mypet test -- markdown`
Expected: FAIL — `./markdown` não existe.

- [ ] **Step 4: Implementar**

Crie `apps/mypet/app/central-de-ajuda/markdown.ts`:

```ts
import { marked } from "marked";

marked.setOptions({ gfm: true });

/**
 * Converte o corpo em Markdown do artigo para HTML. O conteúdo é escrito só
 * pelo admin (Task 7), nunca por visitante — não há sanitização de HTML
 * arbitrário aqui.
 */
export function renderizarMarkdown(corpo: string): string {
  return marked.parse(corpo, { async: false }) as string;
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm --filter mypet test -- markdown`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/package.json pnpm-lock.yaml apps/mypet/app/central-de-ajuda/markdown.ts apps/mypet/app/central-de-ajuda/markdown.test.ts
git commit -m "feat(mypet): renderizador de markdown da central de ajuda

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Página pública — home (`/central-de-ajuda`)

**Files:**
- Create: `apps/mypet/app/central-de-ajuda/page.tsx`
- Test: `apps/mypet/app/central-de-ajuda/page.test.tsx`

**Interfaces:**
- Consumes: `getCategoriasAjuda` de `@mypet/core/help-center`; `PaIcon` de `../_components/pre-access/icon`; `LANDING_STYLES` de `../_components/pre-access/styles`.

- [ ] **Step 1: Escrever o teste**

Crie `apps/mypet/app/central-de-ajuda/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@mypet/core/help-center", () => ({
  getCategoriasAjuda: async () => [
    { id: "c1", slug: "precos", titulo: "Preços", descricao: "Pedido mínimo e descontos", icone: "Tag", ordem: 0 },
  ],
}));

import CentralDeAjudaPage from "./page";

describe("CentralDeAjudaPage", () => {
  it("lista as categorias vindas de getCategoriasAjuda", async () => {
    render(await CentralDeAjudaPage());
    expect(screen.getByText("Preços")).toBeInTheDocument();
    expect(screen.getByText("Pedido mínimo e descontos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Preços/ })).toHaveAttribute("href", "/central-de-ajuda/c/precos");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter mypet test -- central-de-ajuda/page`
Expected: FAIL — `./page` não existe.

- [ ] **Step 3: Implementar**

Crie `apps/mypet/app/central-de-ajuda/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getCategoriasAjuda } from "@mypet/core/help-center";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { PaIcon } from "../_components/pre-access/icon";
import { LANDING_STYLES } from "../_components/pre-access/styles";

const { name: SITE_NAME, logo } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `Central de ajuda - ${SITE_NAME}`,
    description: "Tudo o que você precisa saber para comprar da My Pet: cadastro, preços, pagamento e entrega.",
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/central-de-ajuda") },
  };
}

export default async function CentralDeAjudaPage() {
  const categorias = await getCategoriasAjuda();

  return (
    <>
      <style>{LANDING_STYLES}</style>

      <header className="pa-header">
        <div className="pa-wrap pa-header-row">
          <a href="/" className="pa-brand" style={{ textDecoration: "none" }}>
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </a>
          <nav className="pa-nav" aria-label="Seções da página">
            <a href="/central-de-ajuda/busca" className="pa-nav-cta">Buscar</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="pa-section" aria-labelledby="central-ajuda-title">
          <div className="pa-wrap" style={{ maxWidth: 960 }}>
            <h1 id="central-ajuda-title" className="pa-h2">Central de ajuda</h1>
            <p className="pa-sec-lead">
              Encontre sua dúvida por categoria: cadastro, preços, pagamento, entrega e muito mais.
            </p>

            <div className="pa-help-grid">
              {categorias.map((categoria) => (
                <Link key={categoria.id} href={`/central-de-ajuda/c/${categoria.slug}`} className="pa-help-card">
                  <span className="pa-help-icon">
                    <PaIcon name={categoria.icone} size={22} />
                  </span>
                  <h3>{categoria.titulo}</h3>
                  <p>{categoria.descricao}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="pa-footer">
        <div className="pa-wrap pa-footer-row">
          <div className="pa-footer-brand">
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </div>
          <small>
            © {SITE_NAME}. Desenvolvido por{" "}
            <a href="https://www.zemann.com.br" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
              Zemann.ai
            </a>
          </small>
        </div>
      </footer>
    </>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter mypet test -- central-de-ajuda/page`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/central-de-ajuda/page.tsx apps/mypet/app/central-de-ajuda/page.test.tsx
git commit -m "feat(mypet): pagina inicial publica da central de ajuda

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Página pública — categoria (`/central-de-ajuda/c/[categoriaSlug]`)

**Files:**
- Create: `apps/mypet/app/central-de-ajuda/c/[categoriaSlug]/page.tsx`
- Test: `apps/mypet/app/central-de-ajuda/c/[categoriaSlug]/page.test.tsx`

**Interfaces:**
- Consumes: `getCategoriaAjudaBySlug`, `getArtigosAjudaPublicadosPorCategoria` de `@mypet/core/help-center`.

- [ ] **Step 1: Escrever o teste**

Crie `apps/mypet/app/central-de-ajuda/c/[categoriaSlug]/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const getCategoriaAjudaBySlug = vi.fn();
const getArtigosAjudaPublicadosPorCategoria = vi.fn();
vi.mock("@mypet/core/help-center", () => ({
  getCategoriaAjudaBySlug: (slug: string) => getCategoriaAjudaBySlug(slug),
  getArtigosAjudaPublicadosPorCategoria: (id: string) => getArtigosAjudaPublicadosPorCategoria(id),
}));

import CategoriaAjudaPage from "./page";

beforeEach(() => {
  notFound.mockClear();
  getCategoriaAjudaBySlug.mockReset();
  getArtigosAjudaPublicadosPorCategoria.mockReset();
});

describe("CategoriaAjudaPage", () => {
  it("chama notFound quando a categoria não existe", async () => {
    getCategoriaAjudaBySlug.mockResolvedValue(null);
    await expect(
      CategoriaAjudaPage({ params: Promise.resolve({ categoriaSlug: "nao-existe" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("lista os artigos publicados da categoria", async () => {
    getCategoriaAjudaBySlug.mockResolvedValue({ id: "c1", slug: "precos", titulo: "Preços", descricao: "d", icone: "Tag", ordem: 0 });
    getArtigosAjudaPublicadosPorCategoria.mockResolvedValue([
      { id: "a1", categoriaId: "c1", slug: "pedido-minimo", titulo: "Pedido mínimo", resumo: "R$ 250 na capital", ordem: 0 },
    ]);
    render(await CategoriaAjudaPage({ params: Promise.resolve({ categoriaSlug: "precos" }) }));
    expect(screen.getByRole("heading", { name: "Preços" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pedido mínimo/ })).toHaveAttribute("href", "/central-de-ajuda/a/pedido-minimo");
  });

  it("mostra estado vazio quando não há artigo publicado", async () => {
    getCategoriaAjudaBySlug.mockResolvedValue({ id: "c1", slug: "precos", titulo: "Preços", descricao: "d", icone: "Tag", ordem: 0 });
    getArtigosAjudaPublicadosPorCategoria.mockResolvedValue([]);
    render(await CategoriaAjudaPage({ params: Promise.resolve({ categoriaSlug: "precos" }) }));
    expect(screen.getByText(/Nenhum artigo publicado/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter mypet test -- central-de-ajuda/c`
Expected: FAIL — `./page` não existe.

- [ ] **Step 3: Implementar**

Crie `apps/mypet/app/central-de-ajuda/c/[categoriaSlug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoriaAjudaBySlug, getArtigosAjudaPublicadosPorCategoria } from "@mypet/core/help-center";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { LANDING_STYLES } from "../../../_components/pre-access/styles";

const { name: SITE_NAME, logo } = clientConfig;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoriaSlug: string }>;
}): Promise<Metadata> {
  const { categoriaSlug } = await params;
  const categoria = await getCategoriaAjudaBySlug(categoriaSlug);
  return {
    title: categoria ? `${categoria.titulo} - Central de ajuda - ${SITE_NAME}` : `Central de ajuda - ${SITE_NAME}`,
    description: categoria?.descricao,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/central-de-ajuda/c/${categoriaSlug}`) },
  };
}

export default async function CategoriaAjudaPage({
  params,
}: {
  params: Promise<{ categoriaSlug: string }>;
}) {
  const { categoriaSlug } = await params;
  const categoria = await getCategoriaAjudaBySlug(categoriaSlug);
  if (!categoria) notFound();

  const artigos = await getArtigosAjudaPublicadosPorCategoria(categoria.id);

  return (
    <>
      <style>{LANDING_STYLES}</style>

      <header className="pa-header">
        <div className="pa-wrap pa-header-row">
          <a href="/" className="pa-brand" style={{ textDecoration: "none" }}>
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </a>
          <nav className="pa-nav" aria-label="Seções da página">
            <a href="/central-de-ajuda/busca" className="pa-nav-cta">Buscar</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="pa-section" aria-labelledby="categoria-title">
          <div className="pa-wrap" style={{ maxWidth: 820 }}>
            <Link href="/central-de-ajuda" className="pa-cadastro-back">&larr; Central de ajuda</Link>
            <h1 id="categoria-title" className="pa-h2" style={{ marginTop: 16 }}>{categoria.titulo}</h1>
            <p className="pa-sec-lead">{categoria.descricao}</p>

            {artigos.length === 0 ? (
              <p className="pa-help-empty">Nenhum artigo publicado nesta categoria ainda.</p>
            ) : (
              <div className="pa-help-list">
                {artigos.map((artigo) => (
                  <Link key={artigo.id} href={`/central-de-ajuda/a/${artigo.slug}`}>
                    <span className="pa-help-list-title">{artigo.titulo}</span>
                    <span className="pa-help-list-sub">{artigo.resumo}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="pa-footer">
        <div className="pa-wrap pa-footer-row">
          <div className="pa-footer-brand">
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </div>
          <small>© {SITE_NAME}.</small>
        </div>
      </footer>
    </>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter mypet test -- central-de-ajuda/c`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "apps/mypet/app/central-de-ajuda/c"
git commit -m "feat(mypet): pagina publica de categoria da central de ajuda

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Página pública — artigo (`/central-de-ajuda/a/[artigoSlug]`)

**Files:**
- Create: `apps/mypet/app/central-de-ajuda/a/[artigoSlug]/page.tsx`
- Test: `apps/mypet/app/central-de-ajuda/a/[artigoSlug]/page.test.tsx`

**Interfaces:**
- Consumes: `getArtigoAjudaPublicadoBySlug`, `getArtigosAjudaPublicadosPorCategoria` de `@mypet/core/help-center`; `renderizarMarkdown` de `../../markdown` (Task 9).

- [ ] **Step 1: Escrever o teste**

Crie `apps/mypet/app/central-de-ajuda/a/[artigoSlug]/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const getArtigoAjudaPublicadoBySlug = vi.fn();
const getArtigosAjudaPublicadosPorCategoria = vi.fn();
vi.mock("@mypet/core/help-center", () => ({
  getArtigoAjudaPublicadoBySlug: (slug: string) => getArtigoAjudaPublicadoBySlug(slug),
  getArtigosAjudaPublicadosPorCategoria: (id: string) => getArtigosAjudaPublicadosPorCategoria(id),
}));

import ArtigoAjudaPage from "./page";

beforeEach(() => {
  notFound.mockClear();
  getArtigoAjudaPublicadoBySlug.mockReset();
  getArtigosAjudaPublicadosPorCategoria.mockReset();
});

describe("ArtigoAjudaPage", () => {
  it("chama notFound quando o artigo não existe ou está em rascunho", async () => {
    getArtigoAjudaPublicadoBySlug.mockResolvedValue(null);
    await expect(
      ArtigoAjudaPage({ params: Promise.resolve({ artigoSlug: "nao-existe" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("renderiza o título e o corpo em Markdown, e os artigos relacionados", async () => {
    getArtigoAjudaPublicadoBySlug.mockResolvedValue({
      id: "a1", categoriaId: "c1", slug: "pedido-minimo", titulo: "Pedido mínimo",
      resumo: "r", ordem: 0, corpoMarkdown: "**R$ 250,00** na capital.",
    });
    getArtigosAjudaPublicadosPorCategoria.mockResolvedValue([
      { id: "a1", categoriaId: "c1", slug: "pedido-minimo", titulo: "Pedido mínimo", resumo: "r", ordem: 0 },
      { id: "a2", categoriaId: "c1", slug: "desconto-avista", titulo: "Desconto à vista", resumo: "r2", ordem: 1 },
    ]);
    render(await ArtigoAjudaPage({ params: Promise.resolve({ artigoSlug: "pedido-minimo" }) }));
    expect(screen.getByRole("heading", { name: "Pedido mínimo" })).toBeInTheDocument();
    expect(screen.getByText("R$ 250,00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Desconto à vista" })).toHaveAttribute("href", "/central-de-ajuda/a/desconto-avista");
    expect(screen.queryByRole("link", { name: "Pedido mínimo" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter mypet test -- central-de-ajuda/a`
Expected: FAIL — `./page` não existe.

- [ ] **Step 3: Implementar**

Crie `apps/mypet/app/central-de-ajuda/a/[artigoSlug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtigoAjudaPublicadoBySlug, getArtigosAjudaPublicadosPorCategoria } from "@mypet/core/help-center";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { LANDING_STYLES } from "../../../_components/pre-access/styles";
import { renderizarMarkdown } from "../../markdown";

const { name: SITE_NAME, logo } = clientConfig;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ artigoSlug: string }>;
}): Promise<Metadata> {
  const { artigoSlug } = await params;
  const artigo = await getArtigoAjudaPublicadoBySlug(artigoSlug);
  return {
    title: artigo ? `${artigo.titulo} - Central de ajuda - ${SITE_NAME}` : `Central de ajuda - ${SITE_NAME}`,
    description: artigo?.resumo,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/central-de-ajuda/a/${artigoSlug}`) },
  };
}

export default async function ArtigoAjudaPage({
  params,
}: {
  params: Promise<{ artigoSlug: string }>;
}) {
  const { artigoSlug } = await params;
  const artigo = await getArtigoAjudaPublicadoBySlug(artigoSlug);
  if (!artigo) notFound();

  const relacionados = (await getArtigosAjudaPublicadosPorCategoria(artigo.categoriaId)).filter(
    (a) => a.id !== artigo.id,
  );

  return (
    <>
      <style>{LANDING_STYLES}</style>

      <header className="pa-header">
        <div className="pa-wrap pa-header-row">
          <a href="/" className="pa-brand" style={{ textDecoration: "none" }}>
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </a>
          <nav className="pa-nav" aria-label="Seções da página">
            <a href="/central-de-ajuda/busca" className="pa-nav-cta">Buscar</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="pa-section" aria-labelledby="artigo-title">
          <div className="pa-wrap" style={{ maxWidth: 820 }}>
            <Link href="/central-de-ajuda" className="pa-cadastro-back">&larr; Central de ajuda</Link>
            <article className="pa-help-article" style={{ marginTop: 16 }}>
              <h1 id="artigo-title">{artigo.titulo}</h1>
              <div dangerouslySetInnerHTML={{ __html: renderizarMarkdown(artigo.corpoMarkdown) }} />
            </article>

            {relacionados.length > 0 && (
              <div className="pa-help-related">
                <h4>Veja também</h4>
                {relacionados.map((a) => (
                  <Link key={a.id} href={`/central-de-ajuda/a/${a.slug}`}>{a.titulo}</Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="pa-footer">
        <div className="pa-wrap pa-footer-row">
          <div className="pa-footer-brand">
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </div>
          <small>© {SITE_NAME}.</small>
        </div>
      </footer>
    </>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter mypet test -- central-de-ajuda/a`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "apps/mypet/app/central-de-ajuda/a"
git commit -m "feat(mypet): pagina publica de artigo da central de ajuda

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Página pública — busca + link a partir de `/perguntas-frequentes`

**Files:**
- Create: `apps/mypet/app/central-de-ajuda/busca/page.tsx`
- Test: `apps/mypet/app/central-de-ajuda/busca/page.test.tsx`
- Modify: `apps/mypet/app/perguntas-frequentes/page.tsx`

**Interfaces:**
- Consumes: `buscarArtigosAjudaPublicados` de `@mypet/core/help-center`.

- [ ] **Step 1: Escrever o teste**

Crie `apps/mypet/app/central-de-ajuda/busca/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const buscarArtigosAjudaPublicados = vi.fn();
vi.mock("@mypet/core/help-center", () => ({
  buscarArtigosAjudaPublicados: (termo: string) => buscarArtigosAjudaPublicados(termo),
}));

import BuscaAjudaPage from "./page";

beforeEach(() => {
  buscarArtigosAjudaPublicados.mockReset();
});

describe("BuscaAjudaPage", () => {
  it("não busca quando não há termo na query", async () => {
    render(await BuscaAjudaPage({ searchParams: Promise.resolve({}) }));
    expect(buscarArtigosAjudaPublicados).not.toHaveBeenCalled();
  });

  it("busca e lista os resultados quando há termo", async () => {
    buscarArtigosAjudaPublicados.mockResolvedValue([
      { id: "a1", categoriaId: "c1", slug: "pedido-minimo", titulo: "Pedido mínimo", resumo: "R$ 250 na capital", ordem: 0 },
    ]);
    render(await BuscaAjudaPage({ searchParams: Promise.resolve({ q: "pedido" }) }));
    expect(buscarArtigosAjudaPublicados).toHaveBeenCalledWith("pedido");
    expect(screen.getByRole("link", { name: /Pedido mínimo/ })).toHaveAttribute("href", "/central-de-ajuda/a/pedido-minimo");
  });

  it("mostra estado vazio quando a busca não acha nada", async () => {
    buscarArtigosAjudaPublicados.mockResolvedValue([]);
    render(await BuscaAjudaPage({ searchParams: Promise.resolve({ q: "xyz" }) }));
    expect(screen.getByText(/Nenhum artigo encontrado/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter mypet test -- central-de-ajuda/busca`
Expected: FAIL — `./page` não existe.

- [ ] **Step 3: Implementar a busca**

Crie `apps/mypet/app/central-de-ajuda/busca/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { buscarArtigosAjudaPublicados } from "@mypet/core/help-center";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { LANDING_STYLES } from "../../_components/pre-access/styles";

const { name: SITE_NAME, logo } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `Buscar - Central de ajuda - ${SITE_NAME}`,
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/central-de-ajuda/busca") },
  };
}

export default async function BuscaAjudaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const termo = q?.trim() ?? "";
  const resultados = termo ? await buscarArtigosAjudaPublicados(termo) : [];

  return (
    <>
      <style>{LANDING_STYLES}</style>

      <header className="pa-header">
        <div className="pa-wrap pa-header-row">
          <a href="/" className="pa-brand" style={{ textDecoration: "none" }}>
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </a>
        </div>
      </header>

      <main>
        <section className="pa-section" aria-labelledby="busca-title">
          <div className="pa-wrap" style={{ maxWidth: 820 }}>
            <Link href="/central-de-ajuda" className="pa-cadastro-back">&larr; Central de ajuda</Link>
            <h1 id="busca-title" className="pa-h2" style={{ marginTop: 16 }}>Buscar na central de ajuda</h1>

            <form action="/central-de-ajuda/busca" method="get" className="pa-help-search" style={{ marginTop: 20 }}>
              <input type="search" name="q" defaultValue={termo} placeholder="Ex.: pedido mínimo, Pix, prazo de entrega" />
              <button type="submit">Buscar</button>
            </form>

            {termo && (
              resultados.length === 0 ? (
                <p className="pa-help-empty">Nenhum artigo encontrado para &quot;{termo}&quot;.</p>
              ) : (
                <div className="pa-help-list" style={{ marginTop: 24 }}>
                  {resultados.map((artigo) => (
                    <Link key={artigo.id} href={`/central-de-ajuda/a/${artigo.slug}`}>
                      <span className="pa-help-list-title">{artigo.titulo}</span>
                      <span className="pa-help-list-sub">{artigo.resumo}</span>
                    </Link>
                  ))}
                </div>
              )
            )}
          </div>
        </section>
      </main>

      <footer className="pa-footer">
        <div className="pa-wrap pa-footer-row">
          <div className="pa-footer-brand">
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </div>
          <small>© {SITE_NAME}.</small>
        </div>
      </footer>
    </>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter mypet test -- central-de-ajuda/busca`
Expected: PASS

- [ ] **Step 5: Linkar a partir de `/perguntas-frequentes`**

Em `apps/mypet/app/perguntas-frequentes/page.tsx`, logo depois do parágrafo `<p className="pa-sec-lead">...</p>` (antes de `<div className="pa-faq-list">`), adicione:

```tsx
            <p className="pa-sec-lead" style={{ marginTop: 8 }}>
              Veja também a <a href="/central-de-ajuda">central de ajuda</a>, organizada por categoria.
            </p>
```

- [ ] **Step 6: Rodar toda a suíte de `mypet`**

Run: `pnpm --filter mypet test`
Expected: PASS (nenhum teste quebrado por essa edição)

- [ ] **Step 7: Commit**

```bash
git add "apps/mypet/app/central-de-ajuda/busca" apps/mypet/app/perguntas-frequentes/page.tsx
git commit -m "feat(mypet): busca da central de ajuda e link a partir do FAQ antigo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: Seed — 48 artigos em rascunho

**Files:**
- Create: `scripts/seed-central-ajuda.ts`
- Modify: `package.json` (novo script `central-ajuda:seed`)

**Interfaces:**
- Consumes: `getHubServiceClient` de `@mypet/core/supabase` (é uma escrita em massa feita uma vez, fora do fluxo normal do admin — usa service role, como os outros scripts em `scripts/`).

O conteúdo vem do Artifact `central-de-ajuda-mypet.html` (revisão do dono em 2026-09-23), convertido de HTML para Markdown artigo por artigo, preservando as 4 decisões (5% à vista, atacado só pra lojista, Show Room com pedido mínimo R$ 150, sem personalização). Todos nascem `status: "rascunho"`.

- [ ] **Step 1: Escrever o script**

Crie `scripts/seed-central-ajuda.ts`:

```ts
import { getHubServiceClient } from "@mypet/core/supabase";

type Categoria = {
  slug: string;
  titulo: string;
  descricao: string;
  icone: string;
  ordem: number;
};

type Artigo = {
  categoriaSlug: string;
  slug: string;
  titulo: string;
  resumo: string;
  corpoMarkdown: string;
  palavrasChave: string;
  notaInterna?: string;
  ordem: number;
};

const CATEGORIAS: Categoria[] = [
  { slug: "primeiros-passos", titulo: "Primeiros passos", descricao: "Quem pode comprar e como começar a revender.", icone: "Flag", ordem: 0 },
  { slug: "cadastro", titulo: "Cadastro e acesso", descricao: "Criar o acesso à loja e ver os preços.", icone: "UserCircle", ordem: 1 },
  { slug: "catalogo", titulo: "Catálogo e produtos", descricao: "Catálogo, estoque, modelos e produtos esgotados.", icone: "Package", ordem: 2 },
  { slug: "precos", titulo: "Preços, mínimo e descontos", descricao: "Pedido mínimo, preço de atacado e desconto à vista.", icone: "Tag", ordem: 3 },
  { slug: "pedido", titulo: "Como fazer um pedido", descricao: "Pedir pelo site ou WhatsApp, incluir itens, usar crédito.", icone: "ShoppingCart", ordem: 4 },
  { slug: "pagamento", titulo: "Pagamento", descricao: "Pix, cartão em até 10x, boleto e comprovantes.", icone: "CreditCard", ordem: 5 },
  { slug: "entrega", titulo: "Frete e entrega", descricao: "Prazos por região, frete e rastreio.", icone: "Truck", ordem: 6 },
  { slug: "loja", titulo: "Show Room", descricao: "Compre direto do estoque e leve hoje. Mínimo de R$ 150.", icone: "Storefront", ordem: 7 },
  { slug: "trocas", titulo: "Trocas e problemas", descricao: "Item faltando, avaria, estorno e crédito.", icone: "ArrowsClockwise", ordem: 8 },
  { slug: "notas", titulo: "Notas fiscais", descricao: "Nota fiscal, XML e segunda via.", icone: "Receipt", ordem: 9 },
  { slug: "parcerias", titulo: "Parcerias", descricao: "Representação, grande volume, fornecedores.", icone: "Handshake", ordem: 10 },
];

const ARTIGOS: Artigo[] = [
  // Primeiros passos
  {
    categoriaSlug: "primeiros-passos", slug: "como-comprar", ordem: 0,
    titulo: "Como comprar da My Pet Brasil em 3 passos",
    resumo: "O caminho completo, do cadastro à entrega.",
    palavrasChave: "comecar comprar atacado revenda como funciona",
    corpoMarkdown: `A My Pet Brasil é uma distribuidora de produtos pet que vende no atacado para lojistas: pet shops, agropets, casas de ração, clínicas e lojas online. São cerca de 5 mil itens.

1. **Crie seu acesso** em [www.mypetbrasil.com](https://www.mypetbrasil.com) com CNPJ ou CPF e WhatsApp. É com esse acesso que os preços aparecem.
2. **Monte o pedido no carrinho.** Informe o CEP para ver o frete. O pedido mínimo é **R$ 250,00** na capital de São Paulo e **R$ 400,00** nas demais regiões — ou **R$ 150,00** comprando pessoalmente no [Show Room](/central-de-ajuda/a/showroom).
3. **Pague e acompanhe.** Pix com 5% de desconto, cartão em até 10x sem juros, depósito ou boleto. A separação e o despacho levam até 7 dias úteis.

> Dica: ficou alguma dúvida no meio do caminho? Fale com a gente pelo WhatsApp, no mesmo número em que você nos encontrou.`,
  },
  {
    categoriaSlug: "primeiros-passos", slug: "cpf-cnpj", ordem: 1,
    titulo: "Vocês vendem para CPF ou só para CNPJ?",
    resumo: "CPF e CNPJ, com o mesmo preço.",
    palavrasChave: "cpf cnpj pessoa fisica mei cnae sem cnpj",
    corpoMarkdown: `Atendemos **CPF e CNPJ, com o mesmo preço**. O documento serve apenas para identificar a sua loja no cadastro de acesso.

Você pode começar com CPF enquanto ainda está abrindo a empresa. Não pedimos CNAE específico.

A única diferença está no [boleto faturado](/central-de-ajuda/a/boleto-faturado), que exige CNPJ com mais de 2 anos e histórico de compras.`,
  },
  {
    categoriaSlug: "primeiros-passos", slug: "consumidor-final", ordem: 2,
    titulo: "Vocês vendem para consumidor final?",
    resumo: "Não. Nossos preços são somente de atacado, para lojistas.",
    palavrasChave: "consumidor final varejo comprar uma unidade para meu pet",
    corpoMarkdown: `Não. Nossos preços são somente de atacado e não atendemos consumidor final, nem no site nem no Show Room. Nossos produtos podem ser encontrados com nossos clientes lojistas, inclusive em marketplaces.`,
  },
  {
    categoriaSlug: "primeiros-passos", slug: "abrindo-loja", ordem: 3,
    titulo: "Estou abrindo minha loja. Por onde começo?",
    resumo: "Um roteiro para montar o primeiro estoque.",
    palavrasChave: "abrindo loja casa de racao primeiro estoque montar novo",
    notaInterna: "Confirmar que \"não é preciso comprar caixa fechada\" vale para a loja online.",
    corpoMarkdown: `1. **Crie o acesso com CPF** se o CNPJ ainda não saiu. Depois dá para atualizar o cadastro.
2. **Navegue pelo catálogo por categoria** (higiene, acessórios, camas, brinquedos, aves etc.) e monte o carrinho aos poucos. O carrinho funciona como orçamento: mostra total e frete.
3. **Planeje o primeiro pedido** a partir do mínimo de **R$ 250,00** (capital de SP) ou **R$ 400,00** (demais regiões). Não é preciso comprar caixa fechada de um único item.
4. **Pague à vista ou no cartão.** A primeira compra é sempre à vista (com 5% de desconto) ou no cartão, em até 10x sem juros.`,
  },

  // Cadastro
  {
    categoriaSlug: "cadastro", slug: "criar-acesso", ordem: 0,
    titulo: "Como criar meu acesso à loja",
    resumo: "CNPJ ou CPF e WhatsApp.",
    palavrasChave: "cadastro cadastrar criar conta acesso login",
    notaInterna: "Confirmar se o acesso é liberado na hora ou passa por aprovação manual, e qual é o link oficial de cadastro.",
    corpoMarkdown: `1. Acesse [www.mypetbrasil.com](https://www.mypetbrasil.com).
2. Clique em cadastrar e informe **CNPJ ou CPF** e o seu **WhatsApp**.
3. Com o acesso criado, você vê preços, estoque, frete e prazo de todos os itens.

O endereço do cadastro é o endereço de entrega. Confira antes de fazer o primeiro pedido.`,
  },
  {
    categoriaSlug: "cadastro", slug: "ver-precos", ordem: 1,
    titulo: "Por que não vejo os preços?",
    resumo: "Os preços aparecem depois de criar o acesso.",
    palavrasChave: "nao vejo precos valores ver preco tabela",
    corpoMarkdown: `Os preços ficam na loja e só aparecem **depois de criar o acesso** com CNPJ ou CPF e WhatsApp. Se você já tem acesso e não vê os preços, confira se está logado.

São cerca de 5 mil itens com preços que mudam diariamente. Por isso eles não ficam no catálogo público nem numa tabela em PDF.`,
  },
  {
    categoriaSlug: "cadastro", slug: "senha", ordem: 2,
    titulo: "Esqueci minha senha",
    resumo: "Como recuperar o acesso.",
    palavrasChave: "senha esqueci login entrar recuperar",
    notaInterna: "Sem regra oficial. Confirmar como a recuperação de senha funciona hoje na loja (e-mail ou WhatsApp).",
    corpoMarkdown: `Na tela de login, use a opção de recuperar senha. Se não receber a mensagem de recuperação, chame a gente no WhatsApp com o CNPJ ou CPF do cadastro e reenviamos o acesso.`,
  },
  {
    categoriaSlug: "cadastro", slug: "endereco", ordem: 3,
    titulo: "Como altero meu endereço de entrega?",
    resumo: "A entrega vai para o endereço do cadastro.",
    palavrasChave: "endereco alterar mudar entrega cadastro",
    notaInterna: "Confirmar o procedimento. Nas conversas, a logística pediu a um cliente que atualizasse o endereço na Receita Federal, e não só no cadastro.",
    corpoMarkdown: `A entrega é feita no endereço do cadastro. Para mudar, fale com a gente pelo WhatsApp **antes de fechar o pedido**. Depois que o pedido entra em separação, a troca de endereço pode atrasar a entrega.`,
  },

  // Catálogo
  {
    categoriaSlug: "catalogo", slug: "catalogo", ordem: 0,
    titulo: "Onde vejo o catálogo?",
    resumo: "Catálogo público completo, sem preço.",
    palavrasChave: "catalogo catalago pdf lista produtos",
    notaInterna: "Falta a URL oficial do catálogo público.",
    corpoMarkdown: `Temos um catálogo público completo, com marcas e categorias, sem preço. Ele fica em [www.mypetbrasil.com](https://www.mypetbrasil.com).

Preço, estoque e pedido ficam na loja, depois de [criar o acesso](/central-de-ajuda/a/criar-acesso).`,
  },
  {
    categoriaSlug: "catalogo", slug: "tabela-precos", ordem: 1,
    titulo: "Vocês têm tabela de preços em PDF?",
    resumo: "Não. Os preços ficam na loja.",
    palavrasChave: "tabela precos pdf planilha lista de precos jornal ofertas",
    corpoMarkdown: `Não enviamos tabela de preços em PDF ou planilha. Os preços mudam diariamente e ficam sempre atualizados na loja, depois de criar o acesso.

Para fazer um orçamento, é só adicionar os itens ao carrinho. Ele mostra o total e o frete para o seu CEP.`,
  },
  {
    categoriaSlug: "catalogo", slug: "tem-produto", ordem: 2,
    titulo: "Vocês têm tal produto? Como vejo o estoque?",
    resumo: "Busque na loja. O estoque aparece em cada item.",
    palavrasChave: "tem produto estoque disponivel tapete higienico areia racao pronta entrega",
    corpoMarkdown: `Use a busca da loja pelo nome, marca ou tipo de produto (ex.: "tapete higiênico", "areia", "comedouro"). Depois de logado, cada item mostra se está disponível.

Os itens estão sujeitos à disponibilidade no momento da separação. Se algum acabar, entramos em contato para oferecer uma substituição (outra cor, fragrância ou modelo parecido) ou um crédito no valor do item.`,
  },
  {
    categoriaSlug: "catalogo", slug: "esgotado", ordem: 3,
    titulo: "O produto esgotou. Vai voltar?",
    resumo: "Peça um similar pelo WhatsApp.",
    palavrasChave: "esgotado esgotou acabou volta indisponivel similar parecido",
    corpoMarkdown: `Itens indisponíveis costumam sair do site em breve. Se você precisa de algo parecido, mande o nome ou a foto do produto pelo WhatsApp que indicamos uma alternativa.`,
  },
  {
    categoriaSlug: "catalogo", slug: "personalizacao", ordem: 4,
    titulo: "Vocês fazem personalização ou marca própria?",
    resumo: "Não. Não fazemos personalização, definitivamente.",
    palavrasChave: "personalizacao marca propria logo estampa brinde gravacao",
    corpoMarkdown: `Não. Não fazemos personalização, marca própria, gravação de logo, estampa nem confecção de brindes, em nenhuma quantidade.

Todos os produtos são vendidos na versão padrão do catálogo.`,
  },

  // Preços
  {
    categoriaSlug: "precos", slug: "pedido-minimo", ordem: 0,
    titulo: "Qual é o pedido mínimo?",
    resumo: "R$ 250 na capital de SP · R$ 400 nas demais regiões.",
    palavrasChave: "pedido minimo valor minimo quantidade minima minimo",
    notaInterna: "O FAQ que está hoje no agente do WhatsApp (hub-clientes) ainda diz R$ 400 para todo o Brasil — não relacionado a esta central (Fase 2 decide a sincronia).",
    corpoMarkdown: `| Região de entrega | Pedido mínimo |
| --- | --- |
| Capital de São Paulo | **R$ 250,00** |
| Interior de SP e demais estados | **R$ 400,00** |

Comprando pessoalmente no [Show Room](/central-de-ajuda/a/showroom), o pedido mínimo é de apenas **R$ 150,00**.

O mínimo vale para o pedido todo. Você pode misturar produtos, sem precisar comprar caixa fechada de um único item.`,
  },
  {
    categoriaSlug: "precos", slug: "preco-atacado", ordem: 1,
    titulo: "O preço do site é de atacado?",
    resumo: "Sim. Nossos preços são somente de atacado.",
    palavrasChave: "preco atacado revenda lojista tabela diferenciada preco site mesmo loja varejo",
    corpoMarkdown: `Sim. **Nossos preços são somente de atacado**, feitos para lojistas. Não existe tabela de varejo e não atendemos consumidor final.

O preço que aparece na loja, depois do acesso liberado, já é o seu preço de lojista. Não há tabela separada para pedir.

Cotação de grande volume de um mesmo item é tratada pelo [Balcão de Negócios](/central-de-ajuda/a/grande-volume).`,
  },
  {
    categoriaSlug: "precos", slug: "desconto-quantidade", ordem: 2,
    titulo: "Tem desconto por quantidade?",
    resumo: "Alguns itens têm desconto automático no carrinho.",
    palavrasChave: "desconto quantidade comprando mais condicoes melhores negociacao",
    notaInterna: "Confirmar se o \"desconto automático por quantidade\" existe hoje na loja.",
    corpoMarkdown: `Alguns itens têm desconto automático por quantidade, que aparece direto no carrinho quando você aumenta o volume.

Para grande volume de um mesmo item (centenas ou milhares de unidades), fale com o [Balcão de Negócios](/central-de-ajuda/a/grande-volume).`,
  },
  {
    categoriaSlug: "precos", slug: "desconto-avista", ordem: 3,
    titulo: "Tem desconto no Pix ou à vista?",
    resumo: "5% de desconto nas compras à vista.",
    palavrasChave: "desconto pix a vista avista boleto",
    corpoMarkdown: `Sim. Nas compras à vista (Pix, depósito, transferência ou boleto à vista) há **5% de desconto**.

Comprando no [Show Room](/central-de-ajuda/a/showroom), o pagamento em dinheiro tem desconto extra.`,
  },
  {
    categoriaSlug: "precos", slug: "orcamento", ordem: 4,
    titulo: "Como faço um orçamento?",
    resumo: "O carrinho da loja é o orçamento.",
    palavrasChave: "orcamento cotacao quanto fica total",
    corpoMarkdown: `Adicione os itens ao carrinho e informe o CEP. O carrinho mostra o total, os descontos e o frete, sem compromisso de compra.

Prefere ajuda? Mande a lista de produtos pelo WhatsApp que um vendedor monta o orçamento para você.`,
  },

  // Pedido
  {
    categoriaSlug: "pedido", slug: "pedido-site", ordem: 0,
    titulo: "Como fazer um pedido pelo site",
    resumo: "Passo a passo do carrinho ao pagamento.",
    palavrasChave: "pedido site carrinho finalizar comprar",
    corpoMarkdown: `1. Entre com seu acesso em [www.mypetbrasil.com](https://www.mypetbrasil.com).
2. Adicione os produtos ao carrinho e informe o CEP para calcular o frete.
3. Confira se o total atingiu o [pedido mínimo](/central-de-ajuda/a/pedido-minimo).
4. Escolha a forma de pagamento e finalize.
5. Pagou no Pix? Envie o comprovante pelo WhatsApp para o pedido seguir mais rápido para a separação.`,
  },
  {
    categoriaSlug: "pedido", slug: "pedido-whatsapp", ordem: 1,
    titulo: "Posso fazer o pedido pelo WhatsApp?",
    resumo: "Sim, um vendedor monta o pedido para você.",
    palavrasChave: "whatsapp pedido por aqui vendedor site manutencao fora do ar",
    corpoMarkdown: `Sim. Mande a lista de produtos e quantidades que um vendedor monta o pedido. Os preços são os mesmos da loja.

Se o site estiver em manutenção, o pedido pelo WhatsApp é o caminho mais rápido.`,
  },
  {
    categoriaSlug: "pedido", slug: "incluir-item", ordem: 2,
    titulo: "Esqueci um item. Posso incluir no pedido?",
    resumo: "Sim, se o pedido ainda não foi separado.",
    palavrasChave: "incluir item adicionar ao pedido esqueci kit juntar",
    notaInterna: "Sem regra oficial. Uma cliente ficou dias sem conseguir incluir um kit no pedido — definir o procedimento e o responsável.",
    corpoMarkdown: `Chame a gente no WhatsApp com o **número do pedido** e os itens que quer incluir. Se o pedido ainda não entrou em separação, conseguimos juntar tudo num envio só.

Se já estiver separado, os itens novos seguem num novo pedido.`,
  },
  {
    categoriaSlug: "pedido", slug: "credito", ordem: 3,
    titulo: "Como uso meu crédito no site?",
    resumo: "Créditos de faltas valem para a próxima compra.",
    palavrasChave: "credito usar saldo cupom",
    notaInterna: "Explicar como o crédito aparece e é aplicado no checkout.",
    corpoMarkdown: `Quando falta algum item no seu pedido, o financeiro gera um crédito no valor da falta para você usar na próxima compra pelo site.`,
  },
  {
    categoriaSlug: "pedido", slug: "cancelar", ordem: 4,
    titulo: "Posso cancelar um pedido?",
    resumo: "Fale com a gente antes do despacho.",
    palavrasChave: "cancelar cancelamento desistir",
    notaInterna: "Sem política oficial de cancelamento. Definir prazo e condições.",
    corpoMarkdown: `Chame no WhatsApp com o número do pedido o quanto antes. Antes do despacho, o cancelamento é mais simples e o valor pago é estornado.`,
  },

  // Pagamento
  {
    categoriaSlug: "pagamento", slug: "formas-pagamento", ordem: 0,
    titulo: "Quais são as formas de pagamento?",
    resumo: "Cartão, Pix, depósito, boleto à vista e faturado.",
    palavrasChave: "forma de pagamento pix cartao boleto deposito transferencia",
    corpoMarkdown: `- **Cartão de crédito:** até 10x sem juros, parcela mínima de R$ 300,00.
- **Pix, depósito ou transferência:** 5% de desconto.
- **Boleto à vista:** 5% de desconto.
- **Boleto faturado:** para clientes aprovados pelo financeiro ([veja as regras](/central-de-ajuda/a/boleto-faturado)).

A primeira compra é sempre à vista ou no cartão de crédito.`,
  },
  {
    categoriaSlug: "pagamento", slug: "parcelamento", ordem: 1,
    titulo: "Em quantas vezes posso parcelar?",
    resumo: "Até 10x sem juros, parcela mínima de R$ 300.",
    palavrasChave: "parcelar parcelamento vezes sem juros cartao",
    corpoMarkdown: `Parcelamos em **até 10x sem juros** no cartão, com parcela mínima de **R$ 300,00**. Sujeito à aprovação da administradora do cartão.

| Valor do pedido | Parcelas sem juros |
| --- | --- |
| R$ 400,00 | 1x |
| R$ 900,00 | até 3x de R$ 300,00 |
| R$ 1.800,00 | até 6x de R$ 300,00 |
| R$ 3.000,00 ou mais | até 10x |`,
  },
  {
    categoriaSlug: "pagamento", slug: "boleto-faturado", ordem: 2,
    titulo: "Como funciona o boleto faturado?",
    resumo: "Para clientes com histórico e CNPJ com mais de 2 anos.",
    palavrasChave: "boleto faturado prazo credito analise",
    corpoMarkdown: `O boleto faturado é liberado apenas para clientes que tenham:

- histórico de compras com a My Pet Brasil;
- CNPJ com mais de 2 anos;
- nenhuma pendência financeira.

O pedido passa por análise do financeiro. O prazo de pagamento conta a partir do **despacho** do pedido, e não da data em que você fez o pedido.

Até a liberação, o pedido sai em Pix, cartão ou boleto à vista.`,
  },
  {
    categoriaSlug: "pagamento", slug: "pix-comprovante", ordem: 3,
    titulo: "Paguei no Pix e o pedido continua \"aguardando pagamento\"",
    resumo: "Envie o comprovante pelo WhatsApp.",
    palavrasChave: "pix comprovante aguardando pagamento paguei nao caiu confirmar",
    corpoMarkdown: `Envie o **comprovante do Pix** pelo WhatsApp com o número do pedido. Assim que o financeiro confirmar, o pedido segue para a separação.

> Dica: mande o comprovante logo depois de pagar. Com ele, o pedido vai para a separação sem esperar a baixa automática.`,
  },
  {
    categoriaSlug: "pagamento", slug: "cartao-recusado", ordem: 4,
    titulo: "O pagamento no cartão não foi concluído",
    resumo: "Nenhum valor é cobrado. Enviamos um link seguro.",
    palavrasChave: "cartao recusado nao passou erro pagamento link",
    corpoMarkdown: `Se a transação não for concluída no site, **nenhum valor é cobrado** e não há risco de cobrança em dobro. Nesse caso, enviamos pelo WhatsApp um link seguro de pagamento para você concluir o pedido.`,
  },

  // Entrega
  {
    categoriaSlug: "entrega", slug: "prazo", ordem: 0,
    titulo: "Qual é o prazo de entrega?",
    resumo: "Até 7 dias úteis para despachar, mais o transporte.",
    palavrasChave: "prazo entrega quanto tempo chega dias previsao demora",
    corpoMarkdown: `A separação e o despacho levam **até 7 dias úteis**. Depois do despacho, o transporte leva em média:

| Região | Transporte após o despacho |
| --- | --- |
| Sul e Sudeste | 3 a 7 dias úteis |
| Nordeste e Centro-Oeste | 5 a 16 dias úteis |
| Norte | 7 a 20 dias úteis |

Todos os prazos são **estimados** e variam de cidade para cidade.`,
  },
  {
    categoriaSlug: "entrega", slug: "frete", ordem: 1,
    titulo: "Vocês entregam em todo o Brasil? Como é o frete?",
    resumo: "Sim, por transportadora. O frete aparece no carrinho.",
    palavrasChave: "frete entrega todo brasil transportadora calcular gratis",
    corpoMarkdown: `Sim. O frete é por transportadora, para todo o Brasil. Ele é calculado pelo valor do pedido e pelo CEP e aparece no carrinho assim que você informa o CEP.

Algumas cidades têm frete grátis.`,
  },
  {
    categoriaSlug: "entrega", slug: "rastreio", ordem: 2,
    titulo: "Como rastreio meu pedido?",
    resumo: "Pelo código de rastreio ou pedindo a previsão no WhatsApp.",
    palavrasChave: "rastreio rastrear codigo onde esta pedido chegou enviado",
    corpoMarkdown: `Quando o pedido vai pelos Correios, enviamos o código de rastreio para você acompanhar no site dos Correios.

Quando a entrega é feita pelo caminhão da empresa ou por transportadora sem rastreio, peça a previsão de entrega pelo WhatsApp com o número do pedido.`,
  },
  {
    categoriaSlug: "entrega", slug: "regras-entrega", ordem: 3,
    titulo: "Regras de entrega",
    resumo: "Horário, endereço e taxa estadual.",
    palavrasChave: "horario entrega endereco dae taxa estadual",
    corpoMarkdown: `- A entrega é feita no **endereço do cadastro**, das **7h às 18h**.
- Em alguns estados há taxa estadual (DAE), paga pelo cliente.
- Os itens estão sujeitos à disponibilidade de estoque no momento da separação.`,
  },
  {
    categoriaSlug: "entrega", slug: "urgente", ordem: 4,
    titulo: "Preciso receber com urgência",
    resumo: "Avise antes de fechar o pedido.",
    palavrasChave: "urgente urgencia inauguracao amanha rapido",
    corpoMarkdown: `Como os prazos são estimados, não conseguimos garantir uma data. Se precisa receber até um dia específico (uma inauguração, por exemplo), avise pelo WhatsApp **antes de fechar o pedido** para verificarmos o que é possível.`,
  },

  // Show Room
  {
    categoriaSlug: "loja", slug: "showroom", ordem: 0,
    titulo: "O que é o Show Room da My Pet Brasil?",
    resumo: "Compre direto do estoque. Leve hoje.",
    palavrasChave: "showroom show room loja fisica comprar pessoalmente pronta entrega levar hoje",
    notaInterna: "O número \"3 mil\" veio entre colchetes no texto original do dono. Confirmar se é o valor final.",
    corpoMarkdown: `O Show Room da My Pet Brasil é o atacado pet feito para lojista: **mais de 3 mil itens a pronta entrega**, linha própria direto de fábrica e consultores que entendem de pet shop. Você escolhe, paga e sai com o carro carregado.

### Por que lojista vem até aqui

- **Preço de fábrica na prateleira.** Nossa linha própria sai direto da fábrica, sem intermediário. Sua margem agradece.
- **Pegou, pagou, levou.** Reposição no mesmo dia, sem esperar frete nem prazo de entrega.
- **Estacionamento gratuito.** Chega, estaciona, carrega. Sem rodar quarteirão atrás de vaga.
- **Veja de perto antes de comprar.** Tamanho, acabamento, embalagem: o que a foto de catálogo não mostra.
- **Desconto extra no dinheiro.** E pedido mínimo de apenas **R$ 150,00**.
- **Consultor ao seu lado.** Ajudamos você a montar o mix, escolher equipamentos e não gastar com o que não gira.`,
  },
  {
    categoriaSlug: "loja", slug: "endereco-horario", ordem: 1,
    titulo: "Onde fica o Show Room e qual o horário?",
    resumo: "Sacomã, São Paulo · estacionamento gratuito.",
    palavrasChave: "endereco loja fisica showroom horario onde fica sabado abre estacionamento",
    notaInterna: "Confirmar o horário do Show Room (o de 8h às 17h é o do atendimento) e se abre aos sábados, pergunta recorrente no WhatsApp.",
    corpoMarkdown: `**Rua Alencar Araripe, 212 — Sacomã, São Paulo/SP**

Atendimento de segunda a sexta, das 8h às 17h. Estacionamento gratuito para clientes.`,
  },
  {
    categoriaSlug: "loja", slug: "showroom-condicoes", ordem: 2,
    titulo: "Pedido mínimo e pagamento no Show Room",
    resumo: "Mínimo de R$ 150 e desconto extra no dinheiro.",
    palavrasChave: "showroom pedido minimo 150 dinheiro desconto pagamento loja",
    notaInterna: "Informar o percentual do desconto extra no dinheiro e quais formas de pagamento o Show Room aceita.",
    corpoMarkdown: `- **Pedido mínimo:** R$ 150,00, bem abaixo do mínimo das compras online.
- **Desconto extra no dinheiro**, além das condições de pagamento à vista.
- Você paga no balcão e leva a mercadoria na hora.`,
  },
  {
    categoriaSlug: "loja", slug: "retirada", ordem: 3,
    titulo: "Posso retirar no Show Room um pedido feito no site?",
    resumo: "Combine a retirada pelo WhatsApp.",
    palavrasChave: "retirar retirada buscar pegar pessoalmente pedido site",
    notaInterna: "Confirmar se pedidos do site podem ser retirados e se o frete sai do total.",
    corpoMarkdown: `Combine a retirada pelo WhatsApp com o número do pedido. Avisamos quando ele estiver separado.`,
  },

  // Trocas
  {
    categoriaSlug: "trocas", slug: "faltou-item", ordem: 0,
    titulo: "Faltou um item no meu pedido",
    resumo: "Crédito para a próxima compra ou estorno.",
    palavrasChave: "faltou falta faltando item pecas incompleto",
    corpoMarkdown: `Mande pelo WhatsApp o número do pedido e o item que faltou. Você escolhe entre:

- **Crédito** no valor da falta, para usar na próxima compra pelo site; ou
- **Estorno** do valor pago pelo item.`,
  },
  {
    categoriaSlug: "trocas", slug: "avaria", ordem: 1,
    titulo: "O produto chegou quebrado ou com defeito",
    resumo: "Mande fotos e o número do pedido.",
    palavrasChave: "quebrado avaria defeito danificado estragado",
    notaInterna: "Sem política oficial. Definir o prazo para reclamar após o recebimento e quem paga o frete de volta.",
    corpoMarkdown: `Envie pelo WhatsApp o número do pedido, fotos do produto e da embalagem e uma breve descrição do problema. Analisamos e oferecemos reposição, crédito ou estorno.`,
  },
  {
    categoriaSlug: "trocas", slug: "estorno", ordem: 2,
    titulo: "Quanto tempo leva o estorno?",
    resumo: "Até 3 dias úteis depois de processado.",
    palavrasChave: "estorno reembolso devolucao dinheiro devolver valor",
    corpoMarkdown: `Depois que o estorno é processado, o valor leva até **3 dias úteis** para aparecer. No cartão de crédito, o prazo também depende da administradora e pode aparecer só na fatura seguinte.

Enviamos o comprovante do estorno pelo WhatsApp. Se o valor não constar no extrato, apresente o comprovante ao seu banco.`,
  },
  {
    categoriaSlug: "trocas", slug: "trocar-item", ordem: 3,
    titulo: "Posso trocar um produto?",
    resumo: "Fale com a gente pelo WhatsApp.",
    palavrasChave: "trocar troca devolver item",
    notaInterna: "Sem política oficial de troca por arrependimento ou por erro do cliente. Definir.",
    corpoMarkdown: `Chame pelo WhatsApp com o número do pedido e o item que quer trocar. Avaliamos caso a caso.`,
  },
  {
    categoriaSlug: "trocas", slug: "amazon", ordem: 4,
    titulo: "Comprei na Amazon e tive um problema",
    resumo: "Confira quem vendeu o produto.",
    palavrasChave: "amazon marketplace mercado livre comprei quebrado",
    corpoMarkdown: `Existe uma marca "My Pet Brasil" vinculada indevidamente a produtos de terceiros na Amazon. Confira quem aparece em **"Vendido e enviado por"** e abra o chamado com esse vendedor ou com a própria Amazon.

Já solicitamos a remoção dessa vinculação.`,
  },

  // Notas
  {
    categoriaSlug: "notas", slug: "nota-fiscal", ordem: 0,
    titulo: "Recebo nota fiscal?",
    resumo: "Sim, todo pedido sai com NF-e.",
    palavrasChave: "nota fiscal nf nfe",
    notaInterna: "Confirmar como a NF chega ao cliente (junto da mercadoria, por e-mail ou pelos dois).",
    corpoMarkdown: `Sim. Todo pedido é faturado com nota fiscal eletrônica (NF-e), emitida no CNPJ ou CPF do cadastro.`,
  },
  {
    categoriaSlug: "notas", slug: "xml", ordem: 1,
    titulo: "Como peço o XML ou a segunda via da nota?",
    resumo: "Pelo WhatsApp, com o número do pedido.",
    palavrasChave: "xml segunda via danfe nota codigo de barras",
    notaInterna: "Confirmar o canal e o prazo. Definir se \"nota com código de barras dos produtos\" é algo que se atende.",
    corpoMarkdown: `Peça pelo WhatsApp com o número do pedido e enviamos o XML e o DANFE (a versão em PDF da nota).`,
  },

  // Parcerias
  {
    categoriaSlug: "parcerias", slug: "representante", ordem: 0,
    titulo: "Quero ser representante comercial",
    resumo: "Envie sua apresentação.",
    palavrasChave: "representante representacao vender seus produtos regiao",
    notaInterna: "Sem regra oficial. Confirmar se vocês trabalham com representantes e qual o canal.",
    corpoMarkdown: `Mande pelo WhatsApp sua região de atuação e as linhas que você já representa. Nosso time comercial avalia e retorna.`,
  },
  {
    categoriaSlug: "parcerias", slug: "dropshipping", ordem: 1,
    titulo: "Vocês fazem dropshipping?",
    resumo: "Não fazemos dropshipping nem cross docking.",
    palavrasChave: "dropshipping dropship cross docking enviar direto meu cliente",
    corpoMarkdown: `Não trabalhamos com dropshipping nem com cross docking. O lojista compra o estoque e revende.`,
  },
  {
    categoriaSlug: "parcerias", slug: "grande-volume", ordem: 2,
    titulo: "Grande volume ou venda em marketplace",
    resumo: "Fale com o Balcão de Negócios.",
    palavrasChave: "grande volume marketplace mercado livre mil unidades cotacao balcao",
    notaInterna: "Falta a URL do formulário do Balcão de Negócios.",
    corpoMarkdown: `Cotação de grande volume de um mesmo item ou operação de marketplace é tratada pelo **Balcão de Negócios**, que tem formulário próprio.`,
  },
  {
    categoriaSlug: "parcerias", slug: "fornecedor", ordem: 3,
    titulo: "Sou fornecedor e quero apresentar meus produtos",
    resumo: "Use o canal de compras.",
    palavrasChave: "fornecedor fabricante apresentar produtos compras setor de compras",
    notaInterna: "Definir um e-mail ou formulário de compras. Fornecedores geraram cerca de 25 conversas no mês pelo WhatsApp de vendas.",
    corpoMarkdown: `Este WhatsApp é dedicado ao atendimento de lojistas. Para apresentar produtos ao nosso setor de compras, envie seu catálogo pelo canal indicado abaixo.`,
  },
];

async function seed() {
  const supabase = getHubServiceClient();

  const categoriaIdPorSlug = new Map<string, string>();
  for (const categoria of CATEGORIAS) {
    const { data, error } = await supabase
      .from("categorias_ajuda")
      .upsert(
        {
          slug: categoria.slug,
          titulo: categoria.titulo,
          descricao: categoria.descricao,
          icone: categoria.icone,
          ordem: categoria.ordem,
          atualizado_por: "seed-2026-09-23",
        },
        { onConflict: "slug" },
      )
      .select("id, slug")
      .single();
    if (error || !data) {
      throw new Error(`Falha ao inserir categoria ${categoria.slug}: ${error?.message}`);
    }
    categoriaIdPorSlug.set(data.slug, data.id);
    console.log(`categoria: ${categoria.slug}`);
  }

  for (const artigo of ARTIGOS) {
    const categoriaId = categoriaIdPorSlug.get(artigo.categoriaSlug);
    if (!categoriaId) {
      throw new Error(`Categoria não encontrada para o artigo ${artigo.slug}: ${artigo.categoriaSlug}`);
    }
    const { error } = await supabase.from("artigos_ajuda").upsert(
      {
        categoria_id: categoriaId,
        slug: artigo.slug,
        titulo: artigo.titulo,
        resumo: artigo.resumo,
        corpo_markdown: artigo.corpoMarkdown,
        palavras_chave: artigo.palavrasChave,
        nota_interna: artigo.notaInterna ?? null,
        status: "rascunho",
        ordem: artigo.ordem,
        atualizado_por: "seed-2026-09-23",
      },
      { onConflict: "slug" },
    );
    if (error) {
      throw new Error(`Falha ao inserir artigo ${artigo.slug}: ${error.message}`);
    }
    console.log(`artigo: ${artigo.slug} (rascunho)`);
  }

  console.log(`\n${CATEGORIAS.length} categorias e ${ARTIGOS.length} artigos semeados, todos em rascunho.`);
}

seed().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
```

- [ ] **Step 2: Registrar o script**

Em `package.json` (raiz), dentro de `"scripts"`, adicione (ao lado de `"azpetshop:import-precos"`):

```json
    "central-ajuda:seed": "tsx scripts/seed-central-ajuda.ts",
```

- [ ] **Step 3: Rodar o seed**

Run: `SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<chave> pnpm central-ajuda:seed`
Expected: log de 11 categorias + 48 artigos, terminando em "11 categorias e 48 artigos semeados, todos em rascunho."

- [ ] **Step 4: Verificar no banco**

Run (`mcp__claude_ai_Supabase__execute_sql`, `project_id` `hsguyfiyqpuligijcjlw`):

```sql
select
  (select count(*) from categorias_ajuda) as categorias,
  (select count(*) from artigos_ajuda) as artigos,
  (select count(*) from artigos_ajuda where status = 'publicado') as publicados;
```

Expected: `categorias = 11`, `artigos = 48`, `publicados = 0`.

- [ ] **Step 5: Verificação manual na tela**

Rode `pnpm --filter mypet dev` e `pnpm --filter admin dev`; confirme que `/central-de-ajuda` mostra as 11 categorias mas nenhum artigo (todos em rascunho); no admin, `/central-ajuda` mostra as 11 categorias com a contagem de artigos de cada uma.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-central-ajuda.ts package.json
git commit -m "feat: seed dos 48 artigos da central de ajuda, em rascunho

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Depois do plano

Com as 14 tasks concluídas, a Central de Ajuda existe, mas está toda em rascunho — o dono revisa cada artigo pelo admin (`/central-ajuda`) e publica um a um, prestando atenção especial aos que têm `nota_interna` preenchida (os antigos "pontos a confirmar"). Só depois disso vale abrir uma PR desta branch para `main`.
