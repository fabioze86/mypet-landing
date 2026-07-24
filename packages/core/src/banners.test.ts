import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
}));

const calls: Record<string, unknown> = {};

vi.mock("./supabase", () => {
  return {
    getHubClient: () => {
      const builder: Record<string, unknown> = {};
      const chain = (name: string) => (...args: unknown[]) => {
        calls[name] = args;
        return builder;
      };
      builder.select = chain("select");
      builder.eq = (...args: unknown[]) => {
        calls["eq"] = [...((calls["eq"] as unknown[][] | undefined) ?? []), args];
        return builder;
      };
      builder.order = chain("order");
      builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) => {
        resolve({
          data: [
            { id: "b1", type: "principal", image_url: "https://img/banner1", link_url: "/promo", title: "Promo", sort_order: 0 },
          ],
          error: null,
        });
      };
      return { from: chain("from") };
    },
  };
});

import { getBanners } from "./banners";

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
});

describe("getBanners", () => {
  it("filtra por canal e tipo, mapeando snake_case para camelCase", async () => {
    const result = await getBanners("mypetbrasil", "principal");
    expect(calls["from"]).toEqual(["banners"]);
    expect(calls["eq"]).toContainEqual(["channel", "mypetbrasil"]);
    expect(calls["eq"]).toContainEqual(["type", "principal"]);
    expect(result).toEqual([
      { id: "b1", type: "principal", imageUrl: "https://img/banner1", linkUrl: "/promo", title: "Promo", sortOrder: 0 },
    ]);
  });

  it("retorna lista vazia para type=categoria sem categoryId", async () => {
    const result = await getBanners("mypetbrasil", "categoria");
    expect(result).toEqual([]);
  });

  it("filtra também por category_id quando type=categoria", async () => {
    await getBanners("distribuidora", "categoria", "cat-9");
    expect(calls["eq"]).toContainEqual(["category_id", "cat-9"]);
  });
});
