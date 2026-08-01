# Identidade do comprador e pedidos persistidos — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o carrinho de cotação sem persistência (localStorage + WhatsApp solto) por um fluxo com identidade leve do comprador (magic link por e-mail via Supabase Auth) e pedidos gravados com status, incluindo histórico de compras para o lojista e uma seção de gestão no admin.

**Architecture:** Autenticação sem senha via `supabase.auth.signInWithOtp` (Supabase Auth, mesmo padrão `@supabase/ssr` já usado em `apps/admin`), com uma tabela de perfil `buyers` 1:1 com `auth.users`. O carrinho continua em `localStorage` até o checkout; ao finalizar, se não há sessão, o lojista recebe um magic link por e-mail; ao voltar autenticado, o pedido é gravado (`orders` + `order_items`) antes de abrir o link do WhatsApp para a negociação manual, que não muda. `mypet` e `distribuidora` compartilham a lógica via `packages/core`; cada app mantém seus próprios arquivos de rota finos, seguindo o padrão já usado em `leads-server.ts`/`route.ts`.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), React 19, `@supabase/supabase-js`, `@supabase/ssr` (novo), Supabase Auth com SMTP customizado (Resend, configurado fora do repo), Vitest, Zod.

## Global Constraints

- Nunca prefixar credenciais **secretas** com `NEXT_PUBLIC_`. A chave anônima do Supabase (`SUPABASE_ANON_KEY`) é a exceção documentada: é uma chave pública por design (protegida por RLS), e precisa de `NEXT_PUBLIC_` para ser lida no client Supabase do navegador.
- `azpetshop` não tem fluxo de carrinho/cotação e fica fora de escopo — nenhuma mudança nesse app.
- Fechamento do pedido continua manual (WhatsApp/telefone); sem gateway de pagamento.
- Sem tabela de token própria — toda a lógica de expiração/uso único do magic link é do Supabase Auth.
- `leads` (tabela e fluxo atuais) não muda; `buyers`/`orders`/`order_items` são tabelas novas e independentes.
- Todo texto de UI em português, seguindo o tom dos formulários existentes (`lead-gate.tsx`, `cotacao-content.tsx`).

---

## Task 1: Schema no Supabase (`buyers`, `orders`, `order_items`)

O schema do `hub_catalogo` é gerenciado fora deste repositório (ver `ARCHITECTURE.md` §1.1). Esta tarefa é executada manualmente no SQL Editor do painel Supabase do projeto `hub_catalogo` — não há pasta de migrations no repo.

**Files:**
- Nenhum arquivo de código neste repositório é criado nesta tarefa.

**Interfaces:**
- Produces: tabelas `buyers(id, email, nome, empresa, whatsapp, cnpj, created_at)`, `orders(id, buyer_id, channel, status, created_at, updated_at)`, `order_items(id, order_id, product_id, product_name_snapshot, qty)`, consumidas por todas as tarefas seguintes.

- [ ] **Step 1: Executar o script SQL abaixo no SQL Editor do Supabase (projeto `hub_catalogo`)**

```sql
-- Perfil do comprador, 1:1 com um usuário do Supabase Auth.
create table buyers (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  nome          text not null,
  empresa       text not null,
  whatsapp      text not null,
  cnpj          text,
  created_at    timestamptz not null default now()
);

create table orders (
  id            uuid primary key default gen_random_uuid(),
  buyer_id      uuid not null references buyers(id) on delete cascade,
  channel       text not null check (channel in ('mypetbrasil', 'distribuidora')),
  status        text not null default 'pendente'
                  check (status in ('pendente', 'confirmado', 'entregue', 'cancelado')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders(id) on delete cascade,
  product_id            uuid not null references products(id),
  product_name_snapshot text not null,
  qty                   integer not null check (qty > 0)
);

create index orders_buyer_id_idx on orders(buyer_id);
create index order_items_order_id_idx on order_items(order_id);

alter table buyers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Comprador só enxerga/edita o próprio perfil.
create policy "buyers_select_own" on buyers
  for select using (auth.uid() = id);
create policy "buyers_insert_own" on buyers
  for insert with check (auth.uid() = id);

-- Comprador só enxerga/cria os próprios pedidos.
create policy "orders_select_own" on orders
  for select using (auth.uid() = buyer_id);
create policy "orders_insert_own" on orders
  for insert with check (auth.uid() = buyer_id);

create policy "order_items_select_own" on order_items
  for select using (
    exists (select 1 from orders where orders.id = order_items.order_id and orders.buyer_id = auth.uid())
  );
create policy "order_items_insert_own" on order_items
  for insert with check (
    exists (select 1 from orders where orders.id = order_items.order_id and orders.buyer_id = auth.uid())
  );

-- Admin (apps/admin, admin_users) enxerga e atualiza tudo.
-- Ajuste o nome/condição da policy se a tabela `leads` já usa um padrão
-- diferente para dar acesso de admin — mantenha os dois consistentes.
create policy "orders_admin_all" on orders
  for all using (exists (select 1 from admin_users where admin_users.id = auth.uid()));
create policy "order_items_admin_all" on order_items
  for all using (exists (select 1 from admin_users where admin_users.id = auth.uid()));
create policy "buyers_admin_select" on buyers
  for select using (exists (select 1 from admin_users where admin_users.id = auth.uid()));
```

- [ ] **Step 2: Verificar que as tabelas existem**

No SQL Editor, rodar:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('buyers', 'orders', 'order_items');
```

Esperado: as três linhas retornam.

- [ ] **Step 3: Configurar SMTP customizado (Resend) no Supabase Auth**

No painel Supabase: Authentication → Settings → SMTP Settings, apontar para as credenciais do Resend (domínio verificado). Sem isso, `signInWithOtp` usa o e-mail padrão do Supabase (rate limit muito baixo, inadequado para produção). Esse passo é manual, fora do repositório — documentar aqui apenas que foi feito antes de seguir para a Task 6.

---

## Task 2: Clients Supabase compartilhados em `packages/core`

**Files:**
- Modify: `packages/core/package.json`
- Create: `packages/core/src/supabase-browser.ts`
- Create: `packages/core/src/supabase-server.ts`

**Interfaces:**
- Consumes: nenhuma (base para todas as tarefas seguintes).
- Produces: `createBrowserSupabaseClient(): SupabaseClient` (client-side), `createServerSupabaseClient(): Promise<SupabaseClient>` (server-side, usada por Task 3-9).

- [ ] **Step 1: Adicionar `@supabase/ssr` como dependência**

Em `packages/core/package.json`, no bloco `dependencies` (ordem alfabética, ao lado de `@supabase/supabase-js`):

```json
    "@supabase/ssr": "^0.8.0",
    "@supabase/supabase-js": "^2.108.2",
