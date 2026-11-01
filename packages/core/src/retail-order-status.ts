export const RETAIL_ORDER_STATUSES = [
  "aguardando_pagamento",
  "pago",
  "enviado",
  "entregue",
  "cancelado",
  "expirado",
] as const;
export type RetailOrderStatus = (typeof RETAIL_ORDER_STATUSES)[number];

export const RETAIL_STATUS_LABEL: Record<RetailOrderStatus, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pagamento confirmado",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
  expirado: "Pagamento expirado",
};

const PAGO_OU_DEPOIS = new Set(["pago", "enviado", "entregue"]);

/** Novo status após um evento de checkout do Asaas; null quando o status não deve mudar. */
export function statusAfterCheckoutEvent(current: string, event: string): RetailOrderStatus | null {
  if (PAGO_OU_DEPOIS.has(current)) return null;
  if (event === "CHECKOUT_PAID") return "pago";
  if (current !== "aguardando_pagamento") return null;
  if (event === "CHECKOUT_CANCELED") return "cancelado";
  if (event === "CHECKOUT_EXPIRED") return "expirado";
  return null;
}
