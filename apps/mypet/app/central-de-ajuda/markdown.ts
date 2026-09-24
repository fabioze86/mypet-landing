import { marked } from "marked";

marked.setOptions({ gfm: true });

/**
 * Converte o corpo em Markdown do artigo para HTML. O conteúdo é escrito só
 * pelo admin (Task 7), nunca por visitante — não há sanitização de HTML
 * arbitrário aqui.
 */
export function renderizarMarkdown(corpo: string): string {
  return marked.parse(corpo, { async: false }) as string;
}
