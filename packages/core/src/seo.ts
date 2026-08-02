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

export function productJsonLd(product: PdpProductForSeo, domain: string) {
  if (product.productRole === "parent") return null;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.id,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.description ? { description: product.description } : {}),
    image: absoluteImageUrl(domain, product.img),
    url: canonicalUrl(domain, `/produtos/${product.id}`),
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
