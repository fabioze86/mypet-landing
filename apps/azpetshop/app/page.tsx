import { HeaderNav } from "@/components/header-nav";
import { Hero } from "@/components/hero";
import { BrandBlock } from "@/components/brand-block";
import { LineSection } from "@/components/line-section";
import { WhereToBuy } from "@/components/where-to-buy";
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
    "Olá! Quero saber mais sobre a linha MAD PET."
  );

  return (
    <div>
      <HeaderNav whatsappLink={genericWhatsappLink} mainSiteUrl={clientConfig.mainSiteUrl} />
      <Hero whatsappLink={genericWhatsappLink} />
      <BrandBlock />
      {PRODUCT_LINES.map((line, i) => (
        <LineSection
          key={line.slug}
          line={line}
          channel={clientConfig.catalogChannel}
          brand={clientConfig.brand}
          whatsappNumber={clientConfig.whatsappNumber}
          background={i % 2 === 0 ? "green" : "purple"}
        />
      ))}
      <WhereToBuy
        whatsappLink={genericWhatsappLink}
        marketplaceUrl={clientConfig.marketplaceUrl}
        distribuidoraUrl={clientConfig.distribuidoraUrl}
      />
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
