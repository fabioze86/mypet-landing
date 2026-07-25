import { getCatalog } from "@mypet/core/catalog";
import { ProductCarousel } from "./product-carousel";
import { WaveDivider } from "./wave-divider";
import { madPetPalette as palette } from "@/client-theme";
import type { ProductLine } from "@/lib/product-lines";

export async function LineSection({
  line,
  channel,
  brand,
  whatsappNumber,
  background,
}: {
  line: ProductLine;
  channel: string;
  brand: string;
  whatsappNumber: string;
  background: "green" | "purple";
}) {
  let catalog: Awaited<ReturnType<typeof getCatalog>>;
  try {
    catalog = await getCatalog({ categoryId: line.categoryId, brand, page: 1, channel });
  } catch (error) {
    console.error(`[azpetshop] erro ao buscar catalogo da linha ${line.slug}:`, error);
    catalog = { items: [], total: 0, page: 1, totalPages: 1 };
  }
  const bg = background === "green" ? palette.green : palette.purple;

  return (
    <section id={line.slug} style={{ position: "relative", background: bg, padding: "64px 0 72px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <h2
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: 32,
            fontWeight: 700,
            color: palette.white,
            marginBottom: 10,
          }}
        >
          {line.bannerTitle}
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.88)", marginBottom: 32, maxWidth: 560 }}>
          {line.bannerCopy}
        </p>
        {catalog.items.length === 0 ? (
          <p
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.85)",
              background: "rgba(255,255,255,0.12)",
              padding: "20px 24px",
              borderRadius: 16,
              maxWidth: 420,
            }}
          >
            Essa linha chega em breve por aqui. Fala com a gente no WhatsApp pra saber mais!
          </p>
        ) : (
          <ProductCarousel products={catalog.items} whatsappNumber={whatsappNumber} />
        )}
      </div>
      <WaveDivider color={palette.white} flip />
    </section>
  );
}