```

Rodar:

```bash
pnpm install
```

- [ ] **Step 2: Criar o client de navegador**

`packages/core/src/supabase-browser.ts`:

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createBrowserSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY precisam estar definidos no ambiente."
    );
  }
  return createBrowserClient(url, key);
}
```

- [ ] **Step 3: Criar o client de servidor**

`packages/core/src/supabase-server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY precisam estar definidos no ambiente."
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado a partir de um Server Component — ignorável, o proxy.ts
          // de cada app (Task 6) já renova a sessão a cada request.
        }
      },
    },
  });
}
```

- [ ] **Step 4: Expor os dois módulos no `package.json` de `packages/core`**

Em `packages/core/package.json`, no bloco `exports`, adicionar (ordem alfabética):

```json
    "./supabase-browser": "./src/supabase-browser.ts",
    "./supabase-server": "./src/supabase-server.ts",
```

(mantendo a entrada existente `"./supabase": "./src/supabase.ts"` intacta).

- [ ] **Step 5: Adicionar as variáveis de ambiente novas em `.env.local` de `mypet` e `distribuidora`**

Em `apps/mypet/.env.local` e `apps/distribuidora/.env.local` (arquivos não versionados), adicionar, com o mesmo valor de `SUPABASE_URL`/`SUPABASE_ANON_KEY` já existentes:

```
NEXT_PUBLIC_SUPABASE_URL=<mesmo valor de SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<mesmo valor de SUPABASE_ANON_KEY>
```

- [ ] **Step 6: Rodar o build para confirmar que nada quebrou**

```bash
pnpm --filter @mypet/core test
```

Esperado: PASS (nenhum teste novo ainda, mas o pacote deve compilar/typecheck sem erro ao ser importado pelos apps na Task 6).

- [ ] **Step 7: Commit**

```bash
git add packages/core/package.json packages/core/src/supabase-browser.ts packages/core/src/supabase-server.ts pnpm-lock.yaml
git commit -m "feat(core): adiciona clients Supabase compartilhados (browser/server) via @supabase/ssr"
```

---

## Task 3: `buyers-server.ts` — perfil do comprador

**Files:**
- Create: `packages/core/src/buyers-server.ts`
- Test: `packages/core/src/buyers-server.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient` (de `@supabase/supabase-js`, injetado pelo chamador — não importa `supabase-server.ts` diretamente, para ficar testável como `leads-server.ts`).
- Produces:
  - `type Buyer = { id: string; email: string; nome: string; empresa: string; whatsapp: string; cnpj: string | null }`
  - `getBuyerById(supabase: SupabaseClient, userId: string): Promise<Buyer | null>`
  - `type CreateBuyerInput = { id: string; email: string; nome: string; empresa: string; whatsapp: string; cnpj?: string }`
  - `createBuyer(supabase: SupabaseClient, input: CreateBuyerInput): Promise<{ error: string | null }>`

- [ ] **Step 1: Escrever o teste (falhando)**

`packages/core/src/buyers-server.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getBuyerById, createBuyer } from "./buyers-server";

function fakeSupabase(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      ...overrides,
    })),
  } as any;
}

describe("getBuyerById", () => {
  it("retorna o buyer quando encontrado", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "u1", email: "a@a.com", nome: "João", empresa: "Pet X", whatsapp: "11999999999", cnpj: null },
      error: null,
    });
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single })),
    } as any;

    const buyer = await getBuyerById(supabase, "u1");

    expect(supabase.from).toHaveBeenCalledWith("buyers");
    expect(buyer).toEqual({ id: "u1", email: "a@a.com", nome: "João", empresa: "Pet X", whatsapp: "11999999999", cnpj: null });
  });

  it("retorna null quando não encontrado", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single })),
    } as any;

    const buyer = await getBuyerById(supabase, "u1");
    expect(buyer).toBeNull();
  });
});

describe("createBuyer", () => {
  it("grava o buyer com cnpj vazio virando null", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert })) } as any;

    const result = await createBuyer(supabase, {
      id: "u1",
      email: "a@a.com",
      nome: "João",
      empresa: "Pet X",
      whatsapp: "11999999999",
    });

    expect(supabase.from).toHaveBeenCalledWith("buyers");
    expect(insert).toHaveBeenCalledWith({
      id: "u1",
      email: "a@a.com",
      nome: "João",
      empresa: "Pet X",
      whatsapp: "11999999999",
      cnpj: null,
    });
    expect(result.error).toBeNull();
  });

  it("retorna erro genérico quando o Supabase falha", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: "conexão recusada" } });
    const supabase = { from: vi.fn(() => ({ insert })) } as any;

    const result = await createBuyer(supabase, {
      id: "u1",
      email: "a@a.com",
      nome: "João",
      empresa: "Pet X",
      whatsapp: "11999999999",
    });

    expect(result.error).toBe("Não foi possível concluir seu cadastro. Tente novamente em instantes.");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

```bash
pnpm --filter @mypet/core exec vitest run src/buyers-server.test.ts
```

Esperado: FAIL — `Cannot find module './buyers-server'`.

- [ ] **Step 3: Implementar**

`packages/core/src/buyers-server.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type Buyer = {
  id: string;
  email: string;
  nome: string;
  empresa: string;
  whatsapp: string;
  cnpj: string | null;
};

export async function getBuyerById(supabase: SupabaseClient, userId: string): Promise<Buyer | null> {
  const { data, error } = await supabase
    .from("buyers")
    .select("id, email, nome, empresa, whatsapp, cnpj")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as Buyer;
}

export type CreateBuyerInput = {
  id: string;
  email: string;
  nome: string;
  empresa: string;
  whatsapp: string;
  cnpj?: string;
};

