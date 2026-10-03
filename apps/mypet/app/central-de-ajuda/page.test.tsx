import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@mypet/core/help-center", () => ({
  getCategoriasAjuda: async () => [
    { id: "c1", slug: "precos", titulo: "Preços", descricao: "Pedido mínimo e descontos", icone: "Tag", ordem: 0 },
    { id: "c2", slug: "notas", titulo: "Notas fiscais", descricao: "NF e XML", icone: "Receipt", ordem: 1 },
  ],
  getCategoriaIdsComArtigosPublicados: async () => ["c1"],
}));

import CentralDeAjudaPage from "./page";

describe("CentralDeAjudaPage", () => {
  it("lista as categorias com artigo publicado como link", async () => {
    render(await CentralDeAjudaPage());
    expect(screen.getByText("Pedido mínimo e descontos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Preços/ })).toHaveAttribute("href", "/central-de-ajuda/c/precos");
  });

  it("oculta categoria sem artigo publicado", async () => {
    render(await CentralDeAjudaPage());
    expect(screen.queryByText("Notas fiscais")).toBeNull();
  });
});
