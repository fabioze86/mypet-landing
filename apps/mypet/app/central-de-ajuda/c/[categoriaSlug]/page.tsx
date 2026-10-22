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
import { HubHeaderSlot } from "../../../_components/hub/hub-header";
import { HubFooter } from "../../../_components/hub/hub-footer";
import { LANDING_STYLES } from "../../../_components/pre-access/styles";
import { renderizarMarkdown } from "../../markdown";

const { name: SITE_NAME } = clientConfig;

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

      <HubHeaderSlot current="duvidas" />

      <main>
        <section className="pa-section" aria-labelledby="categoria-title">
          <div className="pa-wrap" style={{ maxWidth: 820 }}>
            <Link href="/central-de-ajuda" className="pa-cadastro-back">&larr; Central de ajuda</Link>
            <nav className="pa-help-quick" aria-label="Categorias da central de ajuda">
              {linksRapidos.map((c) => (
                <Link
                  key={c.id}
                  href={`/central-de-ajuda/c/${c.slug}`}
                  aria-current={c.id === categoria.id ? "page" : undefined}
                >
                  {c.titulo}
                </Link>
              ))}
              <a href="/central-de-ajuda/busca">Buscar</a>
            </nav>
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

      <HubFooter />
    </>
  );
}
