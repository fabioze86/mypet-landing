# Reposicionamento da caixa de compra no PDP — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover preço + quantidade + botão "adicionar ao carrinho" para o lado da imagem do produto (acima da dobra) na página de produto (PDP), e substituir o seletor de variantes por uma tabela de preços quando o grupo de variação não tem `variant_axis` cadastrado.

**Architecture:** `packages/core/src/components/product-variant-panel.tsx` passa a renderizar sozinho as duas colunas "imagem | caixa de compra" (hoje esse conteúdo estava dividido entre o componente e o `page.tsx` de cada app). Um novo componente `VariantTable` cobre o caso de fallback (variação sem `variant_axis`). `apps/distribuidora` e `apps/mypet` compartilham o mesmo `page.tsx` (arquivos idênticos hoje) e recebem o mesmo ajuste de layout — descrição/especificações passam a ficar abaixo, em largura total.

**Tech Stack:** Next.js (App Router) 16.2.6, React 19.2.4, TypeScript, vitest 4 para testes de lógica pura em `packages/core`. Não há testes automatizados de componentes React neste repositório (sem RTL/jsdom instalado) — a verificação de UI é manual via servidor de dev, como já é o padrão hoje.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-08-18-pdp-buybox-layout-design.md`.
- A mudança é feita uma única vez em `packages/core` — vale automaticamente para `apps/distribuidora` e `apps/mypet` (mesmo componente compartilhado).
- Não alterar `catalog.ts` / `catalog-utils.ts` — os dados já trazem tudo que é necessário (`product.variants`, `axis`, `salePrice`, `priceLabel`).
- Não alterar `product-card-variant-cart.tsx` (card de listagem/catálogo) — fora de escopo.
- Imagem principal da tabela de fallback é fixa (não troca por linha) — decisão já validada no spec.
- Preço aparece em cada linha da tabela (não uma vez só acima).
- O rótulo de cada linha da tabela usa `variantLabel()` já existente (cai para `variant.name` quando `axis` está vazio) — não inventar numeração automática.
- Manter o breakpoint mobile existente (`max-width: 768px`) e a ordem de empilhamento: imagem → marca/nome/SKU → preço+quantidade+CTA (ou tabela) → descrição → especificações.

---

### Task 1: `hasAxisData` — decide chips vs. tabela

**Files:**
- Modify: `packages/core/src/components/variant-selector.tsx`
- Create: `packages/core/src/components/variant-selector.test.ts`

**Interfaces:**
- Produces: `hasAxisData(variants: ProductVariant[]): boolean` — `true` se pelo menos uma variante tiver `axis.length > 0`. Consumida pelo Task 3.
- Consome: `ProductVariant` de `../catalog-utils` (já existe, campo `axis: VariantAxisEntry[]`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `packages/core/src/components/variant-selector.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { variantLabel, hasAxisData } from "./variant-selector";
import type { ProductVariant } from "../catalog-utils";

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: "v1",
    name: "Vestido Chic Tule Rosa P",
    sku: "23988",
    barcode: null,
    img: "/img.jpg",
    axis: [],
    salePrice: 41.99,
    priceLabel: "R$ 41,99",
    ...overrides,
  };
}

describe("variantLabel", () => {
  it("usa o valor do eixo quando axis está preenchido", () => {
    const variant = makeVariant({ axis: [{ eixo: "Tamanho", valor: "M", ordem: 1 }] });
    expect(variantLabel(variant)).toBe("M");
  });

  it("cai para o nome do produto quando axis está vazio", () => {
    const variant = makeVariant({ axis: [] });
    expect(variantLabel(variant)).toBe("Vestido Chic Tule Rosa P");
  });
});

