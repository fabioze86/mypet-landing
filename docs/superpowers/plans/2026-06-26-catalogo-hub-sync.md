# Catálogo da landing sincronizado com o Hub — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o array fixo de 16 produtos da landing por leitura do Catálogo Hub (Supabase), com paginação/busca/marca no servidor, cache periódico e badges manuais.

**Architecture:** App Router do Next.js 16 com Cache Components. `app/page.tsx` vira Server Component que lê `searchParams` e renderiza o catálogo dentro de `<Suspense>`. Uma camada `lib/catalog.ts` consulta o Supabase com `'use cache'` + `cacheLife('days')`. A interatividade (gate de cadastro/modal/desbloqueio) fica em ilhas client (`components/lead-gate.tsx`). Funções puras de mapeamento/paginação ficam isoladas em `lib/catalog-utils.ts` e são cobertas por testes.

**Tech Stack:** Next.js 16.2.6, React 19, `@supabase/supabase-js`, Vitest (novo, para os testes das funções puras), TypeScript.

## Global Constraints

- Next.js **16.2.6** — usar Cache Components (`cacheComponents: true`); `use cache` exige funções `async`; dados de runtime (ex.: `searchParams`) são lidos **fora** do escopo `use cache` e passados como argumentos.
- AGENTS.md: esta versão do Next tem breaking changes — consultar `node_modules/next/dist/docs/` antes de usar APIs do Next.
- **Nunca** usar a service-role key na landing. Usar apenas a publishable/anon key (opção A: leitura pública via RLS).
- Hub Supabase: projeto `hub_catalogo`, ref `hsguyfiyqpuligijcjlw`, URL `https://hsguyfiyqpuligijcjlw.supabase.co`.
- Textos visíveis em **português** (com acentuação correta).
- Produtos exibidos: `status = 'active'`. Página de **24** itens, ordenados por `name`.
- Sem preço real: após desbloquear, exibir "Preço sob consulta", nunca um valor.
- Path alias `@/*` aponta para a raiz do projeto (ver `tsconfig.json`).

---

## File Structure

- `lib/theme.ts` (criar) — `PALETTE` (extraída de `app/page.tsx`) + estilos de badge + `badgeStyle()`.
- `lib/catalog-utils.ts` (criar) — tipos + funções puras (mapeamento, paginação, seleção de badge). Sem importar Next/Supabase. **Testado.**
- `lib/catalog-utils.test.ts` (criar) — testes Vitest das funções puras.
- `lib/supabase.ts` (criar) — fábrica do cliente Supabase do Hub.
- `lib/catalog.ts` (criar) — `queryCatalog` (testável), `getCatalog`/`getBrands`/`getProductCount` (com `use cache`).
- `lib/catalog.test.ts` (criar) — teste de `queryCatalog` com cliente Supabase mockado.
- `components/lead-gate.tsx` (criar) — `'use client'`: `LeadGateProvider`, `useLeadGate`, `UnlockButton`, `PriceLockSlot`, `LeadModal`.
- `components/product-card.tsx` (criar) — card de produto (Server Component).
- `components/catalog-section.tsx` (criar) — seção async do catálogo (controles + grade + paginação).
- `lib/querystring.ts` (criar) — helper puro para montar a query string da paginação/filtros. **Testado.**
- `lib/querystring.test.ts` (criar).
- `app/page.tsx` (modificar) — Server Component; remove `PRODUCTS`/`CATEGORIES` fixos; integra os componentes acima.
- `next.config.ts` (modificar) — `cacheComponents: true`.
- `vitest.config.ts` (criar), `package.json` (modificar — deps + script `test`).
- `.env.local` (criar — não versionado).
- `public/placeholder-produto.svg` (criar) — imagem para produtos sem foto.

---

## Task 1: Setup do projeto (deps, testes, config, env, tema)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`, `.env.local`, `public/placeholder-produto.svg`, `lib/theme.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Produces: `PALETTE` (objeto de cores), `badgeStyle(code: string): { bg: string; color: string }` em `lib/theme.ts`; script `npm test` rodando Vitest; `cacheComponents` habilitado.

- [ ] **Step 1: Instalar dependências**

Run:
```bash
npm install @supabase/supabase-js
npm install -D vitest
```
Expected: instala sem erro; `@supabase/supabase-js` em `dependencies`, `vitest` em `devDependencies`.

- [ ] **Step 2: Adicionar script de teste**

Em `package.json`, dentro de `"scripts"`, adicionar:
```json
"test": "vitest run"
```

- [ ] **Step 3: Criar `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Habilitar Cache Components em `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
};

