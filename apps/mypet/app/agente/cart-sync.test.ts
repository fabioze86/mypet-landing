import { describe, it, expect, vi } from "vitest";
import { applyCartChanges } from "./cart-sync";

const change = (id: string, qty: number) => ({ id, name: `P ${id}`, sku: id, brand: null, img: "/i.jpg", unitPrice: 10, qty });
const product = (id: string) => ({ id, name: `P ${id}`, sku: id, brand: null, img: "/i.jpg", unitPrice: 10 });

function fakeCart(items: { id: string; campaignId?: string }[]) {
  return { items, setLine: vi.fn() };
}

describe("applyCartChanges", () => {
  it("define a linha sem campanha com os dados novos e a quantidade final; 0 tira", () => {
    const cart = fakeCart([{ id: "a" }, { id: "b" }]);
    applyCartChanges([change("a", 5), change("b", 0), change("c", 2)], cart);
    expect(cart.setLine.mock.calls).toEqual([
      [product("a"), 5],
      [product("b"), 0],
      [product("c"), 2],
    ]);
  });

  it("atualiza preço, nome, sku, marca e imagem de quem já está no pedido", () => {
    const cart = fakeCart([{ id: "a" }]);
    applyCartChanges([{ id: "a", name: "Novo nome", sku: "N1", brand: "Marca", img: "/n.jpg", unitPrice: 42.5, qty: 3 }], cart);
    expect(cart.setLine).toHaveBeenCalledWith({ id: "a", name: "Novo nome", sku: "N1", brand: "Marca", img: "/n.jpg", unitPrice: 42.5 }, 3);
  });

  it("produto fora do pedido com quantidade 0 não faz nada", () => {
    const cart = fakeCart([]);
    applyCartChanges([change("x", 0)], cart);
    expect(cart.setLine).not.toHaveBeenCalled();
  });

  it("o mesmo produto duas vezes na mesma resposta: a segunda define a quantidade", () => {
    const cart = fakeCart([]);
    applyCartChanges([change("c", 2), change("c", 4), change("c", 0)], cart);
    expect(cart.setLine.mock.calls).toEqual([
      [product("c"), 2],
      [product("c"), 4],
      [product("c"), 0],
    ]);
  });

  it("produto com linha de campanha e linha sem campanha: mexe só na sem campanha (via setLine)", () => {
    const cart = fakeCart([{ id: "a" }, { id: "a", campaignId: "camp" }]);
    applyCartChanges([change("a", 3), change("a", 0)], cart);
    expect(cart.setLine.mock.calls).toEqual([
      [product("a"), 3],
      [product("a"), 0],
    ]);
  });

  it("só linha de campanha: quantidade > 0 cria a linha sem campanha; 0 não faz nada", () => {
    const cart = fakeCart([{ id: "a", campaignId: "camp" }]);
    applyCartChanges([change("a", 0)], cart);
    expect(cart.setLine).not.toHaveBeenCalled();
    applyCartChanges([change("a", 2)], cart);
    expect(cart.setLine).toHaveBeenCalledWith(product("a"), 2);
  });
});
