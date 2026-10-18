import { describe, expect, it } from "vitest";
import type { CaseMeta, GuideMeta } from "./content";
import { buildSiteIndex, renderLlmsTxt } from "./site-index";

const guide: GuideMeta = {
  slug: "buy-box-na-amazon",
  title: "Buy Box",
  description: "Sobre Buy Box.",
  answer: "R.",
  author: "fabio",
  publishedAt: "2026-10-01",
  updatedAt: "2026-10-05",
  faq: [],
  draft: false,
  cta: "sellers",
};

const caseItem: CaseMeta = {
  ...guide,
  slug: "my-pet-na-amazon",
  title: "My Pet",
  description: "Case.",
  client: "My Pet Brasil",
  problem: "P",
  solution: "S",
  impact: "I",
  authorized: true,
};

describe("buildSiteIndex", () => {
  it("inclui páginas fixas, guias e cases com lastModified do conteúdo", () => {
    const index = buildSiteIndex([guide], [caseItem]);
    expect(index.find((e) => e.path === "/")?.section).toBe("Páginas");
    expect(index.find((e) => e.path === "/guias/buy-box-na-amazon")).toMatchObject({ section: "Guias", lastModified: "2026-10-05" });
    expect(index.find((e) => e.path === "/cases/my-pet-na-amazon")?.section).toBe("Cases");
  });
});

describe("renderLlmsTxt", () => {
  it("segue o formato llms.txt com título, resumo e seções de links absolutos", () => {
    const text = renderLlmsTxt(buildSiteIndex([guide], []));
    expect(text.startsWith("# Zemann\n\n> ")).toBe(true);
    expect(text).toContain("## Páginas");
    expect(text).toContain("## Guias");
    expect(text).toContain("- [Buy Box](https://www.zemann.com.br/guias/buy-box-na-amazon): Sobre Buy Box.");
    expect(text).not.toContain("## Cases");
  });
});
