import type { MetadataRoute } from "next";
import { getSitemapProducts, getCategories } from "@mypet/core/catalog";
import { clientConfig } from "@/client.config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    getSitemapProducts(clientConfig.catalogChannel),
    getCategories(),
  ]);

  const base = `https://${clientConfig.domain}`;

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...categories.map((c) => ({
      url: `${base}/categoria/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${base}/produtos/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
