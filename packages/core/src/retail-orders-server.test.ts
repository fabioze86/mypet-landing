import { describe, expect, it } from "vitest";
import { fakeSupabase } from "./test-utils/fake-supabase";
import { getRetailOrder, getRetailOrderById } from "./retail-orders-server";

const ID = "33333333-3333-4333-8333-333333333333";
const row = {
  id: ID, number: 1042, status: "pago", created_at: "2026-11-01T12:00:00Z", access_token: "tok",
  customer_name: "Maria", customer_email: "m@x.com", customer_whatsapp: "5511988887777",
  subtotal: "50.00", shipping_price: "20.00", total: "70.00",
  order_items: [{ product_name_snapshot: "Shampoo", qty: 2, unit_price: "25.00" }],
  order_shipping: { cep: "20040002", logradouro: "Rua A", numero: "10", complemento: null, bairro: "Centro", cidade: "Rio", uf: "RJ", service_name: "Correios PAC", delivery_days: 7, tracking_code: null },
  order_payments: { checkout_url: "https://asaas.test/c/1" },
};

describe("getRetailOrder", () => {
  it("converte números e monta a visão do pedido quando o token bate", async () => {
    const { client } = fakeSupabase({ orders: [{ data: row }] });
    const order = await getRetailOrder(client, ID, "tok");
    expect(order).toMatchObject({ id: ID, number: 1042, total: 70, shippingPrice: 20, items: [{ name: "Shampoo", qty: 2, unitPrice: 25 }], paymentUrl: "https://asaas.test/c/1" });
    expect(order?.shipping?.serviceName).toBe("Correios PAC");
  });

  it("token errado ou vazio devolve null", async () => {
    const { client } = fakeSupabase({ orders: [{ data: row }, { data: row }] });
    expect(await getRetailOrder(client, ID, "outro")).toBeNull();
    expect(await getRetailOrder(client, ID, "")).toBeNull();
  });

  it("a visão pública nunca expõe o accessToken", async () => {
    const { client } = fakeSupabase({ orders: [{ data: row }] });
    expect(await getRetailOrder(client, ID, "tok")).not.toHaveProperty("accessToken");
  });

  it("a leitura interna devolve o accessToken", async () => {
    const { client } = fakeSupabase({ orders: [{ data: row }] });
    expect(await getRetailOrderById(client, ID)).toMatchObject({ id: ID, accessToken: "tok" });
  });

  it("id que não é uuid nem consulta", async () => {
    const { client, calls } = fakeSupabase({});
    expect(await getRetailOrder(client, "abc", "tok")).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
