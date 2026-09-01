/**
 * Balcão de Negócios — constantes, tipos e funções puras de cálculo.
 *
 * Client-safe: NÃO importa `next/cache` nem `./supabase`, então pode ser
 * consumido tanto por Server Components / server actions quanto por Client
 * Components (`apps/mypet/app/balcao/balcao-content.tsx`). Os fetches cacheados
 * (`getBalcaoRules`, `getBalcaoEligibleProducts`) ficam em `./balcao`, que
 * reexporta tudo daqui.
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
