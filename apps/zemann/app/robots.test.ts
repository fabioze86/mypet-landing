import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("libera o site para buscadores e robôs de IA e aponta o sitemap", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const agents = rules.flatMap((rule) => (Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent]));
    for (const agent of ["*", "GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
      expect(agents).toContain(agent);
    }
    for (const rule of rules) expect(rule.allow).toBe("/");
    expect(result.sitemap).toBe("https://www.zemann.com.br/sitemap.xml");
  });
});
