import Image from "next/image";
import type { CatalogProduct } from "@mypet/core/catalog-utils";
import { buildWhatsAppLink, buildProductInterestMessage } from "@mypet/core/whatsapp";
import { madPetPalette as palette } from "@/client-theme";

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
      style={{
        background: palette.white,
        borderRadius: 20,
        border: `2px solid ${palette.purpleLight}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        width: 240,
        scrollSnapAlign: "start",
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: palette.greenLight }}>
        <Image src={product.img} alt={product.name} fill sizes="240px" style={{ objectFit: "contain" }} />
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
        <h3
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
        </h3>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: "auto",
            textAlign: "center",
            background: palette.green,
            color: palette.white,
            fontWeight: 800,
            fontSize: 14,
            padding: "10px 0",
            borderRadius: 100,
            textDecoration: "none",
          }}
        >
          Quero esse
        </a>
      </div>
    </div>
  );
}
