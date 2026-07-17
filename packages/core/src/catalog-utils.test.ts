import { describe, it, expect } from "vitest";
import {
  parsePage,
  pageRange,
  totalPages,
  pickActiveBadge,
  mainImage,
  mapProduct,
  PLACEHOLDER_IMAGE,
  buildCategoryTree,
  collectCategorySubtreeIds,
  getCategoryPath,
  type RawProductRow,
  type CategoryNode,
} from "./catalog-utils";

describe("parsePage", () => {
  it("retorna 1 para indefinido ou inválido", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
  });
  it("converte string numérica válida", () => {
    expect(parsePage("4")).toBe(4);
  });
});

describe("pageRange", () => {
  it("calcula o range zero-based do Supabase", () => {
    expect(pageRange(1, 24)).toEqual({ from: 0, to: 23 });
    expect(pageRange(3, 24)).toEqual({ from: 48, to: 71 });
  });
});

describe("totalPages", () => {
  it("arredonda para cima e nunca retorna menos que 1", () => {
    expect(totalPages(0, 24)).toBe(1);
    expect(totalPages(24, 24)).toBe(1);
    expect(totalPages(25, 24)).toBe(2);
  });
});

describe("pickActiveBadge", () => {
  it("retorna null quando não há badges", () => {
    expect(pickActiveBadge(null)).toBeNull();
    expect(pickActiveBadge([])).toBeNull();
  });
  it("escolhe o de maior priority entre os vigentes", () => {
    const badge = pickActiveBadge([
      { code: "novidade", label: "Novidade", kind: "manual", priority: 1, starts_at: null, ends_at: null },
      { code: "escolha_mypet", label: "Escolha da My Pet", kind: "manual", priority: 10, starts_at: null, ends_at: null },
    ]);
    expect(badge).toEqual({ code: "escolha_mypet", label: "Escolha da My Pet" });
  });
  it("ignora badges fora da janela de validade", () => {
    const now = new Date("2026-06-26T12:00:00Z");
    const badge = pickActiveBadge(
      [{ code: "promocao", label: "Promoção", kind: "promocao", priority: 5, starts_at: "2026-07-01T00:00:00Z", ends_at: null }],
      now,
    );
    expect(badge).toBeNull();
  });
});

describe("mainImage", () => {
  it("usa a url de main_image", () => {
    expect(mainImage([{ url: "https://img/x", type: "main_image" }])).toBe("https://img/x");
  });
  it("cai no placeholder quando não há imagem", () => {
    expect(mainImage(null)).toBe(PLACEHOLDER_IMAGE);
    expect(mainImage([])).toBe(PLACEHOLDER_IMAGE);
  });
});

describe("mapProduct", () => {
  it("mapeia campos do Hub para a forma da UI", () => {
    const row: RawProductRow = {
      id: "abc",
      name: "RAÇÃO PREMIUM 15KG",
      reference: "15675",
      brand: "PLAST PET",
      category_id: "cat-1",
      categories: { id: "cat-1", name: "Cães", slug: "caes" },
      product_assets: [{ url: "https://img/x", type: "main_image" }],
      product_badges: [{ code: "novidade", label: "Novidade", kind: "manual", priority: 1, starts_at: null, ends_at: null }],
    };
    expect(mapProduct(row)).toEqual({
      id: "abc",
      name: "RAÇÃO PREMIUM 15KG",
      sku: "15675",
      brand: "PLAST PET",
      img: "https://img/x",
      badge: { code: "novidade", label: "Novidade" },
      category: { id: "cat-1", name: "Cães", slug: "caes" },
    });
  });
  it("usa placeholder, sku vazio e categoria nula quando faltam dados", () => {
    const row: RawProductRow = {
      id: "z", name: "CAMA", reference: null, brand: null, category_id: null, categories: null,
      product_assets: null, product_badges: null,
    };
    const p = mapProduct(row);
    expect(p.img).toBe(PLACEHOLDER_IMAGE);
    expect(p.sku).toBe("");
    expect(p.badge).toBeNull();
    expect(p.category).toBeNull();
  });
});

const SAMPLE_CATEGORIES: CategoryNode[] = [
  { id: "c1", parentId: null, slug: "caes", name: "Cães", level: 1 },
  { id: "c2", parentId: "c1", slug: "caes-racao", name: "Ração", level: 2 },
  { id: "c3", parentId: "c2", slug: "caes-racao-seca", name: "Ração Seca", level: 3 },
  { id: "c4", parentId: null, slug: "gatos", name: "Gatos", level: 1 },
];

describe("buildCategoryTree", () => {
  it("agrupa categorias planas em árvore por parentId, preservando a ordem de entrada", () => {
    const tree = buildCategoryTree(SAMPLE_CATEGORIES);
    expect(tree).toEqual([
      {
        id: "c1", parentId: null, slug: "caes", name: "Cães", level: 1,
        children: [
          {
            id: "c2", parentId: "c1", slug: "caes-racao", name: "Ração", level: 2,
            children: [
              { id: "c3", parentId: "c2", slug: "caes-racao-seca", name: "Ração Seca", level: 3, children: [] },
            ],
          },
        ],
      },
      { id: "c4", parentId: null, slug: "gatos", name: "Gatos", level: 1, children: [] },
    ]);
  });

  it("retorna lista vazia para entrada vazia", () => {
    expect(buildCategoryTree([])).toEqual([]);
  });
});

describe("collectCategorySubtreeIds", () => {
  it("devolve o próprio id e todos os descendentes, em profundidade", () => {
    expect(collectCategorySubtreeIds(SAMPLE_CATEGORIES, "c1")).toEqual(["c1", "c2", "c3"]);
  });

  it("devolve só o próprio id quando não há filhos", () => {
    expect(collectCategorySubtreeIds(SAMPLE_CATEGORIES, "c4")).toEqual(["c4"]);
  });
});

describe("getCategoryPath", () => {
  it("devolve o caminho da raiz até o nó, em ordem", () => {
    expect(getCategoryPath(SAMPLE_CATEGORIES, "c3")).toEqual([
      SAMPLE_CATEGORIES[0],
      SAMPLE_CATEGORIES[1],
      SAMPLE_CATEGORIES[2],
    ]);
  });

  it("devolve array de 1 item para uma categoria de nível 1", () => {
    expect(getCategoryPath(SAMPLE_CATEGORIES, "c1")).toEqual([SAMPLE_CATEGORIES[0]]);
  });
});
