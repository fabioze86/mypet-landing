import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartItem } from "./cart";
import type { Channel } from "./channels";

const MISSING_COLUMN_CODES = new Set(["PGRST204", "42703"]);

export async function createOrder(
  supabase: SupabaseClient,
  input: { buyerId: string; channel: Channel; items: CartItem[]; agentConversationId?: string | null }
): Promise<{ orderId: string | null; error: string | null }> {
  if (input.items.length === 0) {
    return { orderId: null, error: "O carrinho está vazio." };
  }

  const baseRow = { buyer_id: input.buyerId, channel: input.channel, status: "pendente" };
  const insertOrder = (row: Record<string, unknown>) => supabase.from("orders").insert(row).select("id").single();

  // só manda a coluna quando há conversa
  let { data: order, error: orderError } = await insertOrder(
    input.agentConversationId ? { ...baseRow, agent_conversation_id: input.agentConversationId } : baseRow,
  );

  // Rede de segurança: se a coluna agent_conversation_id não existir no banco
  // (PGRST204 = coluna fora do cache do PostgREST; 42703 = coluna inexistente),
  // grava o pedido sem o vínculo com a conversa em vez de perder o pedido.
  if (orderError && input.agentConversationId && MISSING_COLUMN_CODES.has(String(orderError.code))) {
    console.error(
      "[orders] coluna agent_conversation_id indisponível; repetindo sem ela:",
      orderError.code,
      orderError.message,
    );
    ({ data: order, error: orderError } = await insertOrder(baseRow));
  }

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

function mapOrderRows(data: unknown): OrderWithItems[] {
  return ((data as RawOrderRow[] | null) ?? []).map((row) => ({
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

// Pedidos recentes do comprador num canal. Ao contrário de getOrdersByBuyer,
// lança em caso de erro: o agente não pode confundir falha com "sem pedidos".
export async function fetchRecentOrdersByBuyer(
  supabase: SupabaseClient,
  buyerId: string,
  { channel, limit }: { channel: string; limit: number },
): Promise<OrderWithItems[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, created_at, order_items(product_id, product_name_snapshot, qty)")
    .eq("buyer_id", buyerId)
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[orders] erro ao consultar pedidos recentes:", error.message, error);
    // Mensagem genérica: o texto cru do banco não vai para o modelo.
    throw new Error("Falha ao consultar pedidos.");
  }
  return mapOrderRows(data);
}

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
