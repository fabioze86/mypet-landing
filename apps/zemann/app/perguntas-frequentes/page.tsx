import { AGENCY_FAQ, AMAZON_FAQ } from "@/lib/faq";
import { faqJsonLd } from "@/lib/jsonld";
import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { CtaBlock } from "../_components/cta-block";
import { FaqList } from "../_components/faq-list";
import { JsonLd } from "../_components/json-ld";

const page = PAGES.faq;
export const metadata = pageMetadata(page);

export default function FaqPage() {
  return (
    <main id="conteudo" className="mx-auto max-w-3xl px-4 pt-10">
      <JsonLd data={faqJsonLd([...AGENCY_FAQ, ...AMAZON_FAQ])} />
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: page.title, path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">{page.title}</h1>
      <p className="mt-4 text-lg text-ink-soft">O que costumam nos perguntar antes de começar.</p>

      <h2 className="mt-12 text-2xl font-bold text-ink">Sobre a agência</h2>
      <FaqList items={AGENCY_FAQ} headingLevel={3} />

      <h2 className="mt-12 text-2xl font-bold text-ink">Amazon</h2>
      <FaqList items={AMAZON_FAQ} headingLevel={3} />

      <CtaBlock
        title="Ficou alguma dúvida?"
        text="Fale com o nosso time ou, se você vende na Amazon, comece pelo diagnóstico da conta."
        href={PAGES.contato.path}
        cta="faq_contato"
        label="Falar com a Zemann"
      />
    </main>
  );
}
