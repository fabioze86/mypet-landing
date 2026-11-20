import { describe, expect, it, vi } from "vitest";
import { consultarCnpj } from "./receitaws";

const resp = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("consultarCnpj", () => {
  it("devolve localizado com uf, município e cep só com dígitos", async () => {
    const f = resp(200, { status: "OK", uf: "SP", municipio: "SAO PAULO", cep: "04.210-000" });
    expect(await consultarCnpj("12345678000199", f)).toEqual({
      kind: "localizado",
      uf: "SP",
      municipio: "SAO PAULO",
      cep: "04210000",
    });
    expect(f).toHaveBeenCalledWith("https://www.receitaws.com.br/v1/cnpj/12345678000199", expect.anything());
  });

  it("status ERROR vira nao_localizado", async () => {
    expect(await consultarCnpj("12345678000199", resp(200, { status: "ERROR", message: "CNPJ inválido" }))).toEqual({
      kind: "nao_localizado",
    });
  });

  it("200 sem uf vira nao_localizado", async () => {
    expect(await consultarCnpj("12345678000199", resp(200, { status: "OK" }))).toEqual({ kind: "nao_localizado" });
  });

  it("CNPJ fora do formato não consulta e vira nao_localizado", async () => {
    const f = resp(200, {});
    expect(await consultarCnpj("123", f)).toEqual({ kind: "nao_localizado" });
    expect(f).not.toHaveBeenCalled();
  });

  it("429, 500 e erro de rede viram indisponivel", async () => {
    expect(await consultarCnpj("12345678000199", resp(429, {}))).toEqual({ kind: "indisponivel" });
    expect(await consultarCnpj("12345678000199", resp(500, {}))).toEqual({ kind: "indisponivel" });
    const boom = vi.fn(async () => {
      throw new Error("rede");
    }) as unknown as typeof fetch;
    expect(await consultarCnpj("12345678000199", boom)).toEqual({ kind: "indisponivel" });
  });

  it("aceita CNPJ com máscara", async () => {
    const f = resp(200, { status: "OK", uf: "RJ", municipio: "RIO DE JANEIRO", cep: "20040002" });
    await consultarCnpj("12.345.678/0001-99", f);
    expect(f).toHaveBeenCalledWith("https://www.receitaws.com.br/v1/cnpj/12345678000199", expect.anything());
  });
});
