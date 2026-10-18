import { siteConfig } from "@/site.config";
import type { CaseMeta, GuideMeta } from "./content";
import { PAGES } from "./pages";

export type IndexEntry = {
  path: string;
  title: string;
  description: string;
  lastModified?: string;
  section: "Páginas" | "Guias" | "Cases";
};

export function buildSiteIndex(guides: GuideMeta[], cases: CaseMeta[]): IndexEntry[] {
  return [
    ...Object.values(PAGES).map((page) => ({
      path: page.path,
      title: page.title,
      description: page.description,
      section: "Páginas" as const,
    })),
    ...guides.map((guide) => ({
      path: `/guias/${guide.slug}`,
      title: guide.title,
      description: guide.description,
      lastModified: guide.updatedAt,
      section: "Guias" as const,
    })),
    ...cases.map((item) => ({
      path: `/cases/${item.slug}`,
      title: item.title,
      description: item.description,
      lastModified: item.updatedAt,
      section: "Cases" as const,
    })),
  ];
}

export function renderLlmsTxt(entries: IndexEntry[]): string {
  const sections: IndexEntry["section"][] = ["Páginas", "Guias", "Cases"];
  const lines = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.tagline}. Consultoria independente, sem vínculo com a Amazon, que opera uma marca própria na Amazon e usa tecnologia conectada à API oficial da Amazon (SP-API).`,
    "",
    "Atende marcas e indústrias (vendor e seller) e sellers estabelecidos no Brasil. Oferta em três etapas: diagnóstico da conta, implantação (30 a 90 dias) e gestão contínua.",
  ];
  for (const section of sections) {
    const items = entries.filter((entry) => entry.section === section);
    if (items.length === 0) continue;
    lines.push("", `## ${section}`, "");
    for (const item of items) {
      lines.push(`- [${item.title}](${siteConfig.url}${item.path}): ${item.description}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