describe("hasAxisData", () => {
  it("retorna true quando pelo menos uma variante tem axis preenchido", () => {
    const variants = [
      makeVariant({ axis: [] }),
      makeVariant({ id: "v2", axis: [{ eixo: "Tamanho", valor: "G" }] }),
    ];
    expect(hasAxisData(variants)).toBe(true);
  });

  it("retorna false quando nenhuma variante tem axis preenchido", () => {
    const variants = [makeVariant({ axis: [] }), makeVariant({ id: "v2", axis: [] })];
    expect(hasAxisData(variants)).toBe(false);
  });

  it("retorna false para lista vazia", () => {
    expect(hasAxisData([])).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @mypet/core test`
Expected: FAIL — `variant-selector.test.ts` não compila / `hasAxisData` não é exportado por `./variant-selector`.

- [ ] **Step 3: Implementar `hasAxisData`**

Em `packages/core/src/components/variant-selector.tsx`, adicionar logo abaixo de `variantLabel` (depois da linha `export function variantLabel...}`):

```ts
export function hasAxisData(variants: ProductVariant[]): boolean {
  return variants.some((variant) => variant.axis.length > 0);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @mypet/core test`
Expected: PASS — todos os testes de `variant-selector.test.ts` (e os demais arquivos `.test.ts` do pacote) passam.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/variant-selector.tsx packages/core/src/components/variant-selector.test.ts
git commit -m "feat(core): adiciona hasAxisData para decidir chips vs tabela de variantes"
```

---

### Task 2: Componente `VariantTable` (fallback sem `variant_axis`)

**Files:**
- Create: `packages/core/src/components/variant-table.tsx`

**Interfaces:**
- Consome: `AddToCartControl` de `./add-to-cart-control` (`{ product: Omit<CartItem, "qty"> }`, já existe e é autocontido — cada instância gerencia seu próprio estado de quantidade). `variantLabel` de `./variant-selector` (Task 1, já existe hoje). `useClientConfig` de `../theme` (já existe, expõe `palette`). Tipo `ProductVariant` de `../catalog-utils`.
- Produces: `VariantTable({ variants, brand }: { variants: ProductVariant[]; brand: string | null }): JSX.Element` — consumido pelo Task 3.

Não há testes automatizados de componente React neste repositório (ver Global Constraints) — a verificação deste componente acontece visualmente no Task 4/5. Este task só entrega o arquivo.

- [ ] **Step 1: Criar `packages/core/src/components/variant-table.tsx`**

```tsx
"use client";

import { useClientConfig } from "../theme";
import { AddToCartControl } from "./add-to-cart-control";
import { variantLabel } from "./variant-selector";
import type { ProductVariant } from "../catalog-utils";

const SCROLL_THRESHOLD = 6;

export function VariantTable({
  variants,
  brand,
}: {
  variants: ProductVariant[];
  brand: string | null;
}) {
  const { palette } = useClientConfig();
  const scrollable = variants.length > SCROLL_THRESHOLD;

  return (
    <div
      style={{
        border: `1px solid ${palette.gray200}`,
        borderRadius: 16,
        overflow: "hidden",
        marginTop: 16,
        ...(scrollable ? { maxHeight: 420, overflowY: "auto" as const } : {}),
      }}
    >
      {variants.map((variant, index) => (
        <div
          key={variant.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "16px 20px",
            borderTop: index === 0 ? "none" : `1px solid ${palette.gray100}`,
            background: palette.white,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: palette.navy }}>
              {variantLabel(variant)}
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: palette.pink, marginTop: 2 }}>
              {variant.priceLabel ?? "Preço sob consulta"}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <AddToCartControl
              product={{ id: variant.id, name: variant.name, sku: variant.sku, brand, img: variant.img }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `pnpm --filter @mypet/core exec tsc --noEmit`
Expected: sem erros novos relacionados a `variant-table.tsx` (o comando pode já reportar avisos pré-existentes de outros arquivos — confirme que nenhum erro novo aponta para `variant-table.tsx`).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/variant-table.tsx
git commit -m "feat(core): adiciona VariantTable para grupos de variacao sem variant_axis"
```

---

### Task 3: Reestrutura `product-variant-panel.tsx` (imagem + caixa de compra lado a lado)

**Files:**
- Modify: `packages/core/src/components/product-variant-panel.tsx` (reescrita completa do arquivo)

**Interfaces:**
- Consome: `hasAxisData` de `./variant-selector` (Task 1). `VariantTable` de `./variant-table` (Task 2). `VariantSelector`, `useSelectedVariant` de `./variant-selector` (já existiam). `AddToCartControl` de `./add-to-cart-control` (já existia). `badgeStyle`, `useClientConfig` de `../theme` (já existiam). `Badge`, `ProductVariant` de `../catalog-utils` (já existiam).
- Produces: `ProductVariantPanel({ product }: { product: PdpProduct }): JSX.Element` — mesma assinatura pública de hoje, mas agora renderiza sozinho as duas colunas (imagem + caixa de compra com marca/nome/SKU/preço/CTA ou tabela). `PdpProduct` mantém exatamente os mesmos campos de hoje (`id`, `name`, `brand`, `sku`, `barcode`, `img`, `badge`, `variants`, `salePrice?`, `priceLabel?`) — nenhum campo novo é necessário. Consumida pelo Task 4.
- Classes CSS novas introduzidas por este componente: `.pdp-purchase-grid` (grid de 2 colunas, vira 1 coluna em mobile) e `.pdp-image-wrap` (altura da imagem, reduz em mobile) — substituem `.detail-grid`/`.img-container` que hoje vivem em `page.tsx` (removidas no Task 4).

- [ ] **Step 1: Substituir todo o conteúdo de `packages/core/src/components/product-variant-panel.tsx`**

```tsx
"use client";

import { Suspense } from "react";
import Image from "next/image";
import { badgeStyle, useClientConfig } from "../theme";
import { AddToCartControl } from "./add-to-cart-control";
import { VariantSelector, hasAxisData, useSelectedVariant } from "./variant-selector";
import { VariantTable } from "./variant-table";
import type { Badge, ProductVariant } from "../catalog-utils";

export type PdpProduct = {
  id: string;
  name: string;
  brand: string | null;
  sku: string;
  barcode: string | null;
  img: string;
  badge: Badge | null;
  variants: ProductVariant[];
  salePrice?: number | null;
  priceLabel?: string | null;
};

export function ProductVariantPanel({ product }: { product: PdpProduct }) {
  const variants = product.variants.length > 0 ? product.variants : [toSelfVariant(product)];

  return (
    <>
      <style>{`
        .pdp-purchase-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
        @media (max-width: 768px) {
          .pdp-purchase-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .pdp-image-wrap { height: 300px !important; }
        }
      `}</style>
      <Suspense
        fallback={<PurchaseGrid product={product} variants={variants} selected={variants[0]} onSelect={() => {}} />}
      >
        <ProductVariantPanelInner product={product} variants={variants} />
      </Suspense>
    </>
  );
}

function ProductVariantPanelInner({
  product,
  variants,
}: {
  product: PdpProduct;
  variants: ProductVariant[];
}) {
  const { selected, select } = useSelectedVariant(variants);
  return <PurchaseGrid product={product} variants={variants} selected={selected} onSelect={select} />;
}

function toSelfVariant(product: PdpProduct): ProductVariant {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    img: product.img,
    axis: [],
    salePrice: product.salePrice ?? null,
    priceLabel: product.priceLabel ?? null,
  };
}

function PurchaseGrid({
  product,
  variants,
  selected,
  onSelect,
}: {
  product: PdpProduct;
  variants: ProductVariant[];
  selected: ProductVariant;
  onSelect: (id: string) => void;
}) {
  const { palette: PALETTE } = useClientConfig();
  const hasVariants = product.variants.length > 0;
  const useTable = hasVariants && !hasAxisData(product.variants);

  const variantOverride = hasVariants
    ? { id: selected.id, sku: selected.sku, barcode: selected.barcode, img: selected.img, name: selected.name }
    : null;

  const img = variantOverride?.img ?? product.img;
  const sku = variantOverride?.sku ?? product.sku;
  const barcode = variantOverride?.barcode ?? product.barcode;
  const cartId = variantOverride?.id ?? product.id;
  const cartName = variantOverride?.name ?? product.name;
  const priceLabel = product.variants.find((variant) => variant.id === cartId)?.priceLabel ?? product.priceLabel;

  return (
    <div className="pdp-purchase-grid">
      <ProductImage product={product} img={img} cartName={cartName} />

      <div>
        {product.brand && (
          <p
            style={{
              fontSize: 13,
              color: PALETTE.pink,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {product.brand}
          </p>
        )}
        <h1 style={{ fontSize: 32, fontWeight: 900, color: PALETTE.navy, lineHeight: 1.25, marginBottom: 12 }}>
          {product.name}
        </h1>

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

        {useTable ? (
          <VariantTable variants={product.variants} brand={product.brand} />
        ) : (
          <>
            {hasVariants && (
              <div style={{ marginTop: 16 }}>
                <VariantSelector variants={product.variants} selectedId={selected.id} onSelect={onSelect} />
              </div>
            )}

            <div
              style={{
                background: PALETTE.white,
                border: `1px solid ${PALETTE.gray200}`,
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 4px 20px rgba(26,52,114,0.04)",
                marginTop: 16,
              }}
            >
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: PALETTE.gray600,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 4,
                  }}
                >
                  Atacado B2B
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: PALETTE.pink }}>
                  {priceLabel ?? "Preço sob consulta"}
                </div>
                <p style={{ fontSize: 13, color: PALETTE.gray600, marginTop: 4 }}>
                  Venda exclusiva para CNPJ de pet shops e revendedores.
                </p>
              </div>

              <AddToCartControl product={{ id: cartId, name: cartName, sku, brand: product.brand, img }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProductImage({
  product,
  img,
  cartName,
}: {
  product: PdpProduct;
  img: string;
  cartName: string;
}) {
  const { palette: PALETTE } = useClientConfig();
  const styleBadge = product.badge ? badgeStyle(product.badge.code, PALETTE) : null;

  return (
    <div
      style={{
        background: PALETTE.white,
        border: `1px solid ${PALETTE.gray200}`,
        borderRadius: 20,
        padding: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(26,52,114,0.04)",
      }}
    >
      <div className="pdp-image-wrap" style={{ width: "100%", height: 450, position: "relative" }}>
        <Image
          src={img}
          alt={cartName}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 450px"
          style={{ objectFit: "contain" }}
        />
      </div>

      {product.badge && styleBadge && (
        <span
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            background: styleBadge.bg,
            color: styleBadge.color,
            fontSize: 12,
            fontWeight: 800,
            padding: "6px 14px",
            borderRadius: 100,
            letterSpacing: "0.02em",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
        >
          {product.badge.label}
        </span>
      )}

      {product.brand && (
        <span
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: PALETTE.navyLight,
            color: PALETTE.navy,
            fontSize: 11,
            fontWeight: 700,
            padding: "5px 12px",
            borderRadius: 100,
            letterSpacing: "0.04em",
          }}
        >
          {product.brand.toUpperCase()}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Checar tipos e testes existentes**

Run: `pnpm --filter @mypet/core exec tsc --noEmit`
Expected: sem erros novos apontando para `product-variant-panel.tsx`.

Run: `pnpm --filter @mypet/core test`
Expected: PASS (os testes de `variant-selector.test.ts` do Task 1 continuam passando; este arquivo não tem testes próprios).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/product-variant-panel.tsx
git commit -m "feat(core): move caixa de compra para o lado da imagem no PDP"
```

---

### Task 4: Atualizar `page.tsx` da Distribuidora e do mypet

**Files:**
- Modify: `apps/distribuidora/app/produtos/[id]/page.tsx`
- Modify: `apps/mypet/app/produtos/[id]/page.tsx`

Os dois arquivos são idênticos hoje (confirmado via `diff`) e recebem exatamente a mesma mudança.

**Interfaces:**
- Consome: `ProductVariantPanel` de `@mypet/core/components/product-variant-panel` (Task 3, mesma assinatura pública `{ product: PdpProduct }`).

- [ ] **Step 1: Remover o bloco de media query `.detail-grid`/`.img-container` do `<style>`**

Em ambos os arquivos, dentro da tag `<style>{...}</style>` no componente `ProductPage`, remover:

```
        @media (max-width: 768px) {
          .detail-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .img-container { height: 300px !important; }
        }
```

(Essas classes passam a viver em `product-variant-panel.tsx`, como `.pdp-purchase-grid`/`.pdp-image-wrap`, já com seu próprio `@media` — ver Task 3.)

- [ ] **Step 2: Substituir o grid de 2 colunas por `ProductVariantPanel` + seção full-width**

Em ambos os arquivos, dentro da função `ProductDetail`, substituir todo o bloco a partir de `<div className="detail-grid" ...>` até o `</div>` que fecha a coluna direita (o trecho com os comentários `{/* GRID */}` continua na função `ProductPage`, mas o JSX interno de `ProductDetail` muda) por:

```tsx
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      )}

      <ProductVariantPanel product={product} />

      <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 24 }}>
        {/* DESCRIÇÃO */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 10 }}>
            Descrição do Produto
          </h2>
          <div style={{ fontSize: 15, color: PALETTE.gray600, lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {product.description || (
              <span style={{ color: PALETTE.gray400, fontStyle: "italic" }}>
                Descrição detalhada não cadastrada no catálogo. Solicite informações adicionais no momento da cotação.
              </span>
            )}
          </div>
        </div>

        {/* ESPECIFICAÇÕES TÉCNICAS */}
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
```

O restante da função `ProductDetail` (o `<script>` de `breadcrumbJsonLd` no topo do `return`, o `<nav aria-label="Breadcrumb">`, e o fechamento com `</>`) permanece igual — só o conteúdo depois do `<nav>` muda, conforme acima. Note que o `<script>` do `jsonLd` (product/productGroup) sai de dentro do antigo `.detail-grid` e passa a ficar logo antes de `<ProductVariantPanel />`, como mostrado no trecho novo.

- [ ] **Step 3: Build para checar tipos e JSX**

Run: `pnpm --filter distribuidora build`
Expected: build conclui sem erros de tipo/JSX.

Run: `pnpm --filter mypet build`
Expected: build conclui sem erros de tipo/JSX.

- [ ] **Step 4: Commit**

```bash
git add "apps/distribuidora/app/produtos/[id]/page.tsx" "apps/mypet/app/produtos/[id]/page.tsx"
git commit -m "feat(pdp): move nome/marca para a caixa de compra ao lado da imagem"
```

---

### Task 5: Verificação manual no navegador

**Files:** nenhum (só verificação — não há testes de componente automatizados neste repositório).

- [ ] **Step 1: Subir o app da Distribuidora**

Run: `pnpm dev:distribuidora`
Expected: servidor sobe em `http://localhost:4101`.

- [ ] **Step 2: Verificar um produto simples (sem variação)**

Abrir o catálogo em `http://localhost:4101`, navegar até um produto sem variação. Confirmar:
- Preço, seletor de quantidade e botão "Adicionar" aparecem ao lado da imagem (não embaixo), visíveis sem rolar a tela em desktop.
- Nome do produto, marca e tags SKU/EAN aparecem na coluna da caixa de compra, acima do preço.
- Descrição e especificações aparecem abaixo, em largura total.

- [ ] **Step 3: Verificar um produto com variação e `variant_axis` preenchido (se existir no catálogo)**

Navegar até um produto com variação cujo grupo tenha `variant_axis` cadastrado (ex.: tamanho/cor). Confirmar:
- O seletor de chips (`Escolha uma opção`) aparece normalmente, ao lado da imagem, acima do card de preço/quantidade/CTA.
- Trocar de chip atualiza imagem, preço, SKU/EAN e o item adicionado ao carrinho.

- [ ] **Step 4: Verificar um produto com variação sem `variant_axis` (ex.: o caso do print, "Vestido Chic Tule Rosa")**

Se o catálogo atual tiver um `parent_product_id` com variantes sem `variant_axis`, abrir esse produto. Se não houver nenhum caso assim disponível nos dados reais no momento do teste, simular temporariamente no código (ex.: alterar por um instante o retorno de `getProductById` local ou usar um produto de teste) só para conferir visualmente, sem commitar a alteração temporária. Confirmar:
- Aparece uma tabela/lista ao lado da imagem, uma linha por variante, cada linha com nome (do catálogo), preço e seu próprio controle de quantidade + botão "Adicionar".
- Clicar em "Adicionar" numa linha específica adiciona aquele SKU ao carrinho (confirmar pelo contador do carrinho/ícone no header).
- Com mais de 6 variantes, a tabela ganha rolagem interna e não empurra a caixa de compra para fora da área visível inicial.

- [ ] **Step 5: Verificar em mobile**

Reduzir a viewport do navegador para menos de 768px (ou usar o modo responsivo do DevTools). Confirmar:
- A ordem de empilhamento é: imagem → marca/nome/SKU/EAN → preço+quantidade+CTA (ou tabela) → descrição → especificações.
- Nenhum elemento estoura a largura da tela (overflow horizontal).

- [ ] **Step 6: Repetir Steps 1–5 para o app mypet**

Run: `pnpm dev:mypet`
Expected: mesmas verificações em `http://localhost:4100`, já que o componente é compartilhado.

---

## Self-Review

- **Cobertura do spec:** layout desktop (Task 3+4), layout mobile (Task 3, `@media` embutido + Step 5 de verificação), tabela de fallback sem `variant_axis` (Task 1+2), chips mantidos quando `variant_axis` existe (Task 3, ramo `!useTable`), preço por linha na tabela (Task 2), imagem fixa na tabela (Task 2, sem estado de troca de imagem), rótulo vindo do catálogo via `variantLabel` (Task 1/2, sem numeração gerada), scroll acima de ~6 variantes (Task 2, `SCROLL_THRESHOLD`), escopo compartilhado distribuidora+mypet (Task 4) — todos os itens do spec têm uma task correspondente.
- **Placeholders:** nenhum "TBD"/"implementar depois" — todos os steps têm código completo. O único ponto sem automação total é a verificação de UI (Task 5), que é manual porque o repositório não tem testes de componente hoje (documentado nas Global Constraints, não é uma lacuna do plano).
- **Consistência de tipos:** `PdpProduct` não muda de formato entre tasks; `hasAxisData(variants: ProductVariant[]): boolean` (Task 1) é chamado como `hasAxisData(product.variants)` no Task 3 — mesma assinatura. `VariantTable({ variants, brand }: { variants: ProductVariant[]; brand: string | null })` (Task 2) é chamado como `<VariantTable variants={product.variants} brand={product.brand} />` no Task 3 — confere.
