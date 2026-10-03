import type { Metadata } from "next";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { AccessForm } from "../_components/pre-access/access-form";
import { LANDING_STYLES } from "../_components/pre-access/styles";

const { name: SITE_NAME, tagline: TAGLINE, logo } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `Liberar tabela de preços - ${SITE_NAME}`,
    description:
      "Informe CNPJ e WhatsApp para liberar a tabela de preços da My Pet Brasil, com os mesmos preços do mypetbrasil.com.",
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/cadastro") },
  };
}

export default function CadastroPage() {
  return (
    <>
      <style>{LANDING_STYLES}</style>

      <header className="pa-header">
        <div className="pa-wrap pa-header-row">
          <a href="/" className="pa-brand" style={{ textDecoration: "none" }}>
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </a>
          <a href="/" className="pa-cadastro-back">Voltar para a home</a>
        </div>
      </header>

      <main>
        <section className="pa-cadastro-section" aria-labelledby="cadastro-title">
          <div className="pa-wrap pa-cadastro-wrap">
            <div className="pa-cadastro-intro">
              <p className="pa-eyebrow">Tabela de Preços My Pet Brasil</p>
              <h1 id="cadastro-title">Libere a tabela de preços</h1>
              <p>
                Informe os dados básicos da sua empresa para ver os preços, montar seu pedido e enviá-lo pelo WhatsApp.
              </p>
            </div>

            <div className="pa-panel" id="acesso">
              <h2>Liberar tabela</h2>
              <p className="pa-panel-sub">Faça uma identificação rápida para consultar os preços da My Pet Brasil.</p>
              <AccessForm />
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
            © {SITE_NAME}. Dados de CNPJ e WhatsApp usados apenas para liberar a tabela de preços.
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
