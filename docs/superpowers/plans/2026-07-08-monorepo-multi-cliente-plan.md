# Monorepo multi-cliente (core + apps) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar o `mypet-landing` em um monorepo pnpm com um pacote `packages/core` compartilhado e dois apps Next.js independentes (`apps/mypet`, `apps/distribuidora`), preservando o comportamento atual da mypet em produção.

**Architecture:** pnpm workspaces (sem Turborepo). `packages/core` concentra catálogo, carrinho, leads, whatsapp, tema e componentes React compartilhados, consumidos via subpath exports (`@mypet/core/<modulo>`) sem passo de build (Next.js transpila o pacote via `transpilePackages`). Cada app tem seu próprio `client.config.ts` (marca, paleta, canal de catálogo) injetado via `ClientConfigProvider` (React Context) para os componentes compartilhados, e importado diretamente nas páginas de cada app (que não são compartilhadas).

**Tech Stack:** Next.js 16.2.6 (App Router, Cache Components), React 19.2.4, TypeScript 5 (`moduleResolution: bundler`), Supabase (`@supabase/supabase-js`), `googleapis`, Vitest 4, pnpm 11.8.0 (workspaces), ESLint 9 (flat config).

## Global Constraints

- Ferramenta de monorepo: pnpm workspaces, **sem Turborepo**.
- Um único `packages/core` — não criar `ui`/`checkout`/`admin` separados nesta entrega.
- Visibilidade de catálogo por canal = **existência de vínculo** em `product_channel_links.channel`; nunca usar o campo `is_active` dessa tabela (pertence a outra ferramenta).
- A mypet deve continuar mostrando o catálogo completo em toda etapa da migração (build/testes idênticos antes de cada extração).
- A distribuidora nasce com paleta neutra provisória e catálogo vazio (population de `product_channel_links` para `channel = 'distribuidora'` é tarefa de dados fora deste plano).
- Preservar exatamente as versões: `next@16.2.6`, `react@19.2.4`, `react-dom@19.2.4`.
- Node instalado: v24.15.0. pnpm instalado: 11.8.0 — usar `pnpm` (não `npm`) a partir da Task 1.
- Repositório Supabase Hub: projeto `hub_catalogo` (ref `hsguyfiyqpuligijcjlw`) — mesmo projeto para os dois apps, nada muda nele neste plano.

---

## Task 1: Esqueleto do pnpm workspace + mover a mypet para `apps/mypet` sem alterar comportamento

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `apps/mypet/package.json`
- Move (git mv): `app/` → `apps/mypet/app/`, `components/` → `apps/mypet/components/`, `lib/` → `apps/mypet/lib/`, `public/` → `apps/mypet/public/`, `next.config.ts` → `apps/mypet/next.config.ts`, `postcss.config.mjs` → `apps/mypet/postcss.config.mjs`, `vitest.config.ts` → `apps/mypet/vitest.config.ts`, `tsconfig.json` → `apps/mypet/tsconfig.json`
- Modify: root `package.json` (vira o package.json raiz do workspace)
- Delete (untracked, sem `git rm`): `next-env.d.ts`, `tsconfig.tsbuildinfo` (regenerados por app)
- Move (plain `mv`, arquivo não versionado): `.env.local` → `apps/mypet/.env.local`

**Interfaces:**
- Produces: `apps/mypet` como app Next.js funcional e idêntico ao estado atual (import paths `@/lib/*` e `@/components/*` continuam válidos, resolvendo dentro de `apps/mypet`).

- [ ] **Step 1: Criar o `pnpm-workspace.yaml` na raiz**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Mover o código atual para `apps/mypet`**

```bash
mkdir -p apps/mypet
git mv app apps/mypet/app
git mv components apps/mypet/components
git mv lib apps/mypet/lib
git mv public apps/mypet/public
git mv next.config.ts apps/mypet/next.config.ts
git mv postcss.config.mjs apps/mypet/postcss.config.mjs
git mv vitest.config.ts apps/mypet/vitest.config.ts
git mv tsconfig.json apps/mypet/tsconfig.json
mv .env.local apps/mypet/.env.local
rm -f next-env.d.ts tsconfig.tsbuildinfo
```

- [ ] **Step 3: Criar `apps/mypet/package.json`** (conteúdo igual ao `package.json` raiz atual, renomeado)