export async function createBuyer(
  supabase: SupabaseClient,
  input: CreateBuyerInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("buyers").insert({
    id: input.id,
    email: input.email,
    nome: input.nome,
    empresa: input.empresa,
    whatsapp: input.whatsapp,
    cnpj: input.cnpj || null,
  });

  if (error) {
    console.error("[buyers] erro ao criar comprador:", error.message);
    return { error: "Não foi possível concluir seu cadastro. Tente novamente em instantes." };
  }

  return { error: null };
}
```

- [ ] **Step 4: Rodar o teste e confirmar sucesso**

```bash
pnpm --filter @mypet/core exec vitest run src/buyers-server.test.ts
```

Esperado: PASS (4 testes).

- [ ] **Step 5: Expor o módulo em `packages/core/package.json`**

No bloco `exports`, adicionar em ordem alfabética:

```json
    "./buyers-server": "./src/buyers-server.ts",
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/buyers-server.ts packages/core/src/buyers-server.test.ts packages/core/package.json
git commit -m "feat(core): adiciona buyers-server com getBuyerById e createBuyer"
```

---

## Task 4: `orders-server.ts` — criação e consulta de pedidos

**Files:**
- Create: `packages/core/src/orders-server.ts`
- Test: `packages/core/src/orders-server.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient` (injetado), `CartItem` de `./cart` (`{ id, name, sku, brand, img, qty }`), `Channel` de `./channels`.
- Produces:
  - `createOrder(supabase: SupabaseClient, input: { buyerId: string; channel: Channel; items: CartItem[] }): Promise<{ orderId: string | null; error: string | null }>`
  - `type OrderWithItems = { id: string; status: string; createdAt: string; items: { productId: string; name: string; qty: number }[] }`
  - `getOrdersByBuyer(supabase: SupabaseClient, buyerId: string): Promise<OrderWithItems[]>`

- [ ] **Step 1: Escrever o teste (falhando)**

`packages/core/src/orders-server.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createOrder, getOrdersByBuyer } from "./orders-server";
import type { CartItem } from "./cart";

const items: CartItem[] = [
  { id: "p1", name: "Ração Premium 15kg", sku: "SKU1", brand: "Marca X", img: "/img.png", qty: 2 },
];

describe("createOrder", () => {
  it("retorna erro quando o carrinho está vazio", async () => {
    const supabase = { from: vi.fn() } as any;
    const result = await createOrder(supabase, { buyerId: "b1", channel: "mypetbrasil", items: [] });
    expect(result).toEqual({ orderId: null, error: "O carrinho está vazio." });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("grava o pedido e os itens com snapshot do nome", async () => {
    const ordersInsertSelect = vi.fn().mockReturnThis();
    const ordersSingle = vi.fn().mockResolvedValue({ data: { id: "o1" }, error: null });
    const orderItemsInsert = vi.fn().mockResolvedValue({ error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return { insert: vi.fn().mockReturnThis(), select: ordersInsertSelect, single: ordersSingle };
        }
        return { insert: orderItemsInsert };
      }),
    } as any;

    const result = await createOrder(supabase, { buyerId: "b1", channel: "mypetbrasil", items });

    expect(supabase.from).toHaveBeenCalledWith("orders");
    expect(supabase.from).toHaveBeenCalledWith("order_items");
    expect(orderItemsInsert).toHaveBeenCalledWith([
      { order_id: "o1", product_id: "p1", product_name_snapshot: "Ração Premium 15kg", qty: 2 },
    ]);
    expect(result).toEqual({ orderId: "o1", error: null });
  });

  it("retorna erro genérico quando a criação do pedido falha", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "conexão recusada" } }),
      })),
    } as any;

    const result = await createOrder(supabase, { buyerId: "b1", channel: "mypetbrasil", items });
    expect(result.orderId).toBeNull();
    expect(result.error).toBe("Não foi possível registrar seu pedido. Tente novamente em instantes.");
  });
});

describe("getOrdersByBuyer", () => {
  it("mapeia pedidos com itens", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "o1",
              status: "pendente",
              created_at: "2026-07-31T00:00:00Z",
              order_items: [{ product_id: "p1", product_name_snapshot: "Ração Premium 15kg", qty: 2 }],
            },
          ],
          error: null,
        }),
      })),
    } as any;

    const orders = await getOrdersByBuyer(supabase, "b1");

    expect(orders).toEqual([
      {
        id: "o1",
        status: "pendente",
        createdAt: "2026-07-31T00:00:00Z",
        items: [{ productId: "p1", name: "Ração Premium 15kg", qty: 2 }],
      },
    ]);
  });

  it("retorna lista vazia quando o Supabase falha", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: "erro" } }),
      })),
    } as any;

    const orders = await getOrdersByBuyer(supabase, "b1");
    expect(orders).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

```bash
pnpm --filter @mypet/core exec vitest run src/orders-server.test.ts
```

Esperado: FAIL — `Cannot find module './orders-server'`.

- [ ] **Step 3: Implementar**

`packages/core/src/orders-server.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartItem } from "./cart";
import type { Channel } from "./channels";

export async function createOrder(
  supabase: SupabaseClient,
  input: { buyerId: string; channel: Channel; items: CartItem[] }
): Promise<{ orderId: string | null; error: string | null }> {
  if (input.items.length === 0) {
    return { orderId: null, error: "O carrinho está vazio." };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({ buyer_id: input.buyerId, channel: input.channel, status: "pendente" })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[orders] erro ao criar pedido:", orderError?.message);
    return { orderId: null, error: "Não foi possível registrar seu pedido. Tente novamente em instantes." };
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    input.items.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      product_name_snapshot: item.name,
      qty: item.qty,
    }))
  );

  if (itemsError) {
    console.error("[orders] erro ao gravar itens do pedido:", itemsError.message);
    return { orderId: null, error: "Não foi possível registrar os itens do pedido. Tente novamente em instantes." };
  }

  return { orderId: order.id as string, error: null };
}

export type OrderWithItems = {
  id: string;
  status: string;
  createdAt: string;
  items: { productId: string; name: string; qty: number }[];
};

type RawOrderRow = {
  id: string;
  status: string;
  created_at: string;
  order_items: { product_id: string; product_name_snapshot: string; qty: number }[] | null;
};

export async function getOrdersByBuyer(supabase: SupabaseClient, buyerId: string): Promise<OrderWithItems[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, created_at, order_items(product_id, product_name_snapshot, qty)")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[orders] erro ao consultar pedidos:", error.message);
    return [];
  }

  return ((data as unknown as RawOrderRow[]) ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    items: (row.order_items ?? []).map((it) => ({
      productId: it.product_id,
      name: it.product_name_snapshot,
      qty: it.qty,
    })),
  }));
}
```

- [ ] **Step 4: Rodar o teste e confirmar sucesso**

```bash
pnpm --filter @mypet/core exec vitest run src/orders-server.test.ts
```

Esperado: PASS (5 testes).

- [ ] **Step 5: Expor o módulo em `packages/core/package.json`**

```json
    "./orders-server": "./src/orders-server.ts",
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/orders-server.ts packages/core/src/orders-server.test.ts packages/core/package.json
git commit -m "feat(core): adiciona orders-server com createOrder e getOrdersByBuyer"
```

---

## Task 5: `auth-server.ts` (callback handler) + `LoginForm`

