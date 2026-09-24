import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@mypet/core/help-center", () => ({
  getCategoriasAjuda: async () => [
    { id: "c1", slug: "precos", titulo: "Preços", descricao: "Pedido mínimo e descontos", icone: "Tag", ordem: 0 },
  ],
}));

import CentralDeAjudaPage from "./page";

describe("CentralDeAjudaPage", () => {
  it("lista as categorias vindas de getCategoriasAjuda", async () => {
    render(await CentralDeAjudaPage());
    expect(screen.getByText("Preços")).toBeInTheDocument();
    expect(screen.getByText("Pedido mínimo e descontos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Preços/ })).toHaveAttribute("href", "/central-de-ajuda/c/precos");
  });
});
