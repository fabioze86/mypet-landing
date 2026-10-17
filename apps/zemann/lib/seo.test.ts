import { describe, expect, it } from "vitest";
import { pageMetadata } from "./seo";

describe("pageMetadata", () => {
  it("monta título, descrição, canonical e Open Graph", () => {
    const meta = pageMetadata({ path: "/sobre", title: "Sobre", description: "Desc" });
    expect(meta.title).toBe("Sobre");
    expect(meta.description).toBe("Desc");
    expect(meta.alternates?.canonical).toBe("/sobre");
    expect(meta.openGraph).toMatchObject({
      title: "Sobre",
      description: "Desc",
      url: "/sobre",
      siteName: "Zemann",
      locale: "pt_BR",
      type: "website",
    });
  });

  it("na home usa o título absoluto, sem o sufixo do template", () => {
    const meta = pageMetadata({ path: "/", title: "Zemann — X", description: "D" });
    expect(meta.title).toEqual({ absolute: "Zemann — X" });
  });

  it("artigo leva datas de publicação e atualização", () => {
    const meta = pageMetadata({
      path: "/guias/x",
      title: "T",
      description: "D",
      type: "article",
      publishedAt: "2026-10-01",
      updatedAt: "2026-10-10",
    });
    expect(meta.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-10-01",
      modifiedTime: "2026-10-10",
    });
  });
});
