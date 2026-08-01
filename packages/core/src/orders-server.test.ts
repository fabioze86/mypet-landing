import { describe, it, expect, vi } from "vitest";
import { createOrder, getOrdersByBuyer } from "./orders-server";
import type { CartItem } from "./cart";

const items: CartItem[] = [
  { id: "p1", name: "Ração Premium 15kg", sku: "SKU1", brand: "Marca X", img: "/img.png", qty: 2 },
];

describe("createOrder", () => {
  it("retorna erro quando o carrinho está vazio", async () => {
    const supabase = { from: vi.fn() } as any;
    const result = await createOrder(supabase, { buyerId: "b1", channel: "mypetbrasil", items: [] });
    expect(result).toEqual({ orderId: null, error: "O carrinho está vazio." });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("grava o pedido e os itens com snapshot do nome", async () => {
    const ordersInsertSelect = vi.fn().mockReturnThis();
    const ordersSingle = vi.fn().mockResolvedValue({ data: { id: "o1" }, error: null });
    const orderItemsInsert = vi.fn().mockResolvedValue({ error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return { insert: vi.fn().mockReturnThis(), select: ordersInsertSelect, single: ordersSingle };
        }
        return { insert: orderItemsInsert };
      }),
    } as any;

    const result = await createOrder(supabase, { buyerId: "b1", channel: "mypetbrasil", items });

    expect(supabase.from).toHaveBeenCalledWith("orders");
    expect(supabase.from).toHaveBeenCalledWith("order_items");
    expect(orderItemsInsert).toHaveBeenCalledWith([
      { order_id: "o1", product_id: "p1", product_name_snapshot: "Ração Premium 15kg", qty: 2 },
    ]);
    expect(result).toEqual({ orderId: "o1", error: null });
  });

  it("retorna erro genérico quando a criação do pedido falha", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "conexão recusada" } }),
      })),
    } as any;

    const result = await createOrder(supabase, { buyerId: "b1", channel: "mypetbrasil", items });
    expect(result.orderId).toBeNull();
    expect(result.error).toBe("Não foi possível registrar seu pedido. Tente novamente em instantes.");
  });
});

describe("getOrdersByBuyer", () => {
  it("mapeia pedidos com itens", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "o1",
              status: "pendente",
              created_at: "2026-07-31T00:00:00Z",
              order_items: [{ product_id: "p1", product_name_snapshot: "Ração Premium 15kg", qty: 2 }],
            },
          ],
          error: null,
        }),
      })),
    } as any;

    const orders = await getOrdersByBuyer(supabase, "b1");

    expect(orders).toEqual([
      {
        id: "o1",
        status: "pendente",
        createdAt: "2026-07-31T00:00:00Z",
        items: [{ productId: "p1", name: "Ração Premium 15kg", qty: 2 }],
      },
    ]);
  });

  it("retorna lista vazia quando o Supabase falha", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: "erro" } }),
      })),
    } as any;

    const orders = await getOrdersByBuyer(supabase, "b1");
    expect(orders).toEqual([]);
  });
});
