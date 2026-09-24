import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
}));

let rows: unknown[] = [];
const calls: Record<string, unknown> = {};

vi.mock("./supabase", () => {
  return {
    getHubClient: () => {
      const builder: Record<string, unknown> = {};
      const chain = (name: string) => (...args: unknown[]) => {
        calls[name] = args;
        return builder;
      };
      builder.select = chain("select");
      builder.eq = (...args: unknown[]) => {
        calls["eq"] = [...((calls["eq"] as unknown[][] | undefined) ?? []), args];
        return builder;
      };
      builder.or = chain("or");
      builder.order = chain("order");
      builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) => {
        resolve({ data: rows, error: null });
      };
      return { from: chain("from") };
    },
  };
});

import {
  getCategoriasAjuda,
  getCategoriaAjudaBySlug,
  getArtigosAjudaPublicadosPorCategoria,
  getArtigoAjudaPublicadoBySlug,
  buscarArtigosAjudaPublicados,
} from "./help-center";

beforeEach(() => {
  rows = [];
  for (const k of Object.keys(calls)) delete calls[k];
});

describe("getCategoriasAjuda", () => {
  it("ordena por ordem e mapeia snake_case para camelCase", async () => {
    rows = [{ id: "c1", slug: "precos", titulo: "Preços", descricao: "Pedido mínimo e descontos", icone: "Tag", ordem: 3 }];
    const result = await getCategoriasAjuda();
    expect(calls["from"]).toEqual(["categorias_ajuda"]);
    expect(calls["order"]).toEqual(["ordem", { ascending: true }]);
    expect(result).toEqual([{ id: "c1", slug: "precos", titulo: "Preços", descricao: "Pedido mínimo e descontos", icone: "Tag", ordem: 3 }]);
  });
});

describe("getCategoriaAjudaBySlug", () => {
  it("filtra por slug e devolve a primeira linha", async () => {
    rows = [{ id: "c1", slug: "precos", titulo: "Preços", descricao: "d", icone: "Tag", ordem: 0 }];
    const result = await getCategoriaAjudaBySlug("precos");
    expect(calls["eq"]).toContainEqual(["slug", "precos"]);
    expect(result?.id).toBe("c1");
  });

  it("devolve null quando não há linha", async () => {
    rows = [];
    const result = await getCategoriaAjudaBySlug("nao-existe");
    expect(result).toBeNull();
  });
});

describe("getArtigosAjudaPublicadosPorCategoria", () => {
  it("filtra por categoria_id e por status publicado", async () => {
    rows = [{ id: "a1", categoria_id: "c1", slug: "pedido-minimo", titulo: "Pedido mínimo", resumo: "r", ordem: 0 }];
    const result = await getArtigosAjudaPublicadosPorCategoria("c1");
    expect(calls["eq"]).toContainEqual(["categoria_id", "c1"]);
    expect(calls["eq"]).toContainEqual(["status", "publicado"]);
    expect(result).toEqual([{ id: "a1", categoriaId: "c1", slug: "pedido-minimo", titulo: "Pedido mínimo", resumo: "r", ordem: 0 }]);
  });
});

describe("getArtigoAjudaPublicadoBySlug", () => {
  it("filtra por slug e por status publicado, incluindo o corpo", async () => {
    rows = [{ id: "a1", categoria_id: "c1", slug: "pedido-minimo", titulo: "t", resumo: "r", ordem: 0, corpo_markdown: "## Olá" }];
    const result = await getArtigoAjudaPublicadoBySlug("pedido-minimo");
    expect(calls["eq"]).toContainEqual(["slug", "pedido-minimo"]);
    expect(calls["eq"]).toContainEqual(["status", "publicado"]);
    expect(result?.corpoMarkdown).toBe("## Olá");
  });
});

describe("buscarArtigosAjudaPublicados", () => {
  it("busca por título, resumo e palavras-chave, só entre os publicados", async () => {
    rows = [];
    await buscarArtigosAjudaPublicados("pedido mínimo");
    expect(calls["or"]).toEqual([
      "titulo.ilike.%pedido mínimo%,resumo.ilike.%pedido mínimo%,palavras_chave.ilike.%pedido mínimo%,corpo_markdown.ilike.%pedido mínimo%",
    ]);
    expect(calls["eq"]).toContainEqual(["status", "publicado"]);
  });

  it("escapa vírgula e parênteses no termo de busca", async () => {
    rows = [];
    await buscarArtigosAjudaPublicados("caixa (transporte), pequena");
    expect(calls["or"]).toEqual([
      "titulo.ilike.%caixa \\(transporte\\)\\, pequena%,resumo.ilike.%caixa \\(transporte\\)\\, pequena%,palavras_chave.ilike.%caixa \\(transporte\\)\\, pequena%,corpo_markdown.ilike.%caixa \\(transporte\\)\\, pequena%",
    ]);
  });
});
