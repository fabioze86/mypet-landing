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

const page = PAGES.marcas;
export const metadata = pageMetadata(page);

const SERVICES = [
  ["Vendor ou seller", "Avaliamos margem, logística e controle de preço para decidir se a sua marca deve vender para a Amazon (vendor), vender na Amazon (seller) ou combinar os dois."],
  ["Catálogo em escala", "Cadastramos centenas de produtos a partir da sua planilha, aproveitando produtos já aprovados como molde para os atributos de cada categoria."],
  ["Conteúdo que vende", "Título, bullets, descrição e A+ escritos com o guia de voz da sua marca e as regras da categoria, publicados pela API com prévia validada."],
  ["Operação vendor", "Pedidos de compra da Amazon confirmados no prazo e rentabilidade de cada pedido calculada com o seu custo real."],
  ["Registro de marca e pendências", "Organizamos o registro da marca na Amazon e resolvemos anúncios suprimidos, imagens recusadas e atributos faltando."],
];

const FAQ = [
  {
    q: "Minha marca ainda não vende na Amazon. Vocês ajudam a começar?",
    a: "Sim. Começamos decidindo o modelo (vendor ou seller), depois estruturamos o catálogo, o conteúdo e a operação para a entrada já sair organizada.",
  },
  {
    q: "Qual a diferença entre vendor e seller para uma indústria?",
    a: "Como vendor, a indústria vende para a Amazon, que define o preço ao consumidor. Como seller, ela vende direto ao consumidor pela Amazon e controla preço e estoque. O guia Vendor ou seller na Amazon detalha os dois modelos.",
  },
  {
    q: "Vocês substituem o meu time?",
    a: "Não. Trabalhamos junto com o seu time: executamos as frentes mais técnicas e deixamos processos e ferramentas para a operação seguir.",
  },
];

export default function MarcasPage() {
  return (
    <main id="conteudo" className="mx-auto max-w-6xl px-4 pt-10">
      <JsonLd data={serviceJsonLd({ name: page.title, description: page.description, path: page.path })} />
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: page.title, path: page.path }]} />

      <h1 className="mt-6 max-w-4xl text-4xl font-extrabold leading-tight text-ink md:text-5xl">{page.title}</h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-soft">
        A Zemann ajuda marcas e indústrias a entrar e crescer na Amazon com catálogo bem estruturado, conteúdo que
        converte e números claros por SKU. Executamos junto com o seu time, usando tecnologia própria conectada à
        API oficial da Amazon.
      </p>
      <CtaLink href={PAGES.diagnostico.path} cta="marcas_topo_diagnostico" className="mt-8">Agendar diagnóstico</CtaLink>

      <section className="mt-16">
        <h2 className="text-2xl font-bold text-ink md:text-3xl">O que fazemos para marcas</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {SERVICES.map(([title, text]) => (
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
        title="Vamos olhar a sua marca na Amazon?"
        text="O diagnóstico mostra o que trava as vendas hoje e o que fazer primeiro."
        href={PAGES.diagnostico.path}
        cta="marcas_final_diagnostico"
        label="Agendar diagnóstico"
      />
    </main>
  );
}
