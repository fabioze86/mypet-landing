import { describe, expect, it } from "vitest";
import { isValidCnpj } from "@mypet/core/br-validation";
import { EMPRESA, RETAIL, cepFormatado, enderecoEmLinha, ruaEmLinha } from "./empresa";

describe("EMPRESA", () => {
  it("tem CNPJ válido e só com dígitos", () => {
    expect(EMPRESA.cnpj).toMatch(/^\d{14}$/);
    expect(isValidCnpj(EMPRESA.cnpj)).toBe(true);
  });

  it("tem WhatsApp com DDI 55 e e-mail", () => {
    expect(EMPRESA.whatsapp).toMatch(/^55\d{10,11}$/);
    expect(EMPRESA.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });

  it("tem CEP com 8 dígitos e UF com 2 letras", () => {
    expect(EMPRESA.endereco.cep).toMatch(/^\d{8}$/);
    expect(EMPRESA.endereco.uf).toMatch(/^[A-Z]{2}$/);
  });

  it("monta o endereço em uma linha", () => {
    const linha = enderecoEmLinha(EMPRESA.endereco);
    expect(linha).toContain(EMPRESA.endereco.cidade);
    expect(linha).toContain(`${EMPRESA.endereco.cep.slice(0, 5)}-${EMPRESA.endereco.cep.slice(5)}`);
  });

  it("formata o CEP e a rua em linha", () => {
    expect(cepFormatado("01001000")).toBe("01001-000");
    expect(ruaEmLinha({ ...EMPRESA.endereco, logradouro: "Rua A", numero: "10", complemento: "" })).toBe("Rua A, 10");
    expect(ruaEmLinha({ ...EMPRESA.endereco, logradouro: "Rua A", numero: "10", complemento: "Sala 2" })).toBe("Rua A, 10, Sala 2");
  });

  it("RETAIL consulta pelo WhatsApp da empresa", () => {
    expect(RETAIL.consultWhatsApp).toBe(EMPRESA.whatsapp);
    expect(RETAIL.installments.max).toBeGreaterThanOrEqual(1);
  });
});
