import { describe, it, expect, vi } from "vitest";

vi.mock("@mypet/core/catalog", () => ({
  getSitemapProducts: async () => [],
  getCategories: async () => [{ id: "1", slug: "racao", name: "Ração" }],
}));

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("inclui a raiz e nunca a loja protegida", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://mypetbrasil.com.br");
    expect(urls).not.toContain("https://mypetbrasil.com.br/loja");
  });
});
