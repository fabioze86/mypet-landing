# Distribuidora — compra pensada para WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Em `apps/distribuidora`, adicionar barra fixa de carrinho, card com stepper, busca ao digitar, preço/total no carrinho e na mensagem, e gravar o pedido (sem login) antes de abrir o WhatsApp.

**Architecture:** Componentes novos e opt-in em `@mypet/core` (`CartBar`, `CartStepperControl`, `CatalogSearchBox`, handler `createOrdersPostHandler`), ativados pela distribuidora via props. Mudanças em código compartilhado são aditivas (parâmetros opcionais com default = comportamento atual). Pedido gravado por rota de API server-side com service role, preço recalculado no servidor.

**Tech Stack:** Next.js 16.2.6 (App Router, `"use cache"`), React 19.2, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Vitest 4 + Testing Library, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-07-distribuidora-whatsapp-checkout-design.md`

## Global Constraints

- Trabalhar direto na `main` (sem worktree).
- Leia o guia relevante em `node_modules/next/dist/docs/` antes de usar uma API do Next (AGENTS.md). Já confirmado: `useRouter`/`usePathname` de `next/navigation`; evitar `useSearchParams` (exige Suspense em rota pré-renderizada) — a query inicial vem do servidor por prop.
- Outros apps (mypet, madpet, azpetshop, distribuidora-instagram) não podem mudar de comportamento: todo prop/parâmetro novo é opcional com default igual ao atual.
- Canal de preço: `clientConfig.catalogChannel` (`"mypetbrasil"`). Canal do pedido: `"distribuidora"` (já aceito por `orders_channel_check`).
- Projeto Supabase: `hsguyfiyqpuligijcjlw` (hub_catalogo).
- Formatação de moeda: sempre `formatPrice` de `packages/core/src/catalog-utils.ts` (gera `R$` + espaço não-quebrável). Nos testes, monte o esperado com `formatPrice(...)` em vez de digitar a string.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comandos de teste: core → `pnpm --filter @mypet/core test -- <arquivo>`; app → `pnpm --filter distribuidora test -- <arquivo>`.

## Desvios deliberados em relação à spec

- O handler fica em arquivo novo `packages/core/src/guest-orders-server.ts` (não em `orders-server.ts`), e a busca de preço é uma função privada dele (não `getChannelPrices` em `catalog.ts`). Motivo: `orders-server.ts` hoje não importa `next/headers`/clientes Supabase e seus testes injetam o client; misturar quebraria esse padrão. `catalog.ts` usa `"use cache"`, inadequado para preço de checkout.
- `CatalogProduct` ganha `hasVariants?: true`. No modo stepper, produto-pai mostra "Ver opções" (link para a página do produto) em vez de "Adicionar" — sem isso o stepper colocaria o pai no carrinho com o preço "A partir de". Há 21 produtos-pai ativos no canal.
- Variações adicionadas pela página do produto passam a levar `unitPrice` (hoje vão sem preço e apareceriam "a consultar" no total).
- `orders.number` começa em 1001.

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20261007120000_orders_guest_checkout.sql` | Criar | buyer_id opcional, colunas do cliente, `number`, `unit_price` |
| `packages/core/src/cart.ts` | Modificar | `cartTotals()` |
| `packages/core/src/whatsapp.ts` | Modificar | `buildQuoteMessage` com `options` (preços, número) |
| `packages/core/src/guest-orders-server.ts` | Criar | validação, preço no servidor, gravação, `createOrdersPostHandler` |
| `packages/core/package.json` | Modificar | export `./guest-orders-server` |
| `apps/distribuidora/app/api/pedidos/route.ts` | Criar | `POST` |
| `packages/core/src/catalog-utils.ts` / `catalog.ts` | Modificar | `hasVariants` |
| `packages/core/src/components/cart-stepper-control.tsx` | Criar | botão Adicionar ↔ stepper ligado ao carrinho |
| `packages/core/src/components/product-card.tsx` | Modificar | prop `addControl` |
| `packages/core/src/components/catalog-section.tsx` | Modificar | props `addControl`, `liveSearch` |
| `packages/core/src/components/variant-table.tsx`, `product-variant-panel.tsx` | Modificar | `unitPrice` nas variações |
| `packages/core/src/components/cart-bar.tsx` | Criar | barra fixa no rodapé |
| `apps/distribuidora/app/layout.tsx` | Modificar | monta `CartBar` |
| `packages/core/src/components/catalog-search-box.tsx` | Criar | busca ao digitar |
| `apps/distribuidora/app/page.tsx` | Modificar | busca no topo, stepper, liveSearch |
| `apps/distribuidora/app/cotacao/register-order.ts` | Criar | chamada à API + aplicação dos preços do servidor |
| `apps/distribuidora/app/cotacao/cotacao-content.tsx` / `page.tsx` | Modificar | preços, totais, fluxo de envio |

---

### Task 1: Migration de pedidos sem login

**Files:**
- Create: `supabase/migrations/20261007120000_orders_guest_checkout.sql`

**Interfaces:**
- Produces: colunas `orders.customer_name|customer_company|customer_whatsapp|customer_cnpj` (text, null), `orders.number` (bigint identity, único, começa em 1001), `orders.buyer_id` nullable, `order_items.unit_price numeric(12,2)` null.

- [ ] **Step 1: Escrever a migration**

```sql
-- Pedido sem login (distribuidora): o comprador é identificado pelos dados
-- digitados no carrinho; buyer_id só é preenchido quando há sessão.
alter table public.orders alter column buyer_id drop not null;

alter table public.orders
  add column customer_name text,
  add column customer_company text,
  add column customer_whatsapp text,
  add column customer_cnpj text,
  add column number bigint generated always as identity (start with 1001);

alter table public.orders add constraint orders_number_key unique (number);

-- Preço unitário calculado no servidor no momento do pedido (snapshot).
alter table public.order_items add column unit_price numeric(12,2);
```

- [ ] **Step 2: Aplicar no Supabase**

Confirmar com o usuário antes (é o banco de produção; a mudança é aditiva). Aplicar via MCP `apply_migration` no projeto `hsguyfiyqpuligijcjlw`, nome `orders_guest_checkout`, com o SQL acima.

- [ ] **Step 3: Verificar**

