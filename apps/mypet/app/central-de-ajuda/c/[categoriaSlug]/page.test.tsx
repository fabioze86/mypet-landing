import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const getCategoriaAjudaBySlug = vi.fn();
const getArtigosAjudaPublicadosPorCategoria = vi.fn();
const getCategoriasAjuda = vi.fn();
const getCategoriaIdsComArtigosPublicados = vi.fn();
vi.mock("@mypet/core/help-center", () => ({
  getCategoriaAjudaBySlug: (slug: string) => getCategoriaAjudaBySlug(slug),
  getArtigosAjudaPublicadosPorCategoria: (id: string) => getArtigosAjudaPublicadosPorCategoria(id),
  getCategoriasAjuda: () => getCategoriasAjuda(),
  getCategoriaIdsComArtigosPublicados: () => getCategoriaIdsComArtigosPublicados(),
}));

import CategoriaAjudaPage, { generateStaticParams } from "./page";

const PRIMEIROS_PASSOS = { id: "c1", slug: "primeiros-passos", titulo: "Primeiros passos", descricao: "d", icone: "Flag", ordem: 0 };
const CADASTRO = { id: "c2", slug: "cadastro", titulo: "Cadastro e acesso", descricao: "d", icone: "UserCircle", ordem: 1 };
const CATALOGO = { id: "c3", slug: "catalogo", titulo: "Catálogo e produtos", descricao: "d", icone: "Package", ordem: 2 };

const ARTIGO = {
  id: "a1",
  categoriaId: "c1",
  slug: "como-comprar",
  titulo: "Como comprar",
  resumo: "Passo a passo",
  ordem: 0,
  corpoMarkdown: "Basta criar seu acesso.",
};

beforeEach(() => {
  notFound.mockClear();
  getCategoriaAjudaBySlug.mockReset();
  getArtigosAjudaPublicadosPorCategoria.mockReset();
  getCategoriasAjuda.mockReset().mockResolvedValue([PRIMEIROS_PASSOS, CADASTRO, CATALOGO]);
  getCategoriaIdsComArtigosPublicados.mockReset().mockResolvedValue(["c1", "c2"]);
});

const renderPage = async (categoriaSlug: string) =>
  render(await CategoriaAjudaPage({ params: Promise.resolve({ categoriaSlug }) }));

describe("CategoriaAjudaPage", () => {
  it("chama notFound quando a categoria não existe", async () => {
    getCategoriaAjudaBySlug.mockResolvedValue(null);
    await expect(renderPage("nao-existe")).rejects.toThrow("NOT_FOUND");
  });

  it("chama notFound quando a categoria não tem artigo publicado", async () => {
    getCategoriaAjudaBySlug.mockResolvedValue(CATALOGO);
    getArtigosAjudaPublicadosPorCategoria.mockResolvedValue([]);
    await expect(renderPage("catalogo")).rejects.toThrow("NOT_FOUND");
  });

  it("lista os artigos como acordeão, com a resposta na mesma página", async () => {
    getCategoriaAjudaBySlug.mockResolvedValue(PRIMEIROS_PASSOS);
    getArtigosAjudaPublicadosPorCategoria.mockResolvedValue([ARTIGO]);
    const { container } = await renderPage("primeiros-passos");
    expect(screen.getByRole("heading", { name: "Primeiros passos" })).toBeInTheDocument();
    const details = container.querySelector("details#como-comprar");
    expect(details?.querySelector("summary")).toHaveTextContent("Como comprar");
    expect(details).toHaveTextContent("Basta criar seu acesso.");
  });

  it("mostra links rápidos no header só para categorias com artigo publicado", async () => {
    getCategoriaAjudaBySlug.mockResolvedValue(PRIMEIROS_PASSOS);
    getArtigosAjudaPublicadosPorCategoria.mockResolvedValue([ARTIGO]);
    await renderPage("primeiros-passos");
    const nav = screen.getByRole("navigation", { name: "Categorias da central de ajuda" });
    expect(nav.querySelector('a[href="/central-de-ajuda/c/primeiros-passos"]')).toHaveAttribute("aria-current", "page");
    expect(nav.querySelector('a[href="/central-de-ajuda/c/cadastro"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/central-de-ajuda/c/catalogo"]')).toBeNull();
  });
});

describe("generateStaticParams", () => {
  it("pré-renderiza só as categorias com artigo publicado", async () => {
    expect(await generateStaticParams()).toEqual([{ categoriaSlug: "primeiros-passos" }, { categoriaSlug: "cadastro" }]);
  });

  it("devolve um placeholder quando nenhuma categoria tem artigo", async () => {
    getCategoriaIdsComArtigosPublicados.mockResolvedValue([]);
    expect(await generateStaticParams()).toEqual([{ categoriaSlug: "__placeholder__" }]);
  });
});
