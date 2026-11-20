import { describe, expect, it } from "vitest";
import { textoFaixa } from "./frete-faixa";

describe("textoFaixa", () => {
  it("fábrica", () => {
    expect(textoFaixa("fabrica", "capital")).toMatch(/Frete grátis para todo o Brasil acima de R\$\s?299,00/);
  });
  it("catálogo com zona", () => {
    expect(textoFaixa("zona", "capital")).toMatch(/Sua região: Capital de SP · frete grátis a partir de R\$\s?200,00/);
  });
  it("catálogo fora", () => {
    expect(textoFaixa("zona", "fora")).toBe("Frete sob consulta para a sua região.");
  });
});
