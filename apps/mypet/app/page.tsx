import type { Metadata } from "next";
import { getCategories } from "@mypet/core/catalog";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { getCategoryThumbs } from "./_data/category-thumbs";
import { Hero } from "./_components/pre-access/hero";
import { CommercialConditions } from "./_components/pre-access/commercial-conditions";
import { EducationCards } from "./_components/pre-access/education-cards";
import { PopularCategories } from "./_components/pre-access/popular-categories";
import { CommercialFaq } from "./_components/pre-access/commercial-faq";
import { InstitutionalTrust } from "./_components/pre-access/institutional-trust";
import { LANDING_STYLES } from "./_components/pre-access/styles";

const { name: SITE_NAME, tagline: TAGLINE, logo } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `${SITE_NAME} — atacado para pet shops`,
    description:
      "Atacado para pet shops: veja condições de compra, pedido mínimo e categorias antes de acessar a loja.",
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

      <header className="pa-header">
        <div className="pa-wrap pa-header-row">
          <div className="pa-brand">
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </div>
          <nav className="pa-nav" aria-label="Seções da página">
            <a href="#condicoes">Condições</a>
            <a href="#categorias">Categorias</a>
            <a href="#faq">Dúvidas</a>
            <a href="#acesso" className="pa-nav-cta">Criar acesso</a>
          </nav>
        </div>
      </header>

      <main>
        <Hero />
        <CommercialConditions />
        <EducationCards />
        <PopularCategories categories={topCategories} thumbs={thumbs} />
        <CommercialFaq />
        <InstitutionalTrust categoryCount={topCategories.length} />
      </main>

      <footer className="pa-footer">
        <div className="pa-wrap pa-footer-row">
          <div className="pa-footer-brand">
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME} — {TAGLINE}</span>
          </div>
          <small>
            © {SITE_NAME}. Dados de CNPJ e WhatsApp usados apenas para liberação da loja.
            {" "}Desenvolvido por{" "}
            <a
              href="https://www.zemann.com.br"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", textDecoration: "underline" }}
            >
              Zemann.ai
            </a>
          </small>
        </div>
      </footer>
    </>
  );
}
