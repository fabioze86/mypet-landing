import { describe, expect, it } from "vitest";
import { parseCep, parseCheckoutInput, parseCheckoutLines } from "./retail-checkout";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

const valid = {
  items: [{ id: ID_A, qty: 2 }],
  customer: { nome: "Maria Souza", cpf: "529.982.247-25", email: "maria@exemplo.com", whatsapp: "(11) 98888-7777" },
  address: { cep: "01001-000", logradouro: "Praça da Sé", numero: "100", complemento: "", bairro: "Sé", cidade: "São Paulo", uf: "sp" },
  shippingServiceId: 1,
};

describe("parseCheckoutLines", () => {
  it("soma quantidades do mesmo produto", () => {
    expect(parseCheckoutLines([{ id: ID_A, qty: 1 }, { id: ID_B, qty: 1 }, { id: ID_A, qty: 2 }])).toEqual({
      ok: true,
      value: [{ id: ID_A, qty: 3 }, { id: ID_B, qty: 1 }],
    });
  });
  it("rejeita vazio, id inválido e quantidade inválida", () => {
    expect(parseCheckoutLines([]).ok).toBe(false);
    expect(parseCheckoutLines([{ id: "x", qty: 1 }]).ok).toBe(false);
    expect(parseCheckoutLines([{ id: ID_A, qty: 0 }]).ok).toBe(false);
    expect(parseCheckoutLines([{ id: ID_A, qty: 1.5 }]).ok).toBe(false);
    expect(parseCheckoutLines("nada").ok).toBe(false);
  });
});

describe("parseCep", () => {
  it("aceita com ou sem traço e devolve só dígitos", () => {
    expect(parseCep("01001-000")).toEqual({ ok: true, value: "01001000" });
  });
  it("rejeita CEP incompleto", () => {
    expect(parseCep("0100").ok).toBe(false);
  });
});

describe("parseCheckoutInput", () => {
  it("normaliza CPF, WhatsApp, CEP e UF", () => {
    const r = parseCheckoutInput(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.customer).toEqual({ nome: "Maria Souza", cpf: "52998224725", email: "maria@exemplo.com", whatsapp: "5511988887777" });
    expect(r.value.address.cep).toBe("01001000");
    expect(r.value.address.uf).toBe("SP");
    expect(r.value.shippingServiceId).toBe(1);
  });

  it.each([
    ["CPF inválido", { customer: { ...valid.customer, cpf: "111.111.111-11" } }, "CPF"],
    ["e-mail inválido", { customer: { ...valid.customer, email: "maria" } }, "e-mail"],
    ["WhatsApp inválido", { customer: { ...valid.customer, whatsapp: "123" } }, "WhatsApp"],
    ["nome curto", { customer: { ...valid.customer, nome: "M" } }, "nome"],
    ["número ausente", { address: { ...valid.address, numero: "" } }, "endereço"],
    ["UF inválida", { address: { ...valid.address, uf: "XX1" } }, "endereço"],
    ["frete não escolhido", { shippingServiceId: undefined }, "frete"],
  ])("rejeita %s", (_label, patch, palavra) => {
    const r = parseCheckoutInput({ ...valid, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain(palavra.toLowerCase());
  });
});
