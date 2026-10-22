import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const requireBuyer = vi.fn();
vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({ cart: { items: [] }, clear: vi.fn() }),
}));
vi.mock("../../agente/navigate", () => ({ goTo: vi.fn() }));

import { HubHeader } from "./hub-header";
import { HubFooter } from "./hub-footer";

beforeEach(() => requireBuyer.mockReset());

describe("HubHeader", () => {
  it("sem cookie: cabeçalho de visitante", async () => {
    requireBuyer.mockResolvedValue(null);
    render(await HubHeader({ current: "duvidas" }));
    expect(screen.getByRole("link", { name: "Abrir tabela" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dúvidas" })).toHaveAttribute("aria-current", "page");
  });

  it("com comprador: cabeçalho de cliente com o nome", async () => {
    requireBuyer.mockResolvedValue({ id: "b1", nome: "Ana", empresa: "Pet X" });
    render(await HubHeader({}));
    expect(screen.getByText("Olá, Ana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tabela de preços" })).toHaveAttribute("href", "/pedido-rapido");
  });
});

describe("HubFooter", () => {
  it("linka a central de ajuda e o site oficial", () => {
    render(<HubFooter />);
    expect(screen.getByRole("link", { name: "Central de ajuda" })).toHaveAttribute("href", "/central-de-ajuda");
    expect(screen.getByRole("link", { name: "mypetbrasil.com" })).toHaveAttribute("href", "https://www.mypetbrasil.com");
  });
});
