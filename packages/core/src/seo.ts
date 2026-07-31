import type { ProductVariant } from "./catalog-utils";

export type PdpProductForSeo = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  productRole: "simple" | "parent" | "variant";
  variants: ProductVariant[];
};

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
    hasVariant: product.variants.map((v) => ({
      "@type": "Product",
      name: v.name,
      ...(v.sku ? { sku: v.sku } : {}),
      ...(v.barcode ? { gtin13: v.barcode } : {}),
      url: `${productUrl}?variante=${v.id}`,
    })),
  };
}
