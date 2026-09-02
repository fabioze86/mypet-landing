import { computeLine, resolveTier, type BalcaoTier } from "@mypet/core/balcao-calc";

export function parseTiersInput(
  raw: { minQty: unknown; discountPct: unknown }[],
): { tiers: BalcaoTier[] } | { error: string } {
  const tiers: BalcaoTier[] = [];
  for (const row of raw) {
    const minQty = Number(row.minQty);
    const discountPct = Number(row.discountPct);
    if (!Number.isInteger(minQty) || minQty < 1) {
      return { error: "A quantidade mínima de cada faixa precisa ser um inteiro ≥ 1." };
    }
    if (!Number.isFinite(discountPct) || discountPct < 0) {
      return { error: "O desconto de cada faixa precisa ser zero ou positivo." };
    }
    tiers.push({ minQty, discountPct });
  }
  const seen = new Set<number>();
  for (const t of tiers) {
    if (seen.has(t.minQty)) return { error: "Há faixas com a mesma quantidade mínima." };
    seen.add(t.minQty);
  }
  tiers.sort((a, b) => a.minQty - b.minQty);
  return { tiers };
}

export function previewUnitPrice(
  basePrice: number,
  tiers: BalcaoTier[],
  qty: number,
): {
  tierMinQty: number | null;
  volumePct: number;
  unitPriceWithLogistics: number;
  unitPriceNoLogistics: number;
} {
  const tier = resolveTier(tiers, qty);
  const volumePct = tier?.discountPct ?? 0;
  return {
    tierMinQty: tier?.minQty ?? null,
    volumePct,
    unitPriceWithLogistics: computeLine({ basePrice, volumePct, logisticsApplies: true }).unitPrice,
    unitPriceNoLogistics: computeLine({ basePrice, volumePct, logisticsApplies: false }).unitPrice,
  };
}
