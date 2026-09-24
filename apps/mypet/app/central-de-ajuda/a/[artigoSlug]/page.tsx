import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtigoAjudaPublicadoBySlug, getArtigosAjudaPublicadosPorCategoria } from "@mypet/core/help-center";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { LANDING_STYLES } from "../../../_components/pre-access/styles";
import { renderizarMarkdown } from "../../markdown";

const { name: SITE_NAME, logo } = clientConfig;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ artigoSlug: string }>;
}): Promise<Metadata> {
  const { artigoSlug } = await params;
  const artigo = await getArtigoAjudaPublicadoBySlug(artigoSlug);
  return {
    title: artigo ? `${artigo.titulo} - Central de ajuda - ${SITE_NAME}` : `Central de ajuda - ${SITE_NAME}`,
    description: artigo?.resumo,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/central-de-ajuda/a/${artigoSlug}`) },
  };
}

export default async function ArtigoAjudaPage({
  params,
}: {
  params: Promise<{ artigoSlug: string }>;
}) {
  const { artigoSlug } = await params;
  const artigo = await getArtigoAjudaPublicadoBySlug(artigoSlug);
  if (!artigo) notFound();

  const relacionados = (await getArtigosAjudaPublicadosPorCategoria(artigo.categoriaId)).filter(
    (a) => a.id !== artigo.id,
  );

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
        <section className="pa-section" aria-labelledby="artigo-title">
          <div className="pa-wrap" style={{ maxWidth: 820 }}>
            <Link href="/central-de-ajuda" className="pa-cadastro-back">&larr; Central de ajuda</Link>
            <article className="pa-help-article" style={{ marginTop: 16 }}>
              <h1 id="artigo-title">{artigo.titulo}</h1>
              <div dangerouslySetInnerHTML={{ __html: renderizarMarkdown(artigo.corpoMarkdown) }} />
            </article>

            {relacionados.length > 0 && (
              <div className="pa-help-related">
                <h4>Veja também</h4>
                {relacionados.map((a) => (
                  <Link key={a.id} href={`/central-de-ajuda/a/${a.slug}`}>{a.titulo}</Link>
                ))}
              </div>
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
