import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Palette } from "../theme";

vi.mock("../catalog", () => ({
  getCatalog: vi.fn(),
  getBrands: vi.fn(),
}));

vi.mock("./product-card", () => ({
  ProductCard: () => createElement("article"),
}));

import { getBrands, getCatalog } from "../catalog";
import { CatalogSection } from "./catalog-section";

const palette: Palette = {
  pink: "#f0a", pinkDark: "#c07", pinkLight: "#fde", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
  navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
  gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
};

describe("CatalogSection pagination", () => {
  it("navega da página 2 para a primeira página sem manter a URL atual", async () => {
    vi.mocked(getCatalog).mockResolvedValue({
      items: [{ id: "bandana", name: "Bandana", sku: "B-1", brand: "My Pet", img: "/bandana.jpg", badge: null, salePrice: null, priceLabel: null }],
      total: 48,
      page: 2,
      totalPages: 2,
    });
    vi.mocked(getBrands).mockResolvedValue([]);

    const markup = renderToStaticMarkup(
      await CatalogSection({ page: "2", channel: "distribuidora", palette }),
    );

    expect(markup).toContain('href="?" class="cat-btn">← Anterior');
  });
});
