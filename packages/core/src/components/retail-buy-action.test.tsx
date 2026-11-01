// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CartProvider } from "./cart-provider";
import { ClientConfigProvider, type ClientConfig } from "../theme";
import { RetailBuyAction } from "./retail-buy-action";

const retail = { installments: { max: 6, minInstallment: 30 }, consultWhatsApp: "5511999990000" };
const config: ClientConfig = {
  name: "Teste", tagline: "t", domain: "t.com", catalogChannel: "azpetshop", logo: { emoji: "🐾" },
  features: { commerce: "cart" }, retail,
  palette: {
    pink: "#0a5", pinkDark: "#084", pinkLight: "#efe", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};
const item = { id: "p1", name: "Shampoo Neutro", sku: "S-1", brand: null, img: "/s.jpg", unitPrice: 100 };

function renderAction(props: { salePrice: number | null; priceLabel: string | null; inStock?: boolean }) {
  return render(
    createElement(ClientConfigProvider, { config },
      createElement(CartProvider, null,
        createElement(RetailBuyAction, { retail, product: item, size: "pdp", ...props }))),
  );
}

afterEach(() => cleanup());

describe("RetailBuyAction", () => {
  it("com preço e estoque: mostra preço, parcelamento e botão Comprar", () => {
    renderAction({ salePrice: 100, priceLabel: "R$ 100,00", inStock: true });
    expect(screen.getByText("R$ 100,00")).toBeInTheDocument(); // priceLabel vem pronto da prop
    expect(screen.getByText(/ou até 3x de/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar ao carrinho" })).toHaveTextContent("Comprar");
  });

  it("estoque desconhecido (undefined) conta como disponível", () => {
    renderAction({ salePrice: 100, priceLabel: "R$ 100,00" });
    expect(screen.getByRole("button", { name: "Adicionar ao carrinho" })).toBeInTheDocument();
  });

  it("sem preço: link Consultar preço no WhatsApp com o nome do produto", () => {
    renderAction({ salePrice: null, priceLabel: null, inStock: true });
    const link = screen.getByRole("link", { name: "Consultar preço no WhatsApp" });
    expect(link).toHaveAttribute("href", expect.stringContaining("https://wa.me/5511999990000"));
    expect(link.getAttribute("href")).toContain(encodeURIComponent("Shampoo Neutro"));
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).toBeNull();
  });

  it("sem estoque: Esgotado + consulta, sem botão de compra", () => {
    renderAction({ salePrice: 100, priceLabel: "R$ 100,00", inStock: false });
    expect(screen.getByText("Esgotado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Consultar no WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).toBeNull();
  });
});
