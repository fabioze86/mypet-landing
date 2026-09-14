/**
 * Ofertas — fetches cacheados de campanhas do hotsite de Instagram.
 *
 * Os tipos e o cálculo de desconto/vigência vivem em `./offers-calc`
 * (client-safe, sem `next/cache`) e são reexportados aqui para preservar a
 * API pública `@mypet/core/offers`. Este módulo importa `next/cache` e o
 * cliente Supabase, então NÃO pode ser importado por um Client Component —
 * use `@mypet/core/offers-calc` nesses casos.
 */

import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import { channelUsesErpPrice, mainImage } from "./catalog-utils";
import {
  buildOfferCampaign,
  type OfferCampaign,
  type RawOfferCampaignRow,
  type ResolvedProductInfo,
} from "./offers-calc";

export * from "./offers-calc";

const OFFER_CAMPAIGN_SELECT =
  "id, channel, slug, title, subtitle, badge, coupon_code, coupon_description, coupon_discount_pct, coupon_valid_until, freight_message, primary_cta_label, secondary_cta_label, hero_priority, flash_offer, active, starts_at, ends_at, offer_campaign_items(id, product_id, promotional_price, min_quantity, sort_order)";

async function resolveProducts(channel: string, productIds: string[]): Promise<Map<string, ResolvedProductInfo>> {
  const map = new Map<string, ResolvedProductInfo>();
  if (productIds.length === 0) return map;

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("v_produtos_resolvidos")
    .select("id, name, reference, description, product_assets(url, type), product_channel_links!inner(channel)")
    .in("id", productIds)
    .eq("status", "active")
    .eq("product_channel_links.channel", channel);

  if (error) {
    console.error("[offers] erro ao resolver produtos:", error.message);
    return map;
  }

  for (const row of (data as {
    id: string;
    name: string;
    reference: string | null;
    description: string | null;
    product_assets: { url: string; type: string }[] | null;
  }[]) ?? []) {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      reference: row.reference,
      description: row.description,
      img: mainImage(row.product_assets),
    });
  }
  return map;
}

async function resolveRealPrices(
  channel: string,
  productIds: string[],
  productById: Map<string, ResolvedProductInfo>,
): Promise<Map<string, number>> {
  const priceByProductId = new Map<string, number>();
  if (productIds.length === 0) return priceByProductId;

  const supabase = getHubClient();

  if (channelUsesErpPrice(channel)) {
    const refByProductId = new Map<string, string>();
    for (const id of productIds) {
      const ref = productById.get(id)?.reference;
      if (ref) refByProductId.set(id, ref);
    }
    const refs = [...new Set(refByProductId.values())];
    if (refs.length === 0) return priceByProductId;

    const { data, error } = await supabase.from("v_precos_erp").select("reference, preco").in("reference", refs);
    if (error) {
      console.error("[offers] erro ao consultar preços do ERP:", error.message);
      return priceByProductId;
    }
    const priceByRef = new Map<string, number>();
    for (const p of (data as { reference: string | null; preco: number | string | null }[]) ?? []) {
      if (!p.reference || p.preco == null) continue;
      const v = Number(p.preco);
      if (Number.isFinite(v)) priceByRef.set(p.reference, v);
    }
    for (const [productId, ref] of refByProductId) {
      const v = priceByRef.get(ref);
      if (v != null) priceByProductId.set(productId, v);
    }
    return priceByProductId;
  }

  const { data, error } = await supabase
    .from("product_channel_prices")
    .select("product_id, sale_price")
    .eq("channel", channel)
    .in("product_id", productIds);
  if (error) {
    console.error("[offers] erro ao consultar preços do canal:", error.message);
    return priceByProductId;
  }
  for (const row of (data as { product_id: string; sale_price: number | string | null }[]) ?? []) {
    if (row.sale_price == null) continue;
    const v = Number(row.sale_price);
    if (Number.isFinite(v)) priceByProductId.set(row.product_id, v);
  }
  return priceByProductId;
}

/**
 * Parte comum a `getActiveCampaigns`/`getCampaignBySlug`: a partir das linhas
 * cruas já filtradas no banco, resolve produtos/preços reais e monta as
 * campanhas. Extraída para não duplicar essa lógica entre as duas queries
 * (que usam filtros `.eq()` diferentes e por isso não compartilham o builder).
 */
async function finishQuery(channel: string, rows: RawOfferCampaignRow[]): Promise<OfferCampaign[]> {
  const productIds = [...new Set(rows.flatMap((r) => (r.offer_campaign_items ?? []).map((i) => i.product_id)))];
  const productById = await resolveProducts(channel, productIds);
  const realPriceByProductId = await resolveRealPrices(channel, productIds, productById);

  const now = new Date();
  return rows
    .map((row) => buildOfferCampaign(row, productById, realPriceByProductId, now))
    .filter((c): c is OfferCampaign => c !== null);
}

export async function getActiveCampaigns(channel: string): Promise<OfferCampaign[]> {
  "use cache";
  // "hours": transições de starts_at/ends_at chegam ao site em até 1h, igual ao Balcão.
  cacheLife("hours");
  cacheTag("offers");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("offer_campaigns")
    .select(OFFER_CAMPAIGN_SELECT)
    .eq("channel", channel)
    .eq("active", true);

  if (error) {
    console.error("[offers] erro ao consultar campanhas ativas:", error.message);
    return [];
  }

  const rows = (data as unknown as RawOfferCampaignRow[]) ?? [];
  const campaigns = await finishQuery(channel, rows);
  return campaigns.filter((c) => c.status === "active").sort((a, b) => b.heroPriority - a.heroPriority);
}

export async function getCampaignBySlug(channel: string, slug: string): Promise<OfferCampaign | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("offers");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("offer_campaigns")
    .select(OFFER_CAMPAIGN_SELECT)
    .eq("channel", channel)
    .eq("slug", slug);

  if (error) {
    console.error("[offers] erro ao consultar campanha por slug:", error.message);
    return null;
  }

  const rows = (data as unknown as RawOfferCampaignRow[]) ?? [];
  const campaigns = await finishQuery(channel, rows);
  return campaigns[0] ?? null;
}
