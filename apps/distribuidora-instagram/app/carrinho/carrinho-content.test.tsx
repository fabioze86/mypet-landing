import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientConfigProvider } from "@mypet/core/theme";
import { testClientConfig } from "@mypet/core/test-utils/client-config";
import CarrinhoContent from "./carrinho-content";

const mockUseCart = vi.hoisted(() => vi.fn());
vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: mockUseCart,
}));

describe("CarrinhoContent", () => {
  beforeEach(() => {
    mockUseCart.mockReset();
  });

  it("mostra mensagem de carrinho vazio quando não há itens", () => {
    mockUseCart.mockReturnValue({ cart: { items: [] }, removeItem: vi.fn(), updateQty: vi.fn(), totalItems: 0 });
    render(
      <ClientConfigProvider config={testClientConfig}>
        <CarrinhoContent />
      </ClientConfigProvider>,
    );
    expect(screen.getByText(/carrinho está vazio/i)).toBeInTheDocument();
  });

  it("lista os itens com preço promocional e total somado", () => {
    mockUseCart.mockReturnValue({
      cart: {
        items: [
          { id: "p1", name: "Kit 11 vestidos", sku: "SKU-1", brand: null, img: "/kit.jpg", qty: 2, unitPrice: 199, listPrice: 299, campaignSlug: "kit-11-vestidos" },
        ],
      },
      removeItem: vi.fn(),
      updateQty: vi.fn(),
      totalItems: 2,
    });
    render(
      <ClientConfigProvider config={testClientConfig}>
        <CarrinhoContent />
      </ClientConfigProvider>,
    );
    expect(screen.getByText("Kit 11 vestidos")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 398,00/)).toBeInTheDocument();
  });
});
