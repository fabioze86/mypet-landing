import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBuyerById, createBuyer } from "./buyers-server";

describe("getBuyerById", () => {
  it("retorna o buyer quando encontrado", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "u1", email: "a@a.com", nome: "João", empresa: "Pet X", whatsapp: "11999999999", cnpj: null },
      error: null,
    });
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single })),
    } as unknown as SupabaseClient;

    const buyer = await getBuyerById(supabase, "u1");

    expect(supabase.from).toHaveBeenCalledWith("buyers");
    expect(buyer).toEqual({ id: "u1", email: "a@a.com", nome: "João", empresa: "Pet X", whatsapp: "11999999999", cnpj: null });
  });

  it("retorna null quando não encontrado", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single })),
    } as unknown as SupabaseClient;

    const buyer = await getBuyerById(supabase, "u1");
    expect(buyer).toBeNull();
  });
});

describe("createBuyer", () => {
  it("grava o buyer com cnpj vazio virando null", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient;

    const result = await createBuyer(supabase, {
      id: "u1",
      email: "a@a.com",
      nome: "João",
      empresa: "Pet X",
      whatsapp: "11999999999",
    });

    expect(supabase.from).toHaveBeenCalledWith("buyers");
    expect(insert).toHaveBeenCalledWith({
      id: "u1",
      email: "a@a.com",
      nome: "João",
      empresa: "Pet X",
      whatsapp: "11999999999",
      cnpj: null,
    });
    expect(result.error).toBeNull();
  });

  it("retorna erro genérico quando o Supabase falha", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: "conexão recusada" } });
    const supabase = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient;

    const result = await createBuyer(supabase, {
      id: "u1",
      email: "a@a.com",
      nome: "João",
      empresa: "Pet X",
      whatsapp: "11999999999",
    });

    expect(result.error).toBe("Não foi possível concluir seu cadastro. Tente novamente em instantes.");
  });
});
