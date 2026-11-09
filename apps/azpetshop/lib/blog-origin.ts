// Sem imports de propósito: o next.config.ts também lê este arquivo.

// O blog Astro (Worker na Cloudflare) responde em www.azpetshop.com.br/blog/...
// através dos rewrites do next.config.ts; esta é a origem real dele.
export const BLOG_ORIGIN = "https://azpetshop.fabio-e90.workers.dev";

// Caminho público do blog. Links para ele usam <a>, não <Link>: a rota não existe
// no Next (é um rewrite externo) e precisa de navegação completa.
export const BLOG_HREF = "/blog/";
