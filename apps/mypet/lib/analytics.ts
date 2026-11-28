// Propriedade GA4 "My Pet Brasil – GA4 - Oficial" (ID da propriedade 289931242).
export const GA_ID = "G-NL6RSGC2CZ";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type PedidoEnviado = {
  vitrine: string;
  subtotal: number;
  items: { length: number };
};

// Pedido gravado e WhatsApp aberto: é a conversão do site. generate_lead é evento
// recomendado do GA4; marcar como evento-chave no painel. Sem gtag (dev/preview) não faz nada.
export function trackPedidoEnviado(pedido: PedidoEnviado, origem: "cotacao" | "agente") {
  window.gtag?.("event", "generate_lead", {
    currency: "BRL",
    value: pedido.subtotal,
    vitrine: pedido.vitrine,
    itens: pedido.items.length,
    origem,
  });
}