Via MCP `execute_sql`:
```sql
select column_name, is_nullable, data_type from information_schema.columns
where table_schema='public' and table_name in ('orders','order_items')
  and column_name in ('buyer_id','customer_name','number','unit_price');
select min(number), max(number), count(*) from orders;
```
Esperado: `buyer_id` `YES`; `number` preenchido nas linhas existentes (1001…1008).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261007120000_orders_guest_checkout.sql
git commit -m "feat(db): pedidos sem login com dados do cliente, número e preço unitário"
```

---

### Task 2: `cartTotals`

**Files:**
- Modify: `packages/core/src/cart.ts` (adicionar ao final)
- Test: `packages/core/src/cart.test.ts`

**Interfaces:**
- Produces: `export type CartTotals = { totalUnits: number; totalValue: number; pricedLines: number; unpricedLines: number }` e `export function cartTotals(items: CartItem[]): CartTotals` (`totalValue` arredondado em centavos).

- [ ] **Step 1: Teste que falha** — adicionar ao final de `cart.test.ts` (e incluir `cartTotals` no import existente de `./cart`):

```ts
describe("cartTotals", () => {
  const base = { name: "X", sku: "1", brand: null, img: "/x.jpg" };

  it("carrinho vazio zera tudo", () => {
    expect(cartTotals([])).toEqual({ totalUnits: 0, totalValue: 0, pricedLines: 0, unpricedLines: 0 });
  });

  it("soma unidades e valor dos itens com preço", () => {
    const totals = cartTotals([
      { ...base, id: "a", qty: 3, unitPrice: 9.9 },
      { ...base, id: "b", qty: 2, unitPrice: 0.1 },
    ]);
    expect(totals).toEqual({ totalUnits: 5, totalValue: 29.9, pricedLines: 2, unpricedLines: 0 });
  });

  it("itens sem preço entram nas unidades mas não no valor", () => {
    const totals = cartTotals([
      { ...base, id: "a", qty: 2, unitPrice: 10 },
      { ...base, id: "b", qty: 4 },
    ]);
    expect(totals).toEqual({ totalUnits: 6, totalValue: 20, pricedLines: 1, unpricedLines: 1 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- src/cart.test.ts`
Expected: FAIL — `cartTotals is not a function` / erro de import.

- [ ] **Step 3: Implementar** — final de `cart.ts`:

```ts
export type CartTotals = {
  totalUnits: number;
  totalValue: number;
  pricedLines: number;
  unpricedLines: number;
};

export function cartTotals(items: CartItem[]): CartTotals {
  const totals = items.reduce<CartTotals>(
    (acc, item) => {
      const priced = typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice);
      return {
        totalUnits: acc.totalUnits + item.qty,
        totalValue: priced ? acc.totalValue + (item.unitPrice as number) * item.qty : acc.totalValue,
        pricedLines: acc.pricedLines + (priced ? 1 : 0),
        unpricedLines: acc.unpricedLines + (priced ? 0 : 1),
      };
    },
    { totalUnits: 0, totalValue: 0, pricedLines: 0, unpricedLines: 0 },
  );
  return { ...totals, totalValue: Math.round(totals.totalValue * 100) / 100 };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- src/cart.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/cart.ts packages/core/src/cart.test.ts
git commit -m "feat(core): cartTotals com unidades, valor e linhas sem preço"
```

---

### Task 3: Mensagem do WhatsApp com preço, total e número

**Files:**
- Modify: `packages/core/src/whatsapp.ts:10-37` (`buildQuoteMessage`)
- Test: `packages/core/src/whatsapp.test.ts`

**Interfaces:**
- Consumes: `cartTotals` (Task 2), `formatPrice` de `./catalog-utils`.
- Produces: `export type QuoteMessageOptions = { showPrices?: boolean; orderNumber?: number }`; assinatura `buildQuoteMessage(items, customer, intro?, options?: QuoteMessageOptions)`.

- [ ] **Step 1: Testes que falham** — adicionar a `whatsapp.test.ts` (import `formatPrice` de `./catalog-utils`):

```ts
describe("buildQuoteMessage com options", () => {
  const items: CartItem[] = [
    { id: "p1", name: "COLEIRA P", sku: "COL-1", brand: null, img: "/1.jpg", qty: 12, unitPrice: 9.9 },
    { id: "p2", name: "GUIA M", sku: "", brand: null, img: "/2.jpg", qty: 2 },
  ];

  it("sem options mantém a saída atual", () => {
    expect(buildQuoteMessage(items, customer)).toBe(
      [
        "Olá! Gostaria de uma cotação de atacado:",
        "",
        "- COLEIRA P (SKU COL-1) — Qtd: 12",
        "- GUIA M — Qtd: 2",
        "",
        "Meus dados:",
        "Nome: João",
        "Empresa: Pet Shop X",
        "WhatsApp: 11999999999",
      ].join("\n"),
    );
  });

  it("com showPrices mostra preço por linha, a consultar e totais", () => {
    const message = buildQuoteMessage(items, customer, "Olá! Quero fazer este pedido:", { showPrices: true });
    expect(message).toContain(`- COLEIRA P (SKU COL-1) — 12 × ${formatPrice(9.9)} = ${formatPrice(118.8)}`);
    expect(message).toContain("- GUIA M — Qtd: 2 (a consultar)");
    expect(message).toContain("Total de unidades: 14");
    expect(message).toContain(`Total: ${formatPrice(118.8)} + itens a consultar`);
  });

  it("sem nenhum preço não mostra linha de Total", () => {
    const message = buildQuoteMessage([items[1]], customer, undefined, { showPrices: true });
    expect(message).toContain("Total de unidades: 2");
    expect(message).not.toContain("Total: ");
  });

  it("com orderNumber a primeira linha é o número do pedido", () => {
    const message = buildQuoteMessage(items, customer, "Olá! Quero fazer este pedido:", { showPrices: true, orderNumber: 1042 });
    expect(message.split("\n")[0]).toBe("Pedido #1042");
    expect(message.split("\n")[2]).toBe("Olá! Quero fazer este pedido:");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- src/whatsapp.test.ts` — Expected: FAIL nos testes de `showPrices`/`orderNumber`.

- [ ] **Step 3: Implementar** — substituir `buildQuoteMessage` e imports em `whatsapp.ts`:

```ts
import { cartTotals, type CartItem } from "./cart";
import { formatPrice } from "./catalog-utils";

export type QuoteMessageOptions = {
  /** Mostra preço por linha (ou "a consultar") e o bloco de totais. */
  showPrices?: boolean;
  /** Número do pedido gravado; vira a primeira linha da mensagem. */
  orderNumber?: number;
};

function quoteItemLine(item: CartItem, showPrices: boolean): string {
  const skuPart = item.sku ? ` (SKU ${item.sku})` : "";
  if (!showPrices) return `- ${item.name}${skuPart} — Qtd: ${item.qty}`;
  if (typeof item.unitPrice !== "number") return `- ${item.name}${skuPart} — Qtd: ${item.qty} (a consultar)`;
  const lineTotal = Math.round(item.unitPrice * item.qty * 100) / 100;
  return `- ${item.name}${skuPart} — ${item.qty} × ${formatPrice(item.unitPrice)} = ${formatPrice(lineTotal)}`;
}

function quoteTotalsLines(items: CartItem[]): string[] {
  const totals = cartTotals(items);
  const lines = ["", `Total de unidades: ${totals.totalUnits}`];
  if (totals.pricedLines > 0) {
    const pending = totals.unpricedLines > 0 ? " + itens a consultar" : "";
    lines.push(`Total: ${formatPrice(totals.totalValue)}${pending}`);
  }
  return lines;
}

export function buildQuoteMessage(
  items: CartItem[],
  customer: QuoteCustomer,
  intro = "Olá! Gostaria de uma cotação de atacado:",
  options: QuoteMessageOptions = {},
): string {
  const showPrices = options.showPrices === true;
  const itemLines = items.map((item) => quoteItemLine(item, showPrices)).join("\n");

  const customerLines = [
    `Nome: ${customer.nome}`,
    `Empresa: ${customer.empresa}`,
    `WhatsApp: ${customer.whatsapp}`,
  ];
  if (customer.cnpj) customerLines.push(`CNPJ: ${customer.cnpj}`);

  return [
    ...(options.orderNumber !== undefined ? [`Pedido #${options.orderNumber}`, ""] : []),
    intro,
    "",
    itemLines,
    ...(showPrices ? quoteTotalsLines(items) : []),
    "",
    "Meus dados:",
    ...customerLines,
  ].join("\n");
}
```

(Remover o `import type { CartItem } from "./cart";` antigo; `buildRetailQuoteMessage` e demais funções ficam iguais.)

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- src/whatsapp.test.ts` — Expected: PASS (inclusive os testes antigos).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/whatsapp.ts packages/core/src/whatsapp.test.ts
git commit -m "feat(core): mensagem de pedido com preço, totais e número"
```

---

### Task 4: Handler de pedido sem login + rota `/api/pedidos`

**Files:**
- Create: `packages/core/src/guest-orders-server.ts`
- Create: `packages/core/src/guest-orders-server.test.ts`
- Modify: `packages/core/package.json` (exports)
- Create: `apps/distribuidora/app/api/pedidos/route.ts`

**Interfaces:**
- Consumes: `getHubServiceClient` (`./supabase`), `createServerSupabaseClient` (`./supabase-server`), `salePriceFromChannelPrices`, `type RawChannelPrice` (`./catalog-utils`), `type Channel` (`./channels`). Migration da Task 1.
- Produces: `createOrdersPostHandler(opts: { orderChannel: Channel; priceChannel: string }): (req: NextRequest) => Promise<Response>`.
  - Corpo: `{ items: { id: string; qty: number }[]; customer: { nome: string; empresa: string; whatsapp: string; cnpj?: string } }`.
  - 200: `{ number: number; items: { id: string; unitPrice: number | null }[]; total: number }`.
  - 400/500: `{ error: string }`.

- [ ] **Step 1: Testes que falham** — `packages/core/src/guest-orders-server.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  products: [] as unknown[],
  productsError: null as null | { message: string },
  productsQuery: [] as unknown[][],
  orderInsert: vi.fn(),
  order: { id: "o1", number: 1042 } as { id: string; number: number },
  orderError: null as null | { message: string },
  itemsInsert: vi.fn(),
  itemsError: null as null | { message: string },
  orderDelete: vi.fn(),
  user: null as null | { id: string },
  buyer: null as null | { id: string },
}));

function productsChain() {
  const result = { data: state.productsError ? null : state.products, error: state.productsError };
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "in", "eq"]) {
    chain[method] = (...args: unknown[]) => {
      state.productsQuery.push([method, ...args]);
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

vi.mock("./supabase", () => ({
  getHubServiceClient: () => ({
    from: (table: string) => {
      if (table === "products") return productsChain();
      if (table === "orders") {
        return {
          insert: (row: unknown) => {
            state.orderInsert(row);
            return {
              select: () => ({
                single: async () => ({ data: state.orderError ? null : state.order, error: state.orderError }),
              }),
            };
          },
          delete: () => ({
            eq: async (column: string, value: string) => {
              state.orderDelete(column, value);
              return { error: null };
            },
          }),
        };
      }
      if (table === "order_items") {
        return {
          insert: async (rows: unknown) => {
            state.itemsInsert(rows);
            return { error: state.itemsError };
          },
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  }),
}));

vi.mock("./supabase-server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.buyer }) }) }) }),
  }),
}));

import { createOrdersPostHandler } from "./guest-orders-server";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const customer = { nome: "João", empresa: "Pet X", whatsapp: "11999999999", cnpj: "" };

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const POST = createOrdersPostHandler({ orderChannel: "distribuidora", priceChannel: "mypetbrasil" });

beforeEach(() => {
  state.products = [
    { id: P1, name: "Coleira P", product_channel_prices: [{ channel: "mypetbrasil", sale_price: "9.90" }] },
    { id: P2, name: "Guia M", product_channel_prices: [] },
  ];
  state.productsError = null;
  state.productsQuery = [];
  state.order = { id: "o1", number: 1042 };
  state.orderError = null;
  state.itemsError = null;
  state.user = null;
  state.buyer = null;
  state.orderInsert.mockReset();
  state.itemsInsert.mockReset();
  state.orderDelete.mockReset();
});

describe("createOrdersPostHandler — validação", () => {
  it.each([
    ["sem nome", { items: [{ id: P1, qty: 1 }], customer: { ...customer, nome: " " } }],
    ["carrinho vazio", { items: [], customer }],
    ["id inválido", { items: [{ id: "abc", qty: 1 }], customer }],
    ["qty zero", { items: [{ id: P1, qty: 0 }], customer }],
    ["qty fracionada", { items: [{ id: P1, qty: 1.5 }], customer }],
    ["qty acima do limite", { items: [{ id: P1, qty: 10000 }], customer }],
    ["corpo não é objeto", null],
  ])("responde 400 quando %s", async (_label, body) => {
    const res = await POST(fakeRequest(body));
    expect(res.status).toBe(400);
    expect(state.orderInsert).not.toHaveBeenCalled();
  });

  it("responde 400 quando há mais de 200 linhas", async () => {
    const items = Array.from({ length: 201 }, (_, i) => ({
      id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
      qty: 1,
    }));
    const res = await POST(fakeRequest({ items, customer }));
    expect(res.status).toBe(400);
  });

  it("responde 400 quando um produto não pertence ao canal", async () => {
    state.products = [state.products[0]];
    const res = await POST(fakeRequest({ items: [{ id: P1, qty: 1 }, { id: P2, qty: 1 }], customer }));
    expect(res.status).toBe(400);
    expect(state.orderInsert).not.toHaveBeenCalled();
  });
});

describe("createOrdersPostHandler — gravação", () => {
  it("grava com preço do servidor, canal do pedido e buyer nulo sem sessão", async () => {
    const res = await POST(
      fakeRequest({ items: [{ id: P1, qty: 12, unitPrice: 0.01 }, { id: P2, qty: 2 }], customer }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      number: 1042,
      items: [{ id: P1, unitPrice: 9.9 }, { id: P2, unitPrice: null }],
      total: 118.8,
    });
    expect(state.productsQuery).toContainEqual(["eq", "product_channel_links.channel", "mypetbrasil"]);
    expect(state.orderInsert).toHaveBeenCalledWith({
      buyer_id: null,
      channel: "distribuidora",
      status: "pendente",
      customer_name: "João",
      customer_company: "Pet X",
      customer_whatsapp: "11999999999",
      customer_cnpj: null,
    });
    expect(state.itemsInsert).toHaveBeenCalledWith([
      { order_id: "o1", product_id: P1, product_name_snapshot: "Coleira P", qty: 12, unit_price: 9.9 },
      { order_id: "o1", product_id: P2, product_name_snapshot: "Guia M", qty: 2, unit_price: null },
    ]);
  });

  it("soma linhas repetidas do mesmo produto", async () => {
    await POST(fakeRequest({ items: [{ id: P1, qty: 2 }, { id: P1, qty: 3 }], customer }));
    expect(state.itemsInsert).toHaveBeenCalledWith([
      { order_id: "o1", product_id: P1, product_name_snapshot: "Coleira P", qty: 5, unit_price: 9.9 },
    ]);
  });

  it("liga ao buyer quando há sessão com cadastro", async () => {
    state.user = { id: "u1" };
    state.buyer = { id: "u1" };
    await POST(fakeRequest({ items: [{ id: P1, qty: 1 }], customer }));
    expect(state.orderInsert).toHaveBeenCalledWith(expect.objectContaining({ buyer_id: "u1" }));
  });

  it("mantém buyer nulo quando há sessão sem cadastro em buyers", async () => {
    state.user = { id: "u1" };
    await POST(fakeRequest({ items: [{ id: P1, qty: 1 }], customer }));
    expect(state.orderInsert).toHaveBeenCalledWith(expect.objectContaining({ buyer_id: null }));
  });

  it("responde 500 quando a busca de preços falha", async () => {
    state.productsError = { message: "timeout" };
    const res = await POST(fakeRequest({ items: [{ id: P1, qty: 1 }], customer }));
    expect(res.status).toBe(500);
  });

  it("responde 500 quando o pedido não é criado", async () => {
    state.orderError = { message: "falhou" };
    const res = await POST(fakeRequest({ items: [{ id: P1, qty: 1 }], customer }));
    expect(res.status).toBe(500);
    expect(state.itemsInsert).not.toHaveBeenCalled();
  });

  it("apaga o pedido órfão quando os itens falham", async () => {
    state.itemsError = { message: "falhou" };
    const res = await POST(fakeRequest({ items: [{ id: P1, qty: 1 }], customer }));
    expect(res.status).toBe(500);
    expect(state.orderDelete).toHaveBeenCalledWith("id", "o1");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- src/guest-orders-server.test.ts`
Expected: FAIL — não resolve `./guest-orders-server`.

- [ ] **Step 3: Implementar** — `packages/core/src/guest-orders-server.ts`:

```ts
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHubServiceClient } from "./supabase";
import { createServerSupabaseClient } from "./supabase-server";
import { salePriceFromChannelPrices, type RawChannelPrice } from "./catalog-utils";
import type { Channel } from "./channels";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LINES = 200;
const MAX_QTY = 9999;
const ORDER_ERROR = "Não foi possível registrar seu pedido. Tente novamente em instantes.";

type GuestOrderLine = { id: string; qty: number };
type GuestCustomer = { nome: string; empresa: string; whatsapp: string; cnpj: string | null };
type GuestOrder = { items: GuestOrderLine[]; customer: GuestCustomer };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseGuestOrder(body: unknown): { ok: true; value: GuestOrder } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Pedido inválido." };
  const { items, customer } = body as { items?: unknown; customer?: Record<string, unknown> };

  const nome = text(customer?.nome);
  const empresa = text(customer?.empresa);
  const whatsapp = text(customer?.whatsapp);
  if (!nome || !empresa || !whatsapp) {
    return { ok: false, error: "Preencha nome, empresa e WhatsApp." };
  }

  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "O carrinho está vazio." };
  if (items.length > MAX_LINES) return { ok: false, error: "O pedido tem itens demais." };

  const qtyById = new Map<string, number>();
  for (const raw of items) {
    const id = text((raw as { id?: unknown })?.id);
    const qty = (raw as { qty?: unknown })?.qty;
    if (!UUID_RE.test(id) || typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return { ok: false, error: "Há um item inválido no carrinho." };
    }
    qtyById.set(id, (qtyById.get(id) ?? 0) + qty);
  }

  return {
    ok: true,
    value: {
      items: [...qtyById].map(([id, qty]) => ({ id, qty })),
      customer: { nome, empresa, whatsapp, cnpj: text(customer?.cnpj) || null },
    },
  };
}

type PricedProduct = { name: string; unitPrice: number | null };
type RawPricedRow = { id: string; name: string; product_channel_prices: RawChannelPrice[] | null };

async function getPricedProducts(
  supabase: SupabaseClient,
  ids: string[],
  channel: string,
): Promise<Map<string, PricedProduct> | null> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, product_channel_prices(channel, sale_price, sale_updated_at), product_channel_links!inner(channel)")
    .in("id", ids)
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel);

  if (error || !data) {
    console.error("[guest-orders] erro ao buscar preços:", error?.message);
    return null;
  }

  return new Map(
    (data as unknown as RawPricedRow[]).map((row) => [
      row.id,
      { name: row.name, unitPrice: salePriceFromChannelPrices(row.product_channel_prices) },
    ]),
  );
}

// Só liga o pedido ao buyer quando há sessão E cadastro em `buyers`
// (orders.buyer_id tem FK para buyers.id).
async function currentBuyerId(): Promise<string | null> {
  try {
    const auth = await createServerSupabaseClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return null;
    const { data: buyer } = await auth.from("buyers").select("id").eq("id", user.id).maybeSingle();
    return buyer ? user.id : null;
  } catch {
    return null;
  }
}

export function createOrdersPostHandler(opts: { orderChannel: Channel; priceChannel: string }) {
  return async function POST(req: NextRequest): Promise<Response> {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Pedido inválido." }, { status: 400 });
    }

    const parsed = parseGuestOrder(body);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    const { items, customer } = parsed.value;

    const supabase = getHubServiceClient();
    const priced = await getPricedProducts(supabase, items.map((item) => item.id), opts.priceChannel);
    if (!priced) return Response.json({ error: ORDER_ERROR }, { status: 500 });

    if (items.some((item) => !priced.has(item.id))) {
      return Response.json(
        { error: "Um dos produtos não está mais disponível. Remova-o do carrinho e tente novamente." },
        { status: 400 },
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        buyer_id: await currentBuyerId(),
        channel: opts.orderChannel,
        status: "pendente",
        customer_name: customer.nome,
        customer_company: customer.empresa,
        customer_whatsapp: customer.whatsapp,
        customer_cnpj: customer.cnpj,
      })
      .select("id, number")
      .single();

    if (orderError || !order) {
      console.error("[guest-orders] erro ao criar pedido:", orderError?.message);
      return Response.json({ error: ORDER_ERROR }, { status: 500 });
    }

    const lines = items.map((item) => {
      const product = priced.get(item.id) as PricedProduct;
      return { ...item, name: product.name, unitPrice: product.unitPrice };
    });

    const { error: itemsError } = await supabase.from("order_items").insert(
      lines.map((line) => ({
        order_id: order.id,
        product_id: line.id,
        product_name_snapshot: line.name,
        qty: line.qty,
        unit_price: line.unitPrice,
      })),
    );

    if (itemsError) {
      console.error("[guest-orders] erro ao gravar itens:", itemsError.message);
      await supabase.from("orders").delete().eq("id", order.id);
      return Response.json({ error: ORDER_ERROR }, { status: 500 });
    }

    const total = lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.qty, 0);
    return Response.json({
      number: Number(order.number),
      items: lines.map((line) => ({ id: line.id, unitPrice: line.unitPrice })),
      total: Math.round(total * 100) / 100,
    });
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- src/guest-orders-server.test.ts` — Expected: PASS.

- [ ] **Step 5: Export e rota**

Em `packages/core/package.json`, dentro de `exports`, logo após `"./features"`:
```json
    "./guest-orders-server": "./src/guest-orders-server.ts",
```

Criar `apps/distribuidora/app/api/pedidos/route.ts`:
```ts
import { createOrdersPostHandler } from "@mypet/core/guest-orders-server";
import { clientConfig } from "@/client.config";

// Preço vem do catálogo (mypetbrasil); o pedido fica marcado como da
// distribuidora para não se misturar com os pedidos do app mypet.
export const POST = createOrdersPostHandler({
  orderChannel: "distribuidora",
  priceChannel: clientConfig.catalogChannel,
});
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter distribuidora exec tsc --noEmit` — Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/guest-orders-server.ts packages/core/src/guest-orders-server.test.ts packages/core/package.json apps/distribuidora/app/api/pedidos/route.ts
git commit -m "feat(distribuidora): grava pedido sem login com preço do servidor"
```

---

### Task 5: Card com stepper ("Adicionar" → `− N +`)

**Files:**
- Modify: `packages/core/src/catalog-utils.ts` (tipo `CatalogProduct`)
- Modify: `packages/core/src/catalog.ts` (`applyStartingVariantPrices`)
- Modify: `packages/core/src/catalog.test.ts`
- Create: `packages/core/src/components/cart-stepper-control.tsx`
- Create: `packages/core/src/components/cart-stepper-control.test.tsx`
- Modify: `packages/core/src/components/product-card.tsx`
- Modify: `packages/core/src/components/catalog-section.tsx`
- Modify: `packages/core/src/components/variant-table.tsx:57-59`, `packages/core/src/components/product-variant-panel.tsx:90-92,197`

**Interfaces:**
- Consumes: `useCart` (`cart`, `addItem`, `updateQty`), `useClientConfig`.
- Produces:
  - `CatalogProduct.hasVariants?: true`
  - `export function CartStepperControl({ product }: { product: Omit<CartItem, "qty"> })`
  - `ProductCard` prop `addControl?: "default" | "stepper"`
  - `CatalogSection` prop `addControl?: "default" | "stepper"` (repassa ao card)

- [ ] **Step 1: Teste do `hasVariants` (falha)** — em `catalog.test.ts`, no teste que espera `priceLabel: "A partir de R$ 59,90"`, trocar o `toMatchObject` por:

```ts
    expect(result.items[0]).toMatchObject({
      salePrice: 59.9,
      priceLabel: "A partir de R$ 59,90",
      hasVariants: true,
    });
```
E no primeiro teste de `describe("queryCatalog")` (o que chama `queryCatalog({ q: "ração", brand: "NAPI", page: 2, channel: "mypetbrasil" })`), adicionar ao final:
```ts
    for (const item of result.items) expect(item.hasVariants).toBeUndefined();
```
(Se o teste não guarda o retorno em `result`, guardar: `const result = await queryCatalog(...)`.)

Run: `pnpm --filter @mypet/core test -- src/catalog.test.ts` — Expected: FAIL em `hasVariants: true`.

- [ ] **Step 2: Implementar `hasVariants`**

Em `catalog-utils.ts`, no tipo `CatalogProduct`, após `priceLabel: string | null;`:
```ts
  /** Produto-pai com variações no canal: escolha de variação acontece na página do produto. */
  hasVariants?: true;
```

Em `catalog.ts`, dentro de `applyStartingVariantPrices`, substituir do `const lowestPriceByParent` até o `return items.map(...)` final por:
```ts
  const lowestPriceByParent = new Map<string, number>();
  const parentsWithVariants = new Set<string>();

  for (const variant of variants) {
    if (!variant.parent_product_id) continue;
    parentsWithVariants.add(variant.parent_product_id);
    const raw = variant.product_channel_prices?.find((price) => price.sale_price != null)?.sale_price;
    const rawPrice = raw == null ? null : Number(raw);
    if (rawPrice == null || !Number.isFinite(rawPrice)) continue;

    const currentLowest = lowestPriceByParent.get(variant.parent_product_id);
    if (currentLowest == null || rawPrice < currentLowest) {
      lowestPriceByParent.set(variant.parent_product_id, rawPrice);
    }
  }

  return items.map((item) => {
    const flagged = parentsWithVariants.has(item.id) ? { ...item, hasVariants: true as const } : item;
    const lowestPrice = lowestPriceByParent.get(item.id);
    return lowestPrice == null
      ? flagged
      : { ...flagged, salePrice: lowestPrice, priceLabel: `A partir de ${formatPrice(lowestPrice)}` };
  });
```

Run: `pnpm --filter @mypet/core test -- src/catalog.test.ts` — Expected: PASS.

- [ ] **Step 3: Teste do `CartStepperControl` (falha)** — `packages/core/src/components/cart-stepper-control.test.tsx`:

```tsx
// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CartProvider } from "./cart-provider";
import { ClientConfigProvider, type ClientConfig } from "../theme";
import { CartStepperControl } from "./cart-stepper-control";

const config: ClientConfig = {
  name: "Teste", tagline: "t", domain: "t.com", catalogChannel: "mypetbrasil", logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#0a5", pinkDark: "#084", pinkLight: "#efe", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

const product = { id: "p1", name: "Coleira P", sku: "COL-1", brand: null, img: "/c.jpg", unitPrice: 9.9 };

function renderControl() {
  return render(
    createElement(ClientConfigProvider, { config },
      createElement(CartProvider, null, createElement(CartStepperControl, { product }))),
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("CartStepperControl", () => {
  it("mostra Adicionar quando o item não está no carrinho", () => {
    renderControl();
    expect(screen.getByRole("button", { name: "Adicionar Coleira P" })).toBeInTheDocument();
  });

  it("vira stepper ao adicionar e acompanha a quantidade do carrinho", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Coleira P" }));
    expect(screen.getByText("1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("mypet_cart") ?? "{}").items[0]).toMatchObject({ id: "p1", qty: 2, unitPrice: 9.9 });
  });

  it("remove do carrinho ao diminuir de 1 para 0", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Coleira P" }));
    fireEvent.click(screen.getByRole("button", { name: "Diminuir quantidade" }));
    expect(screen.getByRole("button", { name: "Adicionar Coleira P" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("mypet_cart") ?? "{}").items).toEqual([]);
  });
});
```

Run: `pnpm --filter @mypet/core test -- src/components/cart-stepper-control.test.tsx` — Expected: FAIL (módulo não existe).

- [ ] **Step 4: Implementar** — `packages/core/src/components/cart-stepper-control.tsx`:

```tsx
"use client";

import { useClientConfig } from "../theme";
import { useCart } from "./cart-provider";
import type { CartItem } from "../cart";

// Controle "adicionar e pronto": sem o item no carrinho mostra "Adicionar";
// com o item vira − N + ligado direto ao carrinho (N = quantidade no carrinho).
export function CartStepperControl({ product }: { product: Omit<CartItem, "qty"> }) {
  const { cart, addItem, updateQty } = useCart();
  const { palette } = useClientConfig();
  const qty = cart.items.find((item) => item.id === product.id && item.campaignId === undefined)?.qty ?? 0;

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => addItem(product, 1)}
        aria-label={`Adicionar ${product.name}`}
        style={{
          width: "100%",
          height: 38,
          marginTop: 8,
          background: palette.pink,
          color: palette.white,
          border: "none",
          borderRadius: 10,
          fontFamily: "var(--font-nunito), sans-serif",
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Adicionar
      </button>
    );
  }

  const stepButton: React.CSSProperties = {
    width: 38,
    height: 38,
    border: "none",
    background: "transparent",
    color: palette.white,
    fontSize: 20,
    fontWeight: 800,
    cursor: "pointer",
  };

  return (
    <div
      role="group"
      aria-label={`Quantidade de ${product.name} no carrinho`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 8,
        height: 38,
        background: palette.pinkDark,
        borderRadius: 10,
      }}
    >
      <button type="button" aria-label="Diminuir quantidade" onClick={() => updateQty(product.id, qty - 1)} style={stepButton}>
        −
      </button>
      <span aria-live="polite" style={{ color: palette.white, fontSize: 15, fontWeight: 900 }}>{qty}</span>
      <button type="button" aria-label="Aumentar quantidade" onClick={() => updateQty(product.id, qty + 1)} style={stepButton}>
        +
      </button>
    </div>
  );
}
```

Run: `pnpm --filter @mypet/core test -- src/components/cart-stepper-control.test.tsx` — Expected: PASS.

- [ ] **Step 5: `ProductCard` e `CatalogSection` com `addControl`**

Em `product-card.tsx`:
- import: `import { CartStepperControl } from "./cart-stepper-control";`
- assinatura: `export function ProductCard({ product, addControl = "default" }: { product: CatalogProduct; addControl?: "default" | "stepper" }) {`
- substituir o bloco `<AddToCartControl ... compact />` (linhas 73-83) por:

```tsx
        {(() => {
          const cartProduct = {
            id: product.id,
            name: product.name,
            sku: product.sku,
            brand: product.brand,
            img: product.img,
            unitPrice: product.salePrice ?? undefined,
          };
          if (addControl !== "stepper") return <AddToCartControl product={cartProduct} compact />;
          if (product.hasVariants) {
            return (
              <Link
                href={`/produtos/${product.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 38,
                  marginTop: 8,
                  border: `1.5px solid ${palette.pink}`,
                  borderRadius: 10,
                  color: palette.pink,
                  fontSize: 14,
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                Ver opções
              </Link>
            );
          }
          return <CartStepperControl product={cartProduct} />;
        })()}
```

Em `catalog-section.tsx`: adicionar `addControl` aos props (`addControl?: "default" | "stepper";` no tipo e `addControl = "default",` na desestruturação) e trocar `<ProductCard key={product.id} product={product} />` por `<ProductCard key={product.id} product={product} addControl={addControl} />`.

- [ ] **Step 6: `unitPrice` nas variações**

`variant-table.tsx` linha 58:
```tsx
              product={{ id: variant.id, name: variant.name, sku: variant.sku, brand, img: variant.img, unitPrice: variant.salePrice ?? undefined }}
```

`product-variant-panel.tsx`, logo após a linha 92 (`const priceLabel = ...`):
```tsx
  const unitPrice = product.variants.find((variant) => variant.id === cartId)?.salePrice ?? product.salePrice ?? undefined;
```
e na linha 197:
```tsx
              <AddToCartControl product={{ id: cartId, name: cartName, sku, brand: product.brand, img, unitPrice }} />
```

- [ ] **Step 7: Rodar a suíte do core e typecheck**

Run: `pnpm --filter @mypet/core test` — Expected: PASS (todos).
Run: `pnpm --filter distribuidora exec tsc --noEmit` — Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): card com stepper ligado ao carrinho (opt-in) e preço nas variações"
```

---

### Task 6: Barra fixa de carrinho

**Files:**
- Create: `packages/core/src/components/cart-bar.tsx`
- Create: `packages/core/src/components/cart-bar.test.tsx`
- Modify: `apps/distribuidora/app/layout.tsx`

**Interfaces:**
- Consumes: `cartTotals` (Task 2), `formatPrice`, `useCart`, `useClientConfig`, `usePathname`.
- Produces: `export function CartBar({ href }: { href?: string })` (default `"/cotacao"`).

- [ ] **Step 1: Teste que falha** — `packages/core/src/components/cart-bar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatPrice } from "../catalog-utils";
import type { CartItem } from "../cart";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const cart = vi.hoisted(() => ({ items: [] as CartItem[] }));
vi.mock("./cart-provider", () => ({ useCart: () => ({ cart }) }));

import { ClientConfigProvider, type ClientConfig } from "../theme";
import { CartBar } from "./cart-bar";

const config: ClientConfig = {
  name: "Teste", tagline: "t", domain: "t.com", catalogChannel: "mypetbrasil", logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#0a5", pinkDark: "#084", pinkLight: "#efe", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

const base = { sku: "1", brand: null, img: "/x.jpg" };

function renderBar() {
  return render(createElement(ClientConfigProvider, { config }, createElement(CartBar)));
}

beforeEach(() => {
  nav.pathname = "/";
  cart.items = [];
});
afterEach(() => cleanup());

describe("CartBar", () => {
  it("não aparece com carrinho vazio", () => {
    renderBar();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("não aparece na própria página do carrinho", () => {
    cart.items = [{ ...base, id: "a", name: "A", qty: 1, unitPrice: 10 }];
    nav.pathname = "/cotacao";
    renderBar();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("mostra unidades, total e leva ao carrinho", () => {
    cart.items = [
      { ...base, id: "a", name: "A", qty: 2, unitPrice: 10 },
      { ...base, id: "b", name: "B", qty: 1, unitPrice: 5.5 },
    ];
    renderBar();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/cotacao");
    expect(link).toHaveTextContent(`3 itens · ${formatPrice(25.5)}`);
    expect(link).toHaveTextContent("Enviar pedido →");
  });

  it("avisa quando há itens sem preço", () => {
    cart.items = [
      { ...base, id: "a", name: "A", qty: 1, unitPrice: 10 },
      { ...base, id: "b", name: "B", qty: 1 },
    ];
    renderBar();
    expect(screen.getByRole("link")).toHaveTextContent("+ itens a consultar");
  });

  it("sem nenhum preço mostra só as unidades", () => {
    cart.items = [{ ...base, id: "b", name: "B", qty: 1 }];
    renderBar();
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("1 item");
    expect(link).not.toHaveTextContent("R$");
  });
});
```

Run: `pnpm --filter @mypet/core test -- src/components/cart-bar.test.tsx` — Expected: FAIL (módulo não existe).

- [ ] **Step 2: Implementar** — `packages/core/src/components/cart-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClientConfig } from "../theme";
import { useCart } from "./cart-provider";
import { cartTotals } from "../cart";
import { formatPrice } from "../catalog-utils";

const BAR_HEIGHT = 60;

// Barra fixa no rodapé com unidades e total do carrinho; o espaçador no fluxo
// evita que a barra cubra o fim da página.
export function CartBar({ href = "/cotacao" }: { href?: string }) {
  const { cart } = useCart();
  const { palette } = useClientConfig();
  const pathname = usePathname();
  const totals = cartTotals(cart.items);

  if (totals.totalUnits === 0 || pathname === href) return null;

  const unitsLabel = `${totals.totalUnits} ${totals.totalUnits === 1 ? "item" : "itens"}`;
  const valueLabel = totals.pricedLines > 0 ? ` · ${formatPrice(totals.totalValue)}` : "";
  const pendingLabel = totals.pricedLines > 0 && totals.unpricedLines > 0 ? " + itens a consultar" : "";

  return (
    <>
      <div aria-hidden style={{ height: `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom))` }} />
      <Link
        href={href}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          minHeight: BAR_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 20px calc(12px + env(safe-area-inset-bottom))",
          background: palette.pink,
          color: palette.white,
          textDecoration: "none",
          fontFamily: "var(--font-nunito), sans-serif",
          fontSize: 15,
          fontWeight: 800,
          boxShadow: "0 -6px 20px rgba(15,31,69,0.18)",
        }}
      >
        <span>
          {unitsLabel}
          {valueLabel}
          {pendingLabel && <span style={{ fontWeight: 600, opacity: 0.9 }}>{pendingLabel}</span>}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>Enviar pedido →</span>
      </Link>
    </>
  );
}
```

