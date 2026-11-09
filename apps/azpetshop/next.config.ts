import type { NextConfig } from "next";
import { DADOS_DE_EXEMPLO } from "./lib/empresa";
import { BLOG_ORIGIN } from "./lib/blog-origin";

// Trava de publicação: dados genéricos da empresa e checkout da fase 2 ainda não existem.
if (process.env.VERCEL_ENV === "production" && DADOS_DE_EXEMPLO) {
  throw new Error(
    "Publicação em produção bloqueada: a loja azpetshop ainda usa dados genéricos da empresa (lib/empresa.ts) e o checkout da fase 2 não existe. Troque DADOS_DE_EXEMPLO para false junto com os dados reais antes de publicar.",
  );
}

// O blog Astro (Worker na Cloudflare) continua respondendo em
// www.azpetshop.com.br/blog/... — URLs que já rankeiam no Google. A loja é dona
// do domínio e repassa ao Worker as rotas do blog e os arquivos que ele usa.

// Páginas do Astro: sempre com barra final.
const BLOG_PAGE_PATHS = ["/blog", "/blog/:path*"];

// Arquivos (têm extensão): sem barra final, senão o Worker devolve 404.
const BLOG_FILE_REWRITES = [
  { source: "/blog/:file(.+\\.[A-Za-z0-9]+)", destination: `${BLOG_ORIGIN}/blog/:file` },
];
const BLOG_FILE_PATHS = [
  "/_astro/:path*",
  "/img/:path*",
  "/favicon.svg",
  "/sitemap-index.xml",
  "/sitemap-0.xml",
  "/google46455295f224b736.html",
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@mypet/core"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "imagedelivery.net" }],
  },
  // O Astro usa barra final (/blog/caes/) e a loja não; o redirect automático do
  // Next brigaria com o do Astro em loop. A barra da loja é tratada no proxy.ts.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // Ordem importa: arquivos primeiro, repassados como vieram (com barra final o
    // Worker devolve 404). Páginas depois, sempre com a barra no destino, com ou
    // sem ela na URL pedida (senão o Astro redireciona para o workers.dev).
    return [
      ...BLOG_FILE_REWRITES,
      ...BLOG_FILE_PATHS.map((path) => ({ source: path, destination: `${BLOG_ORIGIN}${path}` })),
      ...BLOG_PAGE_PATHS.flatMap((path) => [
        { source: `${path}/`, destination: `${BLOG_ORIGIN}${path}/` },
        { source: path, destination: `${BLOG_ORIGIN}${path}/` },
      ]),
    ];
  },
};

export default nextConfig;
