import { describe, it, expect } from "vitest";
import { leadsToCsv, LEAD_STATUSES } from "./leads";

describe("LEAD_STATUSES", () => {
  it("lista os quatro status válidos", () => {
    expect(LEAD_STATUSES).toEqual(["novo", "contatado", "convertido", "descartado"]);
  });
});

describe("leadsToCsv", () => {
  it("gera um CSV com cabeçalho e uma linha por lead", () => {
    const csv = leadsToCsv([
      {
        id: "1",
        nome: "João",
        empresa: "Pet X",
        whatsapp: "11999999999",
        cnpj: null,
        channel: "mypetbrasil",
        status: "novo",
        created_at: "2026-07-17T10:00:00Z",
      },
    ]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("data,nome,empresa,whatsapp,cnpj,canal,status");
    expect(lines[1]).toBe("2026-07-17T10:00:00Z,João,Pet X,11999999999,,mypetbrasil,novo");
  });

  it("escapa vírgulas e aspas nos campos", () => {
    const csv = leadsToCsv([
      {
        id: "1",
        nome: "Pet Shop, Ração e Cia",
        empresa: 'A "Melhor" Loja',
        whatsapp: "11999999999",
        cnpj: null,
        channel: "distribuidora",
        status: "novo",
        created_at: "2026-07-17T10:00:00Z",
      },
    ]);
    const lines = csv.trim().split("\n");
    expect(lines[1]).toBe(
      '2026-07-17T10:00:00Z,"Pet Shop, Ração e Cia","A ""Melhor"" Loja",11999999999,,distribuidora,novo',
    );
  });

  it("retorna só o cabeçalho para lista vazia", () => {
    expect(leadsToCsv([]).trim()).toBe("data,nome,empresa,whatsapp,cnpj,canal,status");
  });

  it("neutraliza formula injection prefixando ' em campos que começam com =, +, - ou @", () => {
    const csv = leadsToCsv([
      {
        id: "1",
        nome: "=1+1",
        empresa: "@empresa",
        whatsapp: "11999999999",
        cnpj: null,
        channel: "mypetbrasil",
        status: "novo",
        created_at: "2026-07-17T10:00:00Z",
      },
    ]);
    const lines = csv.trim().split("\n");
    expect(lines[1]).toBe("2026-07-17T10:00:00Z,'=1+1,'@empresa,11999999999,,mypetbrasil,novo");
  });
});
