import type { NextConfig } from "next";
import { DADOS_DE_EXEMPLO } from "./lib/empresa";

// Trava de publicação: dados genéricos da empresa e checkout da fase 2 ainda não existem.
if (process.env.VERCEL_ENV === "production" && DADOS_DE_EXEMPLO) {
  throw new Error(
    "Publicação em produção bloqueada: a loja azpetshop ainda usa dados genéricos da empresa (lib/empresa.ts) e o checkout da fase 2 não existe. Troque DADOS_DE_EXEMPLO para false junto com os dados reais antes de publicar.",
  );
}

// O blog Astro (Worker na Cloudflare) continua respondendo em
// www.azpetshop.com.br/blog/... — URLs que já rankeiam no Google. A loja é dona
// do domínio e repassa ao Worker as rotas do blog e os arquivos que ele usa.
const BLOG_ORIGIN = "https://azpetshop.fabio-e90.workers.dev";

const BLOG_PATHS = [
  "/blog",
  "/blog/:path*",
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
    // O parâmetro :path* não carrega a barra final, então a versão com barra vem
    // antes e a repõe no destino; senão o Astro redireciona de volta e entra em loop.
    return BLOG_PATHS.flatMap((path) => [
      { source: `${path}/`, destination: `${BLOG_ORIGIN}${path}/` },
      { source: path, destination: `${BLOG_ORIGIN}${path}` },
    ]);
  },
};

export default nextConfig;
