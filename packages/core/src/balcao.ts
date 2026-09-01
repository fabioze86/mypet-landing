/**
 * Balcão de Negócios — funções puras de cálculo.
 *
 * O preço-base vem do mesmo caminho do catálogo (espelho Bling para mypetbrasil).
 * As faixas são percentuais sobre esse preço, avaliadas POR SKU. O desconto
 * logístico é fixo e mora só aqui, nunca no banco.
 */

import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import { channelUsesErpPrice, mainImage } from "./catalog-utils";

export const LOGISTICS_DISCOUNT_PCT = 5;

export type BalcaoLogistics = "retirada" | "frete_proprio";
export type BalcaoRuleScope = "categoria" | "sku";

export type BalcaoTier = { minQty: number; discountPct: number };

export type BalcaoRule = {
  id: string;
  scope: BalcaoRuleScope;
  categoryId: string | null;
  productReference: string | null;
  excluded: boolean;
  /** Ordenadas asc por minQty. */
  tiers: BalcaoTier[];
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Precedência: regra scope='sku' com productReference igual → regra
 * scope='categoria' com categoryId igual → null. Uma regra de SKU com
 * excluded=true devolve null (produto tirado de uma categoria habilitada).
 */
export function resolveRuleForProduct(
  rules: BalcaoRule[],
  target: { productReference: string | null; categoryId: string | null },
): BalcaoRule | null {
  if (target.productReference) {
    const skuRule = rules.find(
      (r) => r.scope === "sku" && r.productReference === target.productReference,
    );
    if (skuRule) return skuRule.excluded ? null : skuRule;
  }
  if (target.categoryId) {
    const catRule = rules.find(
      (r) => r.scope === "categoria" && r.categoryId === target.categoryId,
    );
    if (catRule) return catRule;
  }
  return null;
}

/** Maior faixa com minQty <= qty; null se qty abaixo da menor faixa. */
export function resolveTier(tiers: BalcaoTier[], qty: number): BalcaoTier | null {
  let match: BalcaoTier | null = null;
  for (const tier of tiers) {
    if (qty >= tier.minQty && (match === null || tier.minQty > match.minQty)) {
      match = tier;
    }
  }
  return match;
}

/** Cascata multiplicativa, arredondada a centavos. */
export function computeLine(input: {
  basePrice: number;
  volumePct: number;
  logisticsApplies: boolean;
}): { unitPrice: number; volumePct: number; logisticsPct: number } {
  const logisticsPct = input.logisticsApplies ? LOGISTICS_DISCOUNT_PCT : 0;
  const unitPrice = round2(
    input.basePrice * (1 - input.volumePct / 100) * (1 - logisticsPct / 100),
  );
  return { unitPrice, volumePct: input.volumePct, logisticsPct };
}

/** Piso de envio: ao menos uma linha precisa atingir uma faixa. */
export function qualifiesForSubmit(lines: { tier: BalcaoTier | null }[]): boolean {
  return lines.some((l) => l.tier !== null);
}

type RawTier = { min_qty: number; discount_pct: number | string };
type RawRule = {
  id: string;
  scope: BalcaoRuleScope;
  category_id: string | null;
  product_reference: string | null;
  excluded: boolean;
  balcao_rule_tiers: RawTier[] | null;
};

export function isRuleLiveAt(
  row: { active: boolean; starts_at: string | null; ends_at: string | null },
  now: Date,
): boolean {
  if (!row.active) return false;
  if (row.starts_at && new Date(row.starts_at) > now) return false;
  if (row.ends_at && new Date(row.ends_at) < now) return false;
  return true;
}

export function mapRulesFromRows(rows: RawRule[]): BalcaoRule[] {
  return rows.map((row) => ({
    id: row.id,
    scope: row.scope,
    categoryId: row.category_id,
    productReference: row.product_reference,
    excluded: row.excluded,
    tiers: (row.balcao_rule_tiers ?? [])
      .map((t) => ({ minQty: t.min_qty, discountPct: Number(t.discount_pct) }))
      .sort((a, b) => a.minQty - b.minQty),
  }));
}

export async function getBalcaoRules(channel: string): Promise<BalcaoRule[]> {
  "use cache";
  cacheLife("days");
  cacheTag("balcao");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("balcao_rules")
    .select(
      "id, scope, category_id, product_reference, excluded, active, starts_at, ends_at, balcao_rule_tiers(min_qty, discount_pct)",
    )
    .eq("channel", channel);

  if (error) {
    console.error("[balcao] erro ao consultar regras:", error.message);
    return [];
  }

  const now = new Date();
  const live = ((data as unknown as (RawRule & { active: boolean; starts_at: string | null; ends_at: string | null })[]) ?? [])
    .filter((row) => isRuleLiveAt(row, now));
  return mapRulesFromRows(live);
}

export type BalcaoEligibleProduct = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  categoryId: string | null;
  basePrice: number;
  rule: BalcaoRule;
};

