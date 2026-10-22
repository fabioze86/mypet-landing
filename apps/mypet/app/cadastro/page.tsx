import type { Metadata } from "next";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { AccessForm } from "../_components/pre-access/access-form";
import { LANDING_STYLES } from "../_components/pre-access/styles";
import { HubHeaderSlot } from "../_components/hub/hub-header";
import { HubFooter } from "../_components/hub/hub-footer";
import { CadastroUnlocks } from "../_components/hub/cadastro-unlocks";

const { name: SITE_NAME } = clientConfig;

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
      <HubHeaderSlot />

      <main>
        <section className="pa-cadastro-section" aria-labelledby="cadastro-title">
          <div className="pa-wrap pa-cadastro-wrap">
            <div className="pa-cadastro-intro">
              <p className="pa-eyebrow">Tabela de Preços My Pet Brasil</p>
              <h1 id="cadastro-title">Libere a tabela de preços</h1>
              <p>
                Informe os dados básicos da sua empresa para ver os preços, montar seu pedido e enviá-lo pelo WhatsApp.
              </p>
              <CadastroUnlocks />
            </div>

            <div className="pa-panel" id="acesso">
              <h2>Liberar tabela</h2>
              <p className="pa-panel-sub">Faça uma identificação rápida para consultar os preços da My Pet Brasil.</p>
              <AccessForm nextFromUrl />
            </div>
          </div>
        </section>
      </main>

      <HubFooter />
    </>
  );
}