**Files:**
- Create: `packages/core/src/auth-server.ts`
- Test: `packages/core/src/auth-server.test.ts`
- Create: `packages/core/src/components/login-form.tsx`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (Task 2), `createBrowserSupabaseClient` (Task 2), `useClientConfig` (`../theme`, já existente).
- Produces:
  - `createAuthCallbackHandler(): (request: NextRequest) => Promise<Response>` (exportada como `GET` pelas rotas dos apps).
  - `<LoginForm next?: string />` (componente client, formulário de e-mail).

- [ ] **Step 1: Escrever o teste do callback (falhando)**

`packages/core/src/auth-server.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const exchangeCodeForSession = vi.fn();
const buyerSingleMock = vi.fn();

vi.mock("./supabase-server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: buyerSingleMock,
    })),
  })),
}));

import { createAuthCallbackHandler } from "./auth-server";

function fakeRequest(url: string): NextRequest {
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  buyerSingleMock.mockReset();
});

describe("createAuthCallbackHandler", () => {
  it("redireciona para /entrar quando não há código", async () => {
    const GET = createAuthCallbackHandler();
    const res = await GET(fakeRequest("https://app.test/entrar/callback"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.test/entrar?erro=link-invalido");
  });

  it("redireciona para /entrar quando a troca de código falha", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: { message: "expirado" } });
    const GET = createAuthCallbackHandler();
    const res = await GET(fakeRequest("https://app.test/entrar/callback?code=abc"));
    expect(res.headers.get("location")).toBe("https://app.test/entrar?erro=link-invalido");
  });

  it("redireciona para /completar-cadastro quando o buyer ainda não existe", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    buyerSingleMock.mockResolvedValue({ data: null, error: null });
    const GET = createAuthCallbackHandler();
    const res = await GET(fakeRequest("https://app.test/entrar/callback?code=abc&next=%2Fcotacao"));
    expect(res.headers.get("location")).toBe("https://app.test/completar-cadastro?next=%2Fcotacao");
  });

  it("redireciona para next quando o buyer já existe", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    buyerSingleMock.mockResolvedValue({ data: { id: "u1" }, error: null });
    const GET = createAuthCallbackHandler();
    const res = await GET(fakeRequest("https://app.test/entrar/callback?code=abc&next=%2Fcotacao"));
    expect(res.headers.get("location")).toBe("https://app.test/cotacao");
  });

  it("usa /cotacao como destino padrão quando next não é informado", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    buyerSingleMock.mockResolvedValue({ data: { id: "u1" }, error: null });
    const GET = createAuthCallbackHandler();
    const res = await GET(fakeRequest("https://app.test/entrar/callback?code=abc"));
    expect(res.headers.get("location")).toBe("https://app.test/cotacao");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

```bash
pnpm --filter @mypet/core exec vitest run src/auth-server.test.ts
```

Esperado: FAIL — `Cannot find module './auth-server'`.

- [ ] **Step 3: Implementar `auth-server.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "./supabase-server";

