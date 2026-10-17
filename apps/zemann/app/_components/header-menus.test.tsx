import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { HeaderMenus } from "./header-menus";
import { MENU_GROUPS } from "@/lib/pages";

const first = MENU_GROUPS[0];
const firstLink = first.items[0].page;

// jsdom não implementa navegação: o clique no link é cancelado depois que o React o processa.
beforeEach(() => {
  document.addEventListener("click", (e) => e.preventDefault());
});

function desktopButton(label = first.label) {
  const nav = screen.getByRole("navigation", { name: "Principal" });
  return within(nav).getByRole("button", { name: new RegExp(label) });
}

describe("HeaderMenus", () => {
  beforeEach(() => {
    pathname = "/";
  });

  it("abre o grupo ao clicar e liga aria-controls ao painel", () => {
    render(<HeaderMenus />);
    const btn = desktopButton();
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(btn.getAttribute("aria-controls")!);
    expect(panel).not.toBeNull();
    expect(within(panel!).getByRole("link", { name: new RegExp(firstLink.nav ?? firstLink.title) })).toBeInTheDocument();
  });

  it("mantém um grupo aberto por vez", () => {
    render(<HeaderMenus />);
    const a = desktopButton(MENU_GROUPS[0].label);
    const b = desktopButton(MENU_GROUPS[1].label);
    fireEvent.click(a);
    fireEvent.click(b);
    expect(a).toHaveAttribute("aria-expanded", "false");
    expect(b).toHaveAttribute("aria-expanded", "true");
  });

  it("Escape fecha e devolve o foco ao botão", () => {
    render(<HeaderMenus />);
    const btn = desktopButton();
    fireEvent.click(btn);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveFocus();
  });

  it("clicar fora fecha", () => {
    render(<HeaderMenus />);
    const btn = desktopButton();
    fireEvent.click(btn);
    fireEvent.pointerDown(document.body);
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("clicar num link dentro do painel fecha", () => {
    render(<HeaderMenus />);
    const btn = desktopButton();
    fireEvent.click(btn);
    const panel = document.getElementById(btn.getAttribute("aria-controls")!)!;
    fireEvent.click(within(panel).getAllByRole("link")[0]);
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("menu mobile abre e fecha pelo botão e com Escape", () => {
    render(<HeaderMenus />);
    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const nav = screen.getByRole("navigation", { name: "Principal (celular)" });
    expect(within(nav).getByRole("link", { name: "Agendar diagnóstico" })).toHaveAttribute("data-cta", "menu_diagnostico");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("clicar num link do menu mobile fecha", () => {
    render(<HeaderMenus />);
    const toggle = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(toggle);
    const nav = screen.getByRole("navigation", { name: "Principal (celular)" });
    fireEvent.click(within(nav).getAllByRole("link")[0]);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("fecha os menus quando a rota muda", () => {
    const { rerender } = render(<HeaderMenus />);
    const btn = desktopButton();
    const toggle = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(btn);
    fireEvent.click(toggle);
    pathname = "/servicos";
    rerender(<HeaderMenus />);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
