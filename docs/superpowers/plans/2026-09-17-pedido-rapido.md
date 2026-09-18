# Pedido Rápido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/pedido-rapido` in `apps/mypet` — a dense, agile table for building a big B2B order (search, SKU, price, editable quantity, add-to-cart per line, sticky running total), backed by a new catalog query that flattens products and variants into orderable line items.

**Architecture:** A new data function `getCatalogLineItems` in `packages/core` flattens the existing product/variant model (`product_role` + `parent_product_id`) into one row per orderable SKU, reusing the price-resolution logic already proven in `queryCatalog`. A new `apps/mypet` route renders that data as a dense table with debounced client-side search (via a Server Action, no page navigation) and wires additions into the cart the site already has — extended, at the call sites, to carry `unitPrice` (the field already exists on `CartItem`, just unused today). `/cotacao` is updated to show subtotals/total now that the cart can carry price.

**Tech Stack:** Next.js 16 (App Router, Server Actions, `"use cache"`), React 19, TypeScript, Supabase (`@supabase/supabase-js`), Vitest + Testing Library, pnpm workspaces.

## Global Constraints

- This repo's Next.js is **not** the Next.js of training data — read `node_modules/next/dist/docs/` before writing any route/data-fetching code that uses `"use cache"`, `cacheLife`, `cacheTag`, or Server Actions, per `AGENTS.md`. Every task below that touches these APIs must re-verify current usage against the docs, not against memory.
- Follow existing code style exactly: inline `style={{ ... }}` objects using `palette` from `client.config.ts` (no Tailwind, no CSS modules) — this is the established pattern in every page under `apps/mypet/app/`.
- Never introduce a new checkout/payment flow — `/cotacao` keeps finalizing via WhatsApp (`buildQuoteMessage` / `buildWhatsAppLink`), unchanged.
- `packages/core` exports are declared explicitly in `packages/core/package.json` under `"exports"` — any new importable module needs an entry there or it will not resolve from `apps/mypet`.
- Run `pnpm --filter @mypet/core test` for `packages/core` changes and `pnpm --filter mypet test` for `apps/mypet` changes. Run `pnpm -r build` before considering the plan done (per repo's root `build` script).
- Spec: `docs/superpowers/specs/2026-09-17-pedido-rapido-design.md` — this plan implements it; on any conflict between this plan and deeper file inspection, this plan already reflects the deeper inspection (e.g., `CartItem.unitPrice` already exists and needs no schema change, only call sites need to populate it).

---

### Task 1: `getCatalogLineItems` — flatten catalog + variants into orderable line items

**Files:**
- Modify: `packages/core/src/catalog.ts` (export the existing private `fetchErpPrices`)
- Create: `packages/core/src/catalog-line-items.ts`
- Create: `packages/core/src/catalog-line-items.test.ts`
- Modify: `packages/core/package.json` (add export entry)

**Interfaces:**
- Consumes: `getHubClient` (`./supabase`), `fetchErpPrices` (`./catalog`, newly exported — signature `(references: (string | null | undefined)[]) => Promise<Map<string, number>>`), and from `./catalog-utils`: `mapVariant`, `formatPrice`, `pageRange`, `salePriceFromChannelPrices`, `channelUsesErpPrice`, `totalPages`, `mainImage`, `PLACEHOLDER_IMAGE`, `type RawVariantRow`, `type VariantAxisEntry`, `type ProductVariant`.
- Produces: `CatalogLineItem` (`{ id, name, sku, brand, img, unitPrice, priceLabel, variantLabel }`), `CatalogLineItemsResult` (`{ items: CatalogLineItem[], total, page, totalPages }`), `queryCatalogLineItems(params)` (uncached, used directly in tests), `getCatalogLineItems(params)` (cached wrapper — this is what Task 4 imports).

- [ ] **Step 1: Export `fetchErpPrices` from `catalog.ts`**

In `packages/core/src/catalog.ts`, change the function declaration (around line 32) from:

```ts
async function fetchErpPrices(references: (string | null | undefined)[]): Promise<Map<string, number>> {
```

to:

```ts
export async function fetchErpPrices(references: (string | null | undefined)[]): Promise<Map<string, number>> {
```

No other change in this file.

- [ ] **Step 2: Add the package export entry**

In `packages/core/package.json`, inside `"exports"`, add a line right after `"./catalog-revalidation": "./src/catalog-revalidation.ts",`:

```json
    "./catalog-line-items": "./src/catalog-line-items.ts",
```

- [ ] **Step 3: Write the failing tests**

Create `packages/core/src/catalog-line-items.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";

vi_mock_setup();

function vi_mock_setup() {
  // placeholder to keep vi.mock calls hoisted below at module top-level
}
```

Replace the whole file with the real content (the snippet above is discarded — write this instead):

```ts
import { describe, it, expect, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
}));

vi.mock("./catalog", () => ({
  fetchErpPrices: async () => new Map<string, number>(),
}));

const calls: Record<string, unknown[][]> = {};
let productPage: { data: unknown[]; count: number } = { data: [], count: 0 };
let variantRows: unknown[] = [];

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  const record = (name: string) => (...args: unknown[]) => {
    calls[name] = [...(calls[name] ?? []), args];
    return builder;
  };
  builder.select = record("select");
  builder.eq = record("eq");
  builder.neq = record("neq");
  builder.ilike = record("ilike");
  builder.order = record("order");
  builder.in = record("in");
  builder.range = (...args: unknown[]) => {
    calls["range"] = [args];
    return Promise.resolve({ data: productPage.data, count: productPage.count, error: null });
  };
  builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) => {
    resolve({ data: table === "products" ? variantRows : [], error: null });
  };
  return builder;
}

vi.mock("./supabase", () => ({
  getHubClient: () => ({
    from: (table: string) => makeBuilder(table),
  }),
}));

import { queryCatalogLineItems } from "./catalog-line-items";

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
  productPage = { data: [], count: 0 };
  variantRows = [];
});

describe("queryCatalogLineItems", () => {
  it("mapeia um produto simples em uma linha com preço", async () => {
    productPage = {
      data: [
        {
          id: "p1",
          name: "Ração X",
          reference: "100",
          brand: "NAPI",
          product_role: "simple",
          product_assets: [{ url: "https://img/1", type: "main_image" }],
          product_channel_prices: [{ channel: "distribuidora", sale_price: "42.90" }],
        },
      ],
      count: 1,
    };

    const result = await queryCatalogLineItems({ page: 1, channel: "distribuidora" });

    expect(result.items).toEqual([
      {
        id: "p1",
        name: "Ração X",
        sku: "100",
        brand: "NAPI",
        img: "https://img/1",
        unitPrice: 42.9,
        priceLabel: "R$ 42,90",
        variantLabel: null,
      },
    ]);
    expect(result.total).toBe(1);
  });

  it("expande um produto pai em uma linha por variante, sem linha resumida do pai", async () => {
    productPage = {
      data: [
        {
          id: "p1",
          name: "Coleira Ajustável",
          reference: null,
          brand: "MY PET",
          product_role: "parent",
          product_assets: [{ url: "https://img/parent", type: "main_image" }],
          product_channel_prices: [],
        },
      ],
      count: 1,
    };
    variantRows = [
      {
        id: "v1",
        name: "Coleira Ajustável P",
        reference: "COL-P",
        barcode: null,
        parent_product_id: "p1",
        variant_axis: [{ eixo: "tamanho", valor: "P", ordem: 1 }],
        product_assets: [{ url: "https://img/v1", type: "main_image" }],
        product_channel_prices: [{ channel: "distribuidora", sale_price: "19.90" }],
      },
      {
        id: "v2",
        name: "Coleira Ajustável M",
        reference: "COL-M",
        barcode: null,
        parent_product_id: "p1",
        variant_axis: [{ eixo: "tamanho", valor: "M", ordem: 1 }],
        product_assets: [],
        product_channel_prices: [{ channel: "distribuidora", sale_price: "21.90" }],
      },
    ];

    const result = await queryCatalogLineItems({ page: 1, channel: "distribuidora" });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: "v1",
      sku: "COL-P",
      variantLabel: "P",
      unitPrice: 19.9,
      img: "https://img/v1",
    });
    expect(result.items[1]).toMatchObject({
      id: "v2",
      sku: "COL-M",
      variantLabel: "M",
      unitPrice: 21.9,
      img: "https://img/parent",
    });
    expect(result.items.some((item) => item.id === "p1")).toBe(false);
  });

  it("produto sem preço no canal fica com unitPrice e priceLabel nulos", async () => {
    productPage = {
      data: [
        {
          id: "p1",
          name: "Ração X",
          reference: "100",
          brand: "NAPI",
          product_role: "simple",
          product_assets: [],
          product_channel_prices: [],
        },
      ],
      count: 1,
    };

    const result = await queryCatalogLineItems({ page: 1, channel: "distribuidora" });

    expect(result.items[0]).toMatchObject({ unitPrice: null, priceLabel: null });
  });

  it("repassa q, brand e paginação para a busca de produtos-base", async () => {
    await queryCatalogLineItems({ q: "ração", brand: "NAPI", page: 2, channel: "mypetbrasil" });

    expect(calls["ilike"]).toContainEqual(["name", "%ração%"]);
    expect(calls["eq"]).toContainEqual(["brand", "NAPI"]);
    expect(calls["eq"]).toContainEqual(["product_channel_links.channel", "mypetbrasil"]);
    expect(calls["neq"]).toContainEqual(["product_role", "variant"]);
    expect(calls["range"]).toEqual([[24, 47]]);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm --filter @mypet/core test -- catalog-line-items`
Expected: FAIL — `Cannot find module './catalog-line-items'` (file doesn't exist yet).

- [ ] **Step 5: Implement `catalog-line-items.ts`**

Create `packages/core/src/catalog-line-items.ts`:

```ts
import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import { fetchErpPrices } from "./catalog";
import {
  mapVariant,
  formatPrice,
  pageRange,
  salePriceFromChannelPrices,
  channelUsesErpPrice,
  totalPages,
  mainImage,
  PLACEHOLDER_IMAGE,
  type RawVariantRow,
  type VariantAxisEntry,
  type ProductVariant,
} from "./catalog-utils";

const LINE_ITEM_PRODUCT_SELECT =
  "id, name, reference, brand, product_role, product_assets(url, type), product_channel_prices(channel, sale_price, sale_updated_at)";

type RawLineItemProductRow = {
  id: string;
  name: string;
  reference: string | null;
  brand: string | null;
  product_role: "simple" | "parent" | "variant";
  product_assets: { url: string; type: string }[] | null;
  product_channel_prices: { channel: string | null; sale_price: number | string | null }[] | null;
};

export type CatalogLineItem = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  unitPrice: number | null;
  priceLabel: string | null;
  variantLabel: string | null;
};

export type CatalogLineItemsResult = {
  items: CatalogLineItem[];
  total: number;
  page: number;
  totalPages: number;
};

function lineItemVariantLabel(axis: VariantAxisEntry[], sku: string, fallbackIndex: number): string {
  const label = axis.map((a) => a.valor).join(" / ");
  const isJustReference = label.trim().toLowerCase() === sku.trim().toLowerCase();
  if (label && !isJustReference) return label;
  return `N.${fallbackIndex + 1}`;
}

function withErpPrice(item: CatalogLineItem, pricesByReference: Map<string, number>): CatalogLineItem {
  const preco = item.sku ? pricesByReference.get(item.sku) ?? null : null;
  return { ...item, unitPrice: preco, priceLabel: formatPrice(preco) };
}

async function fetchVariantsByParentIds(
  parentIds: string[],
  channel: string,
): Promise<Map<string, ProductVariant[]>> {
  const map = new Map<string, ProductVariant[]>();
  if (parentIds.length === 0) return map;

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, reference, barcode, parent_product_id, variant_axis, product_assets(url, type), product_channel_prices(channel, sale_price, sale_updated_at), product_channel_links!inner(channel)",
    )
    .in("parent_product_id", parentIds)
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel)
    .order("name", { ascending: true });

  if (error) {
    console.error("[catalog-line-items] erro ao buscar variantes:", error.message);
    return map;
  }

  for (const row of (data as unknown as (RawVariantRow & { parent_product_id: string })[]) ?? []) {
    const variant = mapVariant(row);
    const list = map.get(row.parent_product_id) ?? [];
    list.push(variant);
    map.set(row.parent_product_id, list);
  }
  return map;
}

export async function queryCatalogLineItems(params: {
  q?: string;
  brand?: string;
  page: number;
  channel: string;
}): Promise<CatalogLineItemsResult> {
  const { q, brand, page, channel } = params;
  const supabase = getHubClient();
  const { from, to } = pageRange(page);

  let query = supabase
    .from("products")
    .select(`${LINE_ITEM_PRODUCT_SELECT}, product_channel_links!inner(channel)`, { count: "exact" })
    .eq("status", "active")
    .neq("product_role", "variant")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel)
    .order("name", { ascending: true });

  if (q) query = query.ilike("name", `%${q}%`);
  if (brand) query = query.eq("brand", brand);

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error("[catalog-line-items] erro ao consultar produtos:", error.message);
    return { items: [], total: 0, page, totalPages: 1 };
  }

  const rows = (data as unknown as RawLineItemProductRow[]) ?? [];
  const parentIds = rows.filter((r) => r.product_role === "parent").map((r) => r.id);
  const variantsByParent = await fetchVariantsByParentIds(parentIds, channel);

  let items: CatalogLineItem[] = [];
  for (const row of rows) {
    if (row.product_role === "parent") {
      const variants = variantsByParent.get(row.id) ?? [];
      const parentImg = mainImage(row.product_assets);
      variants.forEach((variant, index) => {
        items.push({
          id: variant.id,
          name: row.name,
          sku: variant.sku,
          brand: row.brand,
          img: variant.img !== PLACEHOLDER_IMAGE ? variant.img : parentImg,
          unitPrice: variant.salePrice,
          priceLabel: variant.priceLabel,
          variantLabel: lineItemVariantLabel(variant.axis, variant.sku, index),
        });
      });
    } else {
      const salePrice = salePriceFromChannelPrices(row.product_channel_prices);
      items.push({
        id: row.id,
        name: row.name,
        sku: row.reference ?? "",
        brand: row.brand,
        img: mainImage(row.product_assets),
        unitPrice: salePrice,
        priceLabel: formatPrice(salePrice),
        variantLabel: null,
      });
    }
  }

  if (channelUsesErpPrice(channel)) {
    const erpPrices = await fetchErpPrices(items.map((item) => item.sku));
    items = items.map((item) => withErpPrice(item, erpPrices));
  }

  const total = count ?? 0;
  return { items, total, page, totalPages: totalPages(total) };
}

export async function getCatalogLineItems(params: {
  q?: string;
  brand?: string;
  page: number;
  channel: string;
}): Promise<CatalogLineItemsResult> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  return queryCatalogLineItems(params);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @mypet/core test -- catalog-line-items`
Expected: PASS (4 tests).

- [ ] **Step 7: Run the full core test suite to check for regressions**

Run: `pnpm --filter @mypet/core test`
Expected: PASS (no existing test touches `fetchErpPrices`'s export keyword or behavior).

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/catalog.ts packages/core/src/catalog-line-items.ts packages/core/src/catalog-line-items.test.ts packages/core/package.json
git commit -m "feat(core): getCatalogLineItems achata produtos e variantes em linhas compráveis"
```

---

### Task 2: `ProductCard` passes `unitPrice` into the cart

**Files:**
- Modify: `packages/core/src/components/product-card.tsx:73-76`
- Modify: `packages/core/src/components/product-card.test.ts`

**Interfaces:**
- Consumes: `CartItem` (`./cart` — already has optional `unitPrice?: number`, no change needed there), `CatalogProduct.salePrice: number | null` (already exists).
- Produces: nothing new — this closes the gap where `AddToCartControl` was called without price, for the `/loja` card grid.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/components/product-card.test.ts` (append after the existing `describe` block, adjust the top-level import line to also import `fireEvent`/`render` and mark the file `jsdom`):

Replace the file's first three lines:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
```

with:

```ts
// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
```

Then append this new `describe` block at the end of the file:

```ts

describe("ProductCard — preço no carrinho", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("inclui unitPrice ao adicionar o produto ao carrinho", () => {
    const { container } = render(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(
          CartProvider,
          null,
          createElement(ProductCard, {
            product: {
              id: "guia-rosa",
              name: "Guia Rosa",
              sku: "GR-1",
              brand: "MY PET",
              img: "/guia-rosa.jpg",
              badge: null,
              category: { id: "guias", name: "Guias", slug: "guias" },
              salePrice: 12.9,
              priceLabel: "R$ 12,90",
            },
          }),
        ),
      ),
    );

    fireEvent.click(container.querySelector('[aria-label="Adicionar ao carrinho"]')!);

    const cart = JSON.parse(localStorage.getItem("mypet_cart") ?? "{}");
    expect(cart.items[0]).toMatchObject({ id: "guia-rosa", unitPrice: 12.9 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mypet/core test -- product-card`
Expected: FAIL — `cart.items[0].unitPrice` is `undefined`, not `12.9`.

- [ ] **Step 3: Implement the fix**

In `packages/core/src/components/product-card.tsx`, change:

```tsx
        <AddToCartControl
          product={{ id: product.id, name: product.name, sku: product.sku, brand: product.brand, img: product.img }}
          compact
        />
```

to:

```tsx
        <AddToCartControl
          product={{
            id: product.id,
            name: product.name,
            sku: product.sku,
            brand: product.brand,
            img: product.img,
            unitPrice: product.salePrice ?? undefined,
          }}
          compact
        />
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @mypet/core test -- product-card`
Expected: PASS (2 tests, including the pre-existing markup test — `renderToStaticMarkup` output is unaffected since `unitPrice` isn't rendered).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/product-card.tsx packages/core/src/components/product-card.test.ts
git commit -m "feat(core): ProductCard passa unitPrice ao adicionar ao carrinho"
```

---

### Task 3: `/cotacao` shows per-line subtotal and a running total

**Files:**
- Modify: `apps/mypet/app/cotacao/cotacao-content.tsx`
- Create: `apps/mypet/app/cotacao/cotacao-content.test.tsx`

**Interfaces:**
- Consumes: `CartItem.unitPrice: number | undefined` (from `useCart()`, already carries it after Task 2).
- Produces: nothing new — UI-only change.

- [ ] **Step 1: Write the failing test**

Create `apps/mypet/app/cotacao/cotacao-content.test.tsx`:

```tsx
// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { ClientConfigProvider, type ClientConfig } from "@mypet/core/theme";
import { CotacaoContent } from "./cotacao-content";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./actions", () => ({ finalizeQuote: vi.fn() }));

const config: ClientConfig = {
  name: "My Pet Brasil",
  tagline: "Atacado B2B",
  domain: "mypetbrasil.com.br",
  catalogChannel: "mypetbrasil",
  logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#f0a", pinkDark: "#c07", pinkLight: "#fde", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

function renderWithCart(cartItems: Record<string, unknown>[]) {
  localStorage.setItem("mypet_cart", JSON.stringify({ items: cartItems }));
  return render(
    createElement(
      ClientConfigProvider,
      { config },
      createElement(CartProvider, null, createElement(CotacaoContent, { palette: config.palette })),
    ),
  );
}

describe("CotacaoContent — subtotal e total", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("mostra subtotal por linha e o total geral quando todos os itens têm unitPrice", () => {
    renderWithCart([
      { id: "p1", name: "Ração X", sku: "100", brand: "NAPI", img: "/img.jpg", qty: 2, unitPrice: 42.9 },
      { id: "p2", name: "Areia Y", sku: "200", brand: "NAPI", img: "/img2.jpg", qty: 1, unitPrice: 30 },
    ]);

    expect(screen.getByText("R$ 85,80")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 115,80")).toBeInTheDocument();
  });

  it("mostra — no subtotal de item sem unitPrice e não o inclui no total geral", () => {
    renderWithCart([
      { id: "p1", name: "Ração X", sku: "100", brand: "NAPI", img: "/img.jpg", qty: 2 },
      { id: "p2", name: "Areia Y", sku: "200", brand: "NAPI", img: "/img2.jpg", qty: 1, unitPrice: 30 },
    ]);

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mypet test -- cotacao-content`
Expected: FAIL — none of `R$ 85,80` / `R$ 115,80` / `—` render yet (current `CotacaoContent` shows no price at all).

- [ ] **Step 3: Implement subtotal and total**

In `apps/mypet/app/cotacao/cotacao-content.tsx`, add a `brl` formatter and a `total` computation at the top of the component (mirroring the pattern already used in `apps/mypet/app/balcao/balcao-content.tsx`), then render subtotal per line and the total block.

Add near the top of the file, after the existing imports:

```tsx
const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
```

Inside `CotacaoContent`, right after `const { cart, removeItem, updateQty, clear } = useCart();`, add:

```tsx
  const total = cart.items.reduce(
    (sum, item) => sum + (item.unitPrice != null ? item.unitPrice * item.qty : 0),
    0,
  );
```

Inside the item row (the `cart.items.map((item, index) => ( ... ))` block), right before the closing `</div>` of the row (after the "Remover" button), add a subtotal column:

```tsx
            <div style={{ minWidth: 72, textAlign: "right", fontSize: 13, fontWeight: 800, color: PALETTE.navy }}>
              {item.unitPrice != null ? brl(item.unitPrice * item.qty) : "—"}
            </div>
```

Right before the final `<div style={{ background: PALETTE.white, ... }}>` block that holds the submit button, add a total block:

```tsx
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <p style={{ fontSize: 15, fontWeight: 900, color: PALETTE.navy }}>Total: {brl(total)}</p>
      </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter mypet test -- cotacao-content`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/cotacao/cotacao-content.tsx apps/mypet/app/cotacao/cotacao-content.test.tsx
git commit -m "feat(mypet): /cotacao mostra subtotal por linha e total geral"
```

---

### Task 4: `/pedido-rapido` route shell — auth guard, data loading, search Server Action

**Files:**
- Create: `apps/mypet/app/pedido-rapido/page.tsx`
- Create: `apps/mypet/app/pedido-rapido/page.test.tsx`
- Create: `apps/mypet/app/pedido-rapido/actions.ts`

**Interfaces:**
- Consumes: `requireBuyer()` (`@/lib/require-buyer`), `getCategories`, `getBrands` (`@mypet/core/catalog`), `getCatalogLineItems`, `type CatalogLineItemsResult` (`@mypet/core/catalog-line-items`, from Task 1), `clientConfig` (`@/client.config`).
- Produces: `PedidoRapidoPageBody()` (exported for tests, same pattern as `LojaContent`/`BalcaoPageBody`), `searchLineItems(params: { q?: string; brand?: string; page: number }): Promise<CatalogLineItemsResult>` Server Action — this is what Task 5's client component calls. This task renders a placeholder `<p>Carregando pedido rápido…</p>` where Task 5 will mount `PedidoRapidoTable` — the route is fully testable (redirect + data loading) before that component exists.

- [ ] **Step 1: Write the failing test**

Create `apps/mypet/app/pedido-rapido/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireBuyer = vi.fn();
const redirect = vi.fn(() => {
  throw new Error("REDIRECT");
});

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@mypet/core/catalog", () => ({
  getCategories: async () => [],
  getBrands: async () => ["NAPI"],
}));
vi.mock("@mypet/core/catalog-line-items", () => ({
  getCatalogLineItems: async () => ({ items: [], total: 0, page: 1, totalPages: 1 }),
}));

import { PedidoRapidoPageBody } from "./page";

beforeEach(() => {
  requireBuyer.mockReset();
  redirect.mockClear();
});

describe("PedidoRapidoPage", () => {
  it("redireciona para /entrar quando não há comprador", async () => {
    requireBuyer.mockResolvedValue(null);
    await expect(PedidoRapidoPageBody()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mypet test -- pedido-rapido/page`
Expected: FAIL — `Cannot find module './page'` (doesn't exist yet).

- [ ] **Step 3: Implement `actions.ts`**

Create `apps/mypet/app/pedido-rapido/actions.ts`:

```ts
"use server";

import { getCatalogLineItems, type CatalogLineItemsResult } from "@mypet/core/catalog-line-items";
import type { Channel } from "@mypet/core/channels";
import { clientConfig } from "@/client.config";

export async function searchLineItems(params: {
  q?: string;
  brand?: string;
  page: number;
}): Promise<CatalogLineItemsResult> {
  return getCatalogLineItems({ ...params, channel: clientConfig.catalogChannel as Channel });
}
```

- [ ] **Step 4: Implement `page.tsx`**

Create `apps/mypet/app/pedido-rapido/page.tsx`:

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { getCategories, getBrands } from "@mypet/core/catalog";
import { getCatalogLineItems } from "@mypet/core/catalog-line-items";
import type { Channel } from "@mypet/core/channels";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";

const { palette: PALETTE } = clientConfig;

export const metadata: Metadata = {
  title: "Pedido Rápido | My Pet Brasil",
  robots: { index: false, follow: false },
};

export default function PedidoRapidoPage() {
  return (
    <Suspense fallback={null}>
      <PedidoRapidoPageBody />
    </Suspense>
  );
}

// exported for tests
export async function PedidoRapidoPageBody() {
  const buyer = await requireBuyer();
  if (!buyer) redirect("/entrar");

  const channel = clientConfig.catalogChannel as Channel;
  const [categories, brands, firstPage] = await Promise.all([
    getCategories(),
    getBrands(channel),
    getCatalogLineItems({ page: 1, channel }),
  ]);

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <SiteNav categories={categories} balcaoHref="/balcao" pedidoRapidoHref="/pedido-rapido" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 120px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: PALETTE.navy, marginBottom: 4 }}>
          Pedido rápido
        </h1>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Busque por nome ou SKU, informe a quantidade e adicione direto na linha.
        </p>
        <p style={{ fontSize: 14, color: PALETTE.gray600 }}>
          Carregando pedido rápido… ({firstPage.total} produtos, {brands.length} marcas)
        </p>
      </main>
    </div>
  );
}
```

Note: `SiteNav` does not accept `pedidoRapidoHref` yet — that prop is added in Task 6. Passing it here is harmless (TypeScript will flag it as an unknown prop until Task 6 lands); **do this task's commit before Task 6's `SiteNav` change if working task-by-task with type-checking in CI** — or, if running `tsc`/`next build` between tasks, temporarily omit the `pedidoRapidoHref` prop here and add it back in Task 6's step. Since this plan is executed in order, Task 6 runs after this one in the same branch, so by the time `pnpm -r build` runs at the end, the prop exists. Do not run `pnpm --filter mypet build` between Task 4 and Task 6 in isolation.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter mypet test -- pedido-rapido/page`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/app/pedido-rapido/page.tsx apps/mypet/app/pedido-rapido/page.test.tsx apps/mypet/app/pedido-rapido/actions.ts
git commit -m "feat(mypet): rota /pedido-rapido com guarda de acesso e busca via Server Action"
```

---

### Task 5: `PedidoRapidoTable` — dense table with instant search, editable qty, sticky total

**Files:**
- Create: `apps/mypet/app/pedido-rapido/pedido-rapido-table.tsx`
- Create: `apps/mypet/app/pedido-rapido/pedido-rapido-table.test.tsx`
- Modify: `apps/mypet/app/pedido-rapido/page.tsx` (mount the table instead of the placeholder text)

**Interfaces:**
- Consumes: `useCart()` (`@mypet/core/components/cart-provider` — `cart`, `addItem`, `totalItems`), `type Palette` (`@mypet/core/theme`), `type CatalogLineItemsResult` (`@mypet/core/catalog-line-items`, Task 1), `searchLineItems` (`./actions`, Task 4).
- Produces: `PedidoRapidoTable({ initialResult, brands, palette })` component, mounted by `page.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `apps/mypet/app/pedido-rapido/pedido-rapido-table.test.tsx`:

```tsx
// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { ClientConfigProvider, type ClientConfig } from "@mypet/core/theme";
import type { CatalogLineItemsResult } from "@mypet/core/catalog-line-items";
import { PedidoRapidoTable } from "./pedido-rapido-table";

const searchLineItems = vi.fn();
vi.mock("./actions", () => ({ searchLineItems: (params: unknown) => searchLineItems(params) }));

const config: ClientConfig = {
  name: "My Pet Brasil",
  tagline: "Atacado B2B",
  domain: "mypetbrasil.com.br",
  catalogChannel: "mypetbrasil",
  logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#f0a", pinkDark: "#c07", pinkLight: "#fde", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

const baseResult: CatalogLineItemsResult = {
  items: [
    { id: "p1", name: "Ração X", sku: "100", brand: "NAPI", img: "/img.jpg", unitPrice: 42.9, priceLabel: "R$ 42,90", variantLabel: null },
    { id: "p2", name: "Kit sem preço", sku: "200", brand: "NAPI", img: "/img2.jpg", unitPrice: null, priceLabel: null, variantLabel: null },
  ],
  total: 2,
  page: 1,
  totalPages: 1,
};

function renderTable(result = baseResult) {
  return render(
    createElement(
      ClientConfigProvider,
      { config },
      createElement(
        CartProvider,
        null,
        createElement(PedidoRapidoTable, { initialResult: result, brands: ["NAPI"], palette: config.palette }),
      ),
    ),
  );
}

describe("PedidoRapidoTable", () => {
  beforeEach(() => {
    localStorage.clear();
    searchLineItems.mockReset();
  });

  it("clicar em adicionar grava a linha no carrinho com o preço e atualiza a barra fixa de total", () => {
    renderTable();

    fireEvent.click(screen.getByLabelText("Adicionar Ração X ao carrinho"));

    const cart = JSON.parse(localStorage.getItem("mypet_cart") ?? "{}");
    expect(cart.items[0]).toMatchObject({ id: "p1", unitPrice: 42.9, qty: 1 });
    expect(screen.getByText("1 item — R$ 42,90")).toBeInTheDocument();
  });

  it("desabilita quantidade e botão de adicionar para item sem preço", () => {
    renderTable();

    expect(screen.getByLabelText("Quantidade de Kit sem preço")).toBeDisabled();
    expect(screen.getByLabelText("Adicionar Kit sem preço ao carrinho")).toBeDisabled();
    expect(screen.getByText("Sob consulta")).toBeInTheDocument();
  });

  it("digitar na busca dispara searchLineItems após o debounce, não a cada tecla", async () => {
    searchLineItems.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
    renderTable();

    const input = screen.getByLabelText("Buscar produtos por nome ou SKU");
    fireEvent.change(input, { target: { value: "r" } });
    fireEvent.change(input, { target: { value: "ra" } });
    fireEvent.change(input, { target: { value: "ração" } });

    expect(searchLineItems).not.toHaveBeenCalled();

    await waitFor(() => expect(searchLineItems).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(searchLineItems).toHaveBeenCalledWith({ q: "ração", brand: undefined, page: 1 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter mypet test -- pedido-rapido-table`
Expected: FAIL — `Cannot find module './pedido-rapido-table'`.

- [ ] **Step 3: Implement `pedido-rapido-table.tsx`**

Create `apps/mypet/app/pedido-rapido/pedido-rapido-table.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useCart } from "@mypet/core/components/cart-provider";
import type { Palette } from "@mypet/core/theme";
import type { CatalogLineItem, CatalogLineItemsResult } from "@mypet/core/catalog-line-items";
import { searchLineItems } from "./actions";

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const DEBOUNCE_MS = 300;

function Row({
  item,
  initialQty,
  added,
  onAdd,
  palette: P,
}: {
  item: CatalogLineItem;
  initialQty: number;
  added: boolean;
  onAdd: (qty: number) => void;
  palette: Palette;
}) {
  const [qty, setQty] = useState(initialQty);

  useEffect(() => {
    setQty(initialQty);
  }, [initialQty]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: 12,
        borderBottom: `1px solid ${P.gray100}`,
      }}
    >
      <img
        src={item.img}
        alt={item.name}
        style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 8, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: P.navy }}>
          {item.name}
          {item.variantLabel ? ` — ${item.variantLabel}` : ""}
        </p>
        <p style={{ fontSize: 11, color: P.gray400 }}>
          {item.brand ? `${item.brand} · ` : ""}SKU: {item.sku}
        </p>
      </div>
      <div style={{ width: 100, textAlign: "right", fontSize: 13, fontWeight: 800, color: P.navy }}>
        {item.priceLabel ?? "Sob consulta"}
      </div>
      <input
        type="number"
        min={0}
        value={qty}
        disabled={item.unitPrice == null}
        aria-label={`Quantidade de ${item.name}`}
        onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        style={{
          width: 64,
          padding: "6px 8px",
          border: `1.5px solid ${P.gray200}`,
          borderRadius: 8,
          fontSize: 14,
        }}
      />
      <button
        type="button"
        disabled={item.unitPrice == null}
        onClick={() => onAdd(qty)}
        aria-label={`Adicionar ${item.name} ao carrinho`}
        style={{
          width: 36,
          height: 36,
          border: "none",
          borderRadius: 8,
          background: added ? P.green : P.gray100,
          color: added ? P.white : P.navy,
          fontSize: 16,
          cursor: item.unitPrice == null ? "not-allowed" : "pointer",
        }}
      >
        {added ? "✓" : "🛒"}
      </button>
    </div>
  );
}

export function PedidoRapidoTable({
  initialResult,
  brands,
  palette: P,
}: {
  initialResult: CatalogLineItemsResult;
  brands: string[];
  palette: Palette;
}) {
  const { cart, addItem, totalItems } = useCart();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(initialResult);
  const [pending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState<Record<string, boolean>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const next = await searchLineItems({ q: q || undefined, brand: brand || undefined, page });
        setResult(next);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, brand, page]);

  const qtyInCart: Record<string, number> = {};
  for (const item of cart.items) qtyInCart[item.id] = item.qty;

  const cartTotal = cart.items.reduce(
    (sum, item) => sum + (item.unitPrice != null ? item.unitPrice * item.qty : 0),
    0,
  );

  function handleAdd(item: CatalogLineItem, qty: number) {
    if (qty <= 0 || item.unitPrice == null) return;
    addItem(
      { id: item.id, name: item.name, sku: item.sku, brand: item.brand, img: item.img, unitPrice: item.unitPrice },
      qty,
    );
    setJustAdded((cur) => ({ ...cur, [item.id]: true }));
    setTimeout(() => setJustAdded((cur) => ({ ...cur, [item.id]: false })), 1500);
  }

  return (
    <div style={{ paddingBottom: 96 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Buscar por nome ou SKU..."
          aria-label="Buscar produtos por nome ou SKU"
          style={{ flex: "1 1 240px", padding: "10px 14px", borderRadius: 10, border: `1px solid ${P.gray200}`, fontSize: 14 }}
        />
        <select
          value={brand}
          onChange={(e) => {
            setPage(1);
            setBrand(e.target.value);
          }}
          aria-label="Filtrar por marca"
          style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${P.gray200}`, fontSize: 14, background: P.white }}
        >
          <option value="">Todas as marcas</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      <div
        style={{
          background: P.white,
          border: `1px solid ${P.gray200}`,
          borderRadius: 16,
          overflow: "hidden",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {result.items.length === 0 ? (
          <p style={{ padding: 32, textAlign: "center", fontSize: 14, color: P.gray600 }}>
            Nenhum produto encontrado.
          </p>
        ) : (
          result.items.map((item) => (
            <Row
              key={item.id}
              item={item}
              initialQty={qtyInCart[item.id] ?? 0}
              added={Boolean(justAdded[item.id])}
              onAdd={(qty) => handleAdd(item, qty)}
              palette={P}
            />
          ))
        )}
      </div>

      {result.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 24 }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="cat-btn">
            ← Anterior
          </button>
          <span style={{ fontSize: 14, color: P.gray600 }}>
            Página {page} de {result.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= result.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="cat-btn"
          >
            Próxima →
          </button>
        </div>
      )}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: P.navy,
          color: P.white,
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 50,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          {totalItems} {totalItems === 1 ? "item" : "itens"} — {brl(cartTotal)}
        </span>
        <Link href="/cotacao" style={{ color: P.white, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>
          Ver meu pedido →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter mypet test -- pedido-rapido-table`
Expected: PASS (3 tests).

- [ ] **Step 5: Mount the table in `page.tsx`**

In `apps/mypet/app/pedido-rapido/page.tsx`, add the import:

```tsx
import { PedidoRapidoTable } from "./pedido-rapido-table";
```

and replace the placeholder block:

```tsx
        <p style={{ fontSize: 14, color: PALETTE.gray600 }}>
          Carregando pedido rápido… ({firstPage.total} produtos, {brands.length} marcas)
        </p>
```

with:

```tsx
        <PedidoRapidoTable initialResult={firstPage} brands={brands} palette={PALETTE} />
```

- [ ] **Step 6: Run the full `mypet` test suite to check for regressions**

Run: `pnpm --filter mypet test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/app/pedido-rapido/pedido-rapido-table.tsx apps/mypet/app/pedido-rapido/pedido-rapido-table.test.tsx apps/mypet/app/pedido-rapido/page.tsx
git commit -m "feat(mypet): tabela do Pedido Rápido com busca instantânea, qty por linha e total fixo"
```

---

### Task 6: `SiteNav` gains a "Pedido rápido" link

**Files:**
- Modify: `packages/core/src/components/site-nav.tsx`
- Modify: `packages/core/src/components/site-nav.test.tsx` (create if it does not already exist — check first with `ls packages/core/src/components/site-nav.test.tsx`; if absent, create it with just the new test)
- Modify: `apps/mypet/app/loja/page.tsx:305`
- Modify: `apps/mypet/app/balcao/page.tsx:75`
- Modify: `apps/mypet/app/pedidos/page.tsx:75`
- Modify: `apps/mypet/app/produtos/[id]/page.tsx:168`
- Modify: `apps/mypet/app/cotacao/page.tsx:95`
- Modify: `apps/mypet/app/categoria/[slug]/page.tsx:165`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SiteNav` accepts an additional optional prop `pedidoRapidoHref?: string`, rendering a link next to the existing "Balcão de Negócios" link when set. This makes the `pedidoRapidoHref="/pedido-rapido"` prop passed in Task 4's `page.tsx` valid.

- [ ] **Step 1: Write the failing test**

Check if `packages/core/src/components/site-nav.test.tsx` exists:

Run: `ls packages/core/src/components/site-nav.test.tsx`

If it does not exist, create `packages/core/src/components/site-nav.test.tsx` with:

```tsx
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CartProvider } from "./cart-provider";
import { ClientConfigProvider, type ClientConfig } from "../theme";
import { SiteNav } from "./site-nav";

const config: ClientConfig = {
  name: "My Pet Brasil",
  tagline: "Atacado B2B",
  domain: "mypetbrasil.com.br",
  catalogChannel: "mypetbrasil",
  logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#f0a", pinkDark: "#c07", pinkLight: "#fde", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

describe("SiteNav — link do Pedido Rápido", () => {
  it("renderiza o link quando pedidoRapidoHref é informado", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(
          CartProvider,
          null,
          createElement(SiteNav, { categories: [], balcaoHref: "/balcao", pedidoRapidoHref: "/pedido-rapido" }),
        ),
      ),
    );

    expect(markup).toContain('href="/pedido-rapido"');
    expect(markup).toContain(">Pedido rápido<");
  });

  it("não renderiza o link quando pedidoRapidoHref não é informado", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(CartProvider, null, createElement(SiteNav, { categories: [], balcaoHref: "/balcao" })),
      ),
    );

    expect(markup).not.toContain(">Pedido rápido<");
  });
});
```

If the file already exists, append the same `describe` block to it instead (keep existing content).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mypet/core test -- site-nav`
Expected: FAIL — the "Pedido rápido" link isn't rendered (prop doesn't exist / is ignored).

- [ ] **Step 3: Implement the prop and link**

In `packages/core/src/components/site-nav.tsx`, change the props destructuring:

```tsx
export function SiteNav({
  categories,
  balcaoHref,
  audienceLabel,
}: {
  categories: CategoryNode[];
  balcaoHref?: string;
  audienceLabel?: string | null;
}) {
```

to:

```tsx
export function SiteNav({
  categories,
  balcaoHref,
  pedidoRapidoHref,
  audienceLabel,
}: {
  categories: CategoryNode[];
  balcaoHref?: string;
  pedidoRapidoHref?: string;
  audienceLabel?: string | null;
}) {
```

Then, right after the existing `{balcaoHref && ( ... )}` block (which renders the "Balcão de Negócios" link), add:

```tsx
          {pedidoRapidoHref && (
            <Link
              href={pedidoRapidoHref}
              style={{ fontSize: 13, fontWeight: 800, color: palette.pink, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Pedido rápido
            </Link>
          )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @mypet/core test -- site-nav`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the prop at every `SiteNav` call site in `apps/mypet`**

In each of the following files, change the existing `<SiteNav categories={categories} balcaoHref="/balcao" />` line to add `pedidoRapidoHref="/pedido-rapido"`:

`apps/mypet/app/loja/page.tsx:305`:
```tsx
        <SiteNav categories={categories} balcaoHref="/balcao" pedidoRapidoHref="/pedido-rapido" />
```

`apps/mypet/app/balcao/page.tsx:75`:
```tsx
      <SiteNav categories={categories} balcaoHref="/balcao" pedidoRapidoHref="/pedido-rapido" />
```

`apps/mypet/app/pedidos/page.tsx:75`:
```tsx
        <SiteNav categories={categories} balcaoHref="/balcao" pedidoRapidoHref="/pedido-rapido" />
```

`apps/mypet/app/produtos/[id]/page.tsx:168`:
```tsx
        <SiteNav categories={categories} balcaoHref="/balcao" pedidoRapidoHref="/pedido-rapido" />
```

`apps/mypet/app/cotacao/page.tsx:95`:
```tsx
        <SiteNav categories={categories} balcaoHref="/balcao" pedidoRapidoHref="/pedido-rapido" />
```

`apps/mypet/app/categoria/[slug]/page.tsx:165`:
```tsx
        <SiteNav categories={categories} balcaoHref="/balcao" pedidoRapidoHref="/pedido-rapido" />
```

(Line numbers are from the current file state — search for the exact existing `<SiteNav categories={categories} balcaoHref="/balcao" />` string in each file if a line has shifted.)

- [ ] **Step 6: Run the full workspace test suite and typecheck**

Run: `pnpm --filter @mypet/core test && pnpm --filter mypet test`
Expected: PASS.

Run: `pnpm -r build`
Expected: PASS — this is the first point where `pedido-rapido/page.tsx`'s `pedidoRapidoHref` prop (added in Task 4) is typechecked against `SiteNav`'s new prop (added in this task), so a full build confirms the two tasks compose correctly.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/components/site-nav.tsx packages/core/src/components/site-nav.test.tsx apps/mypet/app/loja/page.tsx apps/mypet/app/balcao/page.tsx apps/mypet/app/pedidos/page.tsx "apps/mypet/app/produtos/[id]/page.tsx" apps/mypet/app/cotacao/page.tsx "apps/mypet/app/categoria/[slug]/page.tsx"
git commit -m "feat(core,mypet): SiteNav ganha link para /pedido-rapido em todas as páginas protegidas"
```

---

### Task 7: CTA "Pedido rápido" no topo de `/loja`

The spec calls for two clear CTAs ("Navegar pelo catálogo" / "Pedido rápido") once
pricing is unlocked. Task 6 covers the persistent nav link; this task adds the more
visible banner CTA on `/loja` itself — the page a buyer lands on right after unlocking
access — so "Pedido rápido" isn't only a small nav link.

The CTA is built as its own small presentational component (not inline in
`LojaContent`) specifically so it can be unit-tested with the same synchronous
`renderToStaticMarkup` pattern used everywhere else in this repo (`product-card.test.ts`,
`site-nav.test.tsx`). `LojaContent` itself mixes in async Server Components
(`DynamicCatalog`, `StatsCount`) inside `<Suspense>` boundaries, which `renderToStaticMarkup`
cannot render — so this task does not attempt to render `LojaContent` as a whole.

**Files:**
- Create: `apps/mypet/app/loja/pedido-rapido-cta.tsx`
- Create: `apps/mypet/app/loja/pedido-rapido-cta.test.tsx`
- Modify: `apps/mypet/app/loja/page.tsx`

**Interfaces:**
- Consumes: `type Palette` (`@mypet/core/theme`).
- Produces: `PedidoRapidoCta({ palette })` component, mounted by `LojaContent`.

- [ ] **Step 1: Write the failing test**

Create `apps/mypet/app/loja/pedido-rapido-cta.test.tsx`:

```tsx
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Palette } from "@mypet/core/theme";
import { PedidoRapidoCta } from "./pedido-rapido-cta";

const palette: Palette = {
  pink: "#f0a", pinkDark: "#c07", pinkLight: "#fde", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
  navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
  gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
};

describe("PedidoRapidoCta", () => {
  it("linka para /pedido-rapido", () => {
    const markup = renderToStaticMarkup(createElement(PedidoRapidoCta, { palette }));

    expect(markup).toContain('href="/pedido-rapido"');
    expect(markup).toContain("Pedido rápido");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mypet test -- pedido-rapido-cta`
Expected: FAIL — `Cannot find module './pedido-rapido-cta'`.

- [ ] **Step 3: Implement `PedidoRapidoCta`**

Create `apps/mypet/app/loja/pedido-rapido-cta.tsx`:

```tsx
import Link from "next/link";
import type { Palette } from "@mypet/core/theme";

export function PedidoRapidoCta({ palette: P }: { palette: Palette }) {
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 8px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          background: P.navy,
          borderRadius: 16,
          padding: "16px 20px",
        }}
      >
        <p style={{ color: P.white, fontWeight: 800, fontSize: 14, margin: 0 }}>
          Já sabe o que vai comprar? Monte seu pedido em minutos.
        </p>
        <Link
          href="/pedido-rapido"
          className="cta-primary"
          style={{ textDecoration: "none", display: "inline-block" }}
        >
          ⚡ Pedido rápido
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter mypet test -- pedido-rapido-cta`
Expected: PASS.

- [ ] **Step 5: Mount it in `/loja`**

In `apps/mypet/app/loja/page.tsx`, add the import:

```tsx
import { PedidoRapidoCta } from "./pedido-rapido-cta";
```

Then, in `LojaContent`'s JSX, right after the `{/* MINI BANNER STRIP */}` `<Suspense>` block
and before the `{/* CATALOG */}` comment, insert:

```tsx
        {/* PEDIDO RÁPIDO CTA */}
        <PedidoRapidoCta palette={PALETTE} />

```

- [ ] **Step 6: Run the full `mypet` test suite and build**

Run: `pnpm --filter mypet test`
Expected: PASS (existing `loja/page.test.tsx` redirect test is untouched and still passes).

Run: `pnpm -r build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/app/loja/page.tsx apps/mypet/app/loja/pedido-rapido-cta.tsx apps/mypet/app/loja/pedido-rapido-cta.test.tsx
git commit -m "feat(mypet): CTA de Pedido Rápido no topo de /loja"
```
