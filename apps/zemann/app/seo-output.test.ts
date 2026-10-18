import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sitemap from "./sitemap";
import { GET } from "./llms.txt/route";

const PUBLISHED_CASES = ["my-pet-na-amazon", "catalogo-hub", "hub-comercial", "agente-my-pet"];
const HIDDEN = ["/cases/feiticos", "vendor-ou-seller-na-amazon", "buy-box-na-amazon"];

describe("sitemap e llms.txt com o conteúdo real", () => {
  beforeEach(() => {
    vi.stubEnv("ZEMANN_SHOW_DRAFTS", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sitemap não expõe rascunhos nem case não autorizado e lista os 4 cases", () => {
    const urls = sitemap().map((e) => e.url);
    for (const hidden of HIDDEN) expect(urls.some((u) => u.includes(hidden)), hidden).toBe(false);
    for (const slug of PUBLISHED_CASES) expect(urls.some((u) => u.endsWith(`/cases/${slug}`)), slug).toBe(true);
  });

  it("llms.txt segue a mesma regra", async () => {
    const body = await GET().text();
    for (const hidden of HIDDEN) expect(body, hidden).not.toContain(hidden);
    for (const slug of PUBLISHED_CASES) expect(body, slug).toContain(`/cases/${slug}`);
  });
});
