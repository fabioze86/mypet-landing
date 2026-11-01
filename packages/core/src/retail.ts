import { formatBRL } from "./catalog-utils";

export type RetailConfig = {
  /** Parcelamento sem juros exibido em card/PDP: até `max` parcelas, nenhuma abaixo de `minInstallment` (R$). */
  installments: { max: number; minInstallment: number };
  /** Número (só dígitos, com DDI) para "Consultar preço" / produto esgotado. */
  consultWhatsApp: string;
};

export function installmentPlan(
  price: number,
  cfg: RetailConfig["installments"],
): { count: number; value: number } | null {
  if (!Number.isFinite(price) || price <= 0) return null;
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