export type EstimateSelection = { productId: string; qty: number };

export type EstimateLine = {
  product: BalcaoEligibleProduct;
  qty: number;
  tier: BalcaoTier | null;
  volumePct: number;
  logisticsPct: number;
  unitPrice: number;
  lineTotal: number;
};

export function buildEstimate(input: {
  products: BalcaoEligibleProduct[];
  selections: EstimateSelection[];
  logistics: BalcaoLogistics;
}): { lines: EstimateLine[]; totalEstimated: number; qualifies: boolean } {
  const byId = new Map(input.products.map((p) => [p.id, p]));
  const lines: EstimateLine[] = [];

  for (const sel of input.selections) {
    const product = byId.get(sel.productId);
    if (!product || sel.qty < 1) continue;

    const tier = resolveTier(product.rule.tiers, sel.qty);
    const { unitPrice, volumePct, logisticsPct } = computeLine({
      basePrice: product.basePrice,
      volumePct: tier?.discountPct ?? 0,
      logisticsApplies: true, // no MVP sempre há retirada ou frete próprio
    });

    lines.push({
      product,
      qty: sel.qty,
      tier,
      volumePct,
      logisticsPct,
      unitPrice,
      lineTotal: round2(unitPrice * sel.qty),
    });
  }

  const totalEstimated = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  return { lines, totalEstimated, qualifies: qualifiesForSubmit(lines) };
}

type RawEligibleRow = {
  id: string;
  name: string;
  reference: string | null;
  brand: string | null;
  category_id: string | null;
  product_assets: { url: string; type: string }[] | null;
  product_channel_prices: { sale_price: number | string | null }[] | null;
};

export async function getBalcaoEligibleProducts(
  channel: string,
): Promise<BalcaoEligibleProduct[]> {
  "use cache";
  cacheLife("days");
  cacheTag("balcao");

  const rules = await getBalcaoRules(channel);
  const categoryIds = [
    ...new Set(rules.filter((r) => r.scope === "categoria").map((r) => r.categoryId!)),
  ];
  const skuRefs = [
    ...new Set(
      rules
        .filter((r) => r.scope === "sku" && !r.excluded)
        .map((r) => r.productReference!),
    ),
  ];
  if (categoryIds.length === 0 && skuRefs.length === 0) return [];

  const supabase = getHubClient();
  const orParts: string[] = [];
  if (categoryIds.length > 0) orParts.push(`category_id.in.(${categoryIds.join(",")})`);
  if (skuRefs.length > 0) {
    orParts.push(`reference.in.(${skuRefs.map((r) => `"${r}"`).join(",")})`);
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, reference, brand, category_id, product_assets(url, type), product_channel_prices(sale_price), product_channel_links!inner(channel)",
    )
    .eq("status", "active")
    .neq("product_role", "variant")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel)
    .or(orParts.join(","))
    .order("name", { ascending: true });

  if (error) {
    console.error("[balcao] erro ao consultar produtos elegíveis:", error.message);
    return [];
  }

  const rows = (data as unknown as RawEligibleRow[]) ?? [];

  // Preço-base: espelho Bling para canais ERP, senão product_channel_prices.
  const priceByRef = new Map<string, number>();
  if (channelUsesErpPrice(channel)) {
    const refs = [...new Set(rows.map((r) => r.reference).filter((r): r is string => !!r))];
    if (refs.length > 0) {
      const { data: erp, error: erpErr } = await supabase
        .from("v_precos_erp")
        .select("reference, preco")
        .in("reference", refs);
      if (erpErr) {
        console.error("[balcao] erro ao consultar preços do ERP:", erpErr.message);
      } else {
        for (const p of (erp as { reference: string | null; preco: number | string | null }[]) ?? []) {
          if (!p.reference || p.preco == null) continue;
          const v = Number(p.preco);
          if (Number.isFinite(v)) priceByRef.set(p.reference, v);
        }
      }
    }
  }

  const out: BalcaoEligibleProduct[] = [];
  for (const row of rows) {
    const rule = resolveRuleForProduct(rules, {
      productReference: row.reference,
      categoryId: row.category_id,
    });
    if (!rule) continue; // inclui o caso de SKU excluído

    let basePrice: number | null = null;
    if (channelUsesErpPrice(channel)) {
      basePrice = row.reference ? priceByRef.get(row.reference) ?? null : null;
    } else {
      const raw = row.product_channel_prices?.find((p) => p.sale_price != null)?.sale_price;
      basePrice = raw == null ? null : Number(raw);
    }
    if (basePrice == null || !Number.isFinite(basePrice)) continue;

    out.push({
      id: row.id,
      name: row.name,
      sku: row.reference ?? "",
      brand: row.brand,
      img: mainImage(row.product_assets),
      categoryId: row.category_id,
      basePrice,
      rule,
    });
  }
  return out;
}
