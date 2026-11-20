import { describe, expect, it } from "vitest";
import { planejarBackfill } from "./backfill-buyers-localizacao";

describe("planejarBackfill", () => {
  const cache = [
    { cnpj: "11111111000111", status_consulta: "consultado", uf: "sp", municipio: "SAO PAULO", cep: "04.210-000" },
    { cnpj: "22222222000122", status_consulta: "erro", uf: null, municipio: null, cep: null },
    { cnpj: "33333333000133", status_consulta: "consultado", uf: null, municipio: null, cep: null },
  ];

  it("só preenche quem está no cache como consultado e com uf", () => {
    const buyers = [
      { id: "a", cnpj: "11.111.111/0001-11" },
      { id: "b", cnpj: "22222222000122" },
      { id: "c", cnpj: "33333333000133" },
      { id: "d", cnpj: null },
      { id: "e", cnpj: "99999999000199" },
    ];
    expect(planejarBackfill(buyers, cache)).toEqual([{ id: "a", uf: "SP", municipio: "SAO PAULO", cep: "04210000" }]);
  });
});
