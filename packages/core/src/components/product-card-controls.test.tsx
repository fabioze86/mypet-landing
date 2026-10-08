// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));

const data = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock("../catalog", () => ({
  getCategories: async () => [],
  getChannelCategories: async () => [{ id: "c1", name: "Coleiras", slug: "coleiras", parentId: null }],
  getCatalog: async () => ({ items: data.items, total: data.items.length, page: 1, totalPages: 1 }),
  queryCatalogByChannelCategory: async () => ({ items: data.items, total: data.items.length, page: 1, totalPages: 1 }),
}));
vi.mock("../banners", () => ({ getBanners: async () => [] }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound"); } }));

import { CartProvider } from "./cart-provider";
import { ClientConfigProvider, type ClientConfig } from "../theme";
import { ProductCard } from "./product-card";
import { CategoryListing } from "./category-listing";
import type { CatalogProduct } from "../catalog-utils";

const config: ClientConfig = {
  name: "Teste", tagline: "t", domain: "t.com", catalogChannel: "mypetbrasil", logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#0a5", pinkDark: "#084", pinkLight: "#efe", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

const product: CatalogProduct = {
  id: "coleira-p", name: "Coleira P", sku: "C-1", brand: null, img: "/c.jpg", badge: null,
  category: null, salePrice: 10, priceLabel: "R$ 10,00",
};

function wrap(child: ReturnType<typeof createElement>) {
  return createElement(ClientConfigProvider, { config }, createElement(CartProvider, null, child));
}

beforeEach(() => {
  localStorage.clear();
  data.items = [];
});
afterEach(() => cleanup());

describe("ProductCard — controle de adicionar", () => {
  it("modo default mantém o controle antigo", () => {
    render(wrap(createElement(ProductCard, { product })));
    expect(screen.getByRole("button", { name: "Adicionar ao carrinho" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar Coleira P" })).toBeNull();
  });

  it("modo stepper mostra Adicionar <nome>", () => {
    render(wrap(createElement(ProductCard, { product, addControl: "stepper" })));
    expect(screen.getByRole("button", { name: "Adicionar Coleira P" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).toBeNull();
  });

  it("modo stepper com variações leva para a página do produto", () => {
    render(wrap(createElement(ProductCard, { product: { ...product, hasVariants: true }, addControl: "stepper" })));
    expect(screen.getByRole("link", { name: "Ver opções" })).toHaveAttribute("href", "/produtos/coleira-p");
    expect(screen.queryByRole("button", { name: /Adicionar/ })).toBeNull();
  });
});

describe("CategoryListing — addControl", () => {
  async function renderListing(addControl?: "default" | "stepper") {
    data.items = [product];
    const element = await CategoryListing({
      slug: "coleiras", channel: "ffa_fabrica", palette: config.palette, domain: "t.com",
      useChannelCategories: true, addControl,
    });
    render(wrap(element));
  }

  it("por padrão usa o controle antigo", async () => {
    await renderListing();
    expect(screen.getByRole("button", { name: "Adicionar ao carrinho" })).toBeInTheDocument();
  });

  it("repassa o modo stepper aos cards", async () => {
    await renderListing("stepper");
    expect(screen.getByRole("button", { name: "Adicionar Coleira P" })).toBeInTheDocument();
  });
});
