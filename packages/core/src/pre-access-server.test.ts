import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  attemptsCount: 0,
  buyerRow: null as { id: string; whatsapp: string } | null,
  insertError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  insertedRow: null as Record<string, unknown> | null,
  updatedRow: null as Record<string, unknown> | null,
};

vi.mock("./supabase", () => ({
  getHubServiceClient: () => ({
    from: (table: string) => {
      if (table === "pre_access_attempts") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          select: () => ({
            eq: () => ({
              gte: () => Promise.resolve({ count: state.attemptsCount, error: null }),
            }),
          }),
        };
      }
      // table === "buyers"
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: state.buyerRow, error: null }),
          }),
        }),
        insert: (row: Record<string, unknown>) => {
          state.insertedRow = row;
          return {
            select: () => ({
              single: () =>
                Promise.resolve(
                  state.insertError
                    ? { data: null, error: state.insertError }
                    : { data: { id: "new-buyer" }, error: null },
                ),
            }),
          };
        },
        update: (row: Record<string, unknown>) => {
          state.updatedRow = row;
          return { eq: () => Promise.resolve({ error: state.updateError }) };
        },
      };
    },
  }),
}));

import { normalizePreAccessInput, validatePreAccessInput, provisionBuyer, PreAccessError } from "./pre-access-server";

beforeEach(() => {
  state.attemptsCount = 0;
  state.buyerRow = null;
  state.insertError = null;
  state.updateError = null;
  state.insertedRow = null;
  state.updatedRow = null;
});

describe("normalizePreAccessInput", () => {
  it("reduz cnpj e whatsapp a dígitos e normaliza o e-mail", () => {
    expect(
      normalizePreAccessInput({
        cnpj: "12.345.678/0001-95",
        whatsapp: "+55 (11) 99999-0000",
        email: "  LOJA@Example.com ",
      }),
    ).toEqual({ cnpj: "12345678000195", whatsapp: "5511999990000", email: "loja@example.com" });
  });

  it("trata e-mail ausente ou vazio como null", () => {
    expect(normalizePreAccessInput({ cnpj: "1", whatsapp: "2" }).email).toBeNull();
    expect(normalizePreAccessInput({ cnpj: "1", whatsapp: "2", email: "   " }).email).toBeNull();
  });
});

describe("validatePreAccessInput", () => {
  const ok = { cnpj: "12345678000195", whatsapp: "5511999990000", email: null };

  it("aceita cnpj + whatsapp válidos sem e-mail", () => {
    expect(validatePreAccessInput(ok)).toBeNull();
  });

  it("rejeita cnpj com dígito verificador errado", () => {
    expect(validatePreAccessInput({ ...ok, cnpj: "12345678000100" })).toBe("INVALID_INPUT");
  });

  it("rejeita whatsapp fora do padrão 55 + 10/11 dígitos", () => {
    expect(validatePreAccessInput({ ...ok, whatsapp: "11999990000" })).toBe("INVALID_INPUT");
  });

  it("rejeita e-mail presente e malformado", () => {
    expect(validatePreAccessInput({ ...ok, email: "sem-arroba" })).toBe("INVALID_INPUT");
  });
});

describe("provisionBuyer", () => {
  const valid = { cnpj: "12.345.678/0001-95", whatsapp: "55 11 99999-0000", email: "loja@example.com" };

  it("cria um comprador novo quando o CNPJ não existe", async () => {
    const result = await provisionBuyer(valid);
    expect(result).toEqual({ buyerId: "new-buyer" });
    expect(state.insertedRow).toMatchObject({
      cnpj: "12345678000195",
      whatsapp: "5511999990000",
      email: "loja@example.com",
      source: "landing",
    });
  });

  it("atualiza o comprador quando o CNPJ existe e o WhatsApp confere", async () => {
    state.buyerRow = { id: "b-1", whatsapp: "5511999990000" };
    const result = await provisionBuyer({ ...valid, email: "novo@example.com" });
    expect(result).toEqual({ buyerId: "b-1" });
    expect(state.updatedRow).toMatchObject({ whatsapp: "5511999990000", email: "novo@example.com" });
  });

  it("recusa quando o CNPJ existe mas o WhatsApp não confere", async () => {
    state.buyerRow = { id: "b-1", whatsapp: "5511888880000" };
    await expect(provisionBuyer(valid)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(state.updatedRow).toBeNull();
  });

  it("recusa input inválido antes de qualquer escrita", async () => {
    await expect(provisionBuyer({ cnpj: "111", whatsapp: "x" })).rejects.toBeInstanceOf(PreAccessError);
    expect(state.insertedRow).toBeNull();
  });

  it("aplica RATE_LIMITED acima de 5 tentativas em 5 min", async () => {
    state.attemptsCount = 6;
    await expect(provisionBuyer(valid)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("mapeia erro do banco para UNAVAILABLE", async () => {
    state.insertError = { message: "connection refused" };
    await expect(provisionBuyer(valid)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});
