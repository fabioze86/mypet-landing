import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Palette } from "@mypet/core/theme";
import { PedidoRapidoCta } from "./pedido-rapido-cta";

const palette: Palette = {
  pink: "#f0a", pinkDark: "#c07", pinkLight: "#fde", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
  navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
  gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
};

describe("PedidoRapidoCta", () => {
  it("linka para /pedido-rapido", () => {
    const markup = renderToStaticMarkup(createElement(PedidoRapidoCta, { palette }));

    expect(markup).toContain('href="/pedido-rapido"');
    expect(markup).toContain("Pedido rápido");
  });
});
