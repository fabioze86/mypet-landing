import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CartItem } from "@mypet/core/cart";

const requireBuyer = vi.fn();
const createOrder = vi.fn();
const maybeSingle = vi.fn();
const fromMock = vi.fn();
const hubClient = {
  __hub: true,
  from: (table: string) => {
    fromMock(table);
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: () => maybeSingle(),
    };
    return chain;
  },
};

const priceCart = vi.fn();
vi.mock("@mypet/core/retail-checkout-server", () => ({ priceCart: (...a: unknown[]) => priceCart(...a) }));
vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("@mypet/core/supabase", () => ({ getHubServiceClient: () => hubClient }));
vi.mock("@mypet/core/orders-server", () => ({
  createOrder: (client: unknown, input: unknown) => createOrder(client, input),
}));

import { finalizeQuote } from "./actions";

const UUID = "11111111-1111-4111-8111-111111111111";
const ITEMS = [
  { id: UUID, name: "Ração Premium", qty: 2, img: "", brand: "", sku: "", price: 0 },
] as unknown as CartItem[];

beforeEach(() => {
  requireBuyer.mockReset();
  createOrder.mockReset();
  maybeSingle.mockReset();
  fromMock.mockReset();
  priceCart.mockReset();
  priceCart.mockResolvedValue({ ok: true, lines: [{ id: UUID, name: "Ração Premium", qty: 2, unitPrice: 50 }], subtotal: 100 });
});

describe("finalizeQuote", () => {
  it("retorna needsAuth e não cria pedido quando não há comprador", async () => {
    requireBuyer.mockResolvedValue(null);

    const result = await finalizeQuote(ITEMS);

    expect(result).toEqual({
      ok: false,
      error: "Faça seu cadastro para enviar o pedido.",
      needsAuth: true,
    });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("cria o pedido e devolve o comprador com nulos coalescidos para string vazia", async () => {
    requireBuyer.mockResolvedValue({
      id: "buyer-1",
      email: null,
      nome: null,
      empresa: null,
      whatsapp: "11999998888",
      cnpj: null,
      uf: "SP", municipio: "SAO PAULO", cep: "01001000", localizacao_status: "localizado",
    });
    createOrder.mockResolvedValue({ error: null });

    const result = await finalizeQuote(ITEMS);

    expect(createOrder).toHaveBeenCalledWith(
      hubClient,
      expect.objectContaining({
        buyerId: "buyer-1",
        channel: "mypetbrasil",
        agentConversationId: null,
        items: [expect.objectContaining({ id: UUID, qty: 2, unitPrice: 50 })],
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      buyer: { nome: "", empresa: "", whatsapp: "11999998888", cnpj: null },
    });
  });

  it("propaga o erro quando createOrder falha", async () => {
    requireBuyer.mockResolvedValue({
      id: "buyer-1",
      email: null,
      nome: "Loja X",
      empresa: "Loja X ME",
      whatsapp: "11999998888",
      cnpj: "12345678000199",
      uf: "SP", municipio: "SAO PAULO", cep: "01001000", localizacao_status: "localizado",
    });
    createOrder.mockResolvedValue({ error: "x" });

    const result = await finalizeQuote(ITEMS);

    expect(result).toEqual({ ok: false, error: "x" });
  });

  describe("conversa do agente", () => {
    const CONV = "123e4567-e89b-42d3-a456-426614174000";
    const buyer = { id: "buyer-1", email: null, nome: "A", empresa: "B", whatsapp: "1", cnpj: null, uf: "SP", municipio: "SAO PAULO", cep: "01001000", localizacao_status: "localizado" };

    beforeEach(() => {
      requireBuyer.mockResolvedValue(buyer);
      createOrder.mockResolvedValue({ error: null });
    });

    it("liga o pedido à conversa quando ela é do comprador", async () => {
      maybeSingle.mockResolvedValue({ data: { id: CONV }, error: null });
      await finalizeQuote(ITEMS, { agentConversationId: CONV });
      expect(fromMock).toHaveBeenCalledWith("agent_conversations");
      expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({ agentConversationId: CONV }));
    });

    it("ignora a conversa de outro comprador", async () => {
      maybeSingle.mockResolvedValue({ data: null, error: null });
      await finalizeQuote(ITEMS, { agentConversationId: CONV });
      expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({ agentConversationId: null }));
    });

    it("id que não é uuid não consulta a tabela", async () => {
      await finalizeQuote(ITEMS, { agentConversationId: "nao-e-uuid" });
      expect(fromMock).not.toHaveBeenCalled();
      expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({ agentConversationId: null }));
    });

    it("options nulo é tratado como {}", async () => {
      const result = await finalizeQuote(ITEMS, null as never);
      expect(result.ok).toBe(true);
      expect(fromMock).not.toHaveBeenCalled();
      expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({ agentConversationId: null }));
    });

    it("options que não é objeto é tratado como {}", async () => {
      const result = await finalizeQuote(ITEMS, "x" as never);
      expect(result.ok).toBe(true);
      expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({ agentConversationId: null }));
    });

    it("id que não é string vira null, sem consultar a tabela", async () => {
      maybeSingle.mockResolvedValue({ data: { id: CONV }, error: null });
      // um array de um elemento vira o próprio uuid quando convertido para texto
      for (const bad of [[CONV], 123, { toString: () => CONV }]) {
        createOrder.mockClear();
        await finalizeQuote(ITEMS, { agentConversationId: bad } as never);
        expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({ agentConversationId: null }));
      }
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("falha na consulta não bloqueia o pedido", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      maybeSingle.mockResolvedValue({ data: null, error: { message: "x" } });
      const result = await finalizeQuote(ITEMS, { agentConversationId: CONV });
      expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({ agentConversationId: null }));
      expect(result.ok).toBe(true);
    });
  });
});

