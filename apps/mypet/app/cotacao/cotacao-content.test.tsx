// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { ClientConfigProvider, type ClientConfig } from "@mypet/core/theme";
import { CotacaoContent } from "./cotacao-content";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./actions", () => ({ finalizeQuote: vi.fn() }));

const config: ClientConfig = {
  name: "My Pet Brasil",
  tagline: "Atacado B2B",
  domain: "mypetbrasil.com.br",
  catalogChannel: "mypetbrasil",
  logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#f0a", pinkDark: "#c07", pinkLight: "#fde", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

function renderWithCart(cartItems: Record<string, unknown>[]) {
  localStorage.setItem("mypet_cart", JSON.stringify({ items: cartItems }));
  return render(
    createElement(
      ClientConfigProvider,
      { config },
      createElement(CartProvider, null, createElement(CotacaoContent, { palette: config.palette })),
    ),
  );
}

describe("CotacaoContent — subtotal e total", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("mostra subtotal por linha e o total geral quando todos os itens têm unitPrice", () => {
    renderWithCart([
      { id: "p1", name: "Ração X", sku: "100", brand: "NAPI", img: "/img.jpg", qty: 2, unitPrice: 42.9 },
      { id: "p2", name: "Areia Y", sku: "200", brand: "NAPI", img: "/img2.jpg", qty: 1, unitPrice: 30 },
    ]);

    expect(screen.getByText("R$ 85,80")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 115,80")).toBeInTheDocument();
  });

  it("mostra — no subtotal de item sem unitPrice e não o inclui no total geral", () => {
    renderWithCart([
      { id: "p1", name: "Ração X", sku: "100", brand: "NAPI", img: "/img.jpg", qty: 2 },
      { id: "p2", name: "Areia Y", sku: "200", brand: "NAPI", img: "/img2.jpg", qty: 1, unitPrice: 30 },
    ]);

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
  });
});