export function createAuthCallbackHandler() {
  return async function GET(request: NextRequest): Promise<Response> {
    const code = request.nextUrl.searchParams.get("code");
    const next = request.nextUrl.searchParams.get("next") ?? "/cotacao";
    const origin = request.nextUrl.origin;

    if (!code) {
      return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`);
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`);
    }

    const { data: buyer } = await supabase
      .from("buyers")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!buyer) {
      return NextResponse.redirect(`${origin}/completar-cadastro?next=${encodeURIComponent(next)}`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar sucesso**

```bash
pnpm --filter @mypet/core exec vitest run src/auth-server.test.ts
```

Esperado: PASS (5 testes).

- [ ] **Step 5: Criar o `LoginForm`**

`packages/core/src/components/login-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "../supabase-browser";
import { useClientConfig } from "../theme";

export function LoginForm({ next }: { next?: string }) {
  const { palette } = useClientConfig();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const supabase = createBrowserSupabaseClient();
    const callbackUrl = new URL("/entrar/callback", window.location.origin);
    if (next) callbackUrl.searchParams.set("next", next);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    });

    setSubmitting(false);
    if (authError) {
      setError("Não foi possível enviar o link agora. Tente novamente em instantes.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: palette.navy, marginBottom: 8 }}>
          Verifique seu e-mail
        </h2>
        <p style={{ fontSize: 14, color: palette.gray600, lineHeight: 1.5 }}>
          Enviamos um link de acesso para {email}. Abra o e-mail no mesmo aparelho para continuar de onde parou.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        className="form-input"
        type="email"
        placeholder="Seu e-mail"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && (
        <p style={{ color: palette.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{error}</p>
      )}
      <button type="submit" className="form-submit" disabled={submitting}>
        {submitting ? "Enviando..." : "Receber link de acesso →"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Expor os módulos novos em `packages/core/package.json`**

```json
    "./auth-server": "./src/auth-server.ts",
```

(o componente já é coberto pelo padrão existente `"./components/*": "./src/components/*.tsx"`).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/auth-server.ts packages/core/src/auth-server.test.ts packages/core/src/components/login-form.tsx packages/core/package.json
git commit -m "feat(core): adiciona auth-server (callback do magic link) e LoginForm"
```

---

## Task 6: Rota `/entrar` + callback + `proxy.ts` (mypet e distribuidora)

**Files:**
- Create: `apps/mypet/app/entrar/page.tsx`
- Create: `apps/mypet/app/entrar/callback/route.ts`
- Create: `apps/mypet/proxy.ts`
- Create: `apps/distribuidora/app/entrar/page.tsx`
- Create: `apps/distribuidora/app/entrar/callback/route.ts`
- Create: `apps/distribuidora/proxy.ts`

**Interfaces:**
- Consumes: `LoginForm` (Task 5), `createAuthCallbackHandler` (Task 5), `SiteNav`, `LeadGateProvider`, `getCategories` (já existentes).
- Produces: rota pública `/entrar?next=<path>&erro=<code>` e `/entrar/callback` em cada app; sessão do Supabase renovada a cada request via `proxy.ts`.

- [ ] **Step 1: Criar `proxy.ts` em `mypet`**

`apps/mypet/proxy.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Repetir o Step 1 em `apps/distribuidora/proxy.ts`** (arquivo idêntico)

- [ ] **Step 3: Criar a página `/entrar` em `mypet`**

`apps/mypet/app/entrar/page.tsx`:

```tsx
import Link from "next/link";
import { getCategories } from "@mypet/core/catalog";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { SiteNav } from "@mypet/core/components/site-nav";
import { LoginForm } from "@mypet/core/components/login-form";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const categories = await getCategories();
  const { next, erro } = await searchParams;

  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid ${PALETTE.gray200};
          border-radius: 10px;
          font-family: 'Nunito Sans', sans-serif;
          font-size: 15px;
          color: ${PALETTE.gray800};
          outline: none;
          margin-bottom: 12px;
        }
        .form-input:focus { border-color: ${PALETTE.pink}; }
        .form-submit {
          width: 100%;
          padding: 14px;
          background: ${PALETTE.pink};
          color: white;
          border: none;
          border-radius: 10px;
          font-family: 'Nunito', sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }
        .form-submit:hover { background: ${PALETTE.pinkDark}; }
        .form-submit:disabled { opacity: 0.6; cursor: default; }
      `}</style>

      <LeadGateProvider>
        <SiteNav categories={categories} />
        <main style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 8, textAlign: "center" }}>
            Entrar
          </h1>
          <p style={{ fontSize: 14, color: PALETTE.gray600, textAlign: "center", marginBottom: 24 }}>
            Informe seu e-mail para receber um link de acesso — sem senha.
          </p>
          {erro === "link-invalido" && (
            <p style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 16, textAlign: "center" }}>
              O link usado expirou ou já foi usado. Peça um novo abaixo.
            </p>
          )}
          <LoginForm next={next} />
          <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 20, fontSize: 13, color: PALETTE.gray400 }}>
            ← Voltar ao catálogo
          </Link>
        </main>
      </LeadGateProvider>
    </div>
  );
}
```

- [ ] **Step 4: Repetir o Step 3 em `apps/distribuidora/app/entrar/page.tsx`**, trocando apenas o import `@mypet/core/...` por `@mypet/core/...` (mesmo pacote — o arquivo é idêntico, só muda `@/client.config` que já resolve para o config de cada app).

- [ ] **Step 5: Criar o route handler de callback em `mypet`**

`apps/mypet/app/entrar/callback/route.ts`:

```ts
import { createAuthCallbackHandler } from "@mypet/core/auth-server";

export const GET = createAuthCallbackHandler();
```

- [ ] **Step 6: Repetir o Step 5 em `apps/distribuidora/app/entrar/callback/route.ts`** (arquivo idêntico)

- [ ] **Step 7: Verificação manual via `/run`**

Rodar `pnpm dev:mypet`, abrir `http://localhost:4100/entrar`, informar um e-mail de teste, confirmar que a UI muda para "Verifique seu e-mail" sem erro no console. (O envio real depende do SMTP do Supabase configurado na Task 1 Step 3 — se não configurado ainda, confirmar ao menos que a chamada não lança exceção não tratada.)

- [ ] **Step 8: Commit**

```bash
git add apps/mypet/proxy.ts apps/mypet/app/entrar apps/distribuidora/proxy.ts apps/distribuidora/app/entrar
git commit -m "feat(mypet,distribuidora): adiciona rota /entrar com magic link e proxy de sessão"
```

---

## Task 7: Cadastro completo do comprador (`/completar-cadastro`)

**Files:**
- Create: `packages/core/src/components/complete-signup-form.tsx`
- Create: `apps/mypet/app/completar-cadastro/page.tsx`
- Create: `apps/mypet/app/completar-cadastro/actions.ts`
- Create: `apps/distribuidora/app/completar-cadastro/page.tsx`
- Create: `apps/distribuidora/app/completar-cadastro/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (Task 2), `createBuyer` (Task 3).
- Produces: `<CompleteSignupForm action={(formData: FormData) => Promise<{ error: string | null }>} />`; rota `/completar-cadastro?next=<path>`, redireciona para `next` após gravar o `buyer`.

- [ ] **Step 1: Criar o componente compartilhado**

`packages/core/src/components/complete-signup-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useClientConfig } from "../theme";

export function CompleteSignupForm({
  action,
}: {
  action: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const { palette } = useClientConfig();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await action(new FormData(e.currentTarget));
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
    // Sucesso: a action redireciona via redirect() do Next, então não há
    // necessidade de tratar sucesso aqui.
  };

  return (
    <form onSubmit={handleSubmit}>
      <input className="form-input" name="nome" placeholder="Seu nome" required />
      <input className="form-input" name="empresa" placeholder="Nome do pet shop / empresa" required />
      <input className="form-input" name="whatsapp" placeholder="WhatsApp com DDD" required />
      <input className="form-input" name="cnpj" placeholder="CNPJ (opcional)" />
      {error && (
        <p style={{ color: palette.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{error}</p>
      )}
      <button type="submit" className="form-submit" disabled={submitting}>
        {submitting ? "Salvando..." : "Concluir cadastro →"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Criar a server action de `mypet`**

`apps/mypet/app/completar-cadastro/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@mypet/core/supabase-server";
import { createBuyer } from "@mypet/core/buyers-server";

export async function completeSignup(next: string, formData: FormData): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: "Sessão expirada. Peça um novo link de acesso." };
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const empresa = String(formData.get("empresa") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").trim();

  if (!nome || !empresa || !whatsapp) {
    return { error: "Preencha nome, empresa e WhatsApp." };
  }

  const { error } = await createBuyer(supabase, {
    id: user.id,
    email: user.email,
    nome,
    empresa,
    whatsapp,
    cnpj: cnpj || undefined,
  });

  if (error) return { error };

  redirect(next);
}
```

- [ ] **Step 3: Criar a página de `mypet`**

`apps/mypet/app/completar-cadastro/page.tsx`:

```tsx
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { SiteNav } from "@mypet/core/components/site-nav";
import { CompleteSignupForm } from "@mypet/core/components/complete-signup-form";
import { getCategories } from "@mypet/core/catalog";
import { clientConfig } from "@/client.config";
import { completeSignup } from "./actions";

const { palette: PALETTE } = clientConfig;

export default async function CompletarCadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const categories = await getCategories();
  const { next } = await searchParams;
  const target = next ?? "/cotacao";

  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid ${PALETTE.gray200};
          border-radius: 10px;
          font-family: 'Nunito Sans', sans-serif;
          font-size: 15px;
          color: ${PALETTE.gray800};
          outline: none;
          margin-bottom: 12px;
        }
        .form-input:focus { border-color: ${PALETTE.pink}; }
        .form-submit {
          width: 100%;
          padding: 14px;
          background: ${PALETTE.pink};
          color: white;
          border: none;
          border-radius: 10px;
          font-family: 'Nunito', sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }
        .form-submit:hover { background: ${PALETTE.pinkDark}; }
        .form-submit:disabled { opacity: 0.6; cursor: default; }
      `}</style>

      <LeadGateProvider>
        <SiteNav categories={categories} />
        <main style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 8, textAlign: "center" }}>
            Complete seu cadastro
          </h1>
          <p style={{ fontSize: 14, color: PALETTE.gray600, textAlign: "center", marginBottom: 24 }}>
            É seu primeiro acesso — precisamos de mais alguns dados.
          </p>
          <CompleteSignupForm action={completeSignup.bind(null, target)} />
        </main>
      </LeadGateProvider>
    </div>
  );
}
```

- [ ] **Step 4: Repetir Steps 2-3 em `apps/distribuidora`** (arquivos idênticos, trocando apenas o import de `@/client.config` que já resolve por app).

- [ ] **Step 5: Verificação manual via `/run`**

Fluxo completo: `/entrar` → informar e-mail → (simulando o clique no link, se o SMTP não estiver configurado ainda, chamar `supabase.auth.exchangeCodeForSession` manualmente não é viável sem e-mail real — nesse caso, validar ao menos que `/completar-cadastro` renderiza sem sessão retorna o erro "Sessão expirada" da action ao submeter). Com SMTP configurado: e-mail chega, link abre `/completar-cadastro`, formulário grava e redireciona para `/cotacao`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/complete-signup-form.tsx apps/mypet/app/completar-cadastro apps/distribuidora/app/completar-cadastro
git commit -m "feat(mypet,distribuidora): adiciona /completar-cadastro para primeiro acesso do comprador"
```

