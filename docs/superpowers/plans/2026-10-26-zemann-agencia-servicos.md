# Zemann — agência com módulos de serviço: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar `apps/zemann` de consultoria de Amazon em agência de crescimento com 8 serviços (Amazon como carro-chefe + 7 serviços novos com página própria), sem mudar as URLs atuais.

**Architecture:** Um catálogo puro em `lib/services.ts` é a fonte única dos 7 serviços novos e da lista dos 8 serviços. Menu, rodapé, sitemap, `llms.txt`, JSON-LD, formulário e home leem desse catálogo. Cada rota nova é um `page.tsx` curto que renderiza o componente único `ServicePage`. `services.ts` **não** importa `pages.ts` (é `pages.ts` que importa `services.ts`), para não haver import circular.

**Tech Stack:** Next.js 16.3.8, React 19.2.4, TypeScript, Tailwind CSS 4, Vitest 4 + Testing Library (jsdom).

**Spec:** [docs/superpowers/specs/2026-10-25-zemann-agencia-servicos-design.md](../specs/2026-10-25-zemann-agencia-servicos-design.md) (base: [2026-10-17-zemann-site-amazon-design.md](../specs/2026-10-17-zemann-site-amazon-design.md))

## Global Constraints

- Todos os comandos rodam a partir de `apps/zemann` (`cd apps/zemann`). Testes: `pnpm test` (Vitest). Tipos: `pnpm exec tsc --noEmit`. Build: `pnpm build`.
- Base antes deste plano: 16 arquivos de teste, 82 testes passando.
- Trabalhar direto na `main`, sem worktree.
- Toda copy em português do Brasil, com acentuação correta.
- Títulos de página (sem o sufixo " | Zemann") ≤ 55 caracteres; meta descriptions ≤ 160. O título da home é exceção ao limite de 55 no teste atual, mas o novo tem 47.
- Copy dos serviços novos: textos próprios, sem copiar frases nem estrutura de texto da eTraction. Nenhum resultado, número, cliente ou case inventado. A prova com números continua só no módulo Amazon e nos cases.
- Proibido citar selos que a Zemann não tem ("Google Partner", "Meta Business Partner" e similares), "parceiro oficial" ou qualquer insinuação de vínculo com a Amazon. Usar "conectado à API oficial da Amazon (SP-API)" quando falar da tecnologia.
- "Nosso time" é permitido na copy.
- Rodapé mantém o aviso: "Amazon é marca registrada da Amazon.com, Inc. ou de suas afiliadas. A Zemann não é afiliada à Amazon."
- As URLs atuais (`/consultoria-amazon-para-marcas`, `/consultoria-amazon-para-sellers`, `/diagnostico-conta-amazon`, `/cases`, `/guias`, `/perguntas-frequentes`, `/sobre`, `/contato`) não mudam.
- Rotas novas são estáticas e explícitas, uma pasta por serviço na raiz de `app/`. Nada de rota coringa (`[slug]`) na raiz.
- Cores só pelos tokens de `app/globals.css` (`text-ink`, `text-ink-soft`, `text-muted`, `border-line`, `bg-surface`, `text-accent`, `bg-accent-soft`, `text-accent-dark` etc.). Nenhuma cor hex em componente.
- Rótulos de analytics (`data-cta`) em snake_case.
- Antes de mexer em APIs do Next (`searchParams`, `opengraph-image`), ler o guia em `apps/zemann/node_modules/next/dist/docs/01-app/` (AGENTS.md: "This is NOT the Next.js you know"). `searchParams` de página é uma `Promise` nesta versão (`03-api-reference/03-file-conventions/page.md`).
- Mensagens de commit no padrão do repositório (`feat(zemann): …`), terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Estrutura de arquivos

```
apps/zemann/
  site.config.ts                         (alterado: tagline da agência)
  lib/
    services.ts                          (novo: catálogo dos serviços + helpers)
    services.test.ts                     (novo)
    pages.ts                             (alterado: textos da home/faq/sobre/contato e MENU_GROUPS com 4 grupos)
    jsonld.ts                            (alterado: knowsAbout na organização, serviceType opcional)
    site-index.ts                        (alterado: seção "Serviços" e resumo da agência no llms.txt)
    contact.ts                           (alterado: campo "servico")
    faq.ts                               (alterado: AGENCY_FAQ + AMAZON_FAQ no lugar de GENERAL_FAQ)
  app/
    _components/
      service-page.tsx                   (novo: modelo único da página de serviço)
      service-page.test.tsx              (novo)
      services-grid.tsx                  (novo: grade dos 8 serviços da home)
      site-footer.tsx                    (alterado: 5 colunas)
      contact-form.tsx                   (alterado: select "Serviço de interesse")
      cta-trio.tsx                       (alterado: copy da agência)
      comparison-table.tsx               (alterado: coluna "Outras agências")
    service-routes.test.ts               (novo: cada serviço tem page.tsx e opengraph-image.tsx)
    seo-para-ecommerce/                  (novo: page.tsx + opengraph-image.tsx)
    trafego-pago-para-ecommerce/         (novo)
    cro-otimizacao-de-conversao/         (novo)
    email-marketing-para-ecommerce/      (novo)
    ux-para-ecommerce/                   (novo)
    social-media-para-marcas/            (novo)
    assessoria-de-marketing-digital/     (novo)
    page.tsx, opengraph-image.tsx        (alterados: home da agência)
    contato/page.tsx                     (alterado: lê ?servico=)
    perguntas-frequentes/page.tsx        (alterado: dois blocos)
    sobre/page.tsx, sobre/opengraph-image.tsx (alterados)
  README.md                              (alterado: descrição do app)
```

---

### Task 1: Catálogo de serviços (`lib/services.ts`)

**Files:**
- Create: `apps/zemann/lib/services.ts`
- Test: `apps/zemann/lib/services.test.ts`

**Interfaces:**
- Consumes: `FaqItem` (`{ q: string; a: string }`) de `lib/content.ts` (import só de tipo); `PAGES` de `lib/pages.ts` apenas no teste.
- Produces:
  - `type ServiceKey = "amazon" | "seo" | "trafego-pago" | "cro" | "email-marketing" | "ux" | "social-media" | "assessoria"`
  - `type AgencyServiceKey = Exclude<ServiceKey, "amazon">`
  - `type ServiceCard = { title: string; text: string }`
  - `type ServiceInfo = { key: AgencyServiceKey; name; path; title; description; nav; summary; intro: string; audiences: ServiceCard[]; includes: ServiceCard[]; steps: ServiceCard[]; connections: { key: ServiceKey; text: string }[]; faq: FaqItem[] }` (é compatível com `PageInfo` de `pages.ts`: tem `path`, `title`, `description`, `nav`)
  - `type ServiceSummary = { key: ServiceKey; name: string; path: string; summary: string }`
  - `const SERVICES: Record<AgencyServiceKey, ServiceInfo>`
  - `const AMAZON_SERVICE: ServiceSummary` (aponta para `/consultoria-amazon-para-marcas`)
  - `const SERVICE_LIST: ServiceSummary[]` (os 8, Amazon primeiro)
  - `isServiceKey(value: string): value is ServiceKey`
  - `parseServiceParam(value: string | string[] | undefined): ServiceKey | undefined`
  - `serviceSummary(key: ServiceKey): ServiceSummary`
  - `contactHref(key: ServiceKey): string` → `/contato?servico=<key>`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/zemann/lib/services.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PAGES } from "./pages";
import {
  AMAZON_SERVICE,
  SERVICES,
  SERVICE_LIST,
  contactHref,
  isServiceKey,
  parseServiceParam,
  serviceSummary,
} from "./services";

const services = Object.values(SERVICES);
// Selos que a Zemann não tem, vínculo com plataformas e promessa de resultado.
const BANNED = ["parceiro oficial", "parceira oficial", "partner", "certificad", "garant"];

describe("SERVICES", () => {
  it("tem os 7 serviços da agência, cada um com a chave igual à do registro", () => {
    expect(Object.keys(SERVICES)).toEqual([
      "seo",
      "trafego-pago",
      "cro",
      "email-marketing",
      "ux",
      "social-media",
      "assessoria",
    ]);
    for (const [key, service] of Object.entries(SERVICES)) expect(service.key).toBe(key);
  });

  it("tem caminhos únicos na raiz, sem colisão com as páginas fixas", () => {
    const paths = services.map((service) => service.path);
    const pagePaths = Object.values(PAGES).map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path).toMatch(/^\/[a-z-]+$/);
      expect(pagePaths).not.toContain(path);
    }
  });

  it("respeita os limites de título e descrição", () => {
    for (const service of services) {
      expect(service.title.length, service.key).toBeLessThanOrEqual(55);
      expect(service.description.length, service.key).toBeLessThanOrEqual(160);
    }
  });

  it("título e descrição não citam a Amazon", () => {
    for (const service of services) {
      expect(`${service.title} ${service.description}`.toLowerCase(), service.key).not.toContain("amazon");
    }
  });

  it("copy sem selos, promessas de resultado nem números", () => {
    for (const service of services) {
      const text = JSON.stringify({ ...service, path: "" }).toLowerCase();
      for (const word of BANNED) expect(text, `${service.key}: ${word}`).not.toContain(word);
      expect(/\d/.test(text), `${service.key} tem número na copy`).toBe(false);
    }
  });

  it("segue as quantidades do modelo de página", () => {
    for (const service of services) {
      expect(service.audiences.length, service.key).toBeGreaterThanOrEqual(2);
      expect(service.audiences.length, service.key).toBeLessThanOrEqual(4);
      expect(service.includes.length, service.key).toBeGreaterThanOrEqual(4);
      expect(service.includes.length, service.key).toBeLessThanOrEqual(6);
      expect(service.steps.length, service.key).toBeGreaterThanOrEqual(3);
      expect(service.steps.length, service.key).toBeLessThanOrEqual(4);
      expect(service.connections.length, service.key).toBeGreaterThanOrEqual(2);
      expect(service.connections.length, service.key).toBeLessThanOrEqual(3);
      expect(service.faq.length, service.key).toBeGreaterThanOrEqual(3);
      expect(service.faq.length, service.key).toBeLessThanOrEqual(5);
    }
  });

  it("toda conexão aponta para outro serviço existente", () => {
    for (const service of services) {
      for (const connection of service.connections) {
        expect(isServiceKey(connection.key), `${service.key} → ${connection.key}`).toBe(true);
        expect(connection.key).not.toBe(service.key);
      }
    }
  });

  it("perguntas terminam em interrogação", () => {
    for (const service of services) {
      for (const item of service.faq) expect(item.q.endsWith("?"), item.q).toBe(true);
    }
  });
});

