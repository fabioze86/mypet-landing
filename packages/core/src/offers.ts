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
import { mainImage } from "./catalog-utils";
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
): Promise<Map<string, number>> {
  const priceByProductId = new Map<string, number>();
  if (productIds.length === 0) return priceByProductId;

  const supabase = getHubClient();

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
 *
 * Sub-consultas de produto/preço (`resolveProducts`/`resolveRealPrices`)
 * continuam best-effort: um erro nelas apenas exclui os itens sem preço
 * válido (regra de negócio já existente — campanha sem item válido nunca é
 * exibida com preço fictício), não é o mesmo tipo de falha que "não
 * conseguimos nem perguntar ao Hub se existe campanha".
 */
async function finishQuery(channel: string, rows: RawOfferCampaignRow[]): Promise<OfferCampaign[]> {
  const productIds = [...new Set(rows.flatMap((r) => (r.offer_campaign_items ?? []).map((i) => i.product_id)))];
  const productById = await resolveProducts(channel, productIds);
  const realPriceByProductId = await resolveRealPrices(channel, productIds);

  const now = new Date();
  return rows
    .map((row) => buildOfferCampaign(row, productById, realPriceByProductId, now))
    .filter((c): c is OfferCampaign => c !== null);
}

type CampaignRowsResult = { ok: true; rows: RawOfferCampaignRow[] } | { ok: false };

/**
 * Consulta principal a `offer_campaigns` — a única cujo erro sinaliza "o Hub
 * falhou de verdade" (distinto de "zero campanhas"), por isso é a única que
 * retorna um resultado tipado `{ ok }` em vez de engolir o erro num array
 * vazio.
 */
async function fetchActiveCampaignRows(channel: string): Promise<CampaignRowsResult> {
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("offer_campaigns")
    .select(OFFER_CAMPAIGN_SELECT)
    .eq("channel", channel)
    .eq("active", true);

  if (error) {
    console.error("[offers] erro ao consultar campanhas ativas:", error.message);
    return { ok: false };
  }
  return { ok: true, rows: (data as unknown as RawOfferCampaignRow[]) ?? [] };
}

async function fetchCampaignRowsBySlug(channel: string, slug: string): Promise<CampaignRowsResult> {
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("offer_campaigns")
    .select(OFFER_CAMPAIGN_SELECT)
    .eq("channel", channel)
    .eq("slug", slug);

  if (error) {
    console.error("[offers] erro ao consultar campanha por slug:", error.message);
    return { ok: false };
  }
  return { ok: true, rows: (data as unknown as RawOfferCampaignRow[]) ?? [] };
}

export async function getActiveCampaigns(channel: string): Promise<OfferCampaign[]> {
  "use cache";
  // "hours": transições de starts_at/ends_at chegam ao site em até 1h, igual ao Balcão.
  cacheLife("hours");
  cacheTag("offers");

  const result = await fetchActiveCampaignRows(channel);
  if (!result.ok) return [];

  const campaigns = await finishQuery(channel, result.rows);
  return campaigns.filter((c) => c.status === "active").sort((a, b) => b.heroPriority - a.heroPriority);
}

/**
 * Mesma consulta de `getActiveCampaigns`, mas distinguindo "consulta
 * principal falhou" (`{ ok: false }`) de "consulta funcionou e não há
 * campanha ativa" (`{ ok: true, campaigns: [] }`) — as duas situações eram
 * indistinguíveis antes (ambas viravam array vazio + `console.error`),
 * impedindo a página de mostrar um estado de erro real em vez de "nenhuma
 * oferta no momento".
 */
export async function getActiveCampaignsSafe(
  channel: string,
): Promise<{ ok: true; campaigns: OfferCampaign[] } | { ok: false }> {
  "use cache";
  cacheLife("hours");
  cacheTag("offers");

  const result = await fetchActiveCampaignRows(channel);
  if (!result.ok) return { ok: false };

  const campaigns = await finishQuery(channel, result.rows);
  return {
    ok: true,
    campaigns: campaigns.filter((c) => c.status === "active").sort((a, b) => b.heroPriority - a.heroPriority),
  };
}

export async function getCampaignBySlug(channel: string, slug: string): Promise<OfferCampaign | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("offers");

  const result = await fetchCampaignRowsBySlug(channel, slug);
  if (!result.ok) return null;

  const campaigns = await finishQuery(channel, result.rows);
  return campaigns[0] ?? null;
}

/** Ver nota de `getActiveCampaignsSafe` — mesma distinção de falha vs. vazio. */
export async function getCampaignBySlugSafe(
  channel: string,
  slug: string,
): Promise<{ ok: true; campaign: OfferCampaign | null } | { ok: false }> {
  "use cache";
  cacheLife("hours");
  cacheTag("offers");

  const result = await fetchCampaignRowsBySlug(channel, slug);
  if (!result.ok) return { ok: false };

  const campaigns = await finishQuery(channel, result.rows);
  return { ok: true, campaign: campaigns[0] ?? null };
}
