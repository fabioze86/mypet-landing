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

  it("inclui os 7 serviços na seção Serviços", () => {
    const services = buildSiteIndex([], []).filter((e) => e.section === "Serviços");
    expect(services.map((e) => e.path)).toEqual([
      "/seo-para-ecommerce",
      "/trafego-pago-para-ecommerce",
      "/cro-otimizacao-de-conversao",
      "/email-marketing-para-ecommerce",
      "/ux-para-ecommerce",
      "/social-media-para-marcas",
      "/assessoria-de-marketing-digital",
    ]);
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

  it("tem a seção Serviços entre Páginas e Guias e apresenta a agência", () => {
    const text = renderLlmsTxt(buildSiteIndex([guide], []));
    expect(text).toContain("> Agência de crescimento para marcas e e-commerces.");
    expect(text.indexOf("## Páginas")).toBeLessThan(text.indexOf("## Serviços"));
    expect(text.indexOf("## Serviços")).toBeLessThan(text.indexOf("## Guias"));
    expect(text).toContain("](https://www.zemann.com.br/seo-para-ecommerce): ");
  });
});
