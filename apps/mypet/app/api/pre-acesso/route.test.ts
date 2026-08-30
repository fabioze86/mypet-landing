import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const provisionBuyer = vi.fn();

vi.mock("@mypet/core/pre-access-server", () => ({
  provisionBuyer: (...args: unknown[]) => provisionBuyer(...args),
  PreAccessError: class PreAccessError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

vi.mock("@mypet/core/access-session", () => ({
  signAccessToken: () => "signed-token",
  ACCESS_COOKIE: "mypet_acesso",
  ACCESS_COOKIE_OPTS: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 2_592_000 },
}));

import { POST } from "./route";
import { PreAccessError } from "@mypet/core/pre-access-server";

function fakeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: new Headers({ "x-forwarded-for": "203.0.113.7" }),
  } as unknown as NextRequest;
}

beforeEach(() => {
  provisionBuyer.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/pre-acesso", () => {
  it("responde 201 com cookie de sessão quando o cadastro é válido", async () => {
    provisionBuyer.mockResolvedValue({ buyerId: "b-1" });
    const res = await POST(fakeRequest({ cnpj: "12.345.678/0001-95", whatsapp: "5511999990000" }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("mypet_acesso=signed-token");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
  });

  it("responde 400 quando o corpo não é JSON válido", async () => {
    provisionBuyer.mockRejectedValue(new PreAccessError("INVALID_INPUT"));
    const badRequest = {
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
      headers: new Headers({ "x-forwarded-for": "203.0.113.7" }),
    } as unknown as NextRequest;
    const res = await POST(badRequest);
    expect(res.status).toBe(400);
    expect(provisionBuyer).toHaveBeenCalledWith(null, expect.anything());
  });

  it("não devolve dado pessoal no corpo", async () => {
    provisionBuyer.mockResolvedValue({ buyerId: "b-1" });
    const res = await POST(fakeRequest({ cnpj: "12345678000195", whatsapp: "5511999990000", email: "loja@example.com" }));
    expect(JSON.stringify(await res.json())).not.toContain("loja@example.com");
  });

  it("mapeia CNPJ inválido para 400 com o campo e a orientação", async () => {
    provisionBuyer.mockRejectedValue(new PreAccessError("INVALID_CNPJ"));
    const res = await POST(fakeRequest({ cnpj: "1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual({
      code: "INVALID_CNPJ",
      field: "cnpj",
      message: "Informe um CNPJ válido.",
    });
  });

  it("mapeia WhatsApp inválido para o campo com o formato esperado", async () => {
    provisionBuyer.mockRejectedValue(new PreAccessError("INVALID_WHATSAPP"));
    const res = await POST(fakeRequest({ cnpj: "12345678000195", whatsapp: "119999" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual({
      code: "INVALID_WHATSAPP",
      field: "whatsapp",
      message: "Informe o WhatsApp com DDD e número.",
    });
  });

  it("mapeia RATE_LIMITED para 429", async () => {
    provisionBuyer.mockRejectedValue(new PreAccessError("RATE_LIMITED"));
    const res = await POST(fakeRequest({ cnpj: "12345678000195", whatsapp: "5511999990000" }));
    expect(res.status).toBe(429);
    expect((await res.json()).error.message).toBe("Aguarde alguns instantes antes de tentar novamente.");
  });

  it("mapeia erro inesperado para 503", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    provisionBuyer.mockRejectedValue(new Error("boom"));
    const res = await POST(fakeRequest({ cnpj: "12345678000195", whatsapp: "5511999990000" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.message).toBe(
      "Não foi possível liberar seu acesso agora. Tente novamente em instantes.",
    );
  });

  it("registra no log o erro real e a presença das envs quando a falha é inesperada", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    provisionBuyer.mockRejectedValue(new Error("SUPABASE_SERVICE_ROLE_KEY precisa estar definido"));
    await POST(fakeRequest({ cnpj: "12345678000195", whatsapp: "5511999990000" }));
    expect(errorLog).toHaveBeenCalledWith(
      "[pre-acesso] falha inesperada ao liberar acesso",
      expect.objectContaining({ message: "SUPABASE_SERVICE_ROLE_KEY precisa estar definido" }),
      expect.objectContaining({
        envPresente: {
          SUPABASE_URL: expect.any(Boolean),
          SUPABASE_SERVICE_ROLE_KEY: expect.any(Boolean),
          ACCESS_SESSION_SECRET: expect.any(Boolean),
        },
      }),
    );
  });
});
