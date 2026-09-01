import { describe, it, expect } from "vitest";
import { parseTiersInput, previewUnitPrice } from "./balcao";

describe("parseTiersInput", () => {
  it("ordena por minQty e converte números", () => {
    const r = parseTiersInput([
      { minQty: "25", discountPct: "12" },
      { minQty: "10", discountPct: "8" },
    ]);
    expect(r).toEqual({ tiers: [{ minQty: 10, discountPct: 8 }, { minQty: 25, discountPct: 12 }] });
  });

  it("rejeita minQty repetido", () => {
    const r = parseTiersInput([
      { minQty: "10", discountPct: "8" },
      { minQty: "10", discountPct: "12" },
    ]);
    expect(r).toEqual({ error: "Há faixas com a mesma quantidade mínima." });
  });

  it("rejeita discountPct negativo", () => {
    const r = parseTiersInput([{ minQty: "10", discountPct: "-1" }]);
    expect(r).toEqual({ error: "O desconto de cada faixa precisa ser zero ou positivo." });
  });

  it("rejeita minQty < 1 ou não inteiro", () => {
    expect(parseTiersInput([{ minQty: "0", discountPct: "8" }])).toEqual({
      error: "A quantidade mínima de cada faixa precisa ser um inteiro ≥ 1.",
    });
    expect(parseTiersInput([{ minQty: "2.5", discountPct: "8" }])).toEqual({
      error: "A quantidade mínima de cada faixa precisa ser um inteiro ≥ 1.",
    });
  });
});

describe("previewUnitPrice", () => {
  it("aplica faixa + logística e também a versão sem logística", () => {
    const r = previewUnitPrice(100, [{ minQty: 10, discountPct: 12 }], 15);
    expect(r).toEqual({
      tierMinQty: 10,
      volumePct: 12,
      unitPriceWithLogistics: 83.6,
      unitPriceNoLogistics: 88,
    });
  });

  it("sem faixa devolve tierMinQty null", () => {
    const r = previewUnitPrice(100, [{ minQty: 10, discountPct: 12 }], 3);
    expect(r.tierMinQty).toBeNull();
    expect(r.volumePct).toBe(0);
  });
});
