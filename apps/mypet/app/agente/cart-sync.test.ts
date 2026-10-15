import { describe, it, expect, vi } from "vitest";
import { applyCartChanges } from "./cart-sync";

const change = (id: string, qty: number) => ({ id, name: `P ${id}`, sku: id, brand: null, img: "/i.jpg", unitPrice: 10, qty });

function fakeCart(ids: string[]) {
  return { items: ids.map((id) => ({ id })), addItem: vi.fn(), updateQty: vi.fn(), removeItem: vi.fn() };
}

describe("applyCartChanges", () => {
  it("define a quantidade de quem já está no pedido, adiciona os novos e tira os de quantidade 0", () => {
    const cart = fakeCart(["a", "b"]);
    applyCartChanges([change("a", 5), change("b", 0), change("c", 2)], cart);
    expect(cart.updateQty).toHaveBeenCalledWith("a", 5);
    expect(cart.removeItem).toHaveBeenCalledWith("b");
    expect(cart.addItem).toHaveBeenCalledWith({ id: "c", name: "P c", sku: "c", brand: null, img: "/i.jpg", unitPrice: 10 }, 2);
  });

  it("produto novo com quantidade 0 não faz nada", () => {
    const cart = fakeCart([]);
    applyCartChanges([change("x", 0)], cart);
    expect(cart.addItem).not.toHaveBeenCalled();
    expect(cart.removeItem).not.toHaveBeenCalled();
  });

  it("o mesmo produto duas vezes na mesma resposta: a segunda define a quantidade", () => {
    const cart = fakeCart([]);
    applyCartChanges([change("c", 2), change("c", 4)], cart);
    expect(cart.addItem).toHaveBeenCalledTimes(1);
    expect(cart.updateQty).toHaveBeenCalledWith("c", 4);
  });

  it("linha de campanha não é confundida com o produto avulso", () => {
    const cart = { ...fakeCart([]), items: [{ id: "a", campaignId: "camp" }] };
    applyCartChanges([change("a", 3)], cart);
    expect(cart.addItem).toHaveBeenCalledTimes(1);
    expect(cart.updateQty).not.toHaveBeenCalled();
  });
});
