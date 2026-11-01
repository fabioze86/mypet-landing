import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@mypet/core/test-utils/fake-supabase";

const mocks = vi.hoisted(() => ({
  supabase: null as unknown,
  sendListmonkTx: vi.fn(async () => true),
}));

vi.mock("@/lib/auth", () => ({
  requireAdminSession: async () => ({ supabase: mocks.supabase }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@mypet/core/listmonk", () => ({ sendListmonkTx: mocks.sendListmonkTx }));

import { markOrderShipped } from "./actions";

const ORDER_ID = "00000000-0000-4000-8000-000000000001";
const TRACKING = "BR123456789";

function shipForm() {
  const fd = new FormData();
  fd.set("orderId", ORDER_ID);
  fd.set("trackingCode", TRACKING);
  return fd;
}

// Linha devolvida pelo maybeSingle() de notifyOrderShipped.
const notifyRow = {
  data: {
    number: 7,
    customer_name: "Ana",
    customer_email: "ana@example.com",
    access_token: "tok",
    order_shipping: { service_name: "Correios" },
  },
  error: null,
};

describe("markOrderShipped", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.sendListmonkTx.mockClear();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.LISTMONK_URL = "https://lm.test";
    process.env.LISTMONK_API_USER = "api";
    process.env.LISTMONK_API_TOKEN = "tok";
    process.env.LISTMONK_TEMPLATE_PEDIDO_ENVIADO = "5";
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("pedido que não está pago: não grava rastreio e não envia e-mail", async () => {
    const { client, calls } = fakeSupabase({ orders: [{ data: [] }] });
    mocks.supabase = client;

    await markOrderShipped(shipForm());

    expect(calls.some((c) => c.table === "order_shipping")).toBe(false);
    expect(mocks.sendListmonkTx).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("pedido não está pago"));
  });

  it("pedido pago: marca enviado condicionado a status pago, grava rastreio antes de notificar e envia e-mail uma vez", async () => {
    const { client, calls } = fakeSupabase({
      orders: [{ data: [{ id: ORDER_ID }] }, notifyRow],
      order_shipping: [{ data: null, error: null }],
    });
    mocks.supabase = client;

    await markOrderShipped(shipForm());

    const statusGuard = calls.findIndex((c) => c.table === "orders" && c.method === "eq" && c.args[0] === "status" && c.args[1] === "pago");
    const shippingUpdate = calls.findIndex((c) => c.table === "order_shipping" && c.method === "update");
    expect(statusGuard).toBeGreaterThanOrEqual(0);
    expect(shippingUpdate).toBeGreaterThan(statusGuard);
    expect(calls[shippingUpdate].args[0]).toMatchObject({ tracking_code: TRACKING });
    expect(mocks.sendListmonkTx).toHaveBeenCalledTimes(1);
  });
});
