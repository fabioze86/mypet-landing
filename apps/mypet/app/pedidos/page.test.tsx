import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const requireBuyer = vi.fn();
const redirect = vi.fn((_to: string) => {
  throw new Error("REDIRECT");
});

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@mypet/core/supabase", () => ({ getHubServiceClient: () => ({ __hub: true }) }));
vi.mock("@mypet/core/orders-server", () => ({ getOrdersByBuyer: async () => [] }));
vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({ cart: { items: [] }, clear: vi.fn() }),
}));
vi.mock("../agente/navigate", () => ({ goTo: vi.fn() }));

import { PedidosContent } from "./page";

beforeEach(() => {
  requireBuyer.mockReset();
  redirect.mockClear();
});

describe("PedidosPage", () => {
  it("redireciona para o cadastro com volta para os pedidos quando não há comprador", async () => {
    requireBuyer.mockResolvedValue(null);

    await expect(PedidosContent()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/cadastro?next=%2Fpedidos");
  });

  it("mostra o cabeçalho com o comprador e o estado vazio dos pedidos", async () => {
    requireBuyer.mockResolvedValue({ id: "b1", nome: "Ana" });

    render(await PedidosContent());

    expect(screen.getByText(/Olá, Ana/)).toBeInTheDocument();
    expect(screen.getByText("Você ainda não fez nenhum pedido.")).toBeInTheDocument();
  });
});
