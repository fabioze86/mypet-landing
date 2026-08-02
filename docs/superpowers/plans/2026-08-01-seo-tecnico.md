# SEO Técnico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar as lacunas de SEO técnico de `apps/mypet` e `apps/distribuidora`: robots.txt, canonical URLs, Open Graph/Twitter Card, JSON-LD completo (Product/BreadcrumbList/Organization), adoção de `next/image` e remoção de CSS de fonte render-blocking.

**Architecture:** A maior parte da lógica pura (JSON-LD, canonical) vive em `packages/core/src/seo.ts`, compartilhada pelos dois apps. Componentes visuais compartilhados (`product-card.tsx`, `product-variant-panel.tsx`, `category-listing.tsx`) recebem a mesma mudança uma única vez em `packages/core`. Cada app (`apps/mypet`, `apps/distribuidora`) tem suas próprias rotas Next.js (`robots.ts`, `opengraph-image.tsx`, `layout.tsx`, páginas), então essas mudanças são replicadas em cada app.

**Tech Stack:** Next.js 16 (App Router, `MetadataRoute`, `next/og`, `next/image`, `next/font/google`), TypeScript, Vitest.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-08-01-seo-tecnico-design.md`.
- Sem `Offer`/preço em nenhum JSON-LD (produto não tem preço).
- Sem redirects 301 (URLs permanecem idênticas).
- Testes seguem o padrão já estabelecido: `*.test.ts` ao lado do código, `vi.mock` para dependências externas (ver `packages/core/src/catalog.test.ts` como referência de estilo).
- `npm run build` e `npm run lint` são critério de aceite final (Task 22).
- Nomes de campo seguem a convenção já existente no projeto: `img` (não `image`), `sku` (não `SKU`), `domain` (não `siteDomain`).

---

### Task 1: `seo.ts` — canonical, Product/Breadcrumb/Organization JSON-LD

**Files:**
- Modify: `packages/core/src/seo.ts`
- Test: `packages/core/src/seo.test.ts` (novo)

**Interfaces:**
- Consumes: `ProductVariant` de `./catalog-utils` (já importado em `seo.ts`); `ClientConfig` de `./theme` (type-only).
- Produces: `canonicalUrl(domain: string, path: string): string`, `productJsonLd(product: PdpProductForSeo, domain: string): object | null`, `breadcrumbJsonLd(items: { name: string; path: string }[], domain: string): object`, `organizationJsonLd(config: ClientConfig): object`. `PdpProductForSeo` ganha o campo `img: string`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `packages/core/src/seo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  productGroupJsonLd,
  productJsonLd,
  breadcrumbJsonLd,
  canonicalUrl,
  organizationJsonLd,
  type PdpProductForSeo,
} from "./seo";
import type { ClientConfig } from "./theme";

describe("canonicalUrl", () => {
  it("monta a URL absoluta a partir de domain e path", () => {
    expect(canonicalUrl("mypetbrasil.com.br", "/produtos/p1")).toBe(
      "https://mypetbrasil.com.br/produtos/p1",
    );
  });
});

describe("productJsonLd", () => {
  const base: PdpProductForSeo = {
    id: "p1",
    name: "Ração X",
    brand: "NAPI",
    description: "Ração premium",
    img: "https://img/p1.jpg",
    productRole: "simple",
    variants: [],
  };

  it("retorna null quando o produto é parent (usa productGroupJsonLd)", () => {
    expect(productJsonLd({ ...base, productRole: "parent" }, "dominio.com")).toBeNull();
  });

  it("monta Product com todos os campos quando presentes", () => {
    expect(productJsonLd(base, "dominio.com")).toEqual({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Ração X",
      sku: "p1",
      brand: { "@type": "Brand", name: "NAPI" },
      description: "Ração premium",
      image: "https://img/p1.jpg",
      url: "https://dominio.com/produtos/p1",
    });
  });

  it("omite brand e description quando ausentes", () => {
    const product: PdpProductForSeo = { ...base, brand: null, description: null };
    const result = productJsonLd(product, "dominio.com") as Record<string, unknown>;
    expect(result.brand).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.image).toBe("https://img/p1.jpg");
  });
});

describe("breadcrumbJsonLd", () => {
  it("monta itemListElement com posição 1-indexada", () => {
    const items = [
      { name: "Início", path: "/" },
      { name: "Ração", path: "/categoria/racao" },
      { name: "Ração X", path: "/produtos/p1" },
    ];
    expect(breadcrumbJsonLd(items, "dominio.com")).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: "https://dominio.com/" },
        { "@type": "ListItem", position: 2, name: "Ração", item: "https://dominio.com/categoria/racao" },
        { "@type": "ListItem", position: 3, name: "Ração X", item: "https://dominio.com/produtos/p1" },
      ],
    });
  });
});

