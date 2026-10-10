# Melhorias no storefront AZ Pet Shop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar busca interna e enriquecer a página de produto da loja azpetshop (breadcrumbs, descrição do hub, disponibilidade, SEO/JSON-LD) e simplificar a exibição de Ref.

**Architecture:** App `apps/azpetshop` (Next.js) lê o Supabase `hub_catalogo` via `packages/core`. As frentes de dados/SEO ficam em helpers puros no core (testáveis), e a UI nas páginas do azpetshop. Mudanças no core são aditivas/opt-in para não regredir as lojas irmãs (distribuidora, mypet).

**Tech Stack:** Next.js 16 (App Router, `"use cache"`), React 19, TypeScript, Supabase JS (PostgREST), Vitest.

## Global Constraints

- Repo: `C:/Projetos/mypet-landing` (monorepo pnpm). Trabalhar a partir da `main`.
- Canal do storefront: `azpetshop` (`clientConfig.catalogChannel`).
- Moeda nos dados estruturados: `priceCurrency: "BRL"`; preço com 2 casas (`toFixed(2)`).
- `offers` no `productJsonLd` é **opt-in** (3º argumento) — só o azpetshop ativa; distribuidora/mypet seguem sem `offers`.
- Item "Ref": aplicar em **todas as lojas** (componente compartilhado).
- Página `/busca`: `robots: { index: false, follow: true }`.
- Cache do catálogo: `"use cache"` + `cacheTag("catalog")`; rota `/api/revalidate-catalog` já existe.
- Testes core: `pnpm --filter @mypet/core exec vitest run src/<arquivo>`.
- Build/test azpetshop: `pnpm --filter azpetshop build` / `pnpm --filter azpetshop test`.
- Fonte dos campos (confirmado no hub): descrição = `product_channel_links.description` (canal) → `v_produtos_resolvidos.description` (mestre); meta/keywords = só `product_channel_links` (canal); estoque = `products.stock_qty`; preço = `product_channel_prices` (canal).

---

### Task 1: Exibir só "Ref:" e remover código de barras (componente compartilhado)

**Files:**
- Modify: `packages/core/src/components/product-variant-panel.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: nenhuma mudança de API (o campo `barcode` continua no tipo `PdpProduct`/`ProductVariant`, só sai da tela).

- [ ] **Step 1: Remover a linha do `barcode` não usada**

Em `PurchaseGrid`, localizar e **remover** a linha:

```tsx
  const barcode = variantOverride?.barcode ?? product.barcode;
