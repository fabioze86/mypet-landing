import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
import { formatPrice } from "@mypet/core/catalog-utils";
import { ZONA_ROTULO } from "@mypet/core/frete";
import { VITRINES } from "@/lib/vitrines";
import type { OrderBuyer, PedidoResumo } from "./actions";

export type { OrderBuyer } from "./actions";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
const WHATSAPP_INTRO = "Olá! Quero fazer este pedido pela Tabela de Preços My Pet Brasil:";

export function hasWhatsAppNumber(): boolean {
  return WHATSAPP_NUMBER.length > 0;
}

function freteLines(pedido: PedidoResumo): string[] {
  const { frete } = pedido;
  const entrega = frete.modalidade === "prioritaria" ? "prioritária (mesmo dia, pedidos até 12h)" : "normal";
  const lines = ["", `Região: ${ZONA_ROTULO[pedido.zona]}`, `Entrega: ${entrega}`];
  if (frete.tipo === "a_combinar") {
    lines.push("Frete: a combinar");
  } else {
    lines.push(`Frete: ${frete.tipo === "gratis" ? "grátis" : formatPrice((frete.valorCentavos ?? 0) / 100)}`);
    lines.push(`Total com frete: ${formatPrice(pedido.subtotal + (frete.valorCentavos ?? 0) / 100)}`);
  }
  return lines;
}

export function buildOrderWhatsAppUrl(buyer: OrderBuyer, pedido: PedidoResumo): string | null {
  if (!hasWhatsAppNumber()) return null;
  const intro = `Pedido · ${VITRINES[pedido.vitrine].rotulo}\n${WHATSAPP_INTRO}`;
  const base = buildQuoteMessage(pedido.items, { ...buyer, cnpj: buyer.cnpj ?? undefined }, intro, { showPrices: true, totalLabel: "Subtotal dos produtos" });
  return buildWhatsAppLink(WHATSAPP_NUMBER, [base, ...freteLines(pedido)].join("\n"));
}
