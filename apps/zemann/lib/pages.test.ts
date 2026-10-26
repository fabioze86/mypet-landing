import { describe, expect, it } from "vitest";
import { MENU_GROUPS, PAGES } from "./pages";
import { SERVICES } from "./services";

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

describe("MENU_GROUPS", () => {
  it("tem os grupos Amazon, Serviços, Recursos e Empresa", () => {
    expect(MENU_GROUPS.map((group) => group.label)).toEqual(["Amazon", "Serviços", "Recursos", "Empresa"]);
  });

  it("grupo Serviços lista os 7 serviços novos na ordem do catálogo", () => {
    const group = MENU_GROUPS.find((g) => g.label === "Serviços")!;
    expect(group.items.map((item) => item.page.path)).toEqual(Object.values(SERVICES).map((s) => s.path));
    for (const item of group.items) expect(item.hint.length).toBeGreaterThan(0);
  });

  it("home se apresenta como agência", () => {
    expect(PAGES.home.title).toBe("Zemann — Agência de crescimento para e-commerce");
  });
});
