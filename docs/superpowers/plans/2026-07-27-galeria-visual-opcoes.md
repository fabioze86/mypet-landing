# Galeria visual de opções (`apps/gallery`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `apps/gallery`, um app local (sem deploy público) que exibe, lado a lado,
múltiplas opções reais de componente para um mesmo "espaço" de UI — começando pelo card
de produto em listagem (Opção A = card atual com lead-gate, Opção B = card novo com
seletor de variação + adicionar ao carrinho) — usando dados reais do catálogo
(canal `mypet`).

**Architecture:** Registro central `GALLERY_SLOTS` em `packages/core/src/gallery-registry.ts`
lista, por slot, quais componentes reais (de `packages/core/src/components`) mostrar e
quais produtos curados usar. O componente novo (`ProductCardVariantCart`) é código de
produção normal, sem nada específico de "galeria" nele — ele só recebe um `product` com
campos opcionais de demo (`demoPriceLabel`/`demoInstallmentLabel`) que qualquer app real
poderá preencher no futuro quando existir preço de verdade. `apps/gallery` é um app
Next.js fino (mesmo padrão do `apps/hub` já existente) que busca produtos reais via
`getProductById` (a mesma função que a PDP já usa), aplica um pequeno overlay de dados
de exemplo (só para os 2 produtos curados deste slot) e renderiza a grade de opções.

**Tech Stack:** TypeScript, Next.js App Router (React Server + Client Components),
Vitest, `@supabase/supabase-js` (via `getHubClient` já existente).

## Global Constraints

- `packages/core` não tem infraestrutura de teste de componente (sem jsdom/testing-library
  no `vitest.config.ts` — `environment: "node"`). Componentes de UI novos são verificados
  por `tsc --noEmit` + checagem visual manual no app rodando, não por teste automatizado.
  Isso é consistente com o resto do pacote: só funções puras (`cart.ts`, `catalog-utils.ts`,
  `features.ts`) têm teste automatizado.
- `apps/gallery` é **local-only**: sem deploy, sem env pública além das já usadas por
  `apps/mypet` (mesma `SUPABASE_URL`/`SUPABASE_ANON_KEY`, chave pública só-leitura).
- Nenhuma mudança em `apps/mypet`, `apps/distribuidora`, `apps/azpetshop` ou nos
  componentes existentes (`ProductCard`, `VariantSelector`, `ProductVariantPanel`) —
  tudo isso é reaproveitado sem alteração.
- Preço, variantes e badge da Opção B usam dados de exemplo (fictícios) — decisão
  registrada no spec (`docs/superpowers/specs/2026-07-26-galeria-visual-opcoes-design.md`,
  seção "Addendum") porque o catálogo real hoje não tem preço, nem produtos com 2+
  variantes, nem badge `novidade` ativo.
- Produtos curados para o slot `card-produto-listagem` (canal `mypetbrasil`, confirmados
  ativos no Supabase `hub_catalogo` em 2026-07-27):
  - `84ee415f-539c-41be-83ef-f543a8a5d885` — "VESTIDO CHIC TULE ROSA N.1" (recebe
    variantes fictícias PP/P/G — faz sentido temático para roupa de pet).
  - `8da3a2e5-ff1e-4b0b-8828-631b3542fb9d` — "BEBEDOURO DRINKS ECO GOLD 500ML PLAST PET"
    (sem variantes — exercita o caminho "+" direto).

---

### Task 1: Componente `ProductCardVariantCart`

**Files:**
- Create: `packages/core/src/components/product-card-variant-cart.tsx`

**Interfaces:**
- Consumes: `badgeStyle`, `useClientConfig` de `../theme`; `useCart` de `./cart-provider`;
  `variantLabel` de `./variant-selector`; `CatalogProduct`, `ProductVariant` de
  `../catalog-utils`.
- Produces: `export type ProductCardVariantCartProduct = CatalogProduct & { variants: ProductVariant[]; demoPriceLabel?: string; demoInstallmentLabel?: string }`;
  `export function ProductCardVariantCart({ product }: { product: ProductCardVariantCartProduct })`.

