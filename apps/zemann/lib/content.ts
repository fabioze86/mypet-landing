import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

export type FaqItem = { q: string; a: string };
export type CtaTarget = "marcas" | "sellers" | "diagnostico";

export type GuideMeta = {
  slug: string;
  title: string;
  description: string;
  answer: string;
  author: "fabio";
  publishedAt: string;
  updatedAt: string;
  faq: FaqItem[];
  draft: boolean;
  cta: CtaTarget;
};

export type CaseMeta = GuideMeta & {
  client: string;
  problem: string;
  solution: string;
  impact: string;
  authorized: boolean;
};

export class ContentError extends Error {
  constructor(slug: string, field: string, detail: string) {
    super(`[conteúdo] ${slug}: campo "${field}" ${detail}`);
    this.name = "ContentError";
  }
}

// O build roda com cwd = apps/zemann (Vercel com root no app e pnpm --filter).
export const GUIDES_DIR = join(process.cwd(), "content", "guias");
export const CASES_DIR = join(process.cwd(), "content", "cases");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CTA_TARGETS: CtaTarget[] = ["marcas", "sellers", "diagnostico"];

function text(slug: string, data: Record<string, unknown>, field: string): string {
  const value = data[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ContentError(slug, field, "é obrigatório e deve ser texto");
  }
  return value.trim();
}

// gray-matter converte datas YAML sem aspas em Date; normaliza para yyyy-mm-dd.
function isoDate(slug: string, data: Record<string, unknown>, field: string): string {
  const value = data[field];
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (typeof iso !== "string" || !ISO_DATE.test(iso)) {
    throw new ContentError(slug, field, "deve ser uma data yyyy-mm-dd");
  }
  return iso;
}

function faq(slug: string, data: Record<string, unknown>): FaqItem[] {
  const value = data.faq;
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ContentError(slug, "faq", "deve ser uma lista");
  return value.map((item) => {
    const ok =
      typeof item === "object" &&
      item !== null &&
      typeof (item as FaqItem).q === "string" &&
      typeof (item as FaqItem).a === "string" &&
      (item as FaqItem).q.trim() !== "" &&
      (item as FaqItem).a.trim() !== "";
    if (!ok) throw new ContentError(slug, "faq", "precisa de q e a preenchidos em cada item");
    return { q: (item as FaqItem).q.trim(), a: (item as FaqItem).a.trim() };
  });
}

export function parseGuideMeta(slug: string, data: Record<string, unknown>): GuideMeta {
  const title = text(slug, data, "title");
  if (title.length > 55) {
    throw new ContentError(slug, "title", `tem ${title.length} caracteres (máximo 55)`);
  }
  const description = text(slug, data, "description");
  if (description.length > 160) {
    throw new ContentError(slug, "description", `tem ${description.length} caracteres (máximo 160)`);
  }
  if (data.author !== "fabio") throw new ContentError(slug, "author", 'deve ser "fabio"');
  const publishedAt = isoDate(slug, data, "publishedAt");
  const updatedAt = isoDate(slug, data, "updatedAt");
  if (updatedAt < publishedAt) {
    throw new ContentError(slug, "updatedAt", "não pode ser anterior a publishedAt");
  }
  const cta = data.cta ?? "diagnostico";
  if (!CTA_TARGETS.includes(cta as CtaTarget)) {
    throw new ContentError(slug, "cta", `deve ser um de ${CTA_TARGETS.join(", ")}`);
  }
  if (data.draft !== undefined && typeof data.draft !== "boolean") {
    throw new ContentError(slug, "draft", "deve ser true ou false");
  }
  return {
    slug,
    title,
    description,
    answer: text(slug, data, "answer"),
    author: "fabio",
    publishedAt,
    updatedAt,
    faq: faq(slug, data),
    draft: data.draft === true,
    cta: cta as CtaTarget,
  };
}

export function parseCaseMeta(slug: string, data: Record<string, unknown>): CaseMeta {
  if (typeof data.authorized !== "boolean") {
    throw new ContentError(slug, "authorized", "é obrigatório (true ou false)");
  }
  return {
    ...parseGuideMeta(slug, data),
    client: text(slug, data, "client"),
    problem: text(slug, data, "problem"),
    solution: text(slug, data, "solution"),
    impact: text(slug, data, "impact"),
    authorized: data.authorized,
  };
}

export type RawContent = { slug: string; body: string; data: Record<string, unknown>; raw: string };

export function readRawContent(dir: string): RawContent[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mdx"))
    .map((name) => {
      const raw = readFileSync(join(dir, name), "utf8");
      const parsed = matter(raw);
      return { slug: name.replace(/\.mdx$/, ""), body: parsed.content, data: parsed.data, raw };
    });
}

type ListOptions = { dir?: string; includeDrafts?: boolean };

function showDrafts(opts?: ListOptions): boolean {
  // Rascunhos nunca vão ao ar em produção, mesmo com a variável ligada por engano.
  return (
    opts?.includeDrafts ?? (process.env.ZEMANN_SHOW_DRAFTS === "1" && process.env.VERCEL_ENV !== "production")
  );
}

const REVIEW_MARK = "REVISÃO";

// Item publicável (não rascunho) não pode carregar a marca de revisão pendente.
function assertNoReviewMark(file: RawContent, meta: GuideMeta): void {
  if (!meta.draft && file.raw.includes(REVIEW_MARK)) {
    throw new ContentError(file.slug, "conteúdo", `contém a marca ${REVIEW_MARK} e não pode ser publicado`);
  }
}

function byNewest<T extends GuideMeta>(a: T, b: T): number {
  return b.publishedAt.localeCompare(a.publishedAt);
}

export function listGuides(opts?: ListOptions): GuideMeta[] {
  return readRawContent(opts?.dir ?? GUIDES_DIR)
    .map((file) => ({ file, meta: parseGuideMeta(file.slug, file.data) }))
    .filter(({ meta }) => showDrafts(opts) || !meta.draft)
    .map(({ file, meta }) => {
      assertNoReviewMark(file, meta);
      return meta;
    })
    .sort(byNewest);
}

export function listCases(opts?: ListOptions): CaseMeta[] {
  return readRawContent(opts?.dir ?? CASES_DIR)
    .map((file) => ({ file, meta: parseCaseMeta(file.slug, file.data) }))
    .filter(({ meta }) => meta.authorized && (showDrafts(opts) || !meta.draft))
    .map(({ file, meta }) => {
      assertNoReviewMark(file, meta);
      return meta;
    })
    .sort(byNewest);
}

export function getGuide(slug: string, opts?: ListOptions): GuideMeta | null {
  return listGuides(opts).find((guide) => guide.slug === slug) ?? null;
}

export function getCase(slug: string, opts?: ListOptions): CaseMeta | null {
  return listCases(opts).find((item) => item.slug === slug) ?? null;
}
