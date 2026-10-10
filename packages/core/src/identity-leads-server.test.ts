import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ insert: vi.fn(), error: null as null | { message: string } }));

vi.mock("./supabase", () => ({
  getHubClient: () => ({
    from: (table: string) => {
      if (table !== "leads") throw new Error(`tabela inesperada: ${table}`);
      return {
        insert: async (row: unknown) => {
          state.insert(row);
          return { error: state.error };
        },
      };
    },
  }),
}));

import { createIdentityLeadHandler } from "./identity-leads-server";

function fakeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const all = new Headers({ "content-type": "application/json", host: "loja.exemplo.com", ...headers });
  return { json: async () => body, headers: all, nextUrl: { host: "loja.exemplo.com" } } as unknown as NextRequest;
}

const POST = createIdentityLeadHandler("mypetbrasil");

beforeEach(() => {
  state.insert.mockReset();
  state.error = null;
});

describe("createIdentityLeadHandler", () => {
  it("grava nome, WhatsApp normalizado, CNPJ só dígitos e empresa nula", async () => {
    const res = await POST(fakeRequest({ nome: " Ana ", whatsapp: "(11) 99999-8888", cnpj: "11.222.333/0001-81" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.insert).toHaveBeenCalledWith({
      nome: "Ana",
      empresa: null,
      whatsapp: "5511999998888",
      cnpj: "11222333000181",
      channel: "mypetbrasil",
    });
  });

  it("CNPJ é opcional", async () => {
    await POST(fakeRequest({ nome: "Ana", whatsapp: "11999998888" }));
    expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({ cnpj: null }));
  });

  it.each([
    [{ nome: "", whatsapp: "11999998888" }, "nome"],
    [{ nome: "Ana", whatsapp: "123" }, "whatsapp"],
    [{ nome: "Ana", whatsapp: "11999998888", cnpj: "11222333000182" }, "cnpj"],
  ])("400 com o campo inválido %j", async (body, field) => {
    const res = await POST(fakeRequest(body));
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe(field);
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("400 com JSON inválido", async () => {
    const req = { json: async () => { throw new SyntaxError("x"); }, headers: new Headers({ "content-type": "application/json" }), nextUrl: { host: "loja.exemplo.com" } } as unknown as NextRequest;
    expect((await POST(req)).status).toBe(400);
  });

  it("415 e 403 pela guarda", async () => {
    expect((await POST(fakeRequest({}, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(fakeRequest({}, { origin: "https://mal.com" }))).status).toBe(403);
  });

  it("500 quando o banco falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.error = { message: "falhou" };
    const res = await POST(fakeRequest({ nome: "Ana", whatsapp: "11999998888" }));
    expect(res.status).toBe(500);
  });
});