- [ ] **Step 1: Escrever o componente**

```tsx
// packages/core/src/components/product-card-variant-cart.tsx
"use client";

import { useState } from "react";
import { badgeStyle, useClientConfig } from "../theme";
import { useCart } from "./cart-provider";
import { variantLabel } from "./variant-selector";
import type { CatalogProduct, ProductVariant } from "../catalog-utils";

export type ProductCardVariantCartProduct = CatalogProduct & {
  variants: ProductVariant[];
  demoPriceLabel?: string;
  demoInstallmentLabel?: string;
};

function toSelfVariant(product: ProductCardVariantCartProduct): ProductVariant {
  return { id: product.id, name: product.name, sku: product.sku, barcode: null, img: product.img, axis: [] };
}

export function ProductCardVariantCart({ product }: { product: ProductCardVariantCartProduct }) {
  const { palette } = useClientConfig();
  const { addItem } = useCart();
  const variants = product.variants.length > 0 ? product.variants : [toSelfVariant(product)];
  const [selectedId, setSelectedId] = useState(variants[0].id);
  const [favorited, setFavorited] = useState(false);
  const [added, setAdded] = useState(false);

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  const badgeStyleValue = product.badge ? badgeStyle(product.badge.code, palette) : null;

  const handleAdd = () => {
    addItem(
      { id: selected.id, name: selected.name, sku: selected.sku, brand: product.brand, img: selected.img || product.img },
      1,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div
      className="product-card-variant-cart"
      style={{ position: "relative", background: palette.white, borderRadius: 16, overflow: "hidden", border: `1px solid ${palette.gray200}` }}
    >
      <div style={{ position: "relative", aspectRatio: "1 / 1.1", width: "100%", background: palette.white }}>
        <img
          src={selected.img || product.img}
          alt={product.name}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
        <button
          type="button"
          onClick={() => setFavorited((f) => !f)}
          aria-label={favorited ? "Remover dos favoritos" : "Favoritar"}
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.92)",
            cursor: "pointer",
            fontSize: 15,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: favorited ? palette.pink : palette.gray400,
          }}
        >
          {favorited ? "♥" : "♡"}
        </button>
        {product.badge && badgeStyleValue && (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: badgeStyleValue.bg,
              color: badgeStyleValue.color,
              fontSize: 11,
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 100,
              letterSpacing: "0.02em",
            }}
          >
            {product.badge.label}
          </span>
        )}
      </div>

      <div style={{ padding: "10px 12px 12px" }}>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: palette.navy,
            lineHeight: 1.28,
            marginBottom: 8,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {product.name}
        </h3>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: palette.navy }}>
            {product.demoPriceLabel ?? "Preço sob consulta"}
          </div>
          {product.demoInstallmentLabel && (
            <div style={{ fontSize: 11, color: palette.gray600 }}>{product.demoInstallmentLabel}</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {variants.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
              {variants.map((variant) => {
                const active = variant.id === selectedId;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedId(variant.id)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 100,
                      border: `1.5px solid ${active ? palette.pink : palette.gray200}`,
                      background: active ? palette.pink : palette.white,
                      color: active ? palette.white : palette.gray800,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {variantLabel(variant)}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={handleAdd}
            aria-label="Adicionar ao carrinho"
            style={{
              marginLeft: variants.length > 1 ? 0 : "auto",
              width: 34,
              height: 34,
              minWidth: 34,
              borderRadius: "50%",
              border: "none",
              background: added ? palette.green : palette.pink,
              color: palette.white,
              fontSize: 18,
              fontWeight: 900,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
          >
            {added ? "✓" : "+"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @mypet/core exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/product-card-variant-cart.tsx
git commit -m "feat(core): componente ProductCardVariantCart (variacao + carrinho no card)"
```

---

### Task 2: Registro `gallery-registry.ts`

