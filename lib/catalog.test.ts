import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: Record<string, unknown> = {};

vi.mock("./supabase", () => {
  return {
    getHubClient: () => {
      const builder: any = {};
      const chain = (name: string) => (...args: unknown[]) => {
        calls[name] = args;
        return builder;
      };
      builder.select = chain("select");
      builder.eq = chain("eq");
      builder.ilike = chain("ilike");
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
              product_assets: [{ url: "https://img/1", type: "main_image" }],
              product_badges: null,
            },
          ],
          count: 50,
          error: null,
        });
      };
      return { from: chain("from") };
    },
  };
});

import { queryCatalog } from "./catalog";

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
});

describe("queryCatalog", () => {
  it("aplica busca, marca, paginação e mapeia os itens", async () => {
    const result = await queryCatalog({ q: "ração", brand: "NAPI", page: 2 });
    expect(calls["ilike"]).toEqual(["name", "%ração%"]);
    expect(calls["eq"]).toEqual(["brand", "NAPI"]); // último eq
    expect(calls["range"]).toEqual([24, 47]);
    expect(result.total).toBe(50);
    expect(result.totalPages).toBe(3);
    expect(result.items[0]).toMatchObject({ id: "p1", sku: "100", img: "https://img/1" });
  });
});