export default nextConfig;
```

- [ ] **Step 5: Criar `.env.local`** (não versionado — Next ignora `.env*.local` por padrão)

```bash
SUPABASE_URL=https://hsguyfiyqpuligijcjlw.supabase.co
SUPABASE_ANON_KEY=sb_publishable_Fci4-su5zOXY0SpEeiv77A_iUwkOPXm
```

- [ ] **Step 6: Criar `public/placeholder-produto.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#F0F2F6"/>
  <text x="50%" y="48%" font-family="sans-serif" font-size="64" fill="#9CA8C0" text-anchor="middle">🐾</text>
  <text x="50%" y="62%" font-family="sans-serif" font-size="18" fill="#9CA8C0" text-anchor="middle">Sem imagem</text>
</svg>
```

- [ ] **Step 7: Criar `lib/theme.ts`** (extrair `PALETTE` de `app/page.tsx:5-24` — copiar os valores exatos — e definir estilos de badge)

```ts
export const PALETTE = {
  pink: "#E5197A",
  pinkDark: "#B8115F",
  pinkLight: "#FCE4F0",
  cyan: "#00C4D4",
  cyanDark: "#009BAA",
  cyanLight: "#E0F9FB",
  navy: "#1A3472",
  navyDark: "#0F1F45",
  navyLight: "#EDF0F8",
  orange: "#FF6A00",
  green: "#00A651",
  white: "#FFFFFF",
  gray50: "#F8F9FB",
  gray100: "#F0F2F6",
  gray200: "#DDE2EC",
  gray400: "#9CA8C0",
  gray600: "#5A6580",
  gray800: "#2D3550",
} as const;

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  escolha_mypet: { bg: PALETTE.pinkLight, color: PALETTE.pink },
  novidade: { bg: PALETTE.navyLight, color: PALETTE.navy },
  promocao: { bg: "#FFF0E5", color: PALETTE.orange },
};

export function badgeStyle(code: string): { bg: string; color: string } {
  return BADGE_STYLES[code] ?? { bg: PALETTE.gray100, color: PALETTE.gray600 };
}
```

- [ ] **Step 8: Verificar que o projeto ainda builda e o test runner sobe**

Run:
```bash
npm test
```
Expected: Vitest roda e informa "No test files found" (ainda não há testes) — sem erro de configuração.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts next.config.ts public/placeholder-produto.svg lib/theme.ts
git commit -m "chore: setup supabase, vitest, cache components e tema compartilhado"
```

---

## Task 2: Migration no Hub — tabela `product_badges` + RLS de leitura pública

Esta task roda contra o Supabase do Hub via ferramenta MCP `apply_migration` (projeto `hsguyfiyqpuligijcjlw`). Não há código no repo; o deliverable é o banco preparado e verificado.

**Interfaces:**
- Produces: tabela `public.product_badges` e policies de SELECT público (`anon`) em `products`, `product_assets`, `product_badges`. A camada `lib/catalog.ts` (Task 5) depende disso para ler com a anon key.

- [ ] **Step 1: Aplicar a migration**

Usar `apply_migration` com `project_id = "hsguyfiyqpuligijcjlw"`, `name = "landing_badges_e_rls_publica"` e o SQL:
```sql
-- Tabela de badges por produto
create table if not exists public.product_badges (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null check (kind in ('manual','promocao','mais_vendido','mais_visitado')),
  label text not null,
  code text not null,
  priority int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists product_badges_product_id_idx on public.product_badges(product_id);

alter table public.product_badges enable row level security;

-- Leitura pública (somente SELECT) para a vitrine
drop policy if exists "landing_public_read_products" on public.products;
create policy "landing_public_read_products" on public.products
  for select to anon using (status = 'active');

drop policy if exists "landing_public_read_assets" on public.product_assets;
create policy "landing_public_read_assets" on public.product_assets
  for select to anon using (true);

drop policy if exists "landing_public_read_badges" on public.product_badges;
create policy "landing_public_read_badges" on public.product_badges
  for select to anon using (true);
```

- [ ] **Step 2: Verificar as policies**

Usar `execute_sql` com `project_id = "hsguyfiyqpuligijcjlw"`:
```sql
select tablename, policyname, roles, cmd
from pg_policies
where tablename in ('products','product_assets','product_badges')
order by tablename, policyname;
```
Expected: 3 policies, todas `cmd = SELECT` e `roles = {anon}`.

- [ ] **Step 3: Inserir 1 badge manual de teste** (para validar a exibição depois)

Usar `execute_sql`:
```sql
insert into public.product_badges (product_id, kind, label, code, priority)
select id, 'manual', 'Escolha da My Pet', 'escolha_mypet', 10
from public.products where status = 'active' order by name limit 1
returning product_id, label;
```
Expected: 1 linha inserida. Anotar o `product_id` retornado para conferência manual na Task 10.

---

## Task 3: `lib/catalog-utils.ts` — funções puras (TDD)

**Files:**
- Create: `lib/catalog-utils.ts`
- Test: `lib/catalog-utils.test.ts`

