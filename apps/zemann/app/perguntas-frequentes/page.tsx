import { GENERAL_FAQ } from "@/lib/faq";
import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { CtaBlock } from "../_components/cta-block";
import { FaqList } from "../_components/faq-list";

const page = PAGES.faq;
export const metadata = pageMetadata(page);

export default function FaqPage() {
  return (
    <main id="conteudo" className="mx-auto max-w-3xl px-4 pt-10">
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: page.title, path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">{page.title}</h1>
      <p className="mt-4 text-lg text-ink-soft">O que costumam nos perguntar antes de começar.</p>
      <div className="mt-8">
        <FaqList items={GENERAL_FAQ} headingLevel={2} withJsonLd />
      </div>
      <CtaBlock
        title="Ficou alguma dúvida?"
        text="Fale com a gente ou comece direto pelo diagnóstico da conta."
        href={PAGES.contato.path}
        cta="faq_contato"
        label="Falar com a Zemann"
      />
    </main>
  );
}
