// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CartProvider } from "./cart-provider";
import { ClientConfigProvider, type ClientConfig } from "../theme";
import { SiteNav } from "./site-nav";

const config: ClientConfig = {
  name: "Teste", tagline: "t", domain: "t.com", catalogChannel: "mypetbrasil", logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#0a5", pinkDark: "#084", pinkLight: "#efe", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

function nav(showMegaMenu?: boolean) {
  return createElement(
    ClientConfigProvider,
    { config },
    createElement(CartProvider, null, createElement(SiteNav, { categories: [], showMegaMenu })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty("--site-nav-height");
});

describe("SiteNav — altura exposta em --site-nav-height", () => {
  it("define estimativas em CSS para desktop e mobile (com mega-menu)", () => {
    const markup = renderToStaticMarkup(nav());
    expect(markup).toContain("--site-nav-height: 109px");
    expect(markup).toContain("--site-nav-height: 57px");
  });

  it("sem mega-menu a estimativa de desktop é só a linha principal", () => {
    const markup = renderToStaticMarkup(nav(false));
    expect(markup).toContain("--site-nav-height: 65px");
    expect(markup).not.toContain("--site-nav-height: 109px");
  });

  it("publica a altura medida no :root e remove ao desmontar", () => {
    let callback: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(cb: () => void) { callback = cb; }
      observe() {}
      disconnect() { disconnect(); }
    });
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 121 } as DOMRect);

    const { unmount } = render(nav());
    expect(document.documentElement.style.getPropertyValue("--site-nav-height")).toBe("121px");

    spy.mockReturnValue({ height: 130 } as DOMRect);
    act(() => { callback?.(); });
    expect(document.documentElement.style.getPropertyValue("--site-nav-height")).toBe("130px");

    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue("--site-nav-height")).toBe("");
    spy.mockRestore();
  });
});
