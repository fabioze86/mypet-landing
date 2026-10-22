import type { Metadata } from "next";
import { getCategories } from "@mypet/core/catalog";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { getCategoryThumbs } from "./_data/category-thumbs";
import { Hero } from "./_components/pre-access/hero";
import { CommercialFaq } from "./_components/pre-access/commercial-faq";
import { WhyBuy } from "./_components/pre-access/why-buy";
import { CommercialConditions } from "./_components/pre-access/commercial-conditions";
import { HowItWorks } from "./_components/pre-access/how-it-works";
import { CatalogPreview } from "./_components/pre-access/catalog-preview";
import { ClosingCta } from "./_components/pre-access/closing-cta";
import { HubHeaderSlot } from "./_components/hub/hub-header";
import { HubFooter } from "./_components/hub/hub-footer";
import { LANDING_STYLES } from "./_components/pre-access/styles";

const { name: SITE_NAME } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `Tabela de preços para pet shops - ${SITE_NAME}`,
    description:
      "Tabela de preços da My Pet Brasil: os mesmos produtos e preços do mypetbrasil.com numa tela só, com pedido enviado pelo WhatsApp.",
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/") },
  };
}

export default async function LandingPage() {
  const categories = await getCategories();
  const thumbs = await getCategoryThumbs(clientConfig.catalogChannel);
  const topCategories = categories.filter((c) => !c.parentId).slice(0, 12);

  return (
    <>
      <style>{LANDING_STYLES}</style>

      <HubHeaderSlot />

      <main>
        <Hero />
        <WhyBuy />
        <HowItWorks />
        <CommercialFaq />
        <CommercialConditions />
        <CatalogPreview categories={topCategories} thumbs={thumbs} />
        <ClosingCta />
      </main>

      <HubFooter />
    </>
  );
}