**Files:**
- Create: `packages/core/src/gallery-registry.ts`
- Create: `packages/core/src/gallery-registry.test.ts`
- Modify: `packages/core/package.json:6-24` (bloco `exports`)

**Interfaces:**
- Consumes: `ProductCard` de `./components/product-card`; `ProductCardVariantCart`,
  `ProductCardVariantCartProduct` de `./components/product-card-variant-cart` (Task 1).
- Produces: `export type GalleryProduct = ProductCardVariantCartProduct`;
  `export type GalleryOption = { id: string; label: string; component: ComponentType<{ product: GalleryProduct }>; notes?: string }`;
  `export type GallerySlot = { id: string; label: string; description: string; productIds: string[]; options: GalleryOption[] }`;
  `export const GALLERY_SLOTS: GallerySlot[]`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// packages/core/src/gallery-registry.test.ts
import { describe, it, expect } from "vitest";
import { GALLERY_SLOTS } from "./gallery-registry";

describe("gallery registry", () => {
  it("tem pelo menos 1 slot", () => {
    expect(GALLERY_SLOTS.length).toBeGreaterThan(0);
  });

  it("todo slot tem pelo menos 1 opção e 1 productId curado", () => {
    for (const slot of GALLERY_SLOTS) {
      expect(slot.options.length, `slot "${slot.id}" sem opções`).toBeGreaterThan(0);
      expect(slot.productIds.length, `slot "${slot.id}" sem productIds`).toBeGreaterThan(0);
    }
  });

  it("ids de opção são únicos dentro de cada slot", () => {
    for (const slot of GALLERY_SLOTS) {
      const ids = slot.options.map((o) => o.id);
      expect(new Set(ids).size, `slot "${slot.id}" tem ids de opção duplicados`).toBe(ids.length);
    }
  });

  it("ids de slot são únicos no registro inteiro", () => {
    const ids = GALLERY_SLOTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("slot card-produto-listagem tem as opções A e B esperadas", () => {
    const slot = GALLERY_SLOTS.find((s) => s.id === "card-produto-listagem");
    expect(slot).toBeTruthy();
    const optionIds = slot!.options.map((o) => o.id).sort();
    expect(optionIds).toEqual(["a-lead-gate", "b-variacao-carrinho"]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @mypet/core test -- gallery-registry.test.ts`
Expected: FAIL — `Cannot find module './gallery-registry'`.

- [ ] **Step 3: Escrever a implementação mínima**

```ts
// packages/core/src/gallery-registry.ts
import type { ComponentType } from "react";
import { ProductCard } from "./components/product-card";
import {
  ProductCardVariantCart,
  type ProductCardVariantCartProduct,
} from "./components/product-card-variant-cart";

export type GalleryProduct = ProductCardVariantCartProduct;

export type GalleryOption = {
  id: string;
  label: string;
  component: ComponentType<{ product: GalleryProduct }>;
  notes?: string;
};

export type GallerySlot = {
  id: string;
  label: string;
  description: string;
  productIds: string[];
  options: GalleryOption[];
};

export const GALLERY_SLOTS: GallerySlot[] = [
  {
    id: "card-produto-listagem",
    label: "Card de produto em listagem",
    description:
      "Como o card de produto aparece na grade de categoria para o usuário já desbloqueado (pós lead-gate).",
    productIds: [
      "84ee415f-539c-41be-83ef-f543a8a5d885",
      "8da3a2e5-ff1e-4b0b-8828-631b3542fb9d",
    ],
    options: [
      {
        id: "a-lead-gate",
        label: "A — Preço travado (cotação)",
        component: ProductCard,
      },
      {
        id: "b-variacao-carrinho",
        label: "B — Variação + adicionar ao carrinho",
        component: ProductCardVariantCart,
        notes:
          "Preço, variantes (PP/P/G) e badge NOVO são dados de exemplo — o catálogo ainda não tem preço nem produtos com variantes reais cadastrados.",
      },
    ],
  },
];
```

Adicione a entrada no `exports` de `packages/core/package.json` (mesmo padrão de
`"./features": "./src/features.ts"`):

```json
    "./gallery-registry": "./src/gallery-registry.ts",
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @mypet/core test -- gallery-registry.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gallery-registry.ts packages/core/src/gallery-registry.test.ts packages/core/package.json
git commit -m "feat(core): registro central da galeria visual de opcoes"
```

---

### Task 3: App `apps/gallery`

**Files:**
- Create: `apps/gallery/package.json`
- Create: `apps/gallery/next.config.ts`
- Create: `apps/gallery/tsconfig.json`
- Create: `apps/gallery/.env.local` (não versionado — `.gitignore` já ignora `.env*`)
- Create: `apps/gallery/client.config.ts`
- Create: `apps/gallery/app/layout.tsx`
- Create: `apps/gallery/app/page.tsx`
- Create: `apps/gallery/app/[slotId]/page.tsx`
- Modify: `package.json:5-13` (raiz do monorepo — scripts `dev:gallery` e `dev:all`)
- Modify: `apps/hub/app/page.tsx:7-28` (array `SITES` do hub)

**Interfaces:**
- Consumes: `GALLERY_SLOTS`, `GalleryProduct` de `@mypet/core/gallery-registry` (Task 2);
  `getProductById` de `@mypet/core/catalog`; `ClientConfigProvider`, `type ClientConfig`
  de `@mypet/core/theme`; `CartProvider` de `@mypet/core/components/cart-provider`;
  `LeadGateProvider` de `@mypet/core/components/lead-gate`; `SITES` de
  `@mypet/core/features`.
- Produces: app rodando em `http://localhost:4105`, rota `/` (índice) e `/[slotId]`
  (ex.: `/card-produto-listagem`).

- [ ] **Step 1: `apps/gallery/package.json`**

```json
{
  "name": "gallery",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 4105",
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
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: `apps/gallery/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 3: `apps/gallery/tsconfig.json`**

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

- [ ] **Step 4: `apps/gallery/.env.local`**

Mesmos valores já usados por `apps/mypet/.env.local` (chave pública, só-leitura):

```
SUPABASE_URL=https://hsguyfiyqpuligijcjlw.supabase.co
SUPABASE_ANON_KEY=sb_publishable_Fci4-su5zOXY0SpEeiv77A_iUwkOPXm
```

- [ ] **Step 5: `apps/gallery/client.config.ts`**

```ts
import type { ClientConfig } from "@mypet/core/theme";
import { SITES } from "@mypet/core/features";

export const clientConfig: ClientConfig = {
  name: "My Pet Brasil",
  tagline: "Galeria de opções (ambiente de teste local)",
  domain: "localhost",
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
  features: SITES.mypet.features,
};
```

- [ ] **Step 6: `apps/gallery/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { clientConfig } from "@/client.config";

export const metadata: Metadata = {
  title: "Galeria de opções — My Pet",
  description: "Biblioteca visual de opções de UI com dados reais do catálogo. Ambiente local, sem deploy público.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "'Nunito', system-ui, sans-serif", background: "#F4F5F7" }}>
        <ClientConfigProvider config={clientConfig}>
          <LeadGateProvider>
            <CartProvider>{children}</CartProvider>
          </LeadGateProvider>
        </ClientConfigProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: `apps/gallery/app/page.tsx`**

```tsx
import Link from "next/link";
import { GALLERY_SLOTS } from "@mypet/core/gallery-registry";

export default function GalleryIndexPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: "#1A3472" }}>
        Galeria de opções
      </h1>
      <p style={{ color: "#5A6580", marginBottom: 32 }}>
        Biblioteca visual de opções de UI, com dados reais do catálogo. Ambiente local, sem deploy público.
      </p>
      <div style={{ display: "grid", gap: 16 }}>
        {GALLERY_SLOTS.map((slot) => (
          <Link
            key={slot.id}
            href={`/${slot.id}`}
            style={{ display: "block", padding: "20px 24px", borderRadius: 12, border: "1px solid #DDE2EC", background: "#FFFFFF", textDecoration: "none", color: "inherit" }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#1A3472" }}>{slot.label}</h2>
            <p style={{ fontSize: 14, color: "#5A6580", marginTop: 4 }}>{slot.description}</p>
            <p style={{ fontSize: 13, color: "#9CA8C0", marginTop: 8 }}>{slot.options.length} opções</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 8: `apps/gallery/app/[slotId]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getProductById } from "@mypet/core/catalog";
import { GALLERY_SLOTS, type GalleryProduct } from "@mypet/core/gallery-registry";
import { clientConfig } from "@/client.config";

const DEMO_OVERRIDES: Record<string, Partial<GalleryProduct>> = {
  "84ee415f-539c-41be-83ef-f543a8a5d885": {
    badge: { code: "novidade", label: "NOVO" },
    demoPriceLabel: "R$ 89,90",
    demoInstallmentLabel: "em até 3x de R$ 29,97",
    variants: [
      { id: "demo-vestido-pp", name: "Vestido Chic Tule Rosa PP", sku: "VESTIDO-PP", barcode: null, img: "", axis: [{ eixo: "Tamanho", valor: "PP" }] },
      { id: "demo-vestido-p", name: "Vestido Chic Tule Rosa P", sku: "VESTIDO-P", barcode: null, img: "", axis: [{ eixo: "Tamanho", valor: "P" }] },
      { id: "demo-vestido-g", name: "Vestido Chic Tule Rosa G", sku: "VESTIDO-G", barcode: null, img: "", axis: [{ eixo: "Tamanho", valor: "G" }] },
    ],
  },
  "8da3a2e5-ff1e-4b0b-8828-631b3542fb9d": {
    demoPriceLabel: "R$ 34,90",
    demoInstallmentLabel: "em até 2x de R$ 17,45",
  },
};

export default async function GallerySlotPage({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const { slotId } = await params;
  const slot = GALLERY_SLOTS.find((s) => s.id === slotId);
  if (!slot) notFound();

  const rawProducts = await Promise.all(
    slot.productIds.map((id) => getProductById(id, clientConfig.catalogChannel)),
  );

  const galleryProducts: GalleryProduct[] = rawProducts
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((raw) => {
      const override = DEMO_OVERRIDES[raw.id] ?? {};
      const variants = (override.variants ?? raw.variants).map((v) => ({ ...v, img: v.img || raw.img }));
      return {
        id: raw.id,
        name: raw.name,
        sku: raw.sku,
        brand: raw.brand,
        img: raw.img,
        category: null,
        badge: override.badge ?? raw.badge,
        variants,
        demoPriceLabel: override.demoPriceLabel,
        demoInstallmentLabel: override.demoInstallmentLabel,
      };
    });

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>
      <a href="/" style={{ fontSize: 13, color: "#5A6580", textDecoration: "none" }}>← Voltar</a>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: "8px 0 4px", color: "#1A3472" }}>{slot.label}</h1>
      <p style={{ fontSize: 14, color: "#5A6580", marginBottom: 8 }}>{slot.description}</p>
      <p style={{ fontSize: 12, color: "#9CA8C0", marginBottom: 32 }}>
        Preço, variação e badge de exemplo — o catálogo ainda não tem preço nem produtos com variantes reais cadastrados.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${slot.options.length}, 1fr)`, gap: 32 }}>
        {slot.options.map((option) => (
          <div key={option.id}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1A3472", marginBottom: 4 }}>{option.label}</h2>
            {option.notes && <p style={{ fontSize: 12, color: "#9CA8C0", marginBottom: 12 }}>{option.notes}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
              {galleryProducts.map((product) => (
                <option.component key={product.id} product={product} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Atualizar `package.json` da raiz**

Em `package.json:5-13`, adicione `dev:gallery` e inclua `gallery` em `dev:all`:

```json
  "scripts": {
    "dev:mypet": "pnpm --filter mypet dev",
    "dev:distribuidora": "pnpm --filter distribuidora dev",
    "dev:azpetshop": "pnpm --filter azpetshop dev",
    "dev:admin": "pnpm --filter admin dev",
    "dev:hub": "pnpm --filter hub dev",
    "dev:gallery": "pnpm --filter gallery dev",
    "dev:all": "concurrently -n mypet,distribuidora,azpetshop,admin,hub,gallery -c blue,green,yellow,magenta,cyan,white \"pnpm --filter mypet dev\" \"pnpm --filter distribuidora dev\" \"pnpm --filter azpetshop dev\" \"pnpm --filter admin dev\" \"pnpm --filter hub dev\" \"pnpm --filter gallery dev\"",
    "build": "pnpm -r build",
    "lint": "eslint",
    "test": "pnpm --filter @mypet/core test"
  },
```

- [ ] **Step 10: Adicionar a galeria ao hub**

Em `apps/hub/app/page.tsx:7-28`, adicione ao array `SITES`:

```ts
  {
    name: "Galeria de opções",
    description: "Biblioteca visual de opções de UI (local-only)",
    port: 4105,
  },
```

(inserir como último item do array, mantendo os 4 existentes).

- [ ] **Step 11: Instalar dependências do novo workspace**

Run: `pnpm install`
Expected: `apps/gallery` aparece resolvido no lockfile, sem erros.

- [ ] **Step 12: Build**

Run: `pnpm --filter gallery build`
Expected: build termina sem erro de tipo/rota.

- [ ] **Step 13: Checagem visual manual**

Run: `pnpm --filter gallery dev`
Abrir `http://localhost:4105`:
- a página índice lista "Card de produto em listagem";
- `http://localhost:4105/card-produto-listagem` mostra 2 colunas (Opção A / Opção B),
  cada uma com os 2 produtos curados;
- na Opção A, o card do Vestido mostra "Preço sob consulta" e o botão de cotação
  (comportamento inalterado);
- na Opção B, o card do Vestido mostra badge "NOVO", pills "PP / P / G", preço
  "R$ 89,90" e o "+" circular; clicar num pill troca a variante selecionada; clicar no
  "+" mostra "✓" por 1,5s e persiste no `localStorage` da galeria (chave `mypet_cart`,
  isolada deste app);
- na Opção B, o card do Bebedouro não mostra pills (produto sem variação) e o "+" fica
  alinhado à direita.

- [ ] **Step 14: Commit**

```bash
git add apps/gallery package.json apps/hub/app/page.tsx pnpm-lock.yaml
git commit -m "feat: cria apps/gallery com o primeiro slot da galeria visual de opcoes"
```

(o `.env.local` não entra no commit — está no `.gitignore`.)

---

## Self-Review Notes

- **Cobertura do spec:** app `apps/gallery` local-only ✅ (Task 3, sem deploy); registro
  central com componentes reais de `packages/core` ✅ (Task 2, `ProductCard` existente +
  `ProductCardVariantCart` novo); dados reais do catálogo via `getProductById` ✅ (Task 3,
  Step 8); opções mostradas lado a lado (grid), não antes/depois ✅ (Task 3, Step 8);
  primeiro conteúdo (Opção A + Opção B do card de produto) com todo o comportamento do
  spec — favorito, badge NOVO, pills, pré-seleção da 1ª variante, "+" direto quando 1
  variante só, feedback visual no "+" ✅ (Task 1); dados fictícios de preço/variante/badge
  com decisão registrada ✅ (Global Constraints + `notes` do slot).
- **Placeholders:** nenhum "TBD"/"similar a" — todo código de cada step está completo,
  inclusive os 2 IDs de produto reais confirmados via consulta direta ao Supabase.
- **Consistência de tipos:** `ProductCardVariantCartProduct` (Task 1) = `GalleryProduct`
  (Task 2, reexportado por alias) = tipo usado em `DEMO_OVERRIDES`/`galleryProducts`
  (Task 3) — mesmo formato em todas as tasks que o consomem.
