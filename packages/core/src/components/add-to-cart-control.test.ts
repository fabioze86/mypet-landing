// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, within, fireEvent } from "@testing-library/react";
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

  it("usa minQty como quantidade inicial e como piso do decremento", () => {
    const { container } = render(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(
          CartProvider,
          null,
          createElement(AddToCartControl, {
            product: { id: "kit-11", name: "Kit 11 vestidos", sku: "K-1", brand: null, img: "/kit.jpg" },
            minQty: 12,
          }),
        ),
      ),
    );
    const scope = within(container);

    expect(scope.getByText("12")).toBeInTheDocument();

    const decrement = scope.getByLabelText("Diminuir quantidade");
    fireEvent.click(decrement);
    fireEvent.click(decrement);
    fireEvent.click(decrement);

    // Não deve descer abaixo do mínimo cadastrado (min_quantity da oferta).
    expect(scope.getByText("12")).toBeInTheDocument();
  });

  it("mantém o piso padrão de 1 quando minQty não é informado", () => {
    const { container } = render(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(
          CartProvider,
          null,
          createElement(AddToCartControl, {
            product: { id: "bandana-2", name: "Bandana", sku: "B-2", brand: null, img: "/bandana.jpg" },
          }),
        ),
      ),
    );
    const scope = within(container);

    expect(scope.getByText("1")).toBeInTheDocument();
    fireEvent.click(scope.getByLabelText("Diminuir quantidade"));
    expect(scope.getByText("1")).toBeInTheDocument();
  });
});
