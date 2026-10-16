import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/font/google", () => ({
  Barlow: () => ({ variable: "font-body" }),
  Barlow_Condensed: () => ({ variable: "font-display" }),
}));

vi.mock("./catdog-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./catdog-data")>();
  return {
    ...actual,
    getCatDogLines: async () => [
      { id: "banho", title: "Banho em casa", pitch: "p", products: [{ id: "a", name: "SHAMPOO MORANGO 700ML", img: "https://x/a.jpg" }] },
      { id: "bucal", title: "Higiene bucal", pitch: "p", products: [{ id: "b", name: "CREME DENTAL CATDOG MENTA", img: "https://x/b.jpg" }] },
      { id: "gatos", title: "Para gatos", pitch: "p", products: [{ id: "c", name: "GRAMINHA P/ GATO 50G", img: "https://x/c.jpg" }] },
    ],
  };
});

import CreatorsPage from "./page";
import { groupCatDogLines } from "./catdog-data";

describe("CreatorsPage", () => {
  it("mostra os programas de afiliados, o portfólio e os roteiros, sem formulário", async () => {
    render(await CreatorsPage());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/divulgue cat dog/i);

    const ganhar = screen.getByRole("region", { name: /como ganhar/i });
    const programas = within(ganhar).getAllByRole("link", { name: /entrar no programa/i });
    expect(programas.map((a) => a.getAttribute("href"))).toEqual([
      "https://www.mercadolivre.com.br/l/comece-a-recomendar",
      "https://affiliate.shopee.com.br",
    ]);

    expect(screen.getByText("Shampoo Morango 700ml")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Roteiros prontos" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("não cita percentual de comissão nem usa atacado, cotação ou loja", async () => {
    const { container } = render(await CreatorsPage());
    container.querySelectorAll("style").forEach((el) => el.remove());
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\d+\s?%/);
    expect(text).not.toMatch(/atacado|cota[cç][aã]o|\bloja\b/i);
  });
});

describe("groupCatDogLines", () => {
  const row = (id: string, category: string | null, withImage = true) => ({
    id,
    name: `PRODUTO ${id}`,
    categories: category ? { name: category } : null,
    product_assets: withImage ? [{ url: `https://x/${id}.jpg`, type: "main_image" }] : [],
  });

  it("agrupa pela categoria na ordem das linhas e descarta sem foto ou sem linha", () => {
    const lines = groupCatDogLines([
      row("b", "Higiene Bucal"),
      row("a", "Sabonetes"),
      row("x", "Categoria desconhecida"),
      row("y", "Sabonetes", false),
    ]);
    expect(lines.map((l) => [l.id, l.products.map((p) => p.id)])).toEqual([
      ["banho", ["a"]],
      ["bucal", ["b"]],
    ]);
  });
});
