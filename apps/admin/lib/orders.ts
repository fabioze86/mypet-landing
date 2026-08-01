export const ORDER_STATUSES = ["pendente", "confirmado", "entregue", "cancelado"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderItemRow = {
  product_id: string;
  product_name_snapshot: string;
  qty: number;
};

export type OrderRow = {
  id: string;
  channel: string;
  status: OrderStatus;
  created_at: string;
  buyers: { nome: string; empresa: string; whatsapp: string } | null;
  order_items: OrderItemRow[];
};
