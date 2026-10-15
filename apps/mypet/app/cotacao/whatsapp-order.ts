import type { CartItem } from "@mypet/core/cart";
import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
const WHATSAPP_INTRO = "Olá! Quero fazer este pedido pela Tabela de Preços My Pet Brasil:";

export type OrderBuyer = { nome: string; empresa: string; whatsapp: string; cnpj: string | null };

export function hasWhatsAppNumber(): boolean {
  return WHATSAPP_NUMBER.length > 0;
}

export function buildOrderWhatsAppUrl(items: CartItem[], buyer: OrderBuyer): string | null {
  if (!hasWhatsAppNumber()) return null;
  const message = buildQuoteMessage(items, { ...buyer, cnpj: buyer.cnpj ?? undefined }, WHATSAPP_INTRO);
  return buildWhatsAppLink(WHATSAPP_NUMBER, message);
}
