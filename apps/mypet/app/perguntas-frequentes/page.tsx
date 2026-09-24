import type { Metadata } from "next";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { commercialFaq } from "../pre-access-content";
import { LANDING_STYLES } from "../_components/pre-access/styles";

const { name: SITE_NAME, tagline: TAGLINE, logo } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `Perguntas frequentes - ${SITE_NAME}`,
    description:
      "Dúvidas sobre pedido mínimo, formas de pagamento, prazos de entrega e cadastro na My Pet.",
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/perguntas-frequentes") },
  };
}

export default function FaqPage() {
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
            <a href="/cadastro" className="pa-nav-cta">Consultar preços</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="pa-section" aria-labelledby="faq-page-title">
          <div className="pa-wrap" style={{ maxWidth: 820 }}>
            <a href="/" className="pa-cadastro-back">&larr; Voltar</a>
            <h1 id="faq-page-title" className="pa-h2" style={{ marginTop: 16 }}>
              Perguntas frequentes
            </h1>
            <p className="pa-sec-lead">
              Todas as dúvidas que costumam chegar pelo WhatsApp sobre cadastro, preços, pagamento e entrega, reunidas aqui.
            </p>
            <p className="pa-sec-lead" style={{ marginTop: 8 }}>
              Veja também a <a href="/central-de-ajuda">central de ajuda</a>, organizada por categoria.
            </p>
            <div className="pa-faq-list">
              {commercialFaq.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="pa-footer">
        <div className="pa-wrap pa-footer-row">
          <div className="pa-footer-brand">
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME} - {TAGLINE}</span>
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
