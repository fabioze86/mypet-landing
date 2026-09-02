import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const insertMock = vi.fn();
const calls: Record<string, unknown> = {};

vi.mock("./supabase", () => ({
  getHubClient: () => ({
    from: (table: string) => {
      calls["from"] = table;
      return { insert: insertMock };
    },
  }),
}));

import { createLeadsPostHandler, createRetailLead } from "./leads-server";

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  insertMock.mockReset();
  for (const k of Object.keys(calls)) delete calls[k];
});

describe("createLeadsPostHandler", () => {
  it("grava o lead na tabela leads com o canal do handler", async () => {
    insertMock.mockResolvedValue({ error: null });
    const POST = createLeadsPostHandler("mypetbrasil");

    const res = await POST(fakeRequest({ nome: "João", empresa: "Pet X", whatsapp: "11999999999", cnpj: "" }));

    expect(calls["from"]).toBe("leads");
    expect(insertMock).toHaveBeenCalledWith({
      nome: "João",
      empresa: "Pet X",
      whatsapp: "11999999999",
      cnpj: null,
      channel: "mypetbrasil",
    });
    expect(res.status).toBe(200);
  });

  it("retorna 400 quando falta campo obrigatório", async () => {
    const POST = createLeadsPostHandler("distribuidora");
    const res = await POST(fakeRequest({ nome: "", empresa: "Pet X", whatsapp: "11999999999" }));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("retorna 500 genérico quando o Supabase falha", async () => {
    insertMock.mockResolvedValue({ error: { message: "conexão recusada" } });
    const POST = createLeadsPostHandler("mypetbrasil");
    const res = await POST(fakeRequest({ nome: "João", empresa: "Pet X", whatsapp: "11999999999" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Não foi possível salvar seu cadastro. Tente novamente em instantes.");
  });
});

describe("createRetailLead", () => {
  it("insere lead de varejo com empresa e cnpj nulos", async () => {
    insertMock.mockResolvedValue({ error: null });

    const res = await createRetailLead({ channel: "azpetshop", nome: "Maria", whatsapp: "11988887777" });

    expect(calls["from"]).toBe("leads");
    expect(insertMock).toHaveBeenCalledWith({
      nome: "Maria",
      empresa: null,
      whatsapp: "11988887777",
      cnpj: null,
      channel: "azpetshop",
    });
    expect(res).toEqual({ ok: true });
  });

  it("retorna erro quando o Supabase falha", async () => {
    insertMock.mockResolvedValue({ error: { message: "boom" } });
    const res = await createRetailLead({ channel: "azpetshop", nome: "Maria", whatsapp: "11988887777" });
    expect(res).toEqual({ ok: false, error: "boom" });
  });

  it("retorna erro de validação quando falta nome ou whatsapp", async () => {
    const res = await createRetailLead({ channel: "azpetshop", nome: "", whatsapp: "" });
    expect(res).toEqual({ ok: false, error: "Nome e WhatsApp são obrigatórios." });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
