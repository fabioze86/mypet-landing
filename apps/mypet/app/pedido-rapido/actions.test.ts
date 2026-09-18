import { describe, it, expect, vi, beforeEach } from "vitest";

const requireBuyer = vi.fn();
const getCatalogLineItems = vi.fn();

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("@mypet/core/catalog-line-items", () => ({
  getCatalogLineItems: (params: unknown) => getCatalogLineItems(params),
}));

import { searchLineItems } from "./actions";

beforeEach(() => {
  requireBuyer.mockReset();
  getCatalogLineItems.mockReset();
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

  it("normaliza page inválido (não numérico ou <= 0) para 1 antes de consultar", async () => {
    requireBuyer.mockResolvedValue({ id: "buyer-1" });
    getCatalogLineItems.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });

    await searchLineItems({ page: -5 });

    expect(getCatalogLineItems).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
    );
  });
});
