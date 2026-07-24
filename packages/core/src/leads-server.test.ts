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

import { createLeadsPostHandler } from "./leads-server";

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
