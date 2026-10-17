# Zemann — site de consultoria Amazon: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `apps/zemann`, o novo site estático da Zemann (consultoria de Amazon para marcas e sellers), otimizado para SEO e AEO, com guias e cases em MDX e formulários que enviam e-mail por SMTP.

**Architecture:** App Next.js 16 independente no monorepo, sem dependência de `@mypet/core` nem do Supabase. A lógica fica em `lib/` (funções puras e testadas: conteúdo, JSON-LD, metadata, formulário, índice do site) e as páginas em `app/` só compõem. O conteúdo é MDX em `content/`: o frontmatter é lido com `gray-matter` (listagem, validação, metadata) e o corpo é importado via `@next/mdx` com `remark-frontmatter` (oculta o YAML) e `remark-gfm` (tabelas).

**Tech Stack:** Next.js 16.3.8, React 19.2.4, TypeScript, Tailwind CSS 4, `@next/mdx`, `gray-matter`, `nodemailer`, Vitest 4 + Testing Library (jsdom).

**Spec:** [docs/superpowers/specs/2026-10-17-zemann-site-amazon-design.md](../specs/2026-10-17-zemann-site-amazon-design.md)

## Global Constraints

- Next `16.3.8`, React `19.2.4`, mesmos devDependencies de `apps/azpetshop` (Tailwind 4, Vitest 4, Testing Library, jsdom).
- `apps/zemann` **não** importa `@mypet/core` nem usa Supabase.
- Porta `4106`. Domínio `www.zemann.com.br`.
- Toda copy em português do Brasil, com acentuação correta.
- Proibido na copy: "parceiro oficial Amazon" ou qualquer insinuação de vínculo com a Amazon. Usar "conectado à API oficial da Amazon (SP-API)".
- Rodapé com aviso: "Amazon é marca registrada da Amazon.com, Inc. ou de suas afiliadas. A Zemann não é afiliada à Amazon."
- Meta description ≤ 160 caracteres; título de página (sem o sufixo " | Zemann") ≤ 55 caracteres.
- JSON-LD sempre serializado com `<` trocado por `\u003c`.
- Campo "Seu desafio" é obrigatório **e** marcado como obrigatório na interface.
- Guia ou case com `draft: true` não gera página nem entra no sitemap/llms.txt; case com `authorized: false` também não.
- Conteúdo publicado (não rascunho) não pode conter a marca `REVISÃO`.
- Sem Mercado Livre, sem demo do agente, sem pagamento online nesta entrega.
- Layout com a estrutura do site da Cloudflare (pt-br): barra utilitária no topo, cabeçalho com mega menu, hero com título grande à esquerda e ilustração à direita, faixa de números grandes, grades de cartões com borda fina e cantos pouco arredondados (`rounded-lg`/`rounded-xl`), CTA final em 3 cartões e rodapé escuro em colunas. Não copiar textos, imagens, ícones nem a marca da Cloudflare.
- Paleta azul-petróleo, só por tokens em `app/globals.css` (nenhuma cor hex nos componentes, exceto em `lib/og.tsx`, que não lê CSS): texto `#0B1220`, texto secundário `#334155`, apoio `#64748B`, borda `#E2E8F0`, fundo de seção `#F5F7FA`, destaque `#0E7490`, destaque hover `#155E75`, destaque suave `#CFFAFE`, rodapé `#0B1220`.
- Antes de codar cada tarefa que toca APIs do Next, ler o guia correspondente em `apps/azpetshop/node_modules/next/dist/docs/01-app/` (AGENTS.md: "This is NOT the Next.js you know").
- Dependências novas passam pela quarentena de release-age do pnpm; se uma versão for recusada, usar a versão mais recente aceita e registrar no commit.

## Estrutura de arquivos

```
apps/zemann/
  package.json, tsconfig.json, next.config.mjs, postcss.config.mjs,
  vitest.config.ts, vitest.setup.ts, .gitignore, .env.example
  mdx-components.tsx            # estilos dos elementos MDX
  site.config.ts                # dados da empresa (nome, CNPJ, e-mail, preço do diagnóstico)
  types/gtag.d.ts               # tipo global window.gtag
  lib/
    pages.ts                    # título/descrição/caminho de cada página fixa (fonte única)
    format.ts                   # formatação de preço e datas
    seo.ts                      # pageMetadata()
    jsonld.ts                   # builders de JSON-LD + jsonLdScript()
    content.ts                  # leitura/validação de guias e cases
    contact.ts                  # validação, e-mail e submit do formulário
    site-index.ts               # índice do site (sitemap + llms.txt)
    og.tsx                      # renderOg() para imagens Open Graph
  app/
    layout.tsx, globals.css, page.tsx, not-found.tsx, actions.ts,
    opengraph-image.tsx, sitemap.ts, robots.ts, llms.txt/route.ts
    _components/ (site-header, site-footer, json-ld, cta-link, breadcrumbs,
                  pillars, comparison-table, offer-ladder, faq-list,
                  contact-form, google-analytics, cta-block)
    consultoria-amazon-para-marcas/, consultoria-amazon-para-sellers/,
    diagnostico-conta-amazon/, contato/, perguntas-frequentes/, sobre/,
    guias/ (page + [slug]), cases/ (page + [slug])   — cada um com opengraph-image.tsx
  content/
    guias/vendor-ou-seller-na-amazon.mdx, guias/buy-box-na-amazon.mdx
    cases/my-pet-na-amazon.mdx, cases/feiticos.mdx, cases/catalogo-hub.mdx,
    cases/hub-comercial.mdx, cases/agente-my-pet.mdx
```

Arquivos da raiz alterados: `package.json` (scripts), `apps/hub/app/page.tsx` (link).

---

### Task 1: Scaffold do app, `site.config.ts` e `lib/pages.ts`

**Files:**
- Create: `apps/zemann/package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `.gitignore`, `.env.example`, `mdx-components.tsx`, `site.config.ts`, `types/gtag.d.ts`, `lib/pages.ts`, `lib/format.ts`, `app/layout.tsx` (provisório, substituído na Task 5), `app/page.tsx` (provisório, substituído na Task 7), `app/globals.css`
- Test: `apps/zemann/lib/pages.test.ts`, `apps/zemann/lib/format.test.ts`
- Modify: `package.json` (raiz), `apps/hub/app/page.tsx`

**Interfaces:**
- Produces:
  - `siteConfig` (de `@/site.config`): `{ name: string; domain: string; url: string; tagline: string; email: string; legalName: string; cnpj: string; linkedinUrl: string | null; founder: { name: string; jobTitle: string }; diagnostic: { priceFrom: number | null; deliveryText: string } }`
  - `type PageKey = "home" | "marcas" | "sellers" | "diagnostico" | "cases" | "guias" | "faq" | "sobre" | "contato"`
  - `type PageInfo = { path: string; title: string; description: string; nav?: string }`
  - `PAGES: Record<PageKey, PageInfo>` (o campo `nav` é o rótulo curto usado no menu e no rodapé)
  - `formatPriceFrom(value: number | null): string`
  - `formatDateBR(iso: string): string` (`"2026-10-17"` → `"17 de outubro de 2026"`)

- [ ] **Step 1: Ler a documentação do Next**

Ler `apps/azpetshop/node_modules/next/dist/docs/01-app/02-guides/mdx.md` (seções "Install dependencies", "Add an mdx-components.tsx file", "Using dynamic imports", "Frontmatter", "Using Plugins with Turbopack").

- [ ] **Step 2: Criar `apps/zemann/package.json`**

```json
{
  "name": "zemann",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 4106",
    "build": "next build",
    "start": "next start -p 4106",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "16.3.8",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.3",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^5.2.0",
    "jsdom": "^25.0.1",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 3: Instalar dependências de MDX, frontmatter e e-mail**

Run (na raiz do repo):
```bash
pnpm install
pnpm --filter zemann add @next/mdx@16.3.8 @mdx-js/loader @mdx-js/react gray-matter nodemailer remark-gfm remark-frontmatter
pnpm --filter zemann add -D @types/mdx @types/nodemailer
```
Expected: instala sem erro. Se `@next/mdx@16.3.8` não existir ou for barrado pela quarentena, usar a versão `16.x` mais recente aceita.

- [ ] **Step 4: Criar os arquivos de configuração**

`apps/zemann/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["node_modules"]
}
```

`apps/zemann/next.config.mjs`:
```js
import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {};

// Plugins como string: exigência do Turbopack (ver guia MDX do Next).
// remark-frontmatter tira o bloco YAML do HTML; o frontmatter é lido à parte
// por lib/content.ts com gray-matter. remark-gfm habilita tabelas.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-frontmatter", "remark-gfm"],
  },
});

export default withMDX(nextConfig);
```

`apps/zemann/postcss.config.mjs`:
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

`apps/zemann/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL(".", import.meta.url)).replace(/[/\\]$/, "");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": appRoot },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["app/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}"],
  },
});
```

`apps/zemann/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
```

`apps/zemann/.gitignore`:
```
/.next/
/node_modules
*.tsbuildinfo
.env*.local
```

`apps/zemann/.env.example`:
```dotenv
# SMTP do formulário (mesmo provedor do site atual)
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
# Caixa que recebe os contatos
CONTACT_TO=contato@zemann.com.br
# GA4 da Zemann (vazio = sem analytics)
NEXT_PUBLIC_GA_ID=
# "1" mostra rascunhos (draft: true) no dev, para revisão
ZEMANN_SHOW_DRAFTS=
```

`apps/zemann/types/gtag.d.ts`:
```ts
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export {};
```

`apps/zemann/mdx-components.tsx`:
```tsx
import type { MDXComponents } from "mdx/types";

const components: MDXComponents = {
  h2: (props) => <h2 className="mt-12 mb-4 text-2xl font-bold text-ink" {...props} />,
  h3: (props) => <h3 className="mt-8 mb-3 text-xl font-semibold text-ink" {...props} />,
  p: (props) => <p className="my-4 leading-relaxed text-ink-soft" {...props} />,
  ul: (props) => <ul className="my-4 list-disc space-y-2 pl-6 text-ink-soft" {...props} />,
  ol: (props) => <ol className="my-4 list-decimal space-y-2 pl-6 text-ink-soft" {...props} />,
  a: (props) => <a className="font-medium text-accent underline underline-offset-2" {...props} />,
  strong: (props) => <strong className="font-semibold text-ink" {...props} />,
  table: (props) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b-2 border-line bg-surface px-3 py-2 font-semibold text-ink" {...props} />,
  td: (props) => <td className="border-b border-line px-3 py-2 align-top text-ink-soft" {...props} />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
```

`apps/zemann/app/globals.css`:
```css
@import "tailwindcss";

/* Paleta azul-petróleo (decidida em 2026-10-17). Trocar cores só aqui. */
@theme {
  --color-ink: #0b1220;
  --color-ink-soft: #334155;
  --color-muted: #64748b;
  --color-line: #e2e8f0;
  --color-surface: #f5f7fa;
  --color-accent: #0e7490;
  --color-accent-dark: #155e75;
  --color-accent-soft: #cffafe;
  --color-footer: #0b1220;
  --font-sans: var(--font-inter), system-ui, sans-serif;
}

html {
  scroll-behavior: smooth;
}

body {
  background: #ffffff;
  color: var(--color-ink);
}
```

- [ ] **Step 5: Criar `apps/zemann/site.config.ts`**

```ts
// Dados da empresa. Campos null são preenchidos quando o Fábio fornecer
// (ver seção 6 do spec); a interface e o JSON-LD omitem o que for null.
export const siteConfig = {
  name: "Zemann",
  domain: "www.zemann.com.br",
  url: "https://www.zemann.com.br",
  tagline: "Consultoria de Amazon mão na massa para marcas e sellers",
  email: "contato@zemann.com.br",
  legalName: "DPZ COMMERCE",
  cnpj: "67.145.989/0001-00",
  linkedinUrl: null as string | null,
  founder: {
    name: "Fábio Zemann",
    jobTitle: "Consultor de Amazon e AI Product Manager",
  },
  diagnostic: {
    priceFrom: null as number | null,
    deliveryText: "até 10 dias úteis",
  },
};
```

- [ ] **Step 6: Escrever os testes que falham de `lib/pages.ts` e `lib/format.ts`**

`apps/zemann/lib/pages.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { PAGES } from "./pages";

describe("PAGES", () => {
  const entries = Object.entries(PAGES);

  it("tem caminhos únicos começando com /", () => {
    const paths = entries.map(([, p]) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path.startsWith("/")).toBe(true);
  });

  it("respeita os limites de título e descrição", () => {
    for (const [key, page] of entries) {
      expect(page.description.length, key).toBeLessThanOrEqual(160);
      if (key !== "home") expect(page.title.length, key).toBeLessThanOrEqual(55);
    }
  });

  it("não insinua vínculo com a Amazon", () => {
    for (const [, page] of entries) {
      expect(`${page.title} ${page.description}`.toLowerCase()).not.toContain("parceiro oficial");
    }
  });
});
```

`apps/zemann/lib/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatDateBR, formatPriceFrom } from "./format";

describe("formatPriceFrom", () => {
  it("formata o valor em reais", () => {
    expect(formatPriceFrom(1500)).toBe("a partir de R$ 1.500");
  });

  it("sem valor definido, avisa que o valor vem no agendamento", () => {
    expect(formatPriceFrom(null)).toBe("valor informado no agendamento");
  });
});

describe("formatDateBR", () => {
  it("escreve a data por extenso", () => {
    expect(formatDateBR("2026-10-17")).toBe("17 de outubro de 2026");
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `pnpm --filter zemann test`
Expected: FAIL — `Cannot find module './pages'` e `'./format'`.

- [ ] **Step 8: Implementar `lib/pages.ts` e `lib/format.ts`**

`apps/zemann/lib/pages.ts`:
```ts
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
    title: "Zemann — Consultoria de Amazon para marcas e sellers",
    description:
      "Consultoria de Amazon mão na massa: catálogo, anúncios, Buy Box, Ads e margem por SKU, com tecnologia própria conectada à API oficial da Amazon.",
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
      "Prazos, formato, acesso à conta, vendor ou seller e o que esperar da consultoria de Amazon da Zemann.",
  },
  sobre: {
    path: "/sobre",
    title: "Sobre a Zemann e Fábio Zemann",
    description:
      "A Zemann é a consultoria de Amazon de Fábio Zemann, que opera uma marca própria na Amazon e constrói ferramentas de dados e IA para o varejo.",
    nav: "Sobre",
  },
  contato: {
    path: "/contato",
    title: "Contato",
    description:
      "Fale com a Zemann sobre implantação ou gestão contínua da sua operação na Amazon. Resposta em até 1 dia útil.",
  },
};
```

`apps/zemann/lib/format.ts`:
```ts
const brl = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatPriceFrom(value: number | null): string {
  if (value === null) return "valor informado no agendamento";
  return `a partir de R$ ${brl.format(value)}`;
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function formatDateBR(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}
```

- [ ] **Step 9: Rodar e ver passar**

Run: `pnpm --filter zemann test`
Expected: PASS (6 testes).

- [ ] **Step 10: Layout e página provisórios para o build**

`apps/zemann/app/layout.tsx`:
```tsx
import "./globals.css";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

`apps/zemann/app/page.tsx`:
```tsx
export default function HomePage() {
  return <main>Zemann</main>;
}
```

- [ ] **Step 11: Scripts na raiz e link no hub**

Em `package.json` (raiz), adicionar `"dev:zemann": "pnpm --filter zemann dev",` logo após `dev:distribuidora-instagram`; em `dev:all`, acrescentar `zemann` ao final de `-n`, `gray` ao final de `-c` e `\"pnpm --filter zemann dev\"` ao final da lista de comandos; trocar `test` por:
```json
"test": "pnpm --filter @mypet/core test && pnpm --filter azpetshop test && pnpm --filter zemann test",
```

Em `apps/hub/app/page.tsx`, acrescentar ao array `SITES`, após o item "AZ Pet Shop":
```ts
  {
    name: "Zemann",
    description: "Site da consultoria de Amazon",
    port: 4106,
  },
```

- [ ] **Step 12: Build**

Run: `pnpm --filter zemann build`
Expected: build conclui; rota `/` estática (○). Se gerar `apps/zemann/next-env.d.ts`, ele entra no commit como nos outros apps.

- [ ] **Step 13: Commit**

```bash
git add apps/zemann package.json pnpm-lock.yaml apps/hub/app/page.tsx
git commit -m "feat(zemann): scaffold do app, config da empresa e páginas fixas"
```

---

### Task 2: `lib/seo.ts` e `lib/jsonld.ts`

**Files:**
- Create: `apps/zemann/lib/seo.ts`, `apps/zemann/lib/jsonld.ts`
- Test: `apps/zemann/lib/seo.test.ts`, `apps/zemann/lib/jsonld.test.ts`

**Interfaces:**
- Consumes: `siteConfig`, `PageInfo`
- Produces:
  - `pageMetadata(input: { path: string; title: string; description: string; type?: "website" | "article"; publishedAt?: string; updatedAt?: string }): Metadata`
  - `jsonLdScript(data: unknown): string`
  - `organizationJsonLd(): Record<string, unknown>`
  - `websiteJsonLd(): Record<string, unknown>`
  - `personJsonLd(): Record<string, unknown>`
  - `serviceJsonLd(input: { name: string; description: string; path: string; priceFrom?: number | null }): Record<string, unknown>`
  - `articleJsonLd(input: { title: string; description: string; path: string; publishedAt: string; updatedAt: string }): Record<string, unknown>`
  - `faqJsonLd(items: { q: string; a: string }[]): Record<string, unknown>`
  - `breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown>`

- [ ] **Step 1: Ler a documentação**

Ler `apps/azpetshop/node_modules/next/dist/docs/01-app/02-guides/json-ld.md` e `01-app/01-getting-started/14-metadata-and-og-images.md`.

- [ ] **Step 2: Escrever os testes que falham**

`apps/zemann/lib/seo.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { pageMetadata } from "./seo";

describe("pageMetadata", () => {
  it("monta título, descrição, canonical e Open Graph", () => {
    const meta = pageMetadata({ path: "/sobre", title: "Sobre", description: "Desc" });
    expect(meta.title).toBe("Sobre");
    expect(meta.description).toBe("Desc");
    expect(meta.alternates?.canonical).toBe("/sobre");
    expect(meta.openGraph).toMatchObject({
      title: "Sobre",
      description: "Desc",
      url: "/sobre",
      siteName: "Zemann",
      locale: "pt_BR",
      type: "website",
    });
  });

  it("na home usa o título absoluto, sem o sufixo do template", () => {
    const meta = pageMetadata({ path: "/", title: "Zemann — X", description: "D" });
    expect(meta.title).toEqual({ absolute: "Zemann — X" });
  });

  it("artigo leva datas de publicação e atualização", () => {
    const meta = pageMetadata({
      path: "/guias/x",
      title: "T",
      description: "D",
      type: "article",
      publishedAt: "2026-10-01",
      updatedAt: "2026-10-10",
    });
    expect(meta.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-10-01",
      modifiedTime: "2026-10-10",
    });
  });
});
```

`apps/zemann/lib/jsonld.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  jsonLdScript,
  organizationJsonLd,
  personJsonLd,
  serviceJsonLd,
  websiteJsonLd,
} from "./jsonld";

describe("jsonLdScript", () => {
  it("escapa < para não fechar a tag script", () => {
    expect(jsonLdScript({ a: "</script>" })).toBe('{"a":"\\u003c/script>"}');
  });
});

describe("builders", () => {
  it("organization traz CNPJ, e-mail e omite sameAs sem LinkedIn", () => {
    const org = organizationJsonLd();
    expect(org).toMatchObject({
      "@type": "Organization",
      name: "Zemann",
      legalName: "DPZ COMMERCE",
      taxID: "67.145.989/0001-00",
      email: "contato@zemann.com.br",
      url: "https://www.zemann.com.br",
    });
    expect(org).not.toHaveProperty("sameAs");
  });

  it("website aponta para a organização", () => {
    expect(websiteJsonLd()).toMatchObject({
      "@type": "WebSite",
      url: "https://www.zemann.com.br",
      publisher: { "@id": "https://www.zemann.com.br/#org" },
    });
  });

  it("person trabalha na organização", () => {
    expect(personJsonLd()).toMatchObject({
      "@type": "Person",
      name: "Fábio Zemann",
      worksFor: { "@id": "https://www.zemann.com.br/#org" },
    });
  });

  it("service com preço inclui Offer com preço mínimo em BRL", () => {
    const service = serviceJsonLd({ name: "Diagnóstico", description: "D", path: "/d", priceFrom: 1500 });
    expect(service).toMatchObject({
      "@type": "Service",
      url: "https://www.zemann.com.br/d",
      areaServed: "BR",
      offers: {
        "@type": "Offer",
        priceSpecification: { "@type": "PriceSpecification", minPrice: 1500, priceCurrency: "BRL" },
      },
    });
  });

  it("service sem preço não tem offers", () => {
    expect(serviceJsonLd({ name: "S", description: "D", path: "/s", priceFrom: null })).not.toHaveProperty("offers");
  });

  it("article traz autor e datas", () => {
    expect(
      articleJsonLd({ title: "T", description: "D", path: "/guias/t", publishedAt: "2026-10-01", updatedAt: "2026-10-02" }),
    ).toMatchObject({
      "@type": "Article",
      headline: "T",
      datePublished: "2026-10-01",
      dateModified: "2026-10-02",
      author: { "@type": "Person", name: "Fábio Zemann", url: "https://www.zemann.com.br/sobre" },
      mainEntityOfPage: "https://www.zemann.com.br/guias/t",
    });
  });

  it("faq vira FAQPage com Question/Answer", () => {
    expect(faqJsonLd([{ q: "P?", a: "R." }])).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "P?", acceptedAnswer: { "@type": "Answer", text: "R." } }],
    });
  });

  it("breadcrumb numera os itens com URL absoluta", () => {
    expect(breadcrumbJsonLd([{ name: "Início", path: "/" }, { name: "Guias", path: "/guias" }])).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: "https://www.zemann.com.br/" },
        { "@type": "ListItem", position: 2, name: "Guias", item: "https://www.zemann.com.br/guias" },
      ],
    });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter zemann test`
Expected: FAIL — `Cannot find module './seo'` e `'./jsonld'`.

- [ ] **Step 4: Implementar**

`apps/zemann/lib/seo.ts`:
```ts
import type { Metadata } from "next";
import { siteConfig } from "@/site.config";

export function pageMetadata(input: {
  path: string;
  title: string;
  description: string;
  type?: "website" | "article";
  publishedAt?: string;
  updatedAt?: string;
}): Metadata {
  const type = input.type ?? "website";
  return {
    // A home já traz a marca no título; as demais recebem " | Zemann" do template do layout.
    title: input.path === "/" ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      title: input.title,
      description: input.description,
      url: input.path,
      siteName: siteConfig.name,
      locale: "pt_BR",
      type,
      ...(type === "article"
        ? { publishedTime: input.publishedAt, modifiedTime: input.updatedAt }
        : {}),
    },
  };
}
```

`apps/zemann/lib/jsonld.ts`:
```ts
import { siteConfig } from "@/site.config";

const CONTEXT = "https://schema.org";
const ORG_ID = `${siteConfig.url}/#org`;
const PERSON_ID = `${siteConfig.url}/#fabio`;

function absolute(path: string): string {
  return `${siteConfig.url}${path}`;
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "Organization",
    "@id": ORG_ID,
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    taxID: siteConfig.cnpj,
    url: siteConfig.url,
    email: siteConfig.email,
    description: siteConfig.tagline,
    founder: { "@id": PERSON_ID },
    ...(siteConfig.linkedinUrl ? { sameAs: [siteConfig.linkedinUrl] } : {}),
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: "pt-BR",
    publisher: { "@id": ORG_ID },
  };
}

