import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { serviceJsonLd } from "@/lib/jsonld";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { CtaBlock } from "../_components/cta-block";
import { CtaLink } from "../_components/cta-link";
import { FaqList } from "../_components/faq-list";
import { JsonLd } from "../_components/json-ld";
import { OfferLadder } from "../_components/offer-ladder";
import { Pillars } from "../_components/pillars";

const page = PAGES.sellers;
export const metadata = pageMetadata(page);

const PROBLEMS = [
  ["Buy Box perdida", "Identificamos por que a sua oferta não está no botão de compra — preço total, prazo, estoque ou métricas da conta — e atacamos a causa."],
  ["Anúncios com pendência", "Listamos anúncios suprimidos ou só visíveis, com imagens recusadas ou atributos faltando, e corrigimos em lote pela API."],
  ["Amazon Ads sem retorno", "Reorganizamos campanhas de Sponsored Products e acompanhamos gasto, vendas atribuídas e ACOS todos os dias."],
  ["Margem invisível", "Calculamos o lucro estimado no preço de hoje e o lucro real do período por SKU, já com comissão e tarifas da Amazon."],
  ["Logística", "Avaliamos quando vale usar a logística da Amazon e quando manter o envio próprio, olhando prazo, custo e Buy Box."],
];

const FAQ = [
  {
    q: "Vocês precisam de acesso à minha conta?",
    a: "Para o diagnóstico completo, sim: pedimos um acesso de usuário com as permissões necessárias, que você pode revogar quando quiser.",
  },
  {
    q: "Em quanto tempo aparecem resultados?",
    a: "Correções de pendências e de conteúdo costumam ter efeito em poucas semanas. Ganhos de Buy Box e de Ads dependem do ponto de partida e são acompanhados semana a semana.",
  },
  {
    q: "Atendem sellers de qualquer tamanho?",
    a: "Atendemos sellers que já vendem com regularidade e querem crescer com margem. Para quem ainda está começando, os guias do site são o melhor ponto de partida.",
  },
];

export default function SellersPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-10">
      <JsonLd data={serviceJsonLd({ name: page.title, description: page.description, path: page.path })} />
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: page.title, path: page.path }]} />

      <h1 className="mt-6 max-w-4xl text-4xl font-extrabold leading-tight text-ink md:text-5xl">{page.title}</h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-soft">
        Se as suas vendas na Amazon pararam de crescer, o problema quase sempre está em cinco lugares: Buy Box,
        anúncios com pendência, Ads, margem e logística. A Zemann encontra onde está o seu e corrige junto com você.
      </p>
      <CtaLink href={PAGES.diagnostico.path} cta="sellers_topo_diagnostico" className="mt-8">Agendar diagnóstico</CtaLink>

      <section className="mt-16">
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Onde atuamos</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {PROBLEMS.map(([title, text]) => (
            <div key={title} className="rounded-lg border border-line p-6">
              <h3 className="text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Por que a Zemann</h2>
        <div className="mt-6"><Pillars /></div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Como trabalhamos</h2>
        <div className="mt-6"><OfferLadder /></div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Perguntas frequentes</h2>
        <FaqList items={FAQ} headingLevel={3} withJsonLd />
      </section>

      <CtaBlock
        title="Descubra o que está travando as suas vendas"
        text="O diagnóstico aponta as causas e a ordem certa das correções."
        href={PAGES.diagnostico.path}
        cta="sellers_final_diagnostico"
        label="Agendar diagnóstico"
      />
    </main>
  );
}
