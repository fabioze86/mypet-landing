/**
 * Balcão de Negócios — funções puras de cálculo.
 *
 * O preço-base vem do mesmo caminho do catálogo (espelho Bling para mypetbrasil).
 * As faixas são percentuais sobre esse preço, avaliadas POR SKU. O desconto
 * logístico é fixo e mora só aqui, nunca no banco.
 */

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
