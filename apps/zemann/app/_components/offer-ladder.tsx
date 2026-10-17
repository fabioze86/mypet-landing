import { formatPriceFrom } from "@/lib/format";
import { PAGES } from "@/lib/pages";
import { siteConfig } from "@/site.config";
import { CtaLink } from "./cta-link";

const STEPS = [
  {
    step: "1",
    title: "Diagnóstico da conta",
    text: "Auditoria de anúncios, Buy Box, Ads e margem por SKU, com um plano de ação priorizado.",
    price: `${formatPriceFrom(siteConfig.diagnostic.priceFrom)} · entrega em ${siteConfig.diagnostic.deliveryText}`,
    href: PAGES.diagnostico.path,
    cta: "Agendar diagnóstico",
  },
  {
    step: "2",
    title: "Implantação",
    text: "Projeto de 30 a 90 dias: estruturamos catálogo, reescrevemos anúncios, montamos campanhas e organizamos os números junto com o seu time.",
    price: "Sob consulta",
    href: PAGES.contato.path,
    cta: "Conversar sobre implantação",
  },
  {
    step: "3",
    title: "Gestão contínua",
    text: "Operação e otimização mensais: anúncios, Ads, pendências, rentabilidade e novos produtos.",
    price: "Sob consulta",
    href: PAGES.contato.path,
    cta: "Conversar sobre gestão",
  },
];

export function OfferLadder() {
  return (
    <ol className="grid gap-6 md:grid-cols-3">
      {STEPS.map((item) => (
        <li key={item.title} className="flex flex-col rounded-lg border border-line p-6">
          <span className="text-sm font-bold text-accent">Etapa {item.step}</span>
          <h3 className="mt-2 text-xl font-semibold text-ink">{item.title}</h3>
          <p className="mt-2 flex-1 leading-relaxed text-ink-soft">{item.text}</p>
          <p className="mt-4 text-sm font-medium text-ink">{item.price}</p>
          <CtaLink href={item.href} cta={`oferta_${item.step}`} variant={item.step === "1" ? "primary" : "secondary"} className="mt-4">
            {item.cta}
          </CtaLink>
        </li>
      ))}
    </ol>
  );
}
