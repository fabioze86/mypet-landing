import Link from "next/link";
import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { ComparisonTable } from "./_components/comparison-table";
import { CtaLink } from "./_components/cta-link";
import { CtaTrio } from "./_components/cta-trio";
import { HeroIllustration } from "./_components/hero-illustration";
import { OfferLadder } from "./_components/offer-ladder";
import { Pillars } from "./_components/pillars";
import { StatsBand } from "./_components/stats-band";

export const metadata = pageMetadata(PAGES.home);

const AUDIENCES = [
  {
    page: PAGES.marcas,
    cta: "publico_marcas",
    title: "Marcas e indústrias",
    text: "Vai entrar na Amazon ou já está lá e não deslancha? Escolhemos o modelo certo (vendor ou seller), cadastramos o catálogo em escala e organizamos a operação com margem.",
  },
  {
    page: PAGES.sellers,
    cta: "publico_sellers",
    title: "Sellers estabelecidos",
    text: "Vendas pararam de crescer? Atacamos Buy Box, anúncios com pendência, Amazon Ads e a margem real de cada SKU.",
  },
];

export default function HomePage() {
  return (
    <main>
      {/* Hero no estilo Cloudflare: título grande à esquerda, ilustração à direita. */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-16 pb-12 md:pt-24 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Consultoria de Amazon para marcas e sellers</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-ink md:text-6xl">
            Venda mais na Amazon com quem opera uma marca lá todos os dias
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
            A Zemann estrutura o seu catálogo, corrige os seus anúncios e organiza os seus números — e executa junto
            com o seu time, com tecnologia própria conectada à API oficial da Amazon.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink href={PAGES.diagnostico.path} cta="hero_diagnostico">Agendar diagnóstico da conta</CtaLink>
            <CtaLink href={PAGES.cases.path} cta="hero_cases" variant="secondary">Ver cases</CtaLink>
          </div>
        </div>
        <div className="hidden lg:block">
          <HeroIllustration />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Para quem é</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {AUDIENCES.map((item) => (
            <Link key={item.page.path} href={item.page.path} data-cta={item.cta} className="rounded-lg border border-line p-6 transition-colors hover:border-accent">
              <h3 className="text-xl font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{item.text}</p>
              <span className="mt-4 inline-block font-semibold text-accent">Saiba mais →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Por que a Zemann</h2>
        <div className="mt-6">
          <Pillars />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-xl bg-surface p-8 md:p-12">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Prova na prática</p>
          <h2 className="mt-2 text-2xl font-bold text-ink md:text-3xl">Nossa própria marca na Amazon</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-ink-soft">
            A My Pet Brasil, marca própria do mercado pet, vende na Amazon como vendor. Foi nela que criamos e testamos
            o método: catálogo com milhares de produtos cadastrado em escala, conteúdo publicado pela API com prévia
            validada e números acompanhados por SKU.
          </p>
          <CtaLink href="/cases/my-pet-na-amazon" cta="home_case_mypet" variant="secondary" className="mt-6">
            Ler o case da My Pet
          </CtaLink>
        </div>
      </section>

      <StatsBand />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Zemann, agência ou curso?</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">A diferença está em quem executa e em que números você passa a enxergar.</p>
        <div className="mt-6">
          <ComparisonTable />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Como trabalhamos</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">Três etapas. Você pode começar pelo diagnóstico e decidir o resto depois.</p>
        <div className="mt-6">
          <OfferLadder />
        </div>
      </section>

      <CtaTrio />
    </main>
  );
}
