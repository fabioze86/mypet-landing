import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fakeSupabase } from "./test-utils/fake-supabase";
import { priceCart, quoteCheckout, startCheckout, type CheckoutDeps } from "./retail-checkout-server";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

const productRow = (id: string, name: string, price: number | null, stock: number | null) => ({
  id,
  name,
  stock_qty: stock,
  product_channel_prices: price === null ? [] : [{ channel: "azpetshop", sale_price: price, sale_updated_at: "2026-10-01" }],
});

function shippingFetch() {
  return vi.fn(async () =>
    new Response(JSON.stringify([{ id: 1, name: "PAC", custom_price: "20.00", custom_delivery_time: 7, company: { name: "Correios" } }]), { status: 200 }),
  ) as unknown as typeof fetch;
}

function deps(supabase: CheckoutDeps["supabase"], fetchFn: typeof fetch): CheckoutDeps {
  return {
    supabase,
    channel: "azpetshop",
    melhorEnvio: { baseUrl: "https://me.test", token: "t", userAgent: "ua", fromCep: "01001000" },
    asaas: { baseUrl: "https://asaas.test", apiKey: "k", webhookToken: "w" },
    installments: { max: 6, minInstallment: 30 },
    siteUrl: "https://www.azpetshop.com.br",
    fetchFn,
    newToken: () => "tok123",
  };
}

