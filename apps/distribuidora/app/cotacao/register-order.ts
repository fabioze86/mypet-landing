import type { CartItem } from "@mypet/core/cart";
import type { QuoteCustomer } from "@mypet/core/whatsapp";

export type RegisterOrderResult =
  | { kind: "ok"; number: number; prices: Map<string, number | null>; unavailableIds: string[] }
  | { kind: "invalid"; error: string }
  | { kind: "failed" };

// Grava o pedido antes de abrir o WhatsApp. Só "invalid" deve impedir o envio;
// em "failed" (rede/5xx/409 nada disponível) o pedido segue pelo WhatsApp sem número.
const REQUEST_TIMEOUT_MS = 8000;

// AbortSignal.timeout só existe a partir do iOS 16; sem ele o pedido nunca seria gravado.
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

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
      // Servidor lento não segura o cliente: estouro vira "failed" e o WhatsApp abre.
      signal: timeoutSignal(REQUEST_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && typeof data.number === "number") {
      const prices = new Map<string, number | null>(
        ((data.items ?? []) as { id: string; unitPrice: number | null }[]).map((item) => [item.id, item.unitPrice]),
      );
      const unavailableIds = Array.isArray(data.unavailableIds)
        ? (data.unavailableIds as unknown[]).filter((id): id is string => typeof id === "string")
        : [];
      return { kind: "ok", number: data.number, prices, unavailableIds };
    }
    if (res.status === 409) {
      // Nenhum item disponível: o pedido não foi gravado, mas a venda segue pelo WhatsApp.
      return { kind: "failed" };
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

// Itens indisponíveis perdem o preço (saem como "a consultar" na mensagem).
export function applyServerPrices(
  items: CartItem[],
  prices: Map<string, number | null>,
  unavailableIds: string[] = [],
): CartItem[] {
  const unavailable = new Set(unavailableIds);
  return items.map((item) => {
    if (unavailable.has(item.id)) return { ...item, unitPrice: undefined };
    return prices.has(item.id) ? { ...item, unitPrice: prices.get(item.id) ?? undefined } : item;
  });
}
