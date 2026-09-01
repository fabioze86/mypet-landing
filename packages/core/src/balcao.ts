/**
 * Balcão de Negócios — funções puras de cálculo.
 *
 * O preço-base vem do mesmo caminho do catálogo (espelho Bling para mypetbrasil).
 * As faixas são percentuais sobre esse preço, avaliadas POR SKU. O desconto
 * logístico é fixo e mora só aqui, nunca no banco.
 */

import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";

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