describe("organizationJsonLd", () => {
  it("monta Organization com nome, url e logo (imagem OG gerada)", () => {
    const config = { name: "My Pet Brasil", domain: "mypetbrasil.com.br" } as ClientConfig;
    expect(organizationJsonLd(config)).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "My Pet Brasil",
      url: "https://mypetbrasil.com.br",
      logo: "https://mypetbrasil.com.br/opengraph-image",
    });
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd packages/core && npx vitest run src/seo.test.ts`
Expected: FAIL — `productJsonLd`, `breadcrumbJsonLd`, `canonicalUrl`, `organizationJsonLd` não existem ainda (erro de import).

- [ ] **Step 3: Implementar em `seo.ts`**

Modificar o topo do arquivo (tipo `PdpProductForSeo`) e adicionar as novas funções ao final de `packages/core/src/seo.ts`:

```ts
import type { ProductVariant } from "./catalog-utils";
import type { ClientConfig } from "./theme";

export type PdpProductForSeo = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  img: string;
  productRole: "simple" | "parent" | "variant";
  variants: ProductVariant[];
};
```

(mantém `productGroupJsonLd` sem mudança — só o tipo `PdpProductForSeo` ganhou `img`). Ao final do arquivo:

```ts
export function canonicalUrl(domain: string, path: string): string {
  return `https://${domain}${path}`;
}

export function productJsonLd(product: PdpProductForSeo, domain: string) {
  if (product.productRole === "parent") return null;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.id,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.description ? { description: product.description } : {}),
    image: product.img,
    url: canonicalUrl(domain, `/produtos/${product.id}`),
  };
}

export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
  domain: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: canonicalUrl(domain, item.path),
    })),
  };
}

export function organizationJsonLd(config: ClientConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.name,
    url: canonicalUrl(config.domain, ""),
    logo: canonicalUrl(config.domain, "/opengraph-image"),
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd packages/core && npx vitest run src/seo.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/seo.ts packages/core/src/seo.test.ts
git commit -m "feat(core): adiciona canonicalUrl, productJsonLd, breadcrumbJsonLd e organizationJsonLd"
```

---

### Task 2: `catalog.ts` — `getProductById` passa a resolver a categoria do produto

**Files:**
- Modify: `packages/core/src/catalog.ts:114-154`
- Test: `packages/core/src/catalog.test.ts`

**Interfaces:**
- Consumes: `RawCategory` de `./catalog-utils` (já existe, `{ id, name, slug }`).
- Produces: objeto retornado por `getProductById` ganha `category: RawCategory | null` e `categoryId: string | null`, usados na Task 10 para montar o breadcrumb da PDP via `getCategoryPath`.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `packages/core/src/catalog.test.ts` (o mock de `builder.range`/`single` precisa existir — ver Step 3, que ajusta o mock antes):

```ts
describe("getProductById", () => {
  it("inclui category_id e categories no select e no retorno", async () => {
    const product = await getProductById("p1", "mypetbrasil");
    expect((calls["select"] as unknown[])[0]).toContain("category_id");
    expect((calls["select"] as unknown[])[0]).toContain("categories(id, name, slug)");
    expect(product).toMatchObject({
      categoryId: "cat-1",
      category: { id: "cat-1", name: "Banho & Tosa", slug: "banho-tosa" },
    });
  });
});
```

E ajustar o import no topo do arquivo:

```ts
import { queryCatalog, getCategories, getProductById } from "./catalog";
```

E o mock `builder.single`/`.eq` precisa suportar a chain usada por `getProductById` (`.select().eq().eq().eq().single()`). Adicionar ao mock builder em `vi.mock("./supabase", ...)`:

```ts
builder.single = () => Promise.resolve({
  data: {
    id: "p1",
    name: "Ração X",
    reference: "100",
    brand: "NAPI",
    description: "Descrição",
    barcode: null,
    weight_kg: null,
    width_cm: null,
    height_cm: null,
    length_cm: null,
    product_role: "simple",
    parent_product_id: null,
    variant_axis: null,
    category_id: "cat-1",
    categories: { id: "cat-1", name: "Banho & Tosa", slug: "banho-tosa" },
    product_assets: [{ url: "https://img/1", type: "main_image" }],
    product_badges: null,
  },
  error: null,
});
```

E no type `QueryBuilder` do topo do arquivo, adicionar `single: () => Promise<{ data: unknown; error: null }>;`.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd packages/core && npx vitest run src/catalog.test.ts -t "getProductById"`
Expected: FAIL — `category_id`/`categories` ainda não estão no select nem no retorno.

- [ ] **Step 3: Implementar em `catalog.ts`**

Em `packages/core/src/catalog.ts`, dentro de `getProductById` (linhas 114-154), alterar o `.select(...)`:

```ts
.select(
  "id, name, reference, brand, description, barcode, weight_kg, width_cm, height_cm, length_cm, product_role, parent_product_id, variant_axis, category_id, categories(id, name, slug), product_assets(url, type), product_badges(code, label, kind, priority, starts_at, ends_at), product_channel_links!inner(channel)"
)
```

E no objeto de retorno, adicionar `categoryId` e `category`:

```ts
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
  productRole: data.product_role as "simple" | "parent" | "variant",
  parentProductId: data.parent_product_id,
  categoryId: data.category_id as string | null,
  category: (data.categories as { id: string; name: string; slug: string } | null) ?? null,
  variantAxis: (data.variant_axis as VariantAxisEntry[] | null) ?? [],
  variants,
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd packages/core && npx vitest run src/catalog.test.ts`
Expected: PASS (todos os testes do arquivo, incluindo os já existentes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog.ts packages/core/src/catalog.test.ts
git commit -m "feat(core): getProductById resolve categoria do produto"
```

---

### Task 3: `category-listing.tsx` — BreadcrumbList JSON-LD + `next/image` no banner

**Files:**
- Modify: `packages/core/src/components/category-listing.tsx`

**Interfaces:**
- Consumes: `breadcrumbJsonLd` de `../seo` (Task 1).
- Produces: `CategoryListing` ganha prop obrigatória `domain: string` — as Tasks 16/17 (`categoria/[slug]/page.tsx` de cada app) passam `domain={clientConfig.domain}`.

- [ ] **Step 1: Implementar (sem teste unitário — componente visual Server Component, coberto por build + verificação manual na Task 22)**

Em `packages/core/src/components/category-listing.tsx`, adicionar import e prop:

```ts
import Image from "next/image";
import { breadcrumbJsonLd } from "../seo";
```

Assinatura da função (linha 10-20), adicionar `domain`:

```ts
export async function CategoryListing({
  slug,
  page: pageRaw,
  channel,
  palette,
  domain,
}: {
  slug: string;
  page?: string;
  channel: string;
  palette: Palette;
  domain: string;
}) {
```

Logo após `const path = getCategoryPath(categories, node.id);` (linha 29), montar os itens do breadcrumb:

```ts
  const breadcrumbItems = [
    { name: "Início", path: "/" },
    ...path.map((c) => ({ name: c.name, path: `/categoria/${c.slug}` })),
  ];
```

No JSX, logo antes do `<nav aria-label="Breadcrumb">` (linha 37), renderizar o JSON-LD:

```tsx
  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbItems, domain)) }}
      />
      <nav aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
