/**
 * URL enviada ao GA4 como page_location. Nas páginas de pedido a query string
 * carrega o token de acesso (?t=...) e não pode vazar para o Google Analytics.
 * O script inline de google-analytics.tsx replica esta regra em JS puro: mantenha os dois iguais.
 */
export function safePageLocation(href: string): string {
  try {
    const url = new URL(href);
    if (url.pathname.startsWith("/pedido/")) return url.origin + url.pathname;
  } catch {
    // href inválido: devolve como veio
  }
  return href;
}
