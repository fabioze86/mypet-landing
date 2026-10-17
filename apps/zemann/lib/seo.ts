import type { Metadata } from "next";
import { siteConfig } from "@/site.config";

export function pageMetadata(input: {
  path: string;
  title: string;
  description: string;
  type?: "website" | "article";
  publishedAt?: string;
  updatedAt?: string;
}): Metadata {
  const type = input.type ?? "website";
  return {
    // A home já traz a marca no título; as demais recebem " | Zemann" do template do layout.
    title: input.path === "/" ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      title: input.title,
      description: input.description,
      url: input.path,
      siteName: siteConfig.name,
      locale: "pt_BR",
      type,
      ...(type === "article"
        ? { publishedTime: input.publishedAt, modifiedTime: input.updatedAt }
        : {}),
    },
  };
}
