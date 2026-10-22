import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@mypet/core/help-center", () => ({
  getCategoriasAjuda: async () => [
    { id: "c1", slug: "precos", titulo: "Preços", descricao: "Pedido mínimo e descontos", icone: "Tag", ordem: 0 },
    { id: "c2", slug: "notas", titulo: "Notas fiscais", descricao: "NF e XML", icone: "Receipt", ordem: 1 },
  ],
  getCategoriaIdsComArtigosPublicados: async () => ["c1"],
}));

vi.mock("../_components/hub/hub-header", () => ({
  HubHeaderSlot: ({ current }: { current?: string }) => <header data-testid="hub-header" data-current={current} />,
}));

import CentralDeAjudaPage from "./page";

describe("CentralDeAjudaPage", () => {
  it("usa o cabeçalho do hub com Dúvidas marcada e tem busca na página", async () => {
    render(await CentralDeAjudaPage());
    expect(screen.getByTestId("hub-header")).toHaveAttribute("data-current", "duvidas");
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });

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
