import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCategoriasAjuda,
  getCategoriaAjudaBySlug,
  getArtigosAjudaPublicadosPorCategoria,
  getCategoriaIdsComArtigosPublicados,
} from "@mypet/core/help-center";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { LANDING_STYLES } from "../../../_components/pre-access/styles";
import { renderizarMarkdown } from "../../markdown";

const { name: SITE_NAME, logo } = clientConfig;

const LINKS_RAPIDOS = ["primeiros-passos", "cadastro", "catalogo"];

export async function generateStaticParams() {
  const [categorias, ativas] = await Promise.all([getCategoriasAjuda(), getCategoriaIdsComArtigosPublicados()]);
  const params = categorias.filter((c) => ativas.includes(c.id)).map((c) => ({ categoriaSlug: c.slug }));
  // Com cacheComponents, uma lista vazia quebra o build; o placeholder cai no notFound().
  return params.length > 0 ? params : [{ categoriaSlug: "__placeholder__" }];
}

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

export default async function CategoriaAjudaPage({
  params,
}: {
  params: Promise<{ categoriaSlug: string }>;
}) {
  const { categoriaSlug } = await params;
  const categoria = await getCategoriaAjudaBySlug(categoriaSlug);
  if (!categoria) notFound();

  const [artigos, categorias, ativas] = await Promise.all([
    getArtigosAjudaPublicadosPorCategoria(categoria.id),
    getCategoriasAjuda(),
    getCategoriaIdsComArtigosPublicados(),
  ]);
  if (artigos.length === 0) notFound();

  const linksRapidos = LINKS_RAPIDOS.map((slug) => categorias.find((c) => c.slug === slug)).filter(
    (c): c is NonNullable<typeof c> => !!c && ativas.includes(c.id),
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
          <nav className="pa-nav" aria-label="Categorias da central de ajuda">
            {linksRapidos.map((c) => (
              <Link
                key={c.id}
                href={`/central-de-ajuda/c/${c.slug}`}
                aria-current={c.id === categoria.id ? "page" : undefined}
              >
                {c.titulo}
              </Link>
            ))}
            <a href="/central-de-ajuda/busca" className="pa-nav-cta">Buscar</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="pa-section" aria-labelledby="categoria-title">
          <div className="pa-wrap" style={{ maxWidth: 820 }}>
            <Link href="/central-de-ajuda" className="pa-cadastro-back">&larr; Central de ajuda</Link>
            <h1 id="categoria-title" className="pa-h2" style={{ marginTop: 16 }}>{categoria.titulo}</h1>
            <p className="pa-sec-lead">{categoria.descricao}</p>

            <div className="pa-help-faq">
              {artigos.map((artigo) => (
                <details key={artigo.id} id={artigo.slug}>
                  <summary>
                    <span className="pa-help-list-title">{artigo.titulo}</span>
                    <span className="pa-help-list-sub">{artigo.resumo}</span>
                  </summary>
                  <div
                    className="pa-help-article pa-help-faq-body"
                    dangerouslySetInnerHTML={{ __html: renderizarMarkdown(artigo.corpoMarkdown) }}
                  />
                </details>
              ))}
            </div>
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
