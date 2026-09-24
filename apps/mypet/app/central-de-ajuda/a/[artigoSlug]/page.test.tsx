import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const getArtigoAjudaPublicadoBySlug = vi.fn();
const getArtigosAjudaPublicadosPorCategoria = vi.fn();
vi.mock("@mypet/core/help-center", () => ({
  getArtigoAjudaPublicadoBySlug: (slug: string) => getArtigoAjudaPublicadoBySlug(slug),
  getArtigosAjudaPublicadosPorCategoria: (id: string) => getArtigosAjudaPublicadosPorCategoria(id),
}));

import ArtigoAjudaPage from "./page";

beforeEach(() => {
  notFound.mockClear();
  getArtigoAjudaPublicadoBySlug.mockReset();
  getArtigosAjudaPublicadosPorCategoria.mockReset();
});

describe("ArtigoAjudaPage", () => {
  it("chama notFound quando o artigo não existe ou está em rascunho", async () => {
    getArtigoAjudaPublicadoBySlug.mockResolvedValue(null);
    await expect(
      ArtigoAjudaPage({ params: Promise.resolve({ artigoSlug: "nao-existe" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("renderiza o título e o corpo em Markdown, e os artigos relacionados", async () => {
    getArtigoAjudaPublicadoBySlug.mockResolvedValue({
      id: "a1", categoriaId: "c1", slug: "pedido-minimo", titulo: "Pedido mínimo",
      resumo: "r", ordem: 0, corpoMarkdown: "**R$ 250,00** na capital.",
    });
    getArtigosAjudaPublicadosPorCategoria.mockResolvedValue([
      { id: "a1", categoriaId: "c1", slug: "pedido-minimo", titulo: "Pedido mínimo", resumo: "r", ordem: 0 },
      { id: "a2", categoriaId: "c1", slug: "desconto-avista", titulo: "Desconto à vista", resumo: "r2", ordem: 1 },
    ]);
    render(await ArtigoAjudaPage({ params: Promise.resolve({ artigoSlug: "pedido-minimo" }) }));
    expect(screen.getByRole("heading", { name: "Pedido mínimo" })).toBeInTheDocument();
    expect(screen.getByText("R$ 250,00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Desconto à vista" })).toHaveAttribute("href", "/central-de-ajuda/a/desconto-avista");
    expect(screen.queryByRole("link", { name: "Pedido mínimo" })).not.toBeInTheDocument();
  });
});
