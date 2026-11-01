"use client";

import { useClientConfig } from "../theme";
import { installmentLabel, type RetailConfig } from "../retail";
import { buildProductInterestMessage, buildWhatsAppLink } from "../whatsapp";
import { AddToCartControl } from "./add-to-cart-control";
import type { CartItem } from "../cart";

/** Preço + parcelamento + ação do modo varejo: "Comprar" ou consulta no WhatsApp (sem preço / esgotado). */
export function RetailBuyAction({
  retail,
  product,
  salePrice,
  priceLabel,
  inStock,
  size,
}: {
  retail: RetailConfig;
  product: Omit<CartItem, "qty">;
  salePrice: number | null;
  priceLabel: string | null;
  /** `undefined` = estoque não informado; tratado como disponível. */
  inStock?: boolean;
  size: "card" | "pdp";
}) {
  const { palette } = useClientConfig();
  const pdp = size === "pdp";
  const soldOut = inStock === false;
  const hasPrice = salePrice !== null && salePrice > 0;
  const installments = hasPrice && !soldOut ? installmentLabel(salePrice, retail.installments) : null;
  const consultHref = buildWhatsAppLink(retail.consultWhatsApp, buildProductInterestMessage(product.name));

  return (
    <div style={{ marginBottom: pdp ? 4 : 0 }}>
      {hasPrice && (
        <div style={{ fontSize: pdp ? 26 : 18, fontWeight: 900, color: pdp ? palette.pink : palette.navy }}>
          {priceLabel}
        </div>
      )}
      {installments && (
        <div style={{ fontSize: pdp ? 14 : 12, color: palette.gray600, fontWeight: 600, marginTop: 2 }}>
          {installments}
        </div>
      )}
      {soldOut && (
        <div style={{ fontSize: pdp ? 14 : 12, color: palette.gray600, fontWeight: 800, marginTop: 4 }}>
          Esgotado
        </div>
      )}
      {hasPrice && !soldOut ? (
        <div style={{ marginTop: pdp ? 16 : 8 }}>
          <AddToCartControl product={product} compact={!pdp} label="Comprar" />
        </div>
      ) : (
        <a
          href={consultHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: pdp ? 44 : 36,
            marginTop: pdp ? 16 : 8,
            border: `1.5px solid ${palette.green}`,
            borderRadius: 10,
            color: palette.green,
            fontSize: pdp ? 15 : 13,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          {hasPrice ? "Consultar no WhatsApp" : "Consultar preço no WhatsApp"}
        </a>
      )}
    </div>
  );
}
