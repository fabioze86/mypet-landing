// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatPrice } from "../catalog-utils";
import type { CartItem } from "../cart";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const cart = vi.hoisted(() => ({ items: [] as CartItem[] }));
vi.mock("./cart-provider", () => ({ useCart: () => ({ cart }) }));

import { ClientConfigProvider, type ClientConfig } from "../theme";
import { CartBar } from "./cart-bar";

const config: ClientConfig = {
  name: "Teste", tagline: "t", domain: "t.com", catalogChannel: "mypetbrasil", logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#0a5", pinkDark: "#084", pinkLight: "#efe", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

const base = { sku: "1", brand: null, img: "/x.jpg" };

function renderBar() {
  return render(createElement(ClientConfigProvider, { config }, createElement(CartBar)));
}

beforeEach(() => {
  nav.pathname = "/";
  cart.items = [];
});
afterEach(() => cleanup());

describe("CartBar", () => {
  it("não aparece com carrinho vazio", () => {
    renderBar();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("não aparece na própria página do carrinho", () => {
    cart.items = [{ ...base, id: "a", name: "A", qty: 1, unitPrice: 10 }];
    nav.pathname = "/cotacao";
    renderBar();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("mostra unidades, total e leva ao carrinho", () => {
    cart.items = [
      { ...base, id: "a", name: "A", qty: 2, unitPrice: 10 },
      { ...base, id: "b", name: "B", qty: 1, unitPrice: 5.5 },
    ];
    renderBar();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/cotacao");
    expect(link).toHaveTextContent(`3 itens · ${formatPrice(25.5)}`.replace(/\s/g, " "));
    expect(link).toHaveTextContent("Enviar pedido →");
  });

  it("avisa quando há itens sem preço", () => {
    cart.items = [
      { ...base, id: "a", name: "A", qty: 1, unitPrice: 10 },
      { ...base, id: "b", name: "B", qty: 1 },
    ];
    renderBar();
    expect(screen.getByRole("link")).toHaveTextContent("+ itens a consultar");
  });

  it("sem nenhum preço mostra só as unidades", () => {
    cart.items = [{ ...base, id: "b", name: "B", qty: 1 }];
    renderBar();
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("1 item");
    expect(link).not.toHaveTextContent("R$");
  });
});
