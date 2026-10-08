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

  it("responde 400 quando nome é longo demais", async () => {
    const res = await POST(fakeRequest({ items: [{ id: P1, qty: 1 }], customer: { ...customer, nome: "a".repeat(121) } }));
    expect(res.status).toBe(400);
    expect(state.orderInsert).not.toHaveBeenCalled();
  });

  it("responde 400 quando a soma de linhas repetidas passa do limite", async () => {
    const res = await POST(fakeRequest({ items: [{ id: P1, qty: 9999 }, { id: P1, qty: 9999 }], customer }));
    expect(res.status).toBe(400);
    expect(state.orderInsert).not.toHaveBeenCalled();
  });

  it("responde 400 quando o corpo não é JSON", async () => {
    const req = { json: async () => { throw new Error("bad"); } } as unknown as NextRequest;
    expect((await POST(req)).status).toBe(400);
  });

  it("responde 400 quando há mais de 200 linhas", async () => {
    const items = Array.from({ length: 201 }, (_, i) => ({
      id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
      qty: 1,
    }));
    const res = await POST(fakeRequest({ items, customer }));
    expect(res.status).toBe(400);
  });
});

describe("createOrdersPostHandler — itens indisponíveis", () => {
  it("grava só as linhas disponíveis e devolve as indisponíveis", async () => {
    state.products = [state.products[0]];
    const res = await POST(fakeRequest({ items: [{ id: P1, qty: 2 }, { id: P2, qty: 1 }], customer }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      number: 1042,
      items: [{ id: P1, unitPrice: 9.9 }],
      total: 19.8,
      unavailableIds: [P2],
    });
    expect(state.itemsInsert).toHaveBeenCalledWith([
      { order_id: "o1", product_id: P1, product_name_snapshot: "Coleira P", qty: 2, unit_price: 9.9 },
    ]);
  });

  it("responde 409 sem gravar quando nenhum produto está disponível", async () => {
    state.products = [];
    const res = await POST(fakeRequest({ items: [{ id: P1, qty: 1 }, { id: P2, qty: 1 }], customer }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Nenhum produto do carrinho está disponível no momento.",
      unavailableIds: [P1, P2],
    });
    expect(state.orderInsert).not.toHaveBeenCalled();
    expect(state.itemsInsert).not.toHaveBeenCalled();
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
      unavailableIds: [],
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

  it("grava o cnpj preenchido", async () => {
    await POST(fakeRequest({ items: [{ id: P1, qty: 1 }], customer: { ...customer, cnpj: "12.345.678/0001-90" } }));
    expect(state.orderInsert).toHaveBeenCalledWith(expect.objectContaining({ customer_cnpj: "12.345.678/0001-90" }));
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
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    state.itemsError = { message: "falhou" };
    const res = await POST(fakeRequest({ items: [{ id: P1, qty: 1 }], customer }));
    expect(res.status).toBe(500);
    expect(state.orderDelete).toHaveBeenCalledWith("id", "o1");
    spy.mockRestore();
  });
});