describe("SERVICE_LIST", () => {
  it("tem os 8 serviços, com a Amazon em primeiro apontando para a página de marcas", () => {
    expect(SERVICE_LIST).toHaveLength(8);
    expect(SERVICE_LIST[0]).toBe(AMAZON_SERVICE);
    expect(AMAZON_SERVICE.path).toBe(PAGES.marcas.path);
    expect(new Set(SERVICE_LIST.map((service) => service.key)).size).toBe(8);
  });
});

describe("helpers", () => {
  it("isServiceKey só aceita chaves do catálogo", () => {
    expect(isServiceKey("seo")).toBe(true);
    expect(isServiceKey("amazon")).toBe(true);
    expect(isServiceKey("influencers")).toBe(false);
    expect(isServiceKey("")).toBe(false);
  });

  it("parseServiceParam ignora valor desconhecido, vazio ou repetido", () => {
    expect(parseServiceParam("cro")).toBe("cro");
    expect(parseServiceParam("nada")).toBeUndefined();
    expect(parseServiceParam(["seo", "cro"])).toBeUndefined();
    expect(parseServiceParam(undefined)).toBeUndefined();
  });

  it("serviceSummary e contactHref", () => {
    expect(serviceSummary("amazon").name).toBe("Amazon");
    expect(serviceSummary("trafego-pago").path).toBe("/trafego-pago-para-ecommerce");
    expect(contactHref("trafego-pago")).toBe("/contato?servico=trafego-pago");
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `pnpm test lib/services.test.ts`
Expected: FAIL com "Failed to resolve import './services'".

- [ ] **Step 3: Implementar o catálogo**

Criar `apps/zemann/lib/services.ts` exatamente com este conteúdo (a copy já foi conferida contra os limites e as palavras proibidas):

```ts
import type { FaqItem } from "./content";

export type ServiceKey =
  | "amazon"
  | "seo"
  | "trafego-pago"
  | "cro"
  | "email-marketing"
  | "ux"
  | "social-media"
  | "assessoria";

export type AgencyServiceKey = Exclude<ServiceKey, "amazon">;

export type ServiceCard = { title: string; text: string };

export type ServiceInfo = {
  key: AgencyServiceKey;
  name: string;
  path: string;
  title: string;
  description: string;
  nav: string;
  summary: string;
  intro: string;
  audiences: ServiceCard[];
  includes: ServiceCard[];
  steps: ServiceCard[];
  connections: { key: ServiceKey; text: string }[];
  faq: FaqItem[];
};

export type ServiceSummary = { key: ServiceKey; name: string; path: string; summary: string };

// Catálogo dos serviços da agência (exceto Amazon, que tem páginas próprias).
// Regras de copy: sem números, clientes ou resultados inventados e sem selos
// que a Zemann não tem (ver spec 2026-10-25, seção 9).
export const SERVICES: Record<AgencyServiceKey, ServiceInfo> = {
  seo: {
    key: "seo",
    name: "SEO",
    path: "/seo-para-ecommerce",
    title: "SEO para e-commerce: tráfego orgânico que vende",
    description:
      "SEO para lojas virtuais e marcas: estrutura técnica, páginas de categoria e produto, conteúdo e links internos para atrair visitas que compram.",
    nav: "SEO para e-commerce",
    summary: "Mais visitas orgânicas nas páginas que vendem",
    intro:
      "Busca orgânica é o canal que continua trazendo visitas depois que a campanha acaba. Nosso time cuida da parte técnica da loja, das páginas de categoria e de produto e do conteúdo que responde às dúvidas de quem está perto de comprar.",
    audiences: [
      { title: "Lojas que dependem de mídia paga", text: "Quando quase toda venda vem de anúncio, cada pausa na verba derruba o faturamento. O orgânico reduz essa dependência." },
      { title: "Marcas com catálogo grande", text: "Milhares de páginas de produto e categoria pedem regras claras de título, descrição, filtros e indexação." },
      { title: "Lojas que vão migrar de plataforma", text: "Uma migração sem plano de redirecionamento perde posições que levaram anos para conquistar." },
    ],
    includes: [
      { title: "Auditoria técnica", text: "Rastreamento, indexação, velocidade, dados estruturados, páginas duplicadas e erros que impedem o Google de ler a loja." },
      { title: "Categorias e produtos", text: "Títulos, descrições e textos de categoria escritos para a busca real do cliente, sem repetir a ficha do fabricante." },
      { title: "Pesquisa de palavras-chave", text: "Mapa de termos por intenção de compra, ligado às páginas que devem ranquear para cada um." },
      { title: "Conteúdo que apoia a venda", text: "Guias e comparativos que respondem às dúvidas antes da compra e levam o leitor para o produto." },
      { title: "Links internos e arquitetura", text: "Menu, filtros e links entre páginas organizados para distribuir autoridade e facilitar a navegação." },
    ],
    steps: [
      { title: "Diagnóstico", text: "Levantamos a situação técnica, as páginas que já trazem visitas e as oportunidades de busca do seu nicho." },
      { title: "Plano priorizado", text: "Ordenamos as correções e os conteúdos por impacto esperado e esforço, para começar pelo que destrava mais." },
      { title: "Execução", text: "Nosso time implementa junto com quem cuida da loja, com cada alteração registrada." },
      { title: "Acompanhamento", text: "Relatórios de posições, cliques e receita orgânica, com ajustes no plano conforme os dados." },
    ],
    connections: [
      { key: "cro", text: "Visita orgânica só vira venda se a página converte. CRO e SEO trabalham nas mesmas páginas." },
      { key: "ux", text: "Arquitetura e navegação claras ajudam o Google e o cliente ao mesmo tempo." },
      { key: "amazon", text: "Na Amazon, título, atributos e conteúdo do anúncio também decidem quem aparece na busca." },
    ],
    faq: [
      { q: "Em quanto tempo o SEO traz resultado?", a: "Depende da situação da loja e da concorrência do nicho. Correções técnicas costumam aparecer antes; conteúdo e autoridade levam mais tempo. Mostramos a evolução em relatórios desde o começo." },
      { q: "Vocês escrevem o conteúdo ou só orientam?", a: "Escrevemos. O plano inclui títulos, descrições, textos de categoria e guias, revisados com o seu time antes de publicar." },
      { q: "Funciona em qualquer plataforma de loja?", a: "Sim. Adaptamos o trabalho aos limites de cada plataforma e indicamos o que depende de desenvolvedor." },
    ],
  },
  "trafego-pago": {
    key: "trafego-pago",
    name: "Tráfego pago",
    path: "/trafego-pago-para-ecommerce",
    title: "Tráfego pago para e-commerce: Google e Meta Ads",
    description:
      "Gestão de Google Ads e Meta Ads para e-commerce com foco em margem: estrutura de campanhas, catálogo de produtos, criativos e mensuração confiável.",
    nav: "Tráfego pago",
    summary: "Google Ads e Meta Ads guiados por margem",
    intro:
      "Anúncio que vende muito e não deixa lucro não resolve. Nosso time monta e opera campanhas de Google Ads e Meta Ads olhando a margem de cada produto, com mensuração conferida antes de qualquer decisão de verba.",
    audiences: [
      { title: "Lojas que já investem em mídia", text: "Quando o custo por venda sobe e ninguém sabe dizer por quê, a estrutura e a mensuração das campanhas são o primeiro lugar a olhar." },
      { title: "Marcas que vão começar a anunciar", text: "Começar com conversões medidas do jeito certo evita meses de otimização em cima de dados errados." },
      { title: "Operações com muitos produtos", text: "Catálogos grandes pedem campanhas de shopping e de catálogo bem segmentadas, e não um conjunto único para tudo." },
    ],
    includes: [
      { title: "Mensuração", text: "Conferência das conversões, da integração com a loja e da atribuição antes de mexer em campanhas." },
      { title: "Google Ads", text: "Pesquisa, Shopping e Performance Max com feed de produtos organizado e termos negativos revisados." },
      { title: "Meta Ads", text: "Campanhas de catálogo, públicos e remarketing no Facebook e no Instagram." },
      { title: "Criativos", text: "Direção de criativos e testes de mensagem, com aprendizado registrado para as próximas campanhas." },
      { title: "Verba por margem", text: "Distribuição do investimento pelos produtos e campanhas que deixam lucro, não só faturamento." },
    ],
    steps: [
      { title: "Auditoria das contas", text: "Revisamos estrutura, mensuração, feed e histórico de resultados das contas atuais." },
      { title: "Plano de mídia", text: "Definimos objetivos, divisão de verba e prioridades de teste com o seu time." },
      { title: "Operação", text: "Ajustes contínuos de lances, públicos, termos e criativos." },
      { title: "Relatório", text: "Leitura de custo, receita e margem por campanha, com as próximas decisões propostas." },
    ],
    connections: [
      { key: "cro", text: "Melhorar a conversão da loja baixa o custo de cada venda que vem do anúncio." },
      { key: "email-marketing", text: "Quem chegou pelo anúncio e não comprou pode voltar por e-mail, sem pagar de novo pelo clique." },
      { key: "amazon", text: "Para quem vende na Amazon, o Amazon Ads entra no mesmo plano de verba e margem." },
    ],
    faq: [
      { q: "Qual verba mínima para começar?", a: "Depende do ticket, da margem e do nicho. No diagnóstico indicamos uma verba inicial que permita aprender sem desperdício." },
      { q: "A verba de mídia está incluída na gestão?", a: "Não. A verba é paga direto às plataformas, na conta da sua empresa. A gestão do nosso time é cobrada à parte." },
      { q: "As contas de anúncio ficam com quem?", a: "Com a sua empresa. Trabalhamos com acesso concedido por você, que pode ser revogado a qualquer momento." },
    ],
  },
  cro: {
    key: "cro",
    name: "CRO",
    path: "/cro-otimizacao-de-conversao",
    title: "CRO: otimização de conversão para e-commerce",
    description:
      "CRO para lojas virtuais: análise de funil, pesquisa com clientes e testes nas páginas de produto, carrinho e checkout para vender mais com o mesmo tráfego.",
    nav: "CRO",
    summary: "Mais vendas com o tráfego que você já tem",
    intro:
      "Antes de pagar por mais visitas, vale descobrir por que as visitas atuais não compram. Nosso time analisa o funil da loja, conversa com os dados e com os clientes e testa mudanças onde a perda é maior.",
    audiences: [
      { title: "Lojas com tráfego e poucas vendas", text: "Muita gente entra, pouca gente compra. O problema costuma estar em pontos específicos do funil." },
      { title: "Operações com mídia cara", text: "Cada ganho de conversão reduz o custo de todas as campanhas ao mesmo tempo." },
      { title: "Marcas que lançaram loja nova", text: "Uma loja recém-lançada ainda não foi validada com comprador de verdade." },
    ],
    includes: [
      { title: "Análise de funil", text: "Onde os visitantes abandonam: listagem, produto, carrinho, frete ou pagamento." },
      { title: "Pesquisa com clientes", text: "Gravações de sessão, mapas de calor e perguntas curtas para entender o que trava a compra." },
      { title: "Hipóteses priorizadas", text: "Lista de mudanças ordenada por impacto esperado, confiança e esforço." },
      { title: "Testes", text: "Testes A/B quando o volume permite; quando não permite, mudanças acompanhadas com antes e depois." },
      { title: "Página de produto e checkout", text: "Informação de frete, prazo, troca e pagamento no lugar certo, sem distração no caminho da compra." },
    ],
    steps: [
      { title: "Medição", text: "Conferimos se os eventos do funil estão medidos corretamente." },
      { title: "Diagnóstico", text: "Cruzamos dados quantitativos e pesquisa para achar onde a loja perde mais vendas." },
      { title: "Testes", text: "Implementamos e acompanhamos as mudanças em ciclos." },
      { title: "Aprendizado", text: "Cada resultado vira regra para as próximas páginas e campanhas." },
    ],
    connections: [
      { key: "ux", text: "UX resolve problemas estruturais de navegação; CRO mede e testa o efeito nas vendas." },
      { key: "trafego-pago", text: "Com a loja convertendo melhor, cada real investido em anúncio rende mais." },
      { key: "seo", text: "As páginas que recebem visitas orgânicas são as primeiras candidatas a teste." },
    ],
    faq: [
      { q: "Preciso de muito tráfego para fazer CRO?", a: "Para testes A/B com segurança estatística, sim. Com menos volume, trabalhamos com pesquisa, boas práticas e acompanhamento de antes e depois." },
      { q: "Vocês mexem no código da loja?", a: "Fazemos o que a plataforma permite pelo painel e por ferramentas de teste. Mudanças maiores são especificadas para o seu desenvolvedor." },
      { q: "Qual a diferença entre CRO e UX?", a: "UX olha a experiência inteira de quem compra. CRO foca em medir e aumentar a taxa de conversão. Os dois andam juntos." },
    ],
  },
  "email-marketing": {
    key: "email-marketing",
    name: "E-mail marketing",
    path: "/email-marketing-para-ecommerce",
    title: "E-mail marketing para e-commerce",
    description:
      "E-mail marketing para lojas virtuais: fluxos de carrinho, boas-vindas e recompra, campanhas segmentadas e base saudável para chegar à caixa de entrada.",
    nav: "E-mail marketing",
    summary: "Fluxos automáticos e campanhas que trazem o cliente de volta",
    intro:
      "A base de clientes é um canal que a loja já pagou para construir. Nosso time monta os fluxos automáticos, planeja as campanhas e cuida da reputação de envio para que os e-mails cheguem e sejam abertos.",
    audiences: [
      { title: "Lojas que só mandam promoção", text: "Disparo igual para todo mundo cansa a base e piora a entrega. Segmentação e fluxos mudam isso." },
      { title: "Marcas com recompra natural", text: "Produtos de consumo recorrente pedem lembretes no momento certo." },
      { title: "Operações sem automação", text: "Carrinho abandonado e boas-vindas são fluxos básicos que muitas lojas ainda não têm." },
    ],
    includes: [
      { title: "Fluxos automáticos", text: "Boas-vindas, carrinho e navegação abandonados, pós-compra, recompra e reativação." },
      { title: "Campanhas", text: "Calendário de envios com segmentos por comportamento de compra." },
      { title: "Entregabilidade", text: "Configuração de domínio, limpeza de base e acompanhamento de reputação." },
      { title: "Textos e layout", text: "E-mails escritos para a sua marca, legíveis no celular." },
      { title: "Captação", text: "Formulários e ofertas de cadastro que aumentam a base sem atrair só caçador de cupom." },
    ],
    steps: [
      { title: "Diagnóstico da base", text: "Olhamos a ferramenta, os fluxos existentes, a reputação de envio e a segmentação." },
      { title: "Fluxos essenciais", text: "Colocamos no ar primeiro os fluxos que recuperam venda perdida." },
      { title: "Calendário", text: "Planejamos as campanhas do mês com o seu time." },
      { title: "Otimização", text: "Testes de assunto, conteúdo e horário, com leitura da receita por e-mail." },
    ],
    connections: [
      { key: "trafego-pago", text: "E-mail traz de volta o visitante que veio do anúncio sem pagar outro clique." },
      { key: "cro", text: "A página de destino do e-mail também precisa converter." },
    ],
    faq: [
      { q: "Vocês trabalham com qual ferramenta de e-mail?", a: "Com a que a sua loja já usa, quando ela atende. Se não atender, recomendamos uma opção que se integre à sua plataforma." },
      { q: "Posso mandar e-mail para quem comprou e não se cadastrou na newsletter?", a: "Mensagens sobre o pedido, sim. Para e-mails de marketing, seguimos a LGPD e só enviamos para quem consentiu." },
      { q: "E-mail marketing ainda funciona?", a: "Funciona quando é segmentado e chega na caixa de entrada. Disparo genérico para a base inteira é o que deixou de funcionar." },
    ],
  },
  ux: {
    key: "ux",
    name: "UX",
    path: "/ux-para-ecommerce",
    title: "UX para e-commerce: loja fácil de comprar",
    description:
      "UX para lojas virtuais: navegação, busca, filtros, página de produto e checkout pensados para quem compra pelo celular, com pesquisa e protótipos.",
    nav: "UX para e-commerce",
    summary: "Navegação, busca e checkout sem atrito",
    intro:
      "Quem não encontra o produto não compra. Nosso time redesenha a navegação, a busca e o caminho até o pagamento a partir de pesquisa com clientes, com prioridade para o celular.",
    audiences: [
      { title: "Lojas com catálogo difícil de navegar", text: "Menus longos, filtros confusos e busca que não acha nada afastam o cliente." },
      { title: "Marcas que vão redesenhar a loja", text: "Um redesenho guiado por pesquisa evita trocar um problema por outro." },
      { title: "Lojas com venda fraca no celular", text: "Quando o celular traz a maior parte das visitas e a menor parte das vendas, a experiência móvel é o gargalo." },
    ],
    includes: [
      { title: "Pesquisa com usuários", text: "Testes de usabilidade e entrevistas curtas com clientes reais." },
      { title: "Arquitetura de informação", text: "Organização de categorias, menu e filtros a partir de como o cliente procura." },
      { title: "Busca interna", text: "Sinônimos, correção de termos e resultados relevantes." },
      { title: "Protótipos", text: "Telas de produto, carrinho e checkout prototipadas e validadas antes de desenvolver." },
      { title: "Acessibilidade", text: "Contraste, tamanho de toque e navegação por teclado para atender todos os clientes." },
    ],
    steps: [
      { title: "Pesquisa", text: "Entendemos como o seu cliente procura e decide." },
      { title: "Mapa de problemas", text: "Listamos os atritos encontrados, do mais grave ao mais leve." },
      { title: "Protótipos", text: "Desenhamos e testamos as soluções com usuários." },
      { title: "Entrega para o desenvolvimento", text: "Especificamos as telas e acompanhamos a implementação." },
    ],
    connections: [
      { key: "cro", text: "Depois do redesenho, o CRO mede e ajusta o efeito em vendas." },
      { key: "seo", text: "Categorias bem organizadas também ajudam a loja a ser encontrada na busca." },
    ],
    faq: [
      { q: "Vocês desenvolvem a loja?", a: "Não. Entregamos pesquisa, protótipos e especificação para o seu time ou a sua agência de desenvolvimento, e acompanhamos a implementação." },
      { q: "Preciso trocar de plataforma?", a: "Raramente. A maioria dos problemas de experiência se resolve dentro da plataforma atual." },
      { q: "Quanto tempo leva um projeto de UX?", a: "Depende do escopo. Uma frente específica, como checkout, é bem mais curta que um redesenho da loja inteira. Definimos o prazo no diagnóstico." },
    ],
  },
  "social-media": {
    key: "social-media",
    name: "Social media",
    path: "/social-media-para-marcas",
    title: "Social media para marcas que vendem online",
    description:
      "Social media para marcas e e-commerces: estratégia, calendário, conteúdo e atendimento no Instagram e em outras redes, ligados ao que a loja precisa vender.",
    nav: "Social media",
    summary: "Conteúdo e calendário ligados às vendas",
    intro:
      "Rede social de marca que vende online precisa conversar com o catálogo, os lançamentos e as campanhas. Nosso time planeja e produz o conteúdo junto com o calendário comercial da loja.",
    audiences: [
      { title: "Marcas que postam sem plano", text: "Post solto não constrói marca nem ajuda a vender. Um calendário ligado às campanhas resolve." },
      { title: "Lojas que lançam produto com frequência", text: "Cada lançamento precisa de conteúdo antes, durante e depois." },
      { title: "Marcas que querem conteúdo para anúncios", text: "Conteúdo orgânico bem feito vira matéria-prima para os criativos de mídia paga." },
    ],
    includes: [
      { title: "Estratégia e linha editorial", text: "Temas, formatos e tom de voz definidos a partir da marca e do público." },
      { title: "Calendário", text: "Planejamento mensal alinhado a lançamentos, datas comerciais e campanhas." },
      { title: "Produção de conteúdo", text: "Textos, roteiros de vídeo curto e direção das peças." },
      { title: "Comunidade", text: "Respostas a comentários e mensagens dentro de um fluxo combinado com o seu atendimento." },
      { title: "Relatório", text: "Alcance, engajamento e cliques para a loja, com os ajustes do mês seguinte." },
    ],
    steps: [
      { title: "Imersão", text: "Conhecemos a marca, o público, os produtos e o histórico das redes." },
      { title: "Linha editorial", text: "Definimos o que publicar, com que frequência e em que tom." },
      { title: "Produção mensal", text: "Calendário aprovado com você antes de cada mês começar." },
      { title: "Análise", text: "Leitura dos resultados e ajuste do plano." },
    ],
    connections: [
      { key: "trafego-pago", text: "Os conteúdos que vão bem no orgânico ganham verba e viram anúncio." },
      { key: "email-marketing", text: "Lançamentos e campanhas saem coordenados nas redes e no e-mail." },
    ],
    faq: [
      { q: "Vocês fazem fotos e vídeos?", a: "Fazemos roteiro e direção. A produção de imagem pode ser feita pelo seu time ou por fornecedores de produção indicados no plano." },
      { q: "Quais redes vocês atendem?", a: "Instagram, Facebook, TikTok, LinkedIn e Pinterest, escolhidas conforme o público da marca." },
      { q: "Social media vende?", a: "Ajuda a vender quando está ligada ao catálogo, às campanhas e à mídia paga. Sozinha, constrói marca e relacionamento." },
    ],
  },
  assessoria: {
    key: "assessoria",
    name: "Assessoria",
    path: "/assessoria-de-marketing-digital",
    title: "Assessoria de marketing digital para e-commerce",
    description:
      "Assessoria de marketing digital para marcas e e-commerces: plano de canais, prioridades, indicadores e acompanhamento do seu time interno.",
    nav: "Assessoria de marketing",
    summary: "Plano, prioridades e acompanhamento do seu time",
    intro:
      "Nem toda empresa precisa terceirizar a execução. Na assessoria, nosso time ajuda a decidir em que canais investir, monta o plano e acompanha o seu time interno até os resultados aparecerem.",
    audiences: [
      { title: "Empresas com time interno", text: "Quem já tem pessoas executando e precisa de direção, prioridade e cobrança de indicadores." },
      { title: "Marcas que vão estruturar o digital", text: "Antes de contratar ferramentas e fornecedores, vale ter um plano." },
      { title: "Gestores que querem um olhar externo", text: "Uma segunda opinião sobre canais, verbas e fornecedores atuais." },
    ],
    includes: [
      { title: "Diagnóstico de canais", text: "Situação de loja, mídia, SEO, e-mail, redes e marketplaces." },
      { title: "Plano de marketing", text: "Objetivos, canais, verba e cronograma priorizados por impacto." },
      { title: "Indicadores", text: "Painel com os números que importam para a diretoria e para o time." },
      { title: "Reuniões de acompanhamento", text: "Encontros periódicos para revisar resultados e decidir os próximos passos." },
      { title: "Apoio na contratação", text: "Ajuda para escolher ferramentas, fornecedores e perfis para o time." },
    ],
    steps: [
      { title: "Diagnóstico", text: "Entendemos o negócio, os números e os canais atuais." },
      { title: "Plano", text: "Apresentamos o plano priorizado e combinamos responsáveis." },
      { title: "Acompanhamento", text: "Reuniões periódicas, revisão de indicadores e correção de rota." },
    ],
    connections: [
      { key: "amazon", text: "Quando a Amazon entra no plano, o módulo Amazon executa a operação." },
      { key: "trafego-pago", text: "Se o time interno não der conta da mídia, a operação pode passar para o nosso time." },
      { key: "seo", text: "O plano define se o orgânico é prioridade e em que páginas começar." },
    ],
    faq: [
      { q: "Qual a diferença entre assessoria e gestão completa?", a: "Na assessoria, o seu time executa e nós orientamos e acompanhamos. Na gestão, o nosso time executa os canais contratados." },
      { q: "Com que frequência são as reuniões?", a: "A frequência é combinada no início, conforme o ritmo do seu time e o momento da empresa." },
      { q: "Posso começar pela assessoria e depois contratar execução?", a: "Sim. Muitas empresas começam pelo plano e depois passam canais específicos para o nosso time." },
    ],
  },
};

export const AMAZON_SERVICE: ServiceSummary = {
  key: "amazon",
  name: "Amazon",
  path: "/consultoria-amazon-para-marcas",
  summary: "Catálogo, anúncios, Ads e margem por SKU na Amazon",
};

// Os 8 serviços na ordem de exibição (grade da home, formulário, JSON-LD).
export const SERVICE_LIST: ServiceSummary[] = [
  AMAZON_SERVICE,
  ...Object.values(SERVICES).map(({ key, name, path, summary }) => ({ key, name, path, summary })),
];

export function isServiceKey(value: string): value is ServiceKey {
  return SERVICE_LIST.some((service) => service.key === value);
}

// ?servico=<chave> na URL do contato; qualquer outra coisa é ignorada.
export function parseServiceParam(value: string | string[] | undefined): ServiceKey | undefined {
  return typeof value === "string" && isServiceKey(value) ? value : undefined;
}

export function serviceSummary(key: ServiceKey): ServiceSummary {
  return SERVICE_LIST.find((service) => service.key === key)!;
}

export function contactHref(key: ServiceKey): string {
  return `/contato?servico=${key}`;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `pnpm test lib/services.test.ts`
Expected: PASS (12 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/zemann/lib/services.ts apps/zemann/lib/services.test.ts
git commit -m "feat(zemann): catálogo dos serviços da agência

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Posicionamento, menu, rodapé, JSON-LD e índice do site

**Files:**
- Modify: `apps/zemann/site.config.ts:7`
- Modify: `apps/zemann/lib/pages.ts` (home, faq, sobre, contato e `MENU_GROUPS`)
- Modify: `apps/zemann/lib/jsonld.ts` (`organizationJsonLd`, `serviceJsonLd`)
- Modify: `apps/zemann/lib/site-index.ts`
- Modify: `apps/zemann/app/_components/site-footer.tsx:9`
- Test: `apps/zemann/lib/pages.test.ts`, `apps/zemann/lib/jsonld.test.ts`, `apps/zemann/lib/site-index.test.ts`, `apps/zemann/app/seo-output.test.ts`, `apps/zemann/app/_components/site-footer.test.tsx`

**Interfaces:**
- Consumes: `SERVICES`, `SERVICE_LIST` (Task 1).
- Produces:
  - `MENU_GROUPS` com 4 grupos, nesta ordem: `"Amazon"`, `"Serviços"`, `"Recursos"`, `"Empresa"`.
  - `serviceJsonLd(input: { name; description; path; priceFrom?; serviceType?: string })`: `serviceType` padrão `"Consultoria de Amazon"`.
  - `IndexEntry["section"]` passa a ser `"Páginas" | "Serviços" | "Guias" | "Cases"`.

- [ ] **Step 1: Escrever os testes que falham**

Em `apps/zemann/lib/pages.test.ts`, trocar o import e acrescentar dentro do arquivo:

```ts
import { MENU_GROUPS, PAGES } from "./pages";
import { SERVICES } from "./services";
```

```ts
describe("MENU_GROUPS", () => {
  it("tem os grupos Amazon, Serviços, Recursos e Empresa", () => {
    expect(MENU_GROUPS.map((group) => group.label)).toEqual(["Amazon", "Serviços", "Recursos", "Empresa"]);
  });

  it("grupo Serviços lista os 7 serviços novos na ordem do catálogo", () => {
    const group = MENU_GROUPS.find((g) => g.label === "Serviços")!;
    expect(group.items.map((item) => item.page.path)).toEqual(Object.values(SERVICES).map((s) => s.path));
    for (const item of group.items) expect(item.hint.length).toBeGreaterThan(0);
  });

  it("home se apresenta como agência", () => {
    expect(PAGES.home.title).toBe("Zemann — Agência de crescimento para e-commerce");
  });
});
```

Em `apps/zemann/lib/jsonld.test.ts`, acrescentar dentro de `describe("builders", …)`:

```ts
  it("organization lista os 8 serviços em knowsAbout", () => {
    const org = organizationJsonLd();
    expect(org.knowsAbout).toEqual([
      "Amazon",
      "SEO",
      "Tráfego pago",
      "CRO",
      "E-mail marketing",
      "UX",
      "Social media",
      "Assessoria",
    ]);
    expect(org.description).toBe("Agência de crescimento para marcas e e-commerces");
  });

  it("service aceita serviceType e mantém Consultoria de Amazon como padrão", () => {
    expect(serviceJsonLd({ name: "S", description: "D", path: "/s" }).serviceType).toBe("Consultoria de Amazon");
    expect(serviceJsonLd({ name: "S", description: "D", path: "/s", serviceType: "SEO" }).serviceType).toBe("SEO");
  });
```

Em `apps/zemann/lib/site-index.test.ts`, acrescentar ao `describe("buildSiteIndex", …)`:

```ts
  it("inclui os 7 serviços na seção Serviços", () => {
    const services = buildSiteIndex([], []).filter((e) => e.section === "Serviços");
    expect(services.map((e) => e.path)).toEqual([
      "/seo-para-ecommerce",
      "/trafego-pago-para-ecommerce",
      "/cro-otimizacao-de-conversao",
      "/email-marketing-para-ecommerce",
      "/ux-para-ecommerce",
      "/social-media-para-marcas",
      "/assessoria-de-marketing-digital",
    ]);
  });
```

e ao `describe("renderLlmsTxt", …)`:

```ts
  it("tem a seção Serviços entre Páginas e Guias e apresenta a agência", () => {
    const text = renderLlmsTxt(buildSiteIndex([guide], []));
    expect(text).toContain("> Agência de crescimento para marcas e e-commerces.");
    expect(text.indexOf("## Páginas")).toBeLessThan(text.indexOf("## Serviços"));
    expect(text.indexOf("## Serviços")).toBeLessThan(text.indexOf("## Guias"));
    expect(text).toContain("](https://www.zemann.com.br/seo-para-ecommerce): ");
  });
```

Em `apps/zemann/app/seo-output.test.ts`, acrescentar a constante e dois testes:

```ts
const SERVICE_PATHS = [
  "/seo-para-ecommerce",
  "/trafego-pago-para-ecommerce",
  "/cro-otimizacao-de-conversao",
  "/email-marketing-para-ecommerce",
  "/ux-para-ecommerce",
  "/social-media-para-marcas",
  "/assessoria-de-marketing-digital",
];
```

```ts
  it("sitemap lista as 7 páginas de serviço", () => {
    const urls = sitemap().map((e) => e.url);
    for (const path of SERVICE_PATHS) expect(urls, path).toContain(`https://www.zemann.com.br${path}`);
  });

  it("llms.txt lista as 7 páginas de serviço", async () => {
    const body = await GET().text();
    for (const path of SERVICE_PATHS) expect(body, path).toContain(`https://www.zemann.com.br${path})`);
  });
```

Em `apps/zemann/app/_components/site-footer.test.tsx`, trocar o import de testing-library para incluir `within` e acrescentar:

```tsx
import { render, screen, within } from "@testing-library/react";
```

```tsx
  it("tem a coluna Serviços com os 7 serviços", () => {
    render(<SiteFooter />);
    const nav = screen.getByRole("navigation", { name: "Rodapé — Serviços" });
    expect(within(nav).getAllByRole("link")).toHaveLength(7);
    expect(within(nav).getByRole("link", { name: "SEO para e-commerce" })).toHaveAttribute("href", "/seo-para-ecommerce");
  });
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `pnpm test lib/pages.test.ts lib/jsonld.test.ts lib/site-index.test.ts app/seo-output.test.ts app/_components/site-footer.test.tsx`
Expected: FAIL nos testes novos (grupos do menu, knowsAbout, serviceType, seção Serviços, URLs no sitemap/llms, coluna do rodapé).

- [ ] **Step 3: Tagline da agência**

Em `apps/zemann/site.config.ts`, trocar a linha 7:

```ts
  tagline: "Agência de crescimento para marcas e e-commerces",
```

- [ ] **Step 4: `lib/pages.ts`**

Acrescentar no topo:

```ts
import { SERVICES } from "./services";
```

Substituir as entradas `home`, `faq`, `sobre` e `contato` de `PAGES` por:

```ts
  home: {
    path: "/",
    title: "Zemann — Agência de crescimento para e-commerce",
    description:
      "Agência de crescimento para marcas e e-commerces: Amazon, SEO, tráfego pago, CRO, e-mail, UX, social media e assessoria, com um time que executa junto.",
  },
```

```ts
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
```

Substituir `MENU_GROUPS` inteiro por:

```ts
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
```

- [ ] **Step 5: `lib/jsonld.ts`**

Acrescentar o import:

```ts
import { SERVICE_LIST } from "./services";
```

Em `organizationJsonLd()`, logo depois de `description: siteConfig.tagline,`, acrescentar:

```ts
    knowsAbout: SERVICE_LIST.map((service) => service.name),
```

Em `serviceJsonLd`, acrescentar `serviceType?: string;` ao tipo de `input` (depois de `priceFrom?: number | null;`) e trocar a linha `serviceType: "Consultoria de Amazon",` por:

```ts
    serviceType: input.serviceType ?? "Consultoria de Amazon",
```

- [ ] **Step 6: `lib/site-index.ts`**

Acrescentar o import:

```ts
import { SERVICES } from "./services";
```

Trocar o tipo da seção:

```ts
  section: "Páginas" | "Serviços" | "Guias" | "Cases";
```

Em `buildSiteIndex`, logo depois do bloco que mapeia `PAGES`, acrescentar:

```ts
    ...Object.values(SERVICES).map((service) => ({
      path: service.path,
      title: service.title,
      description: service.description,
      section: "Serviços" as const,
    })),
```

Em `renderLlmsTxt`, trocar a lista de seções e o resumo:

```ts
  const sections: IndexEntry["section"][] = ["Páginas", "Serviços", "Guias", "Cases"];
  const lines = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.tagline}. Agência independente, sem vínculo com a Amazon, o Google ou a Meta, com um time que executa junto com o cliente.`,
    "",
    "A Amazon é o carro-chefe: atende marcas e indústrias (vendor e seller) e sellers estabelecidos no Brasil, com tecnologia conectada à API oficial da Amazon (SP-API) e oferta em três etapas: diagnóstico da conta, implantação (30 a 90 dias) e gestão contínua.",
    "",
    "Outros serviços: SEO, tráfego pago, CRO, e-mail marketing, UX, social media e assessoria de marketing digital.",
  ];
```

- [ ] **Step 7: Rodapé em 5 colunas**

Em `apps/zemann/app/_components/site-footer.tsx`, linha 9, trocar `md:grid-cols-4` por `md:grid-cols-3 lg:grid-cols-5`:

```tsx
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-3 lg:grid-cols-5">
```

- [ ] **Step 8: Rodar tudo**

Run: `pnpm test`
Expected: PASS em todos os arquivos (os testes do cabeçalho continuam passando: o primeiro grupo agora é "Amazon" e o primeiro link continua "Para marcas").

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add apps/zemann/site.config.ts apps/zemann/lib apps/zemann/app/_components/site-footer.tsx apps/zemann/app/_components/site-footer.test.tsx apps/zemann/app/seo-output.test.ts
git commit -m "feat(zemann): posicionamento de agência, menu com grupo Serviços, rodapé, JSON-LD e llms.txt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Página de serviço (modelo único) e as 7 rotas

**Files:**
- Create: `apps/zemann/app/_components/service-page.tsx`
- Create: `apps/zemann/app/_components/service-page.test.tsx`
- Create: `apps/zemann/app/service-routes.test.ts`
- Create: `page.tsx` e `opengraph-image.tsx` em cada uma destas pastas de `apps/zemann/app/`: `seo-para-ecommerce`, `trafego-pago-para-ecommerce`, `cro-otimizacao-de-conversao`, `email-marketing-para-ecommerce`, `ux-para-ecommerce`, `social-media-para-marcas`, `assessoria-de-marketing-digital`

**Interfaces:**
- Consumes: `SERVICES`, `ServiceInfo`, `contactHref`, `serviceSummary` (Task 1); `serviceJsonLd` com `serviceType` (Task 2); componentes existentes `Breadcrumbs`, `CtaBlock`, `CtaLink`, `FaqList`, `JsonLd`; `pageMetadata` de `lib/seo.ts`; `OG_SIZE`, `renderOg(title, kicker)` de `lib/og.tsx`.
- Produces: `ServicePage({ service }: { service: ServiceInfo })`.

Ler antes: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md` (ou o arquivo equivalente na pasta de metadata).

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/zemann/app/_components/service-page.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SERVICES, serviceSummary } from "@/lib/services";
import { ServicePage } from "./service-page";

describe("ServicePage", () => {
  it("mostra H1, abertura e dois CTAs que levam ao contato com o serviço escolhido", () => {
    render(<ServicePage service={SERVICES.seo} />);
    expect(screen.getByRole("heading", { level: 1, name: SERVICES.seo.title })).toBeInTheDocument();
    expect(screen.getByText(SERVICES.seo.intro)).toBeInTheDocument();
    const ctas = screen.getAllByRole("link", { name: "Fale com um especialista" });
    expect(ctas).toHaveLength(2);
    for (const link of ctas) expect(link).toHaveAttribute("href", "/contato?servico=seo");
    expect(ctas.map((link) => link.getAttribute("data-cta"))).toEqual(["servico_seo_topo", "servico_seo_final"]);
  });

  it("segue a ordem de seções do modelo", () => {
    render(<ServicePage service={SERVICES.cro} />);
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual([
      "Para quem é",
      "O que inclui",
      "Como funciona",
      "Como se conecta aos outros serviços",
      "Perguntas frequentes",
      "Vamos conversar sobre a sua loja?",
    ]);
  });

  it("conexões apontam para as páginas dos serviços ligados", () => {
    const service = SERVICES["trafego-pago"];
    render(<ServicePage service={service} />);
    const section = screen.getByRole("heading", { level: 2, name: "Como se conecta aos outros serviços" }).closest("section")!;
    const hrefs = within(section).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(service.connections.map((c) => serviceSummary(c.key).path));
  });

  it("rótulo de analytics vira snake_case em chave com hífen", () => {
    render(<ServicePage service={SERVICES["trafego-pago"]} />);
    const [top] = screen.getAllByRole("link", { name: "Fale com um especialista" });
    expect(top).toHaveAttribute("data-cta", "servico_trafego_pago_topo");
  });

  it("publica JSON-LD de Service, FAQPage e BreadcrumbList", () => {
    const { container } = render(<ServicePage service={SERVICES.ux} />);
    const data = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent!));
    expect(data.map((d) => d["@type"])).toEqual(expect.arrayContaining(["Service", "FAQPage", "BreadcrumbList"]));
    expect(data.find((d) => d["@type"] === "Service")).toMatchObject({
      serviceType: "UX",
      url: "https://www.zemann.com.br/ux-para-ecommerce",
    });
  });
});
```

Criar `apps/zemann/app/service-routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SERVICES } from "@/lib/services";

