import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CartItem } from "@mypet/core/cart";

const requireBuyer = vi.fn();
const createOrder = vi.fn();

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("@mypet/core/supabase", () => ({ getHubServiceClient: () => ({ __hub: true }) }));
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
});

describe("finalizeQuote", () => {
  it("retorna needsAuth e não cria pedido quando não há comprador", async () => {
    requireBuyer.mockResolvedValue(null);

    const result = await finalizeQuote(ITEMS);

    expect(result).toEqual({
      ok: false,
      error: "Você precisa criar um acesso para finalizar a cotação.",
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
      { __hub: true },
      { buyerId: "buyer-1", channel: "mypetbrasil", items: ITEMS },
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
});
