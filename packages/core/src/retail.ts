import { formatBRL } from "./catalog-utils";

export type RetailConfig = {
  /** Parcelamento sem juros exibido em card/PDP: até `max` parcelas, nenhuma abaixo de `minInstallment` (R$). */
  installments: { max: number; minInstallment: number };
  /** Número (só dígitos, com DDI) para "Consultar preço" / produto esgotado. */
  consultWhatsApp: string;
};

/** Regra única de "tem preço de venda": número finito maior que zero. */
export function hasSellablePrice(price: number | null | undefined): price is number {
  return typeof price === "number" && Number.isFinite(price) && price > 0;
}

export function installmentPlan(
  price: number,
  cfg: RetailConfig["installments"],
): { count: number; value: number } | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  if (cfg.max < 2 || !(cfg.minInstallment > 0)) return null;
  const count = Math.min(cfg.max, Math.floor(price / cfg.minInstallment));
  if (count < 2) return null;
  return { count, value: Math.round((price / count) * 100) / 100 };
}

export function installmentLabel(price: number | null, cfg: RetailConfig["installments"]): string | null {
  if (price === null) return null;
  const plan = installmentPlan(price, cfg);
  if (!plan) return null;
  return `ou até ${plan.count}x de ${formatBRL(plan.value)} sem juros`;
}

/**
 * Disponibilidade a partir do estoque, na mesma regra do feed e do JSON-LD (`(qty ?? 0) > 0`).
 * `undefined` = campo não buscado (desconhecido, tratado como disponível); `null` = sem estoque.
 */
export function inStockFromQty(qty: number | null | undefined): boolean | undefined {
  if (qty === undefined) return undefined;
  return (qty ?? 0) > 0;
}