const input = {
  items: [{ id: ID_A, qty: 2 }],
  customer: { nome: "Maria Souza", cpf: "52998224725", email: "maria@exemplo.com", whatsapp: "5511988887777" },
  address: { cep: "20040002", logradouro: "Rua A", numero: "10", complemento: "", bairro: "Centro", cidade: "Rio de Janeiro", uf: "RJ" },
  shippingServiceId: 1,
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("priceCart", () => {
  it("usa o preço do servidor e soma o subtotal", async () => {
    const { client } = fakeSupabase({ products: [{ data: [productRow(ID_A, "Shampoo", 25, 5), productRow(ID_B, "Coleira", 10.5, 3)] }] });
    const r = await priceCart(client, "azpetshop", [{ id: ID_A, qty: 2 }, { id: ID_B, qty: 1 }]);
    expect(r).toEqual({
      ok: true,
      lines: [
        { id: ID_A, name: "Shampoo", qty: 2, unitPrice: 25 },
        { id: ID_B, name: "Coleira", qty: 1, unitPrice: 10.5 },
      ],
      subtotal: 60.5,
    });
  });

  it("bloqueia produto ausente, sem preço vendável ou sem estoque", async () => {
    for (const row of [productRow(ID_A, "X", null, 5), productRow(ID_A, "X", 0, 5), productRow(ID_A, "X", 25, 0), productRow(ID_A, "X", 25, null)]) {
      const { client } = fakeSupabase({ products: [{ data: [row] }] });
      const r = await priceCart(client, "azpetshop", [{ id: ID_A, qty: 1 }]);
      expect(r.ok).toBe(false);
    }
    const { client } = fakeSupabase({ products: [{ data: [] }] });
    expect((await priceCart(client, "azpetshop", [{ id: ID_A, qty: 1 }])).ok).toBe(false);
  });

  it("bloqueia quantidade acima do estoque", async () => {
    const { client } = fakeSupabase({ products: [{ data: [productRow(ID_A, "Shampoo", 25, 1)] }] });
    const r = await priceCart(client, "azpetshop", [{ id: ID_A, qty: 2 }]);
    expect(r).toEqual({ ok: false, error: "Só temos 1 unidade(s) de Shampoo em estoque." });
  });
});

describe("quoteCheckout", () => {
  it("devolve subtotal e opções de frete", async () => {
    const { client } = fakeSupabase({ products: [{ data: [productRow(ID_A, "Shampoo", 25, 5)] }] });
    const r = await quoteCheckout(deps(client, shippingFetch()), { items: [{ id: ID_A, qty: 2 }], cep: "20040002" });
    expect(r).toEqual({ ok: true, subtotal: 50, options: [{ serviceId: 1, name: "PAC", company: "Correios", price: 20, deliveryDays: 7 }] });
  });
});

describe("startCheckout", () => {
  it("grava pedido, itens, entrega e pagamento e devolve o link do Asaas", async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes("/v3/checkouts")
        ? new Response(JSON.stringify({ id: "chk_1", link: "https://asaas.test/c/chk_1" }), { status: 200 })
        : new Response(JSON.stringify([{ id: 1, name: "PAC", custom_price: "20.00", custom_delivery_time: 7, company: { name: "Correios" } }]), { status: 200 }),
    ) as unknown as typeof fetch;
    const { client, calls } = fakeSupabase({
      products: [{ data: [productRow(ID_A, "Shampoo", 25, 5)] }],
      orders: [{ data: { id: "o1", number: 1042 } }],
      order_items: [{}],
      order_shipping: [{}],
      order_payments: [{}],
    });

    const r = await startCheckout(deps(client, fetchFn), input);
    expect(r).toEqual({ ok: true, orderId: "o1", paymentUrl: "https://asaas.test/c/chk_1" });

    const orderInsert = calls.find((c) => c.table === "orders" && c.method === "insert")?.args[0];
    expect(orderInsert).toMatchObject({
      channel: "azpetshop",
      status: "aguardando_pagamento",
      customer_name: "Maria Souza",
      customer_cpf: "52998224725",
      customer_email: "maria@exemplo.com",
      customer_whatsapp: "5511988887777",
      subtotal: 50,
      shipping_price: 20,
      total: 70,
      access_token: "tok123",
    });
    expect(calls.find((c) => c.table === "order_items" && c.method === "insert")?.args[0]).toEqual([
      { order_id: "o1", product_id: ID_A, product_name_snapshot: "Shampoo", qty: 2, unit_price: 25 },
    ]);
    expect(calls.find((c) => c.table === "order_shipping" && c.method === "insert")?.args[0]).toMatchObject({
      order_id: "o1", cep: "20040002", service_id: 1, service_name: "Correios PAC", price: 20, delivery_days: 7,
    });
    expect(calls.find((c) => c.table === "order_payments" && c.method === "insert")?.args[0]).toMatchObject({
      order_id: "o1", asaas_checkout_id: "chk_1", checkout_url: "https://asaas.test/c/chk_1", amount: 70,
    });

    const asaasBody = JSON.parse((fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.find(([u]) => u.includes("/v3/checkouts"))![1].body as string);
    expect(asaasBody.callback.successUrl).toBe("https://www.azpetshop.com.br/pedido/o1?t=tok123");
    expect(asaasBody.items[0].value).toBe(70);
    expect(asaasBody.installment).toEqual({ maxInstallmentCount: 2 });
  });

  it("frete escolhido que não existe mais na recotação bloqueia", async () => {
    const { client, calls } = fakeSupabase({ products: [{ data: [productRow(ID_A, "Shampoo", 25, 5)] }] });
    const r = await startCheckout(deps(client, shippingFetch()), { ...input, shippingServiceId: 99 });
    expect(r).toEqual({ ok: false, error: "A opção de frete escolhida não está mais disponível. Escolha de novo." });
    expect(calls.some((c) => c.table === "orders")).toBe(false);
  });

  it("falha do Asaas deixa o pedido aguardando e devolve erro", async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes("/v3/checkouts")
        ? new Response("{}", { status: 500 })
        : new Response(JSON.stringify([{ id: 1, name: "PAC", custom_price: "20.00", company: { name: "Correios" } }]), { status: 200 }),
    ) as unknown as typeof fetch;
    const { client, calls } = fakeSupabase({
      products: [{ data: [productRow(ID_A, "Shampoo", 25, 5)] }],
      orders: [{ data: { id: "o1", number: 1042 } }],
      order_items: [{}],
      order_shipping: [{}],
    });
    const r = await startCheckout(deps(client, fetchFn), input);
    expect(r).toEqual({ ok: false, error: "Não foi possível iniciar o pagamento. Tente novamente." });
    expect(calls.some((c) => c.table === "order_payments")).toBe(false);
  });

  it("falha ao gravar os itens apaga o pedido", async () => {
    const { client, calls } = fakeSupabase({
      products: [{ data: [productRow(ID_A, "Shampoo", 25, 5)] }],
      orders: [{ data: { id: "o1", number: 1042 } }, {}],
      order_items: [{ error: { message: "x" } }],
    });
    const r = await startCheckout(deps(client, shippingFetch()), input);
    expect(r.ok).toBe(false);
    expect(calls.some((c) => c.table === "orders" && c.method === "delete")).toBe(true);
  });
});
