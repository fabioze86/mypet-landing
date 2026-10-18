import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ContentError,
  getGuide,
  listCases,
  listGuides,
  parseCaseMeta,
  parseGuideMeta,
} from "./content";

const base = {
  title: "Título",
  description: "Descrição curta.",
  answer: "Resposta direta.",
  author: "fabio",
  publishedAt: "2026-10-01",
  updatedAt: "2026-10-05",
};

function mdx(front: Record<string, unknown>, body = "Corpo."): string {
  const yaml = Object.entries(front)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return `---\n${yaml}\n---\n\n${body}\n`;
}

describe("parseGuideMeta", () => {
  it("aceita frontmatter válido e aplica padrões", () => {
    expect(parseGuideMeta("x", base)).toEqual({
      slug: "x",
      ...base,
      faq: [],
      draft: false,
      cta: "diagnostico",
    });
  });

  it("converte Date do YAML para ISO", () => {
    const meta = parseGuideMeta("x", { ...base, publishedAt: new Date("2026-10-01T00:00:00Z") });
    expect(meta.publishedAt).toBe("2026-10-01");
  });

  it("recusa descrição acima de 160 caracteres", () => {
    expect(() => parseGuideMeta("x", { ...base, description: "a".repeat(161) })).toThrow(ContentError);
  });

  it("recusa título acima de 55 caracteres", () => {
    expect(() => parseGuideMeta("x", { ...base, title: "a".repeat(56) })).toThrow(/title.*máximo 55/);
  });

  it("aceita título de exatamente 55 caracteres", () => {
    expect(parseGuideMeta("x", { ...base, title: "a".repeat(55) }).title).toHaveLength(55);
  });

  it("recusa atualização anterior à publicação", () => {
    expect(() => parseGuideMeta("x", { ...base, updatedAt: "2026-09-01" })).toThrow(/updatedAt/);
  });

  it("recusa autor desconhecido", () => {
    expect(() => parseGuideMeta("x", { ...base, author: "outro" })).toThrow(/author/);
  });

  it("recusa faq malformado", () => {
    expect(() => parseGuideMeta("x", { ...base, faq: [{ q: "P?" }] })).toThrow(/faq/);
  });

  it("recusa cta desconhecido", () => {
    expect(() => parseGuideMeta("x", { ...base, cta: "loja" })).toThrow(/cta/);
  });
});

describe("parseCaseMeta", () => {
  it("exige authorized booleano", () => {
    expect(() =>
      parseCaseMeta("c", { ...base, client: "C", problem: "P", solution: "S", impact: "I" }),
    ).toThrow(/authorized/);
  });
});

