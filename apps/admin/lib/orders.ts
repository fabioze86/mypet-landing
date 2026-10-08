export const ORDER_STATUSES = ["pendente", "confirmado", "entregue", "cancelado"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Pedidos sem login (distribuidora) não têm buyer: os dados do cliente vêm em customer_*.
export const ORDERS_SELECT =
  "id, number, channel, status, created_at, customer_name, customer_company, customer_whatsapp, customer_cnpj, " +
  "buyers(nome, empresa, whatsapp, cnpj), order_items(product_id, product_name_snapshot, qty, unit_price)";

export type OrderItemRow = {
  product_id: string;
  product_name_snapshot: string;
  qty: number;
  /** numeric do Postgres: pode chegar como número ou texto. */
  unit_price: number | string | null;
};

export type OrderRow = {
  id: string;
  number: number | string | null;
  channel: string;
  status: OrderStatus;
  created_at: string;
  customer_name: string | null;
  customer_company: string | null;
  customer_whatsapp: string | null;
  customer_cnpj: string | null;
  buyers: { nome: string; empresa: string; whatsapp: string; cnpj: string | null } | null;
  order_items: OrderItemRow[];
};

export type OrderCustomer = { nome: string; empresa: string; whatsapp: string; cnpj: string | null };

export function orderCustomer(order: OrderRow): OrderCustomer {
  if (order.buyers) {
    const { nome, empresa, whatsapp, cnpj } = order.buyers;
    return { nome, empresa, whatsapp, cnpj: cnpj ?? null };
  }
  return {
    nome: order.customer_name ?? "",
    empresa: order.customer_company ?? "",
    whatsapp: order.customer_whatsapp ?? "",
    cnpj: order.customer_cnpj ?? null,
  };
}

export function itemUnitPrice(item: OrderItemRow): number | null {
  if (item.unit_price === null || item.unit_price === undefined || item.unit_price === "") return null;
  const value = Number(item.unit_price);
  return Number.isFinite(value) ? value : null;
}

/** Soma das linhas com preço; null quando nenhuma linha tem preço. */
export function orderTotal(order: OrderRow): number | null {
  let total = 0;
  let priced = 0;
  for (const item of order.order_items) {
    const price = itemUnitPrice(item);
    if (price === null) continue;
    total += price * item.qty;
    priced += 1;
  }
  return priced > 0 ? Math.round(total * 100) / 100 : null;
}
