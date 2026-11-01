import { describe, expect, it } from "vitest";
import { formatBRL } from "./catalog-utils";
import { inStockFromQty, installmentLabel, installmentPlan } from "./retail";

const cfg = { max: 6, minInstallment: 30 };

describe("installmentPlan", () => {
  it("divide no maior número de parcelas que respeita a parcela mínima", () => {
    expect(installmentPlan(100, cfg)).toEqual({ count: 3, value: 33.33 });
  });

  it("limita ao máximo de parcelas", () => {
    expect(installmentPlan(1000, cfg)).toEqual({ count: 6, value: 166.67 });
  });

  it("retorna null quando não cabe nem 2 parcelas", () => {
    expect(installmentPlan(50, cfg)).toBeNull();
  });

  it("retorna null para preço inválido", () => {
    expect(installmentPlan(0, cfg)).toBeNull();
    expect(installmentPlan(Number.NaN, cfg)).toBeNull();
  });
});

describe("installmentLabel", () => {
  it("formata em reais", () => {
    expect(installmentLabel(100, cfg)).toBe(`ou até 3x de ${formatBRL(33.33)} sem juros`);
  });

  it("retorna null sem preço ou sem parcelamento possível", () => {
    expect(installmentLabel(null, cfg)).toBeNull();
    expect(installmentLabel(50, cfg)).toBeNull();
  });
});

describe("inStockFromQty", () => {
  it("undefined (campo não buscado) = desconhecido", () => {
    expect(inStockFromQty(undefined)).toBeUndefined();
  });

  it("null conta como esgotado (mesma regra do feed e do JSON-LD)", () => {
    expect(inStockFromQty(null)).toBe(false);
  });

  it("zero ou negativo esgotado; positivo disponível", () => {
    expect(inStockFromQty(0)).toBe(false);
    expect(inStockFromQty(-1)).toBe(false);
    expect(inStockFromQty(3)).toBe(true);
  });
});
