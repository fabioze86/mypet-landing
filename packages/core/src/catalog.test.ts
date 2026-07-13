import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
}));

const calls: Record<string, unknown> = {};

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  ilike: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  not: (...args: unknown[]) => QueryBuilder;
  range: (...args: unknown[]) => Promise<{ data: unknown[]; count: number; error: null }>;
  then: (resolve: (value: { data: unknown[]; error: null }) => void) => void;
};

vi.mock("./supabase", () => {
  return {
    getHubClient: () => {
      const builder = {} as QueryBuilder;
      const chain = (name: string) => (...args: unknown[]) => {
        calls[name] = args;
        return builder;
      };
      builder.select = chain("select");
      builder.eq = (...args: unknown[]) => {
        calls["eq"] = [...((calls["eq"] as unknown[][] | undefined) ?? []), args];
        return builder;
      };
      builder.ilike = chain("ilike");
      builder.in = chain("in");
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
      builder.then = (resolve) => {
        resolve({
          data: [
            { id: "cat-1", parent_id: null, slug: "caes", name: "Cães", level: 1 },
            { id: "cat-2", parent_id: "cat-1", slug: "caes-racao", name: "Ração", level: 2 },
          ],
          error: null,
        });
      };
      return { from: chain("from") };
    },
  };
});

import { queryCatalog, getCategories } from "./catalog";

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
});

describe("queryCatalog", () => {
  it("aplica busca, marca, canal, paginação e mapeia os itens", async () => {
    const result = await queryCatalog({ q: "ração", brand: "NAPI", page: 2, channel: "mypetbrasil" });
    expect(calls["ilike"]).toEqual(["name", "%ração%"]);
    expect(calls["eq"]).toContainEqual(["status", "active"]);
    expect(calls["eq"]).toContainEqual(["brand", "NAPI"]);
    expect(calls["eq"]).toContainEqual(["product_channel_links.channel", "mypetbrasil"]);
    expect((calls["select"] as unknown[])[0]).toContain("product_channel_links");
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
    expect(calls["in"]).toEqual(["category_id", ["cat-9", "cat-10", "cat-11"]]);
  });
});

describe("getCategories", () => {
  it("consulta a tabela categories e mapeia parent_id para parentId", async () => {
    const categories = await getCategories();
    expect(calls["from"]).toEqual(["categories"]);
    expect(categories).toEqual([
      { id: "cat-1", parentId: null, slug: "caes", name: "Cães", level: 1 },
      { id: "cat-2", parentId: "cat-1", slug: "caes-racao", name: "Ração", level: 2 },
    ]);
  });
});
