"use client";

import { useClientConfig } from "../theme";
import { formatPrice } from "../catalog-utils";

export function OfferPrice({
  listPrice,
  promotionalPrice,
  discountPercentage,
}: {
  listPrice: number;
  promotionalPrice: number;
  discountPercentage: number;
}) {
  const { palette } = useClientConfig();
  const showsDiscount = discountPercentage > 0 && listPrice > promotionalPrice;

  return (
    <div>
      {showsDiscount && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, color: palette.gray400, textDecoration: "line-through" }}>
            {formatPrice(listPrice)}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: palette.white,
              background: palette.pink,
              padding: "2px 8px",
              borderRadius: 6,
            }}
          >
            -{discountPercentage}%
          </span>
        </div>
      )}
      <div style={{ fontSize: 28, fontWeight: 900, color: palette.navy, lineHeight: 1.1 }}>
        {formatPrice(promotionalPrice)}
      </div>
    </div>
  );
}
