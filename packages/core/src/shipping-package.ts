export type ShippingPackage = { widthCm: number; heightCm: number; lengthCm: number; weightKg: number };

// Pacote PROVISÓRIO (fase 2): caixa única e peso estimado por unidade.
// A fase 4 troca por medidas do produto / padrão da categoria.
const CAIXA = { widthCm: 20, heightCm: 15, lengthCm: 30 };
const PESO_POR_UNIDADE_KG = 0.5;
const PESO_MINIMO_KG = 0.3;
const PESO_MAXIMO_KG = 30;

export function shippingPackageFor(lines: { qty: number }[]): ShippingPackage {
  const units = lines.reduce((total, line) => total + line.qty, 0);
  const weight = Math.min(PESO_MAXIMO_KG, Math.max(PESO_MINIMO_KG, units * PESO_POR_UNIDADE_KG));
  return { ...CAIXA, weightKg: Math.round(weight * 100) / 100 };
}
