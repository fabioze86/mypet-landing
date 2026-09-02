import { describe, it, expect, vi, beforeEach } from "vitest";

const createRetailLead = vi.fn();
vi.mock("@mypet/core/leads-server", () => ({
  createRetailLead: (input: unknown) => createRetailLead(input),
}));

import { finalizeQuote } from "./actions";

beforeEach(() => {
  createRetailLead.mockReset();
});

describe("finalizeQuote", () => {
  it("grava o lead de varejo no canal azpetshop e retorna ok", async () => {
    createRetailLead.mockResolvedValue({ ok: true });

    const result = await finalizeQuote({ nome: "Maria", whatsapp: "11988887777" });

    expect(createRetailLead).toHaveBeenCalledWith({
      channel: "azpetshop",
      nome: "Maria",
      whatsapp: "11988887777",
    });
    expect(result).toEqual({ ok: true });
  });

  it("retorna erro de validação sem chamar o core quando falta nome", async () => {
    const result = await finalizeQuote({ nome: "  ", whatsapp: "11988887777" });
    expect(result).toEqual({ ok: false, error: "Informe seu nome e WhatsApp." });
    expect(createRetailLead).not.toHaveBeenCalled();
  });

  it("segue mesmo se a gravação do lead falhar (não bloqueia a cotação)", async () => {
    createRetailLead.mockResolvedValue({ ok: false, error: "boom" });
    const result = await finalizeQuote({ nome: "Maria", whatsapp: "11988887777" });
    expect(result).toEqual({ ok: true });
  });
});
