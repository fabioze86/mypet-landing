import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAsaasCheckout, type AsaasConfig } from "./asaas";
import { salePriceFromChannelPrices, type RawChannelPrice } from "./catalog-utils";
import { quoteShipping, type MelhorEnvioConfig, type ShippingOption } from "./melhor-envio";
import { hasSellablePrice, inStockFromQty, installmentPlan, type RetailConfig } from "./retail";
import type { CheckoutInput, CheckoutLine } from "./retail-checkout";
import { shippingPackageFor } from "./shipping-package";

export type PricedLine = { id: string; name: string; qty: number; unitPrice: number };
export type CheckoutDeps = {
  supabase: SupabaseClient;
  channel: string;
  melhorEnvio: MelhorEnvioConfig;
  asaas: AsaasConfig;
  installments: RetailConfig["installments"];
  siteUrl: string;
  fetchFn?: typeof fetch;
  newToken?: () => string;
};

type RawRow = { id: string; name: string; stock_qty: number | null; product_channel_prices: RawChannelPrice[] | null };

const ERRO_PEDIDO = "Não foi possível registrar seu pedido. Tente novamente em instantes.";
// Validade da página de pagamento (o Pix gerado vale dentro dela).
const MINUTOS_PARA_PAGAR = 60;

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function priceCart(
  supabase: SupabaseClient,
  channel: string,
  lines: CheckoutLine[],
): Promise<{ ok: true; lines: PricedLine[]; subtotal: number } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, stock_qty, product_channel_prices(channel, sale_price, sale_updated_at), product_channel_links!inner(channel)")
    .in("id", lines.map((l) => l.id))
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel);
  if (error || !data) {
    console.error("[retail-checkout] erro ao buscar preços:", error?.message);
    return { ok: false, error: ERRO_PEDIDO };
  }
  const byId = new Map((data as unknown as RawRow[]).map((row) => [row.id, row]));

  const priced: PricedLine[] = [];
  for (const line of lines) {
    const row = byId.get(line.id);
    const price = row ? salePriceFromChannelPrices(row.product_channel_prices) : null;
    if (!row || !hasSellablePrice(price)) {
      return { ok: false, error: "Algum item do carrinho não está mais à venda. Revise o carrinho." };
    }
    if (inStockFromQty(row.stock_qty) === false) {
      return { ok: false, error: `${row.name} está esgotado. Remova do carrinho para continuar.` };
    }
    if (row.stock_qty !== null && line.qty > row.stock_qty) {
      return { ok: false, error: `Só temos ${row.stock_qty} unidade(s) de ${row.name} em estoque.` };
    }
    priced.push({ id: line.id, name: row.name, qty: line.qty, unitPrice: price });
  }
  return { ok: true, lines: priced, subtotal: round2(priced.reduce((t, l) => t + l.unitPrice * l.qty, 0)) };
}

async function priceAndQuote(
  deps: CheckoutDeps,
  input: { items: CheckoutLine[]; cep: string },
): Promise<{ ok: true; lines: PricedLine[]; subtotal: number; options: ShippingOption[] } | { ok: false; error: string }> {
  const cart = await priceCart(deps.supabase, deps.channel, input.items);
  if (!cart.ok) return cart;
  const quote = await quoteShipping(
    deps.melhorEnvio,
    { toCep: input.cep, pkg: shippingPackageFor(cart.lines), insuranceValue: cart.subtotal },
    deps.fetchFn,
  );
  if (!quote.ok) return quote;
  return { ok: true, lines: cart.lines, subtotal: cart.subtotal, options: quote.options };
}

export async function quoteCheckout(
  deps: CheckoutDeps,
  input: { items: CheckoutLine[]; cep: string },
): Promise<{ ok: true; subtotal: number; options: ShippingOption[] } | { ok: false; error: string }> {
  const r = await priceAndQuote(deps, input);
  return r.ok ? { ok: true, subtotal: r.subtotal, options: r.options } : r;
}

export async function startCheckout(
  deps: CheckoutDeps,
  input: CheckoutInput,
): Promise<{ ok: true; orderId: string; paymentUrl: string } | { ok: false; error: string }> {
  // Preço e frete são sempre recalculados aqui: nada do navegador é confiável.
  const cart = await priceAndQuote(deps, { items: input.items, cep: input.address.cep });
  if (!cart.ok) return cart;
  const shipping = cart.options.find((o) => o.serviceId === input.shippingServiceId);
  if (!shipping) return { ok: false, error: "A opção de frete escolhida não está mais disponível. Escolha de novo." };

  const total = round2(cart.subtotal + shipping.price);
  const token = (deps.newToken ?? (() => randomBytes(24).toString("hex")))();
  const { supabase } = deps;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      channel: deps.channel,
      status: "aguardando_pagamento",
      customer_name: input.customer.nome,
      customer_cpf: input.customer.cpf,
      customer_email: input.customer.email,
      customer_whatsapp: input.customer.whatsapp,
      subtotal: cart.subtotal,
      shipping_price: shipping.price,
      total,
      access_token: token,
    })
    .select("id, number")
    .single();
  if (orderError || !order) {
    console.error("[retail-checkout] pedido não gravado:", orderError?.message);
    return { ok: false, error: ERRO_PEDIDO };
  }
  const { id: orderId, number } = order as { id: string; number: number };

  const rollback = async () => {
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) console.error("[retail-checkout] rollback falhou:", error.message);
  };

  const { error: itemsError } = await supabase.from("order_items").insert(
    cart.lines.map((l) => ({ order_id: orderId, product_id: l.id, product_name_snapshot: l.name, qty: l.qty, unit_price: l.unitPrice })),
  );
  if (itemsError) {
    console.error("[retail-checkout] itens não gravados:", itemsError.message);
    await rollback();
    return { ok: false, error: ERRO_PEDIDO };
  }

  const { error: shippingError } = await supabase.from("order_shipping").insert({
    order_id: orderId,
    ...input.address,
    service_id: shipping.serviceId,
    service_name: `${shipping.company} ${shipping.name}`.trim(),
    price: shipping.price,
    delivery_days: shipping.deliveryDays,
  });
  if (shippingError) {
    console.error("[retail-checkout] entrega não gravada:", shippingError.message);
    await rollback();
    return { ok: false, error: ERRO_PEDIDO };
  }

  const orderUrl = `${deps.siteUrl}/pedido/${orderId}?t=${token}`;
  const checkout = await createAsaasCheckout(
    deps.asaas,
    {
      orderNumber: number,
      total,
      maxInstallments: installmentPlan(total, deps.installments)?.count ?? 1,
      customer: input.customer,
      successUrl: orderUrl,
      cancelUrl: `${deps.siteUrl}/checkout`,
      expiredUrl: orderUrl,
      minutesToExpire: MINUTOS_PARA_PAGAR,
    },
    deps.fetchFn,
  );
  if (!checkout.ok) return checkout; // pedido fica "aguardando_pagamento" sem cobrança; expira sem efeito

  const { error: paymentError } = await supabase.from("order_payments").insert({
    order_id: orderId,
    asaas_checkout_id: checkout.checkoutId,
    checkout_url: checkout.link,
    amount: total,
  });
  if (paymentError) {
    // Sem esse registro o webhook não acha o pedido: não manda o cliente pagar.
    console.error("[retail-checkout] pagamento não gravado:", paymentError.message);
    return { ok: false, error: ERRO_PEDIDO };
  }

  return { ok: true, orderId, paymentUrl: checkout.link };
}
