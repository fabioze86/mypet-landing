import { clientConfig } from "@/client.config";
import { OFFICIAL_SITE_URL } from "../../pre-access-content";

const { name: SITE_NAME, tagline: TAGLINE, logo } = clientConfig;

// Rodapé único das páginas públicas (home, cadastro, dúvidas).
export function HubFooter() {
  return (
    <footer className="pa-footer">
      <div className="pa-wrap pa-footer-row">
        <div className="pa-footer-brand">
          <span aria-hidden>{logo.emoji}</span>
          <span>{SITE_NAME} - {TAGLINE}</span>
        </div>
        <nav className="pa-footer-links" aria-label="Links do rodapé">
          <a href="/central-de-ajuda">Central de ajuda</a>
          <a href={OFFICIAL_SITE_URL} target="_blank" rel="noopener noreferrer">mypetbrasil.com</a>
        </nav>
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
  );
}
