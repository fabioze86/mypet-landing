import { describe, expect, it, vi } from "vitest";
import type { CartItem } from "@mypet/core/cart";
import { applyServerPrices, registerOrder } from "./register-order";

const items: CartItem[] = [
  { id: "p1", name: "Coleira", sku: "COL-1", brand: null, img: "/c.jpg", qty: 2, unitPrice: 1 },
  { id: "p2", name: "Guia", sku: "", brand: null, img: "/g.jpg", qty: 1 },
];
const customer = { nome: "Fabio", empresa: "My Pet", whatsapp: "11999999999", cnpj: "" };

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("registerOrder", () => {
  it("envia só id e qty e devolve número e preços do servidor", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { number: 1042, items: [{ id: "p1", unitPrice: 9.9 }, { id: "p2", unitPrice: null }], total: 19.8 }),
    );

    const result = await registerOrder(items, customer, fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/pedidos");
    expect(JSON.parse(init.body)).toEqual({ items: [{ id: "p1", qty: 2 }, { id: "p2", qty: 1 }], customer });
    expect(result).toEqual({ kind: "ok", number: 1042, prices: new Map([["p1", 9.9], ["p2", null]]), unavailableIds: [] });
  });

  it("devolve as ids indisponíveis informadas pelo servidor", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { number: 1043, items: [{ id: "p2", unitPrice: 5 }], total: 5, unavailableIds: ["p1"] }),
    );
    expect(await registerOrder(items, customer, fetchImpl)).toEqual({
      kind: "ok", number: 1043, prices: new Map([["p2", 5]]), unavailableIds: ["p1"],
    });
  });

  it("409 (nada disponível) vira falha, sem bloquear o envio", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(409, { error: "Nenhum produto do carrinho está disponível no momento.", unavailableIds: ["p1", "p2"] }),
    );
    expect(await registerOrder(items, customer, fetchImpl)).toEqual({ kind: "failed" });
  });

  it("400 vira erro de validação com a mensagem do servidor", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { error: "Preencha nome, empresa e WhatsApp." }));
    expect(await registerOrder(items, customer, fetchImpl)).toEqual({ kind: "invalid", error: "Preencha nome, empresa e WhatsApp." });
  });

  it("5xx e erro de rede viram falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await registerOrder(items, customer, vi.fn().mockResolvedValue(jsonResponse(500, { error: "x" })))).toEqual({ kind: "failed" });
    expect(await registerOrder(items, customer, vi.fn().mockRejectedValue(new Error("offline")))).toEqual({ kind: "failed" });
  });
});

describe("applyServerPrices", () => {
  it("substitui o preço do carrinho pelo do servidor (null vira sem preço)", () => {
    const result = applyServerPrices(items, new Map([["p1", 9.9], ["p2", null]]));
    expect(result[0].unitPrice).toBe(9.9);
    expect(result[1].unitPrice).toBeUndefined();
  });

  it("remove o preço dos itens indisponíveis (saem como a consultar)", () => {
    const result = applyServerPrices(items, new Map([["p2", 5]]), ["p1"]);
    expect(result[0].unitPrice).toBeUndefined();
    expect(result[1].unitPrice).toBe(5);
  });
});
