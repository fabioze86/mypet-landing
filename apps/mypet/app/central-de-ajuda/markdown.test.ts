import { describe, it, expect } from "vitest";
import { renderizarMarkdown } from "./markdown";

describe("renderizarMarkdown", () => {
  it("converte título, negrito e lista", () => {
    const html = renderizarMarkdown("## Pedido mínimo\n\n**R$ 250,00** na capital.\n\n- item 1\n- item 2");
    expect(html).toContain("<h2>Pedido mínimo</h2>");
    expect(html).toContain("<strong>R$ 250,00</strong>");
    expect(html).toContain("<li>item 1</li>");
  });

  it("converte tabela", () => {
    const html = renderizarMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("converte link", () => {
    const html = renderizarMarkdown("[texto](/central-de-ajuda/a/pedido-minimo)");
    expect(html).toBe('<p><a href="/central-de-ajuda/a/pedido-minimo">texto</a></p>\n');
  });
});
