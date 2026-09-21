import { describe, it, expect, vi, beforeEach } from "vitest";

const requireBuyer = vi.fn();
const redirect = vi.fn(() => {
  throw new Error("REDIRECT");
});

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@mypet/core/catalog", () => ({
  getCategories: async () => [],
  getProductCount: async () => 0,
}));

import { LojaContent } from "./page";

beforeEach(() => {
  requireBuyer.mockReset();
  redirect.mockClear();
});

describe("LojaPage", () => {
  it("redireciona para /pedido-rapido — navegação da loja está temporariamente oculta", async () => {
    requireBuyer.mockResolvedValue(null);
    await expect(LojaContent({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/pedido-rapido");
  });

  it("redireciona para /pedido-rapido mesmo com comprador autenticado", async () => {
    requireBuyer.mockResolvedValue({ id: "b1" });
    await expect(LojaContent({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/pedido-rapido");
  });
});
