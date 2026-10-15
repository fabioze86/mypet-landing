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

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("@mypet/core/supabase", () => ({ getHubServiceClient: () => hubClient }));
vi.mock("@mypet/core/orders-server", () => ({
  createOrder: (client: unknown, input: unknown) => createOrder(client, input),
}));

import { finalizeQuote } from "./actions";

const ITEMS = [
  { id: "p1", name: "Ração Premium", qty: 2, img: "", brand: "", sku: "", price: 0 },
] as unknown as CartItem[];

beforeEach(() => {
  requireBuyer.mockReset();
  createOrder.mockReset();
  maybeSingle.mockReset();
  fromMock.mockReset();
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
    });
    createOrder.mockResolvedValue({ error: null });

    const result = await finalizeQuote(ITEMS);

    expect(createOrder).toHaveBeenCalledWith(
      hubClient,
      { buyerId: "buyer-1", channel: "mypetbrasil", items: ITEMS, agentConversationId: null },
    );
    expect(result).toEqual({
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
    });
    createOrder.mockResolvedValue({ error: "x" });

    const result = await finalizeQuote(ITEMS);

    expect(result).toEqual({ ok: false, error: "x" });
  });

  describe("conversa do agente", () => {
    const CONV = "123e4567-e89b-42d3-a456-426614174000";
    const buyer = { id: "buyer-1", email: null, nome: "A", empresa: "B", whatsapp: "1", cnpj: null };

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

    it("falha na consulta não bloqueia o pedido", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      maybeSingle.mockResolvedValue({ data: null, error: { message: "x" } });
      const result = await finalizeQuote(ITEMS, { agentConversationId: CONV });
      expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({ agentConversationId: null }));
      expect(result.ok).toBe(true);
    });
  });
});
