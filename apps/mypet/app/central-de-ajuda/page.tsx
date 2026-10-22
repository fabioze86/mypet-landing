import type { Metadata } from "next";
import Link from "next/link";
import { getCategoriasAjuda, getCategoriaIdsComArtigosPublicados } from "@mypet/core/help-center";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { PaIcon } from "../_components/pre-access/icon";
import { HubHeaderSlot } from "../_components/hub/hub-header";
import { HubFooter } from "../_components/hub/hub-footer";
import { LANDING_STYLES } from "../_components/pre-access/styles";

const { name: SITE_NAME } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `Central de ajuda - ${SITE_NAME}`,
    description: "Tudo o que você precisa saber para comprar da My Pet: cadastro, preços, pagamento e entrega.",
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/central-de-ajuda") },
  };
}

export default async function CentralDeAjudaPage() {
  const [categorias, ativas] = await Promise.all([getCategoriasAjuda(), getCategoriaIdsComArtigosPublicados()]);

  return (
    <>
      <style>{LANDING_STYLES}</style>

      <HubHeaderSlot current="duvidas" />

      <main>
        <section className="pa-section" aria-labelledby="central-ajuda-title">
          <div className="pa-wrap" style={{ maxWidth: 960 }}>
            <h1 id="central-ajuda-title" className="pa-h2">Central de ajuda</h1>
            <p className="pa-sec-lead">
              Encontre sua dúvida por categoria: cadastro, preços, pagamento, entrega e muito mais.
            </p>
            <form action="/central-de-ajuda/busca" method="get" className="pa-help-search" style={{ marginTop: 20 }}>
              <input type="search" name="q" aria-label="Buscar uma dúvida" placeholder="Ex.: pedido mínimo, Pix, prazo de entrega" />
              <button type="submit">Buscar</button>
            </form>

            <div className="pa-help-grid">
              {categorias
                .filter((categoria) => ativas.includes(categoria.id))
                .map((categoria) => (
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

      <HubFooter />
    </>
  );
}
