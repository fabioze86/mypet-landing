# AZ Pet Shop — Fase 1: Conformidade da loja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar a loja `www.azpetshop.com.br` apta à revisão do Google Merchant Center: identidade da empresa visível, políticas publicadas, preço + parcelamento + ação de compra claros em card e PDP, e copy sem afirmações não verificáveis.

**Architecture:** O core ganha um bloco opcional `retail` no `ClientConfig` (parcelamento + WhatsApp de consulta). Componentes do core (`ProductCard`, `ProductVariantPanel`) só mudam de comportamento quando `retail` está presente, então `distribuidoraInstagram` (também `commerce: "cart"`) fica intocado. Dados da empresa vivem num único módulo do app (`apps/azpetshop/lib/empresa.ts`) consumido por rodapé, páginas de política e JSON-LD.

**Tech Stack:** Next.js 16.3 (App Router, server components), React 19, TypeScript, vitest + Testing Library (jsdom), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-11-01-azpetshop-google-shopping-design.md` (seção "Fase 1").

## Global Constraints

- `AGENTS.md`: esta versão do Next.js tem breaking changes; consultar `node_modules/next/dist/docs/` antes de usar API de rota/metadata que não esteja já em uso no app.
- Trabalhar direto na `main`, sem worktree (preferência do usuário).
- Vendedor oficial = mesmo CNPJ da My Pet / Grupo AZ, nome fantasia "AZ Pet Shop".
- Todo produto vinculado ao canal continua aparecendo. Sem preço → "Consultar preço no WhatsApp". Sem estoque → "Esgotado" + mesmo botão de consulta.
- Mudanças no core são **opt-in por `clientConfig.retail`**: apps sem `retail` renderizam exatamente como hoje (testes existentes do core devem continuar passando sem alteração).
- Copy em português com acentuação correta. Nada de números, avaliações, prazos ou benefícios que a empresa não cumpra comprovadamente (risco de "deturpação" no Merchant Center).
- O fluxo de cotação por WhatsApp (`/cotacao`) continua funcionando nesta fase; ele só é substituído na fase 2.
- **Deploy de produção da fase 1 acontece junto com a fase 2**, porque as políticas de pagamento e entrega descrevem o checkout da fase 2. Commits na `main` são ok; promover para produção não.
- Testes: `pnpm --filter @mypet/core test` e `pnpm --filter azpetshop test`; build: `pnpm --filter azpetshop build`.

## Pré-requisito: dados a pedir ao usuário antes da Task 3

O implementador **não inventa** estes valores; pede ao usuário e usa exatamente o que ele informar:

1. Razão social
2. CNPJ
3. Endereço completo (logradouro, número, complemento, bairro, cidade, UF, CEP)
4. E-mail de atendimento
5. Telefone/WhatsApp de atendimento (com DDD)
6. Horário de atendimento
7. Confirmação de quais afirmações da home são reais (ver Task 6): "Clube AZ / 10% em ração", "Linha natural pet direto da fábrica", "boleto", "mesmo dia na capital".

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `packages/core/src/retail.ts` (novo) | Tipo `RetailConfig` e cálculo/rótulo de parcelamento |
| `packages/core/src/retail.test.ts` (novo) | Testes do parcelamento |
| `packages/core/src/theme.tsx` | `ClientConfig.retail?: RetailConfig` |
| `packages/core/package.json` | export `./retail` |
| `packages/core/src/catalog.ts`, `catalog-utils.ts` | `stock_qty` no select do catálogo → `CatalogProduct.stockQty` |
| `packages/core/src/components/retail-buy-action.tsx` (novo) | Bloco preço + parcelamento + "Comprar"/"Consultar" do modo varejo |
| `packages/core/src/components/retail-buy-action.test.tsx` (novo) | Testes do bloco |
| `packages/core/src/components/add-to-cart-control.tsx` | prop opcional `label` |
| `packages/core/src/components/product-card.tsx`, `product-variant-panel.tsx` | usam `RetailBuyAction` quando `retail` existe |
| `packages/core/src/seo.ts` | `organizationJsonLd` aceita dados legais opcionais |
| `apps/azpetshop/lib/empresa.ts` (novo) | Dados da empresa + regra de parcelamento |
| `apps/azpetshop/lib/empresa.test.ts` (novo) | Sanidade dos dados (CNPJ válido etc.) |
| `apps/azpetshop/client.config.ts` | liga `retail` |
| `apps/azpetshop/app/site-footer.tsx` (novo) + teste | Rodapé com empresa, políticas e pagamento |
| `apps/azpetshop/app/layout.tsx` | rodapé global + JSON-LD com dados legais |
| `apps/azpetshop/lib/politicas.ts` (novo) + teste | Conteúdo das 4 políticas |
| `apps/azpetshop/app/politicas/[slug]/page.tsx` (novo) | Renderização das políticas |
| `apps/azpetshop/app/sitemap.ts` | inclui as políticas |
| `apps/azpetshop/app/page.tsx` | remove rodapé local e afirmações não verificáveis |

---

### Task 1: Parcelamento e `retail` no `ClientConfig` (core)

**Files:**
- Create: `packages/core/src/retail.ts`
- Create: `packages/core/src/retail.test.ts`
- Modify: `packages/core/src/theme.tsx:27-37`
- Modify: `packages/core/package.json` (bloco `exports`)

**Interfaces:**
- Produces:
  - `type RetailConfig = { installments: { max: number; minInstallment: number }; consultWhatsApp: string }`
  - `installmentPlan(price: number, cfg: RetailConfig["installments"]): { count: number; value: number } | null`
  - `installmentLabel(price: number | null, cfg: RetailConfig["installments"]): string | null` → ex.: `"ou até 3x de R$ 33,33 sem juros"`
  - `ClientConfig.retail?: RetailConfig`

- [ ] **Step 1: Write the failing test** — `packages/core/src/retail.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { formatBRL } from "./catalog-utils";
import { installmentLabel, installmentPlan } from "./retail";

const cfg = { max: 6, minInstallment: 30 };

