import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBuyerById, createBuyer, localizarComprador } from "./buyers-server";
import { fakeSupabase } from "./test-utils/fake-supabase";

describe("getBuyerById", () => {
  it("retorna o buyer quando encontrado", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "u1", email: "a@a.com", nome: "João", empresa: "Pet X", whatsapp: "11999999999", cnpj: null, uf: null, municipio: null, cep: null, localizacao_status: null },
      error: null,
    });
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single })),
    } as unknown as SupabaseClient;

    const buyer = await getBuyerById(supabase, "u1");

    expect(supabase.from).toHaveBeenCalledWith("buyers");
    expect(buyer).toEqual({ id: "u1", email: "a@a.com", nome: "João", empresa: "Pet X", whatsapp: "11999999999", cnpj: null, uf: null, municipio: null, cep: null, localizacao_status: null });
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

  it("aceita nome e empresa nulos", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient;

    const result = await createBuyer(supabase, {
      id: "u1",
      email: null,
      whatsapp: "5511999999999",
      cnpj: "12345678000195",
    });

    expect(insert).toHaveBeenCalledWith({
      id: "u1",
      email: null,
      nome: null,
      empresa: null,
      whatsapp: "5511999999999",
      cnpj: "12345678000195",
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

describe("localizarComprador", () => {
  const ok = (body: unknown, status = 200) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  const buyer = { id: "u1", cnpj: "12345678000199", localizacao_status: null };

  it("grava localizado com uf, município e cep", async () => {
    const { client, calls } = fakeSupabase({ buyers: [{}] });
    await localizarComprador(client, buyer, ok({ status: "OK", uf: "SP", municipio: "SAO PAULO", cep: "04210000" }));
    const update = calls.find((c) => c.method === "update");
    expect(update?.args[0]).toMatchObject({
      uf: "SP",
      municipio: "SAO PAULO",
      cep: "04210000",
      localizacao_status: "localizado",
    });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "id" && c.args[1] === "u1")).toBe(true);
  });

  it("grava nao_localizado para CNPJ inválido", async () => {
    const { client, calls } = fakeSupabase({ buyers: [{}] });
    await localizarComprador(client, buyer, ok({ status: "ERROR" }));
    expect(calls.find((c) => c.method === "update")?.args[0]).toMatchObject({ localizacao_status: "nao_localizado" });
  });

  it("grava nao_localizado sem consultar quando não há CNPJ", async () => {
    const f = ok({});
    const { client, calls } = fakeSupabase({ buyers: [{}] });
    await localizarComprador(client, { ...buyer, cnpj: null }, f);
    expect(f).not.toHaveBeenCalled();
    expect(calls.find((c) => c.method === "update")?.args[0]).toMatchObject({ localizacao_status: "nao_localizado" });
  });

  it("não grava nada quando a ReceitaWS está indisponível", async () => {
    const { client, calls } = fakeSupabase({ buyers: [{}] });
    await localizarComprador(client, buyer, ok({}, 429));
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("não consulta quem já foi localizado", async () => {
    const f = ok({});
    const { client } = fakeSupabase({});
    await localizarComprador(client, { ...buyer, localizacao_status: "localizado" }, f);
    expect(f).not.toHaveBeenCalled();
  });

  it("não lança quando o update falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeSupabase({ buyers: [{ error: { message: "x" } }] });
    await expect(
      localizarComprador(client, buyer, ok({ status: "OK", uf: "SP", municipio: "SAO PAULO", cep: "04210000" })),
    ).resolves.toBeUndefined();
  });
});