```json
{
  "name": "mypet",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.108.2",
    "googleapis": "^173.0.0",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 4: Reescrever o `package.json` raiz como package.json do workspace**

```json
{
  "name": "mypet-landing",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev:mypet": "pnpm --filter mypet dev",
    "dev:distribuidora": "pnpm --filter distribuidora dev",
    "build": "pnpm -r build",
    "lint": "eslint",
    "test": "pnpm --filter @mypet/core test"
  },
  "devDependencies": {
    "eslint": "^9",
    "eslint-config-next": "16.2.6"
  }
}
```

- [ ] **Step 5: Instalar dependências e verificar que a mypet builda sem mudanças de comportamento**

```bash
pnpm install
pnpm --filter mypet build
pnpm --filter mypet exec vitest run
```

Expected: build conclui sem erros; os 6 arquivos de teste em `apps/mypet/lib/*.test.ts` passam exatamente como antes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: mover mypet-landing para apps/mypet em um workspace pnpm"
```

---

## Task 2: Criar `packages/core` e extrair `lib/` + `components/`

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`
- Move (git mv): todos os arquivos de `apps/mypet/lib/*.ts` (e `*.test.ts`) → `packages/core/src/*.ts`; todos os arquivos de `apps/mypet/components/*.tsx` → `packages/core/src/components/*.tsx`
- Delete: `apps/mypet/lib/` (vazio após o move), `apps/mypet/components/` (vazio após o move), `apps/mypet/vitest.config.ts` (não há mais testes em `apps/mypet`)
- Modify: `apps/mypet/package.json` (remove `@supabase/supabase-js`/`googleapis`/`vitest`, adiciona `@mypet/core`)
- Modify: todos os arquivos em `apps/mypet/app/**/*.tsx` que importam de `@/lib/*` ou `@/components/*`

**Interfaces:**
- Consumes: nenhuma interface nova (rename mecânico de caminho de import).
- Produces: `@mypet/core/catalog`, `@mypet/core/catalog-utils`, `@mypet/core/cart`, `@mypet/core/leads`, `@mypet/core/whatsapp`, `@mypet/core/querystring`, `@mypet/core/supabase`, `@mypet/core/theme`, `@mypet/core/components/<nome>` — mesmas assinaturas de hoje, apenas em novo local.

- [ ] **Step 1: Mover os módulos de `lib/` para `packages/core/src/`**

```bash
mkdir -p packages/core/src/components
git mv apps/mypet/lib/catalog.ts packages/core/src/catalog.ts
git mv apps/mypet/lib/catalog.test.ts packages/core/src/catalog.test.ts
git mv apps/mypet/lib/catalog-utils.ts packages/core/src/catalog-utils.ts
git mv apps/mypet/lib/catalog-utils.test.ts packages/core/src/catalog-utils.test.ts
git mv apps/mypet/lib/cart.ts packages/core/src/cart.ts
git mv apps/mypet/lib/cart.test.ts packages/core/src/cart.test.ts
git mv apps/mypet/lib/leads.ts packages/core/src/leads.ts
git mv apps/mypet/lib/leads.test.ts packages/core/src/leads.test.ts
git mv apps/mypet/lib/whatsapp.ts packages/core/src/whatsapp.ts
git mv apps/mypet/lib/whatsapp.test.ts packages/core/src/whatsapp.test.ts
git mv apps/mypet/lib/querystring.ts packages/core/src/querystring.ts
git mv apps/mypet/lib/querystring.test.ts packages/core/src/querystring.test.ts
git mv apps/mypet/lib/supabase.ts packages/core/src/supabase.ts
git mv apps/mypet/lib/theme.ts packages/core/src/theme.ts
git mv apps/mypet/components/site-nav.tsx packages/core/src/components/site-nav.tsx
git mv apps/mypet/components/lead-gate.tsx packages/core/src/components/lead-gate.tsx
git mv apps/mypet/components/product-card.tsx packages/core/src/components/product-card.tsx
git mv apps/mypet/components/catalog-section.tsx packages/core/src/components/catalog-section.tsx
git mv apps/mypet/components/cart-badge.tsx packages/core/src/components/cart-badge.tsx
git mv apps/mypet/components/add-to-cart-control.tsx packages/core/src/components/add-to-cart-control.tsx
git mv apps/mypet/components/cart-provider.tsx packages/core/src/components/cart-provider.tsx
git mv apps/mypet/vitest.config.ts packages/core/vitest.config.ts
rmdir apps/mypet/lib apps/mypet/components
```

- [ ] **Step 2: Criar `packages/core/package.json`**

```json
{
  "name": "@mypet/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./catalog": "./src/catalog.ts",
    "./catalog-utils": "./src/catalog-utils.ts",
    "./cart": "./src/cart.ts",
    "./leads": "./src/leads.ts",
    "./whatsapp": "./src/whatsapp.ts",
    "./querystring": "./src/querystring.ts",
    "./supabase": "./src/supabase.ts",
    "./theme": "./src/theme.ts",
    "./components/*": "./src/components/*.tsx"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.108.2",
    "googleapis": "^173.0.0"
  },
  "peerDependencies": {
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 3: Criar `packages/core/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Ajustar `packages/core/vitest.config.ts`** (movido no Step 1; conteúdo já é `include: ["lib/**/*.test.ts"]` — corrigir o glob)

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Atualizar `apps/mypet/package.json`** — remover `@supabase/supabase-js`, `googleapis`, `vitest` das dependências e adicionar `@mypet/core`

