import type { MetadataRoute } from "next";
import { listCases, listGuides } from "@/lib/content";
import { buildSiteIndex } from "@/lib/site-index";
import { siteConfig } from "@/site.config";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSiteIndex(listGuides(), listCases()).map((entry) => ({
    url: `${siteConfig.url}${entry.path}`,
    ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
  }));
}
