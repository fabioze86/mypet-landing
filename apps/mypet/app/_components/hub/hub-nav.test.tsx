import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const cart = vi.hoisted(() => ({ items: [] as Array<{ qty: number }>, clear: vi.fn() }));
vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({ cart: { items: cart.items }, clear: cart.clear }),
}));
const nav = vi.hoisted(() => ({ goTo: vi.fn() }));
vi.mock("../../agente/navigate", () => ({ goTo: nav.goTo }));

import { HubNav } from "./hub-nav";

beforeEach(() => {
  cart.items = [{ qty: 2 }, { qty: 1 }];
  cart.clear.mockClear();
  nav.goTo.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("HubNav", () => {
  it("visitante: as 4 portas aparecem, tabela e catálogo com selo de cadastro", () => {
    render(<HubNav viewer={{ kind: "visitante" }} />);
    const portas = screen.getByRole("navigation", { name: "Hub My Pet" });
    expect(portas).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tabela de preços com cadastro" })).toHaveAttribute(
      "href",
      "/cadastro?next=%2Fpedido-rapido",
    );
    expect(screen.getByRole("link", { name: "Catálogo com cadastro" })).toHaveAttribute(
      "href",
      "/cadastro?next=%2Fcatalogo",
    );
    expect(screen.getByRole("link", { name: "Agente" })).toHaveAttribute("href", "/agente");
    expect(screen.getByRole("link", { name: "Dúvidas" })).toHaveAttribute("href", "/central-de-ajuda");
  });

  it("visitante: botão Abrir tabela leva ao cadastro e volta para a tabela, sem Sair", () => {
    render(<HubNav viewer={{ kind: "visitante" }} />);
    expect(screen.getByRole("link", { name: "Abrir tabela" })).toHaveAttribute("href", "/cadastro?next=%2Fpedido-rapido");
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Meus pedidos" })).toBeNull();
  });

  it("marca a porta atual com aria-current", () => {
    render(<HubNav viewer={{ kind: "visitante" }} current="duvidas" />);
    expect(screen.getByRole("link", { name: "Dúvidas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Agente" })).not.toHaveAttribute("aria-current");
  });

  it("cliente: portas abertas, Olá com o nome, pedidos, carrinho e Sair", () => {
    render(<HubNav viewer={{ kind: "cliente", displayName: "Ana" }} />);
    expect(screen.getByRole("link", { name: "Tabela de preços" })).toHaveAttribute("href", "/pedido-rapido");
    expect(screen.getByRole("link", { name: "Catálogo" })).toHaveAttribute("href", "/catalogo");
    expect(screen.getByText("Olá, Ana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Meus pedidos" })).toHaveAttribute("href", "/pedidos");
    expect(screen.getByRole("link", { name: "Seu pedido (3)" })).toHaveAttribute("href", "/cotacao");
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir tabela" })).toBeNull();
  });

  it("cliente sem nome: Olá!; carrinho vazio sem contador", () => {
    cart.items = [];
    render(<HubNav viewer={{ kind: "cliente", displayName: null }} />);
    expect(screen.getByText("Olá!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Seu pedido" })).toBeInTheDocument();
  });

  it("inert vai para o header", () => {
    const { container } = render(<HubNav viewer={{ kind: "visitante" }} inert />);
    expect(container.querySelector("header.hub-header")).toHaveAttribute("inert");
  });

  it("Sair: chama /api/sair, limpa carrinho, conversa e lead e vai para a home", async () => {
    window.sessionStorage.setItem("mypet-agente-conversa", "{}");
    window.localStorage.setItem("mypet_agente_lead", "{}");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<HubNav viewer={{ kind: "cliente", displayName: "Ana" }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/sair", expect.objectContaining({ method: "POST" }));
    expect(cart.clear).toHaveBeenCalled();
    expect(window.sessionStorage.getItem("mypet-agente-conversa")).toBeNull();
    expect(window.localStorage.getItem("mypet_agente_lead")).toBeNull();
    expect(nav.goTo).toHaveBeenCalledWith("/");
  });

  it("Sair com falha: mostra erro e não limpa nada", async () => {
    window.localStorage.setItem("mypet_agente_lead", "{}");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    render(<HubNav viewer={{ kind: "cliente", displayName: "Ana" }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível sair agora. Tente de novo.");
    expect(cart.clear).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("mypet_agente_lead")).toBe("{}");
    expect(nav.goTo).not.toHaveBeenCalled();
  });
});
