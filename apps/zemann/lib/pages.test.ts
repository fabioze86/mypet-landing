import { describe, expect, it } from "vitest";
import { PAGES } from "./pages";

describe("PAGES", () => {
  const entries = Object.entries(PAGES);

  it("tem caminhos únicos começando com /", () => {
    const paths = entries.map(([, p]) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path.startsWith("/")).toBe(true);
  });

  it("respeita os limites de título e descrição", () => {
    for (const [key, page] of entries) {
      expect(page.description.length, key).toBeLessThanOrEqual(160);
      if (key !== "home") expect(page.title.length, key).toBeLessThanOrEqual(55);
    }
  });

  it("não insinua vínculo com a Amazon", () => {
    for (const [, page] of entries) {
      expect(`${page.title} ${page.description}`.toLowerCase()).not.toContain("parceiro oficial");
    }
  });
});
