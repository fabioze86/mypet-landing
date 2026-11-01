import { describe, expect, it } from "vitest";
import { formatBRL } from "./catalog-utils";
import { hasSellablePrice, inStockFromQty, installmentLabel, installmentPlan } from "./retail";

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

describe("installmentPlan — guardas de configuração", () => {
  it("max < 2 não parcela", () => {
    expect(installmentPlan(500, { max: 1, minInstallment: 30 })).toBeNull();
  });

  it("preço exatamente 2x a parcela mínima dá 2 parcelas", () => {
    expect(installmentPlan(60, cfg)).toEqual({ count: 2, value: 30 });
  });

  it("preço negativo não parcela", () => {
    expect(installmentPlan(-100, cfg)).toBeNull();
  });

  it("parcela mínima zero (ou inválida) não parcela", () => {
    expect(installmentPlan(100, { max: 6, minInstallment: 0 })).toBeNull();
    expect(installmentPlan(100, { max: 6, minInstallment: Number.NaN })).toBeNull();
  });
});

describe("hasSellablePrice", () => {
  it("só vale número finito maior que zero", () => {
    expect(hasSellablePrice(10)).toBe(true);
    expect(hasSellablePrice(0.01)).toBe(true);
    expect(hasSellablePrice(0)).toBe(false);
    expect(hasSellablePrice(-1)).toBe(false);
    expect(hasSellablePrice(null)).toBe(false);
    expect(hasSellablePrice(undefined)).toBe(false);
    expect(hasSellablePrice(Number.NaN)).toBe(false);
    expect(hasSellablePrice(Number.POSITIVE_INFINITY)).toBe(false);
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
