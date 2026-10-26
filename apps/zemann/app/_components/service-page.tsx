import Link from "next/link";
import { serviceJsonLd } from "@/lib/jsonld";
import { contactHref, serviceSummary, type ServiceInfo } from "@/lib/services";
import { Breadcrumbs } from "./breadcrumbs";
import { CtaBlock } from "./cta-block";
import { CtaLink } from "./cta-link";
import { FaqList } from "./faq-list";
import { JsonLd } from "./json-ld";

const SECTION_TITLE = "text-2xl font-bold text-ink md:text-3xl";
const CARD = "rounded-lg border border-line p-6";

// Chave do serviço em snake_case para os rótulos de analytics (trafego-pago → trafego_pago).
function ctaKey(service: ServiceInfo, place: string): string {
  return `servico_${service.key.replace(/-/g, "_")}_${place}`;
}

export function ServicePage({ service }: { service: ServiceInfo }) {
  const href = contactHref(service.key);
  return (
    <main id="conteudo" className="mx-auto max-w-6xl px-4 pt-10">
      <JsonLd
        data={serviceJsonLd({
          name: service.title,
          description: service.description,
          path: service.path,
          serviceType: service.name,
        })}
      />
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: service.name, path: service.path }]} />

      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-accent">Serviços Zemann</p>
      <h1 className="mt-2 max-w-4xl text-4xl font-extrabold leading-tight text-ink md:text-5xl">{service.title}</h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-soft">{service.intro}</p>
      <CtaLink href={href} cta={ctaKey(service, "topo")} className="mt-8">Fale com um especialista</CtaLink>

      <section className="mt-16">
        <h2 className={SECTION_TITLE}>Para quem é</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {service.audiences.map((item) => (
            <div key={item.title} className={CARD}>
              <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className={SECTION_TITLE}>O que inclui</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {service.includes.map((item) => (
            <div key={item.title} className={CARD}>
              <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className={SECTION_TITLE}>Como funciona</h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {service.steps.map((item, index) => (
            <li key={item.title} className={CARD}>
              <span className="text-sm font-bold text-accent">Etapa {index + 1}</span>
              <h3 className="mt-2 text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <h2 className={SECTION_TITLE}>Como se conecta aos outros serviços</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {service.connections.map((connection) => {
            const target = serviceSummary(connection.key);
            return (
              <Link key={target.key} href={target.path} className={`${CARD} transition-colors hover:border-accent`}>
                <h3 className="text-lg font-semibold text-ink">{target.name}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{connection.text}</p>
                <span aria-hidden className="mt-4 inline-block font-semibold text-accent">→</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-16">
        <h2 className={SECTION_TITLE}>Perguntas frequentes</h2>
        <FaqList items={service.faq} headingLevel={3} withJsonLd />
      </section>

      <CtaBlock
        title="Vamos conversar sobre a sua loja?"
        text="Conte o seu cenário e o nosso time responde em até 1 dia útil."
        href={href}
        cta={ctaKey(service, "final")}
        label="Fale com um especialista"
      />
    </main>
  );
}
