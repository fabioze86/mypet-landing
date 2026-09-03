import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@mypet/core/catalog", () => ({
  getCategories: async () => [
    { id: "1", slug: "racao", name: "Ração" },
    { id: "2", slug: "higiene", name: "Higiene" },
  ],
}));

vi.mock("./_data/category-thumbs", () => ({
  getCategoryThumbs: async () => ({}),
}));

import LandingPage from "./page";

describe("LandingPage", () => {
  it("renderiza as três condições comerciais e o FAQ da central de ajuda", async () => {
    render(await LandingPage());
    expect(screen.getByText("Pedido mínimo")).toBeInTheDocument();
    expect(screen.getByText("Formas de pagamento")).toBeInTheDocument();
    expect(screen.getByText("Entrega, frete e prazo")).toBeInTheDocument();
    expect(screen.getAllByRole("group").length).toBeGreaterThanOrEqual(8); // <details> do FAQ
  });

  it("mostra nomes de categoria sem qualquer preço", async () => {
    render(await LandingPage());
    const categorias = screen.getByRole("region", { name: "Vitrine do catálogo" });
    expect(within(categorias).getByText("Ração")).toBeInTheDocument();
    // regras comerciais (pedido mínimo, parcelamento) podem citar R$ no FAQ/condições;
    // a grade de categorias nunca mostra preço de produto.
    expect(within(categorias).queryByText(/Preço do canal distribuidora/)).toBeNull();
    expect(within(categorias).queryByText(/R\$\s?\d/)).toBeNull();
  });

  it("tem um único h1", async () => {
    render(await LandingPage());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
