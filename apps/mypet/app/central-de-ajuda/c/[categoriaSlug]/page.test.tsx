import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const getCategoriaAjudaBySlug = vi.fn();
const getArtigosAjudaPublicadosPorCategoria = vi.fn();
vi.mock("@mypet/core/help-center", () => ({
  getCategoriaAjudaBySlug: (slug: string) => getCategoriaAjudaBySlug(slug),
  getArtigosAjudaPublicadosPorCategoria: (id: string) => getArtigosAjudaPublicadosPorCategoria(id),
}));

// Acessa o corpo async da página diretamente (a página exportada por padrão só
// monta o header/footer estáticos e delega a busca de dados a este componente,
// para permitir o boundary de Suspense exigido pelo cacheComponents).
import { CategoriaAjudaPageBody as CategoriaAjudaPage } from "./page";

beforeEach(() => {
  notFound.mockClear();
  getCategoriaAjudaBySlug.mockReset();
  getArtigosAjudaPublicadosPorCategoria.mockReset();
});

describe("CategoriaAjudaPage", () => {
  it("chama notFound quando a categoria não existe", async () => {
    getCategoriaAjudaBySlug.mockResolvedValue(null);
    await expect(
      CategoriaAjudaPage({ params: Promise.resolve({ categoriaSlug: "nao-existe" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("lista os artigos publicados da categoria", async () => {
    getCategoriaAjudaBySlug.mockResolvedValue({ id: "c1", slug: "precos", titulo: "Preços", descricao: "d", icone: "Tag", ordem: 0 });
    getArtigosAjudaPublicadosPorCategoria.mockResolvedValue([
      { id: "a1", categoriaId: "c1", slug: "pedido-minimo", titulo: "Pedido mínimo", resumo: "R$ 250 na capital", ordem: 0 },
    ]);
    render(await CategoriaAjudaPage({ params: Promise.resolve({ categoriaSlug: "precos" }) }));
    expect(screen.getByRole("heading", { name: "Preços" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pedido mínimo/ })).toHaveAttribute("href", "/central-de-ajuda/a/pedido-minimo");
  });

  it("mostra estado vazio quando não há artigo publicado", async () => {
    getCategoriaAjudaBySlug.mockResolvedValue({ id: "c1", slug: "precos", titulo: "Preços", descricao: "d", icone: "Tag", ordem: 0 });
    getArtigosAjudaPublicadosPorCategoria.mockResolvedValue([]);
    render(await CategoriaAjudaPage({ params: Promise.resolve({ categoriaSlug: "precos" }) }));
    expect(screen.getByText(/Nenhum artigo publicado/)).toBeInTheDocument();
  });
});
