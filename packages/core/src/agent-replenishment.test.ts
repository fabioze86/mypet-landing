import { describe, it, expect } from "vitest";
import { computeReplenishment, type ReplenishmentOrder } from "./agent-replenishment";

const now = new Date("2026-10-15T12:00:00Z");
const day = (iso: string) => `${iso}T12:00:00Z`;
const order = (date: string, items: [string, number][], status = "entregue"): ReplenishmentOrder => ({
  status,
  createdAt: day(date),
  items: items.map(([productId, qty]) => ({ productId, qty })),
});

describe("computeReplenishment", () => {
  it("sem pedidos: sem_historico", () => {
    expect(computeReplenishment([], now, 8)).toEqual({ tipo: "sem_historico", itens: [] });
  });

  it("sugere quem passou de 80% do intervalo médio, mais atrasado primeiro", () => {
    const orders = [
      order("2026-07-17", [["racao", 2], ["shampoo", 1]]),
      order("2026-08-16", [["racao", 3]]),
      order("2026-09-15", [["racao", 4], ["shampoo", 2]]),
      order("2026-10-10", [["coleira", 5]]),
    ];
    // ração: compras a cada 30 dias, última há 30 dias (100%) → sugere
    // shampoo: intervalo 60 dias, última há 30 dias (50%) → não sugere
    // coleira: 1 compra só → não entra
    expect(computeReplenishment(orders, now, 8)).toEqual({
      tipo: "reposicao",
      itens: [{ productId: "racao", daysSinceLast: 30, averageIntervalDays: 30, lastQty: 4 }],
    });
  });

  it("ignora pedidos cancelados", () => {
    const orders = [
      order("2026-08-11", [["racao", 1]]),
      order("2026-09-10", [["racao", 1]], "cancelado"),
      order("2026-09-15", [["racao", 2]]),
    ];
    // sem o cancelado: intervalo de 35 dias, última há 30 (86%) → sugere
    const plan = computeReplenishment(orders, now, 8);
    expect(plan.itens[0]).toEqual({ productId: "racao", daysSinceLast: 30, averageIntervalDays: 35, lastQty: 2 });
  });

  it("produto repetido no mesmo pedido soma a quantidade e conta uma compra", () => {
    const orders = [order("2026-08-16", [["racao", 1]]), order("2026-09-15", [["racao", 1], ["racao", 2]])];
    const plan = computeReplenishment(orders, now, 8);
    expect(plan.itens[0]).toEqual({ productId: "racao", daysSinceLast: 30, averageIntervalDays: 30, lastQty: 3 });
  });

  it("limita a quantidade de sugestões", () => {
    const orders = [
      order("2026-08-01", [["a", 1], ["b", 1], ["c", 1]]),
      order("2026-08-15", [["a", 1], ["b", 1], ["c", 1]]),
    ];
    expect(computeReplenishment(orders, now, 2).itens).toHaveLength(2);
  });

  it("há produtos recorrentes mas nenhum no tempo de repor: reposicao vazia", () => {
    const orders = [order("2026-09-15", [["racao", 1]]), order("2026-10-14", [["racao", 1]])];
    expect(computeReplenishment(orders, now, 8)).toEqual({ tipo: "reposicao", itens: [] });
  });

  it("nenhum produto com 2 compras: itens do último pedido como compra recente", () => {
    const orders = [order("2026-09-01", [["a", 1]]), order("2026-10-05", [["b", 2], ["c", 3], ["b", 1]])];
    expect(computeReplenishment(orders, now, 8)).toEqual({
      tipo: "compra_recente",
      itens: [
        { productId: "b", daysSinceLast: 10, averageIntervalDays: null, lastQty: 3 },
        { productId: "c", daysSinceLast: 10, averageIntervalDays: null, lastQty: 3 },
      ],
    });
  });
});
