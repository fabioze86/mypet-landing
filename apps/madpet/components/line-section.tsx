import { getCatalog } from "@mypet/core/catalog";
import { ProductCarousel } from "./product-carousel";
import { madPetPalette as palette, theme } from "@/client-theme";
import type { ProductLine } from "@/lib/product-lines";

export async function LineSection({
  line,
  channel,
  brand,
  whatsappNumber,
  tone,
}: {
  line: ProductLine;
  channel: string;
  brand: string;
  whatsappNumber: string;
  tone: "plain" | "tint";
}) {
  let catalog: Awaited<ReturnType<typeof getCatalog>>;
  try {
    catalog = await getCatalog({ categoryId: line.categoryId, brand, page: 1, channel });
  } catch (error) {
    console.error(`[madpet] erro ao buscar catalogo da linha ${line.slug}:`, error);
    catalog = { items: [], total: 0, page: 1, totalPages: 1 };
  }

  return (
    <div
      id={line.slug}
      style={{
        background: tone === "tint" ? palette.purpleLight : palette.white,
        scrollMarginTop: 80,
      }}
    >
      <div style={{ maxWidth: theme.maxWidth, margin: "0 auto", padding: "40px 24px 44px" }}>
        <h3
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: 24,
            fontWeight: 700,
            color: palette.gray800,
            marginBottom: 6,
          }}
        >
          {line.bannerTitle}
        </h3>
        <p style={{ fontSize: 15, color: palette.gray600, lineHeight: 1.6, maxWidth: "58ch", marginBottom: 24 }}>
          {line.bannerCopy}
        </p>
        {catalog.items.length === 0 ? (
          <p
            style={{
              fontSize: 15,
              color: palette.gray800,
              background: palette.greenLight,
              padding: "18px 22px",
              borderRadius: theme.radiusCard,
              maxWidth: 460,
              lineHeight: 1.6,
            }}
          >
            Essa linha entra no catálogo em breve. Fale no WhatsApp para reservar as primeiras
            peças.
          </p>
        ) : (
          <ProductCarousel products={catalog.items} whatsappNumber={whatsappNumber} />
        )}
      </div>
    </div>
  );
}
