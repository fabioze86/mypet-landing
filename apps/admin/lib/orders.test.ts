import { describe, it, expect } from "vitest";
import { ORDER_STATUSES } from "./orders";

describe("ORDER_STATUSES", () => {
  it("contém os quatro status esperados, na ordem do fluxo", () => {
    expect(ORDER_STATUSES).toEqual(["pendente", "confirmado", "entregue", "cancelado"]);
  });
});
