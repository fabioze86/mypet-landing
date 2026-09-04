import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItem } from "@mypet/core/cart";

const getUser = vi.fn();
const getBuyerById = vi.fn();
const createOrder = vi.fn();
const scheduledTasks: Array<() => void | Promise<void>> = [];

vi.mock("next/server", () => ({
  after: (task: () => void | Promise<void>) => scheduledTasks.push(task),
}));
vi.mock("@mypet/core/supabase-server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@mypet/core/buyers-server", () => ({
  getBuyerById: (...args: unknown[]) => getBuyerById(...args),
}));
vi.mock("@mypet/core/orders-server", () => ({
  createOrder: (...args: unknown[]) => createOrder(...args),
}));

import { finalizeQuote } from "./actions";

const ITEMS = [
  { id: "p1", name: "Coleira", qty: 2, img: "", brand: "MadPet", sku: "COL-1" },
] as CartItem[];

const BUYER = {
  id: "buyer-1",
  email: "comprador@example.com",
  nome: "Maria",
  empresa: "Pet Shop Maria",
  whatsapp: "11999998888",
  cnpj: null,
};

beforeEach(() => {
  getUser.mockReset();
  getBuyerById.mockReset();
  createOrder.mockReset();
  scheduledTasks.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: BUYER.id } } });
  getBuyerById.mockResolvedValue(BUYER);
});

describe("finalizeQuote", () => {
  it("devolve o comprador sem esperar a gravação do pedido", async () => {
    createOrder.mockReturnValue(new Promise(() => {}));

    const outcome = await Promise.race([
      finalizeQuote(ITEMS),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 100)),
    ]);

    expect(outcome).toEqual({
      ok: true,
      buyer: {
        nome: "Maria",
        empresa: "Pet Shop Maria",
        whatsapp: "11999998888",
        cnpj: null,
      },
    });
  });

  it("agenda a gravação completa do pedido após responder", async () => {
    createOrder.mockResolvedValue({ orderId: "order-1", error: null });

    await finalizeQuote(ITEMS);

    expect(createOrder).not.toHaveBeenCalled();
    expect(scheduledTasks).toHaveLength(1);
    await scheduledTasks[0]();
    expect(createOrder).toHaveBeenCalledWith(expect.anything(), {
      buyerId: BUYER.id,
      channel: "ffa_fabrica",
      items: ITEMS,
    });
  });
});
