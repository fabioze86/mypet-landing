import type { MetadataRoute } from "next";
import { getActiveCampaigns } from "@mypet/core/offers";
import { clientConfig } from "@/client.config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const campaigns = await getActiveCampaigns(clientConfig.catalogChannel);
  const base = `https://${clientConfig.domain}`;

  return [
    { url: `${base}/ofertas-para-lojistas`, changeFrequency: "hourly", priority: 1 },
    ...campaigns.map((c) => ({
      url: `${base}/ofertas-para-lojistas/${c.slug}`,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
  ];
}
