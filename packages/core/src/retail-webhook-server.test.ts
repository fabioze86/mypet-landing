import { describe, expect, it, vi, beforeEach } from "vitest";
import { fakeSupabase } from "./test-utils/fake-supabase";
import { handleAsaasWebhook } from "./retail-webhook-server";

const asaas = { baseUrl: "https://asaas.test", apiKey: "k", webhookToken: "w" };
const paid = { id: "evt_1", event: "CHECKOUT_PAID", checkout: { id: "chk_1" } };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function setup(results: Parameters<typeof fakeSupabase>[0]) {
  const { client, calls } = fakeSupabase(results);
  const onPaid = vi.fn(async () => {});
  return { deps: { supabase: client, asaas, onPaid }, calls, onPaid };
}

describe("handleAsaasWebhook", () => {
  it("recusa token inválido", async () => {
    const { deps, calls } = setup({});
    expect(await handleAsaasWebhook(deps, { token: "x", body: paid })).toEqual({ status: 401, body: "token inválido" });
    expect(calls).toHaveLength(0);
  });

  it("ignora eventos que não são de checkout", async () => {
    const { deps } = setup({});
    expect((await handleAsaasWebhook(deps, { token: "w", body: { id: "e", event: "PAYMENT_RECEIVED" } })).status).toBe(200);
  });

  it("evento repetido não processa de novo", async () => {
    const { deps, onPaid } = setup({ payment_webhook_events: [{ error: { message: "dup", code: "23505" } }] });
    expect(await handleAsaasWebhook(deps, { token: "w", body: paid })).toEqual({ status: 200, body: "duplicado" });
    expect(onPaid).not.toHaveBeenCalled();
  });

  it("pagamento confirmado: marca pago, baixa estoque e avisa", async () => {
    const { deps, calls, onPaid } = setup({
      payment_webhook_events: [{}],
      order_payments: [{ data: { order_id: "o1", orders: { id: "o1", status: "aguardando_pagamento" } } }, {}],
      orders: [{}],
    });
    expect(await handleAsaasWebhook(deps, { token: "w", body: paid })).toEqual({ status: 200, body: "ok" });
    expect(calls.find((c) => c.table === "orders" && c.method === "update")?.args[0]).toMatchObject({ status: "pago" });
    expect(calls.find((c) => c.table === "order_payments" && c.method === "update")?.args[0]).toMatchObject({ status: "PAID", last_event_id: "evt_1" });
    expect(calls.find((c) => c.table === "rpc:decrement_order_stock")?.args[0]).toEqual({ p_order_id: "o1" });
    expect(onPaid).toHaveBeenCalledWith("o1");
  });

  it("expiração de pedido já pago não rebaixa nem avisa", async () => {
    const { deps, calls, onPaid } = setup({
      payment_webhook_events: [{}],
      order_payments: [{ data: { order_id: "o1", orders: { id: "o1", status: "pago" } } }, {}],
    });
    const r = await handleAsaasWebhook(deps, { token: "w", body: { ...paid, id: "evt_2", event: "CHECKOUT_EXPIRED" } });
    expect(r.status).toBe(200);
    expect(calls.some((c) => c.table === "orders" && c.method === "update")).toBe(false);
    expect(onPaid).not.toHaveBeenCalled();
  });

  it("falha ao atualizar o pedido libera o evento para reenvio", async () => {
    const { deps, calls } = setup({
      payment_webhook_events: [{}, {}],
      order_payments: [{ data: { order_id: "o1", orders: { id: "o1", status: "aguardando_pagamento" } } }],
      orders: [{ error: { message: "x" } }],
    });
    expect((await handleAsaasWebhook(deps, { token: "w", body: paid })).status).toBe(500);
    expect(calls.some((c) => c.table === "payment_webhook_events" && c.method === "delete")).toBe(true);
  });

  it("falha do aviso não derruba o webhook", async () => {
    const { deps, onPaid } = setup({
      payment_webhook_events: [{}],
      order_payments: [{ data: { order_id: "o1", orders: { id: "o1", status: "aguardando_pagamento" } } }, {}],
      orders: [{}],
    });
    onPaid.mockRejectedValueOnce(new Error("smtp"));
    expect((await handleAsaasWebhook(deps, { token: "w", body: paid })).status).toBe(200);
  });
});
