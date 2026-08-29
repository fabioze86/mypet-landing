import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
}));

const calls: Record<string, unknown> = {};

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  neq: (...args: unknown[]) => QueryBuilder;
  ilike: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  not: (...args: unknown[]) => QueryBuilder;
  range: (...args: unknown[]) => Promise<{ data: unknown[]; count: number; error: null }>;
  single: () => Promise<{ data: unknown; error: null }>;
  then: (resolve: (value: { data: unknown[]; error: null }) => void) => void;
};

vi.mock("./supabase", () => {
  return {
    getHubClient: () => {
      let currentTable = "";
      const builder = {} as QueryBuilder;
      const accumulate = (name: string) => (...args: unknown[]) => {
        calls[name] = [...((calls[name] as unknown[][] | undefined) ?? []), args];
        return builder;
      };
      const chain = (name: string) => (...args: unknown[]) => {
        calls[name] = args;
        return builder;
      };
      builder.select = accumulate("select");
      builder.eq = accumulate("eq");
      builder.neq = chain("neq");
      builder.ilike = chain("ilike");
      builder.in = accumulate("in");
      builder.order = chain("order");
      builder.not = chain("not");
      builder.range = (...args: unknown[]) => {
        calls["range"] = args;
        return Promise.resolve({
          data: [
            {
              id: "p1",
              name: "RAÇÃO X",
              reference: "100",
              brand: "NAPI",
              category_id: "cat-1",
              categories: { id: "cat-1", name: "Banho & Tosa", slug: "banho-tosa" },
              product_assets: [{ url: "https://img/1", type: "main_image" }],
              product_badges: null,
            },
          ],
          count: 50,
          error: null,
        });
      };
      builder.single = () => Promise.resolve({
        data: {
          id: "p1",
          name: "Ração X",
          reference: "100",
          brand: "NAPI",
          description: "Descrição",
          barcode: null,
          weight_kg: null,
          width_cm: null,
          height_cm: null,
          length_cm: null,
          product_role: "simple",
          parent_product_id: null,
          variant_axis: null,
          category_id: "cat-1",
          categories: { id: "cat-1", name: "Banho & Tosa", slug: "banho-tosa" },
          product_assets: [{ url: "https://img/1", type: "main_image" }],
          product_badges: null,
        },
        error: null,
      });
      builder.then = (resolve) => {
        const data =
          currentTable === "v_precos_erp"
            ? [{ reference: "100", preco: "42.90" }] // numeric chega como string via PostgREST
            : currentTable === "products"
              ? [] // variantes
              : [
                  { id: "cat-1", parent_id: null, slug: "caes", name: "Cães", level: 1, sort_order: 0 },
                  { id: "cat-2", parent_id: "cat-1", slug: "caes-racao", name: "Ração", level: 2, sort_order: 1 },
                ];
        resolve({ data, error: null });
      };
      return {
        from: (...args: unknown[]) => {
          currentTable = args[0] as string;
          calls["from"] = args;
          calls["fromAll"] = [...((calls["fromAll"] as unknown[] | undefined) ?? []), args[0]];
          return builder;
        },
      };
    },
  };
});

import { queryCatalog, getCategories, getProductById } from "./catalog";

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
});

const selectContains = (needle: string) =>
  ((calls["select"] as unknown[][] | undefined) ?? []).some((args) => String(args[0]).includes(needle));

describe("queryCatalog", () => {
  it("aplica busca, marca, canal, paginação e mapeia os itens", async () => {
    const result = await queryCatalog({ q: "ração", brand: "NAPI", page: 2, channel: "mypetbrasil" });
    expect(calls["ilike"]).toEqual(["name", "%ração%"]);
    expect(calls["eq"]).toContainEqual(["status", "active"]);
    expect(calls["neq"]).toEqual(["product_role", "variant"]);
    expect(calls["eq"]).toContainEqual(["brand", "NAPI"]);
    expect(calls["eq"]).toContainEqual(["product_channel_links.channel", "mypetbrasil"]);
    expect(selectContains("product_channel_links")).toBe(true);
    expect(calls["range"]).toEqual([24, 47]);
    expect(result.total).toBe(50);
    expect(result.totalPages).toBe(3);
    expect(result.items[0]).toMatchObject({
      id: "p1",
      sku: "100",
      img: "https://img/1",
      category: { id: "cat-1", name: "Banho & Tosa", slug: "banho-tosa" },
    });
  });
});

describe("queryCatalog com filtro de categoria", () => {
  it("filtra por categoryId quando informado", async () => {
    await queryCatalog({ page: 1, channel: "mypetbrasil", categoryId: "cat-9" });
    expect(calls["eq"]).toContainEqual(["category_id", "cat-9"]);
  });

  it("filtra por uma lista de categoryIds (subárvore) quando informado um array", async () => {
    await queryCatalog({ page: 1, channel: "mypetbrasil", categoryId: ["cat-9", "cat-10", "cat-11"] });
    expect(calls["in"]).toContainEqual(["category_id", ["cat-9", "cat-10", "cat-11"]]);
  });
});

describe("getProductById", () => {
  it("inclui category_id e categories no select e no retorno", async () => {
    const product = await getProductById("p1", "mypetbrasil");
    expect(selectContains("category_id")).toBe(true);
    expect(selectContains("categories(id, name, slug)")).toBe(true);
    expect(product).toMatchObject({
      categoryId: "cat-1",
      category: { id: "cat-1", name: "Banho & Tosa", slug: "banho-tosa" },
    });
  });
});

describe("preço do ERP (Bling) no canal mypetbrasil", () => {
  it("queryCatalog sobrescreve o preço dos itens com o valor de v_precos_erp", async () => {
    const result = await queryCatalog({ page: 1, channel: "mypetbrasil" });
    expect(calls["fromAll"]).toContain("v_precos_erp");
    expect(calls["in"]).toContainEqual(["reference", ["100"]]);
    expect(result.items[0].salePrice).toBe(42.9);
    expect(result.items[0].priceLabel).toMatch(/42,90/);
  });

  it("getProductById sobrescreve o preço do produto com o valor de v_precos_erp", async () => {
    const product = await getProductById("p1", "mypetbrasil");
    expect(calls["fromAll"]).toContain("v_precos_erp");
    expect(product?.salePrice).toBe(42.9);
    expect(product?.priceLabel).toMatch(/42,90/);
  });

  it("não consulta v_precos_erp para canais que usam preço manual", async () => {
    await queryCatalog({ page: 1, channel: "distribuidora" });
    expect(calls["fromAll"] ?? []).not.toContain("v_precos_erp");
  });
});

describe("getCategories", () => {
  it("consulta a tabela categories e mapeia parent_id para parentId", async () => {
    const categories = await getCategories();
    expect(calls["from"]).toEqual(["categories"]);
    expect(categories).toEqual([
      { id: "cat-1", parentId: null, slug: "caes", name: "Cães", level: 1, sortOrder: 0 },
      { id: "cat-2", parentId: "cat-1", slug: "caes-racao", name: "Ração", level: 2, sortOrder: 1 },
    ]);
  });
});
