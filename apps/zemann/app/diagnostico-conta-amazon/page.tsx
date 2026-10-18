import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { serviceJsonLd } from "@/lib/jsonld";
import { formatPriceFrom } from "@/lib/format";
import { siteConfig } from "@/site.config";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { ContactForm } from "../_components/contact-form";
import { FaqList } from "../_components/faq-list";
import { JsonLd } from "../_components/json-ld";

const page = PAGES.diagnostico;
export const metadata = pageMetadata(page);

const CHECKS = [
  "Saúde dos anúncios: quantos estão disponíveis para compra, quantos estão só visíveis e quais pendências a Amazon aponta, por código.",
  "Conteúdo: títulos, bullets, descrição, imagens e A+ frente às regras da categoria.",
  "Buy Box: em quais produtos você perde o botão de compra e por quê.",
  "Amazon Ads: estrutura das campanhas, gasto, vendas atribuídas e ACOS.",
  "Margem por SKU: lucro no preço atual e no período, com comissão e tarifas da Amazon.",
];

const DELIVERABLES = [
  "Relatório com os números da conta e as causas de cada problema.",
  "Plano de ação priorizado por impacto e esforço.",
  "Reunião de apresentação para tirar dúvidas e decidir os próximos passos.",
];

// Exemplo ilustrativo: estrutura real do relatório, números fictícios.
const SAMPLE: [string, string][] = [
  ["Anúncios no catálogo", "240"],
  ["Disponíveis para compra", "12"],
  ["Só visíveis, sem oferta ativa", "228"],
  ["Com pendência apontada pela Amazon", "160"],
  ["Imagem principal inacessível ou fora do padrão", "52"],
  ["SKUs com margem negativa após tarifas", "9"],
];

const FAQ = [
  {
    q: "Quanto tempo leva o diagnóstico?",
    a: `A entrega acontece em ${siteConfig.diagnostic.deliveryText} a partir do acesso à conta.`,
  },
  {
    q: "Funciona para vendor e para seller?",
    a: "Sim. Para vendor olhamos também pedidos de compra e rentabilidade por pedido; para seller, Buy Box, logística e tarifas por venda.",
  },
  {
    q: "E depois do diagnóstico?",
    a: "Você pode executar o plano com o seu time ou contratar a implantação com a Zemann. Não há obrigação de seguir com a gente.",
  },
];

export default function DiagnosticoPage() {
  const price = formatPriceFrom(siteConfig.diagnostic.priceFrom);
  return (
    <main id="conteudo" className="mx-auto max-w-6xl px-4 pt-10">
      <JsonLd
        data={serviceJsonLd({
          name: page.title,
          description: page.description,
          path: page.path,
          priceFrom: siteConfig.diagnostic.priceFrom,
        })}
      />
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: page.title, path: page.path }]} />

      <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_420px]">
        <div>
          <h1 className="text-4xl font-extrabold leading-tight text-ink md:text-5xl">{page.title}</h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-soft">
            O diagnóstico é uma auditoria completa da sua conta Amazon: mostra o que impede as vendas hoje, quanto
            cada SKU realmente deixa de margem e o que corrigir primeiro. É o jeito de começar com a Zemann sem
            compromisso de longo prazo.
          </p>
          <p className="mt-4 font-semibold text-ink">
            {price} · entrega em {siteConfig.diagnostic.deliveryText}
          </p>

          <h2 className="mt-12 text-2xl font-bold text-ink">O que analisamos</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-ink-soft">
            {CHECKS.map((item) => <li key={item}>{item}</li>)}
          </ul>

          <h2 className="mt-12 text-2xl font-bold text-ink">O que você recebe</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-ink-soft">
            {DELIVERABLES.map((item) => <li key={item}>{item}</li>)}
          </ul>

          <h2 className="mt-12 text-2xl font-bold text-ink">Exemplo de resumo do relatório</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="pb-2 text-left text-sm text-muted">
                Exemplo ilustrativo, com números fictícios, no formato do relatório real.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b-2 border-line px-3 py-2 font-semibold">Indicador</th>
                  <th scope="col" className="border-b-2 border-line px-3 py-2 font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE.map(([label, value]) => (
                  <tr key={label}>
                    <th scope="row" className="border-b border-line px-3 py-2 font-medium text-ink">{label}</th>
                    <td className="border-b border-line px-3 py-2 text-ink-soft">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-12 text-2xl font-bold text-ink">Perguntas frequentes</h2>
          <FaqList items={FAQ} headingLevel={3} withJsonLd />
        </div>

        <aside id="agendar" className="h-fit rounded-xl border border-line p-6 lg:sticky lg:top-24">
          <h2 className="text-xl font-bold text-ink">Agendar diagnóstico</h2>
          <p className="mt-2 text-sm text-ink-soft">Conte um pouco da sua operação. Respondemos em até 1 dia útil.</p>
          <div className="mt-6">
            <ContactForm form="diagnostico" submitLabel="Solicitar diagnóstico" />
          </div>
        </aside>
      </div>
    </main>
  );
}
