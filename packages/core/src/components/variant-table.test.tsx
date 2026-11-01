// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));

import { CartProvider } from "./cart-provider";
import { ClientConfigProvider, type ClientConfig } from "../theme";
import { VariantTable } from "./variant-table";
import type { ProductVariant } from "../catalog-utils";

const config: ClientConfig = {
  name: "Teste", tagline: "t", domain: "t.com", catalogChannel: "mypetbrasil", logo: { emoji: "🐾" },
  features: { commerce: "cart" },
  palette: {
    pink: "#0a5", pinkDark: "#084", pinkLight: "#efe", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};
const retailConfig: ClientConfig = {
  ...config,
  retail: { installments: { max: 6, minInstallment: 30 }, consultWhatsApp: "5511999990000" },
};

const variant = (id: string, salePrice: number | null, stockQty?: number | null): ProductVariant => ({
  id, name: `Coleira ${id}`, sku: id, barcode: null, img: "/c.jpg", axis: [],
  salePrice, priceLabel: salePrice === null ? null : "R$ 10,00",
  ...(stockQty !== undefined ? { stockQty } : {}),
});

function renderTable(cfg: ClientConfig, variants: ProductVariant[]) {
  render(createElement(ClientConfigProvider, { config: cfg },
    createElement(CartProvider, null, createElement(VariantTable, { variants, brand: null }))));
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("VariantTable — modo varejo", () => {
  it("linha sem estoque mostra Esgotado e nenhum botão de compra", () => {
    renderTable(retailConfig, [variant("a", 10, 0)]);
    expect(screen.getByText("Esgotado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).toBeNull();
  });

  it("linha sem preço oferece consulta no WhatsApp", () => {
    renderTable(retailConfig, [variant("a", null, 5)]);
    expect(screen.getByRole("link", { name: "Consultar preço no WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).toBeNull();
  });

  it("linha disponível mostra o preço uma só vez e o botão de compra", () => {
    renderTable(retailConfig, [variant("a", 10, 5)]);
    expect(screen.getAllByText("R$ 10,00")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Adicionar ao carrinho" })).toBeInTheDocument();
  });
});

describe("VariantTable — sem retail", () => {
  it("mantém o controle antigo e o preço sob consulta", () => {
    renderTable(config, [variant("a", null, 0)]);
    expect(screen.getByText("Preço sob consulta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar ao carrinho" })).toBeInTheDocument();
  });
});