Run: `pnpm --filter @mypet/core test -- src/components/cart-bar.test.tsx` — Expected: PASS.

- [ ] **Step 3: Montar no layout** — `apps/distribuidora/app/layout.tsx`:

import:
```tsx
import { CartBar } from "@mypet/core/components/cart-bar";
```
trocar `<CartProvider>{children}</CartProvider>` por:
```tsx
          <CartProvider>
            {children}
            <CartBar />
          </CartProvider>
```

Observação: o `InstallPrompt` também é fixo no rodapé (z-50) e fica por cima da barra até ser dispensado — comportamento aceito.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm --filter distribuidora exec tsc --noEmit` — Expected: sem erros.

```bash
git add packages/core/src/components/cart-bar.tsx packages/core/src/components/cart-bar.test.tsx apps/distribuidora/app/layout.tsx
git commit -m "feat(distribuidora): barra fixa de carrinho com total no rodapé"
```

---

### Task 7: Busca ao digitar e home com busca primeiro

**Files:**
- Create: `packages/core/src/components/catalog-search-box.tsx`
- Create: `packages/core/src/components/catalog-search-box.test.tsx`
- Modify: `packages/core/src/components/catalog-section.tsx`
- Modify: `apps/distribuidora/app/page.tsx`

**Interfaces:**
- Consumes: `buildCatalogQuery` (`../querystring`), `useRouter`/`usePathname` (`next/navigation`); `CatalogSection` prop `addControl` (Task 5).
- Produces: `export function CatalogSearchBox({ initialQuery, brand, debounceMs }: { initialQuery?: string; brand?: string; debounceMs?: number })`; `CatalogSection` prop `liveSearch?: boolean`.

- [ ] **Step 1: Teste que falha** — `packages/core/src/components/catalog-search-box.test.tsx`:

```tsx
// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/",
}));

