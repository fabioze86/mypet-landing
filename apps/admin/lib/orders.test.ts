import { afterEach, describe, it, expect, vi } from "vitest";
import { ORDER_STATUSES, ORDERS_SELECT, allowedManualStatuses, listmonkEnv, itemUnitPrice, orderCustomer, orderTotal, type OrderRow } from "./orders";

describe("ORDER_STATUSES", () => {
  it("contém os status esperados, na ordem do fluxo", () => {
    expect(ORDER_STATUSES).toEqual(["pendente", "confirmado", "aguardando_pagamento", "pago", "enviado", "entregue", "cancelado", "expirado"]);
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

describe("pedidos de varejo", () => {
  it("orderTotal usa o total gravado (com frete) quando existe", () => {
    const order = { order_items: [{ product_id: "p", product_name_snapshot: "x", qty: 2, unit_price: "25.00" }], total: "70.00" } as unknown as OrderRow;
    expect(orderTotal(order)).toBe(70);
  });
});

describe("listmonkEnv", () => {
  afterEach(() => vi.unstubAllEnvs());
  const setAll = () => {
    vi.stubEnv("LISTMONK_URL", "https://mail.exemplo.com");
    vi.stubEnv("LISTMONK_API_USER", "user");
    vi.stubEnv("LISTMONK_API_TOKEN", "tok");
    vi.stubEnv("LISTMONK_TEMPLATE_PEDIDO_ENVIADO", "7");
    vi.stubEnv("AZPETSHOP_SITE_URL", "");
  };

  it("devolve a configuração com o site padrão", () => {
    setAll();
    expect(listmonkEnv()).toEqual({
      baseUrl: "https://mail.exemplo.com", apiUser: "user", apiToken: "tok", templateId: 7, siteUrl: "https://www.azpetshop.com.br",
    });
  });

  it("devolve null quando falta qualquer variável ou o template não é número", () => {
    setAll();
    vi.stubEnv("LISTMONK_API_TOKEN", "");
    expect(listmonkEnv()).toBeNull();
    setAll();
    vi.stubEnv("LISTMONK_TEMPLATE_PEDIDO_ENVIADO", "abc");
    expect(listmonkEnv()).toBeNull();
  });
});

describe("allowedManualStatuses", () => {
  it("azpetshop: só o atual, entregue e cancelado (pago vem do webhook, enviado do Marcar enviado)", () => {
    expect(allowedManualStatuses("azpetshop", "pago")).toEqual(["pago", "entregue", "cancelado"]);
    expect(allowedManualStatuses("azpetshop", "enviado")).toEqual(["enviado", "entregue", "cancelado"]);
    expect(allowedManualStatuses("azpetshop", "entregue")).toEqual(["entregue", "cancelado"]);
    expect(allowedManualStatuses("azpetshop", "aguardando_pagamento")).not.toContain("pago");
  });

  it("demais canais: só os status antigos", () => {
    expect(allowedManualStatuses("distribuidora", "pendente")).toEqual(["pendente", "confirmado", "entregue", "cancelado"]);
    expect(allowedManualStatuses("mypetbrasil", "confirmado")).toEqual(["pendente", "confirmado", "entregue", "cancelado"]);
    expect(allowedManualStatuses("distribuidora", "pendente")).not.toContain("pago");
  });
});
