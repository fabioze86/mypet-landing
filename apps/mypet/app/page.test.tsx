import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
  it("renderiza as três condições comerciais e as oito perguntas do FAQ", async () => {
    render(await LandingPage());
    expect(screen.getByText("Pedido mínimo")).toBeInTheDocument();
    expect(screen.getByText("Desconto por volume")).toBeInTheDocument();
    expect(screen.getByText("Entrega, frete e prazo")).toBeInTheDocument();
    expect(screen.getAllByRole("group").length).toBeGreaterThanOrEqual(8); // <details> do FAQ
  });

  it("mostra nomes de categoria sem qualquer preço", async () => {
    render(await LandingPage());
    expect(screen.getByText("Ração")).toBeInTheDocument();
    expect(screen.queryByText(/Preço do canal distribuidora/)).toBeNull();
    expect(screen.queryByText(/R\$\s?\d/)).toBeNull();
  });

  it("tem um único h1", async () => {
    render(await LandingPage());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
