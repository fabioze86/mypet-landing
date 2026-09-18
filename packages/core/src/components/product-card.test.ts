// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { CartProvider } from "./cart-provider";
import { ClientConfigProvider, type ClientConfig } from "../theme";
import { ProductCard } from "./product-card";

const config: ClientConfig = {
  name: "MadPet",
  tagline: "Atacado",
  domain: "example.com",
  catalogChannel: "ffa_fabrica",
  logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#f0a", pinkDark: "#c07", pinkLight: "#fde", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

describe("ProductCard", () => {
  it("exibe a categoria como link e omite marca e textos antigos de preço", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(
          CartProvider,
          null,
          createElement(ProductCard, {
            product: {
              id: "guia-rosa",
              name: "Guia Rosa",
              sku: "GR-1",
              brand: "MY PET",
              img: "/guia-rosa.jpg",
              badge: null,
              category: { id: "guias", name: "Guias", slug: "guias" },
              salePrice: 12.9,
              priceLabel: "R$ 12,90",
            },
          }),
        ),
      ),
    );

    expect(markup).toContain('href="/categoria/guias"');
    expect(markup).toContain(">Guias<");
    expect(markup).not.toContain("MY PET");
    expect(markup).not.toContain("Atacado B2B");
    expect(markup).not.toContain("Preço do canal distribuidora");
  });
});

describe("ProductCard — preço no carrinho", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("inclui unitPrice ao adicionar o produto ao carrinho", () => {
    const { container } = render(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(
          CartProvider,
          null,
          createElement(ProductCard, {
            product: {
              id: "guia-rosa",
              name: "Guia Rosa",
              sku: "GR-1",
              brand: "MY PET",
              img: "/guia-rosa.jpg",
              badge: null,
              category: { id: "guias", name: "Guias", slug: "guias" },
              salePrice: 12.9,
              priceLabel: "R$ 12,90",
            },
          }),
        ),
      ),
    );

    fireEvent.click(container.querySelector('[aria-label="Adicionar ao carrinho"]')!);

    const cart = JSON.parse(localStorage.getItem("mypet_cart") ?? "{}");
    expect(cart.items[0]).toMatchObject({ id: "guia-rosa", unitPrice: 12.9 });
  });
});
