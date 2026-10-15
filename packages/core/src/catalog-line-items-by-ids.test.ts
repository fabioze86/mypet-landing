import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));

type Result = { data: unknown[] | null; error: { message: string } | null };
const queue: Result[] = [];
const calls: { method: string; args: unknown[] }[] = [];

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (v: Result) => void) => resolve(queue.shift() ?? { data: [], error: null });
  return builder;
}

vi.mock("./supabase", () => ({ getHubClient: () => ({ from: () => makeBuilder() }) }));

import { queryLineItemsByIds } from "./catalog-line-items";

const simple = {
  id: "s1",
  name: "Ração X",
  reference: "100",
  brand: "NAPI",
  product_role: "simple",
  parent_product_id: null,
  variant_axis: null,
  product_assets: [{ url: "https://img/s1", type: "main_image" }],
  product_channel_prices: [{ channel: "mypetbrasil", sale_price: "42.90" }],
};

const variant = {
  id: "v1",
  name: "Shampoo Neutro 5L",
  reference: "SH-5L",
  brand: null,
  product_role: "variant",
  parent_product_id: "p1",
  variant_axis: [{ eixo: "Volume", valor: "5L" }],
  product_assets: [],
  product_channel_prices: [{ channel: "mypetbrasil", sale_price: 89.9 }],
};

const parent = { id: "p1", name: "Shampoo Neutro", brand: "Pet Clean", product_assets: [{ url: "https://img/p1", type: "main_image" }] };

beforeEach(() => {
  queue.length = 0;
  calls.length = 0;
});

describe("queryLineItemsByIds", () => {
  it("monta linhas de produto simples e de variação, na ordem pedida", async () => {
    queue.push({ data: [simple, variant], error: null }, { data: [parent], error: null });
    const items = await queryLineItemsByIds(["v1", "s1"], "mypetbrasil");
    expect(items).toEqual([
      {
        id: "v1",
        name: "Shampoo Neutro",
        sku: "SH-5L",
        brand: "Pet Clean",
        img: "https://img/p1",
        unitPrice: 89.9,
        priceLabel: "R$ 89,90",
        variantLabel: "5L",
      },
      {
        id: "s1",
        name: "Ração X",
        sku: "100",
        brand: "NAPI",
        img: "https://img/s1",
        unitPrice: 42.9,
        priceLabel: "R$ 42,90",
        variantLabel: null,
      },
    ]);
    expect(calls).toContainEqual({ method: "in", args: ["id", ["v1", "s1"]] });
    expect(calls).toContainEqual({ method: "eq", args: ["product_channel_links.channel", "mypetbrasil"] });
    expect(calls).toContainEqual({ method: "neq", args: ["product_role", "parent"] });
  });

  it("ignora ids repetidos e desconhecidos; lista vazia não consulta", async () => {
    queue.push({ data: [simple], error: null });
    const items = await queryLineItemsByIds(["s1", "s1", "x"], "mypetbrasil");
    expect(items.map((i) => i.id)).toEqual(["s1"]);
    expect(calls).toContainEqual({ method: "in", args: ["id", ["s1", "x"]] });

    calls.length = 0;
    expect(await queryLineItemsByIds([], "mypetbrasil")).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("variação cujo rótulo é igual ao SKU fica sem rótulo", async () => {
    queue.push(
      { data: [{ ...variant, variant_axis: [{ eixo: "Ref", valor: "SH-5L" }] }], error: null },
      { data: [parent], error: null },
    );
    const [item] = await queryLineItemsByIds(["v1"], "mypetbrasil");
    expect(item.variantLabel).toBeNull();
  });

  it("erro do banco devolve lista vazia", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    queue.push({ data: null, error: { message: "down" } });
    expect(await queryLineItemsByIds(["s1"], "mypetbrasil")).toEqual([]);
  });
});