export function personJsonLd(): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "Person",
    "@id": PERSON_ID,
    name: siteConfig.founder.name,
    jobTitle: siteConfig.founder.jobTitle,
    url: absolute("/sobre"),
    worksFor: { "@id": ORG_ID },
    knowsAbout: ["Amazon Vendor Central", "Amazon Seller Central", "Amazon Ads", "SP-API", "Catálogo de produtos", "Inteligência artificial"],
    ...(siteConfig.linkedinUrl ? { sameAs: [siteConfig.linkedinUrl] } : {}),
  };
}

export function serviceJsonLd(input: {
  name: string;
  description: string;
  path: string;
  priceFrom?: number | null;
}): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "Service",
    name: input.name,
    description: input.description,
    url: absolute(input.path),
    serviceType: "Consultoria de Amazon",
    areaServed: "BR",
    provider: { "@id": ORG_ID, "@type": "Organization", name: siteConfig.name },
    ...(input.priceFrom
      ? {
          offers: {
            "@type": "Offer",
            url: absolute(input.path),
            priceSpecification: {
              "@type": "PriceSpecification",
              minPrice: input.priceFrom,
              priceCurrency: "BRL",
            },
          },
        }
      : {}),
  };
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  path: string;
  publishedAt: string;
  updatedAt: string;
}): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "Article",
    headline: input.title,
    description: input.description,
    datePublished: input.publishedAt,
    dateModified: input.updatedAt,
    inLanguage: "pt-BR",
    mainEntityOfPage: absolute(input.path),
    author: {
      "@type": "Person",
      "@id": PERSON_ID,
      name: siteConfig.founder.name,
      url: absolute("/sobre"),
    },
    publisher: { "@type": "Organization", "@id": ORG_ID, name: siteConfig.name },
  };
}

export function faqJsonLd(items: { q: string; a: string }[]): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter zemann test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/zemann/lib/seo.ts apps/zemann/lib/seo.test.ts apps/zemann/lib/jsonld.ts apps/zemann/lib/jsonld.test.ts
git commit -m "feat(zemann): metadata e JSON-LD (organização, pessoa, serviço, artigo, FAQ, breadcrumb)"
```

---

### Task 3: `lib/content.ts` (guias e cases em MDX)

**Files:**
- Create: `apps/zemann/lib/content.ts`
- Test: `apps/zemann/lib/content.test.ts`

**Interfaces:**
- Produces:
  - `type FaqItem = { q: string; a: string }`
  - `type CtaTarget = "marcas" | "sellers" | "diagnostico"`
  - `type GuideMeta = { slug: string; title: string; description: string; answer: string; author: "fabio"; publishedAt: string; updatedAt: string; faq: FaqItem[]; draft: boolean; cta: CtaTarget }`
  - `type CaseMeta = GuideMeta & { client: string; problem: string; solution: string; impact: string; authorized: boolean }`
  - `class ContentError extends Error`
  - `parseGuideMeta(slug: string, data: Record<string, unknown>): GuideMeta`
  - `parseCaseMeta(slug: string, data: Record<string, unknown>): CaseMeta`
  - `GUIDES_DIR`, `CASES_DIR`: caminhos absolutos de `content/guias` e `content/cases`
  - `listGuides(opts?: { dir?: string; includeDrafts?: boolean }): GuideMeta[]` — publicados, do mais recente ao mais antigo
  - `listCases(opts?: { dir?: string; includeDrafts?: boolean }): CaseMeta[]` — publicados e autorizados
  - `getGuide(slug: string, opts?): GuideMeta | null`, `getCase(slug: string, opts?): CaseMeta | null`
  - `readRawContent(dir: string): { slug: string; body: string; data: Record<string, unknown> }[]`

- [ ] **Step 1: Escrever os testes que falham**

`apps/zemann/lib/content.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CASES_DIR,
  ContentError,
  GUIDES_DIR,
  getGuide,
  listCases,
  listGuides,
  parseCaseMeta,
  parseGuideMeta,
  readRawContent,
} from "./content";

const base = {
  title: "Título",
  description: "Descrição curta.",
  answer: "Resposta direta.",
  author: "fabio",
  publishedAt: "2026-10-01",
  updatedAt: "2026-10-05",
};

function mdx(front: Record<string, unknown>, body = "Corpo."): string {
  const yaml = Object.entries(front)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return `---\n${yaml}\n---\n\n${body}\n`;
}

describe("parseGuideMeta", () => {
  it("aceita frontmatter válido e aplica padrões", () => {
    expect(parseGuideMeta("x", base)).toEqual({
      slug: "x",
      ...base,
      faq: [],
      draft: false,
      cta: "diagnostico",
    });
  });

  it("converte Date do YAML para ISO", () => {
    const meta = parseGuideMeta("x", { ...base, publishedAt: new Date("2026-10-01T00:00:00Z") });
    expect(meta.publishedAt).toBe("2026-10-01");
  });

  it("recusa descrição acima de 160 caracteres", () => {
    expect(() => parseGuideMeta("x", { ...base, description: "a".repeat(161) })).toThrow(ContentError);
  });

  it("recusa atualização anterior à publicação", () => {
    expect(() => parseGuideMeta("x", { ...base, updatedAt: "2026-09-01" })).toThrow(/updatedAt/);
  });

  it("recusa autor desconhecido", () => {
    expect(() => parseGuideMeta("x", { ...base, author: "outro" })).toThrow(/author/);
  });

  it("recusa faq malformado", () => {
    expect(() => parseGuideMeta("x", { ...base, faq: [{ q: "P?" }] })).toThrow(/faq/);
  });

  it("recusa cta desconhecido", () => {
    expect(() => parseGuideMeta("x", { ...base, cta: "loja" })).toThrow(/cta/);
  });
});

describe("parseCaseMeta", () => {
  it("exige authorized booleano", () => {
    expect(() =>
      parseCaseMeta("c", { ...base, client: "C", problem: "P", solution: "S", impact: "I" }),
    ).toThrow(/authorized/);
  });
});

describe("listagens", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "zemann-content-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("lista só publicados, do mais recente ao mais antigo", () => {
    writeFileSync(join(dir, "antigo.mdx"), mdx({ ...base, publishedAt: "2026-09-01", updatedAt: "2026-09-01" }));
    writeFileSync(join(dir, "novo.mdx"), mdx({ ...base, publishedAt: "2026-10-10", updatedAt: "2026-10-10" }));
    writeFileSync(join(dir, "rascunho.mdx"), mdx({ ...base, draft: true }));
    expect(listGuides({ dir, includeDrafts: false }).map((g) => g.slug)).toEqual(["novo", "antigo"]);
    expect(listGuides({ dir, includeDrafts: true })).toHaveLength(3);
  });

  it("getGuide devolve null para rascunho e para slug inexistente", () => {
    writeFileSync(join(dir, "rascunho.mdx"), mdx({ ...base, draft: true }));
    expect(getGuide("rascunho", { dir, includeDrafts: false })).toBeNull();
    expect(getGuide("nao-existe", { dir, includeDrafts: false })).toBeNull();
  });

  it("case não autorizado não aparece nem com rascunhos liberados", () => {
    const caseBase = { ...base, client: "C", problem: "P", solution: "S", impact: "I" };
    writeFileSync(join(dir, "ok.mdx"), mdx({ ...caseBase, authorized: true }));
    writeFileSync(join(dir, "pendente.mdx"), mdx({ ...caseBase, authorized: false }));
    expect(listCases({ dir, includeDrafts: true }).map((c) => c.slug)).toEqual(["ok"]);
  });

  it("frontmatter inválido derruba a listagem com o nome do arquivo", () => {
    writeFileSync(join(dir, "quebrado.mdx"), mdx({ ...base, author: "outro" }));
    expect(() => listGuides({ dir, includeDrafts: false })).toThrow(/quebrado/);
  });
});