import { ClientConfigProvider, type ClientConfig } from "../theme";
import { CatalogSearchBox } from "./catalog-search-box";

const config: ClientConfig = {
  name: "Teste", tagline: "t", domain: "t.com", catalogChannel: "mypetbrasil", logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#0a5", pinkDark: "#084", pinkLight: "#efe", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

function renderBox(props: { initialQuery?: string; brand?: string } = {}) {
  return render(createElement(ClientConfigProvider, { config }, createElement(CatalogSearchBox, props)));
}

beforeEach(() => {
  vi.useFakeTimers();
  nav.replace.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CatalogSearchBox", () => {
  it("começa com a busca atual", () => {
    renderBox({ initialQuery: "coleira" });
    expect(screen.getByRole("searchbox", { name: "Buscar produtos" })).toHaveValue("coleira");
  });

  it("atualiza a URL só depois da pausa na digitação, voltando à página 1", () => {
    renderBox({ brand: "NAPI" });
    const input = screen.getByRole("searchbox", { name: "Buscar produtos" });
    fireEvent.change(input, { target: { value: "co" } });
    fireEvent.change(input, { target: { value: "coleira" } });
    expect(nav.replace).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(300); });

    expect(nav.replace).toHaveBeenCalledOnce();
    expect(nav.replace).toHaveBeenCalledWith("/?q=coleira&brand=NAPI", { scroll: false });
  });

  it("campo vazio remove o q", () => {
    renderBox({ initialQuery: "coleira" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar produtos" }), { target: { value: "  " } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(nav.replace).toHaveBeenCalledWith("/", { scroll: false });
  });
});
```

Run: `pnpm --filter @mypet/core test -- src/components/catalog-search-box.test.tsx` — Expected: FAIL (módulo não existe).

- [ ] **Step 2: Implementar** — `packages/core/src/components/catalog-search-box.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useClientConfig } from "../theme";
import { buildCatalogQuery } from "../querystring";

