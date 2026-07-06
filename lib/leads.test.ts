import { describe, it, expect, vi, afterEach } from "vitest";
import { submitLead } from "./leads";

const form = { nome: "João", empresa: "Pet Shop X", whatsapp: "11999999999", cnpj: "" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitLead", () => {
  it("retorna null quando a resposta é ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    const error = await submitLead(form);
    expect(error).toBeNull();
  });

  it("retorna a mensagem do servidor em erro 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "Campos obrigatórios faltando" }) })
    );
    const error = await submitLead(form);
    expect(error).toBe("Campos obrigatórios faltando");
  });

  it("retorna mensagem genérica em erro 400 sem corpo utilizável", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => { throw new Error("bad json"); } })
    );
    const error = await submitLead(form);
    expect(error).toBe("Verifique os dados informados e tente novamente.");
  });

  it("retorna mensagem genérica de servidor em erro 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const error = await submitLead(form);
    expect(error).toBe("Não foi possível salvar seu cadastro. Tente novamente em instantes.");
  });

  it("retorna mensagem de conexão quando o fetch rejeita", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const error = await submitLead(form);
    expect(error).toBe("Não foi possível conectar. Verifique sua internet e tente novamente.");
  });
});
