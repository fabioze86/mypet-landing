import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const PRODUCT = { id: "p1", name: "Coleira", img: "x.png", sku: "S1", salePrice: 10, categoryId: "c1" };
vi.mock("@mypet/core/catalog", () => ({
  getProductById: vi.fn(async () => PRODUCT),
  getCategories: vi.fn(async () => []),
}));
vi.mock("@mypet/core/balcao", () => ({
  getBalcaoRules: vi.fn(async () => []),
  resolveRuleForProduct: vi.fn(() => ({ id: "r" })),
}));
vi.mock("@mypet/core/catalog-utils", () => ({
  getCategoryPath: vi.fn(() => [{ name: "Coleiras", slug: "coleiras" }]),
}));
vi.mock("@mypet/core/components/lead-gate", () => ({ LeadGateProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@mypet/core/components/product-variant-panel", () => ({ ProductVariantPanel: () => null }));
vi.mock("@mypet/core/seo", () => ({
  productGroupJsonLd: () => null,
  productJsonLd: () => null,
  breadcrumbJsonLd: () => ({}),
  canonicalUrl: (d: string, p: string) => `https://${d}${p}`,
  jsonLdScript: () => "{}",
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("../../_components/hub/hub-header", () => ({ HubHeaderSlot: () => null }));

import ProductPage from "./page";

type El = { type?: unknown; props?: { children?: unknown } };
function findByName(node: unknown, name: string): El | null {
  if (Array.isArray(node)) {
    for (const n of node) { const r = findByName(n, name); if (r) return r; }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  const el = node as El;
  if (typeof el.type === "function" && (el.type as { name: string }).name === name) return el;
  return findByName(el.props?.children, name);
}

// ProductDetail é um server component assíncrono dentro de Suspense:
// resolve manualmente e renderiza as duas partes.
async function renderPage(vitrineId?: "completo" | "fabrica") {
  const ui = await ProductPage({ params: Promise.resolve({ id: "p1" }), vitrineId });
  const detail = findByName(ui, "ProductDetail") as { type: (p: unknown) => Promise<React.ReactElement>; props: unknown };
  render(ui);
  render(await detail.type(detail.props));
}

describe("ProductPage links", () => {
  it("completo: volta para /produtos, categoria sem prefixo, balcão visível", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: "← Voltar aos produtos" })).toHaveAttribute("href", "/produtos");
    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("href", "/produtos");
    expect(screen.getByRole("link", { name: "Coleiras" })).toHaveAttribute("href", "/categoria/coleiras");
    expect(screen.getByRole("link", { name: /Balcão de Negócios/ })).toHaveAttribute("href", "/balcao");
  });

  it("fabrica: links ficam em /fabrica e sem balcão", async () => {
    await renderPage("fabrica");
    expect(screen.getByRole("link", { name: "← Voltar aos produtos" })).toHaveAttribute("href", "/fabrica");
    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("href", "/fabrica");
    expect(screen.getByRole("link", { name: "Coleiras" })).toHaveAttribute("href", "/fabrica/categoria/coleiras");
    expect(screen.queryByRole("link", { name: /Balcão de Negócios/ })).toBeNull();
  });
});
