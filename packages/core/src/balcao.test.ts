import { describe, it, expect, vi } from "vitest";
import {
  LOGISTICS_DISCOUNT_PCT,
  round2,
  resolveRuleForProduct,
  resolveTier,
  computeLine,
  qualifiesForSubmit,
  type BalcaoRule,
  mapRulesFromRows,
  isRuleLiveAt,
  buildEstimate,
  type BalcaoEligibleProduct,
} from "./balcao";

const catRule: BalcaoRule = {
  id: "r-cat",
  scope: "categoria",
  categoryId: "cat-1",
  productReference: null,
  excluded: false,
  tiers: [
    { minQty: 10, discountPct: 8 },
    { minQty: 25, discountPct: 12 },
    { minQty: 50, discountPct: 18 },
  ],
};

const skuRule: BalcaoRule = {
  id: "r-sku",
  scope: "sku",
  categoryId: null,
  productReference: "SKU-A",
  excluded: false,
  tiers: [{ minQty: 5, discountPct: 20 }],
};

const skuExcluded: BalcaoRule = {
  id: "r-x",
  scope: "sku",
  categoryId: null,
  productReference: "SKU-B",
  excluded: true,
  tiers: [],
};

describe("round2", () => {
  it("arredonda a centavos", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
    expect(round2(3.3333)).toBe(3.33);
  });
});

describe("resolveRuleForProduct", () => {
  it("regra de SKU vence a de categoria do mesmo produto", () => {
    const r = resolveRuleForProduct([catRule, skuRule], {
      productReference: "SKU-A",
      categoryId: "cat-1",
    });
    expect(r?.id).toBe("r-sku");
  });

  it("cai na regra de categoria quando não há regra de SKU", () => {
    const r = resolveRuleForProduct([catRule, skuRule], {
      productReference: "SKU-Z",
      categoryId: "cat-1",
    });
    expect(r?.id).toBe("r-cat");
  });

  it("SKU excluído devolve null mesmo com categoria habilitada", () => {
    const r = resolveRuleForProduct([catRule, skuExcluded], {
      productReference: "SKU-B",
      categoryId: "cat-1",
    });
    expect(r).toBeNull();
  });

  it("devolve null quando nada casa", () => {
    const r = resolveRuleForProduct([catRule], {
      productReference: "SKU-Q",
      categoryId: "cat-9",
    });
    expect(r).toBeNull();
  });
});

describe("resolveTier", () => {
  it("pega a maior faixa com minQty <= qty", () => {
    expect(resolveTier(catRule.tiers, 30)?.minQty).toBe(25);
    expect(resolveTier(catRule.tiers, 25)?.minQty).toBe(25);
    expect(resolveTier(catRule.tiers, 1000)?.minQty).toBe(50);
  });

  it("devolve null abaixo da menor faixa", () => {
    expect(resolveTier(catRule.tiers, 9)).toBeNull();
  });

  it("devolve null quando não há faixas", () => {
    expect(resolveTier([], 100)).toBeNull();
  });
});

describe("computeLine", () => {
  it("aplica volume e logístico em cascata, arredondado a centavos", () => {
    const r = computeLine({ basePrice: 100, volumePct: 12, logisticsApplies: true });
    // 100 * 0.88 * 0.95 = 83.6
    expect(r.unitPrice).toBe(83.6);
    expect(r.volumePct).toBe(12);
    expect(r.logisticsPct).toBe(LOGISTICS_DISCOUNT_PCT);
  });

  it("ignora os 5% quando logisticsApplies é false", () => {
    const r = computeLine({ basePrice: 100, volumePct: 12, logisticsApplies: false });
    expect(r.unitPrice).toBe(88);
    expect(r.logisticsPct).toBe(0);
  });

  it("sem faixa (volumePct 0) só aplica o logístico", () => {
    const r = computeLine({ basePrice: 50, volumePct: 0, logisticsApplies: true });
    expect(r.unitPrice).toBe(47.5);
  });
});

describe("qualifiesForSubmit", () => {
  it("false quando nenhuma linha atinge faixa", () => {
    expect(qualifiesForSubmit([{ tier: null }, { tier: null }])).toBe(false);
  });

  it("true quando ao menos uma linha atinge faixa", () => {
    expect(qualifiesForSubmit([{ tier: null }, { tier: { minQty: 10, discountPct: 8 } }])).toBe(true);
  });

  it("false para lista vazia", () => {
    expect(qualifiesForSubmit([])).toBe(false);
  });
});

describe("isRuleLiveAt", () => {
  const now = new Date("2026-08-30T12:00:00Z");
  it("true quando active e sem janela de vigência", () => {
    expect(isRuleLiveAt({ active: true, starts_at: null, ends_at: null }, now)).toBe(true);
  });
  it("false quando inactive", () => {
    expect(isRuleLiveAt({ active: false, starts_at: null, ends_at: null }, now)).toBe(false);
  });
  it("false antes de starts_at", () => {
    expect(
      isRuleLiveAt({ active: true, starts_at: "2026-09-01T00:00:00Z", ends_at: null }, now),
    ).toBe(false);
  });
  it("false depois de ends_at", () => {
    expect(
      isRuleLiveAt({ active: true, starts_at: null, ends_at: "2026-08-01T00:00:00Z" }, now),
    ).toBe(false);
  });
  it("true no limite exato de starts_at (boundary de início)", () => {
    expect(
      isRuleLiveAt({ active: true, starts_at: "2026-08-30T12:00:00Z", ends_at: null }, now),
    ).toBe(true);
  });
  it("true no limite exato de ends_at (boundary de fim)", () => {
    expect(
      isRuleLiveAt({ active: true, starts_at: null, ends_at: "2026-08-30T12:00:00Z" }, now),
    ).toBe(true);
  });
});

