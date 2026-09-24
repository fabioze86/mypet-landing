import type { Metadata } from "next";
import Link from "next/link";
import { buscarArtigosAjudaPublicados } from "@mypet/core/help-center";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { LANDING_STYLES } from "../../_components/pre-access/styles";

const { name: SITE_NAME, logo } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `Buscar - Central de ajuda - ${SITE_NAME}`,
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/central-de-ajuda/busca") },
  };
}

export default async function BuscaAjudaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const termo = q?.trim() ?? "";
  const resultados = termo ? await buscarArtigosAjudaPublicados(termo) : [];

  return (
    <>
      <style>{LANDING_STYLES}</style>

      <header className="pa-header">
        <div className="pa-wrap pa-header-row">
          <a href="/" className="pa-brand" style={{ textDecoration: "none" }}>
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </a>
        </div>
      </header>

      <main>
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
      </main>

      <footer className="pa-footer">
        <div className="pa-wrap pa-footer-row">
          <div className="pa-footer-brand">
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </div>
          <small>© {SITE_NAME}.</small>
        </div>
      </footer>
    </>
  );
}
