import { describe, it, expect } from "vitest";
import { buildCatalogQuery } from "./querystring";

describe("buildCatalogQuery", () => {
  it("retorna string vazia quando não há parâmetros relevantes", () => {
    expect(buildCatalogQuery({})).toBe("");
    expect(buildCatalogQuery({ page: 1 })).toBe("");
  });
  it("inclui q e brand codificados", () => {
    expect(buildCatalogQuery({ q: "ração", brand: "NAPI" })).toBe("?q=ra%C3%A7%C3%A3o&brand=NAPI");
  });
  it("inclui page apenas quando maior que 1", () => {
    expect(buildCatalogQuery({ brand: "NAPI", page: 3 })).toBe("?brand=NAPI&page=3");
  });
});