---

## Task 8: Checkout grava o pedido (`cotacao-content.tsx`)

**Files:**
- Modify: `apps/mypet/app/cotacao/cotacao-content.tsx`
- Create: `apps/mypet/app/cotacao/actions.ts`
- Modify: `apps/distribuidora/app/cotacao/cotacao-content.tsx`
- Create: `apps/distribuidora/app/cotacao/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (Task 2), `createOrder` (Task 4), `getBuyerById` (Task 3), `CartItem`/`useCart` (já existentes), `buildQuoteMessage`/`buildWhatsAppLink` (já existentes).
- Produces: ao finalizar a cotação com sessão ativa, grava `orders`+`order_items` antes de abrir o WhatsApp; sem sessão, redireciona para `/entrar?next=/cotacao`.

- [ ] **Step 1: Criar a server action de `mypet`**

`apps/mypet/app/cotacao/actions.ts`:

```ts
"use server";

import { createServerSupabaseClient } from "@mypet/core/supabase-server";
import { getBuyerById } from "@mypet/core/buyers-server";
import { createOrder } from "@mypet/core/orders-server";
import { clientConfig } from "@/client.config";
import type { CartItem } from "@mypet/core/cart";

export type FinalizeQuoteResult =
  | { ok: true; buyer: { nome: string; empresa: string; whatsapp: string; cnpj: string | null } }
  | { ok: false; error: string; needsAuth?: boolean };

export async function finalizeQuote(items: CartItem[]): Promise<FinalizeQuoteResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Você precisa entrar para finalizar a cotação.", needsAuth: true };
  }

  const buyer = await getBuyerById(supabase, user.id);
  if (!buyer) {
    return { ok: false, error: "Cadastro incompleto. Complete seu cadastro para continuar.", needsAuth: true };
  }

  const { error } = await createOrder(supabase, {
    buyerId: user.id,
    channel: clientConfig.catalogChannel,
    items,
  });

  if (error) {
    return { ok: false, error };
  }

  return { ok: true, buyer: { nome: buyer.nome, empresa: buyer.empresa, whatsapp: buyer.whatsapp, cnpj: buyer.cnpj } };
}
```

- [ ] **Step 2: Repetir o Step 1 em `apps/distribuidora/app/cotacao/actions.ts`** (arquivo idêntico).

- [ ] **Step 3: Atualizar `cotacao-content.tsx` de `mypet`**

Substituir o conteúdo completo de `apps/mypet/app/cotacao/cotacao-content.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@mypet/core/components/cart-provider";
import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
import type { Palette } from "@mypet/core/theme";
import { finalizeQuote } from "./actions";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export function CotacaoContent({ palette: PALETTE }: { palette: Palette }) {
  const { cart, removeItem, updateQty, clear } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: PALETTE.navy, marginBottom: 8 }}>
          Cotação enviada!
        </h2>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Abrimos o WhatsApp com os itens da sua cotação. Nossa equipe vai te responder por lá.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>
            Voltar ao catálogo
          </Link>
          <Link href="/pedidos" className="back-link" style={{ display: "inline-flex", alignItems: "center" }}>
            Ver meus pedidos →
          </Link>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>
          Sua cotação está vazia
        </h2>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Adicione produtos do catálogo para montar sua cotação.
        </p>
        <Link href="/" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Ver catálogo
        </Link>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!WHATSAPP_NUMBER) {
      setSubmitError("Não foi possível abrir o WhatsApp agora. Tente novamente mais tarde.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");

    const result = await finalizeQuote(cart.items);

    if (!result.ok) {
      if (result.needsAuth) {
        router.push(`/entrar?next=${encodeURIComponent("/cotacao")}`);
        return;
      }
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    const message = buildQuoteMessage(cart.items, result.buyer);
    window.open(buildWhatsAppLink(WHATSAPP_NUMBER, message), "_blank");

    clear();
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <>
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, marginBottom: 24, overflow: "hidden" }}>
        {cart.items.map((item, index) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: 16,
              borderBottom: index < cart.items.length - 1 ? `1px solid ${PALETTE.gray100}` : "none",
            }}
          >
            <img src={item.img} alt={item.name} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {item.brand && (
                <p style={{ fontSize: 10, color: PALETTE.pink, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                  {item.brand}
                </p>
              )}
              <p style={{ fontSize: 14, fontWeight: 700, color: PALETTE.navy, lineHeight: 1.3 }}>{item.name}</p>
              {item.sku && <p style={{ fontSize: 11, color: PALETTE.gray400 }}>SKU: {item.sku}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty - 1)}
                aria-label="Diminuir quantidade"
                style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
              >
                −
              </button>
              <span style={{ minWidth: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: PALETTE.navy }}>{item.qty}</span>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty + 1)}
                aria-label="Aumentar quantidade"
                style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label={`Remover ${item.name} da cotação`}
              style={{ border: "none", background: "transparent", color: PALETTE.gray400, cursor: "pointer", fontSize: 13, fontWeight: 700 }}
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 24 }}>
        {submitError && (
          <p style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 12, textAlign: "center" }}>{submitError}</p>
        )}
        <button type="button" className="form-submit" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Enviando..." : "Finalizar cotação →"}
        </button>
      </div>
    </>
  );
}
```

Mudanças-chave em relação à versão anterior: removeu o formulário local de nome/empresa/whatsapp/cnpj (os dados agora vêm de `buyers`, via `finalizeQuote`); ao clicar "Finalizar cotação", chama a server action, que redireciona para `/entrar` se não houver sessão/cadastro completo, ou grava o pedido e retorna os dados do comprador para montar a mensagem do WhatsApp.

- [ ] **Step 4: Repetir o Step 3 em `apps/distribuidora/app/cotacao/cotacao-content.tsx`** (arquivo idêntico).

- [ ] **Step 5: Verificação manual via `/run`**

Sem sessão: montar carrinho, clicar "Finalizar cotação" → redireciona para `/entrar?next=%2Fcotacao`. Com sessão e cadastro completo: clicar "Finalizar cotação" → WhatsApp abre com a mensagem, carrinho esvazia, tela de sucesso aparece com link para `/pedidos`.

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/app/cotacao apps/distribuidora/app/cotacao
git commit -m "feat(mypet,distribuidora): checkout grava pedido e exige sessão para finalizar"
```

