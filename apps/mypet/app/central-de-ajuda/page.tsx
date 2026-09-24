import type { Metadata } from "next";
import Link from "next/link";
import { getCategoriasAjuda } from "@mypet/core/help-center";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { PaIcon } from "../_components/pre-access/icon";
import { LANDING_STYLES } from "../_components/pre-access/styles";

const { name: SITE_NAME, logo } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `Central de ajuda - ${SITE_NAME}`,
    description: "Tudo o que você precisa saber para comprar da My Pet: cadastro, preços, pagamento e entrega.",
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/central-de-ajuda") },
  };
}

export default async function CentralDeAjudaPage() {
  const categorias = await getCategoriasAjuda();

  return (
    <>
      <style>{LANDING_STYLES}</style>

      <header className="pa-header">
        <div className="pa-wrap pa-header-row">
          <a href="/" className="pa-brand" style={{ textDecoration: "none" }}>
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </a>
          <nav className="pa-nav" aria-label="Seções da página">
            <a href="/central-de-ajuda/busca" className="pa-nav-cta">Buscar</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="pa-section" aria-labelledby="central-ajuda-title">
          <div className="pa-wrap" style={{ maxWidth: 960 }}>
            <h1 id="central-ajuda-title" className="pa-h2">Central de ajuda</h1>
            <p className="pa-sec-lead">
              Encontre sua dúvida por categoria: cadastro, preços, pagamento, entrega e muito mais.
            </p>

            <div className="pa-help-grid">
              {categorias.map((categoria) => (
                <Link key={categoria.id} href={`/central-de-ajuda/c/${categoria.slug}`} className="pa-help-card">
                  <span className="pa-help-icon">
                    <PaIcon name={categoria.icone} size={22} />
                  </span>
                  <h3>{categoria.titulo}</h3>
                  <p>{categoria.descricao}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="pa-footer">
        <div className="pa-wrap pa-footer-row">
          <div className="pa-footer-brand">
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </div>
          <small>
            © {SITE_NAME}. Desenvolvido por{" "}
            <a href="https://www.zemann.com.br" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
              Zemann.ai
            </a>
          </small>
        </div>
      </footer>
    </>
  );
}
