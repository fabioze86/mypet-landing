import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@mypet/core"],
  // Catálogo digital: HTML estático gerado em public/catalogo/index.html
  // (gerador em MarketingOS/tmp/catalogo-digital). Deixa /catalogo abrir direto.
  async rewrites() {
    return [{ source: "/catalogo", destination: "/catalogo/index.html" }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "imagedelivery.net" },
      // picsum: placeholder temporário do hero, remover quando a foto real do CD entrar
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
