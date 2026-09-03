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
  it("renderiza condições, como funciona, depoimentos, FAQ e CTA final", async () => {
    render(await LandingPage());
    expect(screen.getByText("Pedido mínimo")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /como funciona/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "O que dizem os lojistas" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Números da operação" })).toBeInTheDocument();
    expect(screen.getAllByRole("group").length).toBeGreaterThanOrEqual(8); // <details> do FAQ
  });

  it("a vitrine do catálogo mostra categorias sem qualquer preço", async () => {
    render(await LandingPage());
    const vitrine = screen.getByRole("region", { name: "Vitrine do catálogo" });
    expect(within(vitrine).getByText("Ração")).toBeInTheDocument();
    expect(within(vitrine).queryByText(/R\$\s?\d/)).toBeNull();
    expect(within(vitrine).queryByText(/\bSKU\b/i)).toBeNull();
  });

  it("tem um único h1", async () => {
    render(await LandingPage());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("usa o mesmo rótulo de CTA de conversão no header, hero e faixa final", async () => {
    const { container } = render(await LandingPage());
    const acessoLinks = Array.from(container.querySelectorAll('a[href="#acesso"]'));
    expect(acessoLinks.length).toBeGreaterThanOrEqual(2);
  });

  it("não tem em-dash na copy visível da página", async () => {
    const { container } = render(await LandingPage());
    expect(container.textContent ?? "").not.toMatch(/[–—]/);
  });
});