---

## Task 9: Histórico de compras (`/pedidos`)

**Files:**
- Create: `apps/mypet/app/pedidos/page.tsx`
- Create: `apps/distribuidora/app/pedidos/page.tsx`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (Task 2), `getOrdersByBuyer` (Task 4).
- Produces: página autenticada `/pedidos`; redireciona para `/entrar?next=/pedidos` sem sessão.

- [ ] **Step 1: Criar a página de `mypet`**

`apps/mypet/app/pedidos/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@mypet/core/supabase-server";
import { getOrdersByBuyer } from "@mypet/core/orders-server";
import { getCategories } from "@mypet/core/catalog";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { SiteNav } from "@mypet/core/components/site-nav";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export default async function PedidosPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar?next=%2Fpedidos");
  }

  const orders = await getOrdersByBuyer(supabase, user.id);

  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <LeadGateProvider>
        <SiteNav categories={await getCategories()} />
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: PALETTE.navy, marginBottom: 24 }}>
            Meus pedidos
          </h1>

          {orders.length === 0 ? (
            <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: PALETTE.gray600 }}>Você ainda não fez nenhum pedido.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {orders.map((order) => (
                <div key={order.id} style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: PALETTE.gray400 }}>
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: PALETTE.pink, textTransform: "uppercase" }}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </div>
                  <ul style={{ listStyle: "none" }}>
                    {order.items.map((item) => (
                      <li key={item.productId} style={{ fontSize: 14, color: PALETTE.gray800, marginBottom: 4 }}>
                        {item.name} — Qtd: {item.qty}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </main>
      </LeadGateProvider>
    </div>
  );
}
```

- [ ] **Step 2: Repetir o Step 1 em `apps/distribuidora/app/pedidos/page.tsx`** (arquivo idêntico).

- [ ] **Step 3: Verificação manual via `/run`**

Sem sessão, acessar `/pedidos` diretamente → redireciona para `/entrar?next=%2Fpedidos`. Com sessão e pedidos existentes (criados na Task 8) → lista aparece com data, status e itens.

- [ ] **Step 4: Commit**

```bash
git add apps/mypet/app/pedidos apps/distribuidora/app/pedidos
git commit -m "feat(mypet,distribuidora): adiciona historico de pedidos em /pedidos"
```

---

## Task 10: Admin — seção Pedidos

**Files:**
- Create: `apps/admin/lib/orders.ts`
- Create: `apps/admin/app/(dashboard)/pedidos/page.tsx`
- Create: `apps/admin/app/(dashboard)/pedidos/actions.ts`
- Create: `apps/admin/app/(dashboard)/pedidos/order-status-select.tsx`
- Modify: `apps/admin/app/(dashboard)/layout.tsx:5-9`
- Test: `apps/admin/lib/orders.test.ts`

**Interfaces:**
- Consumes: `requireAdminSession` (já existente em `apps/admin/lib/auth.ts`).
- Produces: `ORDER_STATUSES`, `type OrderStatus`, `type OrderRow`, `ordersToCsv` opcional (fora de escopo — sem exportação CSV nesta task, ver "Fora de escopo" do spec); página `/pedidos` no admin, análoga a `/clientes`.

- [ ] **Step 1: Escrever o teste (falhando)**

`apps/admin/lib/orders.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ORDER_STATUSES } from "./orders";

describe("ORDER_STATUSES", () => {
  it("contém os quatro status esperados, na ordem do fluxo", () => {
    expect(ORDER_STATUSES).toEqual(["pendente", "confirmado", "entregue", "cancelado"]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

```bash
pnpm --filter admin exec vitest run lib/orders.test.ts
```

Esperado: FAIL — `Cannot find module './orders'`.

- [ ] **Step 3: Implementar `apps/admin/lib/orders.ts`**

```ts
export const ORDER_STATUSES = ["pendente", "confirmado", "entregue", "cancelado"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderItemRow = {
  product_id: string;
  product_name_snapshot: string;
  qty: number;
};

export type OrderRow = {
  id: string;
  channel: string;
  status: OrderStatus;
  created_at: string;
  buyers: { nome: string; empresa: string; whatsapp: string } | null;
  order_items: OrderItemRow[];
};
```

- [ ] **Step 4: Rodar o teste e confirmar sucesso**

```bash
pnpm --filter admin exec vitest run lib/orders.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Criar a action de atualização de status**

`apps/admin/app/(dashboard)/pedidos/actions.ts` (mesmo padrão de `clientes/actions.ts`):

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/orders";

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
});

export async function updateOrderStatus(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = UpdateStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) return;

  const { error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("[admin/pedidos] erro ao atualizar status:", error.message);
    return;
  }

  revalidatePath("/pedidos");
}
```

- [ ] **Step 6: Criar a página**

`apps/admin/app/(dashboard)/pedidos/page.tsx` (reaproveita `StatusSelect` de `clientes/status-select.tsx`, generalizando o tipo genérico já usado lá — se `StatusSelect` estiver fortemente tipado para `LeadStatus`, duplicar como `order-status-select.tsx` em vez de generalizar, para não arriscar quebrar `clientes`):

```tsx
import { requireAdminSession } from "@/lib/auth";
import { ORDER_STATUSES, type OrderRow } from "@/lib/orders";
import { updateOrderStatus } from "./actions";
import { OrderStatusSelect } from "./order-status-select";