const BUYER_SP = {
  id: "b1", nome: "Ana", empresa: "Pet A", whatsapp: "11999999999", cnpj: "12345678000199", email: null,
  uf: "SP", municipio: "SAO PAULO", cep: "01001000", localizacao_status: "localizado",
};
const LINE_ITEMS = [{ id: UUID, name: "Ração Premium", qty: 2, img: "x.jpg", brand: "B", sku: "R1", unitPrice: 1 }] as CartItem[];

describe("finalizeQuote com vitrine", () => {
  it("fábrica: recorta por ffa_fabrica, ignora estoque e grava frete fixo abaixo de R$ 299", async () => {
    requireBuyer.mockResolvedValue(BUYER_SP);
    priceCart.mockResolvedValue({ ok: true, lines: [{ id: UUID, name: "Ração Premium", qty: 2, unitPrice: 50 }], subtotal: 100 });
    createOrder.mockResolvedValue({ orderId: "o1", error: null });

    const r = await finalizeQuote(LINE_ITEMS, { vitrine: "fabrica" });

    expect(priceCart).toHaveBeenCalledWith(hubClient, "mypetbrasil", [{ id: UUID, qty: 2 }], { alsoInChannel: "ffa_fabrica", checkStock: false });
    expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({
      vitrine: "fabrica",
      shipping: { mode: "normal", subtotal: 100, shippingPrice: 19.9, total: 119.9 },
      items: [expect.objectContaining({ id: UUID, qty: 2, unitPrice: 50, img: "x.jpg" })],
    }));
    expect(r).toMatchObject({ ok: true, pedido: { vitrine: "fabrica", subtotal: 100, frete: { tipo: "fixo", valorCentavos: 1990 } } });
  });

  it("completo: zona do comprador e prioritária", async () => {
    requireBuyer.mockResolvedValue(BUYER_SP);
    priceCart.mockResolvedValue({ ok: true, lines: [{ id: UUID, name: "Ração Premium", qty: 2, unitPrice: 150 }], subtotal: 300 });
    createOrder.mockResolvedValue({ orderId: "o1", error: null });

    const r = await finalizeQuote(LINE_ITEMS, { vitrine: "completo", modalidade: "prioritaria" });

    expect(priceCart).toHaveBeenCalledWith(hubClient, "mypetbrasil", [{ id: UUID, qty: 2 }], { checkStock: false });
    expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({
      vitrine: "completo",
      shipping: { mode: "prioritaria", subtotal: 300, shippingPrice: 30, total: 330 },
    }));
    expect(r).toMatchObject({ ok: true, pedido: { zona: "capital" } });
  });

  it("fora de SP: a combinar, total igual ao subtotal", async () => {
    requireBuyer.mockResolvedValue({ ...BUYER_SP, uf: "RJ", municipio: "RIO DE JANEIRO" });
    priceCart.mockResolvedValue({ ok: true, lines: [{ id: UUID, name: "Ração Premium", qty: 2, unitPrice: 50 }], subtotal: 100 });
    createOrder.mockResolvedValue({ orderId: "o1", error: null });

    await finalizeQuote(LINE_ITEMS, { vitrine: "completo" });

    expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({
      shipping: { mode: "a_combinar", subtotal: 100, shippingPrice: null, total: 100 },
    }));
  });

  it("devolve o erro do priceCart sem gravar", async () => {
    requireBuyer.mockResolvedValue(BUYER_SP);
    priceCart.mockResolvedValue({ ok: false, error: "Algum item do carrinho não está mais à venda. Revise o carrinho." });

    const r = await finalizeQuote(LINE_ITEMS, { vitrine: "fabrica" });

    expect(r).toEqual({ ok: false, error: "Algum item do carrinho não está mais à venda. Revise o carrinho." });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("vitrine inválida vira completo", async () => {
    requireBuyer.mockResolvedValue(BUYER_SP);
    priceCart.mockResolvedValue({ ok: true, lines: [{ id: UUID, name: "Ração Premium", qty: 2, unitPrice: 50 }], subtotal: 100 });
    createOrder.mockResolvedValue({ orderId: "o1", error: null });

    await finalizeQuote(LINE_ITEMS, { vitrine: "xpto" as never });

    expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({ vitrine: "completo" }));
  });
});
