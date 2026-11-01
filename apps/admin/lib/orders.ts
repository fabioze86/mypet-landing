import type { ListmonkConfig } from "@mypet/core/listmonk";

export const ORDER_STATUSES = [
  "pendente", "confirmado", "aguardando_pagamento", "pago", "enviado", "entregue", "cancelado", "expirado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Pedidos sem login (distribuidora) não têm buyer: os dados do cliente vêm em customer_*.
export const ORDERS_SELECT =
  "id, number, channel, status, created_at, customer_name, customer_company, customer_whatsapp, customer_cnpj, " +
  "customer_email, customer_cpf, total, shipping_price, " +
  "buyers(nome, empresa, whatsapp, cnpj), order_items(product_id, product_name_snapshot, qty, unit_price), " +
  "order_shipping(cep, logradouro, numero, complemento, bairro, cidade, uf, service_name, price, tracking_code, shipped_at), " +
  "order_payments(status, checkout_url)";

export type OrderItemRow = {
  product_id: string;
  product_name_snapshot: string;
  qty: number;
  /** numeric do Postgres: pode chegar como número ou texto. */
  unit_price: number | string | null;
};

export type OrderRow = {
  id: string;
  number: number | string | null;
  channel: string;
  status: OrderStatus;
  created_at: string;
  customer_name: string | null;
  customer_company: string | null;
  customer_whatsapp: string | null;
  customer_cnpj: string | null;
  customer_email?: string | null;
  customer_cpf?: string | null;
  total?: number | string | null;
  shipping_price?: number | string | null;
  order_shipping?: {
    cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string;
    service_name: string; price: number | string; tracking_code: string | null; shipped_at: string | null;
  } | null;
  order_payments?: { status: string; checkout_url: string | null } | null;
  buyers: { nome: string; empresa: string; whatsapp: string; cnpj: string | null } | null;
  order_items: OrderItemRow[];
};

export type OrderCustomer = { nome: string; empresa: string; whatsapp: string; cnpj: string | null };

export function orderCustomer(order: OrderRow): OrderCustomer {
  if (order.buyers) {
    const { nome, empresa, whatsapp, cnpj } = order.buyers;
    return { nome, empresa, whatsapp, cnpj: cnpj ?? null };
  }
  return {
    nome: order.customer_name ?? "",
    empresa: order.customer_company ?? "",
    whatsapp: order.customer_whatsapp ?? "",
    cnpj: order.customer_cnpj ?? null,
  };
}

export function itemUnitPrice(item: OrderItemRow): number | null {
  if (item.unit_price === null || item.unit_price === undefined || item.unit_price === "") return null;
  const value = Number(item.unit_price);
  return Number.isFinite(value) ? value : null;
}

/** Soma das linhas com preço; null quando nenhuma linha tem preço. */
export function orderTotal(order: OrderRow): number | null {
  if (order.total !== null && order.total !== undefined && order.total !== "") {
    const gravado = Number(order.total);
    if (Number.isFinite(gravado)) return gravado;
  }
  let total = 0;
  let priced = 0;
  for (const item of order.order_items) {
    const price = itemUnitPrice(item);
    if (price === null) continue;
    total += price * item.qty;
    priced += 1;
  }
  return priced > 0 ? Math.round(total * 100) / 100 : null;
}

/** Configuração do Listmonk para o e-mail "pedido enviado"; null se faltar qualquer variável. */
export function listmonkEnv(): (ListmonkConfig & { templateId: number; siteUrl: string }) | null {
  const baseUrl = process.env.LISTMONK_URL;
  const apiUser = process.env.LISTMONK_API_USER;
  const apiToken = process.env.LISTMONK_API_TOKEN;
  const templateId = Number(process.env.LISTMONK_TEMPLATE_PEDIDO_ENVIADO);
  if (!baseUrl || !apiUser || !apiToken || !Number.isInteger(templateId) || templateId <= 0) return null;
  return { baseUrl, apiUser, apiToken, templateId, siteUrl: process.env.AZPETSHOP_SITE_URL || "https://www.azpetshop.com.br" };
}
