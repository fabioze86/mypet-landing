import { describe, it, expect } from "vitest";
import { ORDER_STATUSES, ORDERS_SELECT, itemUnitPrice, orderCustomer, orderTotal, type OrderRow } from "./orders";

describe("ORDER_STATUSES", () => {
  it("contém os quatro status esperados, na ordem do fluxo", () => {
    expect(ORDER_STATUSES).toEqual(["pendente", "confirmado", "entregue", "cancelado"]);
  });
});

const base: OrderRow = {
  id: "o1",
  number: 1042,
  channel: "distribuidora",
  status: "pendente",
  created_at: "2026-10-08T12:00:00Z",
  customer_name: "João",
  customer_company: "Pet X",
  customer_whatsapp: "11999999999",
  customer_cnpj: "12.345.678/0001-90",
  buyers: null,
  order_items: [],
};

describe("ORDERS_SELECT", () => {
  it("traz número, dados do cliente sem login e preço dos itens", () => {
    for (const column of ["number", "customer_name", "customer_company", "customer_whatsapp", "customer_cnpj", "unit_price"]) {
      expect(ORDERS_SELECT).toContain(column);
    }
  });
});

describe("orderCustomer", () => {
  it("usa o comprador cadastrado quando existe", () => {
    const order = { ...base, buyers: { nome: "Maria", empresa: "Loja M", whatsapp: "11888888888", cnpj: null } };
    expect(orderCustomer(order)).toEqual({ nome: "Maria", empresa: "Loja M", whatsapp: "11888888888", cnpj: null });
  });

  it("sem comprador cadastrado usa os dados enviados com o pedido", () => {
    expect(orderCustomer(base)).toEqual({
      nome: "João", empresa: "Pet X", whatsapp: "11999999999", cnpj: "12.345.678/0001-90",
    });
  });

  it("pedido antigo sem dados vira campos vazios", () => {
    const order = { ...base, customer_name: null, customer_company: null, customer_whatsapp: null, customer_cnpj: null };
    expect(orderCustomer(order)).toEqual({ nome: "", empresa: "", whatsapp: "", cnpj: null });
  });
});

describe("orderTotal / itemUnitPrice", () => {
  const item = (unit_price: number | string | null, qty: number) => ({
    product_id: `p${qty}`, product_name_snapshot: "X", qty, unit_price,
  });

  it("soma só as linhas com preço (numeric pode vir como texto)", () => {
    const order = { ...base, order_items: [item("9.90", 2), item(5, 3), item(null, 1)] };
    expect(orderTotal(order)).toBe(34.8);
    expect(itemUnitPrice(item("9.90", 2))).toBe(9.9);
    expect(itemUnitPrice(item(null, 1))).toBeNull();
  });

  it("sem nenhum preço não tem total", () => {
    expect(orderTotal({ ...base, order_items: [item(null, 1)] })).toBeNull();
  });
});
