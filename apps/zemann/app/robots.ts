import type { MetadataRoute } from "next";
import { siteConfig } from "@/site.config";

// Robôs de IA liberados de propósito: o objetivo do site é ser citado em respostas (AEO).
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: AI_BOTS, allow: "/" },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
