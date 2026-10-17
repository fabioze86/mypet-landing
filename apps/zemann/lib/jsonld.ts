import { siteConfig } from "@/site.config";

const CONTEXT = "https://schema.org";
const ORG_ID = `${siteConfig.url}/#org`;
const PERSON_ID = `${siteConfig.url}/#fabio`;

function absolute(path: string): string {
  return `${siteConfig.url}${path}`;
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "Organization",
    "@id": ORG_ID,
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    taxID: siteConfig.cnpj,
    url: siteConfig.url,
    email: siteConfig.email,
    description: siteConfig.tagline,
    founder: { "@id": PERSON_ID },
    ...(siteConfig.linkedinUrl ? { sameAs: [siteConfig.linkedinUrl] } : {}),
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: "pt-BR",
    publisher: { "@id": ORG_ID },
  };
}

export function personJsonLd(): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "Person",
    "@id": PERSON_ID,
    name: siteConfig.founder.name,
    jobTitle: siteConfig.founder.jobTitle,
    url: absolute("/sobre"),
    worksFor: { "@id": ORG_ID },
    knowsAbout: ["Amazon Vendor Central", "Amazon Seller Central", "Amazon Ads", "SP-API", "Catálogo de produtos", "Inteligência artificial"],
    ...(siteConfig.linkedinUrl ? { sameAs: [siteConfig.linkedinUrl] } : {}),
  };
}

export function serviceJsonLd(input: {
  name: string;
  description: string;
  path: string;
  priceFrom?: number | null;
}): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "Service",
    name: input.name,
    description: input.description,
    url: absolute(input.path),
    serviceType: "Consultoria de Amazon",
    areaServed: "BR",
    provider: { "@id": ORG_ID, "@type": "Organization", name: siteConfig.name },
    ...(input.priceFrom
      ? {
          offers: {
            "@type": "Offer",
            url: absolute(input.path),
            priceSpecification: {
              "@type": "PriceSpecification",
              minPrice: input.priceFrom,
              priceCurrency: "BRL",
            },
          },
        }
      : {}),
  };
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  path: string;
  publishedAt: string;
  updatedAt: string;
}): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "Article",
    headline: input.title,
    description: input.description,
    datePublished: input.publishedAt,
    dateModified: input.updatedAt,
    inLanguage: "pt-BR",
    mainEntityOfPage: absolute(input.path),
    author: {
      "@type": "Person",
      "@id": PERSON_ID,
      name: siteConfig.founder.name,
      url: absolute("/sobre"),
    },
    publisher: { "@type": "Organization", "@id": ORG_ID, name: siteConfig.name },
  };
}

export function faqJsonLd(items: { q: string; a: string }[]): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  };
}