const CHANNEL_LABEL: Record<string, string> = {
  mypetbrasil: "My Pet Brasil",
  distribuidora: "Distribuidora",
};

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { channel, status } = await searchParams;

  let query = supabase
    .from("orders")
    .select("id, channel, status, created_at, buyers(nome, empresa, whatsapp), order_items(product_id, product_name_snapshot, qty)")
    .order("created_at", { ascending: false });

  if (channel) query = query.eq("channel", channel);
  if (status) query = query.eq("status", status);

  const { data } = await query;
  const orders = (data ?? []) as unknown as OrderRow[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Pedidos</h1>
      </div>

      <form method="get" className="mb-4 flex gap-3">
        <select name="channel" defaultValue={channel ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os canais</option>
          <option value="mypetbrasil">My Pet Brasil</option>
          <option value="distribuidora">Distribuidora</option>
        </select>
        <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Comprador</th>
              <th className="px-4 py-3">Canal</th>
              <th className="px-4 py-3">Itens</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-3">{new Date(order.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3">
                  {order.buyers?.nome} — {order.buyers?.empresa}
                  <div className="text-xs text-slate-400">{order.buyers?.whatsapp}</div>
                </td>
                <td className="px-4 py-3">{CHANNEL_LABEL[order.channel] ?? order.channel}</td>
                <td className="px-4 py-3">
                  <ul className="text-xs text-slate-600">
                    {order.order_items.map((item) => (
                      <li key={item.product_id}>{item.product_name_snapshot} — Qtd: {item.qty}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-3">
                  <OrderStatusSelect orderId={order.id} currentStatus={order.status} action={updateOrderStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Criar `OrderStatusSelect`**

`apps/admin/app/(dashboard)/pedidos/order-status-select.tsx` (mesmo padrão de `clientes/status-select.tsx`, tipado para `OrderStatus`):

```tsx
"use client";

import type { OrderStatus } from "@/lib/orders";
import { ORDER_STATUSES } from "@/lib/orders";

export function OrderStatusSelect({
  orderId,
  currentStatus,
  action,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={orderId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </form>
  );
}
```

- [ ] **Step 8: Adicionar o link no menu do admin**

Modify: `apps/admin/app/(dashboard)/layout.tsx:5-9`. Trocar:

```ts
const NAV = [
  { href: "/clientes", label: "Clientes" },
  { href: "/categorias", label: "Categorias" },
  { href: "/funcionalidades", label: "Funcionalidades" },
];
```

por:

```ts
const NAV = [
  { href: "/clientes", label: "Clientes" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/categorias", label: "Categorias" },
  { href: "/funcionalidades", label: "Funcionalidades" },
];
```

- [ ] **Step 9: Verificação manual via `/run`**

Rodar `pnpm dev:admin`, logar, acessar `/pedidos`, confirmar que pedidos criados na Task 8 aparecem com itens corretos; mudar o status de um pedido e confirmar que persiste após reload.

- [ ] **Step 10: Commit**

```bash
git add apps/admin/lib/orders.ts apps/admin/lib/orders.test.ts "apps/admin/app/(dashboard)/pedidos" "apps/admin/app/(dashboard)/layout.tsx"
git commit -m "feat(admin): adiciona secao Pedidos com filtro e atualizacao de status"
```

---

## Task 11: Validação final

**Files:** nenhum arquivo novo — apenas validação de todo o trabalho das Tasks 1-10.

- [ ] **Step 1: Rodar a suíte completa de testes**

```bash
pnpm --filter @mypet/core test
pnpm --filter admin test
```

Esperado: todos os testes passam, incluindo os novos (`buyers-server`, `orders-server`, `auth-server`, `orders`).

- [ ] **Step 2: Rodar lint e build de todo o monorepo**

```bash
pnpm lint
pnpm build
```

Esperado: sem erros. Prestar atenção especial a erros de tipo em `apps/mypet/app/cotacao/cotacao-content.tsx` e `apps/distribuidora/app/cotacao/cotacao-content.tsx` (a mudança de assinatura ao remover o formulário local é o ponto mais arriscado desta migração).

- [ ] **Step 3: Roteiro de verificação manual ponta a ponta (via `/run`, `mypet` e `distribuidora`)**

1. Sem sessão: montar carrinho → `/cotacao` → "Finalizar cotação" → redireciona para `/entrar?next=%2Fcotacao`.
2. `/entrar`: informar e-mail → tela "Verifique seu e-mail".
3. Abrir o e-mail (SMTP configurado na Task 1) → clicar no link → primeiro acesso → `/completar-cadastro` → preencher e enviar → redireciona para `/cotacao` com carrinho intacto.
4. `/cotacao` → "Finalizar cotação" → WhatsApp abre com a mensagem correta → carrinho esvazia → tela de sucesso com link para `/pedidos`.
5. `/pedidos` → pedido aparece com status "Pendente" e os itens corretos.
6. No admin (`/pedidos`) → mesmo pedido aparece, com dados do comprador; mudar status para "Confirmado" → reload em `/pedidos` (loja) reflete "Confirmado".
7. Repetir o passo 1-6 em segunda visita (mesmo navegador, mesmo e-mail) e confirmar que não pede `/completar-cadastro` de novo (buyer já existe) — só passa por `/entrar`.

- [ ] **Step 4: Commit final (se houver ajustes de lint/build)**

```bash
git add -A
git commit -m "chore: ajustes finais de lint/build para identidade e pedidos"
```

## Self-Review

**Cobertura do spec:** magic link via Supabase Auth (Tasks 2, 5, 6), tabela `buyers`/`orders`/`order_items` com RLS (Task 1), checkout gravando pedido antes do WhatsApp (Task 8), histórico de compras (Task 9), admin com filtro/status (Task 10), erros e casos-limite da spec cobertos nas actions (`finalizeQuote`, `completeSignup`, `createAuthCallbackHandler`) e no roteiro manual da Task 11. Fora de escopo do spec (pagamento, WhatsApp Business API, azpetshop, reviews) não aparece em nenhuma task — confirmado.

**Consistência de tipos:** `CartItem` (Task 4, 8) usa os mesmos campos de `packages/core/src/cart.ts` (`id, name, sku, brand, img, qty`); `Buyer`/`CreateBuyerInput` (Task 3) usados identicamente em `buyers-server.test.ts`, `auth-server.ts` (via `buyer` do `maybeSingle`) e `cotacao/actions.ts`; `OrderWithItems`/`OrderRow` mantêm `productId`/`product_id` conforme a camada (core usa camelCase mapeado, admin lê o formato bruto do Supabase diretamente — intencional, mesma diferença que já existe entre `catalog.ts` e as queries cruas do admin).
