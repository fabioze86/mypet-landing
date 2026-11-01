import { describe, expect, it } from "vitest";
import { shippingPackageFor } from "./shipping-package";

describe("shippingPackageFor (pacote provisório)", () => {
  it("usa a caixa padrão e 0,5 kg por unidade", () => {
    expect(shippingPackageFor([{ qty: 2 }, { qty: 1 }])).toEqual({ widthCm: 20, heightCm: 15, lengthCm: 30, weightKg: 1.5 });
  });
  it("respeita o peso mínimo e o máximo", () => {
    expect(shippingPackageFor([]).weightKg).toBe(0.3);
    expect(shippingPackageFor([{ qty: 500 }]).weightKg).toBe(30);
  });
});
