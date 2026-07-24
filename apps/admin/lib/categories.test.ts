import { describe, it, expect } from "vitest";
import { slugify, canDeleteCategory, flattenForSelect, isDuplicateSlugError } from "./categories";
import { buildCategoryTree, type CategoryNode } from "@mypet/core/catalog-utils";

describe("slugify", () => {
  it("normaliza acentos, espaços e maiúsculas", () => {
    expect(slugify("Ração & Petiscos")).toBe("racao-petiscos");
    expect(slugify("  Higiene  ")).toBe("higiene");
  });
});

describe("canDeleteCategory", () => {
  const categories: { id: string; parentId: string | null }[] = [
    { id: "c1", parentId: null },
    { id: "c2", parentId: "c1" },
  ];

  it("bloqueia quando há subcategoria filha", () => {
    const result = canDeleteCategory("c1", categories, new Map());
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Categoria tem subcategorias vinculadas.");
  });

  it("bloqueia quando há produtos vinculados", () => {
    const result = canDeleteCategory("c2", categories, new Map([["c2", 3]]));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Categoria tem 3 produto(s) vinculado(s).");
  });

  it("prioriza o bloqueio por subcategoria mesmo quando tambem ha produtos vinculados", () => {
    const result = canDeleteCategory("c1", categories, new Map([["c1", 5]]));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Categoria tem subcategorias vinculadas.");
  });

  it("permite quando não há filhos nem produtos", () => {
    const result = canDeleteCategory("c2", categories, new Map());
    expect(result).toEqual({ allowed: true });
  });
});

describe("flattenForSelect", () => {
  it("indenta filhos por nível na label", () => {
    const nodes: CategoryNode[] = [
      { id: "c1", parentId: null, slug: "caes", name: "Cães", level: 1, sortOrder: 0 },
      { id: "c2", parentId: "c1", slug: "caes-racao", name: "Ração", level: 2, sortOrder: 0 },
    ];
    const tree = buildCategoryTree(nodes);
    expect(flattenForSelect(tree)).toEqual([
      { id: "c1", label: "Cães" },
      { id: "c2", label: "— Ração" },
    ]);
  });
});

describe("isDuplicateSlugError", () => {
  it("reconhece o código de violação de unicidade do Postgres", () => {
    expect(isDuplicateSlugError({ code: "23505" })).toBe(true);
  });

  it("retorna false para outros erros ou ausência de erro", () => {
    expect(isDuplicateSlugError({ code: "23503" })).toBe(false);
    expect(isDuplicateSlugError(null)).toBe(false);
  });
});