describe("mapRulesFromRows", () => {
  it("mapeia colunas snake_case e ordena as faixas asc", () => {
    const rules = mapRulesFromRows([
      {
        id: "r1",
        scope: "categoria",
        category_id: "c1",
        product_reference: null,
        excluded: false,
        balcao_rule_tiers: [
          { min_qty: 25, discount_pct: "12.00" },
          { min_qty: 10, discount_pct: "8" },
        ],
      },
    ]);
    expect(rules).toEqual([
      {
        id: "r1",
        scope: "categoria",
        categoryId: "c1",
        productReference: null,
        excluded: false,
        tiers: [
          { minQty: 10, discountPct: 8 },
          { minQty: 25, discountPct: 12 },
        ],
      },
    ]);
  });
});

const prodA: BalcaoEligibleProduct = {
  id: "pa",
  name: "Ração A 15kg",
  sku: "SKU-A",
  brand: "Marca",
  img: "/a.png",
  categoryId: "cat-1",
  basePrice: 100,
  rule: {
    id: "r1",
    scope: "categoria",
    categoryId: "cat-1",
    productReference: null,
    excluded: false,
    tiers: [
      { minQty: 10, discountPct: 10 },
      { minQty: 25, discountPct: 15 },
    ],
  },
};

const prodB: BalcaoEligibleProduct = {
  ...prodA,
  id: "pb",
  name: "Ração B 15kg",
  sku: "SKU-B",
  basePrice: 200,
};

describe("buildEstimate", () => {
  it("calcula cada linha por SKU com logística aplicada", () => {
    const r = buildEstimate({
      products: [prodA, prodB],
      selections: [
        { productId: "pa", qty: 12 },
        { productId: "pb", qty: 8 },
      ],
      logistics: "retirada",
    });

    // linha A: faixa 10 (10%) + 5% => 100 * 0.9 * 0.95 = 85.5, total 1026
    expect(r.lines[0]).toMatchObject({ qty: 12, volumePct: 10, logisticsPct: 5, unitPrice: 85.5, lineTotal: 1026 });
    // linha B: sem faixa (qty 8), só 5% => 200 * 0.95 = 190, total 1520
    expect(r.lines[1]).toMatchObject({ qty: 8, tier: null, volumePct: 0, unitPrice: 190, lineTotal: 1520 });
    expect(r.totalEstimated).toBe(2546);
    expect(r.qualifies).toBe(true);
  });

  it("qualifies false quando nenhuma linha atinge faixa", () => {
    const r = buildEstimate({
      products: [prodA],
      selections: [{ productId: "pa", qty: 3 }],
      logistics: "frete_proprio",
    });
    expect(r.qualifies).toBe(false);
  });

  it("descarta selection sem produto e qty < 1", () => {
    const r = buildEstimate({
      products: [prodA],
      selections: [
        { productId: "zzz", qty: 10 },
        { productId: "pa", qty: 0 },
      ],
      logistics: "retirada",
    });
    expect(r.lines).toEqual([]);
    expect(r.totalEstimated).toBe(0);
  });
});

describe("getBalcaoEligibleProducts", () => {
  it("resolve preço do ERP, aplica a regra e descarta produto sem preço", async () => {
    vi.resetModules();
    vi.doMock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));
    vi.doMock("./supabase", () => ({
      getHubClient: () => ({
        from: (table: string) => {
          if (table === "balcao_rules") {
            return {
              select: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "r1",
                        scope: "categoria",
                        category_id: "cat-1",
                        product_reference: null,
                        excluded: false,
                        active: true,
                        starts_at: null,
                        ends_at: null,
                        balcao_rule_tiers: [{ min_qty: 10, discount_pct: "10" }],
                      },
                    ],
                    error: null,
                  }),
              }),
            };
          }
          if (table === "products") {
            const chain = {
              select: () => chain,
              eq: () => chain,
              neq: () => chain,
              or: () => chain,
              order: () =>
                Promise.resolve({
                  data: [
                    { id: "pa", name: "A", reference: "SKU-A", brand: null, category_id: "cat-1", product_assets: [], product_channel_prices: [] },
                    { id: "pb", name: "B", reference: "SKU-B", brand: null, category_id: "cat-1", product_assets: [], product_channel_prices: [] },
                  ],
                  error: null,
                }),
            };
            return chain;
          }
          // v_precos_erp
          return {
            select: () => ({
              in: () => Promise.resolve({ data: [{ reference: "SKU-A", preco: "100.00" }], error: null }),
            }),
          };
        },
      }),
    }));

    const mod = await import("./balcao");
    const result = await mod.getBalcaoEligibleProducts("mypetbrasil");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "pa", sku: "SKU-A", basePrice: 100, categoryId: "cat-1" });
    expect(result[0].rule.tiers).toEqual([{ minQty: 10, discountPct: 10 }]);
    vi.doUnmock("next/cache");
    vi.doUnmock("./supabase");
  });
});
