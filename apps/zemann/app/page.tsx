import Link from "next/link";
import { listCases } from "@/lib/content";
import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { ComparisonTable } from "./_components/comparison-table";
import { CtaLink } from "./_components/cta-link";
import { CtaTrio } from "./_components/cta-trio";
import { HeroIllustration } from "./_components/hero-illustration";
import { OfferLadder } from "./_components/offer-ladder";
import { ServicesGrid } from "./_components/services-grid";
import { StatsBand } from "./_components/stats-band";

export const metadata = pageMetadata(PAGES.home);

export default function HomePage() {
  const cases = listCases();
  return (
    <main id="conteudo">
      {/* Hero no estilo Cloudflare: título grande à esquerda, ilustração à direita. */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-16 pb-12 md:pt-24 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Agência de crescimento para marcas e e-commerces</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-ink md:text-6xl">
            Mais vendas online, com um time que executa junto com o seu
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
            A Zemann cuida dos canais que fazem uma marca vender na internet: Amazon, busca orgânica, mídia paga,
            conversão, e-mail, experiência de compra e redes sociais. Decisões com números e execução do nosso time.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink href={PAGES.contato.path} cta="hero_contato">Fale com um especialista</CtaLink>
            <CtaLink href="#servicos" cta="hero_servicos" variant="secondary">Ver serviços</CtaLink>
          </div>
        </div>
        <div className="hidden lg:block">
          <HeroIllustration />
        </div>
      </section>

      <section id="servicos" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12">
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Serviços</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">Comece por um canal ou combine vários. A Amazon é o nosso carro-chefe.</p>
        <div className="mt-6">
          <ServicesGrid />
        </div>
      </section>

      {/* Faixa Amazon: números, comparativo e etapas da oferta do módulo carro-chefe. */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">Carro-chefe</p>
        <h2 className="mt-2 text-2xl font-bold text-ink md:text-3xl">Amazon com quem opera uma marca lá todos os dias</h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-ink-soft">
          Estruturamos o catálogo, corrigimos os anúncios e organizamos os números da sua operação na Amazon, com
          tecnologia própria conectada à API oficial da Amazon e testada na nossa própria marca.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <CtaLink href={PAGES.diagnostico.path} cta="amazon_diagnostico">Agendar diagnóstico da conta</CtaLink>
          <CtaLink href={PAGES.marcas.path} cta="amazon_marcas" variant="secondary">Para marcas</CtaLink>
          <CtaLink href={PAGES.sellers.path} cta="amazon_sellers" variant="secondary">Para sellers</CtaLink>
        </div>
      </section>

      <StatsBand />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Na Amazon: Zemann, outras agências ou curso?</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">A diferença está em quem executa e em que números você passa a enxergar.</p>
        <div className="mt-6">
          <ComparisonTable />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Como trabalhamos na Amazon</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">Três etapas. Você pode começar pelo diagnóstico e decidir o resto depois.</p>
        <div className="mt-6">
          <OfferLadder />
        </div>
      </section>

      {cases.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-bold text-ink md:text-3xl">Cases</h2>
          <p className="mt-2 max-w-3xl text-ink-soft">Problema, solução e impacto, com o que foi construído e por quê.</p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {cases.map((item) => (
              <Link key={item.slug} href={`/cases/${item.slug}`} data-cta="home_case" className="rounded-lg border border-line p-6 transition-colors hover:border-accent">
                <p className="text-sm font-semibold text-accent">{item.client}</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-ink-soft">{item.description}</p>
              </Link>
            ))}
          </div>
          <CtaLink href={PAGES.cases.path} cta="home_cases" variant="secondary" className="mt-6">Ver todos os cases</CtaLink>
        </section>
      ) : null}

      <CtaTrio />
    </main>
  );
}