// Busca ao digitar: atualiza ?q= após uma pausa (a grade é renderizada no
// servidor a partir dos searchParams). A query inicial vem por prop para não
// depender de useSearchParams (que exigiria Suspense na rota pré-renderizada).
export function CatalogSearchBox({
  initialQuery = "",
  brand,
  debounceMs = 300,
}: {
  initialQuery?: string;
  brand?: string;
  debounceMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { palette } = useClientConfig();
  const [value, setValue] = useState(initialQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const handleChange = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const query = buildCatalogQuery({ q: next.trim() || undefined, brand });
      router.replace(`${pathname}${query}`, { scroll: false });
    }, debounceMs);
  };

  return (
    <div className="catalog-search" style={{ position: "sticky", top: 64, zIndex: 90, background: palette.gray50, padding: "10px 16px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <input
          type="search"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="Buscar produtos…"
          aria-label="Buscar produtos"
          enterKeyHint="search"
          autoComplete="off"
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: `1.5px solid ${palette.gray200}`,
            background: palette.white,
            fontSize: 16,
            color: palette.gray800,
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}
```

(Nota: `top: 64` = altura do `SiteNav` no desktop; o mobile (56px) é ajustado por CSS na home, Step 4. `fontSize: 16` evita zoom automático no iOS.)

Run: `pnpm --filter @mypet/core test -- src/components/catalog-search-box.test.tsx` — Expected: PASS.

- [ ] **Step 3: `liveSearch` no `CatalogSection`**

Em `catalog-section.tsx`: adicionar `liveSearch?: boolean;` ao tipo dos props e `liveSearch = false,` na desestruturação; envolver o `<form method="get" ...>...</form>` inteiro com `{!liveSearch && ( ... )}`. Nada mais muda (contagem, grade e paginação continuam).

- [ ] **Step 4: Home da distribuidora** — `apps/distribuidora/app/page.tsx`:

1. Import: `import { CatalogSearchBox } from "@mypet/core/components/catalog-search-box";`
2. Novo componente (acima de `generateMetadata`):

```tsx
async function SearchSlot({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string }>;
}) {
  const sp = await searchParams;
  return <CatalogSearchBox key={sp.q ?? ""} initialQuery={sp.q} brand={sp.brand} />;
}
```

(O `key` reinicia o campo quando a busca muda por navegação externa, ex.: voltar no histórico.)

3. Em `CatalogContent`, trocar `<CatalogSection q={q} brand={brand} page={page} channel={channel} palette={palette} />` por:

```tsx
      <CatalogSection q={q} brand={brand} page={page} channel={channel} palette={palette} addControl="stepper" liveSearch />
```

4. No JSX de `Home`, entre `<SiteNav categories={categories} />` e `<CategoryChips categories={categories} />`, inserir:

```tsx
        {/* BUSCA — primeiro elemento abaixo da navegação */}
        <Suspense fallback={<CatalogSearchBox />}>
          <SearchSlot searchParams={searchParams} />
        </Suspense>
```

5. No bloco `@media (max-width: 640px)` do `<style>` da home, adicionar uma regra separada para o breakpoint do nav:

```css
        @media (max-width: 768px) {
          .catalog-search { top: 56px !important; }
        }
```

6. No `DynamicCatalog`, reduzir o espaço do topo: `padding: "24px 24px 80px"` → `padding: "16px 16px 80px"` (só no `<section id="catalogo">` de `DynamicCatalog`; o fallback pode ficar igual).

Estatísticas, bloco de marketing e rodapé ficam como estão (no fim).

- [ ] **Step 5: Verificar**

Run: `pnpm --filter @mypet/core test` — Expected: PASS.
Run: `pnpm --filter distribuidora exec tsc --noEmit` — Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/catalog-search-box.tsx packages/core/src/components/catalog-search-box.test.tsx packages/core/src/components/catalog-section.tsx apps/distribuidora/app/page.tsx
git commit -m "feat(distribuidora): busca ao digitar no topo e card com stepper na home"
```

---

### Task 8: Carrinho com preços, totais e envio que grava o pedido

**Files:**
- Create: `apps/distribuidora/app/cotacao/register-order.ts`
- Create: `apps/distribuidora/app/cotacao/register-order.test.ts`
- Modify: `apps/distribuidora/app/cotacao/cotacao-content.tsx` (reescrita)
- Modify: `apps/distribuidora/app/cotacao/cotacao-content.test.tsx` (reescrita)
- Modify: `apps/distribuidora/app/cotacao/page.tsx` (título)

**Interfaces:**
- Consumes: `POST /api/pedidos` (Task 4), `cartTotals` (Task 2), `buildQuoteMessage(..., options)` (Task 3), `formatPrice`, `useCart().clear`.
- Produces:
  - `type RegisterOrderResult = { kind: "ok"; number: number; prices: Map<string, number | null> } | { kind: "invalid"; error: string } | { kind: "failed" }`
  - `registerOrder(items: CartItem[], customer: QuoteCustomer, fetchImpl?: typeof fetch): Promise<RegisterOrderResult>`
  - `applyServerPrices(items: CartItem[], prices: Map<string, number | null>): CartItem[]`

- [ ] **Step 1: Teste do `registerOrder` (falha)** — `apps/distribuidora/app/cotacao/register-order.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { CartItem } from "@mypet/core/cart";
import { applyServerPrices, registerOrder } from "./register-order";

const items: CartItem[] = [
  { id: "p1", name: "Coleira", sku: "COL-1", brand: null, img: "/c.jpg", qty: 2, unitPrice: 1 },
  { id: "p2", name: "Guia", sku: "", brand: null, img: "/g.jpg", qty: 1 },
];
const customer = { nome: "Fabio", empresa: "My Pet", whatsapp: "11999999999", cnpj: "" };

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("registerOrder", () => {
  it("envia só id e qty e devolve número e preços do servidor", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { number: 1042, items: [{ id: "p1", unitPrice: 9.9 }, { id: "p2", unitPrice: null }], total: 19.8 }),
    );

    const result = await registerOrder(items, customer, fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/pedidos");
    expect(JSON.parse(init.body)).toEqual({ items: [{ id: "p1", qty: 2 }, { id: "p2", qty: 1 }], customer });
    expect(result).toEqual({ kind: "ok", number: 1042, prices: new Map([["p1", 9.9], ["p2", null]]) });
  });

  it("400 vira erro de validação com a mensagem do servidor", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { error: "Preencha nome, empresa e WhatsApp." }));
    expect(await registerOrder(items, customer, fetchImpl)).toEqual({ kind: "invalid", error: "Preencha nome, empresa e WhatsApp." });
  });

  it("5xx e erro de rede viram falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await registerOrder(items, customer, vi.fn().mockResolvedValue(jsonResponse(500, { error: "x" })))).toEqual({ kind: "failed" });
    expect(await registerOrder(items, customer, vi.fn().mockRejectedValue(new Error("offline")))).toEqual({ kind: "failed" });
  });
});

describe("applyServerPrices", () => {
  it("substitui o preço do carrinho pelo do servidor (null vira sem preço)", () => {
    const result = applyServerPrices(items, new Map([["p1", 9.9], ["p2", null]]));
    expect(result[0].unitPrice).toBe(9.9);
    expect(result[1].unitPrice).toBeUndefined();
  });
});
```

Run: `pnpm --filter distribuidora test -- app/cotacao/register-order.test.ts` — Expected: FAIL (módulo não existe).

- [ ] **Step 2: Implementar** — `apps/distribuidora/app/cotacao/register-order.ts`:

```ts
import type { CartItem } from "@mypet/core/cart";
import type { QuoteCustomer } from "@mypet/core/whatsapp";

export type RegisterOrderResult =
  | { kind: "ok"; number: number; prices: Map<string, number | null> }
  | { kind: "invalid"; error: string }
  | { kind: "failed" };

// Grava o pedido antes de abrir o WhatsApp. Só "invalid" deve impedir o envio;
// em "failed" (rede/5xx) o pedido segue pelo WhatsApp sem número.
export async function registerOrder(
  items: CartItem[],
  customer: QuoteCustomer,
  fetchImpl: typeof fetch = fetch,
): Promise<RegisterOrderResult> {
  try {
    const res = await fetchImpl("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map((item) => ({ id: item.id, qty: item.qty })), customer }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && typeof data.number === "number") {
      const prices = new Map<string, number | null>(
        ((data.items ?? []) as { id: string; unitPrice: number | null }[]).map((item) => [item.id, item.unitPrice]),
      );
      return { kind: "ok", number: data.number, prices };
    }
    if (res.status === 400) {
      return { kind: "invalid", error: typeof data.error === "string" ? data.error : "Confira os dados e tente novamente." };
    }
    console.error("[cotacao] falha ao registrar pedido:", res.status, data?.error);
    return { kind: "failed" };
  } catch (error) {
    console.error("[cotacao] falha ao registrar pedido:", error);
    return { kind: "failed" };
  }
}

export function applyServerPrices(items: CartItem[], prices: Map<string, number | null>): CartItem[] {
  return items.map((item) =>
    prices.has(item.id) ? { ...item, unitPrice: prices.get(item.id) ?? undefined } : item,
  );
}
```

Run: `pnpm --filter distribuidora test -- app/cotacao/register-order.test.ts` — Expected: PASS.

- [ ] **Step 3: Teste do `CotacaoContent` (falha)** — substituir todo `apps/distribuidora/app/cotacao/cotacao-content.test.tsx` por:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Palette } from "@mypet/core/theme";
import { formatPrice } from "@mypet/core/catalog-utils";

