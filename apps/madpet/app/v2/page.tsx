import type { Metadata } from "next";
import { madPetPalette as palette } from "@/client-theme";
import { AnnouncementBar } from "@/components/v2/announcement-bar";
import { SiteHeader } from "@/components/v2/site-header";
import { CategoryMosaic } from "@/components/v2/category-mosaic";
import { AdvantagesStrip } from "@/components/v2/advantages-strip";
import { CatalogSection } from "@/components/catalog-section";
import { LineSection } from "@/components/line-section";
import { buildWhatsAppLink } from "@mypet/core/whatsapp";
import { clientConfig } from "@/client.config";
import { PRODUCT_LINES } from "@/lib/product-lines";

export const metadata: Metadata = {
  title: "MAD PET | Catálogo de fabricação própria para revenda em pet shop",
  description:
    "Mosaico de linhas, vantagens de revenda, depoimentos de lojistas e pedido pelo WhatsApp. Bandanas, laços, peitorais e coleiras MAD PET de fabricação própria.",
};

export default function HomeV2() {
  const genericWhatsappLink = buildWhatsAppLink(
    clientConfig.whatsappNumber,
    "Olá! Tenho loja e quero a tabela de revenda da linha MAD PET."
  );

  return (
    <div id="topo" style={{ background: palette.white, minHeight: "100vh" }}>
      <AnnouncementBar />
      <SiteHeader whatsappLink={genericWhatsappLink} />
      <CategoryMosaic lines={PRODUCT_LINES} whatsappNumber={clientConfig.whatsappNumber} />
      <AdvantagesStrip />
      <CatalogSection>
        {PRODUCT_LINES.map((line, i) => (
          <LineSection
            key={line.slug}
            line={line}
            channel={clientConfig.catalogChannel}
            brand={clientConfig.brand}
            whatsappNumber={clientConfig.whatsappNumber}
            tone={i % 2 === 0 ? "plain" : "tint"}
          />
        ))}
      </CatalogSection>
    </div>
  );
}
