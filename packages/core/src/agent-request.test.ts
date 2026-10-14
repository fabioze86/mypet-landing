import { describe, it, expect } from "vitest";
import { parseAgentRequest } from "./agent-request";

const id = "3f1c2a7e-8b4d-4c1a-9f2e-1a2b3c4d5e6f";
const message = { id: "m1", role: "user", parts: [{ type: "text", text: "  Tem shampoo?  " }] };

describe("parseAgentRequest", () => {
  it("aceita pedido válido e normaliza a mensagem", () => {
    const result = parseAgentRequest({ id, message, cart: [] });
    expect(result).toEqual({
      ok: true,
      value: { id, message: { id: "m1", role: "user", parts: [{ type: "text", text: "Tem shampoo?" }] }, cart: [] },
    });
  });

  it("junta várias partes de texto", () => {
    const result = parseAgentRequest({
      id,
      message: { ...message, parts: [{ type: "text", text: "Tem " }, { type: "text", text: "shampoo?" }] },
    });
    expect(result.ok && result.value.message.parts).toEqual([{ type: "text", text: "Tem shampoo?" }]);
  });

  it.each([
    ["corpo ausente", null],
    ["id que não é uuid", { id: "abc", message }],
    ["mensagem ausente", { id }],
    ["papel assistant", { id, message: { ...message, role: "assistant" } }],
    ["parte que não é texto", { id, message: { ...message, parts: [{ type: "tool-x", output: {} }] } }],
    ["texto vazio", { id, message: { ...message, parts: [{ type: "text", text: "   " }] } }],
    ["texto acima de 500", { id, message: { ...message, parts: [{ type: "text", text: "a".repeat(501) }] } }],
    ["id de mensagem vazio", { id, message: { ...message, id: "" } }],
    [
      "mais de 20 partes",
      { id, message: { ...message, parts: Array.from({ length: 21 }, () => ({ type: "text", text: "a" })) } },
    ],
  ])("recusa %s", (_label, body) => {
    expect(parseAgentRequest(body).ok).toBe(false);
  });

  it("aceita exatamente 20 partes", () => {
    const parts = Array.from({ length: 20 }, () => ({ type: "text", text: "a" }));
    const result = parseAgentRequest({ id, message: { ...message, parts } });
    expect(result.ok && result.value.message.parts).toEqual([{ type: "text", text: "a".repeat(20) }]);
  });

  it("carrinho: mantém itens válidos, descarta inválidos e achata quebras de linha no nome", () => {
    const result = parseAgentRequest({
      id,
      message,
      cart: [
        { id: "p1", name: "Shampoo\n5L", qty: 2, unitPrice: 89.9 },
        { id: "p2", name: "Sem preço", qty: 1, unitPrice: null },
        { id: "p3", name: "Qtd zero", qty: 0, unitPrice: 1 },
        { id: "p4", name: "Qtd fracionada", qty: 1.5, unitPrice: 1 },
        { id: "p5", name: "Preço negativo", qty: 1, unitPrice: -1 },
        "lixo",
      ],
    });
    expect(result.ok && result.value.cart).toEqual([
      { id: "p1", name: "Shampoo 5L", qty: 2, unitPrice: 89.9 },
      { id: "p2", name: "Sem preço", qty: 1, unitPrice: null },
    ]);
  });

  it("carrinho: no máximo 50 itens; ausente vira lista vazia", () => {
    const cart = Array.from({ length: 60 }, (_, i) => ({ id: `p${i}`, name: "x", qty: 1, unitPrice: 1 }));
    const cheio = parseAgentRequest({ id, message, cart });
    expect(cheio.ok && cheio.value.cart).toHaveLength(50);
    const semCarrinho = parseAgentRequest({ id, message });
    expect(semCarrinho.ok && semCarrinho.value.cart).toEqual([]);
  });
});
