import type { CartItem } from "./cart";

export type QuoteCustomer = {
  nome: string;
  empresa: string;
  whatsapp: string;
  cnpj?: string;
};

export function buildQuoteMessage(items: CartItem[], customer: QuoteCustomer): string {
  const itemLines = items
    .map((item) => {
      const skuPart = item.sku ? ` (SKU ${item.sku})` : "";
      return `- ${item.name}${skuPart} — Qtd: ${item.qty}`;
    })
    .join("\n");

  const customerLines = [
    `Nome: ${customer.nome}`,
    `Empresa: ${customer.empresa}`,
    `WhatsApp: ${customer.whatsapp}`,
  ];
  if (customer.cnpj) customerLines.push(`CNPJ: ${customer.cnpj}`);

  return [
    "Olá! Gostaria de uma cotação de atacado:",
    "",
    itemLines,
    "",
    "Meus dados:",
    ...customerLines,
  ].join("\n");
}

export function buildWhatsAppLink(phoneNumber: string, message: string): string {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}
