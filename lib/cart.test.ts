import { describe, it, expect } from "vitest";
import { addItem, removeItem, updateQty, totalItems, type Cart } from "./cart";

const emptyCart: Cart = { items: [] };
const product = { id: "p1", name: "RAÇÃO X", sku: "100", brand: "NAPI", img: "/img.jpg" };

describe("addItem", () => {
  it("adiciona um item novo com a quantidade informada", () => {
    const cart = addItem(emptyCart, product, 2);
    expect(cart.items).toEqual([{ ...product, qty: 2 }]);
  });

  it("soma a quantidade quando o item já existe", () => {
    const cart = addItem({ items: [{ ...product, qty: 2 }] }, product, 3);
    expect(cart.items).toEqual([{ ...product, qty: 5 }]);
  });
});

describe("removeItem", () => {
  it("remove o item pelo id", () => {
    const cart = removeItem({ items: [{ ...product, qty: 2 }] }, "p1");
    expect(cart.items).toEqual([]);
  });

  it("não faz nada se o id não existe", () => {
    const cart = removeItem({ items: [{ ...product, qty: 2 }] }, "outro");
    expect(cart.items).toEqual([{ ...product, qty: 2 }]);
  });
});

describe("updateQty", () => {
  it("atualiza a quantidade do item", () => {
    const cart = updateQty({ items: [{ ...product, qty: 2 }] }, "p1", 5);
    expect(cart.items).toEqual([{ ...product, qty: 5 }]);
  });

  it("remove o item quando qty <= 0", () => {
    const cart = updateQty({ items: [{ ...product, qty: 2 }] }, "p1", 0);
    expect(cart.items).toEqual([]);
  });
});

describe("totalItems", () => {
  it("soma as quantidades de todos os itens", () => {
    const cart: Cart = {
      items: [
        { ...product, qty: 2 },
        { ...product, id: "p2", qty: 3 },
      ],
    };
    expect(totalItems(cart)).toBe(5);
  });

  it("retorna 0 para carrinho vazio", () => {
    expect(totalItems(emptyCart)).toBe(0);
  });
});
