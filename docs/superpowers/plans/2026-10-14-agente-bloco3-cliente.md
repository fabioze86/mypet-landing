# Agente My Pet — Bloco 3 (modo cliente) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O cliente cadastrado monta o pedido conversando: o agente coloca/muda/tira produtos do carrinho, sugere reposição pelo histórico, informa o status dos pedidos, e o cliente envia o pedido pelo WhatsApp sem sair do `/agente`, com a origem "agente" registrada no pedido.

**Architecture:** Três ferramentas novas só para o modo cliente (`alterar_pedido`, `sugerir_reposicao`, `status_pedidos`) num módulo do core, todas presas ao comprador do cookie. A saída de `alterar_pedido` (`aplicados`) é aplicada no carrinho do navegador quando a resposta termina (`onFinish` do `useChat`) — o carrinho continua sendo o mesmo do `/pedido-rapido` (localStorage). O `/agente` do cliente ganha uma coluna "Seu pedido" (no celular, barra fixa + painel de baixo para cima) com envio pelo WhatsApp usando o fechamento atual (`finalizeQuote`), que passa a gravar `agent_conversation_id` no pedido.

**Tech Stack:** Next 16.2, React 19.2, AI SDK `ai@7.0.19` + `@ai-sdk/react@4.0.20`, zod 4, Supabase, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-10-14-agente-plataforma-design.md` (seções 1.2, 2.3, 3.3 e bloco 3 da seção 6). Blocos 1 e 2 já implementados.

## Global Constraints

- O comprador vem **só** do cookie (`resolveBuyer` no handler); nenhuma ferramenta aceita id de comprador. Visitante **não** recebe as ferramentas de cliente.
- `alterar_pedido({ itens: [{ productId, quantidade }] })`: até 20 itens por chamada; `quantidade` inteiro 0–9999 (0 tira); o servidor carrega cada produto do canal (ativo, com preço) e devolve `{ aplicados: [{ id, name, sku, brand, img, unitPrice, qty }], recusados: [{ productId, motivo }] }`; produto sem preço é recusado.
- `sugerir_reposicao()`: pedidos não cancelados do comprador; por produto com ≥ 2 compras: intervalo médio e dias desde a última; sugere quem passou de 80% do intervalo médio, ordenado por atraso, máx. 8. Sem nenhum produto com ≥ 2 compras → itens do último pedido como "compra recente". Cálculo em código puro (`agent-replenishment.ts`).
- `status_pedidos({ limite? })`: padrão 5, máx. 10: `{ data, status, itens, unidades }`.
- Carrinho: o mesmo `CartProvider` do `/pedido-rapido`. `alterar_pedido` define a quantidade (não soma); quantidade 0 remove. Mensagens restauradas do `sessionStorage` **não** são reaplicadas no carrinho.
- Envio: `finalizeQuote` + mensagem/link do WhatsApp já usados em `/cotacao`. `orders.agent_conversation_id` só é gravado se a conversa pertencer ao comprador do cookie.
- Copy em português; nunca "atacado", "cotação", nem chamar o hotsite de "loja"; nunca prometer desconto/condição/preço melhor; nunca inventar status ou datas de pedido.
- A migration nova (`orders.agent_conversation_id`) só é aplicada em produção com confirmação explícita do usuário (Task 8). O código precisa funcionar antes dela: só manda a coluna quando há id de conversa.
- Commits só com os arquivos da task (há alterações não relacionadas no working tree — nunca `git add -A`/`git add .`). Direto na `main`. Toda mensagem de commit termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Testes: core `pnpm --filter @mypet/core exec vitest run <arquivo>`; app `pnpm --filter mypet exec vitest run <arquivo>`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `packages/core/src/catalog-line-items.ts` (modificar) | `queryLineItemsByIds(ids, channel)` |
| `packages/core/src/agent-replenishment.ts` (novo) | Cálculo puro da reposição |
| `packages/core/src/agent-customer-tools.ts` (novo) | `alterar_pedido`, `sugerir_reposicao`, `status_pedidos` |
| `packages/core/src/agent-server.ts`, `agent-prompt.ts` (modificar) | Ferramentas de cliente no modo cliente; regra 8 do prompt |
| `supabase/migrations/20261015120000_orders_agent_conversation.sql` (novo) | Coluna `orders.agent_conversation_id` |
| `packages/core/src/orders-server.ts` (modificar) | `createOrder` aceita `agentConversationId` |
| `apps/mypet/app/cotacao/actions.ts` (modificar) | `finalizeQuote(items, { agentConversationId })` com checagem de posse |
| `apps/mypet/app/cotacao/whatsapp-order.ts` (novo) + `cotacao-content.tsx` (modificar) | Mensagem/link do WhatsApp compartilhados |
| `packages/core/src/agent-client.ts` (modificar) | `onAssistantMessage`, `cartChangesFromMessage`, cartões da reposição |
| `apps/mypet/app/agente/cart-sync.ts` (novo) | Aplica `aplicados` no carrinho |
| `apps/mypet/app/agente/cart-panel.tsx` (novo) | "Seu pedido" + envio pelo WhatsApp |
| `apps/mypet/app/agente/use-sheet-dialog.ts` (novo) | Comportamento de diálogo do painel de baixo (extraído do `access-panel`) |
| `apps/mypet/app/agente/{agent-chat,product-cards,agent-shell,access-panel,styles}.tsx/ts` (modificar) | Ligação de tudo no `/agente` |

---

### Task 1: Produtos da tabela por id (`queryLineItemsByIds`)

**Files:**
- Modify: `packages/core/src/catalog-line-items.ts`
- Test: `packages/core/src/catalog-line-items-by-ids.test.ts` (novo)

**Interfaces:**
- Produces:
  ```ts
  export async function queryLineItemsByIds(ids: string[], channel: string): Promise<CatalogLineItem[]>;
  // itens na ordem dos ids pedidos; ids repetidos/desconhecidos ignorados; máx. 50 ids
  ```

- [ ] **Step 1: Write the failing test**

Criar `packages/core/src/catalog-line-items-by-ids.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));

type Result = { data: unknown[] | null; error: { message: string } | null };
const queue: Result[] = [];
const calls: { method: string; args: unknown[] }[] = [];

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (v: Result) => void) => resolve(queue.shift() ?? { data: [], error: null });
  return builder;
}

vi.mock("./supabase", () => ({ getHubClient: () => ({ from: () => makeBuilder() }) }));

import { queryLineItemsByIds } from "./catalog-line-items";

const simple = {
  id: "s1",
  name: "Ração X",
  reference: "100",
  brand: "NAPI",
  product_role: "simple",
  parent_product_id: null,
  variant_axis: null,
  product_assets: [{ url: "https://img/s1", type: "main_image" }],
  product_channel_prices: [{ channel: "mypetbrasil", sale_price: "42.90" }],
};

const variant = {
  id: "v1",
  name: "Shampoo Neutro 5L",
  reference: "SH-5L",
  brand: null,
  product_role: "variant",
  parent_product_id: "p1",
  variant_axis: [{ eixo: "Volume", valor: "5L" }],
  product_assets: [],
  product_channel_prices: [{ channel: "mypetbrasil", sale_price: 89.9 }],
};

const parent = { id: "p1", name: "Shampoo Neutro", brand: "Pet Clean", product_assets: [{ url: "https://img/p1", type: "main_image" }] };

beforeEach(() => {
  queue.length = 0;
  calls.length = 0;
});

