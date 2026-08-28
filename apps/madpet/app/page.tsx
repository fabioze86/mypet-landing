import { HeaderNav } from "@/components/header-nav";
import { Hero } from "@/components/hero";
import { BrandBlock } from "@/components/brand-block";
import { WhyResell } from "@/components/why-resell";
import { CatalogSection } from "@/components/catalog-section";
import { LineSection } from "@/components/line-section";
import { HowToBuy } from "@/components/how-to-buy";
import { SeoBlock } from "@/components/seo-block";
import { Faq } from "@/components/faq";
import { Footer } from "@/components/footer";
import { WhatsAppFloatButton } from "@/components/whatsapp-float-button";
import { buildWhatsAppLink } from "@mypet/core/whatsapp";
import { clientConfig } from "@/client.config";
import { PRODUCT_LINES } from "@/lib/product-lines";

export default function Home() {
  const genericWhatsappLink = buildWhatsAppLink(
    clientConfig.whatsappNumber,
    "Olá! Tenho loja e quero a tabela de revenda da linha MAD PET."
  );

  return (
    <div>
      <HeaderNav whatsappLink={genericWhatsappLink} />
      <Hero whatsappLink={genericWhatsappLink} />
      <BrandBlock />
      <WhyResell />
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
      <HowToBuy whatsappLink={genericWhatsappLink} />
      <SeoBlock />
      <Faq />
      <Footer
        mainSiteUrl={clientConfig.mainSiteUrl}
        distribuidoraUrl={clientConfig.distribuidoraUrl}
        whatsappLink={genericWhatsappLink}
      />
      <WhatsAppFloatButton link={genericWhatsappLink} />
    </div>
  );
}