**Interfaces:**
- Produces:
  - `PAGE_SIZE = 24`
  - `PLACEHOLDER_IMAGE = "/placeholder-produto.svg"`
  - tipos `Badge`, `RawBadge`, `RawProductRow`, `CatalogProduct`, `CatalogResult`
  - `parsePage(raw: string | undefined): number`
  - `pageRange(page: number, pageSize?: number): { from: number; to: number }`
  - `totalPages(total: number, pageSize?: number): number`
  - `pickActiveBadge(badges: RawBadge[] | null | undefined, now?: Date): Badge | null`
  - `mainImage(assets: RawProductRow["product_assets"]): string`
  - `mapProduct(row: RawProductRow, now?: Date): CatalogProduct`
- Consumes: nada (módulo puro).

- [ ] **Step 1: Escrever os testes (falhando)** em `lib/catalog-utils.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  parsePage,
  pageRange,
  totalPages,
  pickActiveBadge,
  mainImage,
  mapProduct,
  PLACEHOLDER_IMAGE,
  type RawProductRow,
} from "./catalog-utils";

describe("parsePage", () => {
  it("retorna 1 para indefinido ou inválido", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
  });
  it("converte string numérica válida", () => {
    expect(parsePage("4")).toBe(4);
  });
});

describe("pageRange", () => {
  it("calcula o range zero-based do Supabase", () => {
    expect(pageRange(1, 24)).toEqual({ from: 0, to: 23 });
    expect(pageRange(3, 24)).toEqual({ from: 48, to: 71 });
  });
});

describe("totalPages", () => {
  it("arredonda para cima e nunca retorna menos que 1", () => {
    expect(totalPages(0, 24)).toBe(1);
    expect(totalPages(24, 24)).toBe(1);
    expect(totalPages(25, 24)).toBe(2);
  });
});

describe("pickActiveBadge", () => {
  it("retorna null quando não há badges", () => {
    expect(pickActiveBadge(null)).toBeNull();
    expect(pickActiveBadge([])).toBeNull();
  });
  it("escolhe o de maior priority entre os vigentes", () => {
    const badge = pickActiveBadge([
      { code: "novidade", label: "Novidade", kind: "manual", priority: 1, starts_at: null, ends_at: null },
      { code: "escolha_mypet", label: "Escolha da My Pet", kind: "manual", priority: 10, starts_at: null, ends_at: null },
    ]);
    expect(badge).toEqual({ code: "escolha_mypet", label: "Escolha da My Pet" });
  });
  it("ignora badges fora da janela de validade", () => {
    const now = new Date("2026-06-26T12:00:00Z");
    const badge = pickActiveBadge(
      [{ code: "promocao", label: "Promoção", kind: "promocao", priority: 5, starts_at: "2026-07-01T00:00:00Z", ends_at: null }],
      now,
    );
    expect(badge).toBeNull();
  });
});

describe("mainImage", () => {
  it("usa a url de main_image", () => {
    expect(mainImage([{ url: "https://img/x", type: "main_image" }])).toBe("https://img/x");
  });
  it("cai no placeholder quando não há imagem", () => {
    expect(mainImage(null)).toBe(PLACEHOLDER_IMAGE);
    expect(mainImage([])).toBe(PLACEHOLDER_IMAGE);
  });
});

describe("mapProduct", () => {
  it("mapeia campos do Hub para a forma da UI", () => {
    const row: RawProductRow = {
      id: "abc",
      name: "RAÇÃO PREMIUM 15KG",
      reference: "15675",
      brand: "PLAST PET",
      product_assets: [{ url: "https://img/x", type: "main_image" }],
      product_badges: [{ code: "novidade", label: "Novidade", kind: "manual", priority: 1, starts_at: null, ends_at: null }],
    };
    expect(mapProduct(row)).toEqual({
      id: "abc",
      name: "RAÇÃO PREMIUM 15KG",
      sku: "15675",
      brand: "PLAST PET",
      img: "https://img/x",
      badge: { code: "novidade", label: "Novidade" },
    });
  });
  it("usa placeholder e sku vazio quando faltam dados", () => {
    const row: RawProductRow = {
      id: "z", name: "CAMA", reference: null, brand: null, product_assets: null, product_badges: null,
    };
    const p = mapProduct(row);
    expect(p.img).toBe(PLACEHOLDER_IMAGE);
    expect(p.sku).toBe("");
    expect(p.badge).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test`
Expected: FAIL — `catalog-utils` não existe / exports indefinidos.

- [ ] **Step 3: Implementar `lib/catalog-utils.ts`**

