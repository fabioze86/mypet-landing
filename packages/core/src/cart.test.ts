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

describe("addItem atualiza unitPrice no merge (linha sem campanha)", () => {
  it("readicionar o mesmo produto sem campanha com unitPrice diferente atualiza o preço da linha", () => {
    const withFirst = addItem(emptyCart, { ...product, unitPrice: 10 }, 1);
    const withMore = addItem(withFirst, { ...product, unitPrice: 15 }, 1);

    expect(withMore.items).toHaveLength(1);
    expect(withMore.items[0]).toMatchObject({ unitPrice: 15, qty: 2 });
  });

  it("readicionar uma linha de campanha com unitPrice diferente NÃO altera o preço travado", () => {
    const withFirst = addItem(
      emptyCart,
      { id: "p1", name: "Kit 11 vestidos", sku: "SKU-1", brand: null, img: "/img.jpg", campaignId: "camp-1", campaignSlug: "camp-1-slug", unitPrice: 199, listPrice: 299 },
      2,
    );
    const withMore = addItem(
      withFirst,
      { id: "p1", name: "Kit 11 vestidos", sku: "SKU-1", brand: null, img: "/img.jpg", campaignId: "camp-1", campaignSlug: "camp-1-slug", unitPrice: 250, listPrice: 350 },
      1,
    );

    expect(withMore.items).toHaveLength(1);
    expect(withMore.items[0]).toMatchObject({ campaignId: "camp-1", unitPrice: 199, listPrice: 299, qty: 3 });
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

describe("addItem com campanhas diferentes", () => {
  it("mantém linhas distintas para o mesmo id de produto em campanhas diferentes", () => {
    const withFirst = addItem(
      emptyCart,
      { id: "p1", name: "Kit 11 vestidos", sku: "SKU-1", brand: null, img: "/img.jpg", campaignId: "camp-1", campaignSlug: "camp-1-slug", unitPrice: 199, listPrice: 299 },
      2,
    );
    const withBoth = addItem(
      withFirst,
      { id: "p1", name: "Kit 11 vestidos", sku: "SKU-1", brand: null, img: "/img.jpg", campaignId: "camp-2", campaignSlug: "camp-2-slug", unitPrice: 249, listPrice: 299 },
      1,
    );

    expect(withBoth.items).toHaveLength(2);
    expect(withBoth.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campaignId: "camp-1", campaignSlug: "camp-1-slug", unitPrice: 199, qty: 2 }),
        expect.objectContaining({ campaignId: "camp-2", campaignSlug: "camp-2-slug", unitPrice: 249, qty: 1 }),
      ]),
    );
  });

  it("soma a quantidade quando o mesmo id e o mesmo campaignId são adicionados de novo", () => {
    const withFirst = addItem(
      emptyCart,
      { id: "p1", name: "Kit 11 vestidos", sku: "SKU-1", brand: null, img: "/img.jpg", campaignId: "camp-1", campaignSlug: "camp-1-slug", unitPrice: 199, listPrice: 299 },
      2,
    );
    const withMore = addItem(
      withFirst,
      { id: "p1", name: "Kit 11 vestidos", sku: "SKU-1", brand: null, img: "/img.jpg", campaignId: "camp-1", campaignSlug: "camp-1-slug", unitPrice: 199, listPrice: 299 },
      3,
    );

    expect(withMore.items).toHaveLength(1);
    expect(withMore.items[0]).toMatchObject({ campaignId: "camp-1", qty: 5 });
  });

  it("continua mesclando itens sem campanha entre si (comportamento existente preservado)", () => {
    const cart = addItem(addItem(emptyCart, product, 2), product, 3);
    expect(cart.items).toEqual([{ ...product, qty: 5 }]);
  });
});

describe("removeItem/updateQty com campanhas diferentes (mesmo id, campaignId distintos)", () => {
  const cartComDuasLinhas: Cart = {
    items: [
      { id: "p1", name: "Kit 11 vestidos", sku: "SKU-1", brand: null, img: "/img.jpg", campaignId: "camp-1", campaignSlug: "camp-1-slug", unitPrice: 199, listPrice: 299, qty: 2 },
      { id: "p1", name: "Kit 11 vestidos", sku: "SKU-1", brand: null, img: "/img.jpg", campaignId: "camp-2", campaignSlug: "camp-2-slug", unitPrice: 249, listPrice: 299, qty: 5 },
    ],
  };

  it("removeItem com campaignId remove só a linha daquela campanha, mantendo a linha irmã intacta", () => {
    const cart = removeItem(cartComDuasLinhas, "p1", "camp-1");
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ campaignId: "camp-2", qty: 5 });
  });

  it("updateQty com campaignId altera só a linha daquela campanha, preservando a qty da linha irmã", () => {
    const cart = updateQty(cartComDuasLinhas, "p1", 9, "camp-1");
    expect(cart.items).toHaveLength(2);
    expect(cart.items.find((i) => i.campaignId === "camp-1")).toMatchObject({ qty: 9 });
    expect(cart.items.find((i) => i.campaignId === "camp-2")).toMatchObject({ qty: 5 });
  });

  it("updateQty com campaignId e qty <= 0 remove só a linha daquela campanha", () => {
    const cart = updateQty(cartComDuasLinhas, "p1", 0, "camp-1");
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ campaignId: "camp-2" });
  });

  it("removeItem sem campaignId continua removendo todas as linhas com aquele id (comportamento existente)", () => {
    const cart = removeItem(cartComDuasLinhas, "p1");
    expect(cart.items).toEqual([]);
  });

  it("updateQty sem campaignId continua sobrescrevendo a qty de todas as linhas com aquele id (comportamento existente)", () => {
    const cart = updateQty(cartComDuasLinhas, "p1", 7);
    expect(cart.items).toHaveLength(2);
    expect(cart.items.every((i) => i.qty === 7)).toBe(true);
  });
});

it("preserva os campos opcionais de campanha ao adicionar um item", () => {
  const cart = addItem(
    { items: [] },
    {
      id: "p1",
      name: "Kit 11 vestidos",
      sku: "SKU-1",
      brand: null,
      img: "/img.jpg",
      campaignId: "camp-1",
      campaignSlug: "kit-11-vestidos",
      unitPrice: 199,
      listPrice: 299,
    },
    2,
  );
  expect(cart.items[0]).toMatchObject({
    campaignId: "camp-1",
    campaignSlug: "kit-11-vestidos",
    unitPrice: 199,
    listPrice: 299,
    qty: 2,
  });
});
