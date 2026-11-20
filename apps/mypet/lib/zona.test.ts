import { describe, expect, it } from "vitest";
import { zonaDoComprador } from "./zona";

describe("zonaDoComprador", () => {
  it("usa a config do mypet", () => {
    expect(zonaDoComprador({ uf: "SP", municipio: "Guarulhos", cep: "07000000", localizacao_status: "localizado" })).toBe("grande_sp");
    expect(zonaDoComprador({ uf: null, municipio: null, cep: null, localizacao_status: null })).toBe("fora");
  });
});
