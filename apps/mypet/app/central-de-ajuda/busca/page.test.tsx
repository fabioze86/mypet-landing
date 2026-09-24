import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const buscarArtigosAjudaPublicados = vi.fn();
vi.mock("@mypet/core/help-center", () => ({
  buscarArtigosAjudaPublicados: (termo: string) => buscarArtigosAjudaPublicados(termo),
}));

// Acessa o corpo async da página diretamente (a página exportada por padrão só
// monta o header/footer estáticos e delega a busca de dados a este componente,
// para permitir o boundary de Suspense exigido pelo cacheComponents).
import { BuscaAjudaPageBody as BuscaAjudaPage } from "./page";

beforeEach(() => {
  buscarArtigosAjudaPublicados.mockReset();
});

describe("BuscaAjudaPage", () => {
  it("não busca quando não há termo na query", async () => {
    render(await BuscaAjudaPage({ searchParams: Promise.resolve({}) }));
    expect(buscarArtigosAjudaPublicados).not.toHaveBeenCalled();
  });

  it("busca e lista os resultados quando há termo", async () => {
    buscarArtigosAjudaPublicados.mockResolvedValue([
      { id: "a1", categoriaId: "c1", slug: "pedido-minimo", titulo: "Pedido mínimo", resumo: "R$ 250 na capital", ordem: 0 },
    ]);
    render(await BuscaAjudaPage({ searchParams: Promise.resolve({ q: "pedido" }) }));
    expect(buscarArtigosAjudaPublicados).toHaveBeenCalledWith("pedido");
    expect(screen.getByRole("link", { name: /Pedido mínimo/ })).toHaveAttribute("href", "/central-de-ajuda/a/pedido-minimo");
  });

  it("mostra estado vazio quando a busca não acha nada", async () => {
    buscarArtigosAjudaPublicados.mockResolvedValue([]);
    render(await BuscaAjudaPage({ searchParams: Promise.resolve({ q: "xyz" }) }));
    expect(screen.getByText(/Nenhum artigo encontrado/)).toBeInTheDocument();
  });
});