describe("installmentPlan", () => {
  it("divide no maior número de parcelas que respeita a parcela mínima", () => {
    expect(installmentPlan(100, cfg)).toEqual({ count: 3, value: 33.33 });
  });

  it("limita ao máximo de parcelas", () => {
    expect(installmentPlan(1000, cfg)).toEqual({ count: 6, value: 166.67 });
  });

  it("retorna null quando não cabe nem 2 parcelas", () => {
    expect(installmentPlan(50, cfg)).toBeNull();
  });

  it("retorna null para preço inválido", () => {
    expect(installmentPlan(0, cfg)).toBeNull();
    expect(installmentPlan(Number.NaN, cfg)).toBeNull();
  });
});

describe("installmentLabel", () => {
  it("formata em reais", () => {
    expect(installmentLabel(100, cfg)).toBe(`ou até 3x de ${formatBRL(33.33)} sem juros`);
  });

  it("retorna null sem preço ou sem parcelamento possível", () => {
    expect(installmentLabel(null, cfg)).toBeNull();
    expect(installmentLabel(50, cfg)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/retail.test.ts`
Expected: FAIL — `Failed to resolve import "./retail"`.

- [ ] **Step 3: Write minimal implementation** — `packages/core/src/retail.ts`

```ts
import { formatBRL } from "./catalog-utils";

export type RetailConfig = {
  /** Parcelamento sem juros exibido em card/PDP: até `max` parcelas, nenhuma abaixo de `minInstallment` (R$). */
  installments: { max: number; minInstallment: number };
  /** Número (só dígitos, com DDI) para "Consultar preço" / produto esgotado. */
  consultWhatsApp: string;
};

export function installmentPlan(
  price: number,
  cfg: RetailConfig["installments"],
): { count: number; value: number } | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const count = Math.min(cfg.max, Math.floor(price / cfg.minInstallment));
  if (count < 2) return null;
  return { count, value: Math.round((price / count) * 100) / 100 };
}

export function installmentLabel(price: number | null, cfg: RetailConfig["installments"]): string | null {
  if (price === null) return null;
  const plan = installmentPlan(price, cfg);
  if (!plan) return null;
  return `ou até ${plan.count}x de ${formatBRL(plan.value)} sem juros`;
}
```

O teste usa `formatBRL` na expectativa porque `Intl.NumberFormat` separa "R$" do valor com espaço não separável.

- [ ] **Step 4: `retail` no `ClientConfig`** — em `packages/core/src/theme.tsx`, adicione o import e o campo:

```ts
import type { RetailConfig } from "./retail";
```

```ts
  /** Rótulo acima do preço na página de produto. Padrão: "Atacado B2B". */
  priceEyebrow?: string;
  /** Varejo com checkout (azpetshop): parcelamento e ação de compra/consulta. Ausente = comportamento atual. */
  retail?: RetailConfig;
};
```

E em `packages/core/package.json`, no bloco `exports`, logo após `"./querystring"`:

```json
    "./retail": "./src/retail.ts",
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @mypet/core test`
Expected: PASS (todos, inclusive os novos).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/retail.ts packages/core/src/retail.test.ts packages/core/src/theme.tsx packages/core/package.json
git commit -m "feat(core): parcelamento e bloco retail opcional no ClientConfig"
```

---

### Task 2: `RetailBuyAction` e estoque no card (core)

**Files:**
- Modify: `packages/core/src/catalog.ts:23-24` (`CATALOG_SELECT`)
- Modify: `packages/core/src/catalog-utils.ts:34-58` (`RawProductRow`, `CatalogProduct`) e `:159-172` (`mapProduct`)
- Modify: `packages/core/src/components/add-to-cart-control.tsx`
- Create: `packages/core/src/components/retail-buy-action.tsx`
- Create: `packages/core/src/components/retail-buy-action.test.tsx`
- Modify: `packages/core/src/components/product-card.tsx:84-127`
- Modify: `packages/core/src/components/product-variant-panel.tsx:12-23` e `:155-185`

**Interfaces:**
- Consumes: `RetailConfig`, `installmentLabel` (Task 1); `buildWhatsAppLink`, `buildProductInterestMessage` de `../whatsapp`.
- Produces:
  - `CatalogProduct.stockQty?: number | null`
  - `PdpProduct.stockQty?: number | null`
  - `AddToCartControl` prop `label?: string` (default `"+Adicionar"`)
  - `<RetailBuyAction retail={RetailConfig} product={Omit<CartItem,"qty">} salePrice={number|null} priceLabel={string|null} inStock={boolean|undefined} size="card"|"pdp" />`

- [ ] **Step 1: Write the failing test** — `packages/core/src/components/retail-buy-action.test.tsx`

```tsx
// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CartProvider } from "./cart-provider";
import { ClientConfigProvider, type ClientConfig } from "../theme";
import { RetailBuyAction } from "./retail-buy-action";

const retail = { installments: { max: 6, minInstallment: 30 }, consultWhatsApp: "5511999990000" };
const config: ClientConfig = {
  name: "Teste", tagline: "t", domain: "t.com", catalogChannel: "azpetshop", logo: { emoji: "🐾" },
  features: { commerce: "cart" }, retail,
  palette: {
    pink: "#0a5", pinkDark: "#084", pinkLight: "#efe", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};
const item = { id: "p1", name: "Shampoo Neutro", sku: "S-1", brand: null, img: "/s.jpg", unitPrice: 100 };

function renderAction(props: { salePrice: number | null; priceLabel: string | null; inStock?: boolean }) {
  return render(
    createElement(ClientConfigProvider, { config },
      createElement(CartProvider, null,
        createElement(RetailBuyAction, { retail, product: item, size: "pdp", ...props }))),
  );
}

afterEach(() => cleanup());

describe("RetailBuyAction", () => {
  it("com preço e estoque: mostra preço, parcelamento e botão Comprar", () => {
    renderAction({ salePrice: 100, priceLabel: "R$ 100,00", inStock: true });
    expect(screen.getByText("R$ 100,00")).toBeInTheDocument(); // priceLabel vem pronto da prop
    expect(screen.getByText(/ou até 3x de/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar ao carrinho" })).toHaveTextContent("Comprar");
  });

  it("estoque desconhecido (undefined) conta como disponível", () => {
    renderAction({ salePrice: 100, priceLabel: "R$ 100,00" });
    expect(screen.getByRole("button", { name: "Adicionar ao carrinho" })).toBeInTheDocument();
  });

  it("sem preço: link Consultar preço no WhatsApp com o nome do produto", () => {
    renderAction({ salePrice: null, priceLabel: null, inStock: true });
    const link = screen.getByRole("link", { name: "Consultar preço no WhatsApp" });
    expect(link).toHaveAttribute("href", expect.stringContaining("https://wa.me/5511999990000"));
    expect(link.getAttribute("href")).toContain(encodeURIComponent("Shampoo Neutro"));
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).toBeNull();
  });

  it("sem estoque: Esgotado + consulta, sem botão de compra", () => {
    renderAction({ salePrice: 100, priceLabel: "R$ 100,00", inStock: false });
    expect(screen.getByText("Esgotado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Consultar no WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/components/retail-buy-action.test.tsx`
Expected: FAIL — `Failed to resolve import "./retail-buy-action"`.

- [ ] **Step 3: `label` no `AddToCartControl`** — em `packages/core/src/components/add-to-cart-control.tsx`, adicione a prop e use-a no texto não-compacto:

```tsx
export function AddToCartControl({
  product,
  compact = false,
  minQty = 1,
  label = "+Adicionar",
}: {
  product: Omit<CartItem, "qty">;
  compact?: boolean;
  /** Quantidade mínima (ex: `min_quantity` da oferta) — piso do decremento e valor inicial. Default 1. */
  minQty?: number;
  /** Texto do botão no modo não compacto. */
  label?: string;
}) {
```

```tsx
        {added ? "✓" : compact ? "🛒" : label}
```

- [ ] **Step 4: Implementar** — `packages/core/src/components/retail-buy-action.tsx`

```tsx
"use client";

import { useClientConfig } from "../theme";
import { installmentLabel, type RetailConfig } from "../retail";
import { buildProductInterestMessage, buildWhatsAppLink } from "../whatsapp";
import { AddToCartControl } from "./add-to-cart-control";
import type { CartItem } from "../cart";

/** Preço + parcelamento + ação do modo varejo: "Comprar" ou consulta no WhatsApp (sem preço / esgotado). */
export function RetailBuyAction({
  retail,
  product,
  salePrice,
  priceLabel,
  inStock,
  size,
}: {
  retail: RetailConfig;
  product: Omit<CartItem, "qty">;
  salePrice: number | null;
  priceLabel: string | null;
  /** `undefined` = estoque não informado; tratado como disponível. */
  inStock?: boolean;
  size: "card" | "pdp";
}) {
  const { palette } = useClientConfig();
  const pdp = size === "pdp";
  const soldOut = inStock === false;
  const hasPrice = salePrice !== null;
  const installments = hasPrice && !soldOut ? installmentLabel(salePrice, retail.installments) : null;
  const consultHref = buildWhatsAppLink(retail.consultWhatsApp, buildProductInterestMessage(product.name));

  return (
    <div style={{ marginBottom: pdp ? 4 : 0 }}>
      {hasPrice && (
        <div style={{ fontSize: pdp ? 26 : 18, fontWeight: 900, color: pdp ? palette.pink : palette.navy }}>
          {priceLabel}
        </div>
      )}
      {installments && (
        <div style={{ fontSize: pdp ? 14 : 12, color: palette.gray600, fontWeight: 600, marginTop: 2 }}>
          {installments}
        </div>
      )}
      {soldOut && (
        <div style={{ fontSize: pdp ? 14 : 12, color: palette.gray600, fontWeight: 800, marginTop: 4 }}>
          Esgotado
        </div>
      )}
      {hasPrice && !soldOut ? (
        <div style={{ marginTop: pdp ? 16 : 8 }}>
          <AddToCartControl product={product} compact={!pdp} label="Comprar" />
        </div>
      ) : (
        <a
          href={consultHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: pdp ? 44 : 36,
            marginTop: pdp ? 16 : 8,
            border: `1.5px solid ${palette.green}`,
            borderRadius: 10,
            color: palette.green,
            fontSize: pdp ? 15 : 13,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          {hasPrice ? "Consultar no WhatsApp" : "Consultar preço no WhatsApp"}
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @mypet/core exec vitest run src/components/retail-buy-action.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 6: Estoque no catálogo** — em `packages/core/src/catalog.ts:23-24`, inclua `stock_qty` no select:

```ts
export const CATALOG_SELECT =
  "id, name, reference, brand, category_id, stock_qty, categories(id, name, slug), product_assets(url, type), product_badges(code, label, kind, priority, starts_at, ends_at), product_channel_prices(channel, sale_price, sale_updated_at)";
```

Em `packages/core/src/catalog-utils.ts`, adicione `stock_qty?: number | null;` ao fim de `RawProductRow`, `stockQty?: number | null;` ao fim de `CatalogProduct` (com comentário `/** Ausente quando a consulta não trouxe estoque. */`), e em `mapProduct` acrescente ao objeto retornado, após `priceLabel`:

```ts
    ...(row.stock_qty !== undefined ? { stockQty: row.stock_qty } : {}),
```

O spread condicional mantém intactos os testes atuais de `mapProduct` que comparam com `toEqual` sem `stockQty`.

- [ ] **Step 7: Usar no `ProductCard`** — em `packages/core/src/components/product-card.tsx`, importe `RetailBuyAction` e troque `const { palette, features } = useClientConfig();` por `const { palette, features, retail } = useClientConfig();`. Logo no início do `<div style={{ padding: masonry ? "0 4px 4px" : "0 12px 12px" }}>`, antes do bloco de preço atual, curto-circuite o modo varejo envolvendo o conteúdo existente:

```tsx
      <div style={{ padding: masonry ? "0 4px 4px" : "0 12px 12px" }}>
        {retail && !product.hasVariants ? (
          <RetailBuyAction
            retail={retail}
            size="card"
            product={{ id: product.id, name: product.name, sku: product.sku, brand: product.brand, img: product.img, unitPrice: product.salePrice ?? undefined }}
            salePrice={product.salePrice}
            priceLabel={product.priceLabel}
            inStock={product.stockQty == null ? undefined : product.stockQty > 0}
          />
        ) : (
          <>
            {/* bloco de preço + IIFE de controles existentes, sem alteração */}
          </>
        )}
      </div>
```

Mova para dentro do fragmento `<>…</>` exatamente o JSX que hoje está entre `{showsListPrice(features) ? (` e o fim da IIFE `})()}` — não altere esse trecho. Produto com variações continua no caminho atual (que leva a "Ver opções"/PDP).

- [ ] **Step 8: Usar no `ProductVariantPanel`** — em `packages/core/src/components/product-variant-panel.tsx`:
  - Adicione `stockQty?: number | null;` ao fim de `PdpProduct`.
  - Importe `RetailBuyAction` e troque `const { palette: PALETTE, features, priceEyebrow } = useClientConfig();` por `const { palette: PALETTE, features, priceEyebrow, retail } = useClientConfig();`.
  - Dentro do cartão branco (o `<div style={{ background: PALETTE.white, … }}>`), substitua o conteúdo por:

```tsx
              {retail ? (
                <RetailBuyAction
                  retail={retail}
                  size="pdp"
                  product={{ id: cartId, name: cartName, sku, brand: product.brand, img, unitPrice }}
                  salePrice={unitPrice ?? null}
                  priceLabel={priceLabel ?? null}
                  inStock={product.stockQty == null ? undefined : product.stockQty > 0}
                />
              ) : (
                <>
                  {/* bloco showsListPrice ? … : … e <AddToCartControl …/> existentes, sem alteração */}
                </>
              )}
```

Mova para o fragmento o JSX atual de `{showsListPrice(features) ? (` até `<AddToCartControl product={{ id: cartId, … }} />`, sem alterar.

- [ ] **Step 9: Teste de regressão do card com `retail`** — acrescente ao fim de `packages/core/src/components/product-card-controls.test.tsx`:

```tsx
describe("ProductCard — modo varejo (retail)", () => {
  const retailConfig: ClientConfig = {
    ...config,
    features: { commerce: "cart" },
    retail: { installments: { max: 6, minInstallment: 30 }, consultWhatsApp: "5511999990000" },
  };

  it("produto sem preço mostra consulta no WhatsApp em vez do carrinho", () => {
    render(createElement(ClientConfigProvider, { config: retailConfig },
      createElement(CartProvider, null,
        createElement(ProductCard, { product: { ...product, salePrice: null, priceLabel: null } }))));
    expect(screen.getByRole("link", { name: "Consultar preço no WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).toBeNull();
  });

  it("produto esgotado mostra Esgotado", () => {
    render(createElement(ClientConfigProvider, { config: retailConfig },
      createElement(CartProvider, null,
        createElement(ProductCard, { product: { ...product, stockQty: 0 } }))));
    expect(screen.getByText("Esgotado")).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run tests**

Run: `pnpm --filter @mypet/core test`
Expected: PASS (todos; os testes antigos de `ProductCard`/`ProductVariantPanel` sem `retail` passam sem mudança).

- [ ] **Step 11: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): RetailBuyAction com parcelamento, Comprar e consulta no WhatsApp (opt-in por retail)"
```

---

### Task 3: Dados da empresa, `retail` ligado e JSON-LD legal (app + core)

**Pré-requisito:** valores 1–6 da seção "Pré-requisito" fornecidos pelo usuário.

**Files:**
- Create: `apps/azpetshop/lib/empresa.ts`
- Create: `apps/azpetshop/lib/empresa.test.ts`
- Modify: `apps/azpetshop/client.config.ts`
- Modify: `packages/core/src/seo.ts:110-118`
- Modify: `packages/core/src/seo.test.ts` (bloco `organizationJsonLd`)
- Modify: `apps/azpetshop/app/layout.tsx`

**Interfaces:**
- Consumes: `RetailConfig` (Task 1), `isValidCnpj`, `formatCnpj` de `@mypet/core/br-validation`.
- Produces:
  - `EMPRESA: Empresa` com `razaoSocial`, `nomeFantasia`, `cnpj` (só dígitos), `endereco: { logradouro, numero, complemento, bairro, cidade, uf, cep }`, `email`, `whatsapp` (só dígitos com 55), `horario`
  - `enderecoEmLinha(e: Empresa["endereco"]): string`
  - `RETAIL: RetailConfig`
  - `organizationJsonLd(config, legal?: OrganizationLegal)` com `type OrganizationLegal = { legalName: string; taxID: string; email: string; telephone: string; address: { streetAddress: string; addressLocality: string; addressRegion: string; postalCode: string } }`

- [ ] **Step 1: Write the failing test** — `apps/azpetshop/lib/empresa.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { isValidCnpj } from "@mypet/core/br-validation";
import { EMPRESA, RETAIL, enderecoEmLinha } from "./empresa";

describe("EMPRESA", () => {
  it("tem CNPJ válido e só com dígitos", () => {
    expect(EMPRESA.cnpj).toMatch(/^\d{14}$/);
    expect(isValidCnpj(EMPRESA.cnpj)).toBe(true);
  });

  it("tem WhatsApp com DDI 55 e e-mail", () => {
    expect(EMPRESA.whatsapp).toMatch(/^55\d{10,11}$/);
    expect(EMPRESA.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });

  it("tem CEP com 8 dígitos e UF com 2 letras", () => {
    expect(EMPRESA.endereco.cep).toMatch(/^\d{8}$/);
    expect(EMPRESA.endereco.uf).toMatch(/^[A-Z]{2}$/);
  });

  it("monta o endereço em uma linha", () => {
    const linha = enderecoEmLinha(EMPRESA.endereco);
    expect(linha).toContain(EMPRESA.endereco.cidade);
    expect(linha).toContain(`${EMPRESA.endereco.cep.slice(0, 5)}-${EMPRESA.endereco.cep.slice(5)}`);
  });

  it("RETAIL consulta pelo WhatsApp da empresa", () => {
    expect(RETAIL.consultWhatsApp).toBe(EMPRESA.whatsapp);
    expect(RETAIL.installments.max).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter azpetshop exec vitest run lib/empresa.test.ts`
Expected: FAIL — `Failed to resolve import "./empresa"`.

- [ ] **Step 3: Implementar** — `apps/azpetshop/lib/empresa.ts` (substitua cada `<…>` pelo valor exato informado pelo usuário; nenhum `<` pode sobrar no arquivo)

```ts
import type { RetailConfig } from "@mypet/core/retail";

export type Empresa = {
  razaoSocial: string;
  nomeFantasia: string;
  /** Só dígitos. */
  cnpj: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
    /** Só dígitos. */
    cep: string;
  };
  email: string;
  /** Só dígitos, com DDI 55. */
  whatsapp: string;
  horario: string;
};

// Vendedor oficial da loja (mesmo CNPJ da My Pet / Grupo AZ). Fonte única para rodapé,
// políticas e JSON-LD — o Merchant Center confere estes dados contra a conta.
export const EMPRESA: Empresa = {
  razaoSocial: "<razão social>",
  nomeFantasia: "AZ Pet Shop",
  cnpj: "<cnpj só dígitos>",
  endereco: {
    logradouro: "<logradouro>",
    numero: "<número>",
    complemento: "<complemento ou string vazia>",
    bairro: "<bairro>",
    cidade: "<cidade>",
    uf: "<UF>",
    cep: "<cep só dígitos>",
  },
  email: "<e-mail>",
  whatsapp: "<55 + DDD + número>",
  horario: "<horário de atendimento>",
};

export function enderecoEmLinha(e: Empresa["endereco"]): string {
  const rua = [e.logradouro, e.numero, e.complemento].filter(Boolean).join(", ");
  return `${rua} — ${e.bairro}, ${e.cidade}/${e.uf} — CEP ${e.cep.slice(0, 5)}-${e.cep.slice(5)}`;
}

export const RETAIL: RetailConfig = {
  installments: { max: 6, minInstallment: 30 },
  consultWhatsApp: EMPRESA.whatsapp,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter azpetshop exec vitest run lib/empresa.test.ts`
Expected: PASS (5 testes). Se o CNPJ falhar, confirme o número com o usuário — não "corrija" dígitos.

- [ ] **Step 5: Ligar `retail`** — em `apps/azpetshop/client.config.ts`, importe `import { RETAIL } from "@/lib/empresa";` e adicione `retail: RETAIL,` após `features: SITES.azpetshop.features,`.

- [ ] **Step 6: Teste do JSON-LD legal (core)** — em `packages/core/src/seo.test.ts`, dentro de `describe("organizationJsonLd", …)`, acrescente:

```ts
  it("inclui dados legais quando informados", () => {
    const config = { name: "AZ Pet Shop", domain: "www.azpetshop.com.br" } as ClientConfig;
    const ld = organizationJsonLd(config, {
      legalName: "Empresa Ltda",
      taxID: "11222333000181",
      email: "contato@x.com",
      telephone: "+5511999990000",
      address: { streetAddress: "Rua A, 1", addressLocality: "São Paulo", addressRegion: "SP", postalCode: "01000-000" },
    });
    expect(ld).toMatchObject({
      legalName: "Empresa Ltda",
      taxID: "11222333000181",
      email: "contato@x.com",
      telephone: "+5511999990000",
      address: { "@type": "PostalAddress", addressCountry: "BR", addressLocality: "São Paulo" },
    });
  });
```

Run: `pnpm --filter @mypet/core exec vitest run src/seo.test.ts`
Expected: FAIL — `legalName` ausente.

- [ ] **Step 7: Implementar no core** — em `packages/core/src/seo.ts`, substitua `organizationJsonLd`:

```ts
export type OrganizationLegal = {
  legalName: string;
  taxID: string;
  email: string;
  telephone: string;
  address: { streetAddress: string; addressLocality: string; addressRegion: string; postalCode: string };
};

export function organizationJsonLd(config: ClientConfig, legal?: OrganizationLegal) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.name,
    url: canonicalUrl(config.domain, ""),
    logo: canonicalUrl(config.domain, "/opengraph-image"),
    ...(legal
      ? {
          legalName: legal.legalName,
          taxID: legal.taxID,
          email: legal.email,
          telephone: legal.telephone,
          address: { "@type": "PostalAddress", addressCountry: "BR", ...legal.address },
        }
      : {}),
  };
}
```

Run: `pnpm --filter @mypet/core exec vitest run src/seo.test.ts`
Expected: PASS (o teste antigo sem `legal` continua com `toEqual` igual).

- [ ] **Step 8: Usar no layout** — em `apps/azpetshop/app/layout.tsx`, importe `import { EMPRESA } from "@/lib/empresa";` e troque `organizationJsonLd(clientConfig)` por:

```tsx
organizationJsonLd(clientConfig, {
  legalName: EMPRESA.razaoSocial,
  taxID: EMPRESA.cnpj,
  email: EMPRESA.email,
  telephone: `+${EMPRESA.whatsapp}`,
  address: {
    streetAddress: [EMPRESA.endereco.logradouro, EMPRESA.endereco.numero, EMPRESA.endereco.complemento].filter(Boolean).join(", "),
    addressLocality: EMPRESA.endereco.cidade,
    addressRegion: EMPRESA.endereco.uf,
    postalCode: `${EMPRESA.endereco.cep.slice(0, 5)}-${EMPRESA.endereco.cep.slice(5)}`,
  },
})
```

Atualize também a `description` do `metadata` para: `"Loja online de produtos para cães, gatos e outros pets. Pix ou cartão parcelado, entrega para todo o Brasil."`

- [ ] **Step 9: Run tests**

Run: `pnpm --filter @mypet/core test && pnpm --filter azpetshop test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/azpetshop/lib/empresa.ts apps/azpetshop/lib/empresa.test.ts apps/azpetshop/client.config.ts apps/azpetshop/app/layout.tsx packages/core/src/seo.ts packages/core/src/seo.test.ts
git commit -m "feat(azpetshop): dados da empresa, parcelamento ligado e Organization com dados legais"
```

---

### Task 4: Conteúdo e páginas das políticas

**Files:**
- Create: `apps/azpetshop/lib/politicas.ts`
- Create: `apps/azpetshop/lib/politicas.test.ts`
- Create: `apps/azpetshop/app/politicas/[slug]/page.tsx`
- Modify: `apps/azpetshop/app/sitemap.ts`

**Interfaces:**
- Consumes: `EMPRESA`, `enderecoEmLinha` (Task 3); `formatCnpj` de `@mypet/core/br-validation`; `canonicalUrl` de `@mypet/core/seo`.
- Produces:
  - `type Politica = { slug: PoliticaSlug; titulo: string; resumo: string; secoes: { titulo: string; paragrafos: string[] }[] }`
  - `type PoliticaSlug = "troca-e-devolucao" | "privacidade" | "entrega" | "pagamento"`
  - `POLITICAS: Politica[]` (nesta ordem) e `getPolitica(slug: string): Politica | undefined`

- [ ] **Step 1: Write the failing test** — `apps/azpetshop/lib/politicas.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { EMPRESA } from "./empresa";
import { POLITICAS, getPolitica } from "./politicas";

describe("POLITICAS", () => {
  it("tem as 4 políticas exigidas, nesta ordem", () => {
    expect(POLITICAS.map((p) => p.slug)).toEqual(["troca-e-devolucao", "privacidade", "entrega", "pagamento"]);
  });

  it("toda política tem título, resumo e seções com texto", () => {
    for (const p of POLITICAS) {
      expect(p.titulo.length).toBeGreaterThan(5);
      expect(p.resumo.length).toBeGreaterThan(20);
      expect(p.secoes.length).toBeGreaterThan(0);
      for (const s of p.secoes) expect(s.paragrafos.join("").length).toBeGreaterThan(20);
    }
  });

  it("troca e devolução cita o prazo de 7 dias do CDC", () => {
    expect(JSON.stringify(getPolitica("troca-e-devolucao"))).toContain("7 (sete) dias");
  });

  it("privacidade identifica o controlador pelo CNPJ e cita a LGPD", () => {
    const texto = JSON.stringify(getPolitica("privacidade"));
    expect(texto).toContain(EMPRESA.razaoSocial);
    expect(texto).toContain("13.709/2018");
  });

  it("getPolitica devolve undefined para slug desconhecido", () => {
    expect(getPolitica("nao-existe")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter azpetshop exec vitest run lib/politicas.test.ts`
Expected: FAIL — `Failed to resolve import "./politicas"`.

- [ ] **Step 3: Implementar** — `apps/azpetshop/lib/politicas.ts`

```ts
import { formatCnpj } from "@mypet/core/br-validation";
import { EMPRESA, enderecoEmLinha } from "./empresa";

export type PoliticaSlug = "troca-e-devolucao" | "privacidade" | "entrega" | "pagamento";

export type Politica = {
  slug: PoliticaSlug;
  titulo: string;
  resumo: string;
  secoes: { titulo: string; paragrafos: string[] }[];
};

const empresa = `${EMPRESA.razaoSocial}, CNPJ ${formatCnpj(EMPRESA.cnpj)}, com sede em ${enderecoEmLinha(EMPRESA.endereco)}`;
const contato = `pelo e-mail ${EMPRESA.email} ou pelo WhatsApp da loja (${EMPRESA.horario})`;

// Rascunho para revisão jurídica do usuário antes do deploy de produção.
export const POLITICAS: Politica[] = [
  {
    slug: "troca-e-devolucao",
    titulo: "Trocas e devoluções",
    resumo: "Como desistir de uma compra, trocar um produto ou devolver um item com defeito.",
    secoes: [
      {
        titulo: "Direito de arrependimento",
        paragrafos: [
          "Você pode desistir da compra em até 7 (sete) dias corridos contados do recebimento do pedido, sem precisar justificar, conforme o artigo 49 do Código de Defesa do Consumidor.",
          "O produto deve ser devolvido com todos os acessórios e, sempre que possível, na embalagem original. Após recebermos e conferirmos o item, devolvemos o valor integral pago, incluindo o frete de envio.",
        ],
      },
      {
        titulo: "Produto com defeito ou avaria",
        paragrafos: [
          "Se o produto chegar com defeito, avaria ou diferente do pedido, avise em até 30 (trinta) dias do recebimento. Enviamos as instruções de devolução sem custo para você e, após a conferência, trocamos o item ou devolvemos o valor, como você preferir.",
        ],
      },
      {
        titulo: "Como solicitar",
        paragrafos: [
          `Entre em contato ${contato}, informando o número do pedido e o motivo. Respondemos com as instruções e o código de postagem.`,
          "O reembolso é feito pelo mesmo meio de pagamento: Pix devolvido na conta de origem em até 5 dias úteis após a conferência; no cartão, o estorno aparece na fatura conforme o prazo da operadora.",
        ],
      },
    ],
  },
  {
    slug: "privacidade",
    titulo: "Política de privacidade",
    resumo: "Quais dados coletamos, para que usamos e como você exerce seus direitos pela LGPD.",
    secoes: [
      {
        titulo: "Quem trata seus dados",
        paragrafos: [
          `A controladora dos dados pessoais coletados nesta loja é ${empresa}, que opera a marca ${EMPRESA.nomeFantasia}.`,
        ],
      },
      {
        titulo: "Dados coletados e finalidade",
        paragrafos: [
          "No pedido coletamos nome, CPF, e-mail, telefone/WhatsApp e endereço de entrega, usados para processar o pagamento, emitir a nota fiscal, entregar o pedido e falar com você sobre ele.",
          "Os dados de cartão são digitados diretamente no ambiente do nosso processador de pagamentos e não ficam armazenados na loja.",
          "Usamos cookies e ferramentas de análise (como o Google Analytics) para medir o uso do site e melhorar a experiência.",
        ],
      },
      {
        titulo: "Compartilhamento",
        paragrafos: [
          "Compartilhamos apenas o necessário com o processador de pagamentos, a plataforma de frete e as transportadoras, e com autoridades quando a lei exigir. Não vendemos seus dados.",
        ],
      },
      {
        titulo: "Seus direitos",
        paragrafos: [
          `Pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018) você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, ${contato}. Dados exigidos por obrigação legal ou fiscal são mantidos pelo prazo que a lei determina.`,
        ],
      },
    ],
  },
  {
    slug: "entrega",
    titulo: "Política de entrega",
    resumo: "Para onde entregamos, como o frete é calculado e como acompanhar o pedido.",
    secoes: [
      {
        titulo: "Área de entrega",
        paragrafos: ["Entregamos em todo o Brasil, por Correios e transportadoras parceiras."],
      },
      {
        titulo: "Frete e prazo",
        paragrafos: [
          "O valor do frete e o prazo de entrega são calculados pelo CEP no checkout, antes do pagamento, e você escolhe a opção que preferir.",
          "O prazo começa a contar a partir da confirmação do pagamento. Pagamentos por Pix costumam ser confirmados em minutos; por cartão, após a aprovação da operadora.",
        ],
      },
      {
        titulo: "Rastreio",
        paragrafos: [
          "Quando o pedido é despachado, enviamos o código de rastreio por e-mail e WhatsApp. Ele também aparece na página do seu pedido.",
        ],
      },
      {
        titulo: "Problemas na entrega",
        paragrafos: [
          `Se o pedido atrasar, for extraviado ou chegar danificado, fale com a gente ${contato}. Resolvemos com a transportadora e, se necessário, reenviamos o produto ou devolvemos o valor.`,
        ],
      },
    ],
  },
  {
    slug: "pagamento",
    titulo: "Formas de pagamento",
    resumo: "Pix e cartão de crédito em ambiente seguro, com parcelamento sem juros.",
    secoes: [
      {
        titulo: "Meios aceitos",
        paragrafos: [
          "Aceitamos Pix e cartão de crédito. O pagamento é processado pelo Asaas, instituição de pagamento autorizada pelo Banco Central, em página segura.",
        ],
      },
      {
        titulo: "Parcelamento",
        paragrafos: [
          "No cartão, o parcelamento é sem juros. O número de parcelas disponível aparece na página de cada produto e no pagamento.",
        ],
      },
      {
        titulo: "Confirmação",
        paragrafos: [
          "O pedido é separado depois da confirmação do pagamento. O Pix gerado vale por tempo limitado; se não for pago, o pedido é cancelado automaticamente e nada é cobrado.",
        ],
      },
    ],
  },
];

export function getPolitica(slug: string): Politica | undefined {
  return POLITICAS.find((p) => p.slug === slug);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter azpetshop exec vitest run lib/politicas.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Página** — antes de escrever, confira em `node_modules/next/dist/docs/` a assinatura atual de `generateStaticParams` e de `params` como `Promise` (o app já usa `params: Promise<{ id: string }>` em `app/produtos/[id]/page.tsx`). Crie `apps/azpetshop/app/politicas/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { getCategories } from "@mypet/core/catalog";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { POLITICAS, getPolitica } from "@/lib/politicas";

const { palette: PALETTE } = clientConfig;

export function generateStaticParams() {
  return POLITICAS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const politica = getPolitica(slug);
  if (!politica) return { title: `Página não encontrada — ${clientConfig.name}` };
  return {
    title: `${politica.titulo} — ${clientConfig.name}`,
    description: politica.resumo,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/politicas/${politica.slug}`) },
  };
}

export default async function PoliticaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const politica = getPolitica(slug);
  if (!politica) notFound();
  const categories = await getCategories();

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <SiteNav categories={categories} audienceLabel={null} />
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ fontFamily: "var(--font-baloo)", fontSize: 32, fontWeight: 800, color: PALETTE.navy }}>
          {politica.titulo}
        </h1>
        <p style={{ marginTop: 8, fontSize: 16, color: PALETTE.gray600 }}>{politica.resumo}</p>
        {politica.secoes.map((secao) => (
          <section key={secao.titulo} style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>{secao.titulo}</h2>
            {secao.paragrafos.map((p) => (
              <p key={p} style={{ fontSize: 15, lineHeight: 1.65, color: PALETTE.gray600, marginTop: 8 }}>{p}</p>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Sitemap** — em `apps/azpetshop/app/sitemap.ts`, importe `import { POLITICAS } from "@/lib/politicas";` e acrescente ao array, após a home:

```ts
    ...POLITICAS.map((p) => ({
      url: `${base}/politicas/${p.slug}`,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
```

- [ ] **Step 7: Run tests and build**

Run: `pnpm --filter azpetshop test && pnpm --filter azpetshop build`
Expected: testes PASS; build conclui listando `/politicas/[slug]` com 4 páginas pré-geradas.

- [ ] **Step 8: Commit**

```bash
git add apps/azpetshop/lib/politicas.ts apps/azpetshop/lib/politicas.test.ts "apps/azpetshop/app/politicas" apps/azpetshop/app/sitemap.ts
git commit -m "feat(azpetshop): páginas de troca, privacidade, entrega e pagamento"
```

---

### Task 5: Rodapé global com empresa, políticas e pagamento

**Files:**
- Create: `apps/azpetshop/app/site-footer.tsx`
- Create: `apps/azpetshop/app/site-footer.test.tsx`
- Modify: `apps/azpetshop/app/layout.tsx`
- Modify: `apps/azpetshop/app/page.tsx:212-216` (remove o `<footer>` local) e o CSS `footer.site-footer` (linha ~183)

**Interfaces:**
- Consumes: `EMPRESA`, `enderecoEmLinha` (Task 3); `POLITICAS` (Task 4); `formatCnpj`, `formatWhatsapp` de `@mypet/core/br-validation`.
- Produces: `SiteFooter()` (server component, sem props).

- [ ] **Step 1: Write the failing test** — `apps/azpetshop/app/site-footer.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatCnpj } from "@mypet/core/br-validation";
import { EMPRESA } from "@/lib/empresa";
import { POLITICAS } from "@/lib/politicas";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("mostra razão social, CNPJ formatado, e-mail e endereço", () => {
    render(<SiteFooter />);
    expect(screen.getByText(new RegExp(EMPRESA.razaoSocial))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatCnpj(EMPRESA.cnpj).replace(/[./-]/g, "\\$&")))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: EMPRESA.email })).toHaveAttribute("href", `mailto:${EMPRESA.email}`);
    expect(screen.getByText(new RegExp(EMPRESA.endereco.cidade))).toBeInTheDocument();
  });

  it("linka as 4 políticas", () => {
    render(<SiteFooter />);
    for (const p of POLITICAS) {
      expect(screen.getByRole("link", { name: p.titulo })).toHaveAttribute("href", `/politicas/${p.slug}`);
    }
  });

  it("mostra as formas de pagamento", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/Pix/)).toBeInTheDocument();
    expect(screen.getByText(/cartão de crédito/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter azpetshop exec vitest run app/site-footer.test.tsx`
Expected: FAIL — `Failed to resolve import "./site-footer"`.

- [ ] **Step 3: Implementar** — `apps/azpetshop/app/site-footer.tsx`

```tsx
import Link from "next/link";
import { formatCnpj, formatWhatsapp } from "@mypet/core/br-validation";
import { clientConfig } from "@/client.config";
import { EMPRESA, enderecoEmLinha } from "@/lib/empresa";
import { POLITICAS } from "@/lib/politicas";

const { palette: PALETTE } = clientConfig;
const muted = "rgba(255,255,255,0.72)";

export function SiteFooter() {
  return (
    <footer style={{ background: PALETTE.navy, color: PALETTE.white, borderRadius: "28px 28px 0 0", marginTop: 10 }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "36px 24px 24px",
          display: "grid",
          gap: 28,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div>
          <b style={{ fontFamily: "var(--font-baloo)", fontSize: 20 }}>{EMPRESA.nomeFantasia}</b>
          <p style={{ color: muted, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            {EMPRESA.razaoSocial}
            <br />
            CNPJ {formatCnpj(EMPRESA.cnpj)}
            <br />
            {enderecoEmLinha(EMPRESA.endereco)}
          </p>
        </div>
        <div>
          <b style={{ fontSize: 14 }}>Atendimento</b>
          <p style={{ color: muted, fontSize: 13, lineHeight: 1.8, marginTop: 8 }}>
            <a href={`mailto:${EMPRESA.email}`} style={{ color: PALETTE.white }}>{EMPRESA.email}</a>
            <br />
            WhatsApp {formatWhatsapp(EMPRESA.whatsapp)}
            <br />
            {EMPRESA.horario}
          </p>
        </div>
        <nav aria-label="Políticas da loja">
          <b style={{ fontSize: 14 }}>Políticas</b>
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", fontSize: 13, lineHeight: 1.9 }}>
            {POLITICAS.map((p) => (
              <li key={p.slug}>
                <Link href={`/politicas/${p.slug}`} style={{ color: muted }}>{p.titulo}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <b style={{ fontSize: 14 }}>Pagamento</b>
          <p style={{ color: muted, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            Pix e cartão de crédito em até {clientConfig.retail?.installments.max ?? 1}x sem juros, em ambiente seguro.
          </p>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", padding: "14px 24px", textAlign: "center" }}>
        <span style={{ color: muted, fontSize: 12 }}>
          © {new Date().getFullYear()} {EMPRESA.nomeFantasia}. Todos os direitos reservados.
        </span>
      </div>
    </footer>
  );
}
```

`formatWhatsapp` já descarta o DDI 55 e devolve `(11) 99999-0000`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter azpetshop exec vitest run app/site-footer.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Rodapé global** — em `apps/azpetshop/app/layout.tsx`, importe `import { SiteFooter } from "./site-footer";` e troque `<CartProvider>{children}</CartProvider>` por:

```tsx
          <CartProvider>
            {children}
            <SiteFooter />
          </CartProvider>
```

Em `apps/azpetshop/app/page.tsx`, apague o bloco `<footer className="site-footer" …>…</footer>` e a regra CSS `footer.site-footer { … }`.

- [ ] **Step 6: Run tests and build**

Run: `pnpm --filter azpetshop test && pnpm --filter azpetshop build`
Expected: PASS e build ok.

- [ ] **Step 7: Commit**

```bash
git add apps/azpetshop/app/site-footer.tsx apps/azpetshop/app/site-footer.test.tsx apps/azpetshop/app/layout.tsx apps/azpetshop/app/page.tsx
git commit -m "feat(azpetshop): rodapé global com dados da empresa, políticas e pagamento"
```

---

### Task 6: Copy da home sem afirmações não verificáveis

**Pré-requisito:** item 7 da seção "Pré-requisito" respondido pelo usuário.

**Files:**
- Modify: `apps/azpetshop/app/page.tsx` (funções `Hero`, `PromoStrip`, `TrustRow`)

**Interfaces:** nenhuma (só copy).

- [ ] **Step 1: Hero** — remova o bloco de estatísticas (`["+1.200", …], ["24h", …], ["4.8★", …]` e o `<div>` que o renderiza). No parágrafo do hero, troque a segunda frase por: `Escolha, coloque no carrinho e fale com a gente pelo WhatsApp, sem precisar criar conta.` (ajustada para o checkout na fase 2).

- [ ] **Step 2: PromoStrip** — para cada cartão cuja afirmação o usuário **não** confirmou como real, remova o cartão inteiro. Se sobrarem menos de 2 cartões, remova `<PromoStrip />` da página e a função.

- [ ] **Step 3: TrustRow** — substitua `items` por afirmações que a loja cumpre:

```tsx
  const items = [
    ["🚚", "Entrega para todo o Brasil", "Frete e prazo calculados pelo CEP antes de pagar."],
    ["💳", "Pagamento seguro", "Pix ou cartão de crédito parcelado sem juros."],
    ["💬", "Atendimento humano", "Tire dúvidas pelo WhatsApp com o nosso time."],
    ["🛡️", "7 dias para desistir", "Troca e devolução conforme o Código de Defesa do Consumidor."],
  ];
```

Se o usuário confirmou "mesmo dia na capital", mantenha essa frase no primeiro item.

- [ ] **Step 4: Verificar**

Run: `grep -nE "4\.8|\+1\.200|24h|boleto" apps/azpetshop/app/page.tsx`
Expected: nenhuma linha (salvo itens confirmados pelo usuário).

Run: `pnpm --filter azpetshop test && pnpm --filter azpetshop build`
Expected: PASS e build ok.

- [ ] **Step 5: Conferência visual** — `pnpm --filter azpetshop dev` (porta 4105). Conferir: home, um card sem preço (botão "Consultar preço no WhatsApp"), um card esgotado, uma PDP com preço (parcelamento + "Comprar"), `/politicas/troca-e-devolucao`, rodapé em todas as páginas, layout em largura de celular.

- [ ] **Step 6: Commit**

```bash
git add apps/azpetshop/app/page.tsx
git commit -m "fix(azpetshop): home sem afirmações não verificáveis (Merchant Center)"
```

---

## Verificação final da fase

- [ ] `pnpm test` (raiz) passa.
- [ ] `pnpm --filter azpetshop build` passa.
- [ ] Nenhum `<` de placeholder em `apps/azpetshop/lib/empresa.ts`: `grep -n "<" apps/azpetshop/lib/empresa.ts` sem resultados.
- [ ] Usuário revisou o texto das 4 políticas.
- [ ] Não promover para produção até a fase 2 estar pronta (ver Global Constraints).
- [ ] **Bloqueante para produção:** `apps/azpetshop/lib/empresa.ts` usa dados genéricos de exemplo (decisão do usuário em 2026-11-01); trocar pelos reais antes do deploy e do Merchant Center.
