import { describe, it, expect, vi, beforeEach } from "vitest";

const requireBuyer = vi.fn();
const redirect = vi.fn(() => {
  throw new Error("REDIRECT");
});

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@mypet/core/catalog", () => ({
  getCategories: async () => [],
  getBrands: async () => ["NAPI"],
}));
vi.mock("@mypet/core/catalog-line-items", () => ({
  getCatalogLineItems: async () => ({ items: [], total: 0, page: 1, totalPages: 1 }),
}));

import { PedidoRapidoPageBody } from "./page";

beforeEach(() => {
  requireBuyer.mockReset();
  redirect.mockClear();
});

describe("PedidoRapidoPage", () => {
  it("redireciona para /entrar quando não há comprador", async () => {
    requireBuyer.mockResolvedValue(null);
    await expect(PedidoRapidoPageBody()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });
});