```

Trocar as duas ocorrências de banner (linhas 61-62 e 65-66) de `<img>` para `next/image`, envolvendo num container com `aspect-ratio` fixo (o banner não tem dimensão intrínseca conhecida — usamos uma proporção típica de banner horizontal):

```tsx
      {categoryBanner && (
        <div style={{ marginBottom: 20 }}>
          {categoryBanner.linkUrl ? (
            <a href={categoryBanner.linkUrl} style={{ position: "relative", display: "block", width: "100%", aspectRatio: "3 / 1", borderRadius: 16, overflow: "hidden" }}>
              <Image
                src={categoryBanner.imageUrl}
                alt={categoryBanner.title ?? node.name}
                fill
                sizes="(max-width: 768px) 100vw, 1200px"
                style={{ objectFit: "cover" }}
              />
            </a>
          ) : (
            <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 1", borderRadius: 16, overflow: "hidden" }}>
              <Image
                src={categoryBanner.imageUrl}
                alt={categoryBanner.title ?? node.name}
                fill
                sizes="(max-width: 768px) 100vw, 1200px"
                style={{ objectFit: "cover" }}
              />
            </div>
          )}
        </div>
      )}
```

Remover as duas linhas `// eslint-disable-next-line @next/next/no-img-element` associadas (não são mais necessárias).

- [ ] **Step 2: Verificar tipos e lint**

Run: `cd packages/core && npx tsc --noEmit`
Expected: sem erros de tipo (a prop `domain` é obrigatória — as Tasks 16/17 quebrariam a build até serem feitas; rodar essa checagem de novo ao final da Task 17).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/category-listing.tsx
git commit -m "feat(core): adiciona BreadcrumbList JSON-LD e next/image ao banner de categoria"
```

---

### Task 4: `product-card.tsx` — `next/image`

**Files:**
- Modify: `packages/core/src/components/product-card.tsx:1-46`

- [ ] **Step 1: Implementar**

Adicionar import:

```ts
import Image from "next/image";
```

Trocar o `<img>` (linhas 25-35) por:

```tsx
          <Image
            src={product.img}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
            style={{ objectFit: "contain" }}
          />
```

(o container pai `.product-card-media`, linhas 15-24, já tem `position: "relative"` e `aspectRatio`, compatível com `fill`.)

- [ ] **Step 2: Verificar tipos**

Run: `cd packages/core && npx tsc --noEmit`
Expected: sem erros novos relacionados a este arquivo.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/product-card.tsx
git commit -m "feat(core): product-card usa next/image"
```

---

### Task 5: `product-variant-panel.tsx` — `next/image`

**Files:**
- Modify: `packages/core/src/components/product-variant-panel.tsx:1-92`

- [ ] **Step 1: Implementar**

Adicionar import:

```ts
import Image from "next/image";
```

Trocar o `<img>` dentro de `.img-container` (linhas 86-92) por:

```tsx
        <div className="img-container" style={{ width: "100%", height: 450, position: "relative" }}>
          <Image
            src={img}
            alt={cartName}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 450px"
            style={{ objectFit: "contain" }}
          />
        </div>
```

(o container já tem `height: 450` + `position: relative`, compatível com `fill`; `priority` ajuda o LCP já que essa é a imagem principal da PDP.)

- [ ] **Step 2: Verificar tipos**

Run: `cd packages/core && npx tsc --noEmit`
Expected: sem erros novos relacionados a este arquivo.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/product-variant-panel.tsx
git commit -m "feat(core): product-variant-panel usa next/image na imagem principal"
```

---

### Task 6: `next.config.ts` — `images.remotePatterns` (mypet + distribuidora)

**Files:**
- Modify: `apps/mypet/next.config.ts`
- Modify: `apps/distribuidora/next.config.ts`

- [ ] **Step 1: Implementar nos dois arquivos** (conteúdo idêntico nos dois apps)

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@mypet/core"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Build de verificação (dispara download+otimização de imagem local em dev; build de produção só valida config)**

Run: `cd apps/mypet && npm run build`
Expected: build passa sem erro de `images.remotePatterns`.

Run: `cd apps/distribuidora && npm run build`
Expected: build passa sem erro.

- [ ] **Step 3: Commit**

```bash
git add apps/mypet/next.config.ts apps/distribuidora/next.config.ts
git commit -m "feat: configura images.remotePatterns para next/image (Supabase Storage)"
```

---

### Task 7: `robots.ts` — `apps/mypet`

**Files:**
- Create: `apps/mypet/app/robots.ts`

- [ ] **Step 1: Implementar**

```ts
import type { MetadataRoute } from "next";
import { clientConfig } from "@/client.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/entrar", "/completar-cadastro", "/cotacao", "/pedidos", "/api/"],
    },
    sitemap: `https://${clientConfig.domain}/sitemap.xml`,
  };
}
```

- [ ] **Step 2: Verificar via dev server**

Run: `cd apps/mypet && npm run dev` (em background) e depois `curl http://localhost:3000/robots.txt`
Expected: corpo contendo `Disallow: /entrar`, `Disallow: /cotacao`, `Sitemap: https://mypetbrasil.com.br/sitemap.xml`. Encerrar o dev server depois.

