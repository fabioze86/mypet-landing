import nodemailer from "nodemailer";
import { formatBRL } from "@mypet/core/catalog-utils";
import { formatCep, formatWhatsapp } from "@mypet/core/br-validation";
import type { RetailOrderView } from "@mypet/core/retail-orders-server";
import { EMPRESA } from "@/lib/empresa";

export type PedidoParaEmail = {
  id: string;
  number: number;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  total: number;
  shippingPrice: number;
  items: { name: string; qty: number; unitPrice: number }[];
  address: { cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string };
  serviceName: string;
  trackingCode?: string | null;
  orderUrl: string;
};
export type Mailer = (msg: { to: string; subject: string; text: string }) => Promise<void>;

export function smtpMailer(): Mailer {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error("SMTP não configurado (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  const port = Number(process.env.SMTP_PORT) || 465;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return async ({ to, subject, text }) => {
    await transport.sendMail({ from: `"${EMPRESA.nomeFantasia}" <${SMTP_USER}>`, to, subject, text });
  };
}

function itensEmTexto(p: PedidoParaEmail): string {
  return p.items.map((i) => `- ${i.qty}x ${i.name} — ${formatBRL(i.unitPrice * i.qty)}`).join("\n");
}

function enderecoEmTexto(p: PedidoParaEmail): string {
  const a = p.address;
  const rua = [a.logradouro, a.numero, a.complemento].filter(Boolean).join(", ");
  return `${rua} — ${a.bairro}, ${a.cidade}/${a.uf} — CEP ${formatCep(a.cep)}`;
}

export function emailPedidoPagoEquipe(p: PedidoParaEmail) {
  return {
    subject: `Pedido ${p.number} pago — ${EMPRESA.nomeFantasia}`,
    text: [
      `Pedido ${p.number} com pagamento confirmado.`,
      "",
      itensEmTexto(p),
      `Frete (${p.serviceName}): ${formatBRL(p.shippingPrice)}`,
      `Total: ${formatBRL(p.total)}`,
      "",
      `Cliente: ${p.customerName} — ${p.customerEmail} — WhatsApp ${formatWhatsapp(p.customerWhatsapp)}`,
      `Entrega: ${enderecoEmTexto(p)}`,
      "",
      "Emita a NF-e, gere a etiqueta no Melhor Envio e marque como enviado no admin.",
    ].join("\n"),
  };
}

export function emailPedidoPagoCliente(p: PedidoParaEmail) {
  return {
    subject: `Recebemos seu pagamento — pedido ${p.number}`,
    text: [
      `Olá, ${p.customerName}!`,
      "",
      `Confirmamos o pagamento do seu pedido ${p.number} na ${EMPRESA.nomeFantasia}.`,
      "",
      itensEmTexto(p),
      `Frete (${p.serviceName}): ${formatBRL(p.shippingPrice)}`,
      `Total: ${formatBRL(p.total)}`,
      "",
      `Entrega em: ${enderecoEmTexto(p)}`,
      `Acompanhe seu pedido: ${p.orderUrl}`,
      "",
      `Dúvidas? Responda este e-mail ou fale pelo WhatsApp ${formatWhatsapp(EMPRESA.whatsapp)}.`,
    ].join("\n"),
  };
}

/** Avisa equipe e cliente; falhas são registradas e nunca derrubam o webhook. */
export async function avisarPedidoPago(p: PedidoParaEmail, mailer: Mailer, equipeEmail: string): Promise<void> {
  const envios = [
    { to: equipeEmail, ...emailPedidoPagoEquipe(p) },
    { to: p.customerEmail, ...emailPedidoPagoCliente(p) },
  ];
  for (const msg of envios) {
    try {
      await mailer(msg);
    } catch (err) {
      console.error(`[pedido-emails] falha ao enviar para ${msg.to}:`, (err as Error).message);
    }
  }
}

export function pedidoParaEmail(order: RetailOrderView, siteUrl: string, token: string): PedidoParaEmail {
  return {
    id: order.id,
    number: order.number,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerWhatsapp: order.customerWhatsapp,
    total: order.total,
    shippingPrice: order.shippingPrice,
    items: order.items,
    address: order.shipping
      ? { cep: order.shipping.cep, logradouro: order.shipping.logradouro, numero: order.shipping.numero, complemento: order.shipping.complemento, bairro: order.shipping.bairro, cidade: order.shipping.cidade, uf: order.shipping.uf }
      : { cep: "", logradouro: "", numero: "", complemento: null, bairro: "", cidade: "", uf: "" },
    serviceName: order.shipping?.serviceName ?? "",
    trackingCode: order.shipping?.trackingCode ?? null,
    orderUrl: `${siteUrl}/pedido/${order.id}?t=${token}`,
  };
}
