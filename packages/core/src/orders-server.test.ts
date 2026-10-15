import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrder, fetchRecentOrdersByBuyer, getOrdersByBuyer } from "./orders-server";
import type { CartItem } from "./cart";

const items: CartItem[] = [
  { id: "p1", name: "Ração Premium 15kg", sku: "SKU1", brand: "Marca X", img: "/img.png", qty: 2 },
];

describe("createOrder", () => {
  it("retorna erro quando o carrinho está vazio", async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;
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
    } as unknown as SupabaseClient;

    const result = await createOrder(supabase, { buyerId: "b1", channel: "mypetbrasil", items });

    expect(supabase.from).toHaveBeenCalledWith("orders");
    expect(supabase.from).toHaveBeenCalledWith("order_items");
    expect(orderItemsInsert).toHaveBeenCalledWith([
      { order_id: "o1", product_id: "p1", product_name_snapshot: "Ração Premium 15kg", qty: 2 },
    ]);
    expect(result).toEqual({ orderId: "o1", error: null });
  });

  const buildCapture = () => {
    const ordersInsert = vi.fn().mockReturnThis();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return {
            insert: ordersInsert,
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: "o1" }, error: null }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }),
    } as unknown as SupabaseClient;
    return { supabase, ordersInsert };
  };

  it("grava agent_conversation_id quando o pedido vem de uma conversa do agente", async () => {
    const { supabase, ordersInsert } = buildCapture();
    await createOrder(supabase, { buyerId: "b1", channel: "mypetbrasil", items, agentConversationId: "c1" });
    expect(ordersInsert).toHaveBeenCalledWith({
      buyer_id: "b1",
      channel: "mypetbrasil",
      status: "pendente",
      agent_conversation_id: "c1",
    });
  });

  it("sem conversa não manda a coluna agent_conversation_id", async () => {
    const { supabase, ordersInsert } = buildCapture();
    await createOrder(supabase, { buyerId: "b1", channel: "mypetbrasil", items });
    const inserted = ordersInsert.mock.calls[0][0];
    expect(inserted).toEqual({ buyer_id: "b1", channel: "mypetbrasil", status: "pendente" });
    expect("agent_conversation_id" in inserted).toBe(false);
  });

  it("retorna erro genérico quando a criação do pedido falha", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "conexão recusada" } }),
      })),
    } as unknown as SupabaseClient;

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
    } as unknown as SupabaseClient;

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
    } as unknown as SupabaseClient;

    const orders = await getOrdersByBuyer(supabase, "b1");
    expect(orders).toEqual([]);
  });
});

describe("fetchRecentOrdersByBuyer", () => {
  const build = (result: unknown) => {
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn().mockReturnThis();
    const limit = vi.fn().mockResolvedValue(result);
    const supabase = { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq, order, limit })) } as unknown as SupabaseClient;
    return { supabase, eq, order, limit };
  };

  it("filtra por comprador e canal, ordena e limita", async () => {
    const { supabase, eq, order, limit } = build({
      data: [
        {
          id: "o1",
          status: "pendente",
          created_at: "2026-07-31T00:00:00Z",
          order_items: [{ product_id: "p1", product_name_snapshot: "Ração", qty: 2 }],
        },
      ],
      error: null,
    });
    const orders = await fetchRecentOrdersByBuyer(supabase, "b1", { channel: "mypetbrasil", limit: 5 });
    expect(eq).toHaveBeenCalledWith("buyer_id", "b1");
    expect(eq).toHaveBeenCalledWith("channel", "mypetbrasil");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(5);
    expect(orders).toEqual([
      { id: "o1", status: "pendente", createdAt: "2026-07-31T00:00:00Z", items: [{ productId: "p1", name: "Ração", qty: 2 }] },
    ]);
  });

  it("lança quando o Supabase falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase } = build({ data: null, error: { message: "erro" } });
    await expect(fetchRecentOrdersByBuyer(supabase, "b1", { channel: "mypetbrasil", limit: 5 })).rejects.toThrow();
  });
});
