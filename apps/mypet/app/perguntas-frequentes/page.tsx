import type { Metadata } from "next";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { commercialFaq } from "../pre-access-content";
import { HubHeaderSlot } from "../_components/hub/hub-header";
import { HubFooter } from "../_components/hub/hub-footer";
import { LANDING_STYLES } from "../_components/pre-access/styles";

const { name: SITE_NAME } = clientConfig;

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

      <HubHeaderSlot current="duvidas" />

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

      <HubFooter />
    </>
  );
}