```json
{
  "name": "mypet",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@mypet/core": "workspace:*",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 6: Atualizar os imports em `apps/mypet/app/page.tsx`**

```diff
- import { PALETTE } from "@/lib/theme";
+ import { PALETTE } from "@mypet/core/theme";
```
```diff
- import { LeadGateProvider, UnlockButton } from "@/components/lead-gate";
- import { CatalogSection } from "@/components/catalog-section";
- import { getProductCount } from "@/lib/catalog";
- import { SiteNav } from "@/components/site-nav";
+ import { LeadGateProvider, UnlockButton } from "@mypet/core/components/lead-gate";
+ import { CatalogSection } from "@mypet/core/components/catalog-section";
+ import { getProductCount } from "@mypet/core/catalog";
+ import { SiteNav } from "@mypet/core/components/site-nav";
```

- [ ] **Step 7: Atualizar os imports em `apps/mypet/app/cotacao/page.tsx`**

```diff
- import { PALETTE } from "@/lib/theme";
- import { useCart } from "@/components/cart-provider";
- import { LeadGateProvider } from "@/components/lead-gate";
- import { SiteNav } from "@/components/site-nav";
- import { submitLead } from "@/lib/leads";
- import { buildQuoteMessage, buildWhatsAppLink } from "@/lib/whatsapp";
+ import { PALETTE } from "@mypet/core/theme";
+ import { useCart } from "@mypet/core/components/cart-provider";
+ import { LeadGateProvider } from "@mypet/core/components/lead-gate";
+ import { SiteNav } from "@mypet/core/components/site-nav";
+ import { submitLead } from "@mypet/core/leads";
+ import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
```

- [ ] **Step 8: Atualizar os imports em `apps/mypet/app/produtos/[id]/page.tsx`**

```diff
- import { PALETTE, badgeStyle } from "@/lib/theme";
- import { getProductById } from "@/lib/catalog";
- import { LeadGateProvider, UnlockButton } from "@/components/lead-gate";
- import { SiteNav } from "@/components/site-nav";
- import { AddToCartControl } from "@/components/add-to-cart-control";
+ import { PALETTE, badgeStyle } from "@mypet/core/theme";
+ import { getProductById } from "@mypet/core/catalog";
+ import { LeadGateProvider, UnlockButton } from "@mypet/core/components/lead-gate";
+ import { SiteNav } from "@mypet/core/components/site-nav";
+ import { AddToCartControl } from "@mypet/core/components/add-to-cart-control";
```

- [ ] **Step 9: Atualizar o import em `apps/mypet/app/layout.tsx`**

```diff
- import { CartProvider } from "@/components/cart-provider";
+ import { CartProvider } from "@mypet/core/components/cart-provider";
```

- [ ] **Step 10: Dentro de `packages/core/src/components/`, atualizar os imports cruzados entre componentes** (cada arquivo abaixo trocando `@/lib/*` e `@/components/*` por caminhos relativos dentro do próprio pacote)

`packages/core/src/components/site-nav.tsx`:
```diff
- import { PALETTE } from "@/lib/theme";
- import { UnlockButton } from "@/components/lead-gate";
- import { CartBadge } from "@/components/cart-badge";
+ import { PALETTE } from "../theme";
+ import { UnlockButton } from "./lead-gate";
+ import { CartBadge } from "./cart-badge";
```

`packages/core/src/components/lead-gate.tsx`:
```diff
- import { PALETTE } from "@/lib/theme";
- import { submitLead } from "@/lib/leads";
+ import { PALETTE } from "../theme";
+ import { submitLead } from "../leads";
```

`packages/core/src/components/product-card.tsx`:
```diff
- import { badgeStyle, PALETTE } from "@/lib/theme";
- import { PriceLockSlot, UnlockButton } from "@/components/lead-gate";
- import type { CatalogProduct } from "@/lib/catalog-utils";
- import { AddToCartControl } from "@/components/add-to-cart-control";
+ import { badgeStyle, PALETTE } from "../theme";
+ import { PriceLockSlot, UnlockButton } from "./lead-gate";
+ import type { CatalogProduct } from "../catalog-utils";
+ import { AddToCartControl } from "./add-to-cart-control";
```

`packages/core/src/components/catalog-section.tsx`:
```diff
- import { getCatalog, getBrands } from "@/lib/catalog";
- import { parsePage } from "@/lib/catalog-utils";
- import { buildCatalogQuery } from "@/lib/querystring";
- import { ProductCard } from "@/components/product-card";
- import { PALETTE } from "@/lib/theme";
+ import { getCatalog, getBrands } from "../catalog";
+ import { parsePage } from "../catalog-utils";
+ import { buildCatalogQuery } from "../querystring";
+ import { ProductCard } from "./product-card";
+ import { PALETTE } from "../theme";
```

`packages/core/src/components/cart-badge.tsx`:
```diff
- import { PALETTE } from "@/lib/theme";
- import { useCart } from "@/components/cart-provider";
+ import { PALETTE } from "../theme";
+ import { useCart } from "./cart-provider";
```

`packages/core/src/components/add-to-cart-control.tsx`:
```diff
- import { PALETTE } from "@/lib/theme";
- import { useCart } from "@/components/cart-provider";
- import type { CartItem } from "@/lib/cart";
+ import { PALETTE } from "../theme";
+ import { useCart } from "./cart-provider";
+ import type { CartItem } from "../cart";
```

`packages/core/src/components/cart-provider.tsx`:
```diff
- } from "@/lib/cart";
+ } from "../cart";
```

- [ ] **Step 11: Adicionar `transpilePackages` ao `apps/mypet/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@mypet/core"],
};

export default nextConfig;
```

- [ ] **Step 12: Instalar e verificar**

```bash
pnpm install
pnpm --filter @mypet/core test
pnpm --filter mypet build
```

Expected: os 6 arquivos de teste passam a partir de `packages/core/src`; o build da mypet conclui sem erros e sem mudança de comportamento.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "refactor: extrair lib/ e components/ para packages/core"
```

---

## Task 3: Filtro de catálogo por canal em `packages/core/src/catalog.ts`

**Files:**
- Modify: `packages/core/src/catalog.ts`
- Modify: `packages/core/src/catalog.test.ts`
- Modify: `packages/core/src/components/catalog-section.tsx` (chamadas de `getCatalog`/`getBrands`)
- Modify: `apps/mypet/app/produtos/[id]/page.tsx` (chamada de `getProductById`)
- Modify: `apps/mypet/app/page.tsx` (chamadas de `getProductCount`)

**Interfaces:**
- Consumes: nenhuma (mudança interna de `packages/core/src/catalog.ts`).
- Produces: `queryCatalog({ q, brand, page, channel })`, `getCatalog({ q, brand, page, channel })`, `getBrands(channel: string)`, `getProductCount(channel: string)`, `getProductById(id: string, channel: string)` — `channel` passa a ser **obrigatório** em todas.

- [ ] **Step 1: Escrever o teste que falha para o filtro por canal**

Editar `packages/core/src/catalog.test.ts`, substituindo o `describe("queryCatalog", ...)` existente por:

```ts
describe("queryCatalog", () => {
  it("aplica busca, marca, canal, paginação e mapeia os itens", async () => {
    const result = await queryCatalog({ q: "ração", brand: "NAPI", page: 2, channel: "mypetbrasil" });
    expect(calls["ilike"]).toEqual(["name", "%ração%"]);
    expect(calls["eq"]).toContainEqual(["status", "active"]);
    expect(calls["eq"]).toContainEqual(["brand", "NAPI"]);
    expect(calls["eq"]).toContainEqual(["product_channel_links.channel", "mypetbrasil"]);
    expect(calls["select"][0]).toContain("product_channel_links");
    expect(calls["range"]).toEqual([24, 47]);
    expect(result.total).toBe(50);
    expect(result.totalPages).toBe(3);
    expect(result.items[0]).toMatchObject({ id: "p1", sku: "100", img: "https://img/1" });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
pnpm --filter @mypet/core exec vitest run src/catalog.test.ts
```

Expected: FAIL — `calls["eq"]` não contém `["product_channel_links.channel", "mypetbrasil"]` (a query ainda não filtra por canal).

- [ ] **Step 3: Implementar o filtro por canal em `packages/core/src/catalog.ts`**

Substituir o conteúdo do arquivo por:

```ts
import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import {
  mapProduct,
  pageRange,
  totalPages,
  mainImage,
  pickActiveBadge,
  type CatalogResult,
  type RawProductRow,
} from "./catalog-utils";

export const CATALOG_SELECT =
  "id, name, reference, brand, product_assets(url, type), product_badges(code, label, kind, priority, starts_at, ends_at)";

export async function queryCatalog(params: {
  q?: string;
  brand?: string;
  page: number;
  channel: string;
}): Promise<CatalogResult> {
  const { q, brand, page, channel } = params;
  const supabase = getHubClient();
  const { from, to } = pageRange(page);

  let query = supabase
    .from("products")
    .select(`${CATALOG_SELECT}, product_channel_links!inner(channel)`, { count: "exact" })
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
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
  channel: string;
}): Promise<CatalogResult> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  return queryCatalog(params);
}

export async function getBrands(channel: string): Promise<string[]> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select("brand, product_channel_links!inner(channel)")
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
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

export async function getProductCount(channel: string): Promise<number> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { count, error } = await supabase
    .from("products")
    .select("id, product_channel_links!inner(channel)", { count: "exact", head: true })
    .eq("status", "active")
    .eq("product_channel_links.channel", channel);
  if (error) {
    console.error("[catalog] erro ao contar produtos:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getProductById(id: string, channel: string) {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, reference, brand, description, barcode, weight_kg, width_cm, height_cm, length_cm, product_assets(url, type), product_badges(code, label, kind, priority, starts_at, ends_at), product_channel_links!inner(channel)"
    )
    .eq("id", id)
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
    .single();

  if (error || !data) {
    console.error("[catalog] erro ao buscar produto por id:", error?.message);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    sku: data.reference ?? "",
    brand: data.brand,
    description: data.description,
    barcode: data.barcode,
    weight_kg: data.weight_kg,
    width_cm: data.width_cm,
    height_cm: data.height_cm,
    length_cm: data.length_cm,
    img: mainImage(data.product_assets),
    badge: pickActiveBadge(data.product_badges),
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
pnpm --filter @mypet/core exec vitest run src/catalog.test.ts
```

Expected: PASS.

- [ ] **Step 5: Atualizar os call sites com o literal temporário `"mypetbrasil"`** (será substituído por `clientConfig.catalogChannel` na Task 4)

`packages/core/src/components/catalog-section.tsx`:
```diff
- const [catalog, brands] = await Promise.all([
-   getCatalog({ q, brand, page }),
-   getBrands(),
- ]);
+ const [catalog, brands] = await Promise.all([
+   getCatalog({ q, brand, page, channel: "mypetbrasil" }),
+   getBrands("mypetbrasil"),
+ ]);
```

`apps/mypet/app/produtos/[id]/page.tsx` — **duas ocorrências** de `getProductById(id)` (uma em `generateMetadata`, outra em `ProductDetail`); atualizar as duas:
```diff
- const product = await getProductById(id);
+ const product = await getProductById(id, "mypetbrasil");
```

`apps/mypet/app/page.tsx` (em `StatsCount` e em `CatalogContent`, duas ocorrências):
```diff
- const total = await getProductCount();
+ const total = await getProductCount("mypetbrasil");
```

- [ ] **Step 6: Rodar todos os testes de `@mypet/core` e o build da mypet**

```bash
pnpm --filter @mypet/core test
pnpm --filter mypet build
```

Expected: todos os testes passam; build conclui sem erros. O catálogo da mypet continua mostrando todos os produtos (os 5.367 já têm vínculo `mypetbrasil`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: filtrar catalogo por canal via product_channel_links"
```

---

## Task 4: `ClientConfigProvider` + `client.config.ts` da mypet

**Files:**
- Create: `apps/mypet/client.config.ts`
- Modify: `packages/core/src/theme.ts` → renomear para `packages/core/src/theme.tsx` e reescrever
- Modify: `packages/core/package.json` (exports `"./theme"` aponta para `.tsx`)
- Modify: `packages/core/src/components/site-nav.tsx`, `lead-gate.tsx`, `product-card.tsx`, `cart-badge.tsx`, `add-to-cart-control.tsx`, `catalog-section.tsx`
- Modify: `apps/mypet/app/layout.tsx`, `apps/mypet/app/page.tsx`, `apps/mypet/app/cotacao/page.tsx`, `apps/mypet/app/produtos/[id]/page.tsx`

**Interfaces:**
- Produces: `type Palette`, `type ClientConfig`, `ClientConfigProvider({ config, children })`, `useClientConfig(): ClientConfig`, `badgeStyle(code: string, palette: Palette)` em `@mypet/core/theme`.
- Consumes: `queryCatalog`/`getCatalog`/`getBrands`/`getProductCount`/`getProductById` de `@mypet/core/catalog` (assinaturas da Task 3, com `channel` obrigatório).

- [ ] **Step 1: Renomear `theme.ts` para `theme.tsx` e reescrever com o Provider**

```bash
git mv packages/core/src/theme.ts packages/core/src/theme.tsx
```

Conteúdo de `packages/core/src/theme.tsx`:

```tsx
"use client";

import { createContext, useContext } from "react";

export type Palette = {
  pink: string;
  pinkDark: string;
  pinkLight: string;
  cyan: string;
  cyanDark: string;
  cyanLight: string;
  navy: string;
  navyDark: string;
  navyLight: string;
  orange: string;
  green: string;
  white: string;
  gray50: string;
  gray100: string;
  gray200: string;
  gray400: string;
  gray600: string;
  gray800: string;
};

export type ClientConfig = {
  name: string;
  tagline: string;
  domain: string;
  catalogChannel: string;
  palette: Palette;
  logo: { emoji: string };
};

const ClientConfigContext = createContext<ClientConfig | null>(null);

export function ClientConfigProvider({
  config,
  children,
}: {
  config: ClientConfig;
  children: React.ReactNode;
}) {
  return <ClientConfigContext.Provider value={config}>{children}</ClientConfigContext.Provider>;
}

export function useClientConfig(): ClientConfig {
  const ctx = useContext(ClientConfigContext);
  if (!ctx) throw new Error("useClientConfig deve ser usado dentro de ClientConfigProvider");
  return ctx;
}

const BADGE_STYLES: Record<string, (palette: Palette) => { bg: string; color: string }> = {
  escolha_mypet: (p) => ({ bg: p.pinkLight, color: p.pink }),
  novidade: (p) => ({ bg: p.navyLight, color: p.navy }),
  promocao: () => ({ bg: "#FFF0E5", color: "#FF6A00" }),
};

export function badgeStyle(code: string, palette: Palette): { bg: string; color: string } {
  const fn = BADGE_STYLES[code];
  return fn ? fn(palette) : { bg: palette.gray100, color: palette.gray600 };
}
```

- [ ] **Step 2: Atualizar `packages/core/package.json`** (subpath `"./theme"` agora aponta para `.tsx`)

```diff
-    "./theme": "./src/theme.ts",
+    "./theme": "./src/theme.tsx",
```

- [ ] **Step 3: Criar `apps/mypet/client.config.ts`**

```ts
import type { ClientConfig } from "@mypet/core/theme";

export const clientConfig: ClientConfig = {
  name: "My Pet Brasil",
  tagline: "Atacado B2B",
  domain: "mypetbrasil.com.br",
  catalogChannel: "mypetbrasil",
  palette: {
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
  },
  logo: { emoji: "🐾" },
};
```

- [ ] **Step 4: Reescrever `packages/core/src/components/site-nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useClientConfig } from "../theme";
import { UnlockButton } from "./lead-gate";
import { CartBadge } from "./cart-badge";

export function SiteNav() {
  const { name, tagline, palette, logo } = useClientConfig();
  return (
    <nav style={{ background: palette.white, borderBottom: `1px solid ${palette.gray200}`, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 34, height: 34, background: palette.pink, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 18 }}>{logo.emoji}</span>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: palette.navy, lineHeight: 1 }}>{name}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: palette.pink, letterSpacing: "0.12em", textTransform: "uppercase" }}>{tagline}</div>
          </div>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: palette.gray600, fontWeight: 600 }}>Exclusivo para lojistas</span>
          <CartBadge />
          <UnlockButton className="cta-primary" style={{ padding: "10px 22px", fontSize: 14 }}>
            Solicitar cotação
          </UnlockButton>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Reescrever `packages/core/src/components/lead-gate.tsx`**

```tsx
"use client";

import { createContext, useContext, useState } from "react";
import { useClientConfig } from "../theme";
import { submitLead } from "../leads";

type LeadGateValue = { openModal: () => void };
const LeadGateContext = createContext<LeadGateValue | null>(null);

export function useLeadGate(): LeadGateValue {
  const ctx = useContext(LeadGateContext);
  if (!ctx) throw new Error("useLeadGate deve ser usado dentro de LeadGateProvider");
  return ctx;
}

export function LeadGateProvider({ children }: { children: React.ReactNode }) {
  const { name, palette } = useClientConfig();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nome: "", empresa: "", whatsapp: "", cnpj: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const openModal = () => setShowModal(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    const error = await submitLead(form);
    if (error) {
      setSubmitError(error);
    } else {
      setShowModal(false);
    }
    setSubmitting(false);
  };

  return (
    <LeadGateContext.Provider value={{ openModal }}>
      {children}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔓</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: palette.navy, marginBottom: 8 }}>
                Fale com a {name}
              </h2>
              <p style={{ fontSize: 14, color: palette.gray600, lineHeight: 1.5 }}>
                Cadastro gratuito e instantâneo. Só para pet shops e distribuidores.
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              <input className="form-input" placeholder="Seu nome" required value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
              <input className="form-input" placeholder="Nome do pet shop / empresa" required value={form.empresa} onChange={(e) => setForm((prev) => ({ ...prev, empresa: e.target.value }))} />
              <input className="form-input" placeholder="WhatsApp com DDD" required value={form.whatsapp} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))} />
              <input className="form-input" placeholder="CNPJ (opcional)" value={form.cnpj} onChange={(e) => setForm((prev) => ({ ...prev, cnpj: e.target.value }))} />
              {submitError && (
                <p style={{ color: palette.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{submitError}</p>
              )}
              <button type="submit" className="form-submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Solicitar cotação →"}
              </button>
            </form>
            <button onClick={() => setShowModal(false)} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: palette.gray400, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
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
  const { openModal } = useLeadGate();
  return (
    <button className={className} style={style} onClick={openModal}>
      {children}
    </button>
  );
}

export function PriceLockSlot() {
  const { palette } = useClientConfig();
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: palette.gray400, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Atacado B2B</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: palette.pink }}>Preço sob consulta</div>
      <div style={{ fontSize: 11, color: palette.gray400 }}>Solicite sua cotação</div>
    </div>
  );
}
```

- [ ] **Step 6: Reescrever `packages/core/src/components/product-card.tsx`** (vira Client Component)

```tsx
"use client";

import { badgeStyle, useClientConfig } from "../theme";
import { PriceLockSlot, UnlockButton } from "./lead-gate";
import type { CatalogProduct } from "../catalog-utils";
import Link from "next/link";
import { AddToCartControl } from "./add-to-cart-control";

export function ProductCard({ product }: { product: CatalogProduct }) {
  const { palette } = useClientConfig();
  const style = product.badge ? badgeStyle(product.badge.code, palette) : null;
  return (
    <div className="product-card">
      <Link href={`/produtos/${product.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        <div style={{ position: "relative" }}>
          <img src={product.img} alt={product.name} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
          {product.badge && style && (
            <span style={{ position: "absolute", top: 10, left: 10, background: style.bg, color: style.color, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 100, letterSpacing: "0.02em" }}>
              {product.badge.label}
            </span>
          )}
          {product.brand && (
            <span style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.92)", color: palette.gray600, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 100, letterSpacing: "0.04em" }}>
              {product.brand.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ padding: "14px 14px 0" }}>
          {product.sku && (
            <p style={{ fontSize: 10, color: palette.gray400, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>
              SKU: {product.sku}
            </p>
          )}
          <h3 style={{ fontSize: 14, fontWeight: 800, color: palette.navy, lineHeight: 1.35, marginBottom: 14, minHeight: 38 }}>
            {product.name}
          </h3>
        </div>
      </Link>
      <div style={{ padding: "0 14px 16px" }}>
        <PriceLockSlot />
        <UnlockButton className="unlock-btn">
          <><span>💬</span> Solicitar cotação</>
        </UnlockButton>
        <AddToCartControl
          product={{ id: product.id, name: product.name, sku: product.sku, brand: product.brand, img: product.img }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Reescrever `packages/core/src/components/cart-badge.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useClientConfig } from "../theme";
import { useCart } from "./cart-provider";

export function CartBadge() {
  const { totalItems } = useCart();
  const { palette } = useClientConfig();

  return (
    <Link
      href="/cotacao"
      aria-label={
        totalItems > 0
          ? `Carrinho de cotação com ${totalItems} ${totalItems === 1 ? "item" : "itens"}`
          : "Carrinho de cotação vazio"
      }
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: palette.gray100,
        textDecoration: "none",
        fontSize: 18,
      }}
    >
      🛒
      {totalItems > 0 && (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: "0 4px",
            borderRadius: 100,
            background: palette.pink,
            color: palette.white,
            fontSize: 11,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {totalItems}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 8: Reescrever `packages/core/src/components/add-to-cart-control.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useClientConfig } from "../theme";
import { useCart } from "./cart-provider";
import type { CartItem } from "../cart";

export function AddToCartControl({ product }: { product: Omit<CartItem, "qty"> }) {
  const { addItem } = useCart();
  const { palette } = useClientConfig();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem(product, qty);
    setQty(1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${palette.gray200}`, borderRadius: 8 }}>
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          aria-label="Diminuir quantidade"
          style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: palette.gray600 }}
        >
          −
        </button>
        <span style={{ minWidth: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: palette.navy }}>{qty}</span>
        <button
          type="button"
          onClick={() => setQty((q) => q + 1)}
          aria-label="Aumentar quantidade"
          style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: palette.gray600 }}
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        style={{
          flex: 1,
          padding: "8px 0",
          background: added ? palette.green : palette.gray100,
          color: added ? palette.white : palette.navy,
          border: "none",
          borderRadius: 8,
          fontFamily: "Nunito, sans-serif",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          transition: "background 0.2s, color 0.2s",
        }}
      >
        {added ? "Adicionado ✓" : "+ Adicionar à cotação"}
      </button>
    </div>
  );
}
```

- [ ] **Step 9: Reescrever `packages/core/src/components/catalog-section.tsx`** (Server Component — recebe `channel` e `palette` como props, não via hook)

```tsx
import { getCatalog, getBrands } from "../catalog";
import { parsePage } from "../catalog-utils";
import { buildCatalogQuery } from "../querystring";
import { ProductCard } from "./product-card";
import type { Palette } from "../theme";

export async function CatalogSection({
  q,
  brand,
  page: pageRaw,
  channel,
  palette,
}: {
  q?: string;
  brand?: string;
  page?: string;
  channel: string;
  palette: Palette;
}) {
  const page = parsePage(pageRaw);
  const [catalog, brands] = await Promise.all([
    getCatalog({ q, brand, page, channel }),
    getBrands(channel),
  ]);

  return (
    <>
      <form method="get" style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome..."
          aria-label="Buscar produtos por nome"
          style={{ flex: "1 1 220px", padding: "10px 14px", borderRadius: 10, border: `1px solid ${palette.gray200}`, fontSize: 14 }}
        />
        <select
          name="brand"
          defaultValue={brand ?? ""}
          aria-label="Filtrar por marca"
          style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${palette.gray200}`, fontSize: 14, background: palette.white }}
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

      <p style={{ fontSize: 14, color: palette.gray600, marginBottom: 20 }}>
        {catalog.total} produtos{brand ? ` da marca ${brand}` : ""}{q ? ` para "${q}"` : ""}
      </p>

      {catalog.items.length === 0 ? (
        <p style={{ fontSize: 15, color: palette.gray600, padding: "40px 0", textAlign: "center" }}>
          Nenhum produto encontrado. Tente outra busca ou marca.
        </p>
      ) : (
        <div className="products-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
          {catalog.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {catalog.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 36 }}>
          {page > 1 ? (
            <a href={buildCatalogQuery({ q, brand, page: page - 1 })} className="cat-btn">← Anterior</a>
          ) : (
            <span className="cat-btn" style={{ opacity: 0.4, pointerEvents: "none" }} aria-disabled="true">← Anterior</span>
          )}
          <span style={{ fontSize: 14, color: palette.gray600 }}>Página {page} de {catalog.totalPages}</span>
          {page < catalog.totalPages ? (
            <a href={buildCatalogQuery({ q, brand, page: page + 1 })} className="cat-btn">Próxima →</a>
          ) : (
            <span className="cat-btn" style={{ opacity: 0.4, pointerEvents: "none" }} aria-disabled="true">Próxima →</span>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 10: Atualizar `apps/mypet/app/layout.tsx`**

```diff
 import type { Metadata } from "next";
 import { Geist, Geist_Mono } from "next/font/google";
-import { CartProvider } from "@mypet/core/components/cart-provider";
+import { ClientConfigProvider } from "@mypet/core/theme";
+import { CartProvider } from "@mypet/core/components/cart-provider";
+import { clientConfig } from "@/client.config";
 import "./globals.css";
```
```diff
 export const metadata: Metadata = {
-  title: "My Pet Brasil — Atacado B2B",
+  title: `${clientConfig.name} — ${clientConfig.tagline}`,
   description:
     "Catálogo de atacado para pet shops e distribuidores. Cadastro gratuito, cotações sob consulta.",
 };
```
```diff
       <body className="min-h-full flex flex-col">
-        <CartProvider>{children}</CartProvider>
+        <ClientConfigProvider config={clientConfig}>
+          <CartProvider>{children}</CartProvider>
+        </ClientConfigProvider>
       </body>
```

- [ ] **Step 11: Atualizar `apps/mypet/app/page.tsx`**

```diff
 import { Suspense } from "react";
-import { PALETTE } from "@mypet/core/theme";
+import type { Palette } from "@mypet/core/theme";
 import { LeadGateProvider, UnlockButton } from "@mypet/core/components/lead-gate";
 import { CatalogSection } from "@mypet/core/components/catalog-section";
 import { getProductCount } from "@mypet/core/catalog";
 import { SiteNav } from "@mypet/core/components/site-nav";
+import { clientConfig } from "@/client.config";
+
+const { palette: PALETTE } = clientConfig;
```

```diff
-async function StatsCount() {
-  const total = await getProductCount("mypetbrasil");
+async function StatsCount({ channel }: { channel: string }) {
+  const total = await getProductCount(channel);
```

```diff
 async function CatalogContent({
   q,
   brand,
   page,
+  channel,
+  palette,
 }: {
   q?: string;
   brand?: string;
   page?: string;
+  channel: string;
+  palette: Palette;
 }) {
-  const total = await getProductCount("mypetbrasil");
+  const total = await getProductCount(channel);
   const totalLabel = `${total.toLocaleString("pt-BR")}+`;
   return (
     <>
       <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
         Mais de {totalLabel} produtos disponíveis no atacado
       </p>
-      <CatalogSection q={q} brand={brand} page={page} />
+      <CatalogSection q={q} brand={brand} page={page} channel={channel} palette={palette} />
     </>
   );
 }
```

```diff
 async function DynamicCatalog({
   searchParams,
+  channel,
+  palette,
 }: {
   searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
+  channel: string;
+  palette: Palette;
 }) {
   const sp = await searchParams;
   return (
     <section id="catalogo" style={{ maxWidth: 1200, margin: "0 auto", padding: "52px 24px 80px" }}>
       <div style={{ marginBottom: 28 }}>
         <h2 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 4 }}>Catálogo completo</h2>
       </div>
       <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando catálogo…</p>}>
-        <CatalogContent q={sp.q} brand={sp.brand} page={sp.page} />
+        <CatalogContent q={sp.q} brand={sp.brand} page={sp.page} channel={channel} palette={palette} />
       </Suspense>
     </section>
   );
 }
```

```diff
               }>
-                <StatsCount />
+                <StatsCount channel={clientConfig.catalogChannel} />
               </Suspense>
```

```diff
         </Suspense>
-          <DynamicCatalog searchParams={searchParams} />
+          <DynamicCatalog searchParams={searchParams} channel={clientConfig.catalogChannel} palette={clientConfig.palette} />
```

- [ ] **Step 12: Atualizar `apps/mypet/app/cotacao/page.tsx`**

```diff
 import { PALETTE } from "@mypet/core/theme";
 import { useCart } from "@mypet/core/components/cart-provider";
 import { LeadGateProvider } from "@mypet/core/components/lead-gate";
 import { SiteNav } from "@mypet/core/components/site-nav";
 import { submitLead } from "@mypet/core/leads";
 import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
+import { clientConfig } from "@/client.config";
+
+const { palette: PALETTE } = clientConfig;
```

(remover a linha `import { PALETTE } from "@mypet/core/theme";` original, já substituída pela constante local acima)

- [ ] **Step 13: Atualizar `apps/mypet/app/produtos/[id]/page.tsx`**

```diff
 import { Suspense } from "react";
-import { PALETTE, badgeStyle } from "@mypet/core/theme";
+import { badgeStyle } from "@mypet/core/theme";
 import { getProductById } from "@mypet/core/catalog";
 import { LeadGateProvider, UnlockButton } from "@mypet/core/components/lead-gate";
 import Link from "next/link";
 import { notFound } from "next/navigation";
 import { SiteNav } from "@mypet/core/components/site-nav";
 import { AddToCartControl } from "@mypet/core/components/add-to-cart-control";
+import { clientConfig } from "@/client.config";
+
+const { palette: PALETTE } = clientConfig;
```

Dentro de `generateMetadata` (a primeira ocorrência de `getProductById`, ~linha 15 do arquivo original):
```diff
   const { id } = await params;
-  const product = await getProductById(id, "mypetbrasil");
-  if (!product) return { title: "Produto não encontrado — My Pet Brasil" };
+  const product = await getProductById(id, clientConfig.catalogChannel);
+  if (!product) return { title: `Produto não encontrado — ${clientConfig.name}` };

   return {
-    title: `${product.name} — My Pet Brasil Atacado`,
-    description: `Confira os detalhes de ${product.name} no atacado B2B da My Pet Brasil. Solicite cotação sem compromisso.`,
+    title: `${product.name} — ${clientConfig.name} Atacado`,
+    description: `Confira os detalhes de ${product.name} no atacado B2B da ${clientConfig.name}. Solicite cotação sem compromisso.`,
   };
```

No footer de `ProductPage`:
```diff
         <footer style={{ background: PALETTE.navyDark, padding: "32px 24px" }}>
           <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
             <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
-              <span style={{ fontSize: 20 }}>🐾</span>
-              <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 14 }}>My Pet Brasil — Atacado B2B</span>
+              <span style={{ fontSize: 20 }}>{clientConfig.logo.emoji}</span>
+              <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 14 }}>{clientConfig.name} — {clientConfig.tagline}</span>
             </div>
-            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>© 2026 My Pet Brasil. Todos os direitos reservados.</span>
+            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>© 2026 {clientConfig.name}. Todos os direitos reservados.</span>
           </div>
         </footer>
```

Dentro de `ProductDetail` (a segunda ocorrência de `getProductById`):
```diff
   const { id } = await params;
-  const product = await getProductById(id, "mypetbrasil");
+  const product = await getProductById(id, clientConfig.catalogChannel);

   if (!product) {
     notFound();
   }

-  const styleBadge = product.badge ? badgeStyle(product.badge.code) : null;
+  const styleBadge = product.badge ? badgeStyle(product.badge.code, PALETTE) : null;
```

- [ ] **Step 14: Também atualizar o footer equivalente em `apps/mypet/app/page.tsx`**

```diff
         <footer style={{ background: PALETTE.navyDark, padding: "32px 24px" }}>
           <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
             <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
-              <span style={{ fontSize: 20 }}>🐾</span>
-              <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 14 }}>My Pet Brasil — Atacado B2B</span>
+              <span style={{ fontSize: 20 }}>{clientConfig.logo.emoji}</span>
+              <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 14 }}>{clientConfig.name} — {clientConfig.tagline}</span>
             </div>
-            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>© 2026 My Pet Brasil. Todos os direitos reservados.</span>
+            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>© 2026 {clientConfig.name}. Todos os direitos reservados.</span>
           </div>
         </footer>
```

- [ ] **Step 15: Verificar build, testes e rodar a app localmente**

```bash
pnpm install
pnpm --filter @mypet/core test
pnpm --filter mypet build
pnpm --filter mypet dev
```

Usar o skill `/run` (ou abrir `http://localhost:3000` manualmente) e conferir: nav com "My Pet Brasil", catálogo completo, modal de cotação com "Fale com a My Pet Brasil", carrinho, página de produto e footer — tudo visualmente idêntico ao estado antes desta task.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat: ClientConfigProvider e client.config.ts por app"
```

---

## Task 5: Extrair o handler de leads para `packages/core/src/leads-server.ts`

**Files:**
- Create: `packages/core/src/leads-server.ts`
- Modify: `packages/core/package.json` (novo subpath export)
- Modify: `apps/mypet/app/api/leads/route.ts`

**Interfaces:**
- Produces: `POST(req: NextRequest)` em `@mypet/core/leads-server`, mesma lógica de hoje.

- [ ] **Step 1: Criar `packages/core/src/leads-server.ts`**

```ts
import { google } from "googleapis";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { nome, empresa, whatsapp, cnpj } = await req.json();

  if (!nome || !empresa || !whatsapp) {
    return Response.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS!);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Leads!A:E",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[new Date().toLocaleString("pt-BR"), nome, empresa, whatsapp, cnpj || ""]],
    },
  });

  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Adicionar o subpath export em `packages/core/package.json`**

```diff
   "exports": {
     "./catalog": "./src/catalog.ts",
     "./catalog-utils": "./src/catalog-utils.ts",
     "./cart": "./src/cart.ts",
     "./leads": "./src/leads.ts",
+    "./leads-server": "./src/leads-server.ts",
     "./whatsapp": "./src/whatsapp.ts",
```

- [ ] **Step 3: Substituir `apps/mypet/app/api/leads/route.ts` por um re-export**

```ts
export { POST } from "@mypet/core/leads-server";
```

- [ ] **Step 4: Verificar build e testar manualmente o envio de lead**

```bash
pnpm install
pnpm --filter mypet build
pnpm --filter mypet dev
```

Com `apps/mypet/.env.local` configurado, preencher o formulário de cotação em `/cotacao` e confirmar que o lead é gravado na planilha (mesmo comportamento de antes da extração).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: extrair handler de leads para packages/core/leads-server"
```

---

## Task 6: Scaffold do `apps/distribuidora`

**Files:**
- Create: `apps/distribuidora/package.json`, `apps/distribuidora/tsconfig.json`, `apps/distribuidora/next.config.ts`, `apps/distribuidora/postcss.config.mjs`, `apps/distribuidora/client.config.ts`
- Copy: `apps/mypet/app/` → `apps/distribuidora/app/`, `apps/mypet/public/` → `apps/distribuidora/public/`

**Interfaces:**
- Consumes: `@mypet/core/*` (mesmas interfaces das Tasks 2–5).
- Produces: app `distribuidora` funcional, com catálogo vazio até a população de `product_channel_links` no Hub.

- [ ] **Step 1: Copiar as rotas e assets da mypet**

```bash
mkdir -p apps/distribuidora
cp -r apps/mypet/app apps/distribuidora/app
cp -r apps/mypet/public apps/distribuidora/public
```

- [ ] **Step 2: Criar `apps/distribuidora/package.json`**

```json
{
  "name": "distribuidora",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@mypet/core": "workspace:*",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 3: Criar `apps/distribuidora/tsconfig.json`** (idêntico ao de `apps/mypet`)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Criar `apps/distribuidora/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@mypet/core"],
};

export default nextConfig;
```

- [ ] **Step 5: Criar `apps/distribuidora/postcss.config.mjs`** (idêntico ao de `apps/mypet`)

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 6: Criar `apps/distribuidora/app/globals.css`** (idêntico ao de `apps/mypet`, já copiado no Step 1 — nenhuma ação necessária)

- [ ] **Step 7: Criar `apps/distribuidora/client.config.ts`** com paleta neutra provisória

```ts
import type { ClientConfig } from "@mypet/core/theme";

export const clientConfig: ClientConfig = {
  name: "Distribuidora Petshop",
  tagline: "Atacado B2B",
  domain: "www.distribuidorapetshop.com.br",
  catalogChannel: "distribuidora",
  palette: {
    pink: "#475569",
    pinkDark: "#334155",
    pinkLight: "#F1F5F9",
    cyan: "#64748B",
    cyanDark: "#475569",
    cyanLight: "#F8FAFC",
    navy: "#0F172A",
    navyDark: "#020617",
    navyLight: "#F1F5F9",
    orange: "#B45309",
    green: "#15803D",
    white: "#FFFFFF",
    gray50: "#F8FAFC",
    gray100: "#F1F5F9",
    gray200: "#E2E8F0",
    gray400: "#94A3B8",
    gray600: "#475569",
    gray800: "#1E293B",
  },
  logo: { emoji: "🐾" },
};
```

- [ ] **Step 8: Criar `apps/distribuidora/.env.local`** (não versionado — mesmas chaves de `apps/mypet/.env.local`, valores a preencher)

```
GOOGLE_CREDENTIALS=
GOOGLE_SHEET_ID=
SUPABASE_URL=
SUPABASE_ANON_KEY=
NEXT_PUBLIC_WHATSAPP_NUMBER=
```

- [ ] **Step 9: Instalar, buildar e rodar**

```bash
pnpm install
pnpm --filter distribuidora build
pnpm --filter distribuidora dev
```

Expected: build conclui sem erros (nenhum arquivo do `apps/distribuidora/app` precisou de edição — todo o texto de marca já veio de `client.config.ts` na Task 4). Abrindo `http://localhost:3000` (em outra porta se a mypet estiver rodando): nav e footer mostram "Distribuidora Petshop" com a paleta neutra; catálogo aparece **vazio** ("Nenhum produto encontrado...") porque `product_channel_links` ainda não tem vínculos `channel='distribuidora'` no Hub — comportamento esperado nesta entrega.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold do app distribuidora"
```

---

## Task 7: Documentação e verificação final

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `AGENTS.md` (se necessário referenciar a nova estrutura de pastas)

**Interfaces:** nenhuma nova.

- [ ] **Step 1: Atualizar `ARCHITECTURE.md`** — adicionar uma seção descrevendo o monorepo

Adicionar, logo após a seção "## 1. Objetivo", uma nova seção:

```markdown
## 1.1 Estrutura multi-cliente

O projeto é um monorepo pnpm: `apps/mypet` e `apps/distribuidora` são apps Next.js
independentes (deploy próprio, domínio próprio), compartilhando `packages/core`
(catálogo, carrinho, leads, tema, componentes React). Cada app define sua marca,
paleta e canal de catálogo em `client.config.ts`. Visibilidade de produto por app é
controlada pela tabela `product_channel_links` do Supabase `hub_catalogo`
(campo `channel`), populada fora deste repositório.

Variáveis de ambiente por app (`.env.local`, não versionado):
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER`,
`GOOGLE_CREDENTIALS`, `GOOGLE_SHEET_ID`.
```

- [ ] **Step 2: Verificação completa do monorepo**

```bash
pnpm install
pnpm -r build
pnpm --filter @mypet/core test
pnpm lint
```

Expected: os dois apps buildam, todos os testes de `@mypet/core` passam, lint sem erros.

- [ ] **Step 3: Verificação manual (skill `/run`)**

Rodar `apps/mypet` e `apps/distribuidora` (portas diferentes) e conferir lado a lado:
- mypet: catálogo completo, tema rosa/navy, "My Pet Brasil" no nav/footer/modal.
- distribuidora: catálogo vazio (esperado), tema neutro, "Distribuidora Petshop" no nav/footer/modal.
- Em ambos: adicionar item ao carrinho, ir para `/cotacao`, preencher e enviar (verifica que o lead cai na planilha configurada em cada `.env.local`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: descrever a estrutura monorepo multi-cliente no ARCHITECTURE.md"
```