```ts
export const PAGE_SIZE = 24;
export const PLACEHOLDER_IMAGE = "/placeholder-produto.svg";

export type Badge = { code: string; label: string };

export type RawBadge = {
  code: string;
  label: string;
  kind: string;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type RawProductRow = {
  id: string;
  name: string;
  reference: string | null;
  brand: string | null;
  product_assets: { url: string; type: string }[] | null;
  product_badges: RawBadge[] | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  badge: Badge | null;
};

export type CatalogResult = {
  items: CatalogProduct[];
  total: number;
  page: number;
  totalPages: number;
};

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function pageRange(page: number, pageSize: number = PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function totalPages(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function pickActiveBadge(
  badges: RawBadge[] | null | undefined,
  now: Date = new Date(),
): Badge | null {
  if (!badges || badges.length === 0) return null;
  const vigentes = badges.filter((b) => {
    const startOk = !b.starts_at || new Date(b.starts_at) <= now;
    const endOk = !b.ends_at || new Date(b.ends_at) >= now;
    return startOk && endOk;
  });
  if (vigentes.length === 0) return null;
  vigentes.sort((a, b) => b.priority - a.priority);
  const top = vigentes[0];
  return { code: top.code, label: top.label };
}

export function mainImage(assets: RawProductRow["product_assets"]): string {
  const main = assets?.find((a) => a.type === "main_image");
  return main?.url ?? PLACEHOLDER_IMAGE;
}

export function mapProduct(row: RawProductRow, now: Date = new Date()): CatalogProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.reference ?? "",
    brand: row.brand,
    img: mainImage(row.product_assets),
    badge: pickActiveBadge(row.product_badges, now),
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: PASS — todos os testes de `catalog-utils`.

- [ ] **Step 5: Commit**

```bash
git add lib/catalog-utils.ts lib/catalog-utils.test.ts
git commit -m "feat: funções puras de mapeamento e paginação do catálogo"
```

---

## Task 4: `lib/supabase.ts` — cliente do Hub

**Files:**
- Create: `lib/supabase.ts`

**Interfaces:**
- Consumes: `process.env.SUPABASE_URL`, `process.env.SUPABASE_ANON_KEY`.
- Produces: `getHubClient(): SupabaseClient`.

- [ ] **Step 1: Implementar `lib/supabase.ts`**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getHubClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY precisam estar definidos no ambiente.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: cliente supabase do catálogo hub"
```

---

## Task 5: `lib/catalog.ts` — consultas com cache

**Files:**
- Create: `lib/catalog.ts`
- Test: `lib/catalog.test.ts`

**Interfaces:**
- Consumes: `getHubClient` (Task 4); `mapProduct`, `pageRange`, `totalPages`, `PAGE_SIZE`, tipos (Task 3).
- Produces:
  - `queryCatalog(params: { q?: string; brand?: string; page: number }): Promise<CatalogResult>` (pura quanto ao cache — testável)
  - `getCatalog(params): Promise<CatalogResult>` (`use cache`)
  - `getBrands(): Promise<string[]>` (`use cache`)
  - `getProductCount(): Promise<number>` (`use cache`)
  - `CATALOG_SELECT` (string do select)

- [ ] **Step 1: Escrever o teste de `queryCatalog` (falhando)** em `lib/catalog.test.ts`

O teste mocka `./supabase` para devolver um query builder encadeável e verifica que `queryCatalog` aplica filtros, paginação e mapeia o resultado.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: Record<string, unknown> = {};

vi.mock("./supabase", () => {
  return {
    getHubClient: () => {
      const builder: any = {};
      const chain = (name: string) => (...args: unknown[]) => {
        calls[name] = args;
        return builder;
      };
      builder.select = chain("select");
      builder.eq = chain("eq");
      builder.ilike = chain("ilike");
      builder.order = chain("order");
      builder.not = chain("not");
      builder.range = (...args: unknown[]) => {
        calls["range"] = args;
        return Promise.resolve({
          data: [
            {
              id: "p1",
              name: "RAÇÃO X",
              reference: "100",
              brand: "NAPI",
              product_assets: [{ url: "https://img/1", type: "main_image" }],
              product_badges: null,
            },
          ],
          count: 50,
          error: null,
        });
      };
      return { from: chain("from") };
    },
  };
});

import { queryCatalog } from "./catalog";

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
});

