"use client";

import { useClientConfig } from "../theme";
import { AddToCartControl } from "./add-to-cart-control";
import { variantDisplayLabel } from "./variant-selector";
import type { ProductVariant } from "../catalog-utils";

const SCROLL_THRESHOLD = 6;

export function VariantTable({
  variants,
  brand,
}: {
  variants: ProductVariant[];
  brand: string | null;
}) {
  const { palette } = useClientConfig();
  const scrollable = variants.length > SCROLL_THRESHOLD;

  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        border: `1px solid ${palette.gray200}`,
        borderRadius: 16,
        overflow: "hidden",
        marginTop: 16,
        ...(scrollable ? { maxHeight: 420, overflowY: "auto" as const } : {}),
      }}
    >
      {variants.map((variant, index) => (
        <li
          key={variant.id}
          role="group"
          aria-label={variantDisplayLabel(variant, index)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "16px 20px",
            borderTop: index === 0 ? "none" : `1px solid ${palette.gray100}`,
            background: palette.white,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: palette.navy }}>
              {variantDisplayLabel(variant, index)}
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: palette.pink, marginTop: 2 }}>
              {variant.priceLabel ?? "Preço sob consulta"}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <AddToCartControl
              product={{ id: variant.id, name: variant.name, sku: variant.sku, brand, img: variant.img }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
