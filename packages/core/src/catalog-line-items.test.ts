import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
}));

vi.mock("./catalog", () => ({
  fetchErpPrices: async () => new Map<string, number>(),
}));

const calls: Record<string, unknown[][]> = {};
let productPage: { data: unknown[]; count: number } = { data: [], count: 0 };
let variantRows: unknown[] = [];

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  const record = (name: string) => (...args: unknown[]) => {
    calls[name] = [...(calls[name] ?? []), args];
    return builder;
  };
  builder.select = record("select");
  builder.eq = record("eq");
  builder.neq = record("neq");
  builder.ilike = record("ilike");
  builder.order = record("order");
  builder.in = record("in");
  builder.range = (...args: unknown[]) => {
    calls["range"] = [args];
    return Promise.resolve({ data: productPage.data, count: productPage.count, error: null });
  };
  builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) => {
    resolve({ data: table === "products" ? variantRows : [], error: null });
  };
  return builder;
}

vi.mock("./supabase", () => ({
  getHubClient: () => ({
    from: (table: string) => makeBuilder(table),
  }),
}));

import { queryCatalogLineItems } from "./catalog-line-items";

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
  productPage = { data: [], count: 0 };
  variantRows = [];
});

describe("queryCatalogLineItems", () => {
  it("mapeia um produto simples em uma linha com preço", async () => {
    productPage = {
      data: [
        {
          id: "p1",
          name: "Ração X",
          reference: "100",
          brand: "NAPI",
          product_role: "simple",
          product_assets: [{ url: "https://img/1", type: "main_image" }],
          product_channel_prices: [{ channel: "distribuidora", sale_price: "42.90" }],
        },
      ],
      count: 1,
    };

    const result = await queryCatalogLineItems({ page: 1, channel: "distribuidora" });

    expect(result.items).toEqual([
      {
        id: "p1",
        name: "Ração X",
        sku: "100",
        brand: "NAPI",
        img: "https://img/1",
        unitPrice: 42.9,
        priceLabel: "R$ 42,90",
        variantLabel: null,
      },
    ]);
    expect(result.total).toBe(1);
  });

  it("expande um produto pai em uma linha por variante, sem linha resumida do pai", async () => {
    productPage = {
      data: [
        {
          id: "p1",
          name: "Coleira Ajustável",
          reference: null,
          brand: "MY PET",
          product_role: "parent",
          product_assets: [{ url: "https://img/parent", type: "main_image" }],
          product_channel_prices: [],
        },
      ],
      count: 1,
    };
    variantRows = [
      {
        id: "v1",
        name: "Coleira Ajustável P",
        reference: "COL-P",
        barcode: null,
        parent_product_id: "p1",
        variant_axis: [{ eixo: "tamanho", valor: "P", ordem: 1 }],
        product_assets: [{ url: "https://img/v1", type: "main_image" }],
        product_channel_prices: [{ channel: "distribuidora", sale_price: "19.90" }],
      },
      {
        id: "v2",
        name: "Coleira Ajustável M",
        reference: "COL-M",
        barcode: null,
        parent_product_id: "p1",
        variant_axis: [{ eixo: "tamanho", valor: "M", ordem: 1 }],
        product_assets: [],
        product_channel_prices: [{ channel: "distribuidora", sale_price: "21.90" }],
      },
    ];

    const result = await queryCatalogLineItems({ page: 1, channel: "distribuidora" });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: "v1",
      sku: "COL-P",
      variantLabel: "P",
      unitPrice: 19.9,
      img: "https://img/v1",
    });
    expect(result.items[1]).toMatchObject({
      id: "v2",
      sku: "COL-M",
      variantLabel: "M",
      unitPrice: 21.9,
      img: "https://img/parent",
    });
    expect(result.items.some((item) => item.id === "p1")).toBe(false);
  });

  it("produto sem preço no canal fica com unitPrice e priceLabel nulos", async () => {
    productPage = {
      data: [
        {
          id: "p1",
          name: "Ração X",
          reference: "100",
          brand: "NAPI",
          product_role: "simple",
          product_assets: [],
          product_channel_prices: [],
        },
      ],
      count: 1,
    };

    const result = await queryCatalogLineItems({ page: 1, channel: "distribuidora" });

    expect(result.items[0]).toMatchObject({ unitPrice: null, priceLabel: null });
  });

  it("repassa q, brand e paginação para a busca de produtos-base", async () => {
    await queryCatalogLineItems({ q: "ração", brand: "NAPI", page: 2, channel: "mypetbrasil" });

    expect(calls["ilike"]).toContainEqual(["name", "%ração%"]);
    expect(calls["eq"]).toContainEqual(["brand", "NAPI"]);
    expect(calls["eq"]).toContainEqual(["product_channel_links.channel", "mypetbrasil"]);
    expect(calls["neq"]).toContainEqual(["product_role", "variant"]);
    expect(calls["range"]).toEqual([[24, 47]]);
  });
});
