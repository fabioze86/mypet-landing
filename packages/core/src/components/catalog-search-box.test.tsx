// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/",
}));

import { ClientConfigProvider, type ClientConfig } from "../theme";
import { CatalogSearchBox } from "./catalog-search-box";

const config: ClientConfig = {
  name: "Teste", tagline: "t", domain: "t.com", catalogChannel: "mypetbrasil", logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#0a5", pinkDark: "#084", pinkLight: "#efe", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

function renderBox(props: { initialQuery?: string; brand?: string } = {}) {
  return render(createElement(ClientConfigProvider, { config }, createElement(CatalogSearchBox, props)));
}

beforeEach(() => {
  vi.useFakeTimers();
  nav.replace.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CatalogSearchBox", () => {
  it("começa com a busca atual", () => {
    renderBox({ initialQuery: "coleira" });
    expect(screen.getByRole("searchbox", { name: "Buscar produtos" })).toHaveValue("coleira");
  });

  it("atualiza a URL só depois da pausa na digitação, voltando à página 1", () => {
    renderBox({ brand: "NAPI" });
    const input = screen.getByRole("searchbox", { name: "Buscar produtos" });
    fireEvent.change(input, { target: { value: "co" } });
    fireEvent.change(input, { target: { value: "coleira" } });
    expect(nav.replace).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(300); });

    expect(nav.replace).toHaveBeenCalledOnce();
    expect(nav.replace).toHaveBeenCalledWith("/?q=coleira&brand=NAPI", { scroll: false });
  });

  it("campo vazio remove o q", () => {
    renderBox({ initialQuery: "coleira" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar produtos" }), { target: { value: "  " } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(nav.replace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("não repete a navegação quando o texto aparado não mudou", () => {
    renderBox({ initialQuery: "coleira" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar produtos" }), { target: { value: "coleira " } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("não sobrescreve o que o usuário digitou quando a prop volta com a busca já enviada", () => {
    const wrap = (initialQuery?: string) =>
      createElement(ClientConfigProvider, { config }, createElement(CatalogSearchBox, { initialQuery }));
    const { rerender } = render(wrap(undefined));
    const input = screen.getByRole("searchbox", { name: "Buscar produtos" });
    fireEvent.change(input, { target: { value: "co" } });
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.change(input, { target: { value: "col" } });
    rerender(wrap("co"));
    expect(input).toHaveValue("col");
  });

  it("acompanha navegação externa (voltar no histórico)", () => {
    const wrap = (initialQuery?: string) =>
      createElement(ClientConfigProvider, { config }, createElement(CatalogSearchBox, { initialQuery }));
    const { rerender } = render(wrap("coleira"));
    rerender(wrap("areia"));
    expect(screen.getByRole("searchbox", { name: "Buscar produtos" })).toHaveValue("areia");
  });
});