- [ ] **Step 3: Commit**

```bash
git add apps/mypet/app/robots.ts
git commit -m "feat(mypet): adiciona robots.txt"
```

---

### Task 8: `robots.ts` — `apps/distribuidora`

**Files:**
- Create: `apps/distribuidora/app/robots.ts`

- [ ] **Step 1: Implementar** (idêntico à Task 7, caminho do app diferente)

```ts
import type { MetadataRoute } from "next";
import { clientConfig } from "@/client.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/entrar", "/completar-cadastro", "/cotacao", "/pedidos", "/api/"],
    },
    sitemap: `https://${clientConfig.domain}/sitemap.xml`,
  };
}
```

- [ ] **Step 2: Verificar via dev server**

Run: `cd apps/distribuidora && npm run dev` (em background) e depois `curl http://localhost:3000/robots.txt`
Expected: corpo contendo `Sitemap: https://www.distribuidorapetshop.com.br/sitemap.xml`. Encerrar o dev server depois.

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/robots.ts
git commit -m "feat(distribuidora): adiciona robots.txt"
```

---

### Task 9: `opengraph-image.tsx` — `apps/mypet`

**Files:**
- Create: `apps/mypet/app/opengraph-image.tsx`

**Interfaces:**
- Produces: rota `GET /opengraph-image` — usada como fallback de OG para home/categoria/produto-sem-imagem (Next.js resolve automaticamente para toda rota abaixo de `app/` sem seu próprio `opengraph-image`) e como `logo` do `organizationJsonLd` (Task 1/12).

- [ ] **Step 1: Implementar**

```tsx
import { ImageResponse } from "next/og";
import { clientConfig } from "@/client.config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const { name, tagline, palette } = clientConfig;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: palette.navyDark,
          color: palette.white,
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 900, color: palette.pink, display: "flex" }}>{name}</div>
        <div style={{ fontSize: 32, marginTop: 16, color: "rgba(255,255,255,0.85)", display: "flex" }}>{tagline}</div>
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 2: Verificar via dev server**

Run: `cd apps/mypet && npm run dev` (em background) e depois `curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/opengraph-image`
Expected: `200`. Encerrar o dev server depois.

- [ ] **Step 3: Commit**

```bash
git add apps/mypet/app/opengraph-image.tsx
git commit -m "feat(mypet): adiciona imagem OG gerada via next/og"
```

---

### Task 10: `opengraph-image.tsx` — `apps/distribuidora`

**Files:**
- Create: `apps/distribuidora/app/opengraph-image.tsx`

- [ ] **Step 1: Implementar** (idêntico à Task 9, caminho do app diferente — `clientConfig` de `apps/distribuidora/client.config.ts` já traz `palette` em tons de cinza/azul dessa marca)

```tsx
import { ImageResponse } from "next/og";
import { clientConfig } from "@/client.config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const { name, tagline, palette } = clientConfig;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: palette.navyDark,
          color: palette.white,
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 900, color: palette.pink, display: "flex" }}>{name}</div>
        <div style={{ fontSize: 32, marginTop: 16, color: "rgba(255,255,255,0.85)", display: "flex" }}>{tagline}</div>
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 2: Verificar via dev server**

Run: `cd apps/distribuidora && npm run dev` (em background) e depois `curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/opengraph-image`
Expected: `200`. Encerrar o dev server depois.

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/opengraph-image.tsx
git commit -m "feat(distribuidora): adiciona imagem OG gerada via next/og"
```

---

### Task 11: `layout.tsx` — `apps/mypet` (metadataBase, Organization JSON-LD, fonte Nunito)

**Files:**
- Modify: `apps/mypet/app/layout.tsx`

**Interfaces:**
- Consumes: `organizationJsonLd` de `@mypet/core/seo` (Task 1).

- [ ] **Step 1: Implementar** (arquivo completo, substituindo o conteúdo atual de `apps/mypet/app/layout.tsx`)

```tsx
import type { Metadata } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { organizationJsonLd } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${clientConfig.domain}`),
  title: `${clientConfig.name} — ${clientConfig.tagline}`,
  description:
    "Catálogo de atacado para pet shops e distribuidores. Cadastro gratuito, cotações sob consulta.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${nunito.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* eslint-disable-next-line react/no-danger */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(clientConfig)) }}
        />
        <ClientConfigProvider config={clientConfig}>
          <CartProvider>{children}</CartProvider>
        </ClientConfigProvider>
      </body>
    </html>
  );
}
```

Em `apps/mypet/app/globals.css`, atualizar as variáveis de fonte (linha 9-10) de `--font-geist-sans`/`--font-geist-mono` para `--font-nunito`/`--font-nunito-sans`:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-nunito);
  --font-mono: var(--font-nunito-sans);
}
```

