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

  const linked = (status: string) => ({ data: { order_id: "o1", orders: { id: "o1", status } } });

  it("pagamento confirmado: transição atômica por rpc e aviso", async () => {
    const { deps, calls, onPaid } = setup({
      payment_webhook_events: [{}],
      order_payments: [linked("aguardando_pagamento"), {}],
      "rpc:mark_order_paid": [{ data: true }],
    });
    expect(await handleAsaasWebhook(deps, { token: "w", body: paid })).toEqual({ status: 200, body: "ok" });
    expect(calls.find((c) => c.table === "rpc:mark_order_paid")?.args[0]).toEqual({ p_order_id: "o1" });
    expect(calls.some((c) => c.table === "orders" && c.method === "update")).toBe(false);
    expect(calls.some((c) => c.table === "rpc:decrement_order_stock")).toBe(false);
    expect(calls.find((c) => c.table === "order_payments" && c.method === "update")?.args[0]).toMatchObject({ status: "PAID", last_event_id: "evt_1" });
    expect(onPaid).toHaveBeenCalledWith("o1");
  });

  it("exceção após gravar o evento libera o evento e devolve 500", async () => {
    const { client, calls } = fakeSupabase({
      payment_webhook_events: [{}, {}],
      order_payments: [linked("aguardando_pagamento")],
    });
    (client as unknown as { rpc: () => never }).rpc = () => {
      throw new Error("boom");
    };
    const onPaid = vi.fn(async () => {});
    const r = await handleAsaasWebhook({ supabase: client, asaas, onPaid }, { token: "w", body: paid });
    expect(r).toEqual({ status: 500, body: "erro" });
    expect(calls.some((c) => c.table === "payment_webhook_events" && c.method === "delete")).toBe(true);
    expect(onPaid).not.toHaveBeenCalled();
  });

  it("rpc devolve false (já pago): não avisa de novo", async () => {
    const { deps, onPaid } = setup({
      payment_webhook_events: [{}],
      order_payments: [linked("pago"), {}],
      "rpc:mark_order_paid": [{ data: false }],
    });
    expect((await handleAsaasWebhook(deps, { token: "w", body: paid })).status).toBe(200);
    expect(onPaid).not.toHaveBeenCalled();
  });

  it("erro na rpc libera o evento e responde 500", async () => {
    const { deps, calls, onPaid } = setup({
      payment_webhook_events: [{}, {}],
      order_payments: [linked("aguardando_pagamento")],
      "rpc:mark_order_paid": [{ error: { message: "x" } }],
    });
    expect((await handleAsaasWebhook(deps, { token: "w", body: paid })).status).toBe(500);
    expect(calls.some((c) => c.table === "payment_webhook_events" && c.method === "delete")).toBe(true);
    expect(onPaid).not.toHaveBeenCalled();
  });

  it("erro na consulta do pagamento libera o evento e responde 500", async () => {
    const { deps, calls } = setup({
      payment_webhook_events: [{}, {}],
      order_payments: [{ error: { message: "db" } }],
    });
    expect((await handleAsaasWebhook(deps, { token: "w", body: paid })).status).toBe(500);
    expect(calls.some((c) => c.table === "payment_webhook_events" && c.method === "delete")).toBe(true);
  });

  it("PAID sem pedido correspondente libera o evento e responde 500 (Asaas reenvia)", async () => {
    const { deps, calls } = setup({
      payment_webhook_events: [{}, {}],
      order_payments: [{ data: null }],
    });
    expect((await handleAsaasWebhook(deps, { token: "w", body: paid })).status).toBe(500);
    expect(calls.some((c) => c.table === "payment_webhook_events" && c.method === "delete")).toBe(true);
  });

  it("EXPIRED sem pedido correspondente responde 200", async () => {
    const { deps } = setup({ payment_webhook_events: [{}], order_payments: [{ data: null }] });
    const r = await handleAsaasWebhook(deps, { token: "w", body: { ...paid, id: "evt_3", event: "CHECKOUT_EXPIRED" } });
    expect(r).toEqual({ status: 200, body: "pedido não encontrado" });
  });

  it("cancelamento só atualiza se o pedido ainda aguarda pagamento", async () => {
    const { deps, calls, onPaid } = setup({
      payment_webhook_events: [{}],
      order_payments: [linked("aguardando_pagamento"), {}],
      orders: [{}],
    });
    const r = await handleAsaasWebhook(deps, { token: "w", body: { ...paid, id: "evt_4", event: "CHECKOUT_CANCELED" } });
    expect(r.status).toBe(200);
    expect(calls.find((c) => c.table === "orders" && c.method === "update")?.args[0]).toMatchObject({ status: "cancelado" });
    const eqs = calls.filter((c) => c.table === "orders" && c.method === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["id", "o1"]);
    expect(eqs).toContainEqual(["status", "aguardando_pagamento"]);
    expect(onPaid).not.toHaveBeenCalled();
  });

  it("expiração de pedido já pago não rebaixa nem avisa", async () => {
    const { deps, calls, onPaid } = setup({
      payment_webhook_events: [{}],
      order_payments: [linked("pago"), {}],
    });
    const r = await handleAsaasWebhook(deps, { token: "w", body: { ...paid, id: "evt_2", event: "CHECKOUT_EXPIRED" } });
    expect(r.status).toBe(200);
    expect(calls.some((c) => c.table === "orders" && c.method === "update")).toBe(false);
    expect(onPaid).not.toHaveBeenCalled();
  });

  it("falha ao atualizar o pedido (cancelamento) libera o evento para reenvio", async () => {
    const { deps, calls } = setup({
      payment_webhook_events: [{}, {}],
      order_payments: [linked("aguardando_pagamento")],
      orders: [{ error: { message: "x" } }],
    });
    const r = await handleAsaasWebhook(deps, { token: "w", body: { ...paid, id: "evt_5", event: "CHECKOUT_CANCELED" } });
    expect(r.status).toBe(500);
    expect(calls.some((c) => c.table === "payment_webhook_events" && c.method === "delete")).toBe(true);
  });

  it("falha ao liberar o evento é registrada no log", async () => {
    const { deps } = setup({
      payment_webhook_events: [{}, { error: { message: "del" } }],
      order_payments: [linked("aguardando_pagamento")],
      "rpc:mark_order_paid": [{ error: { message: "x" } }],
    });
    await handleAsaasWebhook(deps, { token: "w", body: paid });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("evt_1"), expect.anything());
  });

  it("falha do aviso não derruba o webhook", async () => {
    const { deps, onPaid } = setup({
      payment_webhook_events: [{}],
      order_payments: [linked("aguardando_pagamento"), {}],
      "rpc:mark_order_paid": [{ data: true }],
    });
    onPaid.mockRejectedValueOnce(new Error("smtp"));
    expect((await handleAsaasWebhook(deps, { token: "w", body: paid })).status).toBe(200);
  });
});
