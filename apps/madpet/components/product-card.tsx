import Image from "next/image";
import type { CatalogProduct } from "@mypet/core/catalog-utils";
import { buildWhatsAppLink, buildProductInterestMessage } from "@mypet/core/whatsapp";
import { madPetPalette as palette, theme } from "@/client-theme";

export function ProductCard({
  product,
  whatsappNumber,
}: {
  product: CatalogProduct;
  whatsappNumber: string;
}) {
  const link = buildWhatsAppLink(whatsappNumber, buildProductInterestMessage(product.name));

  return (
    <div
      className="mp-card"
      style={{
        background: palette.white,
        borderRadius: theme.radiusCard,
        border: `1px solid ${palette.purpleLight}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        width: 240,
        scrollSnapAlign: "start",
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: palette.purpleLight }}>
        <Image src={product.img} alt={product.name} fill sizes="240px" style={{ objectFit: "contain" }} />
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
        <h4
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: palette.gray800,
            lineHeight: 1.3,
            marginBottom: 14,
            minHeight: 40,
          }}
        >
          {product.name}
        </h4>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mp-btn mp-btn-green"
          style={{
            marginTop: "auto",
            textAlign: "center",
            background: palette.greenDark,
            color: palette.white,
            fontWeight: 800,
            fontSize: 14,
            padding: "10px 0",
            borderRadius: theme.radiusPill,
            textDecoration: "none",
          }}
        >
          Pedir este item
        </a>
      </div>
    </div>
  );
}