- [ ] **Step 2: Build de verificação**

Run: `cd apps/mypet && npm run build`
Expected: build passa. Verificar visualmente depois (Task 22) que a fonte carregada é Nunito e o texto não muda de aparência (era Nunito via `@import` antes, continua Nunito agora via `next/font`).

- [ ] **Step 3: Commit**

```bash
git add apps/mypet/app/layout.tsx apps/mypet/app/globals.css
git commit -m "feat(mypet): metadataBase, Organization JSON-LD e fonte Nunito via next/font"
```

---

### Task 12: `layout.tsx` — `apps/distribuidora` (metadataBase, Organization JSON-LD, fonte Nunito)

**Files:**
- Modify: `apps/distribuidora/app/layout.tsx`
- Modify: `apps/distribuidora/app/globals.css`

- [ ] **Step 1: Implementar** (mesma mudança da Task 11, preservando `Viewport`, `appleWebApp`, `RegisterSW`/`InstallPrompt` já existentes nesse app)

```tsx
import type { Metadata, Viewport } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { organizationJsonLd } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import RegisterSW from "./components/register-sw";
import InstallPrompt from "./components/install-prompt";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${clientConfig.domain}`),
  title: `${clientConfig.name} — ${clientConfig.tagline}`,
  description:
    "Catálogo de atacado para pet shops e distribuidores. Cadastro gratuito, cotações sob consulta.",
  appleWebApp: {
    capable: true,
    title: clientConfig.name,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: clientConfig.palette.navy,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${nunito.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* eslint-disable-next-line react/no-danger */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(clientConfig)) }}
        />
        <ClientConfigProvider config={clientConfig}>
          <CartProvider>{children}</CartProvider>
          <RegisterSW />
          <InstallPrompt />
        </ClientConfigProvider>
      </body>
    </html>
  );
}
```

Em `apps/distribuidora/app/globals.css`, mesma troca de variáveis de fonte da Task 11 (`--font-nunito`/`--font-nunito-sans`).

- [ ] **Step 2: Build de verificação**

Run: `cd apps/distribuidora && npm run build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/layout.tsx apps/distribuidora/app/globals.css
git commit -m "feat(distribuidora): metadataBase, Organization JSON-LD e fonte Nunito via next/font"
```

---

### Task 13: PDP — `apps/mypet/app/produtos/[id]/page.tsx`

**Files:**
- Modify: `apps/mypet/app/produtos/[id]/page.tsx`

**Interfaces:**
- Consumes: `canonicalUrl`, `productJsonLd`, `productGroupJsonLd`, `breadcrumbJsonLd` de `@mypet/core/seo`; `getCategoryPath` de `@mypet/core/catalog-utils`; `product.categoryId`/`product.category` (Task 2).

- [ ] **Step 1: Implementar**

Atualizar os imports no topo:

```ts
import { Suspense } from "react";
import { getProductById, getCategories } from "@mypet/core/catalog";
import { getCategoryPath } from "@mypet/core/catalog-utils";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { ProductVariantPanel } from "@mypet/core/components/product-variant-panel";
import { productGroupJsonLd, productJsonLd, breadcrumbJsonLd, canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
```

`generateMetadata` (linhas 13-26) ganha `alternates.canonical` e `openGraph`/`twitter`:

```ts
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id, clientConfig.catalogChannel);
  if (!product) return { title: `Produto não encontrado — ${clientConfig.name}` };

  return {
    title: `${product.name} — ${clientConfig.name} Atacado`,
    description: `Confira os detalhes de ${product.name} no atacado B2B da ${clientConfig.name}. Solicite cotação sem compromisso.`,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/produtos/${id}`) },
    openGraph: {
      title: product.name,
      description: `Confira os detalhes de ${product.name} no atacado B2B da ${clientConfig.name}.`,
      images: [product.img],
    },
    twitter: {
      card: "summary_large_image",
      images: [product.img],
    },
  };
}
```

Remover o bloco `<style>{...@import...}</style>` inteiro (linhas 36-159 do arquivo original — o `@import url(...)` e a linha de comentário `{/* GOOGLE FONTS */}`; o restante das regras CSS do bloco `<style>` continua, só a linha `@import url(...)` é removida). O `<div>` raiz troca `fontFamily: "'Nunito', 'Nunito Sans', sans-serif"` por nada (remove a propriedade — a fonte já vem herdada da variável CSS `--font-nunito` setada no `<html>` pelo `layout.tsx`, Task 11):

```tsx
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { margin: 0; }

        .unlock-btn {
```

(o restante do conteúdo do `<style>` — `.unlock-btn`, `.cta-primary`, `.back-link`, `.modal-overlay`, `.modal`, `.form-input`, `.form-submit`, `.info-table`, media query — permanece idêntico, só sem a linha `@import`.)

Dentro de `ProductDetail` (função async no final do arquivo), montar o breadcrumb e trocar o JSON-LD:

```tsx
async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProductById(id, clientConfig.catalogChannel),
    getCategories(),
  ]);

  if (!product) {
    notFound();
  }

  const categoryPath = product.categoryId ? getCategoryPath(categories, product.categoryId) : [];
  const breadcrumbItems = [
    { name: "Início", path: "/" },
    ...categoryPath.map((c) => ({ name: c.name, path: `/categoria/${c.slug}` })),
    { name: product.name, path: `/produtos/${product.id}` },
  ];

  const jsonLd = productGroupJsonLd(product, clientConfig.domain) ?? productJsonLd(product, clientConfig.domain);

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbItems, clientConfig.domain)) }}
      />
      <nav aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
        <ol style={{ display: "flex", flexWrap: "wrap", gap: 6, listStyle: "none", margin: 0, padding: 0, fontSize: 13, color: PALETTE.gray600 }}>
          {breadcrumbItems.map((item, i) => (
            <li key={item.path} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span aria-hidden="true">/</span>}
              {i === breadcrumbItems.length - 1 ? (
                <span style={{ color: PALETTE.navy, fontWeight: 700 }} aria-current="page">{item.name}</span>
              ) : (
                <Link href={item.path} style={{ color: PALETTE.gray600, textDecoration: "none" }}>{item.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
        {jsonLd && (
          // eslint-disable-next-line react/no-danger
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        )}
        {/* COLUNA ESQUERDA - IMAGEM + VARIANTES + CTA */}
        <div>
          <ProductVariantPanel product={product} />
        </div>

        {/* COLUNA DIREITA - INFORMAÇÕES */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
```

(o restante do JSX de `ProductDetail`, a partir de "COLUNA DIREITA", continua idêntico ao arquivo atual — só a abertura mudou para incluir o breadcrumb antes do grid.)

- [ ] **Step 2: Build de verificação**

Run: `cd apps/mypet && npm run build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add apps/mypet/app/produtos/\[id\]/page.tsx
git commit -m "feat(mypet): PDP ganha canonical, OG, JSON-LD completo e breadcrumb"
```

---

### Task 14: PDP — `apps/distribuidora/app/produtos/[id]/page.tsx`

**Files:**
- Modify: `apps/distribuidora/app/produtos/[id]/page.tsx`

- [ ] **Step 1: Implementar**

`apps/distribuidora/app/produtos/[id]/page.tsx` é hoje idêntico, arquivo por arquivo, ao de `apps/mypet` (confirmado por leitura direta dos dois). Aplicar as mesmas mudanças:

Atualizar os imports no topo:

```ts
import { Suspense } from "react";
import { getProductById, getCategories } from "@mypet/core/catalog";
import { getCategoryPath } from "@mypet/core/catalog-utils";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { ProductVariantPanel } from "@mypet/core/components/product-variant-panel";
import { productGroupJsonLd, productJsonLd, breadcrumbJsonLd, canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
```

`generateMetadata`:

```ts
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id, clientConfig.catalogChannel);
  if (!product) return { title: `Produto não encontrado — ${clientConfig.name}` };

  return {
    title: `${product.name} — ${clientConfig.name} Atacado`,
    description: `Confira os detalhes de ${product.name} no atacado B2B da ${clientConfig.name}. Solicite cotação sem compromisso.`,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/produtos/${id}`) },
    openGraph: {
      title: product.name,
      description: `Confira os detalhes de ${product.name} no atacado B2B da ${clientConfig.name}.`,
      images: [product.img],
    },
    twitter: {
      card: "summary_large_image",
      images: [product.img],
    },
  };
}
```

Remover a linha `@import url(...)` do bloco `<style>` e a propriedade `fontFamily` do `<div>` raiz:

```tsx
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { margin: 0; }

        .unlock-btn {
```

(o restante do conteúdo do `<style>` permanece idêntico, só sem a linha `@import`.)

`ProductDetail`:

```tsx
async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProductById(id, clientConfig.catalogChannel),
    getCategories(),
  ]);

  if (!product) {
    notFound();
  }

  const categoryPath = product.categoryId ? getCategoryPath(categories, product.categoryId) : [];
  const breadcrumbItems = [
    { name: "Início", path: "/" },
    ...categoryPath.map((c) => ({ name: c.name, path: `/categoria/${c.slug}` })),
    { name: product.name, path: `/produtos/${product.id}` },
  ];

  const jsonLd = productGroupJsonLd(product, clientConfig.domain) ?? productJsonLd(product, clientConfig.domain);

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbItems, clientConfig.domain)) }}
      />
      <nav aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
        <ol style={{ display: "flex", flexWrap: "wrap", gap: 6, listStyle: "none", margin: 0, padding: 0, fontSize: 13, color: PALETTE.gray600 }}>
          {breadcrumbItems.map((item, i) => (
            <li key={item.path} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span aria-hidden="true">/</span>}
              {i === breadcrumbItems.length - 1 ? (
                <span style={{ color: PALETTE.navy, fontWeight: 700 }} aria-current="page">{item.name}</span>
              ) : (
                <Link href={item.path} style={{ color: PALETTE.gray600, textDecoration: "none" }}>{item.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
        {jsonLd && (
          // eslint-disable-next-line react/no-danger
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        )}
        {/* COLUNA ESQUERDA - IMAGEM + VARIANTES + CTA */}
        <div>
          <ProductVariantPanel product={product} />
        </div>

        {/* COLUNA DIREITA - INFORMAÇÕES */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
```

(o restante do JSX de `ProductDetail`, a partir de "COLUNA DIREITA", continua idêntico ao arquivo atual.)

- [ ] **Step 2: Build de verificação**

Run: `cd apps/distribuidora && npm run build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/produtos/\[id\]/page.tsx
git commit -m "feat(distribuidora): PDP ganha canonical, OG, JSON-LD completo e breadcrumb"
```

---

### Task 15: Categoria — `apps/mypet/app/categoria/[slug]/page.tsx`

**Files:**
- Modify: `apps/mypet/app/categoria/[slug]/page.tsx`

**Interfaces:**
- Consumes: `canonicalUrl` de `@mypet/core/seo`; `CategoryListing` agora exige prop `domain` (Task 3).

- [ ] **Step 1: Implementar**

Import adicional:

```ts
import { canonicalUrl } from "@mypet/core/seo";
```

`generateMetadata` (linhas 11-25) ganha `alternates.canonical` e `openGraph`:

```ts
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categories = await getCategories();
  const node = categories.find((c) => c.slug === slug);
  if (!node) return { title: `Categoria não encontrada — ${clientConfig.name}` };

  return {
    title: `${node.name} — ${clientConfig.name} Atacado`,
    description: `Confira os produtos de ${node.name} no atacado B2B da ${clientConfig.name}. Preços sob consulta para lojistas.`,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/categoria/${slug}`) },
    openGraph: {
      title: node.name,
      description: `Confira os produtos de ${node.name} no atacado B2B da ${clientConfig.name}.`,
    },
  };
}
```

Remover a linha `@import url(...)` do bloco `<style>` (linha 39) e a propriedade `fontFamily` do `<div>` raiz (linha 37), mesmo padrão da Task 13:

```tsx
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
```

Passar `domain` para `CategoryListing` dentro de `CategoryListingResolved`:

```tsx
async function CategoryListingResolved({
  params,
  searchParams,
  channel,
  palette,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
  channel: string;
  palette: Palette;
}) {
  const { slug } = await params;
  const { page } = await searchParams;
  return <CategoryListing slug={slug} page={page} channel={channel} palette={palette} domain={clientConfig.domain} />;
}
```

- [ ] **Step 2: Build de verificação**

Run: `cd apps/mypet && npm run build`
Expected: build passa (essa Task também resolve o erro de tipo pendente da Task 3, já que `domain` agora é passado).

- [ ] **Step 3: Commit**

```bash
git add apps/mypet/app/categoria/\[slug\]/page.tsx
git commit -m "feat(mypet): categoria ganha canonical, OG e passa domain para breadcrumb"
```

---

### Task 16: Categoria — `apps/distribuidora/app/categoria/[slug]/page.tsx`

**Files:**
- Modify: `apps/distribuidora/app/categoria/[slug]/page.tsx`

- [ ] **Step 1: Implementar**

`apps/distribuidora/app/categoria/[slug]/page.tsx` é hoje idêntico, arquivo por arquivo, ao de `apps/mypet` (confirmado por leitura direta). Import adicional:

```ts
import { canonicalUrl } from "@mypet/core/seo";
```

`generateMetadata`:

```ts
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categories = await getCategories();
  const node = categories.find((c) => c.slug === slug);
  if (!node) return { title: `Categoria não encontrada — ${clientConfig.name}` };

  return {
    title: `${node.name} — ${clientConfig.name} Atacado`,
    description: `Confira os produtos de ${node.name} no atacado B2B da ${clientConfig.name}. Preços sob consulta para lojistas.`,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/categoria/${slug}`) },
    openGraph: {
      title: node.name,
      description: `Confira os produtos de ${node.name} no atacado B2B da ${clientConfig.name}.`,
    },
  };
}
```

Remover a linha `@import url(...)` do bloco `<style>` e a propriedade `fontFamily` do `<div>` raiz:

```tsx
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
```

Passar `domain` para `CategoryListing` dentro de `CategoryListingResolved`:

```tsx
async function CategoryListingResolved({
  params,
  searchParams,
  channel,
  palette,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
  channel: string;
  palette: Palette;
}) {
  const { slug } = await params;
  const { page } = await searchParams;
  return <CategoryListing slug={slug} page={page} channel={channel} palette={palette} domain={clientConfig.domain} />;
}
```

- [ ] **Step 2: Build de verificação**

Run: `cd apps/distribuidora && npm run build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/categoria/\[slug\]/page.tsx
git commit -m "feat(distribuidora): categoria ganha canonical, OG e passa domain para breadcrumb"
```

---

### Task 17: Home — `apps/mypet/app/page.tsx`

**Files:**
- Modify: `apps/mypet/app/page.tsx`

- [ ] **Step 1: Implementar**

Adicionar `generateMetadata` (o arquivo hoje não tem nenhuma — só herda do `layout.tsx`) logo antes de `export default async function Home`:

```ts
import { canonicalUrl } from "@mypet/core/seo";

export async function generateMetadata() {
  return {
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/") },
  };
}
```

(o `title`/`description` continuam vindo do `layout.tsx`, Task 11 — `generateMetadata` da página só adiciona o canonical, que faz o Next mesclar com os metadados do layout. Isso também evita que `?q=`/`?brand=`/`?page=` sejam indexados como páginas diferentes da home.)

Remover a linha `@import url(...)` do bloco `<style>` (linha 104) e a propriedade `fontFamily` do `<div>` raiz (linha 100):

```tsx
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
```

- [ ] **Step 2: Build de verificação**

Run: `cd apps/mypet && npm run build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add apps/mypet/app/page.tsx
git commit -m "feat(mypet): home ganha canonical e remove fonte render-blocking"
```

---

### Task 18: Home — `apps/distribuidora/app/page.tsx`

**Files:**
- Modify: `apps/distribuidora/app/page.tsx`

- [ ] **Step 1: Implementar**

`apps/distribuidora/app/page.tsx` é hoje idêntico, arquivo por arquivo, ao de `apps/mypet` (confirmado por leitura direta dos dois — mesmos imports, `STATS_STATIC`, `CatalogContent`, `DynamicCatalog`). Adicionar `generateMetadata` logo antes de `export default async function Home`:

```ts
import { canonicalUrl } from "@mypet/core/seo";

export async function generateMetadata() {
  return {
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/") },
  };
}
```

Remover a linha `@import url(...)` do bloco `<style>` e a propriedade `fontFamily` do `<div>` raiz:

```tsx
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
```

- [ ] **Step 2: Build de verificação**

Run: `cd apps/distribuidora && npm run build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/page.tsx
git commit -m "feat(distribuidora): home ganha canonical e remove fonte render-blocking"
```

---

### Task 19: `cotacao/page.tsx` — `apps/mypet` (remove fonte render-blocking)

**Files:**
- Modify: `apps/mypet/app/cotacao/page.tsx`

- [ ] **Step 1: Implementar**

Remover a linha `@import url(...)` do bloco `<style>` (linha 16) e a propriedade `fontFamily` do `<div>` raiz (linha 14):

```tsx
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
```

(essa rota já é bloqueada em `robots.txt`, Task 7 — não precisa de canonical/OG, só a correção de performance/fonte por consistência visual para quem acessa logado.)

- [ ] **Step 2: Build de verificação**

Run: `cd apps/mypet && npm run build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add apps/mypet/app/cotacao/page.tsx
git commit -m "fix(mypet): remove fonte render-blocking de /cotacao"
```

---

### Task 20: `cotacao/page.tsx` — `apps/distribuidora` (remove fonte render-blocking)

**Files:**
- Modify: `apps/distribuidora/app/cotacao/page.tsx`

- [ ] **Step 1: Implementar**

`apps/distribuidora/app/cotacao/page.tsx` é hoje idêntico, arquivo por arquivo, ao de `apps/mypet` (confirmado por leitura direta dos dois). Remover a linha `@import url(...)` do bloco `<style>` e a propriedade `fontFamily` do `<div>` raiz:

```tsx
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
```

(essa rota já é bloqueada em `robots.txt`, Task 8 — não precisa de canonical/OG, só a correção de fonte.)

- [ ] **Step 2: Build de verificação**

Run: `cd apps/distribuidora && npm run build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/cotacao/page.tsx
git commit -m "fix(distribuidora): remove fonte render-blocking de /cotacao"
```

---

### Task 21: `packages/core` — checagem geral de tipos e testes

**Files:**
- (nenhum arquivo novo — task de verificação)

- [ ] **Step 1: Rodar toda a suíte de testes de `packages/core`**

Run: `cd packages/core && npx vitest run`
Expected: todos os testes passam, incluindo `seo.test.ts` (Task 1) e `catalog.test.ts` (Task 2).

- [ ] **Step 2: Rodar checagem de tipos de `packages/core`**

Run: `cd packages/core && npx tsc --noEmit`
Expected: sem erros.

(Nenhum commit nesta task — é só verificação; se algo falhar, corrigir inline nas Tasks correspondentes e recommitar lá.)

---

### Task 22: Verificação final — build, lint e checagem manual nos dois apps

**Files:**
- (nenhum arquivo novo — task de verificação end-to-end)

- [ ] **Step 1: Build e lint dos dois apps**

Run: `cd apps/mypet && npm run build && npm run lint`
Expected: build e lint passam sem erro.

Run: `cd apps/distribuidora && npm run build && npm run lint`
Expected: build e lint passam sem erro.

- [ ] **Step 2: Checagem manual via `/run` — `apps/mypet`**

Suba o app localmente (`npm run dev` em `apps/mypet`) e verifique:
- `http://localhost:3000/robots.txt` reflete as rotas bloqueadas e o sitemap.
- `http://localhost:3000/sitemap.xml` continua funcionando (sem regressão).
- Uma PDP de produto **com** variantes: JSON-LD `ProductGroup` presente, breadcrumb visual e `BreadcrumbList` JSON-LD presentes, `<head>` tem `openGraph`/`twitter` com a imagem do produto, `<link rel="canonical">` aponta para `/produtos/{id}` sem query mesmo acessando com `?variante=`.
- Uma PDP de produto **sem** variantes: JSON-LD `Product` presente (não `ProductGroup`).
- Uma página de categoria: `BreadcrumbList` JSON-LD presente, canonical correto, imagem de banner (se houver) carregando via `next/image` sem erro de host não configurado.
- Home: canonical aponta para `/`, imagem OG (`/opengraph-image`) responde 200.
- Inspecionar visualmente que a fonte (Nunito) e o layout não mudaram de aparência em nenhuma página.
- Inspecionar visualmente que as imagens de produto carregam corretamente (grid da home/categoria e imagem principal da PDP).

- [ ] **Step 3: Checagem manual via `/run` — `apps/distribuidora`**

Repetir todos os itens do Step 2 para `apps/distribuidora` (`npm run dev` nesse app).

- [ ] **Step 4: Validação externa (opcional, requer os apps publicamente acessíveis — pode ficar para o momento do deploy)**

- Google Rich Results Test (`https://search.google.com/test/rich-results`) para uma URL de PDP com e sem variantes, e uma URL de categoria — sem erros nos tipos `Product`/`ProductGroup`/`BreadcrumbList`/`Organization`.
- Facebook Sharing Debugger (`https://developers.facebook.com/tools/debug/`) para a home, uma PDP e uma categoria — título/descrição/imagem corretos.

Esta task não gera commit — é a validação final do plano.
