import type { ProductVariant } from "./catalog-utils";
import type { ClientConfig } from "./theme";

export type PdpProductForSeo = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  img: string;
  productRole: "simple" | "parent" | "variant";
  variants: ProductVariant[];
  sku?: string;
  barcode?: string | null;
  salePrice?: number | null;
  stockQty?: number | null;
};

export function canonicalUrl(domain: string, path: string): string {
  return `https://${domain}${path}`;
}

function absoluteImageUrl(domain: string, img: string): string {
  return img.startsWith("http") ? img : canonicalUrl(domain, img);
}

export function productGroupJsonLd(product: PdpProductForSeo, domain: string) {
  if (product.productRole !== "parent" || product.variants.length === 0) return null;

  const variesBy = [...new Set(product.variants.flatMap((v) => v.axis.map((a) => a.eixo)))];
  const productUrl = `https://${domain}/produtos/${product.id}`;

  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    productGroupID: product.id,
    variesBy,
    url: productUrl,
    image: absoluteImageUrl(domain, product.img),
    hasVariant: product.variants.map((v) => ({
      "@type": "Product",
      name: v.name,
      ...(v.sku ? { sku: v.sku } : {}),
      ...(v.barcode ? { gtin13: v.barcode } : {}),
      image: absoluteImageUrl(domain, v.img),
      url: `${productUrl}?variante=${v.id}`,
    })),
  };
}

export function productJsonLd(
  product: PdpProductForSeo,
  domain: string,
  opts?: { offers?: boolean },
) {
  if (product.productRole === "parent") return null;
  const url = canonicalUrl(domain, `/produtos/${product.id}`);
  const withOffers = opts?.offers && product.salePrice != null;
  const offers = withOffers
    ? {
        offers: {
          "@type": "Offer",
          url,
          priceCurrency: "BRL",
          price: product.salePrice!.toFixed(2),
          availability:
            (product.stockQty ?? 0) > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
        },
      }
    : {};
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku || product.id,
    ...(product.barcode ? { gtin13: product.barcode } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.description ? { description: product.description } : {}),
    image: absoluteImageUrl(domain, product.img),
    url,
    ...offers,
  };
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
  domain: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: canonicalUrl(domain, item.path),
    })),
  };
}

export function organizationJsonLd(config: ClientConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.name,
    url: canonicalUrl(config.domain, ""),
    logo: canonicalUrl(config.domain, "/opengraph-image"),
  };
}

/** Normaliza uma descrição (remove HTML, colapsa espaços) e trunca para meta description. */
export function metaDescription(
  raw: string | null | undefined,
  fallback: string,
  maxLen = 155,
): string {
  const text = (raw ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated;
  return `${base.trim()}…`;
}
