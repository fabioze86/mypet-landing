import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RetailOrderView = {
  id: string;
  number: number;
  status: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  subtotal: number;
  shippingPrice: number;
  total: number;
  items: { name: string; qty: number; unitPrice: number }[];
  shipping: {
    cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string;
    serviceName: string; deliveryDays: number | null; trackingCode: string | null;
  } | null;
  paymentUrl: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SELECT =
  "id, number, status, created_at, access_token, customer_name, customer_email, customer_whatsapp, subtotal, shipping_price, total, " +
  "order_items(product_name_snapshot, qty, unit_price), " +
  "order_shipping(cep, logradouro, numero, complemento, bairro, cidade, uf, service_name, delivery_days, tracking_code), " +
  "order_payments(checkout_url)";

const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Com `token` (página pública do pedido) só devolve o pedido se o token bater; sem token, uso interno. */
export async function getRetailOrder(supabase: SupabaseClient, id: string, token?: string): Promise<RetailOrderView | null> {
  if (!UUID_RE.test(id)) return null;
  if (token !== undefined && !token) return null;
  const { data, error } = await supabase.from("orders").select(SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const r = data as unknown as Record<string, unknown> & { access_token: string | null };
  if (token !== undefined && (!r.access_token || !sameToken(r.access_token, token))) return null;

  const s = one(r.order_shipping as Record<string, unknown> | Record<string, unknown>[] | null);
  const p = one(r.order_payments as { checkout_url: string | null } | { checkout_url: string | null }[] | null);
  return {
    id: r.id as string,
    number: num(r.number),
    status: r.status as string,
    createdAt: r.created_at as string,
    customerName: (r.customer_name as string) ?? "",
    customerEmail: (r.customer_email as string) ?? "",
    customerWhatsapp: (r.customer_whatsapp as string) ?? "",
    subtotal: num(r.subtotal),
    shippingPrice: num(r.shipping_price),
    total: num(r.total),
    items: ((r.order_items as { product_name_snapshot: string; qty: number; unit_price: unknown }[]) ?? []).map((i) => ({
      name: i.product_name_snapshot,
      qty: i.qty,
      unitPrice: num(i.unit_price),
    })),
    shipping: s
      ? {
          cep: s.cep as string, logradouro: s.logradouro as string, numero: s.numero as string,
          complemento: (s.complemento as string | null) ?? null, bairro: s.bairro as string, cidade: s.cidade as string,
          uf: s.uf as string, serviceName: s.service_name as string,
          deliveryDays: (s.delivery_days as number | null) ?? null, trackingCode: (s.tracking_code as string | null) ?? null,
        }
      : null,
    paymentUrl: p?.checkout_url ?? null,
  };
}
