import { describe, expect, it } from "vitest";
import { RETAIL_STATUS_LABEL, statusAfterCheckoutEvent } from "./retail-order-status";

describe("statusAfterCheckoutEvent", () => {
  it("aguardando pagamento vira pago, cancelado ou expirado", () => {
    expect(statusAfterCheckoutEvent("aguardando_pagamento", "CHECKOUT_PAID")).toBe("pago");
    expect(statusAfterCheckoutEvent("aguardando_pagamento", "CHECKOUT_CANCELED")).toBe("cancelado");
    expect(statusAfterCheckoutEvent("aguardando_pagamento", "CHECKOUT_EXPIRED")).toBe("expirado");
  });

  it("nunca rebaixa um pedido já pago, enviado ou entregue", () => {
    for (const s of ["pago", "enviado", "entregue"]) {
      expect(statusAfterCheckoutEvent(s, "CHECKOUT_EXPIRED")).toBeNull();
      expect(statusAfterCheckoutEvent(s, "CHECKOUT_CANCELED")).toBeNull();
      expect(statusAfterCheckoutEvent(s, "CHECKOUT_PAID")).toBeNull();
    }
  });

  it("pagamento que chega depois de expirar/cancelar ainda conta como pago", () => {
    expect(statusAfterCheckoutEvent("expirado", "CHECKOUT_PAID")).toBe("pago");
    expect(statusAfterCheckoutEvent("cancelado", "CHECKOUT_PAID")).toBe("pago");
  });

  it("evento desconhecido não muda nada", () => {
    expect(statusAfterCheckoutEvent("aguardando_pagamento", "CHECKOUT_CREATED")).toBeNull();
  });

  it("tem rótulo em português para todo status", () => {
    expect(RETAIL_STATUS_LABEL.aguardando_pagamento).toBe("Aguardando pagamento");
    expect(Object.keys(RETAIL_STATUS_LABEL)).toHaveLength(6);
  });
});
