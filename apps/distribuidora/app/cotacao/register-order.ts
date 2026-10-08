import type { CartItem } from "@mypet/core/cart";
import type { QuoteCustomer } from "@mypet/core/whatsapp";

export type RegisterOrderResult =
  | { kind: "ok"; number: number; prices: Map<string, number | null> }
  | { kind: "invalid"; error: string }
  | { kind: "failed" };

// Grava o pedido antes de abrir o WhatsApp. Só "invalid" deve impedir o envio;
// em "failed" (rede/5xx) o pedido segue pelo WhatsApp sem número.
export async function registerOrder(
  items: CartItem[],
  customer: QuoteCustomer,
  fetchImpl: typeof fetch = fetch,
): Promise<RegisterOrderResult> {
  try {
    const res = await fetchImpl("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map((item) => ({ id: item.id, qty: item.qty })), customer }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && typeof data.number === "number") {
      const prices = new Map<string, number | null>(
        ((data.items ?? []) as { id: string; unitPrice: number | null }[]).map((item) => [item.id, item.unitPrice]),
      );
      return { kind: "ok", number: data.number, prices };
    }
    if (res.status === 400) {
      return { kind: "invalid", error: typeof data.error === "string" ? data.error : "Confira os dados e tente novamente." };
    }
    console.error("[cotacao] falha ao registrar pedido:", res.status, data?.error);
    return { kind: "failed" };
  } catch (error) {
    console.error("[cotacao] falha ao registrar pedido:", error);
    return { kind: "failed" };
  }
}

export function applyServerPrices(items: CartItem[], prices: Map<string, number | null>): CartItem[] {
  return items.map((item) =>
    prices.has(item.id) ? { ...item, unitPrice: prices.get(item.id) ?? undefined } : item,
  );
}
