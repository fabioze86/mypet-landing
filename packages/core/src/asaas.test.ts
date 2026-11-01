import { describe, expect, it, vi } from "vitest";
import { createAsaasCheckout, isValidWebhookToken, parseAsaasCheckoutEvent } from "./asaas";

const cfg = { baseUrl: "https://api-sandbox.asaas.com", apiKey: "key", webhookToken: "segredo-do-webhook" };
const input = {
  orderNumber: 1042,
  total: 129.9,
  maxInstallments: 4,
  customer: { nome: "Maria Souza", cpf: "52998224725", email: "maria@exemplo.com", whatsapp: "5511988887777" },
  successUrl: "https://www.azpetshop.com.br/pedido/o1?t=tok",
  cancelUrl: "https://www.azpetshop.com.br/checkout",
  expiredUrl: "https://www.azpetshop.com.br/pedido/o1?t=tok",
  minutesToExpire: 60,
};

describe("createAsaasCheckout", () => {
  it("envia Pix e cartão, item único com o total, parcelamento e dados do cliente", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ id: "chk_1", link: "https://asaas.com/c/chk_1", status: "ACTIVE" }), { status: 200 })) as unknown as typeof fetch;
    const r = await createAsaasCheckout(cfg, input, fetchFn);
    expect(r).toEqual({ ok: true, checkoutId: "chk_1", link: "https://asaas.com/c/chk_1" });

    const [url, init] = (fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/checkouts");
    expect((init.headers as Record<string, string>).access_token).toBe("key");
    const body = JSON.parse(init.body as string);
    expect(body.billingTypes).toEqual(["PIX", "CREDIT_CARD"]);
    expect(body.chargeTypes).toEqual(["DETACHED", "INSTALLMENT"]);
    expect(body.installment).toEqual({ maxInstallmentCount: 4 });
    expect(body.minutesToExpire).toBe(60);
    expect(body.externalReference).toBe("1042");
    expect(body.callback).toEqual({ successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.expiredUrl });
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ name: "Pedido 1042", quantity: 1, value: 129.9 });
    expect(body.items[0].name.length).toBeLessThanOrEqual(30);
    expect(typeof body.items[0].imageBase64).toBe("string");
    expect(body.customerData).toEqual({ name: "Maria Souza", cpfCnpj: "52998224725", email: "maria@exemplo.com", phone: "11988887777" });
  });

  it("sem parcelamento (1x) manda só DETACHED", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ id: "c", link: "l" }), { status: 200 })) as unknown as typeof fetch;
    await createAsaasCheckout(cfg, { ...input, maxInstallments: 1 }, fetchFn);
    const body = JSON.parse((fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1].body as string);
    expect(body.chargeTypes).toEqual(["DETACHED"]);
    expect(body.installment).toBeUndefined();
  });

  it("erro HTTP ou resposta sem link vira erro amigável", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = vi.fn(async () => new Response("{}", { status: 400 })) as unknown as typeof fetch;
    expect(await createAsaasCheckout(cfg, input, bad)).toEqual({ ok: false, error: "Não foi possível iniciar o pagamento. Tente novamente." });
    const noLink = vi.fn(async () => new Response(JSON.stringify({ id: "c" }), { status: 200 })) as unknown as typeof fetch;
    expect((await createAsaasCheckout(cfg, input, noLink)).ok).toBe(false);
    vi.restoreAllMocks();
  });
});

describe("isValidWebhookToken", () => {
  it("aceita só o token configurado", () => {
    expect(isValidWebhookToken(cfg, "segredo-do-webhook")).toBe(true);
    expect(isValidWebhookToken(cfg, "outro")).toBe(false);
    expect(isValidWebhookToken(cfg, null)).toBe(false);
    expect(isValidWebhookToken({ ...cfg, webhookToken: "" }, "")).toBe(false);
  });
});

describe("parseAsaasCheckoutEvent", () => {
  it("extrai id, evento e checkout", () => {
    expect(parseAsaasCheckoutEvent({ id: "evt_1", event: "CHECKOUT_PAID", checkout: { id: "chk_1" } })).toEqual({
      id: "evt_1",
      event: "CHECKOUT_PAID",
      checkoutId: "chk_1",
    });
  });
  it("devolve null para payload sem checkout", () => {
    expect(parseAsaasCheckoutEvent({ id: "evt_1", event: "PAYMENT_RECEIVED", payment: {} })).toBeNull();
    expect(parseAsaasCheckoutEvent(null)).toBeNull();
  });
});
