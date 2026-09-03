import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CatalogPreview } from "./catalog-preview";

const cats = [
  { id: "1", slug: "racao", name: "Ração" },
  { id: "2", slug: "higiene", name: "Higiene" },
];

describe("CatalogPreview", () => {
  it("lista categorias sem qualquer preço", () => {
    render(<CatalogPreview categories={cats} thumbs={{}} />);
    const region = screen.getByRole("region", { name: "Vitrine do catálogo" });
    expect(within(region).getByText("Ração")).toBeInTheDocument();
    expect(within(region).queryByText(/R\$\s?\d/)).toBeNull();
    expect(within(region).queryByText(/\bSKU\b/i)).toBeNull();
  });

  it("aponta tudo para o formulário de acesso", () => {
    const { container } = render(<CatalogPreview categories={cats} thumbs={{}} />);
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((a) => a.getAttribute("href") === "#acesso")).toBe(true);
  });
});
