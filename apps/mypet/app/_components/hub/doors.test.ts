// apps/mypet/app/_components/hub/doors.test.ts
import { describe, it, expect } from "vitest";
import { cadastroHref, hubDoors, safeNext, viewerFromBuyer, VISITANTE } from "./doors";

describe("hubDoors", () => {
  it("visitante: tabela e catálogo levam ao cadastro e voltam para a porta", () => {
    const doors = hubDoors(VISITANTE);
    expect(doors.map((d) => d.label)).toEqual(["Tabela de preços", "Catálogo", "Agente", "Dúvidas"]);
    expect(doors[0]).toMatchObject({ id: "tabela", href: "/cadastro?next=%2Fpedido-rapido", locked: true });
    expect(doors[1]).toMatchObject({ id: "catalogo", href: "/cadastro?next=%2Fcatalogo", locked: true });
    expect(doors[2]).toMatchObject({ id: "agente", href: "/agente", locked: false });
    expect(doors[3]).toMatchObject({ id: "duvidas", href: "/central-de-ajuda", locked: false });
  });

  it("cliente: todas as portas abertas", () => {
    const doors = hubDoors({ kind: "cliente", displayName: "Ana" });
    expect(doors.map((d) => d.href)).toEqual(["/pedido-rapido", "/catalogo", "/agente", "/central-de-ajuda"]);
    expect(doors.every((d) => !d.locked)).toBe(true);
  });
});

describe("cadastroHref", () => {
  it("codifica o destino no next", () => {
    expect(cadastroHref("/catalogo")).toBe("/cadastro?next=%2Fcatalogo");
  });
});

describe("safeNext", () => {
  it("aceita só destinos do hub", () => {
    expect(safeNext("/pedido-rapido", "/agente")).toBe("/pedido-rapido");
    expect(safeNext("/catalogo", "/agente")).toBe("/catalogo");
    expect(safeNext(["/pedidos", "/catalogo"], "/agente")).toBe("/pedidos");
  });

  it("usa o fallback para destino ausente, externo ou fora da lista", () => {
    for (const raw of [undefined, null, "", "https://evil.com", "//evil.com", "/loja", "/catalogo?x=1"]) {
      expect(safeNext(raw, "/agente")).toBe("/agente");
    }
  });
});

describe("viewerFromBuyer", () => {
  it("sem comprador é visitante", () => {
    expect(viewerFromBuyer(null)).toEqual({ kind: "visitante" });
  });

  it("usa o nome, senão a empresa, senão null", () => {
    expect(viewerFromBuyer({ nome: " Ana ", empresa: "Pet X" })).toEqual({ kind: "cliente", displayName: "Ana" });
    expect(viewerFromBuyer({ nome: "  ", empresa: "Pet X" })).toEqual({ kind: "cliente", displayName: "Pet X" });
    expect(viewerFromBuyer({ nome: null, empresa: null })).toEqual({ kind: "cliente", displayName: null });
  });
});