describe("listagens", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "zemann-content-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("lista só publicados, do mais recente ao mais antigo", () => {
    writeFileSync(join(dir, "antigo.mdx"), mdx({ ...base, publishedAt: "2026-09-01", updatedAt: "2026-09-01" }));
    writeFileSync(join(dir, "novo.mdx"), mdx({ ...base, publishedAt: "2026-10-10", updatedAt: "2026-10-10" }));
    writeFileSync(join(dir, "rascunho.mdx"), mdx({ ...base, draft: true }));
    expect(listGuides({ dir, includeDrafts: false }).map((g) => g.slug)).toEqual(["novo", "antigo"]);
    expect(listGuides({ dir, includeDrafts: true })).toHaveLength(3);
  });

  it("getGuide devolve null para rascunho e para slug inexistente", () => {
    writeFileSync(join(dir, "rascunho.mdx"), mdx({ ...base, draft: true }));
    expect(getGuide("rascunho", { dir, includeDrafts: false })).toBeNull();
    expect(getGuide("nao-existe", { dir, includeDrafts: false })).toBeNull();
  });

  it("case não autorizado não aparece nem com rascunhos liberados", () => {
    const caseBase = { ...base, client: "C", problem: "P", solution: "S", impact: "I" };
    writeFileSync(join(dir, "ok.mdx"), mdx({ ...caseBase, authorized: true }));
    writeFileSync(join(dir, "pendente.mdx"), mdx({ ...caseBase, authorized: false }));
    expect(listCases({ dir, includeDrafts: true }).map((c) => c.slug)).toEqual(["ok"]);
  });

  it("frontmatter inválido derruba a listagem com o nome do arquivo", () => {
    writeFileSync(join(dir, "quebrado.mdx"), mdx({ ...base, author: "outro" }));
    expect(() => listGuides({ dir, includeDrafts: false })).toThrow(/quebrado/);
  });

  describe("rascunhos e ambiente", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("ZEMANN_SHOW_DRAFTS não vale em produção", () => {
      writeFileSync(join(dir, "rascunho.mdx"), mdx({ ...base, draft: true }));
      vi.stubEnv("ZEMANN_SHOW_DRAFTS", "1");
      vi.stubEnv("VERCEL_ENV", "production");
      expect(listGuides({ dir })).toHaveLength(0);
    });

    it("ZEMANN_SHOW_DRAFTS libera rascunhos fora de produção", () => {
      writeFileSync(join(dir, "rascunho.mdx"), mdx({ ...base, draft: true }));
      vi.stubEnv("ZEMANN_SHOW_DRAFTS", "1");
      vi.stubEnv("VERCEL_ENV", "preview");
      expect(listGuides({ dir })).toHaveLength(1);
    });
  });

  describe("marca REVISÃO", () => {
    const caseBase = { ...base, client: "C", problem: "P", solution: "S", impact: "I" };

    it("derruba guia publicado com REVISÃO no corpo", () => {
      writeFileSync(join(dir, "g.mdx"), mdx(base, "Texto REVISÃO pendente."));
      expect(() => listGuides({ dir, includeDrafts: false })).toThrow(/g.*REVISÃO/);
    });

    it("derruba guia publicado com REVISÃO no frontmatter", () => {
      writeFileSync(join(dir, "g.mdx"), mdx({ ...base, answer: "REVISÃO: confirmar" }));
      expect(() => listGuides({ dir, includeDrafts: false })).toThrow(ContentError);
    });

    it("permite rascunho com REVISÃO, também na prévia", () => {
      writeFileSync(join(dir, "r.mdx"), mdx({ ...base, draft: true }, "REVISÃO"));
      expect(listGuides({ dir, includeDrafts: false })).toHaveLength(0);
      expect(listGuides({ dir, includeDrafts: true })).toHaveLength(1);
    });

    it("derruba guia publicado com REVISÃO mesmo na prévia", () => {
      writeFileSync(join(dir, "g.mdx"), mdx(base, "REVISÃO"));
      expect(() => listGuides({ dir, includeDrafts: true })).toThrow(/REVISÃO/);
    });

    it("derruba case autorizado e publicado com REVISÃO", () => {
      writeFileSync(join(dir, "c.mdx"), mdx({ ...caseBase, authorized: true }, "REVISÃO"));
      expect(() => listCases({ dir, includeDrafts: false })).toThrow(/c.*REVISÃO/);
    });

    it("permite case não autorizado ou rascunho com REVISÃO", () => {
      writeFileSync(join(dir, "n.mdx"), mdx({ ...caseBase, authorized: false }, "REVISÃO"));
      writeFileSync(join(dir, "d.mdx"), mdx({ ...caseBase, authorized: true, draft: true }, "REVISÃO"));
      expect(listCases({ dir, includeDrafts: false })).toHaveLength(0);
      expect(listCases({ dir, includeDrafts: true }).map((c) => c.slug)).toEqual(["d"]);
    });
  });
});

describe("conteúdo real do repositório", () => {
  it("todos os guias e cases têm frontmatter válido e nada publicado tem REVISÃO", () => {
    expect(() => listGuides({ includeDrafts: true })).not.toThrow();
    expect(() => listCases({ includeDrafts: true })).not.toThrow();
  });
});