const appDir = fileURLToPath(new URL(".", import.meta.url));

describe("rotas dos serviços", () => {
  for (const service of Object.values(SERVICES)) {
    it(`${service.path} tem page.tsx e opengraph-image.tsx do serviço certo`, () => {
      const dir = join(appDir, service.path.slice(1));
      const key = `SERVICES[${JSON.stringify(service.key)}]`;
      for (const file of ["page.tsx", "opengraph-image.tsx"]) {
        const path = join(dir, file);
        expect(existsSync(path), path).toBe(true);
        expect(readFileSync(path, "utf8"), path).toContain(key);
      }
    });
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test app/_components/service-page.test.tsx app/service-routes.test.ts`
Expected: FAIL ("Failed to resolve import './service-page'" e 7 falhas de arquivo inexistente).

- [ ] **Step 3: Implementar `ServicePage`**

Criar `apps/zemann/app/_components/service-page.tsx`:

```tsx
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
```

- [ ] **Step 4: Criar as 7 rotas**

Para cada linha da tabela abaixo, criar `apps/zemann/app/<pasta>/page.tsx` e `apps/zemann/app/<pasta>/opengraph-image.tsx` trocando `<chave>` e `<Nome>Page`:

| pasta | chave | nome do componente |
|---|---|---|
| `seo-para-ecommerce` | `seo` | `SeoPage` |
| `trafego-pago-para-ecommerce` | `trafego-pago` | `TrafegoPagoPage` |
| `cro-otimizacao-de-conversao` | `cro` | `CroPage` |
| `email-marketing-para-ecommerce` | `email-marketing` | `EmailMarketingPage` |
| `ux-para-ecommerce` | `ux` | `UxPage` |
| `social-media-para-marcas` | `social-media` | `SocialMediaPage` |
| `assessoria-de-marketing-digital` | `assessoria` | `AssessoriaPage` |

Modelo de `page.tsx` (exemplo completo para `seo`; sempre com colchetes e aspas, que o teste de rotas confere):

```tsx
import { pageMetadata } from "@/lib/seo";
import { SERVICES } from "@/lib/services";
import { ServicePage } from "../_components/service-page";

const service = SERVICES["seo"];
export const metadata = pageMetadata(service);

export default function SeoPage() {
  return <ServicePage service={service} />;
}
```

Modelo de `opengraph-image.tsx` (exemplo completo para `seo`):

```tsx
import { OG_SIZE, renderOg } from "@/lib/og";
import { SERVICES } from "@/lib/services";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = SERVICES["seo"].title;

export default function Image() {
  return renderOg(SERVICES["seo"].title, "Agência de crescimento para e-commerce");
}
```

- [ ] **Step 5: Rodar os testes**

Run: `pnpm test app/_components/service-page.test.tsx app/service-routes.test.ts`
Expected: PASS (5 + 7 testes).

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Conferir no navegador**

Run: `pnpm dev` (porta 4106) e abrir `http://localhost:4106/seo-para-ecommerce` e `http://localhost:4106/assessoria-de-marketing-digital` (este tem 3 etapas). Conferir: seções na ordem, cartões alinhados no celular (largura 375) e no desktop, CTA leva a `/contato?servico=…`, `http://localhost:4106/seo-para-ecommerce/opengraph-image` gera a imagem. Parar o servidor.

- [ ] **Step 7: Commit**

```bash
git add apps/zemann/app/_components/service-page.tsx apps/zemann/app/_components/service-page.test.tsx apps/zemann/app/service-routes.test.ts apps/zemann/app/seo-para-ecommerce apps/zemann/app/trafego-pago-para-ecommerce apps/zemann/app/cro-otimizacao-de-conversao apps/zemann/app/email-marketing-para-ecommerce apps/zemann/app/ux-para-ecommerce apps/zemann/app/social-media-para-marcas apps/zemann/app/assessoria-de-marketing-digital
git commit -m "feat(zemann): páginas dos 7 serviços da agência com modelo único

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Formulário com "Serviço de interesse"

**Files:**
- Modify: `apps/zemann/lib/contact.ts`
- Modify: `apps/zemann/app/_components/contact-form.tsx`
- Modify: `apps/zemann/app/contato/page.tsx`
- Test: `apps/zemann/lib/contact.test.ts`, `apps/zemann/app/_components/contact-form.test.tsx`

**Interfaces:**
- Consumes: `SERVICE_LIST`, `ServiceKey`, `isServiceKey`, `parseServiceParam`, `serviceSummary` (Task 1).
- Produces:
  - `ContactField` inclui `"servico"`; `ContactInput.servico: ServiceKey | null`.
  - `ContactForm({ form, submitLabel, withService?: boolean, defaultService?: ServiceKey })`.
  - Assunto do e-mail: `[Site] Contato — <Nome do serviço> — <empresa>` quando há serviço; sem serviço, igual ao atual.

Ler antes: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (seção `searchParams`).

- [ ] **Step 1: Escrever os testes que falham**

Em `apps/zemann/lib/contact.test.ts`, acrescentar ao `describe("validateContact", …)`:

```ts
  it("aceita serviço do catálogo", () => {
    const result = validateContact(form({ ...valid, form: "contato", servico: "seo" }));
    expect(result.ok && result.data.servico).toBe("seo");
  });

  it("serviço vazio (Ainda não sei) é aceito como null", () => {
    const result = validateContact(form({ ...valid, form: "contato", servico: "" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.servico).toBeNull();
  });

  it("recusa chave de serviço fora do catálogo", () => {
    const result = validateContact(form({ ...valid, form: "contato", servico: "influencers" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.servico).toBe("Escolha um serviço da lista.");
  });
```

e ao `describe("formatContactEmail", …)`:

```ts
  it("põe o nome do serviço no assunto e no corpo do contato", () => {
    const result = validateContact(form({ ...valid, form: "contato", servico: "trafego-pago" }));
    if (!result.ok) throw new Error("inválido");
    const mail = formatContactEmail(result.data);
    expect(mail.subject).toBe("[Site] Contato — Tráfego pago — Marca X");
    expect(mail.text).toContain("Serviço de interesse: Tráfego pago");
  });

  it("contato sem serviço mantém o assunto e registra Ainda não sei", () => {
    const result = validateContact(form({ ...valid, form: "contato", servico: "" }));
    if (!result.ok) throw new Error("inválido");
    const mail = formatContactEmail(result.data);
    expect(mail.subject).toBe("[Site] Contato — Marca X");
    expect(mail.text).toContain("Serviço de interesse: Ainda não sei");
  });

  it("diagnóstico não ganha linha de serviço", () => {
    const result = validateContact(form(valid));
    if (!result.ok) throw new Error("inválido");
    expect(formatContactEmail(result.data).text).not.toContain("Serviço de interesse");
  });
```

Em `apps/zemann/app/_components/contact-form.test.tsx`, acrescentar ao `describe("ContactForm", …)`:

```tsx
  it("contato mostra o campo opcional com os 8 serviços e Ainda não sei", () => {
    render(<ContactForm form="contato" submitLabel="Enviar" withService />);
    const select = screen.getByRole("combobox", { name: /Serviço de interesse/ });
    expect(select).not.toBeRequired();
    expect(select).toHaveValue("");
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options).toEqual(["Ainda não sei", "Amazon", "SEO", "Tráfego pago", "CRO", "E-mail marketing", "UX", "Social media", "Assessoria"]);
  });

  it("pré-seleciona o serviço vindo da URL", () => {
    render(<ContactForm form="contato" submitLabel="Enviar" withService defaultService="cro" />);
    expect(screen.getByRole("combobox", { name: /Serviço de interesse/ })).toHaveValue("cro");
  });

  it("diagnóstico não mostra o campo de serviço", () => {
    renderForm();
    expect(screen.queryByRole("combobox", { name: /Serviço de interesse/ })).toBeNull();
  });

  it("depois de um erro, mantém a escolha do visitante e não volta ao serviço da URL", async () => {
    render(<ContactForm form="contato" submitLabel="Enviar" withService defaultService="seo" />);
    submitContact.mockResolvedValueOnce({
      status: "error",
      message: "Confira os campos destacados.",
      errors: { desafio: "Conte em poucas palavras o seu desafio." },
      values: { servico: "" },
      attempt: 1,
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("Conte em poucas palavras o seu desafio.");
    expect(screen.getByRole("combobox", { name: /Serviço de interesse/ })).toHaveValue("");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test lib/contact.test.ts app/_components/contact-form.test.tsx`
Expected: FAIL nos testes novos.

- [ ] **Step 3: `lib/contact.ts`**

Acrescentar o import:

```ts
import { isServiceKey, serviceSummary, type ServiceKey } from "./services";
```

Trocar os tipos e a lista de campos:

```ts
export type ContactField = "nome" | "email" | "empresa" | "perfil" | "loja" | "servico" | "desafio";
```

```ts
export type ContactInput = {
  form: ContactFormKind;
  nome: string;
  email: string;
  empresa: string;
  perfil: "marca" | "seller";
  loja: string;
  servico: ServiceKey | null;
  desafio: string;
};
```

```ts
const FIELDS: ContactField[] = ["nome", "email", "empresa", "perfil", "loja", "servico", "desafio"];
```

Em `validateContact`, logo depois da linha do `loja` (`if ((values.loja ?? "").length > 500) …`), acrescentar:

```ts
  // Opcional: vazio = "Ainda não sei"; preenchido, só vale chave do catálogo.
  if (values.servico && !isServiceKey(values.servico)) errors.servico = "Escolha um serviço da lista.";
```

No objeto `data` retornado, depois de `loja: values.loja ?? "",`, acrescentar:

```ts
      servico: values.servico ? (values.servico as ServiceKey) : null,
```

Substituir `formatContactEmail` inteira por:

```ts
export function formatContactEmail(data: ContactInput): OutgoingMail {
  const label = data.form === "diagnostico" ? "Diagnóstico da conta" : "Contato";
  const service = data.servico ? serviceSummary(data.servico).name : null;
  return {
    subject: `[Site] ${label}${service ? ` — ${service}` : ""} — ${data.empresa}`,
    replyTo: data.email,
    text: [
      `Formulário: ${label}`,
      `Nome: ${data.nome}`,
      `E-mail: ${data.email}`,
      `Empresa: ${data.empresa}`,
      `Perfil: ${data.perfil === "marca" ? "Marca/indústria" : "Loja, revenda ou seller"}`,
      ...(data.form === "contato" ? [`Serviço de interesse: ${service ?? "Ainda não sei"}`] : []),
      `Loja/produto: ${data.loja || "não informado"}`,
      "",
      "Desafio:",
      data.desafio,
    ].join("\n"),
  };
}
```

- [ ] **Step 4: `contact-form.tsx`**

Acrescentar os imports:

```tsx
import { SERVICE_LIST, type ServiceKey } from "@/lib/services";
```

Trocar a assinatura do componente:

```tsx
export function ContactForm({
  form,
  submitLabel,
  withService = false,
  defaultService,
}: {
  form: ContactFormKind;
  submitLabel: string;
  withService?: boolean;
  defaultService?: ServiceKey;
}) {
```

No `<select id="perfil">`, trocar o texto da opção `seller` por `Loja, revenda ou seller`:

```tsx
          <option value="seller">Loja, revenda ou seller</option>
```

Trocar o rótulo do campo `loja` por um texto que serve a todos os serviços:

```tsx
        <Label htmlFor="loja">Link da sua loja ou de um produto (opcional)</Label>
```

Logo depois do bloco do campo `loja` (antes do `desafio`), acrescentar:

```tsx
      {withService ? (
        <div>
          <Label htmlFor="servico">Serviço de interesse (opcional)</Label>
          {/* Depois de um envio, vale o que o visitante escolheu; no primeiro acesso, o serviço da URL. */}
          <select
            id="servico"
            name="servico"
            defaultValue={state.attempt > 0 ? v("servico") : (defaultService ?? "")}
            aria-invalid={Boolean(err("servico"))}
            aria-describedby={described("servico")}
            className={INPUT}
          >
            <option value="">Ainda não sei</option>
            {SERVICE_LIST.map((service) => (
              <option key={service.key} value={service.key}>{service.name}</option>
            ))}
          </select>
          <FieldError id="servico-erro" message={err("servico")} />
        </div>
      ) : null}
```

- [ ] **Step 5: `app/contato/page.tsx`**

Substituir o arquivo inteiro por:

```tsx
import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { parseServiceParam } from "@/lib/services";
import { siteConfig } from "@/site.config";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { ContactForm } from "../_components/contact-form";

const page = PAGES.contato;
export const metadata = pageMetadata(page);

export default async function ContatoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // ?servico=<chave> vem do CTA das páginas de serviço; chave desconhecida é ignorada.
  const defaultService = parseServiceParam((await searchParams).servico);
  return (
    <main id="conteudo" className="mx-auto max-w-3xl px-4 pt-10">
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: page.title, path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">Fale com o nosso time</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">
        Conte o seu cenário e, se já souber, o serviço que procura: Amazon, SEO, tráfego pago, CRO, e-mail
        marketing, UX, social media ou assessoria. Se preferir, escreva para{" "}
        <a href={`mailto:${siteConfig.email}`} className="font-medium text-accent underline">{siteConfig.email}</a>.
      </p>
      <div className="mt-10">
        <ContactForm form="contato" submitLabel="Enviar mensagem" withService defaultService={defaultService} />
      </div>
    </main>
  );
}
```

O canonical continua `/contato` (vem de `pageMetadata`), então `/contato?servico=…` não vira página duplicada.

- [ ] **Step 6: Rodar os testes**

Run: `pnpm test`
Expected: PASS em todos os arquivos.

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Conferir no navegador**

Run: `pnpm dev`; abrir `http://localhost:4106/contato?servico=ux` (select em "UX"), `http://localhost:4106/contato?servico=xyz` (select em "Ainda não sei") e `http://localhost:4106/diagnostico-conta-amazon` (sem o campo). Enviar o contato com o desafio vazio e conferir que o serviço escolhido continua selecionado. Parar o servidor.

- [ ] **Step 8: Commit**

```bash
git add apps/zemann/lib/contact.ts apps/zemann/lib/contact.test.ts apps/zemann/app/_components/contact-form.tsx apps/zemann/app/_components/contact-form.test.tsx apps/zemann/app/contato/page.tsx
git commit -m "feat(zemann): campo Serviço de interesse no contato, pré-preenchido pela página do serviço

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Home da agência

**Files:**
- Create: `apps/zemann/app/_components/services-grid.tsx`
- Modify: `apps/zemann/app/page.tsx` (arquivo inteiro)
- Modify: `apps/zemann/app/opengraph-image.tsx`
- Modify: `apps/zemann/app/_components/cta-trio.tsx`
- Modify: `apps/zemann/app/_components/comparison-table.tsx`
- Test: `apps/zemann/app/_components/home-blocks.test.tsx`, `apps/zemann/app/_components/blocks.test.tsx`

**Interfaces:**
- Consumes: `SERVICE_LIST` (Task 1); `PAGES` (Task 2); `listCases()` de `lib/content.ts` (retorna `CaseMeta[]` com `slug`, `client`, `title`, `description`); componentes existentes `CtaLink`, `HeroIllustration`, `StatsBand`, `ComparisonTable`, `OfferLadder`, `CtaTrio`.
- Produces: `ServicesGrid()`.

- [ ] **Step 1: Escrever os testes que falham**

Em `apps/zemann/app/_components/home-blocks.test.tsx`, acrescentar o import `import { ServicesGrid } from "./services-grid";` e os testes:

```tsx
  it("grade de serviços tem os 8, com a Amazon em primeiro e destacada", () => {
    render(<ServicesGrid />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(8);
    expect(links[0]).toHaveAttribute("href", "/consultoria-amazon-para-marcas");
    expect(links[0]).toHaveTextContent("Carro-chefe");
    expect(links[1]).toHaveAttribute("href", "/seo-para-ecommerce");
    expect(links.slice(1).some((a) => a.textContent?.includes("Carro-chefe"))).toBe(false);
  });

  it("grade de serviços expõe chaves de analytics snake_case", () => {
    render(<ServicesGrid />);
    const ctas = screen.getAllByRole("link").map((a) => a.getAttribute("data-cta"));
    expect(ctas[0]).toBe("home_servico_amazon");
    expect(ctas).toContain("home_servico_trafego_pago");
  });

  it("CTA final fala com quem procura a agência", () => {
    render(<CtaTrio />);
    expect(screen.getByRole("heading", { level: 2, name: "Por onde começar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Fale com o nosso time" })).toBeInTheDocument();
  });
```

Em `apps/zemann/app/_components/blocks.test.tsx`, trocar a lista de colunas do comparativo:

```tsx
    for (const name of ["Zemann", "Outras agências", "Curso ou mentoria"]) {
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test app/_components/home-blocks.test.tsx app/_components/blocks.test.tsx`
Expected: FAIL ("Failed to resolve import './services-grid'" e coluna "Outras agências" não encontrada).

- [ ] **Step 3: `services-grid.tsx`**

Criar `apps/zemann/app/_components/services-grid.tsx`:

```tsx
import Link from "next/link";
import { SERVICE_LIST } from "@/lib/services";

export function ServicesGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {SERVICE_LIST.map((service) => {
        const featured = service.key === "amazon";
        return (
          <Link
            key={service.key}
            href={service.path}
            data-cta={`home_servico_${service.key.replace(/-/g, "_")}`}
            className={`group flex flex-col rounded-lg border p-6 transition hover:shadow-md ${
              featured ? "border-accent bg-accent-soft sm:col-span-2 lg:row-span-2" : "border-line hover:border-accent"
            }`}
          >
            {featured ? (
              <span className="text-xs font-bold uppercase tracking-wide text-accent-dark">Carro-chefe</span>
            ) : null}
            <h3 className={`font-bold text-ink group-hover:text-accent ${featured ? "mt-2 text-2xl" : "text-lg"}`}>
              {service.name}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{service.summary}</p>
            <span aria-hidden className="mt-4 inline-block font-semibold text-accent">→</span>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: `cta-trio.tsx`**

Trocar `OPTIONS` e o título:

```tsx
const OPTIONS = [
  { href: PAGES.diagnostico.path, cta: "trio_diagnostico", title: "Diagnóstico da conta Amazon", text: "Saiba o que trava as vendas na Amazon e o que corrigir primeiro." },
  { href: PAGES.guias.path, cta: "trio_guias", title: "Aprenda com os guias", text: "Conteúdo prático escrito por quem opera uma marca." },
  { href: PAGES.contato.path, cta: "trio_contato", title: "Fale com o nosso time", text: "Conte o seu desafio e indicamos o serviço e o primeiro passo." },
];
```

```tsx
      <h2 className="text-3xl font-extrabold tracking-tight text-ink md:text-4xl">Por onde começar</h2>
```

- [ ] **Step 5: `comparison-table.tsx`**

Trocar a legenda e o cabeçalho da terceira coluna (a Zemann agora é uma agência; o comparativo é sobre Amazon):

```tsx
        <caption className="sr-only">Comparativo na Amazon entre Zemann, outras agências e curso ou mentoria</caption>
```

```tsx
            <th scope="col" className="border-b-2 border-line px-3 py-3 font-semibold">Outras agências</th>
```

- [ ] **Step 6: `app/page.tsx`**

Substituir o arquivo inteiro por:

```tsx
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
```

- [ ] **Step 7: Imagem Open Graph da home**

Substituir `apps/zemann/app/opengraph-image.tsx` por:

```tsx
import { OG_SIZE, renderOg } from "@/lib/og";
import { PAGES } from "@/lib/pages";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = PAGES.home.title;

export default function Image() {
  return renderOg("Mais vendas online, com um time que executa junto com o seu", "Agência de crescimento para e-commerce");
}
```

- [ ] **Step 8: Rodar os testes**

Run: `pnpm test`
Expected: PASS em todos os arquivos.

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 9: Conferir no navegador**

Run: `pnpm dev`; abrir `http://localhost:4106/` em 375px e em desktop. Conferir: cartão da Amazon ocupa duas colunas e duas linhas no desktop e fica em destaque no celular; "Ver serviços" rola até a grade sem ficar escondido sob o cabeçalho fixo; a faixa de números, o comparativo e as etapas aparecem depois do texto da Amazon; os 4 cases publicados aparecem. Parar o servidor.

- [ ] **Step 10: Commit**

```bash
git add apps/zemann/app/page.tsx apps/zemann/app/opengraph-image.tsx apps/zemann/app/_components/services-grid.tsx apps/zemann/app/_components/cta-trio.tsx apps/zemann/app/_components/comparison-table.tsx apps/zemann/app/_components/home-blocks.test.tsx apps/zemann/app/_components/blocks.test.tsx
git commit -m "feat(zemann): home da agência com grade dos 8 serviços e faixa Amazon em destaque

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Perguntas frequentes, Sobre e README

**Files:**
- Modify: `apps/zemann/lib/faq.ts` (arquivo inteiro)
- Modify: `apps/zemann/lib/faq.test.ts` (arquivo inteiro)
- Modify: `apps/zemann/app/perguntas-frequentes/page.tsx` (arquivo inteiro)
- Modify: `apps/zemann/app/sobre/page.tsx` (arquivo inteiro)
- Modify: `apps/zemann/app/sobre/opengraph-image.tsx:8`
- Modify: `apps/zemann/README.md:1-3`

**Interfaces:**
- Consumes: `faqJsonLd` de `lib/jsonld.ts`; `FaqList`, `JsonLd`, `CtaBlock`, `Breadcrumbs`.
- Produces: `AGENCY_FAQ: FaqItem[]`, `AMAZON_FAQ: FaqItem[]` (substituem `GENERAL_FAQ`, que deixa de existir; o único consumidor é `app/perguntas-frequentes/page.tsx`).

- [ ] **Step 1: Escrever o teste que falha**

Substituir `apps/zemann/lib/faq.test.ts` por:

```ts
import { describe, expect, it } from "vitest";
import { AGENCY_FAQ, AMAZON_FAQ } from "./faq";

const ALL = [...AGENCY_FAQ, ...AMAZON_FAQ];

describe("FAQ", () => {
  it("tem perguntas únicas nos dois blocos, terminadas em interrogação e com resposta", () => {
    const questions = ALL.map((item) => item.q);
    expect(new Set(questions).size).toBe(questions.length);
    for (const item of ALL) {
      expect(item.q.endsWith("?")).toBe(true);
      expect(item.a.length).toBeGreaterThan(40);
    }
  });

  it("bloco da agência apresenta os serviços e não diz que o foco é só a Amazon", () => {
    expect(AGENCY_FAQ[0].a).toContain("agência de crescimento");
    for (const item of ALL) expect(item.a).not.toContain("exclusivamente a Amazon");
  });

  it("não cita selos que a Zemann não tem", () => {
    const text = JSON.stringify(ALL).toLowerCase();
    for (const word of ["partner", "parceiro oficial", "parceira oficial"]) expect(text).not.toContain(word);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test lib/faq.test.ts`
Expected: FAIL ("AGENCY_FAQ" não exportado).

- [ ] **Step 3: `lib/faq.ts`**

Substituir o arquivo inteiro por:

```ts
import type { FaqItem } from "./content";

export const AGENCY_FAQ: FaqItem[] = [
  {
    q: "O que a Zemann faz?",
    a: "A Zemann é uma agência de crescimento para marcas e e-commerces. Nosso time cuida de Amazon, SEO, tráfego pago, CRO, e-mail marketing, UX, social media e assessoria, executando junto com o time do cliente.",
  },
  {
    q: "Preciso contratar todos os serviços?",
    a: "Não. Você pode começar por um único serviço e somar outros quando fizer sentido. Cada serviço funciona sozinho ou combinado com os demais.",
  },
  {
    q: "Por onde começar?",
    a: "Pelo contato: conte o seu desafio e o nosso time indica o serviço e o primeiro passo. Para quem vende na Amazon, o caminho mais curto é o diagnóstico da conta.",
  },
  {
    q: "Quanto custa?",
    a: "Cada serviço é orçado conforme o escopo, o tamanho da operação e as frentes escolhidas. O diagnóstico da conta Amazon tem valor fixo, informado na página do diagnóstico.",
  },
  {
    q: "Vocês precisam de acesso às minhas contas?",
    a: "Sim, para executar. O acesso é concedido por você, com as permissões necessárias, e pode ser revogado a qualquer momento. As contas e os dados continuam sendo da sua empresa.",
  },
  {
    q: "A Zemann tem vínculo com Google, Meta ou Amazon?",
    a: "Não. A Zemann é uma agência independente. Usamos as ferramentas e as APIs dessas plataformas como qualquer empresa autorizada pelos clientes que atende.",
  },
];

export const AMAZON_FAQ: FaqItem[] = [
  {
    q: "Para quem é a consultoria de Amazon?",
    a: "Para marcas e indústrias que querem entrar ou crescer na Amazon, como vendor ou seller, e para sellers estabelecidos que pararam de crescer.",
  },
  {
    q: "Como começar na Amazon?",
    a: "Pelo diagnóstico da conta: uma auditoria com plano de ação priorizado. Depois você decide se executa com o seu time ou com a Zemann.",
  },
  {
    q: "Quanto tempo dura uma implantação na Amazon?",
    a: "Entre 30 e 90 dias, conforme o tamanho do catálogo e as frentes envolvidas: cadastro, conteúdo, Ads e organização dos números.",
  },
  {
    q: "Vocês precisam de acesso à conta da Amazon?",
    a: "Sim, por meio de um usuário com as permissões necessárias criado por você. O acesso pode ser revogado a qualquer momento e toda alteração publicada fica registrada.",
  },
  {
    q: "Alguma coisa é publicada sem a minha aprovação?",
    a: "Não. Toda alteração de conteúdo passa por uma prévia validada pela própria Amazon e só é publicada depois da sua aprovação.",
  },
  {
    q: "A Zemann atende vendor e seller?",
    a: "Sim. Operamos uma marca própria como vendor e atendemos sellers 3P. Muitas marcas combinam os dois modelos.",
  },
  {
    q: "A Zemann é parceira da Amazon?",
    a: "Não. A Zemann é uma agência independente. Usamos a API oficial da Amazon (SP-API) como qualquer desenvolvedor autorizado pelos vendedores que atendemos.",
  },
];
```

- [ ] **Step 4: Página de perguntas frequentes**

Substituir `apps/zemann/app/perguntas-frequentes/page.tsx` por (um único `FAQPage` no JSON-LD com os dois blocos, para a página não publicar dois):

```tsx
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
```

- [ ] **Step 5: Página Sobre**

Substituir `apps/zemann/app/sobre/page.tsx` por:

```tsx
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
```

Em `apps/zemann/app/sobre/opengraph-image.tsx`, linha 8:

```tsx
  return renderOg("Sobre a Zemann", "Agência de crescimento para e-commerce");
```

- [ ] **Step 6: README**

Em `apps/zemann/README.md`, trocar as linhas 1 a 3 por:

```markdown
# Zemann — site da agência de crescimento para e-commerce

App Next.js (porta 4106). Amazon é o carro-chefe; os outros 7 serviços vêm do catálogo `lib/services.ts`
(uma página por serviço, modelo único em `app/_components/service-page.tsx`).
Specs: `docs/superpowers/specs/2026-10-17-zemann-site-amazon-design.md` e
`docs/superpowers/specs/2026-10-25-zemann-agencia-servicos-design.md`.
```

- [ ] **Step 7: Rodar os testes**

Run: `pnpm test`
Expected: PASS em todos os arquivos.

Run: `pnpm exec tsc --noEmit`
Expected: sem erros (nenhum import restante de `GENERAL_FAQ`).

- [ ] **Step 8: Commit**

```bash
git add apps/zemann/lib/faq.ts apps/zemann/lib/faq.test.ts apps/zemann/app/perguntas-frequentes/page.tsx apps/zemann/app/sobre apps/zemann/README.md
git commit -m "feat(zemann): perguntas frequentes da agência com bloco Amazon e página Sobre com o time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Verificação final

**Files:**
- Nenhum arquivo novo. Corrigir no lugar o que a verificação apontar e commitar como `fix(zemann): …`.

- [ ] **Step 1: Testes, tipos e build**

Run: `pnpm test`
Expected: PASS, com 19 arquivos de teste (16 da base + `services.test.ts`, `service-page.test.tsx`, `service-routes.test.ts`).

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

Run: `pnpm build`
Expected: build conclui; a lista de rotas mostra as 7 rotas novas como estáticas (○) e `/contato` como dinâmica (ƒ), por ler `searchParams`.

- [ ] **Step 2: Varredura de copy proibida**

Run (Grep tool, ou `rg` a partir de `apps/zemann`): `rg -n -i "google partner|meta business partner|parceiro oficial|parceira oficial|exclusivamente a amazon|consultoria de amazon mão na massa" app lib site.config.ts`
Expected: nenhuma ocorrência fora de arquivos `*.test.*` (nos testes, as palavras aparecem só como lista do que é proibido).

Run: `rg -n "GENERAL_FAQ" app lib`
Expected: nenhuma ocorrência.

- [ ] **Step 3: Conferência no navegador**

Run: `pnpm start` (depois do build) e conferir, em 375px e em desktop:
- `/`: hero, grade com a Amazon destacada, faixa Amazon, cases e os 3 caminhos.
- Menu: 4 grupos; o grupo Serviços abre com 7 itens e o painel não passa da borda da tela.
- Rodapé: 5 colunas no desktop, empilhado no celular.
- As 7 páginas de serviço e a imagem `/<serviço>/opengraph-image`.
- `/contato?servico=email-marketing` pré-seleciona "E-mail marketing".
- `/sitemap.xml` e `/llms.txt` com as 7 URLs e a seção "Serviços".
- `/perguntas-frequentes` com um único bloco `FAQPage` no código-fonte.

Parar o servidor.

- [ ] **Step 4: Commit das correções (se houver)**

```bash
git add apps/zemann
git commit -m "fix(zemann): ajustes da verificação final da agência

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
