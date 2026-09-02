import { describe, it, expect } from "vitest";
import { parsePrecosCsv } from "./azpetshop-import-precos";

describe("parsePrecosCsv", () => {
  it("lê cabeçalho reference,price e ignora linhas vazias", () => {
    const csv = "reference,price\nGOLD15,199.90\nCOLEIRA-M,49.9\n\n";
    expect(parsePrecosCsv(csv)).toEqual([
      { reference: "GOLD15", price: 199.9 },
      { reference: "COLEIRA-M", price: 49.9 },
    ]);
  });

  it("aceita separador ; e vírgula decimal", () => {
    const csv = "reference;price\nGOLD15;199,90\n";
    expect(parsePrecosCsv(csv)).toEqual([{ reference: "GOLD15", price: 199.9 }]);
  });

  it("trata ponto como separador de milhar quando o separador de campo é ;", () => {
    const csv = "reference;price\nRACAO-20KG;1.199,90\n";
    expect(parsePrecosCsv(csv)).toEqual([{ reference: "RACAO-20KG", price: 1199.9 }]);
  });

  it("ignora linha sem referência ou com preço inválido", () => {
    const csv = "reference,price\n,10\nX,abc\nY,12.5\n";
    expect(parsePrecosCsv(csv)).toEqual([{ reference: "Y", price: 12.5 }]);
  });

  it("descarta preços <= 0 (CHECK sale_price > 0)", () => {
    const csv = "reference,price\nZERO,0\nNEG,-5\nVAZIO,\nOK,3\n";
    expect(parsePrecosCsv(csv)).toEqual([{ reference: "OK", price: 3 }]);
  });

  it("retorna [] quando só há cabeçalho ou texto vazio", () => {
    expect(parsePrecosCsv("reference,price\n")).toEqual([]);
    expect(parsePrecosCsv("")).toEqual([]);
  });
});
