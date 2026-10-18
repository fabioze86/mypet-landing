import { notFound } from "next/navigation";
import { getGuide, listGuides } from "@/lib/content";
import { articleJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { CTA_BY_TARGET, ContentHeader } from "../../_components/content-header";
import { CtaBlock } from "../../_components/cta-block";
import { FaqList } from "../../_components/faq-list";
import { JsonLd } from "../../_components/json-ld";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return listGuides().map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return pageMetadata({
    path: `/guias/${slug}`,
    title: guide.title,
    description: guide.description,
    type: "article",
    publishedAt: guide.publishedAt,
    updatedAt: guide.updatedAt,
  });
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const { default: Body } = await import(`@/content/guias/${slug}.mdx`);
  const path = `/guias/${slug}`;
  const cta = CTA_BY_TARGET[guide.cta];

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10">
      <JsonLd
        data={articleJsonLd({
          title: guide.title,
          description: guide.description,
          path,
          publishedAt: guide.publishedAt,
          updatedAt: guide.updatedAt,
        })}
      />
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: "Guias", path: "/guias" }, { name: guide.title, path }]} />
      <article>
        <ContentHeader meta={guide} />
        <div className="mt-8">
          <Body />
        </div>
        {guide.faq.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-ink">Perguntas frequentes</h2>
            <FaqList items={guide.faq} headingLevel={3} withJsonLd />
          </section>
        ) : null}
      </article>
      <CtaBlock title={cta.title} text={cta.text} href={cta.href} cta={`guia_${slug}`} label={cta.label} />
    </main>
  );
}
