// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));
const query = vi.hoisted(() => ({ variante: null as string | null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(query.variante ? `variante=${query.variante}` : ""),
}));

import { CartProvider } from "./cart-provider";
import { ClientConfigProvider, type ClientConfig } from "../theme";
import { ProductVariantPanel, type PdpProduct } from "./product-variant-panel";

const config: ClientConfig = {
  name: "Teste", tagline: "t", domain: "t.com", catalogChannel: "mypetbrasil", logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#0a5", pinkDark: "#084", pinkLight: "#efe", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

const variant = (id: string, salePrice: number | null) => ({
  id, name: `Coleira ${id}`, sku: id, barcode: null, img: "/c.jpg",
  axis: [{ eixo: "Tamanho", valor: id }], salePrice, priceLabel: null,
});

function renderPanel(product: PdpProduct) {
  render(createElement(ClientConfigProvider, { config },
    createElement(CartProvider, null, createElement(ProductVariantPanel, { product }))));
  fireEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));
  return JSON.parse(localStorage.getItem("mypet_cart") ?? "{}").items[0];
}

const parent: PdpProduct = {
  id: "pai", name: "Coleira", brand: null, sku: "PAI", barcode: null, img: "/c.jpg", badge: null,
  variants: [], salePrice: 20, priceLabel: "A partir de R$ 20,00",
};

beforeEach(() => {
  localStorage.clear();
  query.variante = null;
});
afterEach(() => cleanup());

describe("ProductVariantPanel — preço no carrinho", () => {
  it("variação sem preço não herda o preço do pai", () => {
    query.variante = "g";
    const item = renderPanel({ ...parent, variants: [variant("p", 20), variant("g", null)] });
    expect(item).toMatchObject({ id: "g" });
    expect(item.unitPrice).toBeUndefined();
  });

  it("variação com preço usa o próprio preço", () => {
    query.variante = "p";
    expect(renderPanel({ ...parent, variants: [variant("p", 25), variant("g", null)] })).toMatchObject({ id: "p", unitPrice: 25 });
  });

  it("produto sem variações usa o preço do próprio produto", () => {
    expect(renderPanel(parent)).toMatchObject({ id: "pai", unitPrice: 20 });
  });
});
