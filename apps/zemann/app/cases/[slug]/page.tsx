import { notFound } from "next/navigation";
import { getCase, listCases } from "@/lib/content";
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
  return listCases().map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const item = getCase(slug);
  if (!item) return {};
  return pageMetadata({
    path: `/cases/${slug}`,
    title: item.title,
    description: item.description,
    type: "article",
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
  });
}

export default async function CasePage({ params }: Props) {
  const { slug } = await params;
  const item = getCase(slug);
  if (!item) notFound();
  const { default: Body } = await import(`@/content/cases/${slug}.mdx`);
  const path = `/cases/${slug}`;
  const cta = CTA_BY_TARGET[item.cta];
  const summary: [string, string][] = [
    ["Problema", item.problem],
    ["Solução", item.solution],
    ["Impacto", item.impact],
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10">
      <JsonLd
        data={articleJsonLd({
          title: item.title,
          description: item.description,
          path,
          publishedAt: item.publishedAt,
          updatedAt: item.updatedAt,
        })}
      />
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: "Cases", path: "/cases" }, { name: item.title, path }]} />
      <article>
        <p className="mt-6 text-sm font-semibold text-accent">{item.client}</p>
        <ContentHeader meta={item} />
        <dl className="mt-8 grid gap-4 md:grid-cols-3">
          {summary.map(([label, text]) => (
            <div key={label} className="rounded-lg bg-surface p-5">
              <dt className="text-sm font-bold uppercase tracking-wide text-accent">{label}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{text}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8">
          <Body />
        </div>
        {item.faq.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-ink">Perguntas frequentes</h2>
            <FaqList items={item.faq} headingLevel={3} withJsonLd />
          </section>
        ) : null}
      </article>
      <CtaBlock title={cta.title} text={cta.text} href={cta.href} cta={`case_${slug}`} label={cta.label} />
    </main>
  );
}
