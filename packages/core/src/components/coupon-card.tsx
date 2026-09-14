"use client";

import { useState } from "react";
import { useClientConfig } from "../theme";
import type { OfferCoupon } from "../offers-calc";

export function CouponCard({ coupon }: { coupon: OfferCoupon }) {
  const { palette } = useClientConfig();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível (ex: contexto não seguro) — sem ação além de manter o código visível.
    }
  };

  return (
    <div
      style={{
        border: `1.5px dashed ${palette.pink}`,
        borderRadius: 12,
        padding: "14px 16px",
        background: palette.pinkLight,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>
        <p style={{ fontSize: 12, color: palette.gray600, marginBottom: 2 }}>
          {coupon.description ?? "Cupom desta oferta"}
        </p>
        <p style={{ fontSize: 18, fontWeight: 900, color: palette.pink, letterSpacing: "0.04em" }}>{coupon.code}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        style={{
          background: copied ? palette.green : palette.pink,
          color: palette.white,
          border: "none",
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "Copiado!" : "Copiar cupom"}
      </button>
    </div>
  );
}
