import type { Metadata } from "next";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { AccessForm } from "../_components/pre-access/access-form";
import { LANDING_STYLES } from "../_components/pre-access/styles";

const { name: SITE_NAME, tagline: TAGLINE, logo } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `Criar acesso à loja - ${SITE_NAME}`,
    description:
      "Informe CNPJ e WhatsApp para liberar os preços de atacado da My Pet Brasil, sem cotação por WhatsApp.",
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
              <p className="pa-eyebrow">Acesso à loja</p>
              <h1 id="cadastro-title">Libere os preços de atacado da My Pet Brasil</h1>
              <p>
                Cadastro com CNPJ e WhatsApp. Liberação na hora, sem cotação por WhatsApp.
              </p>
            </div>

            <div className="pa-panel" id="acesso">
              <h2>Criar acesso à loja</h2>
              <p className="pa-panel-sub">CNPJ e WhatsApp. Liberação na hora, sem cotação por WhatsApp.</p>
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