const mocks = vi.hoisted(() => ({
  removeItem: vi.fn(),
  updateQty: vi.fn(),
  clear: vi.fn(),
  registerOrder: vi.fn(),
}));

vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({
    cart: {
      items: [
        { id: "p1", name: "Coleira", qty: 2, img: "/coleira.jpg", brand: "MadPet", sku: "COL-1", unitPrice: 10 },
        { id: "p2", name: "Guia", qty: 1, img: "/guia.jpg", brand: null, sku: "" },
      ],
    },
    removeItem: mocks.removeItem,
    updateQty: mocks.updateQty,
    clear: mocks.clear,
  }),
}));

vi.mock("./register-order", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./register-order")>()),
  registerOrder: mocks.registerOrder,
}));

import { CotacaoContent } from "./cotacao-content";

const palette = {
  white: "#fff", gray50: "#fafafa", gray100: "#f5f5f5", gray200: "#e5e5e5", gray400: "#a3a3a3",
  gray600: "#525252", gray800: "#262626", navy: "#111827", orange: "#b45309", pink: "#7144a4",
} as Palette;

function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "Fabio" } });
  fireEvent.change(screen.getByPlaceholderText("Nome do pet shop / empresa"), { target: { value: "My Pet" } });
  fireEvent.change(screen.getByPlaceholderText("WhatsApp com DDD"), { target: { value: "11999999999" } });
  fireEvent.click(screen.getByRole("button", { name: /Enviar pedido pelo WhatsApp/i }));
}

