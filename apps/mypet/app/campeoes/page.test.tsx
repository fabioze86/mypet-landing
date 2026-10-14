import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/font/google", () => ({
  Barlow: () => ({ variable: "font-body" }),
  Barlow_Condensed: () => ({ variable: "font-display" }),
}));

vi.mock("./champions-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./champions-data")>();
  return {
    ...actual,
    getChampions: async () => [
      { id: "a", sku: "1", name: "PERFUME PET LIFE ALEGRIA - 1 LITRO", brand: "PETLIFE", img: "https://x/a.jpg", group: "Banho e tosa" },
      { id: "b", sku: "2", name: "AREIA GATO KETS 4KG", brand: null, img: "https://x/b.jpg", group: "Gatos" },
      { id: "c", sku: "3", name: "TRANÇA FLEX REGGAE 1KG", brand: "GRANDOGS", img: "https://x/c.jpg", group: "Petiscos" },
    ],
  };
});

import ChampionsPage from "./page";
import { displayName, rankChampions, CHAMPIONS } from "./champions-data";

describe("ChampionsPage", () => {
  it("lista os campeões em ranking, sem preço, e leva ao formulário", async () => {
    render(await ChampionsPage());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/o que mais sai/i);
    expect(screen.getByText("Perfume Pet Life Alegria - 1 Litro")).toBeInTheDocument();
    expect(screen.getByText("#01")).toBeInTheDocument();
    expect(screen.getByText("#03")).toBeInTheDocument();
    expect(screen.getByLabelText("CNPJ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liberar preços" })).toBeInTheDocument();
  });

  it("não mostra preço na grade de produtos nem usa atacado, cotação ou loja na copy", async () => {
    const { container } = render(await ChampionsPage());
    const grid = screen.getByRole("region", { name: "Os campeões da My Pet" });
    expect(grid.textContent).not.toMatch(/R\$/);
    expect(container.textContent).not.toMatch(/atacado|cota[cç][aã]o|\bloja\b/i);
  });
});

describe("rankChampions", () => {
  const row = (reference: string, withImage = true) => ({
    id: reference,
    name: `Produto ${reference}`,
    reference,
    brand: null,
    product_assets: withImage ? [{ url: `https://x/${reference}.jpg`, type: "main_image" }] : [],
  });

  it("segue a ordem da lista curada e descarta item sem foto", () => {
    const [first, second, third] = CHAMPIONS.map((c) => c.sku);
    const ranked = rankChampions([row(third), row(second, false), row(first)]);
    expect(ranked.map((c) => c.sku)).toEqual([first, third]);
  });
});

describe("displayName", () => {
  it("converte nome em caixa alta para título", () => {
    expect(displayName("TAPETE HIGIENICO CONFORT PADS C/30 80X60")).toBe("Tapete Higienico Confort Pads C/30 80x60");
  });
});
