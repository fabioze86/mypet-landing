import { describe, it, expect, vi } from "vitest";

const isProductInChannel = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});
vi.mock("@mypet/core/catalog", () => ({ isProductInChannel: (...a: unknown[]) => isProductInChannel(...a) }));
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));
vi.mock("../../../produtos/[id]/page", () => ({ default: () => "PRODUCT_PAGE" }));

import { FabricaProdutoBody } from "./page";

describe("FabricaProdutoBody", () => {
  it("404 para produto que não é de fábrica", async () => {
    isProductInChannel.mockResolvedValue(false);
    await expect(FabricaProdutoBody({ params: Promise.resolve({ id: "p1" }) })).rejects.toThrow("NOT_FOUND");
    expect(isProductInChannel).toHaveBeenCalledWith("p1", "ffa_fabrica");
  });

  it("renderiza a página de produto para produto de fábrica", async () => {
    isProductInChannel.mockResolvedValue(true);
    const el = await FabricaProdutoBody({ params: Promise.resolve({ id: "p1" }) });
    expect(el).toBeTruthy();
  });
});
