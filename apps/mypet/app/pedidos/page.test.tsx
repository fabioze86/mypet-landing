import { describe, it, expect, vi, beforeEach } from "vitest";

const requireBuyer = vi.fn();
const redirect = vi.fn((_to: string) => {
  throw new Error("REDIRECT");
});

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@mypet/core/supabase", () => ({ getHubServiceClient: () => ({ __hub: true }) }));
vi.mock("@mypet/core/orders-server", () => ({ getOrdersByBuyer: async () => [] }));

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
});
