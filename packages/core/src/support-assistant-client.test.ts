import { describe, it, expect, vi, afterEach } from "vitest";
import { askSupportAssistant } from "./support-assistant-client";

const messages = [{ role: "user" as const, content: "qual o pedido mínimo?" }];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("askSupportAssistant", () => {
  it("posta em /api/duvidas e devolve a resposta", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, reply: "R$ 250." }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await askSupportAssistant("mypetbrasil", messages);
    expect(result).toEqual({ ok: true, reply: "R$ 250." });
    expect(fetchMock).toHaveBeenCalledWith("/api/duvidas", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ channel: "mypetbrasil", messages });
  });

  it("devolve a mensagem do servidor em erro 4xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, error: { code: "INVALID_INPUT", message: "Mensagem vazia." } }),
      }),
    );
    expect(await askSupportAssistant("mypetbrasil", messages)).toEqual({ ok: false, error: "Mensagem vazia." });
  });

  it("devolve mensagem genérica em erro 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }));
    const result = await askSupportAssistant("mypetbrasil", messages);
    expect(result).toEqual({ ok: false, error: "Não foi possível responder agora. Tente novamente em instantes." });
  });

  it("devolve erro de rede quando o fetch falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await askSupportAssistant("mypetbrasil", messages);
    expect(result.ok).toBe(false);
  });
});