describe("queryCatalog", () => {
  it("aplica busca, marca, paginação e mapeia os itens", async () => {
    const result = await queryCatalog({ q: "ração", brand: "NAPI", page: 2 });
    expect(calls["ilike"]).toEqual(["name", "%ração%"]);
    expect(calls["eq"]).toEqual(["brand", "NAPI"]); // último eq
    expect(calls["range"]).toEqual([24, 47]);
    expect(result.total).toBe(50);
    expect(result.totalPages).toBe(3);
    expect(result.items[0]).toMatchObject({ id: "p1", sku: "100", img: "https://img/1" });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test`
Expected: FAIL — `queryCatalog` não existe.

- [ ] **Step 3: Implementar `lib/catalog.ts`**

```ts
import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import {
  mapProduct,
  pageRange,
  totalPages,
  type CatalogResult,
  type RawProductRow,
} from "./catalog-utils";

export const CATALOG_SELECT =
  "id, name, reference, brand, product_assets(url, type), product_badges(code, label, kind, priority, starts_at, ends_at)";

export async function queryCatalog(params: {
  q?: string;
  brand?: string;
  page: number;
}): Promise<CatalogResult> {
  const { q, brand, page } = params;
  const supabase = getHubClient();
  const { from, to } = pageRange(page);

  let query = supabase
    .from("products")
    .select(CATALOG_SELECT, { count: "exact" })
    .eq("status", "active")
    .order("name", { ascending: true });

  if (q) query = query.ilike("name", `%${q}%`);
  if (brand) query = query.eq("brand", brand);

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error("[catalog] erro ao consultar produtos:", error.message);
    return { items: [], total: 0, page, totalPages: 1 };
  }

  const items = ((data as RawProductRow[]) ?? []).map((row) => mapProduct(row));
  const total = count ?? 0;
  return { items, total, page, totalPages: totalPages(total) };
}

export async function getCatalog(params: {
  q?: string;
  brand?: string;
  page: number;
}): Promise<CatalogResult> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  return queryCatalog(params);
}

export async function getBrands(): Promise<string[]> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select("brand")
    .eq("status", "active")
    .not("brand", "is", null);
  if (error) {
    console.error("[catalog] erro ao consultar marcas:", error.message);
    return [];
  }
  const set = new Set<string>();
  for (const r of (data as { brand: string | null }[]) ?? []) {
    if (r.brand) set.add(r.brand);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function getProductCount(): Promise<number> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (error) {
    console.error("[catalog] erro ao contar produtos:", error.message);
    return 0;
  }
  return count ?? 0;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/catalog.ts lib/catalog.test.ts
git commit -m "feat: camada de dados do catálogo com cache periódico"
```

---

## Task 6: `components/lead-gate.tsx` — gate de cadastro (client)

Extrai o estado de `unlocked`/modal/formulário do `app/page.tsx` atual e o reorganiza num provider client com ilhas reutilizáveis. Preserva o fluxo de `/api/leads` e persiste o desbloqueio em `localStorage` (para sobreviver à navegação por `searchParams`).

**Files:**
- Create: `components/lead-gate.tsx`

**Interfaces:**
- Consumes: `PALETTE` de `@/lib/theme`; endpoint `POST /api/leads` (já existe).
- Produces (todos client):
  - `LeadGateProvider({ children }: { children: React.ReactNode })`
  - `useLeadGate(): { unlocked: boolean; openModal: () => void }`
  - `UnlockButton({ className?, style?, children })` — abre o modal se ainda bloqueado.
  - `PriceLockSlot()` — bloco "preço sob consulta" (desbloqueado) ou "cadastre-se" (bloqueado).

- [ ] **Step 1: Implementar `components/lead-gate.tsx`**

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { PALETTE } from "@/lib/theme";

const STORAGE_KEY = "mypet_unlocked";

type LeadGateValue = { unlocked: boolean; openModal: () => void };
const LeadGateContext = createContext<LeadGateValue | null>(null);

export function useLeadGate(): LeadGateValue {
  const ctx = useContext(LeadGateContext);
  if (!ctx) throw new Error("useLeadGate deve ser usado dentro de LeadGateProvider");
  return ctx;
}

export function LeadGateProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nome: "", empresa: "", whatsapp: "", cnpj: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") setUnlocked(true);
  }, []);

  const openModal = () => setShowModal(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      localStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
      setShowModal(false);
    } catch {
      setSubmitError("Não foi possível salvar seu cadastro. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LeadGateContext.Provider value={{ unlocked, openModal }}>
      {children}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔓</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: PALETTE.navy, marginBottom: 8 }}>
                Fale com a My Pet Brasil
              </h2>
              <p style={{ fontSize: 14, color: PALETTE.gray600, lineHeight: 1.5 }}>
                Cadastro gratuito e instantâneo. Só para pet shops e distribuidores.
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              <input className="form-input" placeholder="Seu nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <input className="form-input" placeholder="Nome do pet shop / empresa" required value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
              <input className="form-input" placeholder="WhatsApp com DDD" required value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
              <input className="form-input" placeholder="CNPJ (opcional)" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
              {submitError && (
                <p style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{submitError}</p>
              )}
              <button type="submit" className="form-submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Solicitar cotação →"}
              </button>
            </form>
            <button onClick={() => setShowModal(false)} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: PALETTE.gray400, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </LeadGateContext.Provider>
  );
}

export function UnlockButton({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { unlocked, openModal } = useLeadGate();
  return (
    <button className={className} style={style} onClick={unlocked ? undefined : openModal}>
      {children}
    </button>
  );
}

export function PriceLockSlot() {
  const { unlocked, openModal } = useLeadGate();
  if (unlocked) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: PALETTE.gray400, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Atacado B2B</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: PALETTE.pink }}>Preço sob consulta</div>
        <div style={{ fontSize: 11, color: PALETTE.gray400 }}>Solicite sua cotação</div>
      </div>
    );
  }
  return (
    <div onClick={openModal} style={{ cursor: "pointer", marginBottom: 12, background: PALETTE.gray100, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 16 }}>🔒</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: PALETTE.gray600 }}>Preço exclusivo lojista</div>
        <div style={{ fontSize: 10, color: PALETTE.gray400 }}>Cadastre-se para consultar</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/lead-gate.tsx
git commit -m "feat: gate de cadastro client (provider, modal, slots)"
```

---

## Task 7: `components/product-card.tsx` — card (server)

**Files:**
- Create: `components/product-card.tsx`

**Interfaces:**
- Consumes: `CatalogProduct` (Task 3); `badgeStyle`, `PALETTE` (`@/lib/theme`); `PriceLockSlot`, `UnlockButton` (Task 6).
- Produces: `ProductCard({ product }: { product: CatalogProduct })`.

- [ ] **Step 1: Implementar `components/product-card.tsx`**

```tsx
import { badgeStyle, PALETTE } from "@/lib/theme";
import { PriceLockSlot, UnlockButton } from "@/components/lead-gate";
import type { CatalogProduct } from "@/lib/catalog-utils";

export function ProductCard({ product }: { product: CatalogProduct }) {
  const style = product.badge ? badgeStyle(product.badge.code) : null;
  return (
    <div className="product-card">
      <div style={{ position: "relative" }}>
        <img src={product.img} alt={product.name} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
        {product.badge && style && (
          <span style={{ position: "absolute", top: 10, left: 10, background: style.bg, color: style.color, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 100, letterSpacing: "0.02em" }}>
            {product.badge.label}
          </span>
        )}
        {product.brand && (
          <span style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.92)", color: PALETTE.gray600, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 100, letterSpacing: "0.04em" }}>
            {product.brand.toUpperCase()}
          </span>
        )}
      </div>
      <div style={{ padding: "14px 14px 16px" }}>
        {product.sku && (
          <p style={{ fontSize: 10, color: PALETTE.gray400, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>
            SKU: {product.sku}
          </p>
        )}
        <h3 style={{ fontSize: 14, fontWeight: 800, color: PALETTE.navy, lineHeight: 1.35, marginBottom: 14, minHeight: 38 }}>
          {product.name}
        </h3>
        <PriceLockSlot />
        <UnlockButton className="unlock-btn">
          <><span>🔓</span> Solicitar cotação</>
        </UnlockButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/product-card.tsx
git commit -m "feat: card de produto a partir dos dados do hub"
```

---

## Task 8: helper de query string + `components/catalog-section.tsx`

**Files:**
- Create: `lib/querystring.ts`, `lib/querystring.test.ts`, `components/catalog-section.tsx`

**Interfaces:**
- Produces:
  - `buildCatalogQuery(params: { q?: string; brand?: string; page?: number }): string` (ex.: `"?q=ra%C3%A7%C3%A3o&page=2"`; omite vazios e `page=1`)
  - `CatalogSection({ q, brand, page }: { q?: string; brand?: string; page?: string })` — Server Component async.
- Consumes: `getCatalog`, `getBrands` (Task 5); `parsePage` (Task 3); `ProductCard` (Task 7); `PALETTE` (`@/lib/theme`).

- [ ] **Step 1: Escrever o teste do helper (falhando)** em `lib/querystring.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildCatalogQuery } from "./querystring";

describe("buildCatalogQuery", () => {
  it("retorna string vazia quando não há parâmetros relevantes", () => {
    expect(buildCatalogQuery({})).toBe("");
    expect(buildCatalogQuery({ page: 1 })).toBe("");
  });
  it("inclui q e brand codificados", () => {
    expect(buildCatalogQuery({ q: "ração", brand: "NAPI" })).toBe("?q=ra%C3%A7%C3%A3o&brand=NAPI");
  });
  it("inclui page apenas quando maior que 1", () => {
    expect(buildCatalogQuery({ brand: "NAPI", page: 3 })).toBe("?brand=NAPI&page=3");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test`
Expected: FAIL — `buildCatalogQuery` não existe.

- [ ] **Step 3: Implementar `lib/querystring.ts`**

```ts
export function buildCatalogQuery(params: { q?: string; brand?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.brand) sp.set("brand", params.brand);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Implementar `components/catalog-section.tsx`**

Controles via `<form method="get">` (busca + marca) e paginação via `<a>` com `buildCatalogQuery`. Tudo server-rendered.

```tsx
import { getCatalog, getBrands } from "@/lib/catalog";
import { parsePage } from "@/lib/catalog-utils";
import { buildCatalogQuery } from "@/lib/querystring";
import { ProductCard } from "@/components/product-card";
import { PALETTE } from "@/lib/theme";

export async function CatalogSection({
  q,
  brand,
  page: pageRaw,
}: {
  q?: string;
  brand?: string;
  page?: string;
}) {
  const page = parsePage(pageRaw);
  const [catalog, brands] = await Promise.all([
    getCatalog({ q, brand, page }),
    getBrands(),
  ]);

  return (
    <>
      {/* controles */}
      <form method="get" style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome..."
          style={{ flex: "1 1 220px", padding: "10px 14px", borderRadius: 10, border: `1px solid ${PALETTE.gray200}`, fontSize: 14 }}
        />
        <select
          name="brand"
          defaultValue={brand ?? ""}
          style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${PALETTE.gray200}`, fontSize: 14, background: PALETTE.white }}
        >
          <option value="">Todas as marcas</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <button type="submit" className="cta-primary" style={{ padding: "10px 20px", fontSize: 14 }}>
          Filtrar
        </button>
      </form>

      <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
        {catalog.total} produtos{brand ? ` da marca ${brand}` : ""}{q ? ` para "${q}"` : ""}
      </p>

      {/* grade */}
      {catalog.items.length === 0 ? (
        <p style={{ fontSize: 15, color: PALETTE.gray600, padding: "40px 0", textAlign: "center" }}>
          Nenhum produto encontrado. Tente outra busca ou marca.
        </p>
      ) : (
        <div className="products-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
          {catalog.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* paginação */}
      {catalog.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 36 }}>
          {page > 1 ? (
            <a href={buildCatalogQuery({ q, brand, page: page - 1 })} className="cat-btn">← Anterior</a>
          ) : (
            <span className="cat-btn" style={{ opacity: 0.4, pointerEvents: "none" }}>← Anterior</span>
          )}
          <span style={{ fontSize: 14, color: PALETTE.gray600 }}>Página {page} de {catalog.totalPages}</span>
          {page < catalog.totalPages ? (
            <a href={buildCatalogQuery({ q, brand, page: page + 1 })} className="cat-btn">Próxima →</a>
          ) : (
            <span className="cat-btn" style={{ opacity: 0.4, pointerEvents: "none" }}>Próxima →</span>
          )}
        </div>
      )}
    </>
  );
}
```

Nota: o link da página 1 quando não há `q`/`brand` fica vazio (`""`), o que aponta para a própria rota — comportamento correto.

- [ ] **Step 6: Commit**

```bash
git add lib/querystring.ts lib/querystring.test.ts components/catalog-section.tsx
git commit -m "feat: seção de catálogo com busca, filtro de marca e paginação"
```

---

## Task 9: Refatorar `app/page.tsx`

Converter de Client Component único para Server Component, removendo o estado e os dados fixos, e integrando os componentes novos. Preservar todo o markup estático (hero, stats, CTA, footer) e o bloco `<style>`.

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `LeadGateProvider`, `UnlockButton` (Task 6); `CatalogSection` (Task 8); `getProductCount` (Task 5); `PALETTE` (`@/lib/theme`).

- [ ] **Step 1: Remover o que não é mais usado**

- Remover a primeira linha `"use client";`.
- Remover `import { useState } from "react";` e adicionar `import { Suspense } from "react";`.
- Remover as constantes locais `PALETTE` (linhas 5-24), `CATEGORIES` (26-35), `PRODUCTS` (37-54), `BADGES` (56-60) e `STATS` será ajustado no Step 4.
- Adicionar os imports:
```tsx
import { Suspense } from "react";
import { PALETTE } from "@/lib/theme";
import { LeadGateProvider, UnlockButton } from "@/components/lead-gate";
import { CatalogSection } from "@/components/catalog-section";
import { getProductCount } from "@/lib/catalog";
```

- [ ] **Step 2: Trocar a assinatura do componente e remover hooks/handlers**

Substituir `export default function Home() { ... }` (linhas 69-101, todo o bloco de `useState`/`handleUnlock`/`handleSubmit`/`filtered`) por:
```tsx
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const total = await getProductCount();
  const totalLabel = `${total.toLocaleString("pt-BR")}+`;
```
O `return (` permanece. O JSX de modal antigo (linhas 490-550) é **removido** — o modal agora vem do `LeadGateProvider`.

- [ ] **Step 3: Envolver a página com `LeadGateProvider` e trocar os botões de unlock**

- Logo após `<div style={{ fontFamily: ... }}>` de abertura, envolver o conteúdo com `<LeadGateProvider>` … `</LeadGateProvider>` (fechando antes do `</div>` final).
- Substituir cada `<button ... onClick={handleUnlock}>Texto</button>` (hero, banner CTA, e o card "Preços bloqueados") por `<UnlockButton className="..." style={...}>Texto</UnlockButton>` mantendo as mesmas classes/estilos.
- O bloco "Preços bloqueados / Desbloquear" (linhas 360-374) pode ser mantido envolvendo o botão com `UnlockButton`. Como `UnlockButton` é client e lê `unlocked`, ele só faz sentido visível quando bloqueado; é aceitável mantê-lo sempre visível nesta fase (ou remover esse bloco — escolha do implementador, sem placeholder de preço).

- [ ] **Step 4: Substituir o bloco do catálogo (header + filtros + grid: linhas 351-458) pela seção nova**

Manter o `<section>` externo e o `<h2>Catálogo completo</h2>`. Trocar o `<p>` de contagem fixa, os filtros de categoria e o grid pela renderização async:
```tsx
      {/* CATALOG */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "52px 24px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 4 }}>Catálogo completo</h2>
          <p style={{ fontSize: 14, color: PALETTE.gray600 }}>Mais de {totalLabel} produtos disponíveis no atacado</p>
        </div>
        <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando catálogo…</p>}>
          <CatalogSection q={sp.q} brand={sp.brand} page={sp.page} />
        </Suspense>
      </section>
```

- [ ] **Step 5: Ajustar o STATS para usar o total real**

No array `STATS` (linhas 62-67), trocar a entrada `{ value: "5.000+", label: "SKUs no catálogo" }` por `{ value: totalLabel, label: "SKUs no catálogo" }`. Como `STATS` agora depende de `totalLabel`, declará-lo **dentro** da função `Home` (após `const totalLabel = ...`), não no escopo de módulo.

- [ ] **Step 6: Rodar o build e os testes**

Run:
```bash
npm test
npm run build
```
Expected: testes PASS; build conclui sem erros de tipo nem de Cache Components (a página é dinâmica por `searchParams`, com o catálogo dentro de `<Suspense>`).

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: landing lê o catálogo do hub via server component"
```

---

## Task 10: Verificação manual (via `/run`)

**Files:** nenhum (validação).

- [ ] **Step 1: Subir o app**

Run: `npm run dev` e abrir `http://localhost:3000`.

- [ ] **Step 2: Conferir o catálogo**

Verificar:
- A grade carrega produtos reais do Hub (nomes em CAIXA ALTA, marcas reais como NAPI/PLAST PET).
- Produtos sem imagem mostram o placeholder (🐾 "Sem imagem"), sem imagem quebrada.
- A contagem ("Mais de 5.367+ produtos") e o STATS refletem o total real.
- O produto com badge de teste (Task 2, Step 3) mostra a etiqueta "Escolha da My Pet".

- [ ] **Step 3: Conferir busca, marca e paginação**

- Buscar por um termo (ex.: "RACAO" / "CAMA") filtra a grade.
- Selecionar uma marca filtra corretamente.
- "Próxima/Anterior" navega e mantém os filtros na URL.

- [ ] **Step 4: Conferir o gate de leads**

- Clicar em "Solicitar cotação" / "Desbloquear" abre o modal.
- Enviar o formulário grava o lead (verificar resposta `ok` de `/api/leads`) e troca o card para "Preço sob consulta".
- Recarregar a página e navegar entre páginas mantém o estado desbloqueado (localStorage).

- [ ] **Step 5: Registrar o resultado**

Se tudo passar, a entrega está concluída. Caso contrário, abrir a skill `superpowers:systematic-debugging` antes de corrigir.

---

## Self-Review (preenchido)

**Cobertura do spec:**
- Sincronizar catálogo do Hub → Tasks 4, 5, 8, 9. ✅
- Paginação/busca/marca no servidor → Tasks 5, 8. ✅
- Cache periódico (`use cache`/`cacheLife`) → Task 5. ✅
- Placeholder p/ sem imagem → Tasks 1 (svg), 3 (`mainImage`), 7. ✅
- Badges manuais + tabela `product_badges` → Tasks 2, 3 (`pickActiveBadge`), 7. ✅
- RLS leitura pública + anon key → Tasks 2, 4. ✅
- Gate de leads "sob consulta" (sem preço) → Tasks 6, 7, 9. ✅
- STATS com total real → Tasks 5 (`getProductCount`), 9. ✅
- Fora de escopo (categoria/preço/promoção/vendidos/visitados) → não implementados; tabela `product_badges` já comporta as fases futuras. ✅

**Placeholders:** nenhum "TODO/TBD"; todos os steps de código têm código real.

**Consistência de tipos:** `CatalogProduct`/`RawProductRow`/`Badge` definidos na Task 3 e usados igualmente nas Tasks 5/7/8; `getCatalog`/`getBrands`/`getProductCount`/`queryCatalog` com assinaturas idênticas entre Task 5 e seus consumidores; `buildCatalogQuery` consistente entre Task 8 e o uso na paginação.
