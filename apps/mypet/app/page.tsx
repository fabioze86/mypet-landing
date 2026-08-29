import type { Metadata } from "next";
import { getCategories } from "@mypet/core/catalog";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { Hero } from "./_components/pre-access/hero";
import { CommercialConditions } from "./_components/pre-access/commercial-conditions";
import { EducationCards } from "./_components/pre-access/education-cards";
import { PopularCategories } from "./_components/pre-access/popular-categories";
import { CommercialFaq } from "./_components/pre-access/commercial-faq";
import { InstitutionalTrust } from "./_components/pre-access/institutional-trust";
import { AccessForm } from "./_components/pre-access/access-form";

export function generateMetadata(): Metadata {
  return {
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/") },
  };
}

export default async function LandingPage() {
  const categories = await getCategories();
  return (
    <main>
      <Hero />
      <CommercialConditions />
      <EducationCards />
      <PopularCategories categories={categories} />
      <CommercialFaq />
      <InstitutionalTrust />
      <section
        id="acesso"
        aria-labelledby="acesso-title"
        style={{ padding: "48px 24px", maxWidth: 480, margin: "0 auto" }}
      >
        <h2 id="acesso-title">Criar acesso à loja</h2>
        <AccessForm />
      </section>
    </main>
  );
}
