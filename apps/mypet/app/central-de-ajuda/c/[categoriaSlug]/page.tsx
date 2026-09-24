import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoriaAjudaBySlug, getArtigosAjudaPublicadosPorCategoria } from "@mypet/core/help-center";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { LANDING_STYLES } from "../../../_components/pre-access/styles";

const { name: SITE_NAME, logo } = clientConfig;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoriaSlug: string }>;
}): Promise<Metadata> {
  const { categoriaSlug } = await params;
  const categoria = await getCategoriaAjudaBySlug(categoriaSlug);
  return {
    title: categoria ? `${categoria.titulo} - Central de ajuda - ${SITE_NAME}` : `Central de ajuda - ${SITE_NAME}`,
    description: categoria?.descricao,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/central-de-ajuda/c/${categoriaSlug}`) },
  };
}

export default function CategoriaAjudaPage({
  params,
}: {
  params: Promise<{ categoriaSlug: string }>;
}) {
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
        <Suspense fallback={<p className="pa-help-empty">Carregando categoria…</p>}>
          <CategoriaAjudaPageBody params={params} />
        </Suspense>
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

export async function CategoriaAjudaPageBody({
  params,
}: {
  params: Promise<{ categoriaSlug: string }>;
}) {
  const { categoriaSlug } = await params;
  const categoria = await getCategoriaAjudaBySlug(categoriaSlug);
  if (!categoria) notFound();

  const artigos = await getArtigosAjudaPublicadosPorCategoria(categoria.id);

  return (
    <section className="pa-section" aria-labelledby="categoria-title">
      <div className="pa-wrap" style={{ maxWidth: 820 }}>
        <Link href="/central-de-ajuda" className="pa-cadastro-back">&larr; Central de ajuda</Link>
        <h1 id="categoria-title" className="pa-h2" style={{ marginTop: 16 }}>{categoria.titulo}</h1>
        <p className="pa-sec-lead">{categoria.descricao}</p>

        {artigos.length === 0 ? (
          <p className="pa-help-empty">Nenhum artigo publicado nesta categoria ainda.</p>
        ) : (
          <div className="pa-help-list">
            {artigos.map((artigo) => (
              <Link key={artigo.id} href={`/central-de-ajuda/a/${artigo.slug}`}>
                <span className="pa-help-list-title">{artigo.titulo}</span>
                <span className="pa-help-list-sub">{artigo.resumo}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
