import { describe, it, expect } from "vitest";
import { variantLabel, hasAxisData } from "./variant-selector";
import type { ProductVariant } from "../catalog-utils";

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: "v1",
    name: "Vestido Chic Tule Rosa P",
    sku: "23988",
    barcode: null,
    img: "/img.jpg",
    axis: [],
    salePrice: 41.99,
    priceLabel: "R$ 41,99",
    ...overrides,
  };
}

describe("variantLabel", () => {
  it("usa o valor do eixo quando axis está preenchido", () => {
    const variant = makeVariant({ axis: [{ eixo: "Tamanho", valor: "M", ordem: 1 }] });
    expect(variantLabel(variant)).toBe("M");
  });

  it("cai para o nome do produto quando axis está vazio", () => {
    const variant = makeVariant({ axis: [] });
    expect(variantLabel(variant)).toBe("Vestido Chic Tule Rosa P");
  });
});

describe("hasAxisData", () => {
  it("retorna true quando pelo menos uma variante tem axis preenchido", () => {
    const variants = [
      makeVariant({ axis: [] }),
      makeVariant({ id: "v2", axis: [{ eixo: "Tamanho", valor: "G" }] }),
    ];
    expect(hasAxisData(variants)).toBe(true);
  });

  it("retorna false quando nenhuma variante tem axis preenchido", () => {
    const variants = [makeVariant({ axis: [] }), makeVariant({ id: "v2", axis: [] })];
    expect(hasAxisData(variants)).toBe(false);
  });

  it("retorna false para lista vazia", () => {
    expect(hasAxisData([])).toBe(false);
  });
});
