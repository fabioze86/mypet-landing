import { describe, it, expect, vi, beforeEach } from "vitest";

const requireBuyer = vi.fn();
const getCatalogLineItems = vi.fn();
const getCategories = vi.fn();

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("@mypet/core/catalog-line-items", () => ({
  getCatalogLineItems: (params: unknown) => getCatalogLineItems(params),
}));
vi.mock("@mypet/core/catalog", () => ({
  getCategories: () => getCategories(),
}));

import { searchLineItems } from "./actions";

beforeEach(() => {
  requireBuyer.mockReset();
  getCatalogLineItems.mockReset();
  getCategories.mockReset();
});

describe("searchLineItems", () => {
  it("retorna resultado vazio e não consulta o catálogo quando não há comprador autenticado", async () => {
    requireBuyer.mockResolvedValue(null);

    const result = await searchLineItems({ q: "ração", brand: "NAPI", page: 2 });

    expect(result).toEqual({ items: [], total: 0, page: 2, totalPages: 1 });
    expect(getCatalogLineItems).not.toHaveBeenCalled();
  });

  it("consulta o catálogo quando há comprador autenticado", async () => {
    requireBuyer.mockResolvedValue({ id: "buyer-1" });
    getCatalogLineItems.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });

    await searchLineItems({ q: "ração", brand: "NAPI", page: 1 });

    expect(getCatalogLineItems).toHaveBeenCalledWith({
      q: "ração",
      brand: "NAPI",
      page: 1,
      channel: "mypetbrasil",
    });
  });

  it("resolve a subárvore da categoria antes de consultar o catálogo", async () => {
    requireBuyer.mockResolvedValue({ id: "buyer-1" });
    getCategories.mockResolvedValue([
      { id: "cat-1", parentId: null, slug: "caes", name: "Cães", level: 1, sortOrder: 0 },
      { id: "cat-2", parentId: "cat-1", slug: "caes-camas", name: "Camas e colchonetes", level: 2, sortOrder: 0 },
    ]);
    getCatalogLineItems.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });

    await searchLineItems({ categoryId: "cat-1", page: 1 });

    expect(getCatalogLineItems).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: ["cat-1", "cat-2"] }),
    );
  });

  it("normaliza page inválido (não numérico ou <= 0) para 1 antes de consultar", async () => {
    requireBuyer.mockResolvedValue({ id: "buyer-1" });
    getCatalogLineItems.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });

    await searchLineItems({ page: -5 });

    expect(getCatalogLineItems).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
    );
  });
});
