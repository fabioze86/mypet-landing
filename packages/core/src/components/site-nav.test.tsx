import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CartProvider } from "./cart-provider";
import { ClientConfigProvider, type ClientConfig } from "../theme";
import { SiteNav } from "./site-nav";

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

describe("SiteNav — link de Consulte preços", () => {
  it("renderiza o link quando pedidoRapidoHref é informado", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(
          CartProvider,
          null,
          createElement(SiteNav, { categories: [], balcaoHref: "/balcao", pedidoRapidoHref: "/pedido-rapido" }),
        ),
      ),
    );

    expect(markup).toContain('href="/pedido-rapido"');
    expect(markup).toContain(">Consulte preços<");
  });

  it("não renderiza o link quando pedidoRapidoHref não é informado", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(CartProvider, null, createElement(SiteNav, { categories: [], balcaoHref: "/balcao" })),
      ),
    );

    expect(markup).not.toContain(">Consulte preços<");
  });
});

describe("SiteNav — link Todas as dúvidas", () => {
  it("renderiza o link quando faqHref é informado", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(
          CartProvider,
          null,
          createElement(SiteNav, { categories: [], faqHref: "/perguntas-frequentes" }),
        ),
      ),
    );

    expect(markup).toContain('href="/perguntas-frequentes"');
    expect(markup).toContain(">Todas as dúvidas<");
  });

  it("não renderiza o link quando faqHref não é informado", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(CartProvider, null, createElement(SiteNav, { categories: [] })),
      ),
    );

    expect(markup).not.toContain(">Todas as dúvidas<");
  });
});

describe("SiteNav — showMegaMenu", () => {
  it("renderiza o menu horizontal de categorias por padrão", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(CartProvider, null, createElement(SiteNav, { categories: [] })),
      ),
    );

    expect(markup).toContain('class="site-nav-mega-menu-row"');
  });

  it("oculta o menu horizontal de categorias quando showMegaMenu é false", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ClientConfigProvider,
        { config },
        createElement(CartProvider, null, createElement(SiteNav, { categories: [], showMegaMenu: false })),
      ),
    );

    expect(markup).not.toContain('class="site-nav-mega-menu-row"');
  });
});
