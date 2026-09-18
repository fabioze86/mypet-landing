// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { ClientConfigProvider, type ClientConfig } from "@mypet/core/theme";
import type { CatalogLineItemsResult } from "@mypet/core/catalog-line-items";
import { PedidoRapidoTable } from "./pedido-rapido-table";

const searchLineItems = vi.fn();
vi.mock("./actions", () => ({ searchLineItems: (params: unknown) => searchLineItems(params) }));

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

const baseResult: CatalogLineItemsResult = {
  items: [
    { id: "p1", name: "Ração X", sku: "100", brand: "NAPI", img: "/img.jpg", unitPrice: 42.9, priceLabel: "R$ 42,90", variantLabel: null },
    { id: "p2", name: "Kit sem preço", sku: "200", brand: "NAPI", img: "/img2.jpg", unitPrice: null, priceLabel: null, variantLabel: null },
  ],
  total: 2,
  page: 1,
  totalPages: 1,
};

function renderTable(result = baseResult) {
  return render(
    createElement(
      ClientConfigProvider,
      { config },
      createElement(
        CartProvider,
        null,
        createElement(PedidoRapidoTable, { initialResult: result, brands: ["NAPI"], palette: config.palette }),
      ),
    ),
  );
}

describe("PedidoRapidoTable", () => {
  beforeEach(() => {
    localStorage.clear();
    searchLineItems.mockReset();
  });

  it("clicar em adicionar grava a linha no carrinho com o preço e atualiza a barra fixa de total", () => {
    renderTable();

    fireEvent.click(screen.getByLabelText("Adicionar Ração X ao carrinho"));

    const cart = JSON.parse(localStorage.getItem("mypet_cart") ?? "{}");
    expect(cart.items[0]).toMatchObject({ id: "p1", unitPrice: 42.9, qty: 1 });
    expect(screen.getByText("1 item — R$ 42,90")).toBeInTheDocument();
  });

  it("clicar em adicionar quando o item já está no carrinho SUBSTITUI a quantidade, não soma", () => {
    localStorage.setItem(
      "mypet_cart",
      JSON.stringify({ items: [{ id: "p1", name: "Ração X", sku: "100", brand: "NAPI", img: "/img.jpg", unitPrice: 42.9, qty: 2 }] }),
    );

    renderTable();

    // O input já deve exibir a quantidade atual do carrinho (2), sem alteração manual.
    expect(screen.getByLabelText("Quantidade de Ração X")).toHaveValue(2);

    fireEvent.click(screen.getByLabelText("Adicionar Ração X ao carrinho"));

    const cart = JSON.parse(localStorage.getItem("mypet_cart") ?? "{}");
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ id: "p1", qty: 2 });
  });

  it("desabilita quantidade e botão de adicionar para item sem preço", () => {
    renderTable();

    expect(screen.getByLabelText("Quantidade de Kit sem preço")).toBeDisabled();
    expect(screen.getByLabelText("Adicionar Kit sem preço ao carrinho")).toBeDisabled();
    expect(screen.getByText("Sob consulta")).toBeInTheDocument();
  });

  it("digitar na busca dispara searchLineItems após o debounce, não a cada tecla", async () => {
    searchLineItems.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
    renderTable();

    const input = screen.getByLabelText("Buscar produtos por nome ou SKU");
    fireEvent.change(input, { target: { value: "r" } });
    fireEvent.change(input, { target: { value: "ra" } });
    fireEvent.change(input, { target: { value: "ração" } });

    expect(searchLineItems).not.toHaveBeenCalled();

    await waitFor(() => expect(searchLineItems).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(searchLineItems).toHaveBeenCalledWith({ q: "ração", brand: undefined, page: 1 });
  });
});
