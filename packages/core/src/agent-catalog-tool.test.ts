import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("./catalog", () => ({ getBrands: vi.fn() }));
vi.mock("./catalog-line-items", () => ({ getCatalogLineItems: vi.fn() }));

import { getBrands } from "./catalog";
import { getCatalogLineItems } from "./catalog-line-items";
import { buildCatalogTool, resolveBrand } from "./agent-catalog-tool";

const item = (i: number) => ({
  id: `p${i}`,
  name: `Shampoo Neutro ${i}`,
  sku: `SKU${i}`,
  brand: "Pet Clean",
  img: `/img${i}.jpg`,
  unitPrice: 10 + i,
  priceLabel: `R$ ${10 + i},00`,
  variantLabel: i % 2 ? "5L" : null,
});

const toolOptions = { toolCallId: "t1", messages: [] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Execute = (input: any, options: any) => Promise<any>;

function run(showPrices: boolean, input: { query: string; marca?: string }) {
  const tool = buildCatalogTool({ channel: "mypetbrasil", showPrices });
  return (tool.execute as Execute)(input, toolOptions);
}

beforeEach(() => {
  vi.clearAllMocks();
  (getBrands as Mock).mockResolvedValue(["Pet Clean", "Pet Society"]);
  (getCatalogLineItems as Mock).mockResolvedValue({
    items: Array.from({ length: 10 }, (_, i) => item(i + 1)),
    total: 10,
    page: 1,
    totalPages: 1,
  });
});

describe("resolveBrand", () => {
  it("casa marca sem diferenciar maiúsculas e acentos", async () => {
    expect(await resolveBrand("pet clean", "mypetbrasil")).toBe("Pet Clean");
    expect(await resolveBrand("  PÉT CLEAN ", "mypetbrasil")).toBe("Pet Clean");
  });

  it("devolve undefined para marca vazia ou desconhecida", async () => {
    expect(await resolveBrand(undefined, "mypetbrasil")).toBeUndefined();
    expect(await resolveBrand("  ", "mypetbrasil")).toBeUndefined();
    expect(await resolveBrand("Marca X", "mypetbrasil")).toBeUndefined();
  });
});

describe("buscar_produtos", () => {
  it("visitante: nenhum preço na saída", async () => {
    const out = await run(false, { query: "shampoo neutro" });
    expect(out.total).toBe(10);
    expect(out.produtos).toHaveLength(8);
    expect(JSON.stringify(out)).not.toContain("R$");
    expect(out.produtos.every((p: { unitPrice: unknown; priceLabel: unknown }) => p.unitPrice === null && p.priceLabel === null)).toBe(true);
  });

  it("cliente: saída com preço e dados para o cartão", async () => {
    const out = await run(true, { query: "shampoo neutro" });
    expect(out.produtos[0]).toEqual({
      id: "p1",
      name: "Shampoo Neutro 1",
      sku: "SKU1",
      brand: "Pet Clean",
      variantLabel: "5L",
      img: "/img1.jpg",
      unitPrice: 11,
      priceLabel: "R$ 11,00",
    });
  });

  it("busca a primeira página do canal com a marca resolvida", async () => {
    await run(false, { query: "shampoo", marca: "pet clean" });
    expect(getCatalogLineItems).toHaveBeenCalledWith({ q: "shampoo", brand: "Pet Clean", page: 1, channel: "mypetbrasil" });
  });

  it("marca desconhecida: busca sem filtro de marca", async () => {
    await run(false, { query: "shampoo", marca: "Marca X" });
    expect(getCatalogLineItems).toHaveBeenCalledWith({ q: "shampoo", brand: undefined, page: 1, channel: "mypetbrasil" });
  });
});
