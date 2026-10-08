// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CartProvider } from "./cart-provider";
import { ClientConfigProvider, type ClientConfig } from "../theme";
import { CartStepperControl } from "./cart-stepper-control";

const config: ClientConfig = {
  name: "Teste", tagline: "t", domain: "t.com", catalogChannel: "mypetbrasil", logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#0a5", pinkDark: "#084", pinkLight: "#efe", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

const product = { id: "p1", name: "Coleira P", sku: "COL-1", brand: null, img: "/c.jpg", unitPrice: 9.9 };

function renderControl() {
  return render(
    createElement(ClientConfigProvider, { config },
      createElement(CartProvider, null, createElement(CartStepperControl, { product }))),
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("CartStepperControl", () => {
  it("mostra Adicionar quando o item não está no carrinho", () => {
    renderControl();
    expect(screen.getByRole("button", { name: "Adicionar Coleira P" })).toBeInTheDocument();
  });

  it("vira stepper ao adicionar e acompanha a quantidade do carrinho", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Coleira P" }));
    expect(screen.getByText("1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade de Coleira P" }));
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("mypet_cart") ?? "{}").items[0]).toMatchObject({ id: "p1", qty: 2, unitPrice: 9.9 });
  });

  it("remove do carrinho ao diminuir de 1 para 0", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Coleira P" }));
    fireEvent.click(screen.getByRole("button", { name: "Diminuir quantidade de Coleira P" }));
    expect(screen.getByRole("button", { name: "Adicionar Coleira P" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("mypet_cart") ?? "{}").items).toEqual([]);
  });
});
