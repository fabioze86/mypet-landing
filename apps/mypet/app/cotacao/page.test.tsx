import { describe, it, expect, vi, beforeEach } from "vitest";

const requireBuyer = vi.fn();
const redirect = vi.fn((_to: string) => {
  throw new Error("REDIRECT");
});

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@/lib/localizacao", () => ({ agendarLocalizacao: vi.fn() }));

import { CotacaoPageBody } from "./page";

beforeEach(() => {
  requireBuyer.mockReset();
  redirect.mockClear();
});

describe("CotacaoPage", () => {
  it("redireciona para o cadastro com volta para o pedido quando não há comprador", async () => {
    requireBuyer.mockResolvedValue(null);
    await expect(CotacaoPageBody({ vitrineId: "completo" })).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/cadastro?next=%2Fcotacao");
  });
});
