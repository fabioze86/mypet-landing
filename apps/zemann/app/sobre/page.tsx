import Link from "next/link";
import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { personJsonLd } from "@/lib/jsonld";
import { siteConfig } from "@/site.config";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { CtaBlock } from "../_components/cta-block";
import { JsonLd } from "../_components/json-ld";

const page = PAGES.sobre;
export const metadata = pageMetadata(page);

export default function SobrePage() {
  return (
    <main id="conteudo" className="mx-auto max-w-3xl px-4 pt-10">
      <JsonLd data={personJsonLd()} />
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: "Sobre", path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">Sobre a Zemann</h1>
      <p className="mt-6 text-lg leading-relaxed text-ink-soft">
        A Zemann é uma agência de crescimento para marcas e e-commerces, fundada por {siteConfig.founder.name}.
        Nasceu dentro de uma operação real: a My Pet Brasil, marca própria do mercado pet que vende na Amazon como
        vendor e atende lojistas no B2B. A Amazon segue como o nosso carro-chefe, e hoje o nosso time também cuida de
        SEO, tráfego pago, CRO, e-mail marketing, UX, social media e assessoria.
      </p>

      <h2 className="mt-12 text-2xl font-bold text-ink">Nosso time</h2>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Trabalhamos como uma extensão do time do cliente: cada frente tem responsáveis, plano e indicadores
        combinados, e as contas e os dados continuam sendo da sua empresa. Muito do que recomendamos foi testado
        primeiro na nossa própria operação.
      </p>

      <h2 className="mt-12 text-2xl font-bold text-ink">{siteConfig.founder.name}</h2>
      <p className="mt-4 leading-relaxed text-ink-soft">
        {siteConfig.founder.name} opera marca própria na Amazon e no atacado B2B e constrói as ferramentas que
        usa: um hub conectado à API oficial da Amazon para cadastro, conteúdo, pedidos e rentabilidade; uma base
        única de dados de produto que alimenta canais e agentes de IA; e um hub comercial com rastreamento de
        comportamento, BigQuery e automação de e-mail.
      </p>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Essa combinação de operação, dados e produto é o que a Zemann leva para cada cliente: decisões tomadas
        com números e execução com tecnologia, não com planilha manual.
      </p>
      {siteConfig.linkedinUrl ? (
        <p className="mt-4">
          <a href={siteConfig.linkedinUrl} rel="me noopener" target="_blank" className="font-medium text-accent underline">
            Perfil no LinkedIn
          </a>
        </p>
      ) : null}

      <h2 className="mt-12 text-2xl font-bold text-ink">O que fizemos</h2>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Os projetos estão documentados como estudos de caso, com problema, solução e impacto, na página de{" "}
        <Link href={PAGES.cases.path} className="font-medium text-accent underline">cases</Link>.
      </p>

      <CtaBlock
        title="Quer o nosso time na sua operação?"
        text="Conte o seu desafio e indicamos por onde começar."
        href={PAGES.contato.path}
        cta="sobre_contato"
        label="Fale com um especialista"
      />
    </main>
  );
}