describe("queryLineItemsByIds", () => {
  it("monta linhas de produto simples e de variação, na ordem pedida", async () => {
    queue.push({ data: [simple, variant], error: null }, { data: [parent], error: null });
    const items = await queryLineItemsByIds(["v1", "s1"], "mypetbrasil");
    expect(items).toEqual([
      {
        id: "v1",
        name: "Shampoo Neutro",
        sku: "SH-5L",
        brand: "Pet Clean",
        img: "https://img/p1",
        unitPrice: 89.9,
        priceLabel: "R$ 89,90",
        variantLabel: "5L",
      },
      {
        id: "s1",
        name: "Ração X",
        sku: "100",
        brand: "NAPI",
        img: "https://img/s1",
        unitPrice: 42.9,
        priceLabel: "R$ 42,90",
        variantLabel: null,
      },
    ]);
    expect(calls).toContainEqual({ method: "in", args: ["id", ["v1", "s1"]] });
    expect(calls).toContainEqual({ method: "eq", args: ["product_channel_links.channel", "mypetbrasil"] });
    expect(calls).toContainEqual({ method: "neq", args: ["product_role", "parent"] });
  });

  it("ignora ids repetidos e desconhecidos; lista vazia não consulta", async () => {
    queue.push({ data: [simple], error: null });
    const items = await queryLineItemsByIds(["s1", "s1", "x"], "mypetbrasil");
    expect(items.map((i) => i.id)).toEqual(["s1"]);
    expect(calls).toContainEqual({ method: "in", args: ["id", ["s1", "x"]] });

    calls.length = 0;
    expect(await queryLineItemsByIds([], "mypetbrasil")).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("variação cujo rótulo é igual ao SKU fica sem rótulo", async () => {
    queue.push(
      { data: [{ ...variant, variant_axis: [{ eixo: "Ref", valor: "SH-5L" }] }], error: null },
      { data: [parent], error: null },
    );
    const [item] = await queryLineItemsByIds(["v1"], "mypetbrasil");
    expect(item.variantLabel).toBeNull();
  });

  it("erro do banco devolve lista vazia", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    queue.push({ data: null, error: { message: "down" } });
    expect(await queryLineItemsByIds(["s1"], "mypetbrasil")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/catalog-line-items-by-ids.test.ts`
Expected: FAIL — `queryLineItemsByIds` não existe.

- [ ] **Step 3: Write the implementation**

No fim de `packages/core/src/catalog-line-items.ts`, adicionar:

```ts
const MAX_IDS = 50;

type RawLineItemByIdRow = RawLineItemProductRow & {
  parent_product_id: string | null;
  variant_axis: VariantAxisEntry[] | null;
};

type RawParentRow = {
  id: string;
  name: string;
  brand: string | null;
  product_assets: { url: string; type: string }[] | null;
};

function variantLabelOrNull(axis: VariantAxisEntry[] | null, sku: string): string | null {
  const label = (axis ?? [])
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((a) => a.valor)
    .join(" / ")
    .trim();
  if (!label || label.toLowerCase() === sku.trim().toLowerCase()) return null;
  return label;
}

/**
 * Linhas da tabela pelos ids (produto simples ou variação), com o preço atual
 * do canal. Usado pelo agente para pôr produtos no pedido e sugerir reposição.
 * Sem cache: o preço precisa ser o de agora.
 */
export async function queryLineItemsByIds(ids: string[], channel: string): Promise<CatalogLineItem[]> {
  const unique = [...new Set(ids)].slice(0, MAX_IDS);
  if (unique.length === 0) return [];
  const supabase = getHubClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `${LINE_ITEM_PRODUCT_SELECT}, parent_product_id, variant_axis, product_channel_links!inner(channel)`,
    )
    .in("id", unique)
    .eq("status", "active")
    .neq("product_role", "parent")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel);

  if (error) {
    console.error("[catalog-line-items] erro ao buscar produtos por id:", error.message);
    return [];
  }

  const rows = (data as unknown as RawLineItemByIdRow[]) ?? [];
  const parentIds = [...new Set(rows.map((r) => r.parent_product_id).filter((id): id is string => Boolean(id)))];
  const parents = new Map<string, RawParentRow>();
  if (parentIds.length > 0) {
    const { data: parentData, error: parentError } = await supabase
      .from("products")
      .select("id, name, brand, product_assets(url, type)")
      .in("id", parentIds);
    if (parentError) console.error("[catalog-line-items] erro ao buscar produtos-pai:", parentError.message);
    for (const parent of (parentData as unknown as RawParentRow[]) ?? []) parents.set(parent.id, parent);
  }

  const byId = new Map<string, CatalogLineItem>();
  for (const row of rows) {
    const unitPrice = salePriceFromChannelPrices(row.product_channel_prices);
    const sku = row.reference ?? "";
    const parent = row.parent_product_id ? parents.get(row.parent_product_id) : undefined;
    const ownImg = mainImage(row.product_assets);
    byId.set(row.id, {
      id: row.id,
      name: parent?.name ?? row.name,
      sku,
      brand: parent?.brand ?? row.brand,
      img: ownImg !== PLACEHOLDER_IMAGE || !parent ? ownImg : mainImage(parent.product_assets),
      unitPrice,
      priceLabel: formatPrice(unitPrice),
      variantLabel: row.product_role === "variant" ? variantLabelOrNull(row.variant_axis, sku) : null,
    });
  }
  return unique.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}
```

(Os imports `VariantAxisEntry`, `PLACEHOLDER_IMAGE`, `mainImage`, `formatPrice`, `salePriceFromChannelPrices` já existem no arquivo. Se a ordem `select → in → eq → neq → eq` não for aceita pelo fake, ajuste só o teste.)

Para o caso do teste "variação": `brand` do pai é `"Pet Clean"`; se o pai tiver `brand` nulo, usa o da variação.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @mypet/core exec vitest run src/catalog-line-items-by-ids.test.ts src/catalog-line-items.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog-line-items.ts packages/core/src/catalog-line-items-by-ids.test.ts
git commit -m "feat(catalog): linhas da tabela por id com preço atual do canal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Cálculo da reposição (`agent-replenishment.ts`)

**Files:**
- Create: `packages/core/src/agent-replenishment.ts`
- Test: `packages/core/src/agent-replenishment.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ReplenishmentOrder = { status: string; createdAt: string; items: { productId: string; qty: number }[] };
  export type ReplenishmentSuggestion = {
    productId: string; daysSinceLast: number; averageIntervalDays: number | null; lastQty: number;
  };
  export type ReplenishmentPlan = { tipo: "reposicao" | "compra_recente" | "sem_historico"; itens: ReplenishmentSuggestion[] };
  export function computeReplenishment(orders: ReplenishmentOrder[], now: Date, limit: number): ReplenishmentPlan;
  ```
  (`OrderWithItems` de `orders-server.ts` é compatível com `ReplenishmentOrder`.)

- [ ] **Step 1: Write the failing test**

Criar `packages/core/src/agent-replenishment.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeReplenishment, type ReplenishmentOrder } from "./agent-replenishment";

const now = new Date("2026-10-15T12:00:00Z");
const day = (iso: string) => `${iso}T12:00:00Z`;
const order = (date: string, items: [string, number][], status = "entregue"): ReplenishmentOrder => ({
  status,
  createdAt: day(date),
  items: items.map(([productId, qty]) => ({ productId, qty })),
});

describe("computeReplenishment", () => {
  it("sem pedidos: sem_historico", () => {
    expect(computeReplenishment([], now, 8)).toEqual({ tipo: "sem_historico", itens: [] });
  });

  it("sugere quem passou de 80% do intervalo médio, mais atrasado primeiro", () => {
    const orders = [
      order("2026-07-17", [["racao", 2], ["shampoo", 1]]),
      order("2026-08-16", [["racao", 3]]),
      order("2026-09-15", [["racao", 4], ["shampoo", 2]]),
      order("2026-10-10", [["coleira", 5]]),
    ];
    // ração: compras a cada 30 dias, última há 30 dias (100%) → sugere
    // shampoo: intervalo 60 dias, última há 30 dias (50%) → não sugere
    // coleira: 1 compra só → não entra
    expect(computeReplenishment(orders, now, 8)).toEqual({
      tipo: "reposicao",
      itens: [{ productId: "racao", daysSinceLast: 30, averageIntervalDays: 30, lastQty: 4 }],
    });
  });

  it("ignora pedidos cancelados", () => {
    const orders = [
      order("2026-08-11", [["racao", 1]]),
      order("2026-09-10", [["racao", 1]], "cancelado"),
      order("2026-09-15", [["racao", 2]]),
    ];
    // sem o cancelado: intervalo de 35 dias, última há 30 (86%) → sugere
    const plan = computeReplenishment(orders, now, 8);
    expect(plan.itens[0]).toEqual({ productId: "racao", daysSinceLast: 30, averageIntervalDays: 35, lastQty: 2 });
  });

  it("produto repetido no mesmo pedido soma a quantidade e conta uma compra", () => {
    const orders = [order("2026-08-16", [["racao", 1]]), order("2026-09-15", [["racao", 1], ["racao", 2]])];
    const plan = computeReplenishment(orders, now, 8);
    expect(plan.itens[0]).toEqual({ productId: "racao", daysSinceLast: 30, averageIntervalDays: 30, lastQty: 3 });
  });

  it("limita a quantidade de sugestões", () => {
    const orders = [
      order("2026-08-01", [["a", 1], ["b", 1], ["c", 1]]),
      order("2026-08-15", [["a", 1], ["b", 1], ["c", 1]]),
    ];
    expect(computeReplenishment(orders, now, 2).itens).toHaveLength(2);
  });

  it("há produtos recorrentes mas nenhum no tempo de repor: reposicao vazia", () => {
    const orders = [order("2026-09-15", [["racao", 1]]), order("2026-10-14", [["racao", 1]])];
    expect(computeReplenishment(orders, now, 8)).toEqual({ tipo: "reposicao", itens: [] });
  });

  it("nenhum produto com 2 compras: itens do último pedido como compra recente", () => {
    const orders = [order("2026-09-01", [["a", 1]]), order("2026-10-05", [["b", 2], ["c", 3], ["b", 1]])];
    expect(computeReplenishment(orders, now, 8)).toEqual({
      tipo: "compra_recente",
      itens: [
        { productId: "b", daysSinceLast: 10, averageIntervalDays: null, lastQty: 3 },
        { productId: "c", daysSinceLast: 10, averageIntervalDays: null, lastQty: 3 },
      ],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-replenishment.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Write the implementation**

Criar `packages/core/src/agent-replenishment.ts`:

```ts
// Reposição pela compra habitual, em código puro (sem IA): para cada produto
// comprado em pelo menos 2 pedidos, compara os dias desde a última compra com o
// intervalo médio entre compras.

export type ReplenishmentOrder = { status: string; createdAt: string; items: { productId: string; qty: number }[] };

export type ReplenishmentSuggestion = {
  productId: string;
  daysSinceLast: number;
  averageIntervalDays: number | null;
  lastQty: number;
};

export type ReplenishmentPlan = {
  tipo: "reposicao" | "compra_recente" | "sem_historico";
  itens: ReplenishmentSuggestion[];
};

const DAY_MS = 86_400_000;
const DUE_RATIO = 0.8;

type ProductHistory = { dates: number[]; lastQty: number };

function sumByProduct(items: { productId: string; qty: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.qty);
  return totals;
}

export function computeReplenishment(orders: ReplenishmentOrder[], now: Date, limit: number): ReplenishmentPlan {
  const valid = orders
    .filter((o) => o.status !== "cancelado" && o.items.length > 0)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  if (valid.length === 0) return { tipo: "sem_historico", itens: [] };

  const history = new Map<string, ProductHistory>();
  for (const order of valid) {
    const time = Date.parse(order.createdAt);
    for (const [productId, qty] of sumByProduct(order.items)) {
      const entry = history.get(productId) ?? { dates: [], lastQty: 0 };
      entry.dates.push(time);
      entry.lastQty = qty;
      history.set(productId, entry);
    }
  }

  const due: (ReplenishmentSuggestion & { ratio: number })[] = [];
  let hasRepeat = false;
  for (const [productId, { dates, lastQty }] of history) {
    if (dates.length < 2) continue;
    hasRepeat = true;
    const first = dates[0];
    const last = dates[dates.length - 1];
    const average = (last - first) / (dates.length - 1) / DAY_MS;
    const since = (now.getTime() - last) / DAY_MS;
    if (average <= 0 || since < DUE_RATIO * average) continue;
    due.push({
      productId,
      daysSinceLast: Math.floor(since),
      averageIntervalDays: Math.round(average),
      lastQty,
      ratio: since / average,
    });
  }

  if (hasRepeat) {
    return {
      tipo: "reposicao",
      itens: due
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, limit)
        .map(({ ratio: _ratio, ...rest }) => rest),
    };
  }

  const lastOrder = valid[valid.length - 1];
  const since = Math.floor((now.getTime() - Date.parse(lastOrder.createdAt)) / DAY_MS);
  return {
    tipo: "compra_recente",
    itens: [...sumByProduct(lastOrder.items)]
      .slice(0, limit)
      .map(([productId, qty]) => ({ productId, daysSinceLast: since, averageIntervalDays: null, lastQty: qty })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-replenishment.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-replenishment.ts packages/core/src/agent-replenishment.test.ts
git commit -m "feat(agente): cálculo puro da reposição pela compra habitual

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Ferramentas do cliente e ligação no handler

**Files:**
- Create: `packages/core/src/agent-customer-tools.ts`
- Modify: `packages/core/src/agent-server.ts` (ferramentas por modo)
- Modify: `packages/core/src/agent-prompt.ts` (regra 8 do cliente)
- Test: `packages/core/src/agent-customer-tools.test.ts`, `packages/core/src/agent-server.test.ts`, `packages/core/src/agent-prompt.test.ts`

**Interfaces:**
- Consumes: `queryLineItemsByIds` (Task 1), `computeReplenishment` (Task 2), `getOrdersByBuyer` (`./orders-server`), `getHubServiceClient` (`./supabase`), `type CatalogLineItem`.
- Produces:
  ```ts
  export type CartChange = { id: string; name: string; sku: string; brand: string | null; img: string; unitPrice: number; qty: number };
  export type CartRefusal = { productId: string; motivo: string };
  export function buildCustomerTools(opts: { channel: string; buyerId: string }):
    { alterar_pedido: Tool; sugerir_reposicao: Tool; status_pedidos: Tool };
  // saídas:
  // alterar_pedido → { aplicados: CartChange[]; recusados: CartRefusal[] }
  // sugerir_reposicao → { tipo, itens: (AgentProduct & { ultimaCompraDias: number; intervaloMedioDias: number | null; qtdUltimaCompra: number })[] }
  // status_pedidos → { pedidos: { data: string; status: string; itens: number; unidades: number }[] }
  ```

- [ ] **Step 1: Write the failing tests**

1. Criar `packages/core/src/agent-customer-tools.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

vi.mock("./catalog-line-items", () => ({ queryLineItemsByIds: vi.fn() }));
vi.mock("./orders-server", () => ({ getOrdersByBuyer: vi.fn() }));
vi.mock("./supabase", () => ({ getHubServiceClient: () => ({ __service: true }) }));

import { queryLineItemsByIds } from "./catalog-line-items";
import { getOrdersByBuyer } from "./orders-server";
import { buildCustomerTools } from "./agent-customer-tools";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Execute = (input: any, options: any) => Promise<any>;
const opts = { toolCallId: "t1", messages: [] };
const tools = () => buildCustomerTools({ channel: "mypetbrasil", buyerId: "b1" });
const run = (name: "alterar_pedido" | "sugerir_reposicao" | "status_pedidos", input: unknown) =>
  (tools()[name].execute as Execute)(input, opts);

const lineItem = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: "Shampoo Neutro",
  sku: `SKU-${id}`,
  brand: "Pet Clean",
  img: "/x.jpg",
  unitPrice: 89.9,
  priceLabel: "R$ 89,90",
  variantLabel: "5L",
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("alterar_pedido", () => {
  it("aplica produtos com preço e recusa os desconhecidos ou sem preço", async () => {
    (queryLineItemsByIds as Mock).mockResolvedValue([lineItem("v1"), lineItem("v2", { unitPrice: null, priceLabel: null })]);
    const out = await run("alterar_pedido", {
      itens: [
        { productId: "v1", quantidade: 10 },
        { productId: "v2", quantidade: 1 },
        { productId: "zz", quantidade: 2 },
      ],
    });
    expect(queryLineItemsByIds).toHaveBeenCalledWith(["v1", "v2", "zz"], "mypetbrasil");
    expect(out.aplicados).toEqual([
      { id: "v1", name: "Shampoo Neutro — 5L", sku: "SKU-v1", brand: "Pet Clean", img: "/x.jpg", unitPrice: 89.9, qty: 10 },
    ]);
    expect(out.recusados).toEqual([
      { productId: "v2", motivo: "Produto sem preço na tabela no momento." },
      { productId: "zz", motivo: "Produto não encontrado na tabela." },
    ]);
  });

  it("quantidade 0 é aplicada (tira do pedido)", async () => {
    (queryLineItemsByIds as Mock).mockResolvedValue([lineItem("v1", { variantLabel: null })]);
    const out = await run("alterar_pedido", { itens: [{ productId: "v1", quantidade: 0 }] });
    expect(out.aplicados).toEqual([expect.objectContaining({ id: "v1", name: "Shampoo Neutro", qty: 0 })]);
  });

  it("o esquema limita itens e quantidades", () => {
    const schema = tools().alterar_pedido.inputSchema as { safeParse: (v: unknown) => { success: boolean } };
    expect(schema.safeParse({ itens: [{ productId: "a", quantidade: 10000 }] }).success).toBe(false);
    expect(schema.safeParse({ itens: [{ productId: "a", quantidade: 1.5 }] }).success).toBe(false);
    expect(schema.safeParse({ itens: [] }).success).toBe(false);
    expect(
      schema.safeParse({ itens: Array.from({ length: 21 }, (_, i) => ({ productId: `p${i}`, quantidade: 1 })) }).success,
    ).toBe(false);
  });
});

describe("sugerir_reposicao", () => {
  it("usa só os pedidos do comprador do cookie e devolve cartões com preço atual", async () => {
    (getOrdersByBuyer as Mock).mockResolvedValue([
      { id: "o1", status: "entregue", createdAt: "2026-08-16T12:00:00Z", items: [{ productId: "v1", name: "x", qty: 2 }] },
      { id: "o2", status: "entregue", createdAt: "2026-09-15T12:00:00Z", items: [{ productId: "v1", name: "x", qty: 3 }] },
    ]);
    (queryLineItemsByIds as Mock).mockResolvedValue([lineItem("v1")]);
    const out = await run("sugerir_reposicao", {});
    expect(getOrdersByBuyer).toHaveBeenCalledWith({ __service: true }, "b1");
    expect(out).toEqual({
      tipo: "reposicao",
      itens: [
        {
          id: "v1",
          name: "Shampoo Neutro",
          sku: "SKU-v1",
          brand: "Pet Clean",
          variantLabel: "5L",
          img: "/x.jpg",
          unitPrice: 89.9,
          priceLabel: "R$ 89,90",
          ultimaCompraDias: 30,
          intervaloMedioDias: 30,
          qtdUltimaCompra: 3,
        },
      ],
    });
  });

  it("sem histórico não consulta o catálogo", async () => {
    (getOrdersByBuyer as Mock).mockResolvedValue([]);
    expect(await run("sugerir_reposicao", {})).toEqual({ tipo: "sem_historico", itens: [] });
    expect(queryLineItemsByIds).not.toHaveBeenCalled();
  });
});

describe("status_pedidos", () => {
  it("resume os últimos pedidos do comprador (padrão 5)", async () => {
    const orders = Array.from({ length: 7 }, (_, i) => ({
      id: `o${i}`,
      status: i === 0 ? "confirmado" : "entregue",
      createdAt: "2026-10-08T15:00:00Z",
      items: [
        { productId: "a", name: "A", qty: 2 },
        { productId: "b", name: "B", qty: 3 },
      ],
    }));
    (getOrdersByBuyer as Mock).mockResolvedValue(orders);
    const out = await run("status_pedidos", {});
    expect(out.pedidos).toHaveLength(5);
    expect(out.pedidos[0]).toEqual({ data: "08/10/2026", status: "confirmado", itens: 2, unidades: 5 });
    expect((await run("status_pedidos", { limite: 2 })).pedidos).toHaveLength(2);
  });
});
```

2. Em `packages/core/src/agent-server.test.ts`: adicionar o mock `vi.mock("./agent-customer-tools", async (importOriginal) => importOriginal());` **não** é necessário — em vez disso, adicionar dois testes no `describe("POST /api/agente", ...)`:

```ts
  it("cliente recebe as ferramentas de pedido; visitante não", async () => {
    const visitorModel = textModel("Oi.");
    useModels(visitorModel);
    await (await handler()(makeRequest(validBody))).text();
    const visitorTools = (visitorModel.doStreamCalls[0].tools ?? []).map((t: { name: string }) => t.name);
    expect(visitorTools).toEqual(["buscar_produtos"]);

    const clientModel = textModel("Oi.");
    useModels(clientModel);
    await (await handler({ id: "b1", empresa: null })(makeRequest(validBody))).text();
    const clientTools = (clientModel.doStreamCalls[0].tools ?? []).map((t: { name: string }) => t.name).sort();
    expect(clientTools).toEqual(["alterar_pedido", "buscar_produtos", "status_pedidos", "sugerir_reposicao"]);
  });
```

(Se o `MockLanguageModelV4` registrar as ferramentas com outra forma em `doStreamCalls[0].tools`, ajustar só a leitura do nome — conferir em `node_modules/.pnpm/ai@7.0.19_zod@4.4.3/node_modules/ai/dist/test/index.d.ts`.)

3. Em `packages/core/src/agent-prompt.test.ts`, no teste "cliente: nome da empresa e pedido atual", acrescentar:

```ts
    expect(cliente).toContain('"alterar_pedido"');
    expect(cliente).toContain('"sugerir_reposicao"');
    expect(cliente).toContain('"status_pedidos"');
    expect(cliente).toContain("nunca invente status ou datas");
```

e no teste do visitante: `expect(visitante).not.toContain('"alterar_pedido"');`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-customer-tools.test.ts src/agent-server.test.ts src/agent-prompt.test.ts`
Expected: FAIL nos novos testes.

- [ ] **Step 3: Write the implementation**

1. Criar `packages/core/src/agent-customer-tools.ts`:

```ts
import { tool } from "ai";
import { z } from "zod";
import { queryLineItemsByIds, type CatalogLineItem } from "./catalog-line-items";
import { computeReplenishment } from "./agent-replenishment";
import { getOrdersByBuyer, type OrderWithItems } from "./orders-server";
import { getHubServiceClient } from "./supabase";

// Ferramentas do modo cliente. O comprador vem do cookie (buyerId passado pelo
// handler); nenhuma ferramenta aceita id de comprador vindo do modelo.

export type CartChange = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  unitPrice: number;
  qty: number;
};
export type CartRefusal = { productId: string; motivo: string };

const MAX_CHANGE_ITEMS = 20;
const MAX_QTY = 9999;
const MAX_SUGGESTIONS = 8;
const DEFAULT_STATUS_LIMIT = 5;
const MAX_STATUS_LIMIT = 10;

function displayName(item: CatalogLineItem): string {
  return item.variantLabel ? `${item.name} — ${item.variantLabel}` : item.name;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

async function loadOrders(buyerId: string): Promise<OrderWithItems[]> {
  try {
    return await getOrdersByBuyer(getHubServiceClient(), buyerId);
  } catch (error) {
    console.error("[agent-customer-tools] falha ao carregar pedidos:", error);
    return [];
  }
}

export function buildCustomerTools({ channel, buyerId }: { channel: string; buyerId: string }) {
  return {
    alterar_pedido: tool({
      description:
        "Coloca, muda a quantidade ou tira produtos do pedido do cliente. Use só ids que vieram de buscar_produtos ou sugerir_reposicao nesta conversa. Quantidade 0 tira o produto do pedido.",
      inputSchema: z.object({
        itens: z
          .array(
            z.object({
              productId: z.string().min(1).describe("id do produto vindo de buscar_produtos ou sugerir_reposicao"),
              quantidade: z.number().int().min(0).max(MAX_QTY).describe("quantidade final no pedido; 0 tira"),
            }),
          )
          .min(1)
          .max(MAX_CHANGE_ITEMS),
      }),
      execute: async ({ itens }) => {
        const found = new Map(
          (await queryLineItemsByIds(itens.map((i) => i.productId), channel)).map((item) => [item.id, item]),
        );
        const aplicados: CartChange[] = [];
        const recusados: CartRefusal[] = [];
        for (const { productId, quantidade } of itens) {
          const item = found.get(productId);
          if (!item) {
            recusados.push({ productId, motivo: "Produto não encontrado na tabela." });
            continue;
          }
          if (item.unitPrice == null) {
            recusados.push({ productId, motivo: "Produto sem preço na tabela no momento." });
            continue;
          }
          aplicados.push({
            id: item.id,
            name: displayName(item),
            sku: item.sku,
            brand: item.brand,
            img: item.img,
            unitPrice: item.unitPrice,
            qty: quantidade,
          });
        }
        return { aplicados, recusados };
      },
    }),

    sugerir_reposicao: tool({
      description: "Sugere o que o cliente precisa repor, com base no histórico de pedidos dele.",
      inputSchema: z.object({}),
      execute: async () => {
        const plan = computeReplenishment(await loadOrders(buyerId), new Date(), MAX_SUGGESTIONS);
        if (plan.itens.length === 0) return { tipo: plan.tipo, itens: [] };
        const current = new Map(
          (await queryLineItemsByIds(plan.itens.map((s) => s.productId), channel)).map((item) => [item.id, item]),
        );
        return {
          tipo: plan.tipo,
          itens: plan.itens.flatMap((suggestion) => {
            const item = current.get(suggestion.productId);
            if (!item) return [];
            return [
              {
                id: item.id,
                name: item.name,
                sku: item.sku,
                brand: item.brand,
                variantLabel: item.variantLabel,
                img: item.img,
                unitPrice: item.unitPrice,
                priceLabel: item.priceLabel,
                ultimaCompraDias: suggestion.daysSinceLast,
                intervaloMedioDias: suggestion.averageIntervalDays,
                qtdUltimaCompra: suggestion.lastQty,
              },
            ];
          }),
        };
      },
    }),

    status_pedidos: tool({
      description: "Mostra os últimos pedidos do cliente com data, status e quantidade de itens.",
      inputSchema: z.object({
        limite: z.number().int().min(1).max(MAX_STATUS_LIMIT).optional().describe("quantos pedidos mostrar"),
      }),
      execute: async ({ limite }) => {
        const orders = await loadOrders(buyerId);
        return {
          pedidos: orders.slice(0, limite ?? DEFAULT_STATUS_LIMIT).map((order) => ({
            data: formatDate(order.createdAt),
            status: order.status,
            itens: order.items.length,
            unidades: order.items.reduce((sum, item) => sum + item.qty, 0),
          })),
        };
      },
    }),
  };
}
```

2. Em `packages/core/src/agent-server.ts`, importar `buildCustomerTools` e trocar a linha

```ts
    const tools = { buscar_produtos: buildCatalogTool({ channel: config.channel, showPrices: mode === "cliente" }) };
```

por

```ts
    const catalogTool = buildCatalogTool({ channel: config.channel, showPrices: mode === "cliente" });
    // Visitante não recebe as ferramentas de pedido; o comprador delas é o do cookie.
    const tools: ToolSet = buyer
      ? { buscar_produtos: catalogTool, ...buildCustomerTools({ channel: config.channel, buyerId: buyer.id }) }
      : { buscar_produtos: catalogTool };
```

(`ToolSet` já é importado de `"ai"` no arquivo; se o tipo das chamadas seguintes reclamar, ajustar só tipos.)

3. Em `packages/core/src/agent-prompt.ts`, no ramo do cliente, trocar a regra 8 por:

```ts
8. Você ajuda o cliente a montar o pedido com rapidez. Para colocar, mudar a quantidade ou tirar produtos do pedido, use a ferramenta "alterar_pedido" com os ids que vieram de "buscar_produtos" ou "sugerir_reposicao" (quantidade 0 tira o produto). Para sugerir o que repor, use "sugerir_reposicao". Para status de pedidos, use "status_pedidos" e nunca invente status ou datas. Depois de alterar o pedido, confirme em uma frase o que mudou; se algum produto for recusado, explique o motivo. Para fechar, indique o botão "Enviar pedido pelo WhatsApp" ao lado da conversa.
```

(Manter o restante do bloco do cliente — rótulo do pedido como dados e a linha sobre buscas anteriores sem preço — como está.)

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-customer-tools.ts packages/core/src/agent-customer-tools.test.ts packages/core/src/agent-server.ts packages/core/src/agent-server.test.ts packages/core/src/agent-prompt.ts packages/core/src/agent-prompt.test.ts
git commit -m "feat(agente): ferramentas do cliente — alterar pedido, sugerir reposição e status dos pedidos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pedido com origem no agente e mensagem do WhatsApp compartilhada

**Files:**
- Create: `supabase/migrations/20261015120000_orders_agent_conversation.sql`
- Modify: `packages/core/src/orders-server.ts` (`createOrder`)
- Modify: `apps/mypet/app/cotacao/actions.ts` (`finalizeQuote`)
- Create: `apps/mypet/app/cotacao/whatsapp-order.ts`
- Modify: `apps/mypet/app/cotacao/cotacao-content.tsx`
- Test: `packages/core/src/orders-server.test.ts`, `apps/mypet/app/cotacao/actions.test.ts`, `apps/mypet/app/cotacao/whatsapp-order.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // core
  createOrder(supabase, input: { buyerId: string; channel: Channel; items: CartItem[]; agentConversationId?: string | null })
  // app
  export async function finalizeQuote(items: CartItem[], options?: { agentConversationId?: string }): Promise<FinalizeQuoteResult>;
  export function hasWhatsAppNumber(): boolean;
  export function buildOrderWhatsAppUrl(items: CartItem[], buyer: { nome: string; empresa: string; whatsapp: string; cnpj: string | null }): string | null;
  ```

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/20261015120000_orders_agent_conversation.sql`:

```sql
-- Pedido enviado a partir do agente /agente: liga o pedido à conversa para medir
-- quantos pedidos saem do agente. Nulo nos pedidos feitos pela tabela.
alter table public.orders
  add column if not exists agent_conversation_id uuid null
  references public.agent_conversations(id) on delete set null;

create index if not exists orders_agent_conversation
  on public.orders (agent_conversation_id)
  where agent_conversation_id is not null;
```

(Não aplicar no banco nesta task.)

- [ ] **Step 2: Write the failing tests**

1. Em `packages/core/src/orders-server.test.ts`, adicionar (seguindo o fake/mocks que o arquivo já usa para `createOrder`): um teste em que `createOrder(..., { buyerId, channel, items, agentConversationId: "c1" })` insere em `orders` o objeto `{ buyer_id, channel, status: "pendente", agent_conversation_id: "c1" }`, e outro em que, sem `agentConversationId`, o objeto inserido **não tem** a chave `agent_conversation_id` (para funcionar antes da migration).

2. Em `apps/mypet/app/cotacao/actions.test.ts`, adicionar um mock de `@mypet/core/supabase` que devolva também um cliente com `from("agent_conversations")` (o arquivo já mocka `getHubServiceClient`; trocar por um fake que permita configurar o resultado de `.select("id").eq("id", x).eq("buyer_id", y).maybeSingle()`), e os testes:
   - com `{ agentConversationId: <uuid válido> }` e a conversa encontrada para o comprador → `createOrder` recebe `agentConversationId` igual ao uuid;
   - conversa não encontrada (de outro comprador) → `createOrder` recebe `agentConversationId: null`;
   - id que não é uuid → não consulta a tabela e passa `null`;
   - sem opções → comportamento atual (chamada igual à de antes, `agentConversationId: null`).
   Ajustar a expectativa dos testes existentes de `createOrder` para incluir `agentConversationId: null`.

3. Criar `apps/mypet/app/cotacao/whatsapp-order.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import type { CartItem } from "@mypet/core/cart";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const items = [{ id: "p1", name: "Ração X", sku: "100", brand: null, img: "", qty: 2, unitPrice: 10 }] as CartItem[];
const buyer = { nome: "Ana", empresa: "Pet Shop X", whatsapp: "5511999990000", cnpj: "12345678000195" };

describe("buildOrderWhatsAppUrl", () => {
  it("monta o link do WhatsApp com a mensagem do pedido", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "5511988887777");
    const { buildOrderWhatsAppUrl, hasWhatsAppNumber } = await import("./whatsapp-order");
    expect(hasWhatsAppNumber()).toBe(true);
    const url = buildOrderWhatsAppUrl(items, buyer)!;
    expect(url.startsWith("https://wa.me/5511988887777?text=")).toBe(true);
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain("Olá! Quero fazer este pedido pela Tabela de Preços My Pet Brasil:");
    expect(text).toContain("Ração X (SKU 100) — Qtd: 2");
    expect(text).toContain("Empresa: Pet Shop X");
  });

  it("sem número configurado devolve null", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "");
    const { buildOrderWhatsAppUrl, hasWhatsAppNumber } = await import("./whatsapp-order");
    expect(hasWhatsAppNumber()).toBe(false);
    expect(buildOrderWhatsAppUrl(items, buyer)).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @mypet/core exec vitest run src/orders-server.test.ts` e `pnpm --filter mypet exec vitest run app/cotacao`
Expected: FAIL nos novos testes.

- [ ] **Step 4: Write the implementation**

1. `orders-server.ts` — `createOrder`: tipo do input ganha `agentConversationId?: string | null`; o insert vira:

```ts
    .insert({
      buyer_id: input.buyerId,
      channel: input.channel,
      status: "pendente",
      // só manda a coluna quando há conversa (funciona antes da migration)
      ...(input.agentConversationId ? { agent_conversation_id: input.agentConversationId } : {}),
    })
```

2. `apps/mypet/app/cotacao/actions.ts`:

```ts
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Só liga o pedido à conversa se ela for do próprio comprador.
async function ownedConversationId(
  supabase: ReturnType<typeof getHubServiceClient>,
  buyerId: string,
  id: string | undefined,
): Promise<string | null> {
  if (!id || !UUID_PATTERN.test(id)) return null;
  try {
    const { data, error } = await supabase
      .from("agent_conversations")
      .select("id")
      .eq("id", id)
      .eq("buyer_id", buyerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? id : null;
  } catch (error) {
    console.error("[cotacao] falha ao conferir a conversa do agente:", error);
    return null;
  }
}
```

e `finalizeQuote(items: CartItem[], options: { agentConversationId?: string } = {})`: depois do `requireBuyer`, `const supabase = getHubServiceClient();`, `const agentConversationId = await ownedConversationId(supabase, buyer.id, options.agentConversationId);` e passar `agentConversationId` para `createOrder(supabase, { buyerId, channel, items, agentConversationId })`.

3. Criar `apps/mypet/app/cotacao/whatsapp-order.ts`:

```ts
import type { CartItem } from "@mypet/core/cart";
import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
const WHATSAPP_INTRO = "Olá! Quero fazer este pedido pela Tabela de Preços My Pet Brasil:";

export type OrderBuyer = { nome: string; empresa: string; whatsapp: string; cnpj: string | null };

export function hasWhatsAppNumber(): boolean {
  return WHATSAPP_NUMBER.length > 0;
}

export function buildOrderWhatsAppUrl(items: CartItem[], buyer: OrderBuyer): string | null {
  if (!hasWhatsAppNumber()) return null;
  const message = buildQuoteMessage(items, { ...buyer, cnpj: buyer.cnpj ?? undefined }, WHATSAPP_INTRO);
  return buildWhatsAppLink(WHATSAPP_NUMBER, message);
}
```

4. `cotacao-content.tsx`: remover as constantes `WHATSAPP_NUMBER`/`WHATSAPP_INTRO` e os imports de `buildQuoteMessage`/`buildWhatsAppLink`; usar `hasWhatsAppNumber()` no lugar de `if (!WHATSAPP_NUMBER)` e `const url = buildOrderWhatsAppUrl(cart.items, result.buyer); if (url) window.open(url, "_blank");` no lugar da montagem inline. Comportamento igual ao de hoje; os testes existentes de `cotacao-content.test.tsx` devem continuar passando.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @mypet/core exec vitest run src/orders-server.test.ts` e `pnpm --filter mypet exec vitest run app/cotacao`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261015120000_orders_agent_conversation.sql packages/core/src/orders-server.ts packages/core/src/orders-server.test.ts apps/mypet/app/cotacao/actions.ts apps/mypet/app/cotacao/actions.test.ts apps/mypet/app/cotacao/whatsapp-order.ts apps/mypet/app/cotacao/whatsapp-order.test.ts apps/mypet/app/cotacao/cotacao-content.tsx
git commit -m "feat(pedidos): pedido enviado pelo agente guarda a conversa de origem; link do WhatsApp compartilhado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cliente do agente — alterações do pedido e cartões da reposição

**Files:**
- Modify: `packages/core/src/agent-client.ts`
- Test: `packages/core/src/agent-client.test.ts`, `packages/core/src/agent-client.hooks.test.tsx`

**Interfaces:**
- Consumes: `type CartChange` (`./agent-customer-tools`, só `import type`).
- Produces:
  ```ts
  export type { CartChange };
  export function cartChangesFromMessage(message: AgentMessage): CartChange[];
  // productsFromMessage passa a considerar também a saída de sugerir_reposicao (itens)
  useAgentChat({ ..., onAssistantMessage?: (message: AgentMessage) => void })
  // chamado uma vez por resposta concluída (onFinish do useChat), nunca para mensagens restauradas
  ```

- [ ] **Step 1: Write the failing tests**

Em `packages/core/src/agent-client.test.ts`, adicionar ao `describe("mensagens", ...)` (importando `cartChangesFromMessage`):

```ts
  it("cartChangesFromMessage junta os aplicados de todas as chamadas concluídas de alterar_pedido", () => {
    const change = (id: string, qty: number) => ({ id, name: `P ${id}`, sku: id, brand: null, img: "", unitPrice: 10, qty });
    const message = {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "tool-alterar_pedido", toolCallId: "c1", state: "output-available", input: {}, output: { aplicados: [change("a", 2)], recusados: [] } },
        { type: "tool-alterar_pedido", toolCallId: "c2", state: "output-error", input: {}, errorText: "x" },
        { type: "tool-alterar_pedido", toolCallId: "c3", state: "output-available", input: {}, output: { aplicados: [change("b", 0), { id: 1 }], recusados: [] } },
      ],
    } as unknown as AgentMessage;
    expect(cartChangesFromMessage(message)).toEqual([change("a", 2), change("b", 0)]);
  });

  it("productsFromMessage também lê os itens de sugerir_reposicao", () => {
    const message = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-sugerir_reposicao",
          toolCallId: "c1",
          state: "output-available",
          input: {},
          output: { tipo: "reposicao", itens: [{ ...product(1), unitPrice: 10, priceLabel: "R$ 10,00", ultimaCompraDias: 30, intervaloMedioDias: 30, qtdUltimaCompra: 2 }] },
        },
      ],
    } as unknown as AgentMessage;
    expect(productsFromMessage(message).map((p) => p.id)).toEqual(["p1"]);
  });
```

Em `packages/core/src/agent-client.hooks.test.tsx`, adicionar um teste: com uma resposta de stream de sucesso, `onAssistantMessage` é chamado uma vez com a mensagem do assistente; e um teste em que a conversa inicial já tem uma mensagem de assistente (restaurada) e `onAssistantMessage` **não** é chamado só por montar o hook.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-client`
Expected: FAIL nos novos testes.

- [ ] **Step 3: Write the implementation**

Em `packages/core/src/agent-client.ts`:

1. `import type { CartChange } from "./agent-customer-tools";` e `export type { CartChange };`.

2. Adicionar:

```ts
function isCartChange(value: unknown): value is CartChange {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.name === "string" &&
    typeof c.sku === "string" &&
    typeof c.img === "string" &&
    (c.brand === null || typeof c.brand === "string") &&
    typeof c.unitPrice === "number" &&
    typeof c.qty === "number" &&
    Number.isInteger(c.qty) &&
    c.qty >= 0
  );
}

export function cartChangesFromMessage(message: AgentMessage): CartChange[] {
  const changes: CartChange[] = [];
  for (const part of message.parts) {
    const toolPart = part as { type: string; state?: string; output?: { aplicados?: unknown } };
    if (toolPart.type !== "tool-alterar_pedido" || toolPart.state !== "output-available") continue;
    const list = toolPart.output?.aplicados;
    if (Array.isArray(list)) changes.push(...list.filter(isCartChange));
  }
  return changes;
}
```

3. Em `productsFromMessage`, aceitar também `tool-sugerir_reposicao` (lista em `output.itens`): a última saída concluída de qualquer das duas ferramentas define os cartões.

```ts
const PRODUCT_TOOLS: Record<string, string> = {
  "tool-buscar_produtos": "produtos",
  "tool-sugerir_reposicao": "itens",
};
// ... dentro do laço:
    const key = PRODUCT_TOOLS[toolPart.type];
    if (!key || toolPart.state !== "output-available") continue;
    const list = (toolPart.output as Record<string, unknown> | undefined)?.[key];
    if (Array.isArray(list)) products = list.filter(isAgentProduct);
```

4. `useAgentChat` ganha `onAssistantMessage?: (message: AgentMessage) => void` (guardado num ref, como o `getCart`) e passa ao `useChat`:

```ts
    onFinish: ({ message, isAbort, isError }) => {
      if (isAbort || isError || message.role !== "assistant") return;
      onAssistantMessageRef.current?.(message);
    },
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-client` e `pnpm --filter @mypet/core exec tsc --noEmit 2>&1 | grep -E "agent-client"`
Expected: PASS; sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-client.ts packages/core/src/agent-client.test.ts packages/core/src/agent-client.hooks.test.tsx
git commit -m "feat(agente): cliente lê alterações do pedido e cartões da reposição

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: "Seu pedido" — sincronização do carrinho e envio pelo WhatsApp

**Files:**
- Create: `apps/mypet/app/agente/cart-sync.ts`
- Create: `apps/mypet/app/agente/cart-panel.tsx`
- Modify: `apps/mypet/app/agente/styles.ts` (estilos `ag-cart*`)
- Test: `apps/mypet/app/agente/cart-sync.test.ts`, `apps/mypet/app/agente/cart-panel.test.tsx`

**Interfaces:**
- Consumes: `type CartChange` (`@mypet/core/agent-client`), `useCart` (`@mypet/core/components/cart-provider`), `finalizeQuote` (`../cotacao/actions`), `buildOrderWhatsAppUrl`, `hasWhatsAppNumber` (`../cotacao/whatsapp-order`).
- Produces:
  ```ts
  export function applyCartChanges(
    changes: CartChange[],
    cart: { items: { id: string; campaignId?: string }[];
            addItem: (product: Omit<CartItem, "qty">, qty: number) => void;
            updateQty: (id: string, qty: number) => void;
            removeItem: (id: string) => void },
  ): void;
  export function CartPanel(props: { conversationId: string | null; headingRef?: RefObject<HTMLHeadingElement | null> }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing tests**

1. Criar `apps/mypet/app/agente/cart-sync.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { applyCartChanges } from "./cart-sync";

const change = (id: string, qty: number) => ({ id, name: `P ${id}`, sku: id, brand: null, img: "/i.jpg", unitPrice: 10, qty });

function fakeCart(ids: string[]) {
  return { items: ids.map((id) => ({ id })), addItem: vi.fn(), updateQty: vi.fn(), removeItem: vi.fn() };
}

describe("applyCartChanges", () => {
  it("define a quantidade de quem já está no pedido, adiciona os novos e tira os de quantidade 0", () => {
    const cart = fakeCart(["a", "b"]);
    applyCartChanges([change("a", 5), change("b", 0), change("c", 2)], cart);
    expect(cart.updateQty).toHaveBeenCalledWith("a", 5);
    expect(cart.removeItem).toHaveBeenCalledWith("b");
    expect(cart.addItem).toHaveBeenCalledWith({ id: "c", name: "P c", sku: "c", brand: null, img: "/i.jpg", unitPrice: 10 }, 2);
  });

  it("produto novo com quantidade 0 não faz nada", () => {
    const cart = fakeCart([]);
    applyCartChanges([change("x", 0)], cart);
    expect(cart.addItem).not.toHaveBeenCalled();
    expect(cart.removeItem).not.toHaveBeenCalled();
  });

  it("o mesmo produto duas vezes na mesma resposta: a segunda define a quantidade", () => {
    const cart = fakeCart([]);
    applyCartChanges([change("c", 2), change("c", 4)], cart);
    expect(cart.addItem).toHaveBeenCalledTimes(1);
    expect(cart.updateQty).toHaveBeenCalledWith("c", 4);
  });

  it("linha de campanha não é confundida com o produto avulso", () => {
    const cart = { ...fakeCart([]), items: [{ id: "a", campaignId: "camp" }] };
    applyCartChanges([change("a", 3)], cart);
    expect(cart.addItem).toHaveBeenCalledTimes(1);
    expect(cart.updateQty).not.toHaveBeenCalled();
  });
});
```

2. Criar `apps/mypet/app/agente/cart-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const cartState = vi.hoisted(() => ({
  items: [] as { id: string; name: string; sku: string; brand: string | null; img: string; qty: number; unitPrice?: number }[],
  updateQty: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}));
const finalizeQuote = vi.hoisted(() => vi.fn());
const buildOrderWhatsAppUrl = vi.hoisted(() => vi.fn(() => "https://wa.me/55?text=x"));
const hasWhatsAppNumber = vi.hoisted(() => vi.fn(() => true));

vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({
    cart: { items: cartState.items },
    updateQty: cartState.updateQty,
    removeItem: cartState.removeItem,
    clear: cartState.clear,
  }),
}));
vi.mock("../cotacao/actions", () => ({ finalizeQuote: (...a: unknown[]) => finalizeQuote(...a) }));
vi.mock("../cotacao/whatsapp-order", () => ({
  buildOrderWhatsAppUrl: (...a: unknown[]) => buildOrderWhatsAppUrl(...(a as [])),
  hasWhatsAppNumber: () => hasWhatsAppNumber(),
}));

import { CartPanel } from "./cart-panel";

const item = { id: "p1", name: "Shampoo Neutro — 5L", sku: "S1", brand: "Pet Clean", img: "/x.jpg", qty: 10, unitPrice: 89.9 };
const open = vi.fn();

beforeEach(() => {
  cartState.items = [];
  vi.clearAllMocks();
  vi.stubGlobal("open", open);
});

describe("CartPanel", () => {
  it("vazio: orienta a pedir ao agente", () => {
    render(<CartPanel conversationId={null} />);
    expect(screen.getByRole("heading", { name: "Seu pedido" })).toBeInTheDocument();
    expect(screen.getByText(/Seu pedido está vazio/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar pedido pelo WhatsApp" })).toBeNull();
  });

  it("lista itens com subtotal e total e permite mudar a quantidade", () => {
    cartState.items = [item];
    render(<CartPanel conversationId={null} />);
    expect(screen.getByText("Shampoo Neutro — 5L")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 899,00").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade de Shampoo Neutro — 5L" }));
    expect(cartState.updateQty).toHaveBeenCalledWith("p1", 11);
    fireEvent.click(screen.getByRole("button", { name: "Tirar Shampoo Neutro — 5L do pedido" }));
    expect(cartState.removeItem).toHaveBeenCalledWith("p1");
  });

  it("envia pelo WhatsApp com a conversa de origem e limpa o pedido", async () => {
    cartState.items = [item];
    finalizeQuote.mockResolvedValue({ ok: true, buyer: { nome: "Ana", empresa: "X", whatsapp: "55", cnpj: null } });
    render(<CartPanel conversationId="3f1c2a7e-8b4d-4c1a-9f2e-1a2b3c4d5e6f" />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));
    await waitFor(() => expect(cartState.clear).toHaveBeenCalled());
    expect(finalizeQuote).toHaveBeenCalledWith([item], { agentConversationId: "3f1c2a7e-8b4d-4c1a-9f2e-1a2b3c4d5e6f" });
    expect(open).toHaveBeenCalledWith("https://wa.me/55?text=x", "_blank");
    expect(screen.getByRole("status")).toHaveTextContent("Pedido enviado!");
  });

  it("mostra o erro do envio e mantém o pedido", async () => {
    cartState.items = [item];
    finalizeQuote.mockResolvedValue({ ok: false, error: "Não foi possível registrar seu pedido." });
    render(<CartPanel conversationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível registrar seu pedido.");
    expect(cartState.clear).not.toHaveBeenCalled();
  });

  it("sem número do WhatsApp configurado não chama o servidor", () => {
    cartState.items = [item];
    hasWhatsAppNumber.mockReturnValue(false);
    render(<CartPanel conversationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));
    expect(finalizeQuote).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir o WhatsApp agora.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter mypet exec vitest run app/agente/cart-sync.test.ts app/agente/cart-panel.test.tsx`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Write the implementation**

1. Criar `apps/mypet/app/agente/cart-sync.ts`:

```ts
import type { CartItem } from "@mypet/core/cart";
import type { CartChange } from "@mypet/core/agent-client";

type CartOps = {
  items: { id: string; campaignId?: string }[];
  addItem: (product: Omit<CartItem, "qty">, qty: number) => void;
  updateQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
};

// Aplica no carrinho o que o agente fez com alterar_pedido: a quantidade é a
// final (não soma); 0 tira o produto. Linhas de campanha não são tocadas.
export function applyCartChanges(changes: CartChange[], cart: CartOps): void {
  const present = new Set(cart.items.filter((item) => !item.campaignId).map((item) => item.id));
  for (const change of changes) {
    if (change.qty === 0) {
      if (present.has(change.id)) {
        cart.removeItem(change.id);
        present.delete(change.id);
      }
      continue;
    }
    if (present.has(change.id)) {
      cart.updateQty(change.id, change.qty);
      continue;
    }
    cart.addItem(
      { id: change.id, name: change.name, sku: change.sku, brand: change.brand, img: change.img, unitPrice: change.unitPrice },
      change.qty,
    );
    present.add(change.id);
  }
}
```

2. Criar `apps/mypet/app/agente/cart-panel.tsx`:

```tsx
"use client";

import { useState, type RefObject } from "react";
import { useCart } from "@mypet/core/components/cart-provider";
import { finalizeQuote } from "../cotacao/actions";
import { buildOrderWhatsAppUrl, hasWhatsAppNumber } from "../cotacao/whatsapp-order";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const NO_WHATSAPP = "Não foi possível abrir o WhatsApp agora. Tente novamente mais tarde.";

type SendState = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

export function CartPanel({
  conversationId,
  headingRef,
}: {
  conversationId: string | null;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  const { cart, updateQty, removeItem, clear } = useCart();
  const [state, setState] = useState<SendState>({ kind: "idle" });
  const total = cart.items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.qty, 0);

  async function send() {
    if (!hasWhatsAppNumber()) {
      setState({ kind: "error", message: NO_WHATSAPP });
      return;
    }
    setState({ kind: "sending" });
    const result = await finalizeQuote(cart.items, conversationId ? { agentConversationId: conversationId } : {});
    if (!result.ok) {
      if (result.needsAuth) {
        window.location.assign("/agente");
        return;
      }
      setState({ kind: "error", message: result.error });
      return;
    }
    const url = buildOrderWhatsAppUrl(cart.items, result.buyer);
    if (url) window.open(url, "_blank");
    clear();
    setState({ kind: "sent" });
  }

  return (
    <div className="ag-cart">
      <h2 className="ag-cart-title" ref={headingRef} tabIndex={-1}>
        Seu pedido
      </h2>

      {state.kind === "sent" ? (
        <p className="ag-cart-done" role="status">
          Pedido enviado! Abrimos o WhatsApp com o seu pedido. Nosso time confirma estoque, frete e pagamento por lá.
        </p>
      ) : cart.items.length === 0 ? (
        <p className="ag-cart-empty">
          Seu pedido está vazio. Peça ao agente (ex.: “põe 10 do shampoo neutro 5L”) ou use a{" "}
          <a href="/pedido-rapido">tabela de preços</a>.
        </p>
      ) : (
        <>
          <ul className="ag-cart-items">
            {cart.items.map((item) => (
              <li key={`${item.id}-${item.campaignId ?? ""}`} className="ag-cart-item">
                <div className="ag-cart-item-info">
                  <span className="ag-cart-item-name">{item.name}</span>
                  <span className="ag-cart-item-price">
                    {item.unitPrice != null ? brl(item.unitPrice * item.qty) : "Sob consulta"}
                  </span>
                </div>
                <div className="ag-cart-stepper">
                  <button
                    type="button"
                    aria-label={`Diminuir quantidade de ${item.name}`}
                    onClick={() => updateQty(item.id, item.qty - 1, item.campaignId)}
                  >
                    −
                  </button>
                  <span aria-label={`Quantidade de ${item.name}`}>{item.qty}</span>
                  <button
                    type="button"
                    aria-label={`Aumentar quantidade de ${item.name}`}
                    onClick={() => updateQty(item.id, item.qty + 1, item.campaignId)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="ag-cart-remove"
                    aria-label={`Tirar ${item.name} do pedido`}
                    onClick={() => removeItem(item.id, item.campaignId)}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="ag-cart-total">
            <span>Total</span>
            <strong>{brl(total)}</strong>
          </p>
          {state.kind === "error" && (
            <p className="ag-cart-error" role="alert">
              {state.message}
            </p>
          )}
          <button type="button" className="ag-cart-send" disabled={state.kind === "sending"} onClick={send}>
            {state.kind === "sending" ? "Enviando…" : "Enviar pedido pelo WhatsApp"}
          </button>
        </>
      )}
    </div>
  );
}
```

(O teste "lista itens..." chama `updateQty("p1", 11)` com dois argumentos; com `campaignId` indefinido a chamada real tem 3 argumentos sendo o último `undefined` — usar `toHaveBeenCalledWith("p1", 11, undefined)` no teste se o matcher exigir, ou montar a chamada só com `campaignId` quando ele existir. Escolha uma forma e mantenha consistente.)

3. Em `apps/mypet/app/agente/styles.ts`, antes do bloco `@media (max-width: 900px)`, adicionar:

```css
  .ag-cart { position: sticky; top: 92px; background: #fff; border: 1px solid var(--pa-line); border-radius: var(--pa-r-card); padding: 20px; }
  .ag-cart-title { font-family: var(--pa-geist); font-weight: 700; font-size: 20px; color: var(--pa-navy); margin: 0 0 12px; }
  .ag-cart-title:focus-visible { outline: 2px solid var(--pa-green); outline-offset: 2px; }
  .ag-cart-empty, .ag-cart-done { margin: 0; color: var(--pa-muted); font-size: 14px; line-height: 1.55; }
  .ag-cart-done { color: var(--pa-green-dark); font-weight: 600; }
  .ag-cart-empty a { color: var(--pa-green-dark); font-weight: 600; }
  .ag-cart-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; max-height: 50vh; overflow-y: auto; }
  .ag-cart-item { display: flex; flex-direction: column; gap: 6px; padding-bottom: 10px; border-bottom: 1px solid var(--pa-line); }
  .ag-cart-item-info { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
  .ag-cart-item-name { color: var(--pa-ink); font-weight: 600; overflow-wrap: anywhere; }
  .ag-cart-item-price { color: var(--pa-navy); font-weight: 700; white-space: nowrap; }
  .ag-cart-stepper { display: flex; align-items: center; gap: 8px; }
  .ag-cart-stepper button { width: 32px; height: 32px; border: 1px solid var(--pa-line); border-radius: 8px; background: #fff; color: var(--pa-navy); font-size: 16px; cursor: pointer; }
  .ag-cart-stepper button:focus-visible { outline: 2px solid var(--pa-green); outline-offset: 2px; }
  .ag-cart-stepper span { min-width: 28px; text-align: center; font-weight: 600; }
  .ag-cart-remove { margin-left: auto; color: var(--pa-muted) !important; }
  .ag-cart-total { display: flex; justify-content: space-between; margin: 14px 0; font-size: 16px; color: var(--pa-ink); }
  .ag-cart-error { margin: 0 0 10px; color: #B42318; font-size: 14px; }
  .ag-cart-send { width: 100%; padding: 14px; border: 0; border-radius: var(--pa-r-pill); background: var(--pa-green); color: #fff; font-family: var(--pa-geist); font-weight: 600; font-size: 15px; cursor: pointer; }
  .ag-cart-send:disabled { opacity: .6; cursor: default; }
  .ag-cart-send:focus-visible { outline: 2px solid var(--pa-navy); outline-offset: 2px; }
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter mypet exec vitest run app/agente/cart-sync.test.ts app/agente/cart-panel.test.tsx` e o `tsc` filtrado em `app/agente`.
Expected: PASS; sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/agente/cart-sync.ts apps/mypet/app/agente/cart-sync.test.ts apps/mypet/app/agente/cart-panel.tsx apps/mypet/app/agente/cart-panel.test.tsx apps/mypet/app/agente/styles.ts
git commit -m "feat(mypet): Seu pedido no agente com envio pelo WhatsApp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Ligar o modo cliente no `/agente` (chat, cartões, carrinho e celular)

**Files:**
- Create: `apps/mypet/app/agente/use-sheet-dialog.ts`
- Modify: `apps/mypet/app/agente/access-panel.tsx` (usar o hook)
- Modify: `apps/mypet/app/agente/agent-chat.tsx` (intenções do cliente, aplicar alterações, avisar id da conversa, botão Adicionar)
- Modify: `apps/mypet/app/agente/product-cards.tsx` (botão "Adicionar")
- Modify: `apps/mypet/app/agente/agent-shell.tsx` (coluna "Seu pedido", barra e painel no celular)
- Modify: `apps/mypet/app/agente/styles.ts`
- Test: `apps/mypet/app/agente/agent-chat.test.tsx`, `apps/mypet/app/agente/agent-shell.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function useSheetDialog(opts: { active: boolean; onClose: () => void; focusRef: RefObject<HTMLElement | null> }): void;
  // AgentChat ganha: onConversationChange?: (id: string) => void
  // ProductCards ganha: onAdd?: (product: AgentProduct) => void (só modo cliente)
  ```

- [ ] **Step 1: Write the failing tests**

1. Em `agent-chat.test.tsx`:
   - o mock de `useCart` passa a expor `addItem`, `updateQty`, `removeItem` (vi.fn) além de `cart`;
   - o mock de `useAgentChat` passa a capturar os argumentos (`onAssistantMessage`) — guardar em `chat.lastArgs`;
   - testes novos:
     - cliente: intenções "Montar um pedido", "O que preciso repor?", "Status dos meus pedidos", "Frete e prazos de entrega"; clicar em "O que preciso repor?" chama `sendText("O que eu preciso repor?")`;
     - cliente: cartão com preço tem botão "Adicionar Shampoo Neutro — 5L ao pedido"; clicar chama `addItem` com `{ id: "p1", name: "Shampoo Neutro — 5L", sku: "S1", brand: "Pet Clean", img: "/x.jpg", unitPrice: 89.9 }` e quantidade 1, e o botão mostra "Adicionado ✓";
     - cliente: produto com `unitPrice: null` não mostra "Adicionar";
     - visitante: nenhum botão "Adicionar";
     - `onAssistantMessage` recebido pelo hook aplica `cartChangesFromMessage(message)` no carrinho (chamar `chat.lastArgs.onAssistantMessage(mensagemComAlterarPedido)` dentro de `act` e esperar `addItem` chamado);
     - `onConversationChange` é chamado com o id da conversa.

2. Em `agent-shell.test.tsx`:
   - mockar `./cart-panel` com `CartPanel: ({ conversationId }) => <div>carrinho {String(conversationId)}</div>`;
   - cliente (desktop): mostra o painel "carrinho ..." e não mostra "Acesso completo ao agente";
   - cliente (celular, matchMedia true): barra "Ver seu pedido" (com quantidade de itens do `useCart` mockado — mockar `@mypet/core/components/cart-provider` com 2 itens) abre um diálogo nomeado "Seu pedido"; Esc fecha e o foco volta para a barra;
   - os testes do visitante continuam passando (painel de acesso como diálogo no celular).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter mypet exec vitest run app/agente`
Expected: FAIL nos novos testes.

- [ ] **Step 3: Write the implementation**

1. Criar `apps/mypet/app/agente/use-sheet-dialog.ts` com o efeito que hoje está dentro de `access-panel.tsx` (foco no `focusRef` ao abrir, `document.body.style.overflow = "hidden"` com restauração, Esc chama `onClose`), recebendo `{ active, onClose, focusRef }`. Trocar o `useEffect` de `access-panel.tsx` por `useSheetDialog({ active: modal, onClose, focusRef: headingRef })`. Os testes atuais do visitante devem continuar passando sem mudança.

2. `product-cards.tsx`: nova prop opcional `onAdd?: (product: AgentProduct) => void`. No modo cliente, quando `p.unitPrice != null && onAdd`, mostrar abaixo do link "Ver na tabela" um botão `className="ag-product-add"` com texto "Adicionar" e `aria-label={`Adicionar ${nome exibido} ao pedido`}`; depois do clique o texto vira "Adicionado ✓" por 1,5 s (estado local por cartão, como o `justAdded` do `/pedido-rapido`). Nome exibido = `p.variantLabel ? `${p.name} — ${p.variantLabel}` : p.name`.

3. `agent-chat.tsx`:
   - `CLIENT_INTENTS` passa a ser:
     ```ts
     const CLIENT_INTENTS: Intent[] = [
       { label: "Montar um pedido", question: "Quero montar um pedido." },
       { label: "O que preciso repor?", question: "O que eu preciso repor?" },
       { label: "Status dos meus pedidos", question: "Como estão os meus pedidos?" },
       SHARED_INTENTS[0],
     ];
     ```
     e o texto de boas-vindas do cliente: "Monte seu pedido conversando, veja o que repor e acompanhe seus pedidos.".
   - `AgentChatProps` ganha `onConversationChange?: (id: string) => void`; em `AgentChatSession`, `useEffect(() => onConversationChange?.(conversation.id), [conversation.id, onConversationChange])`.
   - Em `AgentChatSession`, pegar `addItem`, `updateQty`, `removeItem` do `useCart()` e passar ao `useAgentChat`:
     ```ts
     onAssistantMessage: (message) => {
       if (mode !== "cliente") return;
       applyCartChanges(cartChangesFromMessage(message), { items: cartRef.current.items, addItem, updateQty, removeItem });
     },
     ```
     (`cartRef` = ref sempre com o `cart` mais recente; `cartChangesFromMessage` vem de `@mypet/core/agent-client`; `applyCartChanges` de `./cart-sync`).
   - Passar `onAdd` para `ProductCards` no modo cliente: `(p) => addItem({ id: p.id, name: nomeExibido, sku: p.sku, brand: p.brand, img: p.img, unitPrice: p.unitPrice ?? undefined }, 1)`.

4. `agent-shell.tsx`:
   - `const [conversationId, setConversationId] = useState<string | null>(null)` e `onConversationChange={setConversationId}` (estável) no `AgentChat`.
   - Modo cliente também usa `ag-main ag-main--split`; a coluna da direita é `<aside className={cartModal ? "ag-cart-aside is-open" : "ag-cart-aside"} aria-labelledby=...>` com `<CartPanel conversationId={conversationId} headingRef={cartHeadingRef} />` e um botão "×" (`aria-label="Fechar"`, classe `ag-access-close`) visível só no celular.
   - Celular (modo cliente): barra fixa `className="ag-unlock-bar ag-cart-bar"` com texto `Ver seu pedido · {n} {n === 1 ? "item" : "itens"} · {total}` (n = soma das quantidades do `useCart`; total em BRL) que abre o painel; `cartModal = isMobile && cartOpen`; usar `useSheetDialog({ active: cartModal, onClose, focusRef: cartHeadingRef })`, `role="dialog"`/`aria-modal` só quando `cartModal`, `inert` no chat enquanto aberto, foco volta para a barra ao fechar (mesmo padrão do visitante).
   - Visitante: sem mudança.

5. `styles.ts`: adicionar `.ag-cart-aside { position: sticky; top: 92px; }`, `.ag-product-add` (botão verde pequeno, foco visível) e, no `@media (max-width: 900px)`, as mesmas regras de painel de baixo para cima do `.ag-access` aplicadas a `.ag-cart-aside` (`display:none` até `.is-open`, fixo embaixo, `max-height: 88dvh`, `overflow-y: auto`, sombra, `z-index: 60`) e `.ag-cart-aside .ag-cart { position: static; border: 0; }`.

- [ ] **Step 4: Run tests and build**

Run: `pnpm --filter mypet exec vitest run app/agente`, o `tsc` filtrado em `app/agente`, e `pnpm --filter mypet build`.
Expected: PASS; sem erros de tipo; build ok.

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/agente/use-sheet-dialog.ts apps/mypet/app/agente/access-panel.tsx apps/mypet/app/agente/agent-chat.tsx apps/mypet/app/agente/agent-chat.test.tsx apps/mypet/app/agente/product-cards.tsx apps/mypet/app/agente/agent-shell.tsx apps/mypet/app/agente/agent-shell.test.tsx apps/mypet/app/agente/styles.ts
git commit -m "feat(mypet): modo cliente do agente — pedido conversando, reposição, status e carrinho ao lado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação final e migration

- [ ] **Step 1: Suítes, tipos e build**

Run: `pnpm --filter @mypet/core test`, `pnpm --filter mypet test`, os `tsc` filtrados nos arquivos do bloco e `pnpm --filter mypet build`.
Expected: tudo verde.

- [ ] **Step 2: Migration — PEDIR CONFIRMAÇÃO AO USUÁRIO ANTES**

Perguntar se pode aplicar `supabase/migrations/20261015120000_orders_agent_conversation.sql` no Supabase `hub_catalogo`. Só com o "sim": aplicar (MCP `apply_migration`) e conferir com SQL só de leitura que `orders.agent_conversation_id` existe.

- [ ] **Step 3: Conferência local**

Com o build rodando (`next start` numa porta livre): `/agente` sem cookie continua no modo visitante; com cookie de comprador (se disponível localmente) mostra "Seu pedido" e as intenções do cliente. Sem chaves de IA locais, o envio de perguntas mostra o erro amigável — esperado.