```

- [ ] **Step 2: Trocar o rótulo e remover o selo de EAN**

Substituir o bloco atual:

```tsx
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {sku && (
            <span
              style={{
                fontSize: 13,
                color: PALETTE.gray600,
                background: PALETTE.gray100,
                padding: "4px 10px",
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              SKU/Ref: {sku}
            </span>
          )}
          {barcode && (
            <span
              style={{
                fontSize: 13,
                color: PALETTE.gray600,
                background: PALETTE.gray100,
                padding: "4px 10px",
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              EAN/EAC: {barcode}
            </span>
          )}
        </div>
```

por:

```tsx
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {sku && (
            <span
              style={{
                fontSize: 13,
                color: PALETTE.gray600,
                background: PALETTE.gray100,
                padding: "4px 10px",
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              Ref: {sku}
            </span>
          )}
        </div>
```

- [ ] **Step 3: Verificar que não sobrou EAN e que "Ref:" existe**

Run: `grep -n "EAN" packages/core/src/components/product-variant-panel.tsx`
Expected: nenhuma linha.
Run: `grep -n "Ref: {sku}" packages/core/src/components/product-variant-panel.tsx`
Expected: 1 linha.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/components/product-variant-panel.tsx
git commit -m "feat(core): exibir apenas Ref e remover EAN na ficha do produto"
```

---

### Task 2: Helper `metaDescription` (seo.ts)

**Files:**
- Modify: `packages/core/src/seo.ts`
- Test: `packages/core/src/seo.test.ts`

**Interfaces:**
- Produces: `metaDescription(raw: string | null | undefined, fallback: string, maxLen?: number): string`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar em `packages/core/src/seo.test.ts`:

```ts
describe("metaDescription", () => {
  it("usa o fallback quando vazio", () => {
    expect(metaDescription("", "fallback")).toBe("fallback");
    expect(metaDescription(null, "fallback")).toBe("fallback");
  });
  it("remove HTML e colapsa espaços", () => {
    expect(metaDescription("<p>Olá  <b>mundo</b></p>", "fb")).toBe("Olá mundo");
  });
  it("trunca em ~155 chars com reticências", () => {
    const out = metaDescription("x".repeat(200), "fb");
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(156);
  });
});
```

E adicionar `metaDescription` ao import do topo do arquivo de teste:

```ts
import {
  productJsonLd,
  breadcrumbJsonLd,
  canonicalUrl,
  organizationJsonLd,
  jsonLdScript,
  metaDescription,
  type PdpProductForSeo,
} from "./seo";
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/seo.test.ts`
Expected: FAIL (`metaDescription is not a function` / import não resolvido).

- [ ] **Step 3: Implementar o helper**

Acrescentar em `packages/core/src/seo.ts`:

```ts
/** Normaliza uma descrição (remove HTML, colapsa espaços) e trunca para meta description. */
export function metaDescription(
  raw: string | null | undefined,
  fallback: string,
  maxLen = 155,
): string {
  const text = (raw ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated;
  return `${base.trim()}…`;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/seo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/seo.ts packages/core/src/seo.test.ts
git commit -m "feat(core): helper metaDescription para SEO"
```

---

### Task 3: `productJsonLd` com `offers`, `gtin13` e `sku` (seo.ts)

**Files:**
- Modify: `packages/core/src/seo.ts`
- Test: `packages/core/src/seo.test.ts`

**Interfaces:**
- Consumes: tipo `PdpProductForSeo` (estendido aqui).
- Produces: `productJsonLd(product, domain, opts?: { offers?: boolean })`. `PdpProductForSeo` ganha opcionais `sku?`, `barcode?`, `salePrice?`, `stockQty?`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar em `packages/core/src/seo.test.ts`, dentro (ou após) do `describe("productJsonLd", ...)`:

```ts
describe("productJsonLd offers", () => {
  const base: PdpProductForSeo = {
    id: "p1",
    name: "Produto",
    brand: "NAPI",
    description: "desc",
    img: "https://img/p1.jpg",
    productRole: "simple",
    variants: [],
  };
  it("sem offers por padrão (compat)", () => {
    const r = productJsonLd(base, "d.com") as Record<string, unknown>;
    expect(r.offers).toBeUndefined();
  });
  it("inclui offers InStock quando offers:true, com preço e estoque", () => {
    const r = productJsonLd(
      { ...base, sku: "REF1", barcode: "7890000000001", salePrice: 94.9, stockQty: 5 },
      "d.com",
      { offers: true },
    ) as Record<string, any>;
    expect(r.sku).toBe("REF1");
    expect(r.gtin13).toBe("7890000000001");
    expect(r.offers.priceCurrency).toBe("BRL");
    expect(r.offers.price).toBe("94.90");
    expect(r.offers.availability).toBe("https://schema.org/InStock");
    expect(r.offers.itemCondition).toBe("https://schema.org/NewCondition");
  });
  it("OutOfStock quando estoque 0", () => {
    const r = productJsonLd(
      { ...base, salePrice: 10, stockQty: 0 },
      "d.com",
      { offers: true },
    ) as Record<string, any>;
    expect(r.offers.availability).toBe("https://schema.org/OutOfStock");
  });
  it("sem preço não emite offers mesmo com offers:true", () => {
    const r = productJsonLd({ ...base, stockQty: 5 }, "d.com", { offers: true }) as Record<string, unknown>;
    expect(r.offers).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/seo.test.ts`
Expected: FAIL (`offers`/`gtin13` undefined; `sku` === "p1").

- [ ] **Step 3: Estender o tipo e a função**

Em `packages/core/src/seo.ts`, estender `PdpProductForSeo`:

```ts
export type PdpProductForSeo = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  img: string;
  productRole: "simple" | "parent" | "variant";
  variants: ProductVariant[];
  sku?: string;
  barcode?: string | null;
  salePrice?: number | null;
  stockQty?: number | null;
};
```

E substituir `productJsonLd` por:

```ts
export function productJsonLd(
  product: PdpProductForSeo,
  domain: string,
  opts?: { offers?: boolean },
) {
  if (product.productRole === "parent") return null;
  const url = canonicalUrl(domain, `/produtos/${product.id}`);
  const withOffers = opts?.offers && product.salePrice != null;
  const offers = withOffers
    ? {
        offers: {
          "@type": "Offer",
          url,
          priceCurrency: "BRL",
          price: product.salePrice!.toFixed(2),
          availability:
            (product.stockQty ?? 0) > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
        },
      }
    : {};
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku || product.id,
    ...(product.barcode ? { gtin13: product.barcode } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.description ? { description: product.description } : {}),
    image: absoluteImageUrl(domain, product.img),
    url,
    ...offers,
  };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/seo.test.ts`
Expected: PASS (todos os describes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/seo.ts packages/core/src/seo.test.ts
git commit -m "feat(core): offers/gtin13/sku opt-in no productJsonLd"
```

---

### Task 4: Busca multi-campo (`buildSearchOrFilter` + `queryCatalog`)

**Files:**
- Modify: `packages/core/src/catalog-utils.ts`
- Test: `packages/core/src/catalog-utils.test.ts`
- Modify: `packages/core/src/catalog.ts`

**Interfaces:**
- Produces: `buildSearchOrFilter(term: string): string` (string de filtro PostgREST `or`).
- Consumes (em `catalog.ts`): `buildSearchOrFilter`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar em `packages/core/src/catalog-utils.test.ts` (importar a função no topo do arquivo, junto dos demais imports de `./catalog-utils`):

```ts
describe("buildSearchOrFilter", () => {
  it("casa nome, marca e referência", () => {
    expect(buildSearchOrFilter("areia")).toBe(
      "name.ilike.*areia*,brand.ilike.*areia*,reference.ilike.*areia*",
    );
  });
  it("sanitiza caracteres que quebram o filtro or()", () => {
    expect(buildSearchOrFilter("  a,b(c)  ")).toBe(
      "name.ilike.*a b c*,brand.ilike.*a b c*,reference.ilike.*a b c*",
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/catalog-utils.test.ts`
Expected: FAIL (`buildSearchOrFilter is not a function`).

- [ ] **Step 3: Implementar a função**

Acrescentar em `packages/core/src/catalog-utils.ts`:

```ts
/** Monta o filtro PostgREST `or` para busca textual por nome, marca e referência. */
export function buildSearchOrFilter(term: string): string {
  const safe = term.replace(/[,()*:]/g, " ").replace(/\s+/g, " ").trim();
  return `name.ilike.*${safe}*,brand.ilike.*${safe}*,reference.ilike.*${safe}*`;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/catalog-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Ligar no `queryCatalog`**

Em `packages/core/src/catalog.ts`, adicionar `buildSearchOrFilter` ao import vindo de `./catalog-utils` (bloco de import no topo) e substituir:

```ts
  if (q) query = query.ilike("name", `%${q}%`);
```

por:

```ts
  if (q) query = query.or(buildSearchOrFilter(q));
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/catalog-utils.ts packages/core/src/catalog-utils.test.ts packages/core/src/catalog.ts
git commit -m "feat(core): busca por nome, marca e referência"
```

---

### Task 5: `getProductById` expõe conteúdo do canal + estoque

**Files:**
- Modify: `packages/core/src/catalog.ts` (função `getProductById`)

**Interfaces:**
- Produces: o objeto retornado por `getProductById` ganha `channelDescription: string | null`, `channelMetaDescription: string | null`, `channelKeywords: string | null`, `stockQty: number | null`.

> **Atenção:** `stock_qty` **não existe** na view `v_produtos_resolvidos` (confirmado no hub) — só na tabela `products`. Por isso o conteúdo do canal vem do `select` da view (embed já existente), mas o estoque é buscado à parte de `products`.

- [ ] **Step 1: Incluir os campos do canal no `select` da view**

Em `getProductById`, no `.select(...)` do `v_produtos_resolvidos`, trocar
`product_channel_links!inner(channel)` por
`product_channel_links!inner(channel, description, meta_description, keywords, title)`.
**Não** adicionar `stock_qty` a este select (a view não tem essa coluna).

- [ ] **Step 2: Buscar `stock_qty` de `products` em paralelo com as variações**

Em `getProductById`, substituir a linha:

```ts
  const variants = data.product_role === "parent" ? await getVariantsByParentId(id, channel) : [];
```

por:

```ts
  const [variants, stockRes] = await Promise.all([
    data.product_role === "parent" ? getVariantsByParentId(id, channel) : Promise.resolve([]),
    supabase.from("products").select("stock_qty").eq("id", id).maybeSingle(),
  ]);
  const stockQty = (stockRes.data?.stock_qty as number | null) ?? null;
```

- [ ] **Step 3: Expor os campos no objeto retornado**

Logo antes do `const product = {` em `getProductById`, acrescentar:

```ts
  const link = Array.isArray(data.product_channel_links)
    ? data.product_channel_links[0]
    : (data.product_channel_links as
        | { description: string | null; meta_description: string | null; keywords: string | null }
        | null);
```

E dentro do objeto `product`, adicionar as linhas:

```ts
    channelDescription: (link?.description as string | null) ?? null,
    channelMetaDescription: (link?.meta_description as string | null) ?? null,
    channelKeywords: (link?.keywords as string | null) ?? null,
    stockQty,
```

- [ ] **Step 4: Verificar tipos/compilação (build do core via app)**

Run: `pnpm --filter azpetshop build`
Expected: build conclui sem erro de tipo em `catalog.ts` (a PDP ainda não usa os campos; validação de que o select/objeto compilam).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog.ts
git commit -m "feat(core): getProductById expõe conteúdo do canal e estoque"
```

---

### Task 6: Componente `SearchBar` (core)

**Files:**
- Create: `packages/core/src/components/search-bar.tsx`

**Interfaces:**
- Produces: `SearchBar({ action?: string; placeholder?: string })` — form `GET` nativo para `action` com `input[name=q]`.

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import { useClientConfig } from "../theme";

export function SearchBar({
  action = "/busca",
  placeholder = "Buscar produtos, marcas...",
}: {
  action?: string;
  placeholder?: string;
}) {
  const { palette } = useClientConfig();
  return (
    <form
      method="get"
      action={action}
      role="search"
      style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 24px", display: "flex", gap: 8 }}
    >
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        aria-label="Buscar produtos"
        style={{
          flex: 1,
          padding: "10px 16px",
          borderRadius: 100,
          border: `1.5px solid ${palette.gray200}`,
          fontSize: 14,
          outline: "none",
          color: palette.gray800,
          background: palette.white,
        }}
      />
      <button
        type="submit"
        style={{
          padding: "10px 20px",
          borderRadius: 100,
          border: "none",
          background: palette.pink,
          color: palette.white,
          fontWeight: 800,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Buscar
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Confirmar o export subpath**

Verificar que `packages/core/package.json` expõe `./components/*` ou adicionar entrada para `./components/search-bar`. Run: `grep -n "components/" packages/core/package.json | head`
Expected: há um padrão `./components/*` (como os outros componentes). Se os componentes forem exportados um a um, adicionar:
`"./components/search-bar": "./src/components/search-bar.tsx",`

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/search-bar.tsx packages/core/package.json
git commit -m "feat(core): componente SearchBar (form GET)"
```

---

### Task 7: Rota `/busca` + campo de busca nas páginas do azpetshop

**Files:**
- Create: `apps/azpetshop/app/busca/page.tsx`
- Modify: `apps/azpetshop/app/page.tsx` (inserir `<SearchBar/>` após `<SiteNav/>`)
- Modify: `apps/azpetshop/app/categoria/[slug]/page.tsx` (idem)

**Interfaces:**
- Consumes: `SearchBar` (Task 6), `CatalogSection`, `getCategories`, `SiteNav`.

- [ ] **Step 1: Criar a rota `/busca`**

`apps/azpetshop/app/busca/page.tsx`:

```tsx
import { Suspense } from "react";
import { CatalogSection } from "@mypet/core/components/catalog-section";
import { SiteNav } from "@mypet/core/components/site-nav";
import { SearchBar } from "@mypet/core/components/search-bar";
import { getCategories } from "@mypet/core/catalog";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

export const metadata = { robots: { index: false, follow: true } };

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const categories = await getCategories();
  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <SiteNav categories={categories} audienceLabel={null} />
      <SearchBar action="/busca" />
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px 80px" }}>
        <h1
          style={{
            fontFamily: "var(--font-baloo)",
            fontSize: 26,
            fontWeight: 800,
            color: PALETTE.navy,
            marginBottom: 18,
          }}
        >
          {q ? `Resultados para "${q}"` : "Buscar produtos"}
        </h1>
        {q ? (
          <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Buscando…</p>}>
            <CatalogSection
              q={q}
              page={sp.page}
              channel={clientConfig.catalogChannel}
              palette={clientConfig.palette}
            />
          </Suspense>
        ) : (
          <p style={{ color: PALETTE.gray600 }}>Digite o que procura no campo acima.</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Inserir o campo de busca na home**

Em `apps/azpetshop/app/page.tsx`, adicionar o import:

```tsx
import { SearchBar } from "@mypet/core/components/search-bar";
```

e logo após `<SiteNav categories={categories} audienceLabel={null} />` inserir:

```tsx
      <SearchBar action="/busca" />
```

- [ ] **Step 3: Inserir o campo de busca na página de categoria**

Em `apps/azpetshop/app/categoria/[slug]/page.tsx`, adicionar o mesmo import e inserir `<SearchBar action="/busca" />` imediatamente após o `<SiteNav ... />` dessa página.

- [ ] **Step 4: Build e checagem manual**

Run: `pnpm --filter azpetshop build`
Expected: build OK, rota `/busca` listada.
Checagem manual (dev): `pnpm --filter azpetshop dev` → abrir `/busca?q=genial` e confirmar resultados; buscar na home redireciona para `/busca?q=...`.

- [ ] **Step 5: Commit**

```bash
git add apps/azpetshop/app/busca/page.tsx apps/azpetshop/app/page.tsx "apps/azpetshop/app/categoria/[slug]/page.tsx"
git commit -m "feat(azpetshop): busca interna (/busca) com campo no header"
```

---

### Task 8: PDP azpetshop — breadcrumbs, descrição, ficha, disponibilidade e JSON-LD

**Files:**
- Modify: `apps/azpetshop/app/produtos/[id]/page.tsx` (substituição completa)

**Interfaces:**
- Consumes: `getProductById` (campos novos da Task 5), `getCategoryPath`, `metaDescription`/`productJsonLd`/`productGroupJsonLd`/`breadcrumbJsonLd`/`jsonLdScript`/`canonicalUrl` (Tasks 2–3), `SearchBar` (Task 6), `ProductVariantPanel` (Task 1).

- [ ] **Step 1: Substituir o arquivo da PDP**

Conteúdo completo de `apps/azpetshop/app/produtos/[id]/page.tsx`:

```tsx
import { Suspense } from "react";
import { getProductById, getCategories } from "@mypet/core/catalog";
import { getCategoryPath } from "@mypet/core/catalog-utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { SearchBar } from "@mypet/core/components/search-bar";
import { ProductVariantPanel } from "@mypet/core/components/product-variant-panel";
import {
  canonicalUrl,
  metaDescription,
  productJsonLd,
  productGroupJsonLd,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@mypet/core/seo";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id, clientConfig.catalogChannel);
  if (!product) return { title: `Produto não encontrado — ${clientConfig.name}` };
  const desc = metaDescription(
    product.channelMetaDescription ?? product.channelDescription ?? product.description,
    `${product.name} na ${clientConfig.name}. Preço à vista e pedido pelo WhatsApp.`,
  );
  return {
    title: `${product.name} — ${clientConfig.name}`,
    description: desc,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/produtos/${id}`) },
    openGraph: { title: product.name, description: desc, images: [product.img] },
    twitter: { card: "summary_large_image", images: [product.img] },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const categories = await getCategories();

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        h1 { font-family: var(--font-baloo), sans-serif; font-weight: 800 !important; }
        .back-link {
          display: inline-flex; align-items: center; gap: 8px; color: ${PALETTE.navy};
          background: ${PALETTE.white}; border: 2px solid ${PALETTE.navy}; border-radius: 100px;
          padding: 9px 18px; font-family: var(--font-nunito), sans-serif;
          font-size: 14px; font-weight: 800; text-decoration: none; margin-bottom: 24px;
          transition: background 0.15s, color 0.15s;
        }
        .back-link:hover { background: ${PALETTE.navy}; color: ${PALETTE.gray50}; }
        .info-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .info-table td { padding: 10px 0; border-bottom: 1px solid ${PALETTE.gray100}; font-size: 14px; }
        .info-table td.label { color: ${PALETTE.gray600}; font-weight: 600; width: 35%; }
        .info-table td.value { color: ${PALETTE.navyDark}; font-weight: 700; }
      `}</style>
      <SiteNav categories={categories} audienceLabel={null} />
      <SearchBar action="/busca" />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px" }}>
        <Link href="/" className="back-link">← Voltar</Link>
        <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando produto…</p>}>
          <ProductDetail params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProductById(id, clientConfig.catalogChannel),
    getCategories(),
  ]);
  if (!product) notFound();

  const categoryPath = product.categoryId ? getCategoryPath(categories, product.categoryId) : [];
  const breadcrumbItems = [
    { name: "Início", path: "/" },
    ...categoryPath.map((c) => ({ name: c.name, path: `/categoria/${c.slug}` })),
    { name: product.name, path: `/produtos/${product.id}` },
  ];

  const jsonLd =
    productGroupJsonLd(product, clientConfig.domain) ??
    productJsonLd(product, clientConfig.domain, { offers: true });

  const inStock = (product.stockQty ?? 0) > 0;
  const description = product.channelDescription ?? product.description;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(breadcrumbJsonLd(breadcrumbItems, clientConfig.domain)),
        }}
      />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
      )}

      <nav aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
        <ol
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            listStyle: "none",
            margin: 0,
            padding: 0,
            fontSize: 13,
            color: PALETTE.gray600,
          }}
        >
          {breadcrumbItems.map((item, i) => (
            <li key={item.path} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span aria-hidden="true">/</span>}
              {i === breadcrumbItems.length - 1 ? (
                <span style={{ color: PALETTE.navy, fontWeight: 700 }} aria-current="page">
                  {item.name}
                </span>
              ) : (
                <Link href={item.path} style={{ color: PALETTE.gray600, textDecoration: "none" }}>
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 800,
            padding: "4px 12px",
            borderRadius: 100,
            background: inStock ? PALETTE.green : PALETTE.gray200,
            color: inStock ? PALETTE.white : PALETTE.gray600,
          }}
        >
          {inStock ? "Em estoque" : "Esgotado"}
        </span>
      </div>

      <ProductVariantPanel product={product} />

      <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 10 }}>
            Descrição do Produto
          </h2>
          <div
            style={{ fontSize: 15, color: PALETTE.gray600, lineHeight: 1.6, whiteSpace: "pre-line" }}
          >
            {description || (
              <span style={{ color: PALETTE.gray400, fontStyle: "italic" }}>
                Descrição detalhada não cadastrada no catálogo.
              </span>
            )}
          </div>
        </div>

        {(product.weight_kg || product.width_cm || product.height_cm || product.length_cm) && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>
              Especificações Físicas
            </h2>
            <table className="info-table">
              <tbody>
                {product.weight_kg && (
                  <tr>
                    <td className="label">Peso</td>
                    <td className="value">{product.weight_kg} kg</td>
                  </tr>
                )}
                {product.width_cm && (
                  <tr>
                    <td className="label">Largura</td>
                    <td className="value">{product.width_cm} cm</td>
                  </tr>
                )}
                {product.height_cm && (
                  <tr>
                    <td className="label">Altura</td>
                    <td className="value">{product.height_cm} cm</td>
                  </tr>
                )}
                {product.length_cm && (
                  <tr>
                    <td className="label">Comprimento</td>
                    <td className="value">{product.length_cm} cm</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter azpetshop build`
Expected: build OK, sem erros de tipo (os campos `channelDescription`, `channelMetaDescription`, `stockQty` existem via Task 5; `productJsonLd` aceita o 3º arg via Task 3).

- [ ] **Step 3: Checagem manual do produto piloto**

Dev (`pnpm --filter azpetshop dev`) → abrir `/produtos/04408cea-2579-48d0-bbc4-d9203623a355` e confirmar: breadcrumbs, "Em estoque", seção de descrição, ficha física, e `<script type="application/ld+json">` com `Product`+`offers` (ver "view-source").

- [ ] **Step 4: Commit**

```bash
git add "apps/azpetshop/app/produtos/[id]/page.tsx"
git commit -m "feat(azpetshop): PDP com breadcrumbs, descrição, ficha, estoque e JSON-LD"
```

---

### Task 9: Verificação final e revalidação do cache

**Files:** nenhum (verificação).

- [ ] **Step 1: Rodar todos os testes do core**

Run: `pnpm --filter @mypet/core exec vitest run`
Expected: todos PASS.

- [ ] **Step 2: Build final do app**

Run: `pnpm --filter azpetshop build`
Expected: PASS.

- [ ] **Step 3: Validar dados estruturados**

Após deploy, colar a URL do produto piloto no Rich Results Test (search.google.com/test/rich-results) e no Schema Markup Validator (validator.schema.org). Expected: `Product`, `Offer` e `BreadcrumbList` reconhecidos, sem erros.

- [ ] **Step 4: Expirar o cache do catálogo (quando em produção)**

```bash
curl -X POST https://loja.azpetshop.com.br/api/revalidate-catalog \
  -H "Authorization: Bearer <CATALOG_REVALIDATE_SECRET>"
```
Expected: `{"ok":true}`.

---

## Notas de dados (fora do código)

- O conteúdo do canal azpetshop pode ter texto incorreto herdado ("shampoo" no condicionador ref 22670; mypetbrasil está correto). Após o deploy, fazer spot-check dos 43 produtos e corrigir `description`/`meta_description`/`keywords` no hub onde necessário. Não é parte desta entrega de código.
