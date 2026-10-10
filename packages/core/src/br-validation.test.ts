import { describe, expect, it } from "vitest";
import { formatCnpj, formatWhatsapp, isValidCnpj, normalizeWhatsapp, onlyDigits, validateIdentity } from "./br-validation";

describe("isValidCnpj", () => {
  it("aceita CNPJ válido", () => expect(isValidCnpj("11222333000181")).toBe(true));
  it("recusa dígito verificador errado", () => expect(isValidCnpj("11222333000182")).toBe(false));
  it("recusa dígitos repetidos e tamanho errado", () => {
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
  });
});

describe("normalizeWhatsapp", () => {
  it.each([
    ["(11) 99999-8888", "5511999998888"],
    ["11 3333-4444", "551133334444"],
    ["+55 11 99999-8888", "5511999998888"],
    ["5511999998888", "5511999998888"],
  ])("%s → %s", (input, expected) => expect(normalizeWhatsapp(input)).toBe(expected));

  it.each(["", "9999-8888", "119999988887777"])("recusa %s", (input) => expect(normalizeWhatsapp(input)).toBeNull());
});

describe("máscaras", () => {
  it("formatCnpj é progressiva", () => {
    expect(formatCnpj("11")).toBe("11");
    expect(formatCnpj("112223")).toBe("11.222.3");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("11.222.333/0001-8199")).toBe("11.222.333/0001-81");
  });
  it("formatWhatsapp é progressiva e aceita 55", () => {
    expect(formatWhatsapp("")).toBe("");
    expect(formatWhatsapp("1")).toBe("(1");
    expect(formatWhatsapp("119999")).toBe("(11) 9999");
    expect(formatWhatsapp("1133334444")).toBe("(11) 3333-4444");
    expect(formatWhatsapp("11999998888")).toBe("(11) 99999-8888");
    expect(formatWhatsapp("5511999998888")).toBe("(11) 99999-8888");
  });
  it("onlyDigits", () => expect(onlyDigits("a1-2.3")).toBe("123"));
});

describe("validateIdentity", () => {
  it("normaliza e aceita sem CNPJ", () => {
    expect(validateIdentity({ nome: "  Ana  ", whatsapp: "(11) 99999-8888", cnpj: "" })).toEqual({
      ok: true,
      value: { nome: "Ana", whatsapp: "5511999998888", cnpj: null },
    });
  });
  it("aceita CNPJ válido com máscara", () => {
    const result = validateIdentity({ nome: "Ana", whatsapp: "11999998888", cnpj: "11.222.333/0001-81" });
    expect(result).toEqual({ ok: true, value: { nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" } });
  });
  it.each([
    [{ nome: "", whatsapp: "11999998888" }, "nome", "Informe seu nome."],
    [{ nome: "A", whatsapp: "11999998888" }, "nome", "Informe seu nome."],
    [{ nome: "x".repeat(121), whatsapp: "11999998888" }, "nome", "Nome muito longo."],
    [{ nome: "Ana", whatsapp: "9999" }, "whatsapp", "Informe o WhatsApp com DDD."],
    [{ nome: "Ana", whatsapp: "11999998888", cnpj: "123" }, "cnpj", "CNPJ inválido."],
    [{ nome: 42, whatsapp: null }, "nome", "Informe seu nome."],
  ])("recusa %j", (input, field, error) => {
    expect(validateIdentity(input)).toEqual({ ok: false, field, error });
  });
});
