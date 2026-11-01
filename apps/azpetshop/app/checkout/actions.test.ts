import { describe, expect, it, vi, beforeEach } from "vitest";

const quoteCheckout = vi.fn();
const startCheckout = vi.fn();
vi.mock("@mypet/core/retail-checkout-server", () => ({
  quoteCheckout: (...a: unknown[]) => quoteCheckout(...a),
  startCheckout: (...a: unknown[]) => startCheckout(...a),
}));
let onlineEnabled = true;
vi.mock("@mypet/core/features", async (orig) => ({
  ...(await orig<typeof import("@mypet/core/features")>()),
  checkoutOptions: () => ({ online: onlineEnabled, whatsapp: true }),
}));
vi.mock("@mypet/core/supabase", () => ({ getHubServiceClient: () => ({}) }));
vi.mock("@/lib/checkout-env", () => ({
  checkoutEnv: () => ({ asaas: {}, melhorEnvio: {}, siteUrl: "https://loja.test", equipeEmail: "e@x.com" }),
}));

import { cotarFrete, iniciarPagamento } from "./actions";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  quoteCheckout.mockReset();
  startCheckout.mockReset();
  onlineEnabled = true;
});

describe("cotarFrete", () => {
  it("valida antes de chamar o servidor", async () => {
    expect(await cotarFrete({ items: [], cep: "01001000" })).toEqual({ ok: false, error: "O carrinho está vazio." });
    expect(await cotarFrete({ items: [{ id: ID, qty: 1 }], cep: "123" })).toEqual({ ok: false, error: "Informe um CEP válido." });
    expect(quoteCheckout).not.toHaveBeenCalled();
  });

  it("repassa itens e CEP normalizados", async () => {
    quoteCheckout.mockResolvedValue({ ok: true, subtotal: 10, options: [] });
    await cotarFrete({ items: [{ id: ID, qty: 1 }], cep: "01001-000" });
    expect(quoteCheckout.mock.calls[0][1]).toEqual({ items: [{ id: ID, qty: 1 }], cep: "01001000" });
    expect(quoteCheckout.mock.calls[0][0]).toMatchObject({ channel: "azpetshop", siteUrl: "https://loja.test" });
  });
});

describe("iniciarPagamento", () => {
  it("devolve o erro de validação sem criar pedido", async () => {
    expect((await iniciarPagamento({})).ok).toBe(false);
    expect(startCheckout).not.toHaveBeenCalled();
  });

  it("devolve só a URL de pagamento", async () => {
    startCheckout.mockResolvedValue({ ok: true, orderId: "o1", paymentUrl: "https://asaas.test/c/1" });
    const r = await iniciarPagamento({
      items: [{ id: ID, qty: 1 }],
      customer: { nome: "Maria Souza", cpf: "52998224725", email: "m@x.com", whatsapp: "11988887777" },
      address: { cep: "01001000", logradouro: "Rua A", numero: "1", complemento: "", bairro: "Sé", cidade: "São Paulo", uf: "SP" },
      shippingServiceId: 1,
    });
    expect(r).toEqual({ ok: true, paymentUrl: "https://asaas.test/c/1" });
  });
});

describe("configuração de pagamento ausente", () => {
  it("devolve erro amigável quando o ambiente de checkout não está configurado", async () => {
    const env = await import("@/lib/checkout-env");
    const spy = vi.spyOn(env, "checkoutEnv").mockImplementation(() => {
      throw new Error("ASAAS_API_KEY ausente");
    });
    const msg = "Pagamento indisponível no momento. Tente novamente mais tarde.";
    expect(await cotarFrete({ items: [{ id: ID, qty: 1 }], cep: "01001000" })).toEqual({ ok: false, error: msg });
    expect(
      await iniciarPagamento({
        items: [{ id: ID, qty: 1 }],
        customer: { nome: "Maria Souza", cpf: "52998224725", email: "m@x.com", whatsapp: "11988887777" },
        address: { cep: "01001000", logradouro: "Rua A", numero: "1", complemento: "", bairro: "Sé", cidade: "São Paulo", uf: "SP" },
        shippingServiceId: 1,
      }),
    ).toEqual({ ok: false, error: msg });
    spy.mockRestore();
  });
});

describe("pagamento online desligado na configuração do site", () => {
  it("cotarFrete e iniciarPagamento recusam sem chamar o servidor", async () => {
    onlineEnabled = false;
    const msg = "Pagamento indisponível no momento. Tente novamente mais tarde.";
    expect(await cotarFrete({ items: [{ id: ID, qty: 1 }], cep: "01001000" })).toEqual({ ok: false, error: msg });
    expect(
      await iniciarPagamento({
        items: [{ id: ID, qty: 1 }],
        customer: { nome: "Maria Souza", cpf: "52998224725", email: "m@x.com", whatsapp: "11988887777" },
        address: { cep: "01001000", logradouro: "Rua A", numero: "1", complemento: "", bairro: "Sé", cidade: "São Paulo", uf: "SP" },
        shippingServiceId: 1,
      }),
    ).toEqual({ ok: false, error: msg });
    expect(quoteCheckout).not.toHaveBeenCalled();
    expect(startCheckout).not.toHaveBeenCalled();
  });
});
