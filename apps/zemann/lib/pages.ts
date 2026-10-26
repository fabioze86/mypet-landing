import { SERVICES } from "./services";

export type PageKey =
  | "home"
  | "marcas"
  | "sellers"
  | "diagnostico"
  | "cases"
  | "guias"
  | "faq"
  | "sobre"
  | "contato";

export type PageInfo = {
  path: string;
  title: string;
  description: string;
  nav?: string;
};

// Fonte única de título/descrição das páginas fixas: usada no metadata,
// na navegação, no sitemap e no llms.txt.
export const PAGES: Record<PageKey, PageInfo> = {
  home: {
    path: "/",
    title: "Zemann — Agência de crescimento para e-commerce",
    description:
      "Agência de crescimento para marcas e e-commerces: Amazon, SEO, tráfego pago, CRO, e-mail, UX, social media e assessoria, com um time que executa junto.",
  },
  marcas: {
    path: "/consultoria-amazon-para-marcas",
    title: "Consultoria de Amazon para marcas e indústrias",
    description:
      "Para marcas e indústrias que querem entrar ou crescer na Amazon: vendor ou seller, catálogo em escala, conteúdo e operação com margem.",
    nav: "Para marcas",
  },
  sellers: {
    path: "/consultoria-amazon-para-sellers",
    title: "Consultoria de Amazon para sellers",
    description:
      "Para sellers que pararam de crescer na Amazon: Buy Box, anúncios com pendência, Amazon Ads e margem real por SKU, com execução junto ao seu time.",
    nav: "Para sellers",
  },
  diagnostico: {
    path: "/diagnostico-conta-amazon",
    title: "Diagnóstico da conta Amazon",
    description:
      "Auditoria da sua conta Amazon: anúncios compráveis, pendências, Buy Box, Ads e margem por SKU, com plano de ação priorizado.",
    nav: "Diagnóstico",
  },
  cases: {
    path: "/cases",
    title: "Cases de Amazon, dados e IA",
    description:
      "Estudos de caso da Zemann: problema, solução e impacto em operações de Amazon, catálogo, dados comerciais e agentes de IA.",
    nav: "Cases",
  },
  guias: {
    path: "/guias",
    title: "Guias para vender na Amazon",
    description:
      "Guias práticos sobre Amazon escritos por quem opera uma marca lá: vendor e seller, Buy Box, FBA, listings, Amazon Ads e catálogo.",
    nav: "Guias",
  },
  faq: {
    path: "/perguntas-frequentes",
    title: "Perguntas frequentes",
    description:
      "Como a Zemann trabalha, serviços, prazos, acesso às contas e o que esperar do módulo Amazon: as dúvidas mais comuns antes de começar.",
  },
  sobre: {
    path: "/sobre",
    title: "Sobre a Zemann e Fábio Zemann",
    description:
      "A Zemann é uma agência de crescimento para marcas e e-commerces, fundada por Fábio Zemann, que opera uma marca própria na Amazon.",
    nav: "Sobre",
  },
  contato: {
    path: "/contato",
    title: "Contato",
    description:
      "Fale com o time da Zemann sobre Amazon, SEO, tráfego pago, CRO, e-mail, UX, social media ou assessoria. Resposta em até 1 dia útil.",
  },
};

export type MenuGroup = { label: string; items: { page: PageInfo; hint: string }[] };

export const MENU_GROUPS: MenuGroup[] = [
  {
    label: "Amazon",
    items: [
      { page: PAGES.marcas, hint: "Entrar e crescer na Amazon como vendor ou seller" },
      { page: PAGES.sellers, hint: "Buy Box, pendências, Ads e margem por SKU" },
      { page: PAGES.diagnostico, hint: "Auditoria da conta com plano de ação" },
    ],
  },
  {
    label: "Serviços",
    items: Object.values(SERVICES).map((service) => ({ page: service, hint: service.summary })),
  },
  {
    label: "Recursos",
    items: [
      { page: PAGES.guias, hint: "Guias práticos sobre Amazon" },
      { page: PAGES.cases, hint: "Problema, solução e impacto" },
      { page: PAGES.faq, hint: "Dúvidas antes de começar" },
    ],
  },
  {
    label: "Empresa",
    items: [
      { page: PAGES.sobre, hint: "A agência e o nosso time" },
      { page: PAGES.contato, hint: "Fale com um especialista" },
    ],
  },
];
