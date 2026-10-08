import { cartTotals, type CartItem } from "./cart";
import { formatPrice } from "./catalog-utils";

export type QuoteCustomer = {
  nome: string;
  empresa: string;
  whatsapp: string;
  cnpj?: string;
};

export type QuoteMessageOptions = {
  /** Mostra preço por linha (ou "a consultar") e o bloco de totais. */
  showPrices?: boolean;
  /** Número do pedido gravado; vira a primeira linha da mensagem. */
  orderNumber?: number;
};

function quoteItemLine(item: CartItem, showPrices: boolean): string {
  const skuPart = item.sku ? ` (SKU ${item.sku})` : "";
  if (!showPrices) return `- ${item.name}${skuPart} — Qtd: ${item.qty}`;
  if (typeof item.unitPrice !== "number") return `- ${item.name}${skuPart} — Qtd: ${item.qty} (a consultar)`;
  const lineTotal = Math.round(item.unitPrice * item.qty * 100) / 100;
  return `- ${item.name}${skuPart} — ${item.qty} × ${formatPrice(item.unitPrice)} = ${formatPrice(lineTotal)}`;
}

function quoteTotalsLines(items: CartItem[]): string[] {
  const totals = cartTotals(items);
  const lines = ["", `Total de unidades: ${totals.totalUnits}`];
  if (totals.pricedLines > 0) {
    const pending = totals.unpricedLines > 0 ? " + itens a consultar" : "";
    lines.push(`Total: ${formatPrice(totals.totalValue)}${pending}`);
  }
  return lines;
}

export function buildQuoteMessage(
  items: CartItem[],
  customer: QuoteCustomer,
  intro = "Olá! Gostaria de uma cotação de atacado:",
  options: QuoteMessageOptions = {},
): string {
  const showPrices = options.showPrices === true;
  const itemLines = items.map((item) => quoteItemLine(item, showPrices)).join("\n");

  const customerLines = [
    `Nome: ${customer.nome}`,
    `Empresa: ${customer.empresa}`,
    `WhatsApp: ${customer.whatsapp}`,
  ];
  if (customer.cnpj) customerLines.push(`CNPJ: ${customer.cnpj}`);

  return [
    ...(options.orderNumber !== undefined ? [`Pedido #${options.orderNumber}`, ""] : []),
    intro,
    "",
    itemLines,
    ...(showPrices ? quoteTotalsLines(items) : []),
    "",
    "Meus dados:",
    ...customerLines,
  ].join("\n");
}

export function buildWhatsAppLink(phoneNumber: string, message: string): string {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

export function buildProductInterestMessage(productName: string): string {
  return `Olá! Tenho interesse no produto: ${productName}`;
}

export function buildRetailQuoteMessage(
  items: CartItem[],
  customer: { nome: string; whatsapp: string },
): string {
  const itemLines = items
    .map((item) => {
      const skuPart = item.sku ? ` (SKU ${item.sku})` : "";
      return `- ${item.name}${skuPart} — Qtd: ${item.qty}`;
    })
    .join("\n");

  return [
    "Olá! Gostaria de finalizar este pedido:",
    "",
    itemLines,
    "",
    "Meus dados:",
    `Nome: ${customer.nome}`,
    `WhatsApp: ${customer.whatsapp}`,
  ].join("\n");
}