function sentMessage(open: ReturnType<typeof vi.spyOn>) {
  const [url, target] = open.mock.calls[0];
  expect(target).toBe("_self");
  expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  return decodeURIComponent(String(url).split("?text=")[1]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CotacaoContent", () => {
  it("mostra subtotal por linha, a consultar e o total", () => {
    render(<CotacaoContent palette={palette} />);
    // R$ 20,00 aparece no subtotal da Coleira e no total.
    expect(screen.getAllByText(formatPrice(20) as string).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("a consultar")).toBeInTheDocument();
    expect(screen.getByText("Total de unidades")).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent(formatPrice(20) as string);
    expect(screen.getByText(/Itens sem preço serão confirmados pelo atendente/)).toBeInTheDocument();
  });

  it("grava o pedido e abre o WhatsApp com número e preço do servidor", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "ok", number: 1042, prices: new Map([["p1", 12], ["p2", null]]) });

    render(<CotacaoContent palette={palette} />);
    await act(async () => fillAndSubmit());

    expect(mocks.registerOrder).toHaveBeenCalledOnce();
    const message = sentMessage(open);
    expect(message.split("\n")[0]).toBe("Pedido #1042");
    expect(message).toContain(`Coleira (SKU COL-1) — 2 × ${formatPrice(12)} = ${formatPrice(24)}`);
    expect(message).toContain("Guia — Qtd: 1 (a consultar)");
    expect(message).toContain("Nome: Fabio");
    expect(mocks.clear).toHaveBeenCalledOnce();
  });

  it("se a gravação falhar, abre o WhatsApp mesmo assim sem número", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "failed" });

    render(<CotacaoContent palette={palette} />);
    await act(async () => fillAndSubmit());

    const message = sentMessage(open);
    expect(message).not.toContain("Pedido #");
    expect(message).toContain(`Coleira (SKU COL-1) — 2 × ${formatPrice(10)} = ${formatPrice(20)}`);
  });

  it("erro de validação aparece no formulário e não abre o WhatsApp", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "invalid", error: "Um dos produtos não está mais disponível." });

    render(<CotacaoContent palette={palette} />);
    await act(async () => fillAndSubmit());

    expect(open).not.toHaveBeenCalled();
    expect(screen.getByText("Um dos produtos não está mais disponível.")).toBeInTheDocument();
    expect(mocks.clear).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm --filter distribuidora test -- app/cotacao/cotacao-content.test.tsx` — Expected: FAIL (botão/preços não existem).

- [ ] **Step 4: Reescrever `cotacao-content.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@mypet/core/components/cart-provider";
import { cartTotals } from "@mypet/core/cart";
import { formatPrice } from "@mypet/core/catalog-utils";
import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
import type { Palette } from "@mypet/core/theme";
import { applyServerPrices, registerOrder } from "./register-order";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511981030532";
const ORDER_INTRO = "Olá! Quero fazer este pedido:";

