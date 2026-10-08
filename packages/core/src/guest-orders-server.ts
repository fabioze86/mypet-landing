import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHubServiceClient } from "./supabase";
import { createServerSupabaseClient } from "./supabase-server";
import { salePriceFromChannelPrices, type RawChannelPrice } from "./catalog-utils";
import type { Channel } from "./channels";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LINES = 200;
const MAX_QTY = 9999;
const ORDER_ERROR = "Não foi possível registrar seu pedido. Tente novamente em instantes.";

type GuestOrderLine = { id: string; qty: number };
type GuestCustomer = { nome: string; empresa: string; whatsapp: string; cnpj: string | null };
type GuestOrder = { items: GuestOrderLine[]; customer: GuestCustomer };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseGuestOrder(body: unknown): { ok: true; value: GuestOrder } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Pedido inválido." };
  const { items, customer } = body as { items?: unknown; customer?: Record<string, unknown> };

  const nome = text(customer?.nome);
  const empresa = text(customer?.empresa);
  const whatsapp = text(customer?.whatsapp);
  if (!nome || !empresa || !whatsapp) {
    return { ok: false, error: "Preencha nome, empresa e WhatsApp." };
  }

  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "O carrinho está vazio." };
  if (items.length > MAX_LINES) return { ok: false, error: "O pedido tem itens demais." };

  const qtyById = new Map<string, number>();
  for (const raw of items) {
    const id = text((raw as { id?: unknown })?.id);
    const qty = (raw as { qty?: unknown })?.qty;
    if (!UUID_RE.test(id) || typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return { ok: false, error: "Há um item inválido no carrinho." };
    }
    qtyById.set(id, (qtyById.get(id) ?? 0) + qty);
  }

  return {
    ok: true,
    value: {
      items: [...qtyById].map(([id, qty]) => ({ id, qty })),
      customer: { nome, empresa, whatsapp, cnpj: text(customer?.cnpj) || null },
    },
  };
}

type PricedProduct = { name: string; unitPrice: number | null };
type RawPricedRow = { id: string; name: string; product_channel_prices: RawChannelPrice[] | null };

async function getPricedProducts(
  supabase: SupabaseClient,
  ids: string[],
  channel: string,
): Promise<Map<string, PricedProduct> | null> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, product_channel_prices(channel, sale_price, sale_updated_at), product_channel_links!inner(channel)")
    .in("id", ids)
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel);

  if (error || !data) {
    console.error("[guest-orders] erro ao buscar preços:", error?.message);
    return null;
  }

  return new Map(
    (data as unknown as RawPricedRow[]).map((row) => [
      row.id,
      { name: row.name, unitPrice: salePriceFromChannelPrices(row.product_channel_prices) },
    ]),
  );
}

// Só liga o pedido ao buyer quando há sessão E cadastro em `buyers`
// (orders.buyer_id tem FK para buyers.id).
async function currentBuyerId(): Promise<string | null> {
  try {
    const auth = await createServerSupabaseClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return null;
    const { data: buyer } = await auth.from("buyers").select("id").eq("id", user.id).maybeSingle();
    return buyer ? user.id : null;
  } catch {
    return null;
  }
}

export function createOrdersPostHandler(opts: { orderChannel: Channel; priceChannel: string }) {
  return async function POST(req: NextRequest): Promise<Response> {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Pedido inválido." }, { status: 400 });
    }

    const parsed = parseGuestOrder(body);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    const { items, customer } = parsed.value;

    const supabase = getHubServiceClient();
    const priced = await getPricedProducts(supabase, items.map((item) => item.id), opts.priceChannel);
    if (!priced) return Response.json({ error: ORDER_ERROR }, { status: 500 });

    if (items.some((item) => !priced.has(item.id))) {
      return Response.json(
        { error: "Um dos produtos não está mais disponível. Remova-o do carrinho e tente novamente." },
        { status: 400 },
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        buyer_id: await currentBuyerId(),
        channel: opts.orderChannel,
        status: "pendente",
        customer_name: customer.nome,
        customer_company: customer.empresa,
        customer_whatsapp: customer.whatsapp,
        customer_cnpj: customer.cnpj,
      })
      .select("id, number")
      .single();

    if (orderError || !order) {
      console.error("[guest-orders] erro ao criar pedido:", orderError?.message);
      return Response.json({ error: ORDER_ERROR }, { status: 500 });
    }

    const lines = items.map((item) => {
      const product = priced.get(item.id) as PricedProduct;
      return { ...item, name: product.name, unitPrice: product.unitPrice };
    });

    const { error: itemsError } = await supabase.from("order_items").insert(
      lines.map((line) => ({
        order_id: order.id,
        product_id: line.id,
        product_name_snapshot: line.name,
        qty: line.qty,
        unit_price: line.unitPrice,
      })),
    );

    if (itemsError) {
      console.error("[guest-orders] erro ao gravar itens:", itemsError.message);
      await supabase.from("orders").delete().eq("id", order.id);
      return Response.json({ error: ORDER_ERROR }, { status: 500 });
    }

    const total = lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.qty, 0);
    return Response.json({
      number: Number(order.number),
      items: lines.map((line) => ({ id: line.id, unitPrice: line.unitPrice })),
      total: Math.round(total * 100) / 100,
    });
  };
}
