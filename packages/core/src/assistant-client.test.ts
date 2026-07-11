import { describe, it, expect, vi, afterEach } from "vitest";
import { askAssistant } from "./assistant-client";

const messages = [{ role: "user" as const, content: "quero ração para filhotes" }];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("askAssistant", () => {
  it("retorna o resultado quando a resposta é ok", async () => {
    const payload = { ok: true, reply: "Aqui estão algumas opções.", products: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }));
    const result = await askAssistant("mypetbrasil", messages);
    expect(result).toEqual(payload);
  });

  it("retorna a mensagem do servidor em erro 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, error: { code: "INVALID_INPUT", message: "Nenhuma mensagem informada." } }),
      }),
    );
    const result = await askAssistant("mypetbrasil", messages);
    expect(result).toEqual({ ok: false, error: "Nenhuma mensagem informada." });
  });

  it("retorna mensagem genérica em erro 400 sem corpo utilizável", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => {
          throw new Error("bad json");
        },
      }),
    );
    const result = await askAssistant("mypetbrasil", messages);
    expect(result).toEqual({ ok: false, error: "Não entendi sua mensagem. Tente reformular." });
  });

  it("retorna mensagem genérica de servidor em erro 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }));
    const result = await askAssistant("mypetbrasil", messages);
    expect(result).toEqual({
      ok: false,
      error: "Não foi possível processar sua mensagem agora. Tente novamente em instantes.",
    });
  });

  it("retorna mensagem de conexão quando o fetch rejeita", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await askAssistant("mypetbrasil", messages);
    expect(result).toEqual({
      ok: false,
      error: "Não foi possível conectar. Verifique sua internet e tente novamente.",
    });
  });
});
