import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: () => {} }));

const { parseBlogIndex } = await import("./blog");

const post = (n: number, extra: Record<string, unknown> = {}) => ({
  url: `/blog/caes/post-${n}/`,
  title: `Post ${n}`,
  excerpt: `Resumo ${n}`,
  category: "Cães",
  hero: `https://cdn.azpetshop.com.br/posts/${n}.webp`,
  headings: ["x"],
  ...extra,
});

describe("parseBlogIndex", () => {
  it("devolve os primeiros N artigos só com os campos usados", () => {
    const out = parseBlogIndex([post(1), post(2), post(3), post(4)], 3);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({
      url: "/blog/caes/post-1/",
      title: "Post 1",
      excerpt: "Resumo 1",
      category: "Cães",
      hero: "https://cdn.azpetshop.com.br/posts/1.webp",
    });
  });

  it("descarta itens inválidos e URLs fora do blog sem perder a contagem", () => {
    const out = parseBlogIndex([null, { title: "sem url" }, post(1, { url: "https://evil.com/" }), post(2), post(3)], 2);
    expect(out.map((p) => p.title)).toEqual(["Post 2", "Post 3"]);
  });

  it("ignora capa que não seja https", () => {
    expect(parseBlogIndex([post(1, { hero: "javascript:alert(1)" })], 1)[0].hero).toBeNull();
    expect(parseBlogIndex([post(1, { hero: null })], 1)[0].hero).toBeNull();
  });

  it("devolve lista vazia quando o JSON não é um array", () => {
    expect(parseBlogIndex({ erro: true }, 3)).toEqual([]);
    expect(parseBlogIndex(undefined, 3)).toEqual([]);
  });
});
