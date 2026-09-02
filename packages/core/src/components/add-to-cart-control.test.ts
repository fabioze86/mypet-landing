import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CartProvider } from "./cart-provider";
import { ClientConfigProvider, type ClientConfig } from "../theme";
import { AddToCartControl } from "./add-to-cart-control";

const config: ClientConfig = {
  name: "My Pet",
  tagline: "Atacado",
  domain: "example.com",
  catalogChannel: "distribuidora",
  logo: { emoji: "🐾" },
  features: { commerce: "cart" },
  palette: {
    pink: "#f0a", pinkDark: "#c07", pinkLight: "#fde", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

describe("AddToCartControl", () => {
  it("usa o ícone de carrinho no atalho compacto da listagem", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(
          CartProvider,
          null,
          createElement(AddToCartControl, {
            product: { id: "bandana", name: "Bandana", sku: "B-1", brand: "My Pet", img: "/bandana.jpg" },
            compact: true,
          }),
        ),
      ),
    );

    expect(markup).toContain('aria-label="Adicionar ao carrinho"');
    expect(markup).toContain("🛒");
    expect(markup).not.toContain("+Adicionar");
  });
});