describe("conteúdo real do repositório", () => {
  it("todos os guias e cases têm frontmatter válido", () => {
    expect(() => listGuides({ includeDrafts: true })).not.toThrow();
    expect(() => listCases({ includeDrafts: true })).not.toThrow();
  });

  it("nada publicado contém a marca REVISÃO", () => {
    const published = [
      ...readRawContent(GUIDES_DIR).filter((f) => f.data.draft !== true),
      ...readRawContent(CASES_DIR).filter((f) => f.data.draft !== true && f.data.authorized === true),
    ];
    for (const file of published) {
      expect(`${JSON.stringify(file.data)}\n${file.body}`, file.slug).not.toContain("REVISÃO");
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter zemann test`
Expected: FAIL — `Cannot find module './content'`.

- [ ] **Step 3: Implementar `lib/content.ts`**

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

export type FaqItem = { q: string; a: string };
export type CtaTarget = "marcas" | "sellers" | "diagnostico";

export type GuideMeta = {
  slug: string;
  title: string;
  description: string;
  answer: string;
  author: "fabio";
  publishedAt: string;
  updatedAt: string;
  faq: FaqItem[];
  draft: boolean;
  cta: CtaTarget;
};

export type CaseMeta = GuideMeta & {
  client: string;
  problem: string;
  solution: string;
  impact: string;
  authorized: boolean;
};

export class ContentError extends Error {
  constructor(slug: string, field: string, detail: string) {
    super(`[conteúdo] ${slug}: campo "${field}" ${detail}`);
    this.name = "ContentError";
  }
}

// O build roda com cwd = apps/zemann (Vercel com root no app e pnpm --filter).
export const GUIDES_DIR = join(process.cwd(), "content", "guias");
export const CASES_DIR = join(process.cwd(), "content", "cases");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CTA_TARGETS: CtaTarget[] = ["marcas", "sellers", "diagnostico"];

function text(slug: string, data: Record<string, unknown>, field: string): string {
  const value = data[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ContentError(slug, field, "é obrigatório e deve ser texto");
  }
  return value.trim();
}

// gray-matter converte datas YAML sem aspas em Date; normaliza para yyyy-mm-dd.
function isoDate(slug: string, data: Record<string, unknown>, field: string): string {
  const value = data[field];
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (typeof iso !== "string" || !ISO_DATE.test(iso)) {
    throw new ContentError(slug, field, "deve ser uma data yyyy-mm-dd");
  }
  return iso;
}

function faq(slug: string, data: Record<string, unknown>): FaqItem[] {
  const value = data.faq;
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ContentError(slug, "faq", "deve ser uma lista");
  return value.map((item) => {
    const ok =
      typeof item === "object" &&
      item !== null &&
      typeof (item as FaqItem).q === "string" &&
      typeof (item as FaqItem).a === "string" &&
      (item as FaqItem).q.trim() !== "" &&
      (item as FaqItem).a.trim() !== "";
    if (!ok) throw new ContentError(slug, "faq", "precisa de q e a preenchidos em cada item");
    return { q: (item as FaqItem).q.trim(), a: (item as FaqItem).a.trim() };
  });
}

export function parseGuideMeta(slug: string, data: Record<string, unknown>): GuideMeta {
  const description = text(slug, data, "description");
  if (description.length > 160) {
    throw new ContentError(slug, "description", `tem ${description.length} caracteres (máximo 160)`);
  }
  if (data.author !== "fabio") throw new ContentError(slug, "author", 'deve ser "fabio"');
  const publishedAt = isoDate(slug, data, "publishedAt");
  const updatedAt = isoDate(slug, data, "updatedAt");
  if (updatedAt < publishedAt) {
    throw new ContentError(slug, "updatedAt", "não pode ser anterior a publishedAt");
  }
  const cta = data.cta ?? "diagnostico";
  if (!CTA_TARGETS.includes(cta as CtaTarget)) {
    throw new ContentError(slug, "cta", `deve ser um de ${CTA_TARGETS.join(", ")}`);
  }
  if (data.draft !== undefined && typeof data.draft !== "boolean") {
    throw new ContentError(slug, "draft", "deve ser true ou false");
  }
  return {
    slug,
    title: text(slug, data, "title"),
    description,
    answer: text(slug, data, "answer"),
    author: "fabio",
    publishedAt,
    updatedAt,
    faq: faq(slug, data),
    draft: data.draft === true,
    cta: cta as CtaTarget,
  };
}

export function parseCaseMeta(slug: string, data: Record<string, unknown>): CaseMeta {
  if (typeof data.authorized !== "boolean") {
    throw new ContentError(slug, "authorized", "é obrigatório (true ou false)");
  }
  return {
    ...parseGuideMeta(slug, data),
    client: text(slug, data, "client"),
    problem: text(slug, data, "problem"),
    solution: text(slug, data, "solution"),
    impact: text(slug, data, "impact"),
    authorized: data.authorized,
  };
}

export function readRawContent(dir: string): { slug: string; body: string; data: Record<string, unknown> }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mdx"))
    .map((name) => {
      const parsed = matter(readFileSync(join(dir, name), "utf8"));
      return { slug: name.replace(/\.mdx$/, ""), body: parsed.content, data: parsed.data };
    });
}

type ListOptions = { dir?: string; includeDrafts?: boolean };

function showDrafts(opts?: ListOptions): boolean {
  return opts?.includeDrafts ?? process.env.ZEMANN_SHOW_DRAFTS === "1";
}

function byNewest<T extends GuideMeta>(a: T, b: T): number {
  return b.publishedAt.localeCompare(a.publishedAt);
}

export function listGuides(opts?: ListOptions): GuideMeta[] {
  return readRawContent(opts?.dir ?? GUIDES_DIR)
    .map((file) => parseGuideMeta(file.slug, file.data))
    .filter((guide) => showDrafts(opts) || !guide.draft)
    .sort(byNewest);
}

export function listCases(opts?: ListOptions): CaseMeta[] {
  return readRawContent(opts?.dir ?? CASES_DIR)
    .map((file) => parseCaseMeta(file.slug, file.data))
    .filter((item) => item.authorized && (showDrafts(opts) || !item.draft))
    .sort(byNewest);
}

export function getGuide(slug: string, opts?: ListOptions): GuideMeta | null {
  return listGuides(opts).find((guide) => guide.slug === slug) ?? null;
}

export function getCase(slug: string, opts?: ListOptions): CaseMeta | null {
  return listCases(opts).find((item) => item.slug === slug) ?? null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter zemann test`
Expected: PASS. Os testes de "conteúdo real" passam com as pastas ainda inexistentes (`readRawContent` devolve `[]`).

- [ ] **Step 5: Commit**

```bash
git add apps/zemann/lib/content.ts apps/zemann/lib/content.test.ts
git commit -m "feat(zemann): leitura e validação de guias e cases em MDX"
```

---

### Task 4: Formulário — `lib/contact.ts` e `app/actions.ts`

**Files:**
- Create: `apps/zemann/lib/contact.ts`, `apps/zemann/app/actions.ts`
- Test: `apps/zemann/lib/contact.test.ts`

**Interfaces:**
- Consumes: `siteConfig.email`
- Produces:
  - `type ContactField = "nome" | "email" | "empresa" | "perfil" | "loja" | "desafio"`
  - `type ContactFormKind = "diagnostico" | "contato"`
  - `type ContactInput = { form: ContactFormKind; nome: string; email: string; empresa: string; perfil: "marca" | "seller"; loja: string; desafio: string }`
  - `type ContactState = { status: "idle" | "success" | "error"; message: string; errors: Partial<Record<ContactField, string>>; values: Partial<Record<ContactField, string>>; attempt: number }`
  - `INITIAL_CONTACT_STATE: ContactState`
  - `validateContact(formData: FormData): { ok: true; data: ContactInput; values: ... } | { ok: false; errors: ...; values: ... }`
  - `type OutgoingMail = { subject: string; text: string; replyTo: string }`
  - `formatContactEmail(data: ContactInput): OutgoingMail`
  - `createSubmitContact(send: (mail: OutgoingMail) => Promise<void>): (prev: ContactState, formData: FormData) => Promise<ContactState>`
  - `submitContact(prev: ContactState, formData: FormData): Promise<ContactState>` (Server Action em `@/app/actions`)

- [ ] **Step 1: Ler a documentação**

Ler `apps/azpetshop/node_modules/next/dist/docs/01-app/02-guides/forms.md` (Server Functions, `useActionState`, pending).

- [ ] **Step 2: Escrever os testes que falham**

`apps/zemann/lib/contact.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import {
  INITIAL_CONTACT_STATE,
  createSubmitContact,
  formatContactEmail,
  validateContact,
} from "./contact";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const valid = {
  form: "diagnostico",
  nome: "Ana",
  email: "ana@marca.com.br",
  empresa: "Marca X",
  perfil: "marca",
  loja: "",
  desafio: "Nossos anúncios estão com pendência e não vendem.",
};

describe("validateContact", () => {
  it("aceita dados válidos", () => {
    const result = validateContact(form(valid));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ form: "diagnostico", perfil: "marca", empresa: "Marca X" });
  });

  it("exige o desafio", () => {
    const result = validateContact(form({ ...valid, desafio: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.desafio).toBe("Conte em poucas palavras o seu desafio.");
  });

  it("recusa e-mail inválido e perfil desconhecido", () => {
    const result = validateContact(form({ ...valid, email: "ana", perfil: "outro" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.email).toBeDefined();
      expect(result.errors.perfil).toBeDefined();
    }
  });

  it("devolve os valores digitados para não perder o que foi preenchido", () => {
    const result = validateContact(form({ ...valid, nome: "" }));
    expect(result.values.empresa).toBe("Marca X");
  });

  it("formulário desconhecido vira contato", () => {
    const result = validateContact(form({ ...valid, form: "x" }));
    expect(result.ok && result.data.form).toBe("contato");
  });
});

describe("formatContactEmail", () => {
  it("monta assunto pelo tipo de formulário e responde para o lead", () => {
    const result = validateContact(form(valid));
    if (!result.ok) throw new Error("inválido");
    const mail = formatContactEmail(result.data);
    expect(mail.subject).toBe("[Site] Diagnóstico da conta — Marca X");
    expect(mail.replyTo).toBe("ana@marca.com.br");
    expect(mail.text).toContain("Desafio:");
  });
});

describe("createSubmitContact", () => {
  it("envia e devolve sucesso", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const state = await createSubmitContact(send)(INITIAL_CONTACT_STATE, form(valid));
    expect(send).toHaveBeenCalledOnce();
    expect(state.status).toBe("success");
    expect(state.attempt).toBe(1);
  });

  it("não envia quando a validação falha", async () => {
    const send = vi.fn();
    const state = await createSubmitContact(send)(INITIAL_CONTACT_STATE, form({ ...valid, desafio: "" }));
    expect(send).not.toHaveBeenCalled();
    expect(state.status).toBe("error");
    expect(state.errors.desafio).toBeDefined();
  });

  it("falha no SMTP vira erro visível e mantém os dados", async () => {
    const send = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await createSubmitContact(send)(INITIAL_CONTACT_STATE, form(valid));
    expect(state.status).toBe("error");
    expect(state.message).toContain("contato@zemann.com.br");
    expect(state.values.empresa).toBe("Marca X");
  });

  it("honeypot preenchido finge sucesso sem enviar", async () => {
    const send = vi.fn();
    const state = await createSubmitContact(send)(INITIAL_CONTACT_STATE, form({ ...valid, website: "spam.com" }));
    expect(send).not.toHaveBeenCalled();
    expect(state.status).toBe("success");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter zemann test`
Expected: FAIL — `Cannot find module './contact'`.

- [ ] **Step 4: Implementar `lib/contact.ts`**

```ts
import { siteConfig } from "@/site.config";

export type ContactField = "nome" | "email" | "empresa" | "perfil" | "loja" | "desafio";
export type ContactFormKind = "diagnostico" | "contato";

export type ContactInput = {
  form: ContactFormKind;
  nome: string;
  email: string;
  empresa: string;
  perfil: "marca" | "seller";
  loja: string;
  desafio: string;
};

type Values = Partial<Record<ContactField, string>>;
type Errors = Partial<Record<ContactField, string>>;

export type ContactState = {
  status: "idle" | "success" | "error";
  message: string;
  errors: Errors;
  values: Values;
  // Muda a cada envio; o formulário usa como key para remontar com os valores devolvidos.
  attempt: number;
};

export const INITIAL_CONTACT_STATE: ContactState = {
  status: "idle",
  message: "",
  errors: {},
  values: {},
  attempt: 0,
};

const FIELDS: ContactField[] = ["nome", "email", "empresa", "perfil", "loja", "desafio"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUCCESS_MESSAGE = "Recebemos sua mensagem. Respondemos em até 1 dia útil.";

export function validateContact(
  formData: FormData,
): { ok: true; data: ContactInput; values: Values } | { ok: false; errors: Errors; values: Values } {
  const values: Values = {};
  for (const field of FIELDS) values[field] = String(formData.get(field) ?? "").trim();

  const errors: Errors = {};
  if (!values.nome) errors.nome = "Informe seu nome.";
  if (!values.email || !EMAIL.test(values.email)) errors.email = "Informe um e-mail válido.";
  if (!values.empresa) errors.empresa = "Informe a empresa ou marca.";
  if (values.perfil !== "marca" && values.perfil !== "seller") errors.perfil = "Escolha o seu perfil.";
  if (!values.desafio) errors.desafio = "Conte em poucas palavras o seu desafio.";
  else if (values.desafio.length > 2000) errors.desafio = "Use no máximo 2.000 caracteres.";
  if ((values.loja ?? "").length > 500) errors.loja = "Link muito longo.";

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };

  const kind = String(formData.get("form") ?? "");
  return {
    ok: true,
    values,
    data: {
      form: kind === "diagnostico" ? "diagnostico" : "contato",
      nome: values.nome!,
      email: values.email!,
      empresa: values.empresa!,
      perfil: values.perfil as "marca" | "seller",
      loja: values.loja ?? "",
      desafio: values.desafio!,
    },
  };
}

export type OutgoingMail = { subject: string; text: string; replyTo: string };

export function formatContactEmail(data: ContactInput): OutgoingMail {
  const label = data.form === "diagnostico" ? "Diagnóstico da conta" : "Contato";
  return {
    subject: `[Site] ${label} — ${data.empresa}`,
    replyTo: data.email,
    text: [
      `Formulário: ${label}`,
      `Nome: ${data.nome}`,
      `E-mail: ${data.email}`,
      `Empresa: ${data.empresa}`,
      `Perfil: ${data.perfil === "marca" ? "Marca/indústria" : "Seller"}`,
      `Loja/produto na Amazon: ${data.loja || "não informado"}`,
      "",
      "Desafio:",
      data.desafio,
    ].join("\n"),
  };
}

export function createSubmitContact(send: (mail: OutgoingMail) => Promise<void>) {
  return async function submit(prev: ContactState, formData: FormData): Promise<ContactState> {
    const attempt = prev.attempt + 1;

    // Honeypot: robôs preenchem o campo escondido; finge sucesso sem enviar.
    if (String(formData.get("website") ?? "").trim() !== "") {
      return { ...INITIAL_CONTACT_STATE, status: "success", message: SUCCESS_MESSAGE, attempt };
    }

    const result = validateContact(formData);
    if (!result.ok) {
      return {
        status: "error",
        message: "Confira os campos destacados.",
        errors: result.errors,
        values: result.values,
        attempt,
      };
    }

    try {
      await send(formatContactEmail(result.data));
    } catch (error) {
      console.error("[contato] falha ao enviar e-mail:", error instanceof Error ? error.message : error);
      return {
        status: "error",
        message: `Não foi possível enviar agora. Tente de novo em instantes ou escreva para ${siteConfig.email}.`,
        errors: {},
        values: result.values,
        attempt,
      };
    }

    return { status: "success", message: SUCCESS_MESSAGE, errors: {}, values: {}, attempt };
  };
}
```

- [ ] **Step 5: Implementar a Server Action `app/actions.ts`**

```ts
"use server";

import nodemailer from "nodemailer";
import { createSubmitContact, type ContactState, type OutgoingMail } from "@/lib/contact";

async function sendWithSmtp(mail: OutgoingMail): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !CONTACT_TO) {
    throw new Error("SMTP não configurado (SMTP_HOST, SMTP_USER, SMTP_PASS, CONTACT_TO)");
  }
  const port = Number(SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transport.sendMail({
    from: `"Site Zemann" <${SMTP_USER}>`,
    to: CONTACT_TO,
    replyTo: mail.replyTo,
    subject: mail.subject,
    text: mail.text,
  });
}

const submit = createSubmitContact(sendWithSmtp);

export async function submitContact(prev: ContactState, formData: FormData): Promise<ContactState> {
  return submit(prev, formData);
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm --filter zemann test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/zemann/lib/contact.ts apps/zemann/lib/contact.test.ts apps/zemann/app/actions.ts
git commit -m "feat(zemann): validação e envio por SMTP do formulário de contato"
```

---

### Task 5: Layout global — cabeçalho, rodapé, JSON-LD global e GA4

**Files:**
- Create: `apps/zemann/app/_components/json-ld.tsx`, `cta-link.tsx`, `site-header.tsx`, `site-footer.tsx`, `google-analytics.tsx`, `apps/zemann/app/not-found.tsx`
- Modify: `apps/zemann/app/layout.tsx` (substitui o provisório), `apps/zemann/lib/pages.ts` (acrescenta `MENU_GROUPS`)
- Test: `apps/zemann/app/_components/site-footer.test.tsx`

**Interfaces:**
- Consumes: `siteConfig`, `PAGES`, `jsonLdScript`, `organizationJsonLd`, `websiteJsonLd`
- Produces:
  - `<JsonLd data={object | object[]} />`
  - `<CtaLink href cta variant? className? children />` — link com `data-cta={cta}`; `variant: "primary" | "secondary"` (padrão `primary`)
  - `<SiteHeader />`, `<SiteFooter />`, `<GoogleAnalytics />`
  - Em `lib/pages.ts`: `type MenuGroup = { label: string; items: { page: PageInfo; hint: string }[] }` e `MENU_GROUPS: MenuGroup[]` (Soluções, Recursos, Empresa)

- [ ] **Step 1: Escrever o teste que falha**

`apps/zemann/app/_components/site-footer.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("mostra razão social, CNPJ, e-mail e o aviso de marca da Amazon", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/DPZ COMMERCE/)).toBeInTheDocument();
    expect(screen.getByText(/67\.145\.989\/0001-00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "contato@zemann.com.br" })).toHaveAttribute(
      "href",
      "mailto:contato@zemann.com.br",
    );
    expect(screen.getByText(/A Zemann não é afiliada à Amazon/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter zemann test`
Expected: FAIL — `Cannot find module './site-footer'`.

- [ ] **Step 3: Implementar os componentes**

`apps/zemann/app/_components/json-ld.tsx`:
```tsx
import { jsonLdScript } from "@/lib/jsonld";

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}
```

`apps/zemann/app/_components/cta-link.tsx`:
```tsx
import Link from "next/link";

const VARIANTS = {
  primary: "bg-accent text-white hover:bg-accent-dark",
  secondary: "border border-line bg-white text-ink hover:border-accent hover:text-accent",
};

export function CtaLink({
  href,
  cta,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  cta: string;
  variant?: keyof typeof VARIANTS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-cta={cta}
      className={`inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
```

`apps/zemann/lib/pages.ts` — acrescentar ao final (grupos do mega menu e do rodapé, no estilo Cloudflare):
```ts
export type MenuGroup = { label: string; items: { page: PageInfo; hint: string }[] };

export const MENU_GROUPS: MenuGroup[] = [
  {
    label: "Soluções",
    items: [
      { page: PAGES.marcas, hint: "Entrar e crescer na Amazon como vendor ou seller" },
      { page: PAGES.sellers, hint: "Buy Box, pendências, Ads e margem por SKU" },
      { page: PAGES.diagnostico, hint: "Auditoria da conta com plano de ação" },
    ],
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
      { page: PAGES.sobre, hint: "Quem está por trás da Zemann" },
      { page: PAGES.contato, hint: "Implantação e gestão contínua" },
    ],
  },
];
```

`apps/zemann/app/_components/site-header.tsx`:
```tsx
import Link from "next/link";
import { MENU_GROUPS, PAGES } from "@/lib/pages";
import { siteConfig } from "@/site.config";
import { CtaLink } from "./cta-link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-white">
      {/* Barra utilitária, como no topo do site da Cloudflare. */}
      <div className="hidden border-b border-line bg-surface md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-6 px-4 py-1.5 text-xs text-ink-soft">
          <a href={`mailto:${siteConfig.email}`} className="hover:text-accent">{siteConfig.email}</a>
          <Link href={PAGES.contato.path} className="hover:text-accent">Fale com um especialista</Link>
        </div>
      </div>

      <div className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-ink">
            Zemann
          </Link>

          {/* Mega menu: abre no hover e no foco do teclado (focus-within), sem JavaScript. */}
          <nav aria-label="Principal" className="hidden flex-1 items-center gap-1 lg:flex">
            {MENU_GROUPS.map((group) => (
              <div key={group.label} className="group relative">
                <button type="button" className="rounded-md px-3 py-2 text-sm font-semibold text-ink hover:text-accent">
                  {group.label} <span aria-hidden>▾</span>
                </button>
                <div className="invisible absolute left-0 top-full w-80 rounded-lg border border-line bg-white p-2 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  {group.items.map(({ page, hint }) => (
                    <Link key={page.path} href={page.path} className="block rounded-md px-3 py-2 hover:bg-surface">
                      <span className="block text-sm font-semibold text-ink">{page.nav ?? page.title}</span>
                      <span className="block text-xs text-muted">{hint}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <CtaLink href={PAGES.contato.path} cta="header_contato" variant="secondary">Falar com especialista</CtaLink>
            <CtaLink href={PAGES.diagnostico.path} cta="header_diagnostico">Agendar diagnóstico</CtaLink>
          </div>

          {/* Menu mobile sem JavaScript: <details> abre e fecha nativamente. */}
          <details className="relative lg:hidden">
            <summary className="cursor-pointer list-none rounded-md border border-line px-3 py-2 text-sm font-semibold">
              Menu
            </summary>
            <nav aria-label="Principal (celular)" className="absolute right-0 mt-2 w-72 rounded-lg border border-line bg-white p-3 shadow-xl">
              {MENU_GROUPS.map((group) => (
                <div key={group.label} className="py-2">
                  <p className="px-3 text-xs font-bold uppercase tracking-wide text-muted">{group.label}</p>
                  {group.items.map(({ page }) => (
                    <Link key={page.path} href={page.path} className="block rounded-md px-3 py-2 text-sm text-ink hover:bg-surface">
                      {page.nav ?? page.title}
                    </Link>
                  ))}
                </div>
              ))}
              <CtaLink href={PAGES.diagnostico.path} cta="menu_diagnostico" className="mt-2 w-full">
                Agendar diagnóstico
              </CtaLink>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
```

`apps/zemann/app/_components/site-footer.tsx` (rodapé escuro em colunas, no estilo Cloudflare):
```tsx
import Link from "next/link";
import { MENU_GROUPS } from "@/lib/pages";
import { siteConfig } from "@/site.config";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-footer text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold">Zemann</p>
          <p className="mt-2 text-sm text-white/70">{siteConfig.tagline}.</p>
          <p className="mt-4 text-sm">
            <a href={`mailto:${siteConfig.email}`} className="font-medium text-accent-soft hover:underline">
              {siteConfig.email}
            </a>
          </p>
        </div>
        {MENU_GROUPS.map((group) => (
          <nav key={group.label} aria-label={`Rodapé — ${group.label}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-white/50">{group.label}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {group.items.map(({ page }) => (
                <li key={page.path}>
                  <Link href={page.path} className="text-white/80 hover:text-white">
                    {page.nav ?? page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl space-y-1 px-4 py-6 text-xs leading-relaxed text-white/60">
          <p>
            {siteConfig.legalName} · CNPJ {siteConfig.cnpj}
          </p>
          <p>Amazon é marca registrada da Amazon.com, Inc. ou de suas afiliadas. A Zemann não é afiliada à Amazon.</p>
          <p>© {year} Zemann. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
```

`apps/zemann/app/_components/google-analytics.tsx`:
```tsx
import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// Só em produção: `next dev` e previews da Vercel não entram nos relatórios.
const enabled = Boolean(GA_ID) && process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";

export function GoogleAnalytics() {
  if (!enabled) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}');

          // Todo link com data-cta vira o evento click_cta (nome do CTA no parâmetro cta).
          document.addEventListener('click', function (e) {
            var el = e.target && e.target.closest ? e.target.closest('[data-cta]') : null;
            if (el) gtag('event', 'click_cta', { cta: el.getAttribute('data-cta') });
          });
        `}
      </Script>
    </>
  );
}
```

`apps/zemann/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { siteConfig } from "@/site.config";
import { organizationJsonLd, websiteJsonLd } from "@/lib/jsonld";
import { JsonLd } from "./_components/json-ld";
import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";
import { GoogleAnalytics } from "./_components/google-analytics";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: "%s | Zemann" },
  description: siteConfig.tagline,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} antialiased`}>
      <body className="flex min-h-screen flex-col font-sans">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
```

`apps/zemann/app/not-found.tsx`:
```tsx
import { CtaLink } from "./_components/cta-link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Página não encontrada</h1>
      <p className="mt-4 text-ink-soft">O endereço pode ter mudado. Comece pela página inicial ou pelos guias.</p>
      <div className="mt-8 flex justify-center gap-3">
        <CtaLink href="/" cta="404_home">Página inicial</CtaLink>
        <CtaLink href="/guias" cta="404_guias" variant="secondary">Guias</CtaLink>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter zemann test`
Expected: PASS.

- [ ] **Step 5: Build**

Run: `pnpm --filter zemann build`
Expected: conclui sem erro.

- [ ] **Step 6: Commit**

```bash
git add apps/zemann/app apps/zemann/lib/pages.ts
git commit -m "feat(zemann): layout com barra utilitária, mega menu, rodapé em colunas, JSON-LD global e GA4"
```

---

### Task 6: Blocos compartilhados (pilares, comparativo, escada de oferta, FAQ, breadcrumbs, CTA, formulário)

**Files:**
- Create: `apps/zemann/app/_components/pillars.tsx`, `comparison-table.tsx`, `offer-ladder.tsx`, `faq-list.tsx`, `breadcrumbs.tsx`, `cta-block.tsx`, `contact-form.tsx`
- Test: `apps/zemann/app/_components/blocks.test.tsx`, `apps/zemann/app/_components/contact-form.test.tsx`

**Interfaces:**
- Consumes: `CtaLink`, `JsonLd`, `breadcrumbJsonLd`, `faqJsonLd`, `formatPriceFrom`, `siteConfig`, `PAGES`, `submitContact`, `INITIAL_CONTACT_STATE`, `ContactFormKind`, `FaqItem`
- Produces:
  - `<Pillars />`, `<ComparisonTable />`, `<OfferLadder />`
  - `<FaqList items={FaqItem[]} headingLevel={2 | 3} withJsonLd? />`
  - `<Breadcrumbs items={{ name: string; path: string }[]} />` (renderiza também o JSON-LD)
  - `<CtaBlock title text href cta label />`
  - `<ContactForm form={ContactFormKind} submitLabel={string} />` (Client Component)

- [ ] **Step 1: Escrever os testes que falham**

`apps/zemann/app/_components/blocks.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparisonTable } from "./comparison-table";
import { FaqList } from "./faq-list";
import { OfferLadder } from "./offer-ladder";
import { Pillars } from "./pillars";

describe("blocos", () => {
  it("comparativo é uma tabela real com cabeçalho das três opções", () => {
    render(<ComparisonTable />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    for (const name of ["Zemann", "Agência", "Curso ou mentoria"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
  });

  it("pilares não insinuam vínculo com a Amazon", () => {
    const { container } = render(<Pillars />);
    expect(container.textContent?.toLowerCase()).not.toContain("parceiro oficial");
    expect(container.textContent).toContain("API oficial da Amazon");
  });

  it("escada mostra os três degraus e o preço do diagnóstico", () => {
    render(<OfferLadder />);
    expect(screen.getByRole("heading", { name: "Diagnóstico da conta" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Implantação" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gestão contínua" })).toBeInTheDocument();
    expect(screen.getByText(/valor informado no agendamento/)).toBeInTheDocument();
  });

  it("FAQ usa o nível de título pedido", () => {
    render(<FaqList items={[{ q: "Pergunta?", a: "Resposta." }]} headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2, name: "Pergunta?" })).toBeInTheDocument();
    expect(screen.getByText("Resposta.")).toBeInTheDocument();
  });
});
```

`apps/zemann/app/_components/contact-form.test.tsx`:
```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/actions", () => ({ submitContact: vi.fn() }));

import { ContactForm } from "./contact-form";

describe("ContactForm", () => {
  it("marca o desafio como obrigatório, visual e semanticamente", () => {
    render(<ContactForm form="diagnostico" submitLabel="Solicitar diagnóstico" />);
    const desafio = screen.getByLabelText(/Seu desafio/);
    expect(desafio).toBeRequired();
    expect(screen.getByText("Seu desafio *")).toBeInTheDocument();
  });

  it("envia o tipo de formulário e esconde o honeypot", () => {
    const { container } = render(<ContactForm form="contato" submitLabel="Enviar" />);
    expect(container.querySelector('input[name="form"]')).toHaveValue("contato");
    expect(container.querySelector('input[name="website"]')).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter zemann test`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar os blocos**

`apps/zemann/app/_components/pillars.tsx`:
```tsx
const PILLARS = [
  {
    title: "Operador, não teórico",
    text: "Vendemos nossa própria marca na Amazon todos os dias. O que recomendamos já foi testado na nossa operação.",
  },
  {
    title: "Tecnologia própria conectada à API oficial da Amazon",
    text: "Cadastro, correção e publicação de anúncios em escala pela SP-API, sem planilha manual e sem retrabalho.",
  },
  {
    title: "Margem, não só faturamento",
    text: "Cada SKU com lucro estimado no preço atual e lucro real do período, já descontadas as tarifas da Amazon.",
  },
  {
    title: "Nada vai ao ar sem a sua aprovação",
    text: "A Amazon valida a prévia, você aprova, e só então publicamos. Toda alteração fica registrada.",
  },
];

export function Pillars() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {PILLARS.map((pillar) => (
        <div key={pillar.title} className="rounded-lg border border-line p-6">
          <h3 className="text-lg font-semibold text-ink">{pillar.title}</h3>
          <p className="mt-2 leading-relaxed text-ink-soft">{pillar.text}</p>
        </div>
      ))}
    </div>
  );
}
```

`apps/zemann/app/_components/comparison-table.tsx`:
```tsx
const ROWS: [string, string, string, string][] = [
  ["Executa junto com o seu time", "Sim", "Às vezes", "Não"],
  ["Ferramentas conectadas à API da Amazon", "Sim, próprias", "Raramente", "Não"],
  ["Margem por SKU, com tarifas reais", "Sim", "Raramente", "Não"],
  ["Atende vendor e seller", "Sim", "Depende", "Em geral só seller"],
  ["Prévia validada e aprovação antes de publicar", "Sim", "Depende", "Não se aplica"],
  ["Opera a própria marca na Amazon", "Sim", "Raramente", "Raramente"],
];

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Comparativo entre Zemann, agência e curso ou mentoria</caption>
        <thead>
          <tr>
            <th scope="col" className="border-b-2 border-line px-3 py-3 font-semibold">Critério</th>
            <th scope="col" className="border-b-2 border-accent bg-accent-soft px-3 py-3 font-semibold">Zemann</th>
            <th scope="col" className="border-b-2 border-line px-3 py-3 font-semibold">Agência</th>
            <th scope="col" className="border-b-2 border-line px-3 py-3 font-semibold">Curso ou mentoria</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([criterion, zemann, agency, course]) => (
            <tr key={criterion}>
              <th scope="row" className="border-b border-line px-3 py-3 font-medium text-ink">{criterion}</th>
              <td className="border-b border-line bg-accent-soft/40 px-3 py-3 font-semibold text-accent-dark">{zemann}</td>
              <td className="border-b border-line px-3 py-3 text-ink-soft">{agency}</td>
              <td className="border-b border-line px-3 py-3 text-ink-soft">{course}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`apps/zemann/app/_components/offer-ladder.tsx`:
```tsx
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
```

`apps/zemann/app/_components/faq-list.tsx`:
```tsx
import type { FaqItem } from "@/lib/content";
import { faqJsonLd } from "@/lib/jsonld";
import { JsonLd } from "./json-ld";

export function FaqList({
  items,
  headingLevel,
  withJsonLd = false,
}: {
  items: FaqItem[];
  headingLevel: 2 | 3;
  withJsonLd?: boolean;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="divide-y divide-line">
      {withJsonLd && items.length > 0 ? <JsonLd data={faqJsonLd(items)} /> : null}
      {items.map((item) => (
        <div key={item.q} className="py-6">
          <Heading className="text-lg font-semibold text-ink">{item.q}</Heading>
          <p className="mt-2 leading-relaxed text-ink-soft">{item.a}</p>
        </div>
      ))}
    </div>
  );
}
```

`apps/zemann/app/_components/breadcrumbs.tsx`:
```tsx
import Link from "next/link";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "./json-ld";

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Você está em" className="text-sm text-muted">
      <JsonLd data={breadcrumbJsonLd(items)} />
      <ol className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <li key={item.path} className="flex gap-2">
            {index > 0 ? <span aria-hidden>/</span> : null}
            {index === items.length - 1 ? (
              <span aria-current="page">{item.name}</span>
            ) : (
              <Link href={item.path} className="hover:text-accent">{item.name}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

`apps/zemann/app/_components/cta-block.tsx`:
```tsx
import { CtaLink } from "./cta-link";

export function CtaBlock({
  title,
  text,
  href,
  cta,
  label,
}: {
  title: string;
  text: string;
  href: string;
  cta: string;
  label: string;
}) {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-4">
      <div className="rounded-xl bg-ink px-8 py-12 text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-white/80">{text}</p>
        <CtaLink href={href} cta={cta} className="mt-6">{label}</CtaLink>
      </div>
    </section>
  );
}
```

`apps/zemann/app/_components/contact-form.tsx`:
```tsx
"use client";

import { useActionState, useEffect } from "react";
import { submitContact } from "@/app/actions";
import { INITIAL_CONTACT_STATE, type ContactField, type ContactFormKind } from "@/lib/contact";

const INPUT = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-ink focus:border-accent focus:outline-none";

function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1 text-sm text-red-700">{message}</p>;
}

export function ContactForm({ form, submitLabel }: { form: ContactFormKind; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(submitContact, INITIAL_CONTACT_STATE);

  useEffect(() => {
    if (state.status === "success" && state.attempt > 0) {
      window.gtag?.("event", "generate_lead", { form });
    }
  }, [state.status, state.attempt, form]);

  if (state.status === "success") {
    return (
      <div role="status" className="rounded-lg border border-accent bg-accent-soft p-6 text-accent-dark">
        {state.message}
      </div>
    );
  }

  const v = (field: ContactField) => state.values[field] ?? "";
  const err = (field: ContactField) => state.errors[field];
  const described = (field: ContactField) => (err(field) ? `${field}-erro` : undefined);

  return (
    // key: remonta a cada envio para os campos voltarem com os valores devolvidos pela action.
    <form key={state.attempt} action={formAction} noValidate className="grid gap-4">
      <input type="hidden" name="form" value={form} />
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Não preencha
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="block text-sm font-medium text-ink">
        Nome *
        <input name="nome" required defaultValue={v("nome")} aria-invalid={Boolean(err("nome"))} aria-describedby={described("nome")} className={INPUT} />
        <FieldError id="nome-erro" message={err("nome")} />
      </label>

      <label className="block text-sm font-medium text-ink">
        E-mail *
        <input name="email" type="email" required defaultValue={v("email")} aria-invalid={Boolean(err("email"))} aria-describedby={described("email")} className={INPUT} />
        <FieldError id="email-erro" message={err("email")} />
      </label>

      <label className="block text-sm font-medium text-ink">
        Empresa ou marca *
        <input name="empresa" required defaultValue={v("empresa")} aria-invalid={Boolean(err("empresa"))} aria-describedby={described("empresa")} className={INPUT} />
        <FieldError id="empresa-erro" message={err("empresa")} />
      </label>

      <label className="block text-sm font-medium text-ink">
        Você é *
        <select name="perfil" required defaultValue={v("perfil")} aria-invalid={Boolean(err("perfil"))} aria-describedby={described("perfil")} className={INPUT}>
          <option value="" disabled>Escolha uma opção</option>
          <option value="marca">Marca ou indústria</option>
          <option value="seller">Seller (revenda ou loja)</option>
        </select>
        <FieldError id="perfil-erro" message={err("perfil")} />
      </label>

      <label className="block text-sm font-medium text-ink">
        Link da sua loja ou de um produto na Amazon (opcional)
        <input name="loja" type="url" defaultValue={v("loja")} aria-invalid={Boolean(err("loja"))} aria-describedby={described("loja")} className={INPUT} />
        <FieldError id="loja-erro" message={err("loja")} />
      </label>

      <label className="block text-sm font-medium text-ink">
        <span>Seu desafio *</span>
        <textarea name="desafio" required rows={5} defaultValue={v("desafio")} aria-invalid={Boolean(err("desafio"))} aria-describedby={described("desafio")} className={INPUT} />
        <FieldError id="desafio-erro" message={err("desafio")} />
      </label>

      {state.status === "error" ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.message}</p>
      ) : null}

      <button type="submit" disabled={pending} className="rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-dark disabled:opacity-60">
        {pending ? "Enviando…" : submitLabel}
      </button>
      <p className="text-xs text-muted">* Campos obrigatórios. Respondemos em até 1 dia útil.</p>
    </form>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter zemann test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/zemann/app/_components
git commit -m "feat(zemann): blocos compartilhados (pilares, comparativo, oferta, FAQ, formulário)"
```

---

### Task 7: Home (estrutura Cloudflare) e imagens Open Graph

**Files:**
- Create: `apps/zemann/lib/og.tsx`, `apps/zemann/app/opengraph-image.tsx`, `apps/zemann/app/_components/hero-illustration.tsx`, `apps/zemann/app/_components/stats-band.tsx`, `apps/zemann/app/_components/cta-trio.tsx`
- Modify: `apps/zemann/app/page.tsx` (substitui o provisório)
- Test: `apps/zemann/app/_components/home-blocks.test.tsx`

**Interfaces:**
- Consumes: `PAGES`, `pageMetadata`, `Pillars`, `ComparisonTable`, `OfferLadder`, `CtaLink`
- Produces: `OG_SIZE = { width: 1200, height: 630 }`, `renderOg(title: string, kicker?: string): ImageResponse`, `<HeroIllustration />`, `<StatsBand />`, `<CtaTrio />`

- [ ] **Step 0: Blocos da home no estilo Cloudflare (teste primeiro)**

`apps/zemann/app/_components/home-blocks.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CtaTrio } from "./cta-trio";
import { StatsBand } from "./stats-band";

describe("blocos da home", () => {
  it("faixa de números mostra valor e legenda de cada indicador", () => {
    render(<StatsBand />);
    expect(screen.getByText("3.000+")).toBeInTheDocument();
    expect(screen.getByText(/produtos no catálogo/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("CTA final tem três caminhos com destinos distintos", () => {
    render(<CtaTrio />);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/diagnostico-conta-amazon", "/guias", "/contato"]);
  });
});
```

Run: `pnpm --filter zemann test` → Expected: FAIL (módulos inexistentes).

`apps/zemann/app/_components/stats-band.tsx`:
```tsx
// Só números verificáveis da operação e da oferta.
const STATS = [
  ["3.000+", "produtos no catálogo da marca que operamos na Amazon"],
  ["30–90 dias", "para uma implantação completa"],
  ["100%", "das publicações com prévia validada pela Amazon e aprovação"],
  ["1 dia útil", "para responder ao seu contato"],
];

export function StatsBand() {
  return (
    <section className="bg-surface py-16">
      <ul className="mx-auto grid max-w-7xl gap-10 px-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map(([value, label]) => (
          <li key={value}>
            <p className="text-4xl font-extrabold tracking-tight text-accent md:text-5xl">{value}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`apps/zemann/app/_components/cta-trio.tsx`:
```tsx
import Link from "next/link";
import { PAGES } from "@/lib/pages";

const OPTIONS = [
  { href: PAGES.diagnostico.path, cta: "trio_diagnostico", title: "Comece pelo diagnóstico", text: "Saiba o que trava as vendas e o que corrigir primeiro." },
  { href: PAGES.guias.path, cta: "trio_guias", title: "Aprenda com os guias", text: "Vendor ou seller, Buy Box, listings e Ads, na prática." },
  { href: PAGES.contato.path, cta: "trio_contato", title: "Fale com um especialista", text: "Para implantação ou gestão contínua da sua operação." },
];

export function CtaTrio() {
  return (
    <section className="mx-auto mt-20 max-w-7xl px-4">
      <h2 className="text-3xl font-extrabold tracking-tight text-ink md:text-4xl">Comece a vender melhor na Amazon</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {OPTIONS.map((option) => (
          <Link key={option.href} href={option.href} data-cta={option.cta} className="group rounded-lg border border-line p-6 transition hover:border-accent hover:shadow-md">
            <h3 className="text-lg font-bold text-ink group-hover:text-accent">{option.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{option.text}</p>
            <span aria-hidden className="mt-4 inline-block font-semibold text-accent">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

`apps/zemann/app/_components/hero-illustration.tsx` (ilustração própria em SVG, cores via `currentColor` e classes de token — rede de produtos conectados a um painel de números):
```tsx
export function HeroIllustration() {
  const nodes = [
    [60, 70], [60, 170], [60, 270], [200, 120], [200, 220], [340, 170],
  ];
  return (
    <svg viewBox="0 0 420 340" role="img" aria-label="Produtos conectados a um painel de indicadores" className="h-auto w-full text-accent">
      <rect x="290" y="40" width="120" height="260" rx="10" className="fill-surface stroke-line" strokeWidth="2" />
      {[80, 130, 180, 230].map((y, i) => (
        <rect key={y} x="306" y={y} width={[88, 60, 76, 44][i]} height="14" rx="4" className="fill-accent-soft" />
      ))}
      {[[60, 70, 200, 120], [60, 170, 200, 120], [60, 170, 200, 220], [60, 270, 200, 220], [200, 120, 340, 170], [200, 220, 340, 170]].map(([x1, y1, x2, y2]) => (
        <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
      ))}
      {nodes.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="16" fill="currentColor" />
      ))}
    </svg>
  );
}
```

Run: `pnpm --filter zemann test` → Expected: PASS.

- [ ] **Step 1: Ler a documentação**

Ler `apps/azpetshop/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`.

- [ ] **Step 2: Implementar `lib/og.tsx` e `app/opengraph-image.tsx`**

`apps/zemann/lib/og.tsx`:
```tsx
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

export function renderOg(title: string, kicker = "Consultoria de Amazon"): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0b1220",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#67e8f9" }}>{kicker}</div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>Zemann</div>
      </div>
    ),
    OG_SIZE,
  );
}
```

`apps/zemann/app/opengraph-image.tsx`:
```tsx
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Zemann — Consultoria de Amazon para marcas e sellers";

export default function Image() {
  return renderOg("Venda mais na Amazon com quem opera uma marca lá todos os dias");
}
```

- [ ] **Step 3: Implementar a home `app/page.tsx`**

```tsx
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
    title: "Marcas e indústrias",
    text: "Vai entrar na Amazon ou já está lá e não deslancha? Escolhemos o modelo certo (vendor ou seller), cadastramos o catálogo em escala e organizamos a operação com margem.",
  },
  {
    page: PAGES.sellers,
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
            <Link key={item.page.path} href={item.page.path} data-cta={`publico_${item.page.nav}`} className="rounded-lg border border-line p-6 transition-colors hover:border-accent">
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
```

- [ ] **Step 4: Build e conferência**

Run: `pnpm --filter zemann build`
Expected: conclui; `/` e `/opengraph-image` aparecem como estáticos.

Run: `pnpm --filter zemann test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/zemann/lib/og.tsx apps/zemann/app/opengraph-image.tsx apps/zemann/app/page.tsx apps/zemann/app/_components/hero-illustration.tsx apps/zemann/app/_components/stats-band.tsx apps/zemann/app/_components/cta-trio.tsx apps/zemann/app/_components/home-blocks.test.tsx
git commit -m "feat(zemann): home no estilo Cloudflare com hero, números, comparativo, oferta e CTA final"
```

---

### Task 8: Páginas de público (marcas e sellers)

**Files:**
- Create: `apps/zemann/app/consultoria-amazon-para-marcas/page.tsx`, `apps/zemann/app/consultoria-amazon-para-marcas/opengraph-image.tsx`, `apps/zemann/app/consultoria-amazon-para-sellers/page.tsx`, `apps/zemann/app/consultoria-amazon-para-sellers/opengraph-image.tsx`

**Interfaces:**
- Consumes: `PAGES`, `pageMetadata`, `serviceJsonLd`, `JsonLd`, `Breadcrumbs`, `Pillars`, `OfferLadder`, `FaqList`, `CtaBlock`, `CtaLink`, `OG_SIZE`, `renderOg`

- [ ] **Step 1: Implementar a página de marcas**

`apps/zemann/app/consultoria-amazon-para-marcas/page.tsx`:
```tsx
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
    <main className="mx-auto max-w-6xl px-4 pt-10">
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
```

`apps/zemann/app/consultoria-amazon-para-marcas/opengraph-image.tsx`:
```tsx
import { OG_SIZE, renderOg } from "@/lib/og";
import { PAGES } from "@/lib/pages";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = PAGES.marcas.title;

export default function Image() {
  return renderOg(PAGES.marcas.title);
}
```

- [ ] **Step 2: Implementar a página de sellers**

`apps/zemann/app/consultoria-amazon-para-sellers/page.tsx`:
```tsx
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
        Se as suas vendas na Amazon pararam de crescer, o problema quase sempre está em quatro lugares: Buy Box,
        anúncios com pendência, Ads e margem. A Zemann encontra onde está o seu e corrige junto com você.
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
```

`apps/zemann/app/consultoria-amazon-para-sellers/opengraph-image.tsx`:
```tsx
import { OG_SIZE, renderOg } from "@/lib/og";
import { PAGES } from "@/lib/pages";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = PAGES.sellers.title;

export default function Image() {
  return renderOg(PAGES.sellers.title);
}
```

- [ ] **Step 3: Build**

Run: `pnpm --filter zemann build`
Expected: conclui; as duas rotas aparecem como estáticas.

- [ ] **Step 4: Commit**

```bash
git add apps/zemann/app/consultoria-amazon-para-marcas apps/zemann/app/consultoria-amazon-para-sellers
git commit -m "feat(zemann): páginas de consultoria para marcas e para sellers"
```

---

### Task 9: Páginas de diagnóstico e de contato

**Files:**
- Create: `apps/zemann/app/diagnostico-conta-amazon/page.tsx`, `apps/zemann/app/diagnostico-conta-amazon/opengraph-image.tsx`, `apps/zemann/app/contato/page.tsx`, `apps/zemann/app/contato/opengraph-image.tsx`

**Interfaces:**
- Consumes: `PAGES`, `pageMetadata`, `serviceJsonLd`, `siteConfig`, `formatPriceFrom`, `JsonLd`, `Breadcrumbs`, `FaqList`, `ContactForm`, `OG_SIZE`, `renderOg`

- [ ] **Step 1: Implementar a página de diagnóstico**

`apps/zemann/app/diagnostico-conta-amazon/page.tsx`:
```tsx
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
  ["Só visíveis, sem oferta ativa", "210"],
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
    <main className="mx-auto max-w-6xl px-4 pt-10">
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
          <p className="mt-2 text-sm text-muted">Exemplo ilustrativo, com números fictícios, no formato do relatório real.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
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
```

`apps/zemann/app/diagnostico-conta-amazon/opengraph-image.tsx`:
```tsx
import { OG_SIZE, renderOg } from "@/lib/og";
import { PAGES } from "@/lib/pages";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = PAGES.diagnostico.title;

export default function Image() {
  return renderOg(PAGES.diagnostico.title);
}
```

- [ ] **Step 2: Implementar a página de contato**

`apps/zemann/app/contato/page.tsx`:
```tsx
import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/site.config";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { ContactForm } from "../_components/contact-form";

const page = PAGES.contato;
export const metadata = pageMetadata(page);

export default function ContatoPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-10">
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: page.title, path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">Fale com a Zemann</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">
        Para implantação ou gestão contínua da sua operação na Amazon, conte o seu cenário abaixo. Se preferir,
        escreva para{" "}
        <a href={`mailto:${siteConfig.email}`} className="font-medium text-accent underline">{siteConfig.email}</a>.
      </p>
      <div className="mt-10">
        <ContactForm form="contato" submitLabel="Enviar mensagem" />
      </div>
    </main>
  );
}
```

`apps/zemann/app/contato/opengraph-image.tsx`:
```tsx
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Fale com a Zemann";

export default function Image() {
  return renderOg("Fale com a Zemann");
}
```

- [ ] **Step 3: Teste manual do formulário**

Criar `apps/zemann/.env.local` copiando `.env.example` **sem** credenciais SMTP. Rodar `pnpm --filter zemann dev`, abrir `http://localhost:4106/diagnostico-conta-amazon` e:
1. Enviar vazio → mensagens por campo, incluindo "Conte em poucas palavras o seu desafio."
2. Preencher tudo e enviar → erro visível citando `contato@zemann.com.br` (SMTP ausente), campos mantêm o que foi digitado.
3. Com as credenciais SMTP reais do Fábio (quando fornecidas) → mensagem de sucesso e e-mail recebido em `CONTACT_TO`.

- [ ] **Step 4: Build e commit**

Run: `pnpm --filter zemann build`
Expected: conclui sem erro.

```bash
git add apps/zemann/app/diagnostico-conta-amazon apps/zemann/app/contato
git commit -m "feat(zemann): páginas de diagnóstico da conta e de contato com formulário"
```

---

### Task 10: Perguntas frequentes e Sobre

**Files:**
- Create: `apps/zemann/lib/faq.ts`, `apps/zemann/app/perguntas-frequentes/page.tsx`, `apps/zemann/app/perguntas-frequentes/opengraph-image.tsx`, `apps/zemann/app/sobre/page.tsx`, `apps/zemann/app/sobre/opengraph-image.tsx`
- Test: `apps/zemann/lib/faq.test.ts`

**Interfaces:**
- Consumes: `FaqItem`, `PAGES`, `pageMetadata`, `personJsonLd`, `siteConfig`, `FaqList`, `Breadcrumbs`, `JsonLd`, `CtaBlock`, `OG_SIZE`, `renderOg`
- Produces: `GENERAL_FAQ: FaqItem[]`

- [ ] **Step 1: Escrever o teste que falha**

`apps/zemann/lib/faq.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { GENERAL_FAQ } from "./faq";

describe("GENERAL_FAQ", () => {
  it("tem perguntas únicas terminadas em interrogação e respostas preenchidas", () => {
    const questions = GENERAL_FAQ.map((item) => item.q);
    expect(new Set(questions).size).toBe(questions.length);
    for (const item of GENERAL_FAQ) {
      expect(item.q.endsWith("?")).toBe(true);
      expect(item.a.length).toBeGreaterThan(40);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter zemann test`
Expected: FAIL — `Cannot find module './faq'`.

- [ ] **Step 3: Implementar `lib/faq.ts`**

```ts
import type { FaqItem } from "./content";

export const GENERAL_FAQ: FaqItem[] = [
  {
    q: "O que a Zemann faz?",
    a: "A Zemann é uma consultoria de Amazon mão na massa: estruturamos catálogo, conteúdo, Ads e números de marcas e sellers e executamos junto com o time do cliente, com tecnologia própria conectada à API oficial da Amazon.",
  },
  {
    q: "Para quem é a consultoria?",
    a: "Para marcas e indústrias que querem entrar ou crescer na Amazon, como vendor ou seller, e para sellers estabelecidos que pararam de crescer.",
  },
  {
    q: "Como começar?",
    a: "Pelo diagnóstico da conta: uma auditoria com plano de ação priorizado. Depois você decide se executa com o seu time ou com a Zemann.",
  },
  {
    q: "Quanto custa?",
    a: "O diagnóstico tem valor fixo informado na página do diagnóstico. Implantação e gestão contínua são orçadas depois do diagnóstico, conforme o tamanho do catálogo e as frentes escolhidas.",
  },
  {
    q: "Quanto tempo dura uma implantação?",
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
    a: "Não. A Zemann é uma consultoria independente. Usamos a API oficial da Amazon (SP-API) como qualquer desenvolvedor autorizado pelos vendedores que atendemos.",
  },
  {
    q: "Vocês atendem outros marketplaces?",
    a: "Não. O foco da Zemann é exclusivamente a Amazon, para entregar profundidade em vez de cobrir vários canais de forma rasa.",
  },
];
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter zemann test`
Expected: PASS.

- [ ] **Step 5: Implementar as páginas**

`apps/zemann/app/perguntas-frequentes/page.tsx`:
```tsx
import { GENERAL_FAQ } from "@/lib/faq";
import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { CtaBlock } from "../_components/cta-block";
import { FaqList } from "../_components/faq-list";

const page = PAGES.faq;
export const metadata = pageMetadata(page);

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-10">
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: page.title, path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">{page.title}</h1>
      <p className="mt-4 text-lg text-ink-soft">O que costumam nos perguntar antes de começar.</p>
      <div className="mt-8">
        <FaqList items={GENERAL_FAQ} headingLevel={2} withJsonLd />
      </div>
      <CtaBlock
        title="Ficou alguma dúvida?"
        text="Fale com a gente ou comece direto pelo diagnóstico da conta."
        href={PAGES.contato.path}
        cta="faq_contato"
        label="Falar com a Zemann"
      />
    </main>
  );
}
```

`apps/zemann/app/perguntas-frequentes/opengraph-image.tsx`:
```tsx
import { OG_SIZE, renderOg } from "@/lib/og";
import { PAGES } from "@/lib/pages";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = PAGES.faq.title;

export default function Image() {
  return renderOg(PAGES.faq.title);
}
```

`apps/zemann/app/sobre/page.tsx`:
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
    <main className="mx-auto max-w-3xl px-4 pt-10">
      <JsonLd data={personJsonLd()} />
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: "Sobre", path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">Sobre a Zemann</h1>
      <p className="mt-6 text-lg leading-relaxed text-ink-soft">
        A Zemann é a consultoria de Amazon de {siteConfig.founder.name}. Nasceu dentro de uma operação real: a
        My Pet Brasil, marca própria do mercado pet que vende na Amazon como vendor e atende lojistas no B2B.
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
        title="Quer a mesma abordagem na sua conta?"
        text="Comece pelo diagnóstico e veja os números da sua operação."
        href={PAGES.diagnostico.path}
        cta="sobre_diagnostico"
        label="Agendar diagnóstico"
      />
    </main>
  );
}
```

`apps/zemann/app/sobre/opengraph-image.tsx`:
```tsx
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Sobre a Zemann";

export default function Image() {
  return renderOg("Sobre a Zemann", "Operação, dados e IA na Amazon");
}
```

- [ ] **Step 6: Build e commit**

Run: `pnpm --filter zemann build`
Expected: conclui sem erro.

```bash
git add apps/zemann/lib/faq.ts apps/zemann/lib/faq.test.ts apps/zemann/app/perguntas-frequentes apps/zemann/app/sobre
git commit -m "feat(zemann): perguntas frequentes e página sobre"
```

---

### Task 11: Guias (listagem, página do guia e os 2 primeiros rascunhos)

**Files:**
- Create: `apps/zemann/app/guias/page.tsx`, `apps/zemann/app/guias/opengraph-image.tsx`, `apps/zemann/app/guias/[slug]/page.tsx`, `apps/zemann/app/guias/[slug]/opengraph-image.tsx`, `apps/zemann/app/_components/content-header.tsx`, `apps/zemann/content/guias/vendor-ou-seller-na-amazon.mdx`, `apps/zemann/content/guias/buy-box-na-amazon.mdx`

**Interfaces:**
- Consumes: `listGuides`, `getGuide`, `GuideMeta`, `CtaTarget`, `PAGES`, `pageMetadata`, `articleJsonLd`, `formatDateBR`, `siteConfig`, `Breadcrumbs`, `JsonLd`, `FaqList`, `CtaBlock`, `OG_SIZE`, `renderOg`
- Produces:
  - `<ContentHeader meta={GuideMeta} />` — H1, resposta direta, autor e datas
  - `CTA_BY_TARGET: Record<CtaTarget, { title: string; text: string; href: string; label: string }>` (exportado de `content-header.tsx`, usado também em cases)

- [ ] **Step 1: Implementar `content-header.tsx`**

`apps/zemann/app/_components/content-header.tsx`:
```tsx
import Link from "next/link";
import type { CtaTarget, GuideMeta } from "@/lib/content";
import { formatDateBR } from "@/lib/format";
import { PAGES } from "@/lib/pages";
import { siteConfig } from "@/site.config";

export const CTA_BY_TARGET: Record<CtaTarget, { title: string; text: string; href: string; label: string }> = {
  marcas: {
    title: "Sua marca na Amazon com método",
    text: "Veja como a Zemann trabalha com marcas e indústrias.",
    href: PAGES.marcas.path,
    label: "Consultoria para marcas",
  },
  sellers: {
    title: "Voltar a crescer na Amazon",
    text: "Veja como a Zemann trabalha com sellers estabelecidos.",
    href: PAGES.sellers.path,
    label: "Consultoria para sellers",
  },
  diagnostico: {
    title: "Quer esse olhar na sua conta?",
    text: "O diagnóstico mostra o que trava as vendas e o que corrigir primeiro.",
    href: PAGES.diagnostico.path,
    label: "Agendar diagnóstico",
  },
};

export function ContentHeader({ meta }: { meta: GuideMeta }) {
  return (
    <header>
      <h1 className="mt-6 text-3xl font-extrabold leading-tight text-ink md:text-5xl">{meta.title}</h1>
      {/* Resposta direta logo abaixo do título: o trecho que buscadores e assistentes de IA citam. */}
      <p className="mt-6 rounded-lg border-l-4 border-accent bg-accent-soft/50 p-5 text-lg leading-relaxed text-ink">
        {meta.answer}
      </p>
      <p className="mt-4 text-sm text-muted">
        Por <Link href={PAGES.sobre.path} className="font-medium text-ink hover:text-accent">{siteConfig.founder.name}</Link>
        {" · "}Publicado em <time dateTime={meta.publishedAt}>{formatDateBR(meta.publishedAt)}</time>
        {meta.updatedAt !== meta.publishedAt ? (
          <>
            {" · "}Atualizado em <time dateTime={meta.updatedAt}>{formatDateBR(meta.updatedAt)}</time>
          </>
        ) : null}
      </p>
    </header>
  );
}
```

- [ ] **Step 2: Implementar a listagem `/guias`**

`apps/zemann/app/guias/page.tsx`:
```tsx
import Link from "next/link";
import { listGuides } from "@/lib/content";
import { formatDateBR } from "@/lib/format";
import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "../_components/breadcrumbs";

const page = PAGES.guias;
export const metadata = pageMetadata(page);

export default function GuiasPage() {
  const guides = listGuides();
  return (
    <main className="mx-auto max-w-4xl px-4 pt-10">
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: "Guias", path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">{page.title}</h1>
      <p className="mt-4 text-lg text-ink-soft">Escritos por quem opera uma marca na Amazon todos os dias.</p>
      {guides.length === 0 ? (
        <p className="mt-10 text-ink-soft">Os primeiros guias estão em revisão e serão publicados em breve.</p>
      ) : (
        <ul className="mt-10 divide-y divide-line">
          {guides.map((guide) => (
            <li key={guide.slug} className="py-6">
              <Link href={`/guias/${guide.slug}`} className="group block">
                <h2 className="text-xl font-semibold text-ink group-hover:text-accent">{guide.title}</h2>
                <p className="mt-2 text-ink-soft">{guide.description}</p>
                <p className="mt-2 text-sm text-muted">Atualizado em {formatDateBR(guide.updatedAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

`apps/zemann/app/guias/opengraph-image.tsx`:
```tsx
import { OG_SIZE, renderOg } from "@/lib/og";
import { PAGES } from "@/lib/pages";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = PAGES.guias.title;

export default function Image() {
  return renderOg(PAGES.guias.title);
}
```

- [ ] **Step 3: Implementar a página do guia**

`apps/zemann/app/guias/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getGuide, listGuides } from "@/lib/content";
import { articleJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { CTA_BY_TARGET, ContentHeader } from "../../_components/content-header";
import { CtaBlock } from "../../_components/cta-block";
import { FaqList } from "../../_components/faq-list";
import { JsonLd } from "../../_components/json-ld";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return listGuides().map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return pageMetadata({
    path: `/guias/${slug}`,
    title: guide.title,
    description: guide.description,
    type: "article",
    publishedAt: guide.publishedAt,
    updatedAt: guide.updatedAt,
  });
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const { default: Body } = await import(`@/content/guias/${slug}.mdx`);
  const path = `/guias/${slug}`;
  const cta = CTA_BY_TARGET[guide.cta];

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10">
      <JsonLd
        data={articleJsonLd({
          title: guide.title,
          description: guide.description,
          path,
          publishedAt: guide.publishedAt,
          updatedAt: guide.updatedAt,
        })}
      />
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: "Guias", path: "/guias" }, { name: guide.title, path }]} />
      <article>
        <ContentHeader meta={guide} />
        <div className="mt-8">
          <Body />
        </div>
        {guide.faq.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-ink">Perguntas frequentes</h2>
            <FaqList items={guide.faq} headingLevel={3} withJsonLd />
          </section>
        ) : null}
      </article>
      <CtaBlock title={cta.title} text={cta.text} href={cta.href} cta={`guia_${slug}`} label={cta.label} />
    </main>
  );
}
```

`apps/zemann/app/guias/[slug]/opengraph-image.tsx`:
```tsx
import { getGuide } from "@/lib/content";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Guia da Zemann";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderOg(getGuide(slug)?.title ?? "Guias da Zemann", "Guia");
}
```

- [ ] **Step 4: Escrever o guia 1 (rascunho)**

`apps/zemann/content/guias/vendor-ou-seller-na-amazon.mdx`:
```mdx
---
title: "Vendor ou seller na Amazon: qual modelo serve para a sua marca"
description: "Vendor (1P) vende para a Amazon; seller (3P) vende na Amazon. Compare controle, margem, logística e quando cada modelo serve para a sua marca."
answer: "No modelo vendor (1P), a sua marca vende o produto para a Amazon, que define o preço ao consumidor e faz a venda. No modelo seller (3P), você vende direto ao consumidor pela Amazon, controla preço e estoque e paga comissão por venda. Vendor troca controle por volume e simplicidade; seller troca mais trabalho operacional por controle e margem."
author: "fabio"
publishedAt: "2026-10-20"
updatedAt: "2026-10-20"
draft: true
cta: "marcas"
faq:
  - q: "Qualquer marca pode ser vendor na Amazon?"
    a: "Não. O acesso ao Vendor Central é por convite da Amazon, normalmente para marcas e fabricantes com produtos que a Amazon quer comprar em volume. O modelo seller é aberto a qualquer empresa."
  - q: "Dá para ser vendor e seller ao mesmo tempo?"
    a: "Sim. Muitas marcas usam o modelo híbrido: vendem a linha principal para a Amazon como vendor e mantêm como seller os produtos que precisam de controle de preço, lançamentos ou itens que a Amazon não comprou."
  - q: "Qual modelo dá mais margem?"
    a: "Depende do produto. Como seller, a margem por unidade costuma ser maior, mas você assume comissão, logística e operação. Como vendor, a margem por unidade é menor, mas o volume e a simplicidade operacional podem compensar."
---

## Vendor e seller em uma frase

**Vendor** vende *para* a Amazon. **Seller** vende *na* Amazon. Todo o resto — preço, margem, logística, trabalho operacional — decorre dessa diferença.

## Comparação lado a lado

| Critério | Vendor (1P) | Seller (3P) |
|---|---|---|
| Quem vende ao consumidor | A Amazon | A sua empresa |
| Quem define o preço final | A Amazon | Você |
| Como você recebe | Pela fatura do pedido de compra da Amazon | Pelo repasse das vendas, já descontadas comissão e tarifas |
| Painel | Vendor Central | Seller Central |
| Acesso | Por convite | Aberto |
| Logística | Você entrega nos centros de distribuição da Amazon | Logística da Amazon ou envio próprio |
| Trabalho operacional | Confirmar pedidos de compra, cumprir prazos e acordos comerciais | Preço, estoque, atendimento, Buy Box e logística |
| Risco típico | Multas por falhas de entrega e pressão por margem | Perder a Buy Box e margem corroída por tarifas |

## Quando o modelo vendor faz sentido

- A marca tem produtos de giro alto e capacidade de atender pedidos de compra grandes.
- O time é enxuto e prefere vender em volume para um único cliente a operar varejo.
- A marca aceita que a Amazon defina o preço ao consumidor.

## Quando o modelo seller faz sentido

- O controle de preço é importante para proteger outros canais de venda.
- A marca está lançando produtos e quer testar preço, conteúdo e demanda.
- Existe estrutura (própria ou de parceiro) para cuidar de estoque, Ads e Buy Box.

## Na prática: como a My Pet opera

A My Pet Brasil, marca própria do mercado pet, vende na Amazon como vendor. Para dar conta do volume, a operação usa ferramentas conectadas à API oficial da Amazon para confirmar pedidos de compra, cadastrar produtos em escala a partir de produtos já aprovados e calcular a rentabilidade de cada pedido com o custo real.

{/* REVISÃO: Fábio — inserir um número real da operação (ex.: tamanho do catálogo vendor, tempo de confirmação de pedido ou ganho com o cadastro em escala) e confirmar a tabela acima. */}

## Como decidir

1. Liste os produtos de maior giro e a margem de cada um no preço que a Amazon costuma praticar.
2. Compare com a margem como seller, já descontadas comissão, tarifas e logística.
3. Avalie se o seu time consegue operar o modelo seller (Buy Box, Ads, estoque) ou se precisa de apoio.
4. Considere o modelo híbrido: vendor para a linha principal, seller para lançamentos e itens com preço sensível.
```

- [ ] **Step 5: Escrever o guia 2 (rascunho)**

`apps/zemann/content/guias/buy-box-na-amazon.mdx`:
```mdx
---
title: "Buy Box na Amazon: como funciona e por que você perde"
description: "O que é a Buy Box da Amazon, quais fatores decidem quem fica com ela, por que você perde e o que fazer para recuperar as vendas."
answer: "A Buy Box é o botão “Adicionar ao carrinho” da página do produto. Quando vários vendedores oferecem o mesmo item, a Amazon escolhe uma oferta para ocupar esse espaço, considerando preço total com frete, prazo de entrega, disponibilidade em estoque e o desempenho do vendedor. Quem perde a Buy Box praticamente deixa de vender aquele produto."
author: "fabio"
publishedAt: "2026-10-27"
updatedAt: "2026-10-27"
draft: true
cta: "sellers"
faq:
  - q: "Todo vendedor pode ganhar a Buy Box?"
    a: "Não. A oferta precisa ser elegível: conta com bom desempenho, produto novo e em estoque. Ofertas fora desses critérios ficam apenas na lista de outros vendedores."
  - q: "Baixar o preço garante a Buy Box?"
    a: "Não. Preço é um fator importante, mas prazo de entrega, estoque e métricas da conta também pesam. Baixar preço sem olhar a margem pode fazer você vender mais e lucrar menos."
  - q: "A logística da Amazon ajuda a ganhar a Buy Box?"
    a: "Em geral, sim, porque melhora prazo e confiabilidade da entrega. Mas o custo precisa caber na margem do produto, o que vale calcular SKU a SKU."
---

## O que é a Buy Box

Na página de um produto, a Amazon mostra uma única oferta em destaque, com os botões de comprar. Quando há mais de um vendedor para o mesmo produto, só um deles ocupa esse espaço por vez. Os demais aparecem em uma lista secundária que poucos compradores abrem.

## O que a Amazon considera

| Fator | O que significa na prática |
|---|---|
| Preço total | Preço do produto mais frete, comparado com as outras ofertas |
| Prazo de entrega | Quanto antes o produto chega, melhor |
| Estoque | Oferta sem estoque não disputa |
| Desempenho do vendedor | Pedidos com defeito, atrasos, cancelamentos e avaliações |
| Forma de envio | Logística da Amazon ou envio próprio com bom histórico |

## Por que você perde a Buy Box

- Um concorrente entrou com preço total menor, muitas vezes com frete mais barato.
- O seu prazo de entrega ficou maior que o dos outros vendedores.
- O estoque acabou ou ficou baixo demais.
- Uma métrica da conta piorou (atrasos, cancelamentos, reclamações).
- O anúncio ganhou uma pendência e a oferta deixou de ser elegível.

{/* REVISÃO: Fábio — inserir um exemplo real de perda e recuperação de Buy Box observado na operação ou em cliente autorizado. */}

## Como recuperar

1. Descubra quem está com a Buy Box e compare preço total e prazo com a sua oferta.
2. Confira estoque e pendências do anúncio antes de mexer em preço.
3. Revise as métricas da conta e trate a causa de atrasos e cancelamentos.
4. Avalie a logística da Amazon nos SKUs de maior giro.
5. Só então ajuste o preço, sabendo exatamente quanto de margem sobra em cada cenário.

## Para marcas: revendedores não autorizados

Se outros vendedores oferecem os seus produtos, a Buy Box pode ficar com eles. O registro da marca na Amazon e uma política comercial clara com distribuidores ajudam a manter o controle das ofertas.
```

- [ ] **Step 6: Testes e build com rascunhos visíveis e ocultos**

Run: `pnpm --filter zemann test`
Expected: PASS (os guias são rascunhos, então a marca REVISÃO é permitida).

Run: `pnpm --filter zemann build`
Expected: conclui; `/guias` estática e nenhuma rota `/guias/[slug]` gerada (os dois são rascunho).

Run (PowerShell): `$env:ZEMANN_SHOW_DRAFTS = "1"; pnpm --filter zemann build; Remove-Item Env:ZEMANN_SHOW_DRAFTS`
Expected: conclui e gera `/guias/vendor-ou-seller-na-amazon` e `/guias/buy-box-na-amazon` (tabelas renderizadas, comentários `REVISÃO` ausentes do HTML).

- [ ] **Step 7: Commit**

```bash
git add apps/zemann/app/guias apps/zemann/app/_components/content-header.tsx apps/zemann/content/guias
git commit -m "feat(zemann): guias em MDX com resposta direta, FAQ e os dois primeiros rascunhos"
```

---

### Task 12: Cases (listagem, página do case e conteúdo)

**Files:**
- Create: `apps/zemann/app/cases/page.tsx`, `apps/zemann/app/cases/opengraph-image.tsx`, `apps/zemann/app/cases/[slug]/page.tsx`, `apps/zemann/app/cases/[slug]/opengraph-image.tsx`, `apps/zemann/content/cases/my-pet-na-amazon.mdx`, `feiticos.mdx`, `catalogo-hub.mdx`, `hub-comercial.mdx`, `agente-my-pet.mdx`

**Interfaces:**
- Consumes: `listCases`, `getCase`, `CaseMeta`, `CTA_BY_TARGET`, `ContentHeader`, `PAGES`, `pageMetadata`, `articleJsonLd`, `Breadcrumbs`, `JsonLd`, `FaqList`, `CtaBlock`, `OG_SIZE`, `renderOg`

- [ ] **Step 1: Implementar a listagem `/cases`**

`apps/zemann/app/cases/page.tsx`:
```tsx
import Link from "next/link";
import { listCases } from "@/lib/content";
import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "../_components/breadcrumbs";

const page = PAGES.cases;
export const metadata = pageMetadata(page);

export default function CasesPage() {
  const cases = listCases();
  return (
    <main className="mx-auto max-w-5xl px-4 pt-10">
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: "Cases", path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">{page.title}</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">
        Cada case mostra o problema, a solução e o impacto — com o que foi construído e por quê.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {cases.map((item) => (
          <Link key={item.slug} href={`/cases/${item.slug}`} className="rounded-lg border border-line p-6 transition-colors hover:border-accent">
            <p className="text-sm font-semibold text-accent">{item.client}</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">{item.title}</h2>
            <p className="mt-2 text-ink-soft">{item.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
```

`apps/zemann/app/cases/opengraph-image.tsx`:
```tsx
import { OG_SIZE, renderOg } from "@/lib/og";
import { PAGES } from "@/lib/pages";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = PAGES.cases.title;

export default function Image() {
  return renderOg(PAGES.cases.title);
}
```

- [ ] **Step 2: Implementar a página do case**

`apps/zemann/app/cases/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getCase, listCases } from "@/lib/content";
import { articleJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { CTA_BY_TARGET, ContentHeader } from "../../_components/content-header";
import { CtaBlock } from "../../_components/cta-block";
import { FaqList } from "../../_components/faq-list";
import { JsonLd } from "../../_components/json-ld";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return listCases().map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const item = getCase(slug);
  if (!item) return {};
  return pageMetadata({
    path: `/cases/${slug}`,
    title: item.title,
    description: item.description,
    type: "article",
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
  });
}

export default async function CasePage({ params }: Props) {
  const { slug } = await params;
  const item = getCase(slug);
  if (!item) notFound();
  const { default: Body } = await import(`@/content/cases/${slug}.mdx`);
  const path = `/cases/${slug}`;
  const cta = CTA_BY_TARGET[item.cta];
  const summary: [string, string][] = [
    ["Problema", item.problem],
    ["Solução", item.solution],
    ["Impacto", item.impact],
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10">
      <JsonLd
        data={articleJsonLd({
          title: item.title,
          description: item.description,
          path,
          publishedAt: item.publishedAt,
          updatedAt: item.updatedAt,
        })}
      />
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: "Cases", path: "/cases" }, { name: item.title, path }]} />
      <article>
        <p className="mt-6 text-sm font-semibold text-accent">{item.client}</p>
        <ContentHeader meta={item} />
        <dl className="mt-8 grid gap-4 md:grid-cols-3">
          {summary.map(([label, text]) => (
            <div key={label} className="rounded-lg bg-surface p-5">
              <dt className="text-sm font-bold uppercase tracking-wide text-accent">{label}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{text}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8">
          <Body />
        </div>
        {item.faq.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-ink">Perguntas frequentes</h2>
            <FaqList items={item.faq} headingLevel={3} withJsonLd />
          </section>
        ) : null}
      </article>
      <CtaBlock title={cta.title} text={cta.text} href={cta.href} cta={`case_${slug}`} label={cta.label} />
    </main>
  );
}
```

`apps/zemann/app/cases/[slug]/opengraph-image.tsx`:
```tsx
import { getCase } from "@/lib/content";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Case da Zemann";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getCase(slug);
  return renderOg(item?.title ?? "Cases da Zemann", item ? `Case · ${item.client}` : "Case");
}
```

- [ ] **Step 3: Escrever os cases**

`apps/zemann/content/cases/my-pet-na-amazon.mdx`:
```mdx
---
title: "My Pet Brasil na Amazon: catálogo e operação vendor em escala"
description: "Como uma marca própria do mercado pet estruturou catálogo, conteúdo e operação vendor na Amazon com tecnologia própria conectada à SP-API."
answer: "A My Pet Brasil vende na Amazon como vendor. Para cadastrar milhares de produtos, manter o conteúdo correto e saber a rentabilidade de cada pedido, construímos um hub próprio conectado à API oficial da Amazon que cadastra em escala, publica conteúdo com prévia validada e calcula margem com o custo real."
author: "fabio"
publishedAt: "2026-10-20"
updatedAt: "2026-10-20"
draft: false
cta: "marcas"
client: "My Pet Brasil"
problem: "Catálogo grande cadastrado à mão em planilhas da Amazon, conteúdo incompleto em parte dos anúncios e nenhuma visão de margem por pedido de compra."
solution: "Hub próprio conectado à SP-API: cadastro a partir de produtos já aprovados como molde, conteúdo publicado com prévia validada e aprovação, confirmação de pedidos e rentabilidade por pedido."
impact: "Cadastro e correção de anúncios em escala, conteúdo publicado com controle e margem de cada pedido visível antes de confirmar."
authorized: true
---

## O ponto de partida

A My Pet Brasil é uma marca própria do mercado pet que vende para lojistas no B2B e, na Amazon, como vendor. Com mais de 3.000 produtos cadastrados, o trabalho era quase todo manual: preencher planilhas de cadastro da Amazon categoria por categoria, corrigir anúncios um a um e confirmar pedidos de compra sem saber, na hora, quanto cada pedido deixava de margem.

## O que construímos

- **Cadastro em escala.** O hub cruza a planilha de produtos com o modelo de cadastro da Amazon e usa um produto já aprovado da mesma categoria como molde para preencher dezenas de atributos técnicos.
- **Conteúdo com prévia validada.** Título, bullets e descrição são gerados seguindo o guia de voz da marca, validados pela própria Amazon antes de publicar e só vão ao ar depois de aprovados. Cada publicação fica registrada.
- **Conteúdo A+.** A conta já tem documentos A+ aprovados, e a publicação de A+ pela API está em construção.
- **Pedidos e margem.** Os pedidos de compra são listados e confirmados pelo hub, e a rentabilidade de cada pedido é calculada com o custo de produção importado do ERP.

## O que mudou

O cadastro de produtos novos deixou de depender de pesquisa manual de atributos, correções passaram a ser feitas em lote com validação prévia, e a confirmação de pedidos ganhou a informação que faltava: a margem.

## Por que isso importa para outras marcas

O mesmo hub hoje atende mais de uma marca. O método — dados do produto bem estruturados, publicação com validação e margem por SKU — é o que a Zemann leva para cada cliente.
```

`apps/zemann/content/cases/feiticos.mdx`:
```mdx
---
title: "Feitiços: diagnóstico e otimização de anúncios em categoria sensível"
description: "Diagnóstico e otimização de conteúdo dos anúncios de uma marca de bem-estar sexual na Amazon, com aprovação item a item."
answer: "A Feitiços tinha um portfólio grande na Amazon com desempenho abaixo do potencial. O diagnóstico mostrou anúncios sem oferta ativa e com pendências; o primeiro ciclo otimiza o conteúdo dos 20 produtos mais importantes, um por vez, com aprovação da marca e respeito às regras da categoria."
author: "fabio"
publishedAt: "2026-10-20"
updatedAt: "2026-10-20"
draft: false
cta: "diagnostico"
client: "Feitiços"
problem: "Portfólio de 219 anúncios na Amazon com nenhum disponível para compra no momento do diagnóstico, 211 apenas visíveis e 158 com pendências apontadas pela Amazon."
solution: "Diagnóstico da saúde dos anúncios e otimização de título, bullets e descrição dos 20 produtos de maior potencial, publicada um a um com prévia validada e aprovação explícita."
impact: "REVISÃO: preencher com os resultados do ciclo dos 20 produtos quando fechar."
authorized: false
---

## O diagnóstico

{/* REVISÃO: Fábio — publicar somente após autorização por escrito da Feitiços; trocar authorized para true e preencher o impacto com os números do ciclo. */}

O levantamento da conta mostrou 219 anúncios no catálogo, nenhum disponível para compra naquele momento, 211 apenas visíveis e 158 com pendências apontadas pela Amazon — entre elas, imagens inacessíveis e imagem principal fora do padrão.

## O primeiro ciclo

Em uma categoria sensível, a regra foi publicar um produto por vez. Cada texto segue o guia de voz da marca e as regras da categoria, passa pela validação prévia da Amazon e só vai ao ar com aprovação explícita da marca.
```

`apps/zemann/content/cases/catalogo-hub.mdx`:
```mdx
---
title: "Catálogo Hub: dados de produto prontos para marketplaces e IA"
description: "Base única de dados de produto que alimenta marketplaces, sites e agentes de IA com atributos completos e consistentes."
answer: "O Catálogo Hub é uma base única de dados de produto que reúne atributos explícitos e implícitos — como dizer que uma cama é impermeável — para alimentar marketplaces, sites e agentes de IA. A IA só responde bem quando os dados que recebe são bons, e este é o trabalho que vem antes dela."
author: "fabio"
publishedAt: "2026-10-20"
updatedAt: "2026-10-20"
draft: false
cta: "marcas"
client: "My Pet Brasil"
problem: "Informações de produto espalhadas em planilhas e sistemas diferentes, com atributos importantes faltando e descrições inconsistentes entre canais."
solution: "Uma base única de dados de produto, com atributos estruturados e enriquecidos, usada como fonte da verdade por sites, marketplaces e agentes de IA."
impact: "Cadastros consistentes entre canais e agentes de IA que respondem sobre os produtos com base em dados completos, não em suposições."
authorized: true
---

## O problema

Cada canal tinha a sua versão do produto: uma planilha para o marketplace, outra para o site, descrições escritas à mão. Atributos que decidem uma compra — material, tamanho, se é impermeável, para que porte de animal — muitas vezes não estavam escritos em lugar nenhum.

## A solução

O Catálogo Hub reúne os dados de cada produto em um só lugar, com atributos estruturados por categoria. Atributos implícitos são tornados explícitos e revisados, para que qualquer canal, ou agente de IA, receba a mesma informação completa.

## Por que importa para a Amazon

Na Amazon, cada categoria exige dezenas de atributos. Com os dados estruturados na origem, o cadastro em escala deixa de ser um projeto de digitação e passa a ser uma exportação. É a base do cadastro da My Pet na Amazon.
```

`apps/zemann/content/cases/hub-comercial.mdx`:
```mdx
---
title: "Hub Comercial: do clique ao pedido com dados em tempo real"
description: "Rastreamento de comportamento em tempo real, BigQuery e automação de e-mail para transformar visitas em pedidos B2B."
answer: "O Hub Comercial liga o comportamento dos clientes no site a ações comerciais: os eventos de navegação vão em tempo real para o BigQuery, são segmentados por interesse e disparam e-mails personalizados. É o funil de growth inteiro — instrumentação, segmentação e ação — dentro da própria empresa."
author: "fabio"
publishedAt: "2026-10-20"
updatedAt: "2026-10-20"
draft: false
cta: "diagnostico"
client: "My Pet Brasil"
problem: "O time comercial não sabia quais clientes estavam pesquisando quais produtos, e o contato acontecia sem contexto e fora do momento de interesse."
solution: "Rastreamento de eventos em tempo real no site, armazenamento no BigQuery, regras de segmentação por comportamento e e-mails automáticos personalizados."
impact: "Contato comercial no momento do interesse, com base no que cada cliente realmente olhou, e uma base de dados de comportamento para decisões de produto e mix."
authorized: true
---

## O problema

O site recebia visitas de lojistas todos os dias, mas o comportamento deles se perdia. O time comercial não sabia quem tinha olhado quais produtos e falava com todos do mesmo jeito.

## A solução

- **Instrumentação:** eventos de navegação (produtos vistos, categorias, buscas) registrados em tempo real.
- **Dados:** os eventos vão para o BigQuery, onde são cruzados com o cadastro de clientes.
- **Segmentação:** regras definem quem demonstrou interesse em quê.
- **Ação:** e-mails personalizados disparados automaticamente para cada segmento.

## Por que importa para a Amazon

O mesmo raciocínio vale para Amazon Ads e para o mix de produtos: medir o comportamento, transformar em dado consultável e agir com regras claras — em vez de decidir no escuro.
```

`apps/zemann/content/cases/agente-my-pet.mdx`:
```mdx
---
title: "Agente My Pet: IA que atende e monta pedidos B2B"
description: "Agente de IA que responde dúvidas, apresenta produtos e monta pedidos B2B conversando, treinado no catálogo e no FAQ da empresa."
answer: "O Agente My Pet atende dois públicos: visitantes que ainda não são clientes recebem respostas e conhecem produtos sem preço, e lojistas cadastrados montam o pedido conversando, recebem sugestão do que repor e acompanham pedidos. O agente responde com base no catálogo e no FAQ da empresa e nunca negocia preço."
author: "fabio"
publishedAt: "2026-10-20"
updatedAt: "2026-10-20"
draft: false
cta: "diagnostico"
client: "My Pet Brasil"
problem: "Dúvidas repetidas consumiam o atendimento e leads sem cadastro chegavam ao WhatsApp do time comercial."
solution: "Agente de IA com respostas baseadas no catálogo e no FAQ, cadastro dentro da conversa, montagem de pedido com carrinho ao lado e envio pelo WhatsApp, além de telemetria de cada resposta."
impact: "Dúvidas frequentes respondidas na hora, lead frio convertido em cadastro em vez de ocupar o atendimento e pedidos montados conversando pelos lojistas."
authorized: true
---

## O problema

O atendimento gastava tempo com perguntas repetidas sobre frete, prazos e pedido mínimo, e visitantes sem cadastro iam direto para o WhatsApp do time.

## A solução

- **Para visitantes:** o agente tira dúvidas e mostra produtos sem preço; a saída é sempre o cadastro, nunca o WhatsApp do time.
- **Para clientes:** o agente mostra preços, monta o pedido conversando com um carrinho ao lado, sugere o que repor com base nas compras anteriores e informa o status dos pedidos.
- **Regras claras:** o agente nunca negocia, nunca promete desconto e responde com base no catálogo e no FAQ.
- **Operação:** cada resposta é registrada com provedor, tempo e custo, com troca automática de provedor de IA em caso de falha e limite de uso.

## Por que importa para a Amazon

O agente só funciona porque o catálogo é bem estruturado. É o mesmo princípio que a Zemann aplica nos anúncios da Amazon: dados bons primeiro, automação depois.
```

- [ ] **Step 4: Testes e build**

Run: `pnpm --filter zemann test`
Expected: PASS. O case `feiticos` contém `REVISÃO`, mas não é publicado (`authorized: false`).

Run: `pnpm --filter zemann build`
Expected: conclui; gera `/cases/my-pet-na-amazon`, `/cases/catalogo-hub`, `/cases/hub-comercial` e `/cases/agente-my-pet`; **não** gera `/cases/feiticos`.

- [ ] **Step 5: Commit**

```bash
git add apps/zemann/app/cases apps/zemann/content/cases
git commit -m "feat(zemann): cases em formato de estudo de produto"
```

---

### Task 13: Sitemap, robots e llms.txt

**Files:**
- Create: `apps/zemann/lib/site-index.ts`, `apps/zemann/app/sitemap.ts`, `apps/zemann/app/robots.ts`, `apps/zemann/app/llms.txt/route.ts`
- Test: `apps/zemann/lib/site-index.test.ts`, `apps/zemann/app/robots.test.ts`

**Interfaces:**
- Consumes: `PAGES`, `GuideMeta`, `CaseMeta`, `listGuides`, `listCases`, `siteConfig`
- Produces:
  - `type IndexEntry = { path: string; title: string; description: string; lastModified?: string; section: "Páginas" | "Guias" | "Cases" }`
  - `buildSiteIndex(guides: GuideMeta[], cases: CaseMeta[]): IndexEntry[]`
  - `renderLlmsTxt(entries: IndexEntry[]): string`

- [ ] **Step 1: Ler a documentação**

Ler `apps/azpetshop/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md`, `robots.md` e a seção "Caching" de `01-app/01-getting-started/15-route-handlers.md`.

- [ ] **Step 2: Escrever os testes que falham**

`apps/zemann/lib/site-index.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { CaseMeta, GuideMeta } from "./content";
import { buildSiteIndex, renderLlmsTxt } from "./site-index";

const guide: GuideMeta = {
  slug: "buy-box-na-amazon",
  title: "Buy Box",
  description: "Sobre Buy Box.",
  answer: "R.",
  author: "fabio",
  publishedAt: "2026-10-01",
  updatedAt: "2026-10-05",
  faq: [],
  draft: false,
  cta: "sellers",
};

const caseItem: CaseMeta = {
  ...guide,
  slug: "my-pet-na-amazon",
  title: "My Pet",
  description: "Case.",
  client: "My Pet Brasil",
  problem: "P",
  solution: "S",
  impact: "I",
  authorized: true,
};

describe("buildSiteIndex", () => {
  it("inclui páginas fixas, guias e cases com lastModified do conteúdo", () => {
    const index = buildSiteIndex([guide], [caseItem]);
    expect(index.find((e) => e.path === "/")?.section).toBe("Páginas");
    expect(index.find((e) => e.path === "/guias/buy-box-na-amazon")).toMatchObject({ section: "Guias", lastModified: "2026-10-05" });
    expect(index.find((e) => e.path === "/cases/my-pet-na-amazon")?.section).toBe("Cases");
  });
});

describe("renderLlmsTxt", () => {
  it("segue o formato llms.txt com título, resumo e seções de links absolutos", () => {
    const text = renderLlmsTxt(buildSiteIndex([guide], []));
    expect(text.startsWith("# Zemann\n\n> ")).toBe(true);
    expect(text).toContain("## Páginas");
    expect(text).toContain("## Guias");
    expect(text).toContain("- [Buy Box](https://www.zemann.com.br/guias/buy-box-na-amazon): Sobre Buy Box.");
    expect(text).not.toContain("## Cases");
  });
});
```

`apps/zemann/app/robots.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("libera o site para buscadores e robôs de IA e aponta o sitemap", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const agents = rules.flatMap((rule) => (Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent]));
    for (const agent of ["*", "GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
      expect(agents).toContain(agent);
    }
    for (const rule of rules) expect(rule.allow).toBe("/");
    expect(result.sitemap).toBe("https://www.zemann.com.br/sitemap.xml");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter zemann test`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 4: Implementar**

`apps/zemann/lib/site-index.ts`:
```ts
import { siteConfig } from "@/site.config";
import type { CaseMeta, GuideMeta } from "./content";
import { PAGES } from "./pages";

export type IndexEntry = {
  path: string;
  title: string;
  description: string;
  lastModified?: string;
  section: "Páginas" | "Guias" | "Cases";
};

export function buildSiteIndex(guides: GuideMeta[], cases: CaseMeta[]): IndexEntry[] {
  return [
    ...Object.values(PAGES).map((page) => ({
      path: page.path,
      title: page.title,
      description: page.description,
      section: "Páginas" as const,
    })),
    ...guides.map((guide) => ({
      path: `/guias/${guide.slug}`,
      title: guide.title,
      description: guide.description,
      lastModified: guide.updatedAt,
      section: "Guias" as const,
    })),
    ...cases.map((item) => ({
      path: `/cases/${item.slug}`,
      title: item.title,
      description: item.description,
      lastModified: item.updatedAt,
      section: "Cases" as const,
    })),
  ];
}

export function renderLlmsTxt(entries: IndexEntry[]): string {
  const sections: IndexEntry["section"][] = ["Páginas", "Guias", "Cases"];
  const lines = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.tagline}. Consultoria independente, sem vínculo com a Amazon, que opera uma marca própria na Amazon e usa tecnologia conectada à API oficial da Amazon (SP-API).`,
    "",
    "Atende marcas e indústrias (vendor e seller) e sellers estabelecidos no Brasil. Oferta em três etapas: diagnóstico da conta, implantação (30 a 90 dias) e gestão contínua.",
  ];
  for (const section of sections) {
    const items = entries.filter((entry) => entry.section === section);
    if (items.length === 0) continue;
    lines.push("", `## ${section}`, "");
    for (const item of items) {
      lines.push(`- [${item.title}](${siteConfig.url}${item.path}): ${item.description}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
```

`apps/zemann/app/sitemap.ts`:
```ts
import type { MetadataRoute } from "next";
import { listCases, listGuides } from "@/lib/content";
import { buildSiteIndex } from "@/lib/site-index";
import { siteConfig } from "@/site.config";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSiteIndex(listGuides(), listCases()).map((entry) => ({
    url: `${siteConfig.url}${entry.path}`,
    ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
  }));
}
```

`apps/zemann/app/robots.ts`:
```ts
import type { MetadataRoute } from "next";
import { siteConfig } from "@/site.config";

// Robôs de IA liberados de propósito: o objetivo do site é ser citado em respostas (AEO).
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: AI_BOTS, allow: "/" },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
```

`apps/zemann/app/llms.txt/route.ts`:
```ts
import { listCases, listGuides } from "@/lib/content";
import { buildSiteIndex, renderLlmsTxt } from "@/lib/site-index";

export const dynamic = "force-static";

export function GET() {
  return new Response(renderLlmsTxt(buildSiteIndex(listGuides(), listCases())), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter zemann test`
Expected: PASS.

- [ ] **Step 6: Build e conferência**

Run: `pnpm --filter zemann build`
Expected: `/sitemap.xml`, `/robots.txt` e `/llms.txt` estáticos.

Run: `pnpm --filter zemann start` e, em outro terminal:
```bash
curl -s http://localhost:4106/robots.txt
curl -s http://localhost:4106/sitemap.xml
curl -s http://localhost:4106/llms.txt
```
Expected: robots com os robôs de IA liberados; sitemap com as 9 páginas fixas e os 4 cases (sem `/cases/feiticos` e sem guias rascunho); llms.txt com as seções "Páginas" e "Cases".

- [ ] **Step 7: Commit**

```bash
git add apps/zemann/lib/site-index.ts apps/zemann/lib/site-index.test.ts apps/zemann/app/sitemap.ts apps/zemann/app/robots.ts apps/zemann/app/robots.test.ts apps/zemann/app/llms.txt
git commit -m "feat(zemann): sitemap, robots com robôs de IA liberados e llms.txt"
```

---

### Task 14: Verificação final, documentação e checklist de lançamento

**Files:**
- Create: `apps/zemann/README.md`
- Modify: `README.md` (raiz) — tabela de portas

- [ ] **Step 1: Lint, testes e build completos**

Run:
```bash
pnpm exec eslint apps/zemann
pnpm --filter zemann test
pnpm --filter zemann build
```
Expected: lint sem erros; todos os testes passam; build lista todas as rotas como estáticas (○ ou ●), exceto a Server Action.

- [ ] **Step 2: Conferir o HTML gerado**

Com `pnpm --filter zemann start` rodando:
```bash
curl -s http://localhost:4106/ | grep -o '"@type":"[A-Za-z]*"' | sort -u
curl -s http://localhost:4106/diagnostico-conta-amazon | grep -o '<link rel="canonical"[^>]*>'
curl -s http://localhost:4106/cases/my-pet-na-amazon | grep -c 'application/ld+json'
curl -s http://localhost:4106/consultoria-amazon-para-sellers | grep -o 'og:image[^>]*>' | head -1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4106/cases/feiticos
```
Expected: a home tem `Organization` e `WebSite`; canonical `https://www.zemann.com.br/diagnostico-conta-amazon`; o case tem pelo menos 2 scripts JSON-LD (organização/site, artigo, breadcrumb); a página de sellers tem `og:image`; `/cases/feiticos` retorna `404`.

Abrir 2 páginas no [Rich Results Test](https://search.google.com/test/rich-results) só depois do deploy (o teste exige URL pública) — registrar no checklist do Step 5.

- [ ] **Step 3: Conferência visual no celular e no desktop**

Com `pnpm --filter zemann dev`, abrir `http://localhost:4106` com largura de 375px e 1280px: menu `<details>` abre e fecha, tabela comparativa rola na horizontal sem quebrar a página, formulário legível, nenhuma rolagem horizontal da página.

- [ ] **Step 4: Escrever `apps/zemann/README.md`**

```markdown
# Zemann — site da consultoria de Amazon

App Next.js estático (porta 4106). Spec: `docs/superpowers/specs/2026-10-17-zemann-site-amazon-design.md`.

## Rodar

    pnpm dev:zemann

Copie `.env.example` para `.env.local`. Sem SMTP, o formulário mostra erro de envio (esperado no dev).

## Publicar um guia ou case

1. Crie `content/guias/<slug>.mdx` (ou `content/cases/<slug>.mdx`) copiando o frontmatter de um existente.
2. Escreva com `draft: true` e confira com `ZEMANN_SHOW_DRAFTS=1 pnpm dev:zemann`.
3. Regras de todo guia: resposta direta no campo `answer` (2–3 frases), tabela ou passo a passo quando couber,
   pelo menos um dado real da operação, FAQ no frontmatter, `updatedAt` atualizado a cada revisão.
4. Remova todo comentário `REVISÃO` (o teste falha se um conteúdo publicado contiver essa marca).
5. Troque para `draft: false` (case: também `authorized: true`, só com autorização por escrito do cliente) e faça o commit.

## Dados da empresa

`site.config.ts`: e-mail, CNPJ, LinkedIn, nome do fundador e preço do diagnóstico. Campos `null` ficam ocultos.
```

- [ ] **Step 5: Atualizar a tabela de portas do `README.md` da raiz**

Na tabela "Cada app roda numa porta fixa", acrescentar a linha:
```markdown
| zemann | 4106 |
```
E, na lista de comandos individuais, `pnpm dev:zemann`.

- [ ] **Step 6: Commit**

```bash
git add apps/zemann/README.md README.md
git commit -m "docs(zemann): README do app e porta no README da raiz"
```

- [ ] **Step 7: Checklist de lançamento (com o Fábio — não executar sem ele)**

Registrar no resumo final, para o Fábio decidir:
1. Revisão editorial: ler os 2 guias e os 4 cases; inserir os dados reais nos pontos `REVISÃO`; confirmar `founder.name` ("Fábio Zemann") e `legalName` ("DPZ COMMERCE") em `site.config.ts`.
2. Preencher `diagnostic.priceFrom`, `linkedinUrl` e, se quiser, ajustar `deliveryText`.
3. Credenciais SMTP e `CONTACT_TO` no `.env.local` e na Vercel; testar um envio real.
4. Criar a propriedade GA4 da Zemann e definir `NEXT_PUBLIC_GA_ID` na Vercel; marcar `generate_lead` como evento-chave.
5. Criar o projeto na Vercel com root `apps/zemann`, validar a URL de preview, rodar o Rich Results Test em `/diagnostico-conta-amazon` e em um case.
6. Antes de apontar o DNS: conferir no Search Console se o site atual tem URLs indexadas além da home; apontar `www.zemann.com.br`; enviar o sitemap no Search Console.
7. Pedir autorização por escrito à Feitiços; com ela, trocar `authorized: true`, preencher `impact` e remover os `REVISÃO`.
```

---

## Cobertura do spec

| Seção do spec | Tarefa |
|---|---|
| 1. Posicionamento, pilares, comparativo, copy proibida, aviso no rodapé | 5, 6, 7 |
| 2. Mapa de páginas (todas as URLs) | 7–13 |
| 2. Cases v1 (My Pet, Feitiços com autorização, Catálogo Hub, Hub Comercial, Agente) | 12 |
| 2. Redirects (conferir Search Console) | 14 (checklist) |
| 3. Guias 1 e 2 na v1, formato obrigatório, FAQ marcado | 3, 11 |
| 4. App, porta, scripts, hub | 1 |
| 4. Frontmatter validado, draft, authorized | 3 |
| 4. Unidades `content`, `seo`, `jsonld`, `contact`, sitemap, robots, llms.txt, OG | 2, 3, 4, 7–13 |
| 4. Formulário com honeypot, desafio obrigatório, erro visível, SMTP | 4, 6, 9 |
| 4. GA4 (`generate_lead`, `click_cta`), Search Console | 5, 6, 14 |
| 4. Testes e verificação do HTML | todas, 14 |
| 6. Insumos do Fábio | 1 (`site.config.ts`), 14 (checklist) |
