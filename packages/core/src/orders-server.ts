import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartItem } from "./cart";
import type { Channel } from "./channels";

export async function createOrder(
  supabase: SupabaseClient,
  input: { buyerId: string; channel: Channel; items: CartItem[] }
): Promise<{ orderId: string | null; error: string | null }> {
  if (input.items.length === 0) {
    return { orderId: null, error: "O carrinho está vazio." };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({ buyer_id: input.buyerId, channel: input.channel, status: "pendente" })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[orders] erro ao criar pedido:", orderError?.message);
    return { orderId: null, error: "Não foi possível registrar seu pedido. Tente novamente em instantes." };
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    input.items.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      product_name_snapshot: item.name,
      qty: item.qty,
    }))
  );

  if (itemsError) {
    console.error("[orders] erro ao gravar itens do pedido:", itemsError.message);
    return { orderId: null, error: "Não foi possível registrar os itens do pedido. Tente novamente em instantes." };
  }

  return { orderId: order.id as string, error: null };
}

export type OrderWithItems = {
  id: string;
  status: string;
  createdAt: string;
  items: { productId: string; name: string; qty: number }[];
};

type RawOrderRow = {
  id: string;
  status: string;
  created_at: string;
  order_items: { product_id: string; product_name_snapshot: string; qty: number }[] | null;
};

export async function getOrdersByBuyer(supabase: SupabaseClient, buyerId: string): Promise<OrderWithItems[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, created_at, order_items(product_id, product_name_snapshot, qty)")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[orders] erro ao consultar pedidos:", error.message);
    return [];
  }

  return ((data as unknown as RawOrderRow[]) ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    items: (row.order_items ?? []).map((it) => ({
      productId: it.product_id,
      name: it.product_name_snapshot,
      qty: it.qty,
    })),
  }));
}
