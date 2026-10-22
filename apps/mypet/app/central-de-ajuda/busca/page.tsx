import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { buscarArtigosAjudaPublicados } from "@mypet/core/help-center";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { HubHeaderSlot } from "../../_components/hub/hub-header";
import { HubFooter } from "../../_components/hub/hub-footer";
import { LANDING_STYLES } from "../../_components/pre-access/styles";

const { name: SITE_NAME } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `Buscar - Central de ajuda - ${SITE_NAME}`,
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/central-de-ajuda/busca") },
  };
}

export default function BuscaAjudaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <>
      <style>{LANDING_STYLES}</style>

      <HubHeaderSlot current="duvidas" />

      <main>
        <Suspense fallback={<p className="pa-help-empty">Carregando busca…</p>}>
          <BuscaAjudaPageBody searchParams={searchParams} />
        </Suspense>
      </main>

      <HubFooter />
    </>
  );
}

export async function BuscaAjudaPageBody({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const termo = q?.trim() ?? "";
  const resultados = termo ? await buscarArtigosAjudaPublicados(termo) : [];

  return (
    <section className="pa-section" aria-labelledby="busca-title">
      <div className="pa-wrap" style={{ maxWidth: 820 }}>
        <Link href="/central-de-ajuda" className="pa-cadastro-back">&larr; Central de ajuda</Link>
        <h1 id="busca-title" className="pa-h2" style={{ marginTop: 16 }}>Buscar na central de ajuda</h1>

        <form action="/central-de-ajuda/busca" method="get" className="pa-help-search" style={{ marginTop: 20 }}>
          <input type="search" name="q" defaultValue={termo} placeholder="Ex.: pedido mínimo, Pix, prazo de entrega" />
          <button type="submit">Buscar</button>
        </form>

        {termo && (
          resultados.length === 0 ? (
            <p className="pa-help-empty">Nenhum artigo encontrado para &quot;{termo}&quot;.</p>
          ) : (
            <div className="pa-help-list" style={{ marginTop: 24 }}>
              {resultados.map((artigo) => (
                <Link key={artigo.id} href={`/central-de-ajuda/a/${artigo.slug}`}>
                  <span className="pa-help-list-title">{artigo.titulo}</span>
                  <span className="pa-help-list-sub">{artigo.resumo}</span>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </section>
  );
}
