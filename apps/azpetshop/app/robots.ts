import type { MetadataRoute } from "next";
import { clientConfig } from "@/client.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cotacao", "/api/"],
    },
    sitemap: [
      `https://${clientConfig.domain}/sitemap.xml`,
      // Sitemap do blog Astro, servido pelo proxy de /blog (ver next.config.ts).
      `https://${clientConfig.domain}/sitemap-index.xml`,
    ],
  };
}
