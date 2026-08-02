import type { MetadataRoute } from "next";
import { clientConfig } from "@/client.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/entrar", "/completar-cadastro", "/cotacao", "/pedidos", "/api/"],
    },
    sitemap: `https://${clientConfig.domain}/sitemap.xml`,
  };
}