export function CotacaoContent({ palette: PALETTE }: { palette: Palette }) {
  const { cart, removeItem, updateQty, clear } = useCart();
  const [form, setForm] = useState({ nome: "", empresa: "", whatsapp: "", cnpj: "" });
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (cart.items.length === 0) {
    return (
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>
          Seu carrinho está vazio
        </h2>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Adicione produtos do catálogo para montar seu pedido.
        </p>
        <Link href="/" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Ver catálogo
        </Link>
      </div>
    );
  }

  const totals = cartTotals(cart.items);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitting(true);

    const result = await registerOrder(cart.items, form);
    if (result.kind === "invalid") {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    const items = result.kind === "ok" ? applyServerPrices(cart.items, result.prices) : cart.items;
    const message = buildQuoteMessage(items, form, ORDER_INTRO, {
      showPrices: true,
      orderNumber: result.kind === "ok" ? result.number : undefined,
    });
    window.open(buildWhatsAppLink(WHATSAPP_NUMBER, message), "_self");
    clear();
  };

  return (
    <>
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, marginBottom: 16, overflow: "hidden" }}>
        {cart.items.map((item, index) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 16,
              flexWrap: "wrap",
              borderBottom: index < cart.items.length - 1 ? `1px solid ${PALETTE.gray100}` : "none",
            }}
          >
            <img src={item.img} alt={item.name} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: "1 1 160px", minWidth: 0 }}>
              {item.brand && (
                <p style={{ fontSize: 10, color: PALETTE.pink, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                  {item.brand}
                </p>
              )}
              <p style={{ fontSize: 14, fontWeight: 700, color: PALETTE.navy, lineHeight: 1.3 }}>{item.name}</p>
              {item.sku && <p style={{ fontSize: 11, color: PALETTE.gray400 }}>SKU: {item.sku}</p>}
              <p style={{ fontSize: 12, color: PALETTE.gray600, marginTop: 2 }}>
                {typeof item.unitPrice === "number" ? `${formatPrice(item.unitPrice)} / un.` : "Preço a confirmar"}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty - 1)}
                aria-label="Diminuir quantidade"
                style={{ width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
              >
                −
              </button>
              <span style={{ minWidth: 28, textAlign: "center", fontSize: 13, fontWeight: 700, color: PALETTE.navy }}>{item.qty}</span>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty + 1)}
                aria-label="Aumentar quantidade"
                style={{ width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
              >
                +
              </button>
            </div>
            <div style={{ minWidth: 88, textAlign: "right" }}>
              <p style={{ fontSize: 14, fontWeight: 900, color: PALETTE.navy }}>
                {typeof item.unitPrice === "number" ? formatPrice(Math.round(item.unitPrice * item.qty * 100) / 100) : "a consultar"}
              </p>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label={`Remover ${item.name} do carrinho`}
                style={{ border: "none", background: "transparent", color: PALETTE.gray400, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: PALETTE.gray600, marginBottom: 8 }}>
          <span>Total de unidades</span>
          <span style={{ fontWeight: 800, color: PALETTE.navy }}>{totals.totalUnits}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: PALETTE.navy }}>Total</span>
          <span data-testid="cart-total" style={{ fontSize: 22, fontWeight: 900, color: PALETTE.pink }}>
            {totals.pricedLines > 0 ? formatPrice(totals.totalValue) : "a consultar"}
          </span>
        </div>
        {totals.unpricedLines > 0 && totals.pricedLines > 0 && (
          <p style={{ fontSize: 12, color: PALETTE.gray600, marginTop: 8 }}>
            Itens sem preço serão confirmados pelo atendente.
          </p>
        )}
      </div>

      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: PALETTE.navy, marginBottom: 16 }}>
          Seus dados para o pedido
        </h2>
        <form onSubmit={handleSubmit}>
          <input className="form-input" placeholder="Seu nome" required value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} />
          <input className="form-input" placeholder="Nome do pet shop / empresa" required value={form.empresa} onChange={(event) => setForm((current) => ({ ...current, empresa: event.target.value }))} />
          <input className="form-input" placeholder="WhatsApp com DDD" required inputMode="tel" value={form.whatsapp} onChange={(event) => setForm((current) => ({ ...current, whatsapp: event.target.value }))} />
          <input className="form-input" placeholder="CNPJ (opcional)" inputMode="numeric" value={form.cnpj} onChange={(event) => setForm((current) => ({ ...current, cnpj: event.target.value }))} />
          {submitError && (
            <p role="alert" style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{submitError}</p>
          )}
          <button type="submit" className="form-submit" disabled={submitting}>
            {submitting ? "Registrando pedido…" : "Enviar pedido pelo WhatsApp →"}
          </button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Título da página** — em `apps/distribuidora/app/cotacao/page.tsx`, trocar o `<h1>` `Sua cotação` por `Seu pedido`.

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm --filter distribuidora test` — Expected: PASS (todos os testes do app).
Run: `pnpm --filter distribuidora exec tsc --noEmit` — Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add apps/distribuidora/app/cotacao
git commit -m "feat(distribuidora): carrinho com preços e total, pedido gravado antes do WhatsApp"
```

---

### Task 9: Verificação final

- [ ] **Step 1: Suítes e build**

Run: `pnpm --filter @mypet/core test` — Expected: PASS.
Run: `pnpm --filter distribuidora test` — Expected: PASS.
Run: `pnpm --filter mypet test` e `pnpm --filter madpet test` — Expected: PASS (garante que nada compartilhado mudou de comportamento).
Run: `pnpm --filter distribuidora build` — Expected: build ok.

- [ ] **Step 2: Teste manual (skill `run`)**

`pnpm --filter distribuidora dev` (porta 4101), viewport mobile:
1. Home: busca logo abaixo do nav, fixa ao rolar; digitar "coleira" filtra sem botão.
2. Card: "Adicionar" vira `− 1 +`; produto-pai mostra "Ver opções".
3. Barra verde aparece com "N itens · R$ X"; some em `/cotacao`.
4. `/cotacao`: subtotais e total; enviar → abre `wa.me` com "Pedido #NNNN".
5. Conferir no Supabase: `select number, channel, customer_name from orders order by created_at desc limit 1;` → `channel = 'distribuidora'`, e `order_items.unit_price` preenchido.
6. Apagar o pedido de teste depois (confirmar com o usuário).
