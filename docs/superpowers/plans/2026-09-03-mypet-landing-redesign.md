# Redesign da landing de pré-acesso do `apps/mypet` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin da landing pública do canal `mypetbrasil` para um layout B2B profissional (navy âncora, fonte Geist, fotografia real, provas sociais, ícones), sem mudar conteúdo comercial nem o fluxo de pré-acesso.

**Architecture:** A landing continua sendo Server Components sob `apps/mypet/app/` com um único bloco `<style>{LANDING_STYLES}</style>` em `page.tsx` alimentado por `_components/pre-access/styles.ts`. O redesign reescreve `LANDING_STYLES` inteiro sobre uma nova paleta de tokens, troca as fontes em `layout.tsx`, adiciona 4 componentes de seção novos, funde 2 e remove 1. Dados de texto ficam em `pre-access-content.ts`. Única dependência nova: `@phosphor-icons/react` (importada via `/dist/ssr` para não quebrar RSC).

**Tech Stack:** Next.js 16.2.6, React 19.2.4, Tailwind v4 (só `@import`, sem uso novo), `next/font/google` (Geist, Geist Mono), `@phosphor-icons/react`, Vitest + Testing Library, pnpm workspaces.

## Global Constraints

- Runtime: Next.js **16.2.6**, React **19.2.4**. Componentes de seção são Server Components (sem `"use client"`) exceto onde já existe (`access-form.tsx`).
- Estilo: **um único** `<style>{LANDING_STYLES}</style>` em `page.tsx`. Nada de CSS Modules, nada de Tailwind novo, nada de `styled-*`. Classes com prefixo `pa-`.
- Dependência nova permitida: **apenas** `@phosphor-icons/react`. Importar sempre de `@phosphor-icons/react/dist/ssr`. Nenhuma lib de animação.
- Paleta: navy `#1A3472` / navy-dark `#0F1F45` como âncora; **verde `#00A651` é o único acento** da página inteira. Amarelo não aparece. Fundo claro travado (sem dark mode).
- Fontes: `Geist` (var `--font-geist`) para texto/título, `Geist_Mono` (var `--font-geist-mono`) para números.
- Raio: card `16px`, input `10px`, pill `999px`. Um valor por tipo, em tudo.
- Movimento: só `transition` de hover + fade-up leve, atrás de `@media (prefers-reduced-motion: no-preference)`.
- **Copy visível não contém `—` (em-dash) nem `–` (en-dash como separador).** Usar vírgula, ponto, parênteses, `·` ou hífen.
- **Nenhum preço de produto na landing.** Regras comerciais (pedido mínimo, parcelamento) podem citar `R$` em Condições/FAQ; a vitrine de catálogo nunca mostra `R$` nem SKU.
- Trabalho direto na branch `main` (sem worktree, sem branch de feature). Ponto de restauração já existe: tag `landing-v1` e branch `backup/landing-v1`.
- Comandos rodam da raiz do repo. Teste: `pnpm --filter mypet test`. Dev: `pnpm --filter mypet dev` (porta 4100).
- Cada task termina com `pnpm --filter mypet test` verde e um commit.

---

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `apps/mypet/package.json` | + dependência `@phosphor-icons/react` | 1 |
| `apps/mypet/app/layout.tsx` | Fontes Geist / Geist Mono, vars `--font-geist*` | 1 |
| `apps/mypet/app/globals.css` | Mapear `--font-sans` / `--font-mono` para as novas vars | 1 |
| `apps/mypet/app/_components/pre-access/styles.ts` | `LANDING_STYLES` inteiro reescrito (tokens + todas as seções) | 1 (tokens+base), 4–12 (blocos por seção) |
| `apps/mypet/app/pre-access-content.ts` | + `metrics`, `steps`, `testimonials`; campo `icon` em `commercialConditions`; remove `educationCards`; varredura em-dash | 2 |
| `apps/mypet/app/_components/pre-access/hero.tsx` | Hero navy com foto de fundo + card de acesso | 4 |
| `apps/mypet/app/_components/pre-access/metrics-bar.tsx` | **novo** — faixa de 4 métricas reais | 5 |
| `apps/mypet/app/_components/pre-access/commercial-conditions.tsx` | + ícone Phosphor por card | 6 |
| `apps/mypet/app/_components/pre-access/how-it-works.tsx` | **novo** — stepper numerado de 4 passos (substitui education-cards) | 7 |
| `apps/mypet/app/_components/pre-access/education-cards.tsx` | **removido** | 7 |
| `apps/mypet/app/_components/pre-access/catalog-preview.tsx` | **renomeado** de `popular-categories.tsx` — tiles de categoria + fileira de fotos de produto sem preço | 8 |
| `apps/mypet/app/_components/pre-access/popular-categories.tsx` | **removido** (vira catalog-preview) | 8 |
| `apps/mypet/app/_components/pre-access/testimonials.tsx` | **novo** — 3 cards de depoimento | 9 |
| `apps/mypet/app/_components/pre-access/commercial-faq.tsx` | restyle (classes só) | 10 |
| `apps/mypet/app/_components/pre-access/institutional-trust.tsx` | enxugar para faixa de 3 pontos com ícone | 11 |
| `apps/mypet/app/_components/pre-access/closing-cta.tsx` | **novo** — faixa navy de CTA final | 12 |
| `apps/mypet/app/page.tsx` | Nova composição de seções + header/footer restyle | 13 |
| `apps/mypet/app/page.test.tsx` | Assertions das seções novas + invariante de preço + hrefs de CTA | 13 (e ajustes pontuais nas tasks 5,7,9) |

---

## Task 1: Fundação — dependência, fontes e tokens

**Files:**
- Modify: `apps/mypet/package.json`
- Modify: `apps/mypet/app/layout.tsx`
- Modify: `apps/mypet/app/globals.css`
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (bloco `:root` de tokens + primitivos `pa-wrap`, `pa-h2`, `pa-sec-lead`, `pa-btn*`, `pa-section*`, `@media` de motion)
- Test: `apps/mypet/app/page.test.tsx` (roda o existente, sem alterar)

**Interfaces:**
- Consumes: nada.
- Produces:
  - CSS vars globais: `--font-geist`, `--font-geist-mono` (em `<html>` via `layout.tsx`).
  - `LANDING_STYLES` exporta as classes: `pa-wrap`, `pa-h2`, `pa-sec-lead`, `pa-btn`, `pa-btn-primary`, `pa-btn-ghost`, `pa-section`, `pa-section--soft`, `pa-card`. Tokens CSS: `--pa-navy`, `--pa-navy-dark`, `--pa-navy-soft`, `--pa-green`, `--pa-green-dark`, `--pa-green-soft`, `--pa-ink`, `--pa-muted`, `--pa-line`, `--pa-bg-soft`, `--pa-r-card`, `--pa-r-input`, `--pa-r-pill`, `--pa-geist`, `--pa-mono`.

- [ ] **Step 1: Adicionar a dependência do Phosphor**

Editar `apps/mypet/package.json`, bloco `dependencies`, mantendo ordem alfabética (entra logo após `"@mypet/core"`):

```json
  "dependencies": {
    "@mypet/core": "workspace:*",
    "@phosphor-icons/react": "^2.1.7",
    "@supabase/ssr": "^0.8.0",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "zod": "^4.4.3"
  },
```

- [ ] **Step 2: Instalar**

Run: `pnpm install --filter mypet`
Expected: instala `@phosphor-icons/react`, sem erro de peer dependency (a lib suporta React 19).

- [ ] **Step 3: Trocar as fontes em `layout.tsx`**

Substituir as linhas 2 e 9–19 de `apps/mypet/app/layout.tsx`:

```tsx
import { Geist, Geist_Mono } from "next/font/google";
```

```tsx
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
```

E na linha do `<html className=...>` trocar `${nunito.variable} ${nunitoSans.variable}` por `${geist.variable} ${geistMono.variable}`:

```tsx
    <html
      lang="pt-BR"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
```

- [ ] **Step 4: Atualizar `globals.css`**

Em `apps/mypet/app/globals.css`, trocar as linhas do `@theme inline` e do `body`:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist);
  --font-mono: var(--font-geist-mono);
}
```

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist), system-ui, sans-serif;
}
```

- [ ] **Step 5: Reescrever o topo de `styles.ts` (tokens + primitivos)**

Em `apps/mypet/app/_components/pre-access/styles.ts`, substituir o comentário do topo e o início de `LANDING_STYLES` (da linha 1 até o fim do bloco `/* buttons */`, ou seja linhas 1–44 do arquivo atual) por:

```ts
// Estilo da landing pública de pré-acesso (canal mypetbrasil). Um único bloco
// <style>, renderizado uma vez em page.tsx. Paleta: navy âncora + verde como
// único acento. Fonte Geist (layout.tsx, next/font: --font-geist /
// --font-geist-mono). Sem dependência de estilo nova.
export const LANDING_STYLES = `
  :root {
    --pa-navy: #1A3472; --pa-navy-dark: #0F1F45; --pa-navy-soft: #EDF0F8;
    --pa-green: #00A651; --pa-green-dark: #068A47; --pa-green-soft: #E3F5EC;
    --pa-ink: #0F1F45; --pa-muted: #5A6580; --pa-line: #DDE2EC;
    --pa-bg-soft: #F8F9FB;
    --pa-r-card: 16px; --pa-r-input: 10px; --pa-r-pill: 999px;
    --pa-geist: var(--font-geist), system-ui, sans-serif;
    --pa-mono: var(--font-geist-mono), ui-monospace, monospace;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: #fff; color: var(--pa-ink); font-family: var(--pa-geist); }
  main { display: block; }

  .pa-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  .pa-h2 { font-family: var(--pa-geist); font-weight: 700; letter-spacing: -0.02em; color: var(--pa-navy); font-size: clamp(26px, 3.4vw, 36px); line-height: 1.15; margin: 0 0 12px; }
  .pa-sec-lead { color: var(--pa-muted); font-size: 16px; line-height: 1.6; max-width: 60ch; margin: 0; }

  /* buttons */
  .pa-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: var(--pa-r-pill); font-family: var(--pa-geist); font-weight: 600; font-size: 15px; padding: 12px 24px; cursor: pointer; text-decoration: none; border: 1.5px solid transparent; transition: background .18s ease, border-color .18s ease, color .18s ease, transform .12s ease; }
  .pa-btn-primary { background: var(--pa-green); color: #fff; }
  .pa-btn-primary:hover { background: var(--pa-green-dark); }
  .pa-btn-ghost { background: transparent; color: var(--pa-navy); border-color: var(--pa-line); }
  .pa-btn-ghost:hover { border-color: var(--pa-navy); }

  /* sections */
  .pa-section { padding: 96px 0; }
  .pa-section--soft { background: var(--pa-bg-soft); }
`;
```

> Nota: o restante do `LANDING_STYLES` atual (hero, panel, cards, faq, footer etc.) permanece por enquanto colado logo abaixo, dentro da mesma template string, e vai ser substituído bloco a bloco nas tasks 4–12. Neste passo, apenas garanta que a template string continua fechando com crase e que o arquivo compila.

- [ ] **Step 6: Rodar os testes**

Run: `pnpm --filter mypet test`
Expected: PASS. `page.test.tsx` continua verde (nada de estrutura mudou ainda; só fontes e tokens).

- [ ] **Step 7: Verificação visual rápida**

Run: `pnpm --filter mypet dev` e abrir `http://localhost:4100`.
Expected: a página carrega sem erro de fonte no console; o texto agora está em Geist (sem serifas arredondadas). Layout ainda "antigo" — esperado.

- [ ] **Step 8: Commit**

```bash
git add apps/mypet/package.json apps/mypet/pnpm-lock.yaml apps/mypet/app/layout.tsx apps/mypet/app/globals.css apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(mypet): fundação do redesign da landing (Geist, tokens navy, Phosphor)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

> Se o lockfile alterado for o da raiz (`pnpm-lock.yaml` na raiz do repo), adicione esse caminho no `git add` em vez do de `apps/mypet/`.

---

## Task 2: Dados de conteúdo (`pre-access-content.ts`)

**Files:**
- Modify: `apps/mypet/app/pre-access-content.ts`
- Test: `apps/mypet/app/pre-access-content.test.ts` (novo)

**Interfaces:**
- Consumes: nada.
- Produces (exports nomeados de `pre-access-content.ts`):
  - `commercialConditions`: agora cada item tem `icon: string` (nome de glifo Phosphor). Itens/ids inalterados: `pedido-minimo`, `pagamento`, `entrega`.
  - `metrics: ReadonlyArray<{ id: string; value: string; label: string }>` — 4 itens.
  - `steps: ReadonlyArray<{ id: string; icon: string; title: string; body: string }>` — 4 itens.
  - `testimonials: ReadonlyArray<{ id: string; quote: string; name: string; city: string; store: string }>` — 3 itens (placeholder).
  - `educationCards` **deixa de ser exportado**.

- [ ] **Step 1: Escrever o teste de forma/So conteúdo**

Criar `apps/mypet/app/pre-access-content.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  commercialConditions,
  metrics,
  steps,
  testimonials,
} from "./pre-access-content";

describe("pre-access-content", () => {
  it("cada condição comercial tem um ícone", () => {
    expect(commercialConditions).toHaveLength(3);
    for (const c of commercialConditions) {
      expect(typeof c.icon).toBe("string");
      expect(c.icon.length).toBeGreaterThan(0);
    }
  });

  it("tem exatamente 4 métricas com value e label", () => {
    expect(metrics).toHaveLength(4);
    for (const m of metrics) {
      expect(m.value.trim()).not.toBe("");
      expect(m.label.trim()).not.toBe("");
    }
  });

  it("tem exatamente 4 passos", () => {
    expect(steps).toHaveLength(4);
  });

  it("tem 3 depoimentos com nome, cidade e loja", () => {
    expect(testimonials).toHaveLength(3);
    for (const t of testimonials) {
      expect(t.quote.trim()).not.toBe("");
      expect(t.name.trim()).not.toBe("");
      expect(t.city.trim()).not.toBe("");
      expect(t.store.trim()).not.toBe("");
    }
  });

  it("nenhum texto de conteúdo usa em-dash ou en-dash", () => {
    const blob = JSON.stringify({
      commercialConditions,
      metrics,
      steps,
      testimonials,
    });
    expect(blob).not.toMatch(/[–—]/);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `pnpm --filter mypet test pre-access-content`
Expected: FAIL — `metrics`, `steps`, `testimonials` não existem; `commercialConditions[i].icon` é `undefined`.

- [ ] **Step 3: Editar `pre-access-content.ts`**

3a. Em `commercialConditions`, adicionar `icon` a cada item (nomes de glifo Phosphor):

```ts
export const commercialConditions = [
  {
    id: "pedido-minimo",
    icon: "CurrencyCircleDollar",
    title: "Pedido mínimo",
    value: "R$ 250 na capital de SP · R$ 400 nos demais estados",
    detail:
      "Valor mínimo para compra e entrega: R$ 250,00 na capital de São Paulo; R$ 400,00 no interior de SP e nas outras regiões.",
  },
  {
    id: "pagamento",
    icon: "CreditCard",
    title: "Formas de pagamento",
    value: "Cartão em até 3x sem juros · 5% à vista",
    detail:
      "Cartão de crédito, Pix, depósito e boleto. O boleto faturado (a prazo) depende de análise do financeiro.",
  },
  {
    id: "entrega",
    icon: "Truck",
    title: "Entrega, frete e prazo",
    value: "3 a 7 dias úteis no Sul e Sudeste",
    detail:
      "Separação e despacho em até 7 dias úteis. O prazo por região conta a partir do despacho; o frete sai pelo valor do pedido e pelo CEP.",
  },
] as const;
```

3b. **Remover** todo o bloco `export const educationCards = [ ... ] as const;` (linhas 36–61 do arquivo atual).

3c. Adicionar, no lugar do bloco removido:

```ts
export const metrics = [
  { id: "itens", value: "~5 mil", label: "itens no catálogo, com preço de atacado" },
  { id: "categorias", value: "12+", label: "categorias em destaque nesta página" },
  { id: "cobertura", value: "Brasil", label: "entrega por transportadora para todas as regiões" },
  { id: "prazo", value: "3 a 7 dias", label: "úteis no Sul e Sudeste após o despacho" },
] as const;

export const steps = [
  {
    id: "cadastro",
    icon: "IdentificationCard",
    title: "Cadastro com CNPJ e WhatsApp",
    body: "Sem cotação por WhatsApp. Você preenche o formulário desta página.",
  },
  {
    id: "acesso",
    icon: "LockKeyOpen",
    title: "Acesso liberado na hora",
    body: "A loja com preço, estoque e carrinho abre assim que o cadastro é enviado.",
  },
  {
    id: "pedido",
    icon: "ShoppingCart",
    title: "Monta o pedido no carrinho",
    body: "Você escolhe os itens e fecha o pedido sozinho, no seu tempo.",
  },
  {
    id: "entrega",
    icon: "Package",
    title: "Recebe no endereço do CNPJ",
    body: "Entrega por transportadora no mesmo endereço do cadastro, em horário comercial.",
  },
] as const;

// TODO: substituir por depoimentos reais de lojistas (texto + nome + cidade +
// loja). Os três abaixo são fictícios e existem só para o layout não quebrar.
export const testimonials = [
  {
    id: "t1",
    quote:
      "Comecei comprando pouco para testar o mix. Hoje faço pedido toda semana e a margem do balcão melhorou.",
    name: "Renata Alcântara",
    city: "Sorocaba, SP",
    store: "Pet Vida",
  },
  {
    id: "t2",
    quote:
      "O que pesou foi ver pedido mínimo e prazo antes de entrar. Cadastrei o CNPJ e já estava comprando no mesmo dia.",
    name: "Marcos Beltrão",
    city: "Contagem, MG",
    store: "Mundo Animal Contagem",
  },
  {
    id: "t3",
    quote:
      "Recebo dentro do prazo que aparece na loja e o frete fecha certo pelo CEP. Parou de ser aposta.",
    name: "Juliana Prates",
    city: "Londrina, PR",
    store: "Casa do Bicho",
  },
] as const;
```

3d. Varredura de em-dash: procurar `—` e `–` no arquivo inteiro e trocar por `,`, `.`, `(...)` ou `·` conforme o sentido. (No texto atual, checar especialmente `institutionalPoints` e os `detail`/`a` longos.)

Run de apoio: `git grep -nP "[–—]" -- apps/mypet/app/pre-access-content.ts`
Expected após a troca: sem resultados.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `pnpm --filter mypet test pre-access-content`
Expected: PASS (5 testes).

- [ ] **Step 5: Rodar a suíte do app**

Run: `pnpm --filter mypet test`
Expected: `page.test.tsx` ainda PASS (ele não importa `educationCards`). Se algum arquivo ainda importar `educationCards`, o TypeScript/teste acusa — só `education-cards.tsx` importa, e ele é removido na Task 7; até lá, `education-cards.tsx` fica com import quebrado. Para não deixar a árvore vermelha entre tasks, **nesta task** editar `education-cards.tsx` para um stub temporário:

```tsx
// Substituído por how-it-works.tsx na Task 7.
export function EducationCards() {
  return null;
}
```

E remover o import/uso de `educationCards` que houver nele.

Run de novo: `pnpm --filter mypet test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/app/pre-access-content.ts apps/mypet/app/pre-access-content.test.ts apps/mypet/app/_components/pre-access/education-cards.tsx
git commit -m "feat(mypet): conteúdo do redesign (metrics, steps, testimonials, ícones)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Helper de ícone Phosphor

**Files:**
- Create: `apps/mypet/app/_components/pre-access/icon.tsx`
- Test: `apps/mypet/app/_components/pre-access/icon.test.tsx`

**Interfaces:**
- Consumes: `@phosphor-icons/react/dist/ssr`.
- Produces: `export function PaIcon({ name, size, weight }: { name: string; size?: number; weight?: "regular" | "duotone" | "bold" | "fill" }): JSX.Element | null` — resolve o nome de glifo (string vinda do content) para o componente SSR do Phosphor. Nome desconhecido devolve `null`. Default `size={24}`, `weight="duotone"`.

- [ ] **Step 1: Escrever o teste**

Criar `apps/mypet/app/_components/pre-access/icon.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PaIcon } from "./icon";

describe("PaIcon", () => {
  it("renderiza um svg para um nome válido", () => {
    const { container } = render(<PaIcon name="Truck" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("devolve null para um nome desconhecido", () => {
    const { container } = render(<PaIcon name="NaoExiste123" />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter mypet test pre-access/icon`
Expected: FAIL — `./icon` não existe.

- [ ] **Step 3: Implementar `icon.tsx`**

```tsx
import {
  CreditCard,
  CurrencyCircleDollar,
  IdentificationCard,
  LockKeyOpen,
  Package,
  ShoppingCart,
  Star,
  Truck,
  Headset,
  Storefront,
  Stack,
  type IconProps,
} from "@phosphor-icons/react/dist/ssr";

const MAP: Record<string, React.ComponentType<IconProps>> = {
  CreditCard,
  CurrencyCircleDollar,
  IdentificationCard,
  LockKeyOpen,
  Package,
  ShoppingCart,
  Star,
  Truck,
  Headset,
  Storefront,
  Stack,
};

export function PaIcon({
  name,
  size = 24,
  weight = "duotone",
}: {
  name: string;
  size?: number;
  weight?: IconProps["weight"];
}) {
  const Cmp = MAP[name];
  if (!Cmp) return null;
  return <Cmp size={size} weight={weight} aria-hidden />;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter mypet test pre-access/icon`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/_components/pre-access/icon.tsx apps/mypet/app/_components/pre-access/icon.test.tsx
git commit -m "feat(mypet): helper PaIcon (Phosphor SSR) para a landing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Hero

**Files:**
- Modify: `apps/mypet/app/_components/pre-access/hero.tsx`
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (substituir os blocos `/* hero */`, `/* access panel */` e a regra `.pa-hero .pa-btn-primary`; adicionar `.pa-hero-media`, `.pa-hero-overlay`)
- Test: `apps/mypet/app/_components/pre-access/hero.test.tsx` (novo)

**Interfaces:**
- Consumes: `AccessForm` de `./access-form` (inalterado); `next/image`.
- Produces: `Hero` continua sem props. Mantém `id="acesso"` no card do formulário, `id="hero-title"` no `<h1>`, e os CTAs `href="#condicoes"` / `href="#categorias"`.

- [ ] **Step 1: Escrever o teste**

Criar `apps/mypet/app/_components/pre-access/hero.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "./hero";

describe("Hero", () => {
  it("tem um h1 com uma palavra destacada", () => {
    render(<Hero />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(/atacado/i);
    expect(h1.querySelector(".pa-hl")).not.toBeNull();
  });

  it("mantém o alvo de âncora do formulário de acesso", () => {
    const { container } = render(<Hero />);
    expect(container.querySelector("#acesso")).not.toBeNull();
    expect(container.querySelector("form")).not.toBeNull();
  });

  it("não usa em-dash na copy", () => {
    const { container } = render(<Hero />);
    expect(container.textContent ?? "").not.toMatch(/[–—]/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter mypet test pre-access/hero`
Expected: FAIL — não há `.pa-hl` no h1 atual.

- [ ] **Step 3: Reescrever `hero.tsx`**

```tsx
import Image from "next/image";
import { AccessForm } from "./access-form";

export function Hero() {
  return (
    <section className="pa-hero" aria-labelledby="hero-title">
      {/* TODO: trocar por foto real do CD/operação (1600x1000, WebP). */}
      <Image
        className="pa-hero-media"
        src="https://picsum.photos/seed/mypet-cd-operacao/1600/1000"
        alt=""
        fill
        priority
        sizes="100vw"
      />
      <div className="pa-hero-overlay" aria-hidden />

      <div className="pa-wrap pa-hero-grid">
        <div>
          <p className="pa-eyebrow">Atacado para pet shops</p>
          <h1 id="hero-title">
            Abasteça sua loja com condições de atacado{" "}
            <span className="pa-hl">claras</span>
          </h1>
          <p className="pa-hero-lead">
            Pedido mínimo, pagamento e prazo à vista antes de você entrar.
            Cadastro com CNPJ e WhatsApp, acesso imediato.
          </p>
          <div className="pa-hero-actions">
            <a href="#condicoes" className="pa-btn pa-btn-primary">Ver condições</a>
            <a href="#categorias" className="pa-btn pa-btn-hero-ghost">Ver categorias</a>
          </div>
        </div>

        <div className="pa-panel" id="acesso">
          <h2>Criar acesso à loja</h2>
          <p className="pa-panel-sub">CNPJ e WhatsApp. Liberação na hora, sem cotação por WhatsApp.</p>
          <AccessForm />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Substituir os blocos de hero em `styles.ts`**

Trocar o bloco atual `/* hero */` + `/* access panel */` + a regra `.pa-hero .pa-btn-primary` por:

```css
  /* hero */
  .pa-hero { position: relative; isolation: isolate; background: var(--pa-navy-dark); padding: 88px 0 72px; overflow: hidden; }
  .pa-hero-media { object-fit: cover; opacity: .18; z-index: -2; }
  .pa-hero-overlay { position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgba(15,31,69,.72), rgba(15,31,69,.94)); }
  .pa-hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 48px; align-items: start; }
  .pa-eyebrow { display: inline-block; font-family: var(--pa-geist); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; font-size: 12px; color: #fff; background: var(--pa-green); padding: 6px 14px; border-radius: var(--pa-r-pill); margin: 0 0 18px; }
  .pa-hero h1 { font-family: var(--pa-geist); font-weight: 700; letter-spacing: -0.025em; color: #fff; font-size: clamp(32px, 4.6vw, 48px); line-height: 1.08; margin: 0 0 16px; max-width: 18ch; }
  .pa-hero h1 .pa-hl { color: #4ADE80; }
  .pa-hero-lead { color: rgba(255,255,255,0.82); font-size: 18px; line-height: 1.55; max-width: 46ch; margin: 0 0 24px; }
  .pa-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
  .pa-btn-hero-ghost { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,0.5); border-radius: var(--pa-r-pill); font-family: var(--pa-geist); font-weight: 600; font-size: 15px; padding: 12px 24px; text-decoration: none; display: inline-flex; align-items: center; transition: border-color .18s ease, background .18s ease; }
  .pa-btn-hero-ghost:hover { border-color: #fff; background: rgba(255,255,255,0.08); }

  /* access panel */
  .pa-panel { background: #fff; border-radius: var(--pa-r-card); padding: 26px 24px; box-shadow: 0 24px 60px rgba(15,31,69,0.35); }
  .pa-panel > h2 { font-family: var(--pa-geist); font-weight: 700; color: var(--pa-navy); font-size: 20px; margin: 0 0 4px; }
  .pa-panel-sub { color: var(--pa-muted); font-size: 13px; margin: 0 0 6px; }
  .pa-panel form label { display: block; font-family: var(--pa-geist); font-weight: 600; font-size: 13px; color: var(--pa-navy); margin: 14px 0 6px; }
  .pa-panel form input { width: 100%; padding: 12px 14px; border: 1.5px solid var(--pa-line); border-radius: var(--pa-r-input); font-size: 15px; font-family: inherit; color: var(--pa-ink); background: #fff; }
  .pa-panel form input:focus { outline: none; border-color: var(--pa-green); box-shadow: 0 0 0 3px var(--pa-green-soft); }
  .pa-panel form input[aria-invalid="true"] { border-color: #C0392B; }
  .pa-panel form input[aria-invalid="true"]:focus { box-shadow: 0 0 0 3px #F9DEDB; }
  .pa-panel form .pa-field-help { color: var(--pa-muted); font-size: 12px; line-height: 1.4; margin: 6px 0 0; }
  .pa-panel form p[role="alert"] { color: #C0392B; font-weight: 600; font-size: 13px; margin: 12px 0 0; }
  .pa-panel form > p:not([role]) { color: var(--pa-muted); font-size: 12px; line-height: 1.5; margin: 14px 0 0; }
  .pa-panel form button[type="submit"] { width: 100%; margin-top: 16px; padding: 13px; background: var(--pa-green); color: #fff; border: 0; border-radius: var(--pa-r-pill); font-family: var(--pa-geist); font-weight: 600; font-size: 15px; cursor: pointer; transition: background .18s ease; }
  .pa-panel form button[type="submit"]:hover { background: var(--pa-green-dark); }
  .pa-panel form button[type="submit"]:disabled { opacity: .6; cursor: default; }
```

E no `@media (max-width: 900px)` garantir que a regra do hero continua:

```css
    .pa-hero-grid { grid-template-columns: 1fr; gap: 30px; }
```

- [ ] **Step 5: Rodar os testes**

Run: `pnpm --filter mypet test pre-access/hero`
Expected: PASS (3 testes).

Run: `pnpm --filter mypet test`
Expected: PASS geral (o `page.test.tsx` ainda tem um único h1).

- [ ] **Step 6: Verificação visual**

`pnpm --filter mypet dev` → `http://localhost:4100`. Hero navy, foto suave ao fundo, "claras" em verde, card branco do form à direita, tudo acima da dobra a 1280×800.

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/app/_components/pre-access/hero.tsx apps/mypet/app/_components/pre-access/hero.test.tsx apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(mypet): hero navy com foto de fundo e destaque verde

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Barra de métricas

**Files:**
- Create: `apps/mypet/app/_components/pre-access/metrics-bar.tsx`
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (adicionar bloco `/* metrics */`)
- Test: `apps/mypet/app/_components/pre-access/metrics-bar.test.tsx`

**Interfaces:**
- Consumes: `metrics` de `../../pre-access-content`.
- Produces: `export function MetricsBar(): JSX.Element` — sem props. Renderiza `<section aria-label="Números da operação">` com um item por métrica.

- [ ] **Step 1: Escrever o teste**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MetricsBar } from "./metrics-bar";

describe("MetricsBar", () => {
  it("renderiza as 4 métricas", () => {
    render(<MetricsBar />);
    const region = screen.getByRole("region", { name: "Números da operação" });
    expect(within(region).getByText("~5 mil")).toBeInTheDocument();
    expect(within(region).getByText(/itens no catálogo/)).toBeInTheDocument();
    expect(within(region).getAllByText(/.+/).length).toBeGreaterThanOrEqual(8);
  });

  it("não mostra preço de produto", () => {
    const { container } = render(<MetricsBar />);
    expect(container.textContent ?? "").not.toMatch(/R\$\s?\d/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter mypet test pre-access/metrics-bar`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `metrics-bar.tsx`**

```tsx
import { metrics } from "../../pre-access-content";

export function MetricsBar() {
  return (
    <section className="pa-metrics" aria-label="Números da operação">
      <div className="pa-wrap pa-metrics-row">
        {metrics.map((m) => (
          <div key={m.id} className="pa-metric">
            <span className="pa-metric-value">{m.value}</span>
            <span className="pa-metric-label">{m.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: CSS em `styles.ts`**

Adicionar antes de `/* sections */`:

```css
  /* metrics */
  .pa-metrics { background: var(--pa-bg-soft); border-bottom: 1px solid var(--pa-line); }
  .pa-metrics-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; padding: 28px 24px; }
  .pa-metric { padding: 4px 24px; border-left: 1px solid var(--pa-line); }
  .pa-metric:first-child { border-left: 0; padding-left: 0; }
  .pa-metric-value { display: block; font-family: var(--pa-mono); font-weight: 600; font-size: 24px; color: var(--pa-navy); letter-spacing: -0.02em; }
  .pa-metric-label { display: block; margin-top: 4px; font-size: 13px; line-height: 1.45; color: var(--pa-muted); }
  @media (max-width: 700px) {
    .pa-metrics-row { grid-template-columns: 1fr 1fr; gap: 20px 0; }
    .pa-metric:nth-child(odd) { border-left: 0; padding-left: 0; }
  }
  @media (max-width: 460px) {
    .pa-metrics-row { grid-template-columns: 1fr; }
    .pa-metric { border-left: 0; padding-left: 0; }
  }
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter mypet test pre-access/metrics-bar`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/app/_components/pre-access/metrics-bar.tsx apps/mypet/app/_components/pre-access/metrics-bar.test.tsx apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(mypet): barra de métricas da landing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Condições comerciais com ícones

**Files:**
- Modify: `apps/mypet/app/_components/pre-access/commercial-conditions.tsx`
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (bloco `/* condition cards */`)
- Test: `apps/mypet/app/_components/pre-access/commercial-conditions.test.tsx` (novo)

**Interfaces:**
- Consumes: `commercialConditions` de `../../pre-access-content` (agora com `icon`); `PaIcon` de `./icon`.
- Produces: `CommercialConditions` sem props. Mantém `id="condicoes"` e `aria-labelledby="condicoes-title"`.

- [ ] **Step 1: Escrever o teste**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CommercialConditions } from "./commercial-conditions";

describe("CommercialConditions", () => {
  it("renderiza um card com ícone svg por condição", () => {
    const { container } = render(<CommercialConditions />);
    const region = screen.getByRole("region", { name: "Condições comerciais" });
    expect(within(region).getByText("Pedido mínimo")).toBeInTheDocument();
    expect(container.querySelectorAll(".pa-cond-card svg").length).toBe(3);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter mypet test pre-access/commercial-conditions`
Expected: FAIL — não há `svg` nos cards.

- [ ] **Step 3: Editar `commercial-conditions.tsx`**

```tsx
import { commercialConditions } from "../../pre-access-content";
import { PaIcon } from "./icon";

export function CommercialConditions() {
  return (
    <section id="condicoes" className="pa-section" aria-labelledby="condicoes-title">
      <div className="pa-wrap">
        <h2 id="condicoes-title" className="pa-h2">Condições comerciais</h2>
        <p className="pa-sec-lead">
          O que define o pedido antes de qualquer conversa. Os valores exatos aparecem dentro da loja.
        </p>
        <ul className="pa-cond-grid" style={{ listStyle: "none", padding: 0 }}>
          {commercialConditions.map((c) => (
            <li key={c.id} className="pa-card pa-cond-card">
              <span className="pa-cond-icon">
                <PaIcon name={c.icon} size={26} />
              </span>
              <h3>{c.title}</h3>
              <p className="pa-cond-value">{c.value}</p>
              <p className="pa-cond-detail">{c.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: CSS em `styles.ts`**

Substituir o bloco `/* condition cards */` por:

```css
  /* condition cards */
  .pa-cond-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 28px; }
  .pa-card { background: #fff; border: 1px solid var(--pa-line); border-radius: var(--pa-r-card); padding: 24px; transition: transform .18s ease, box-shadow .18s ease; }
  .pa-cond-card { border-top: 3px solid var(--pa-green); }
  .pa-cond-icon { display: inline-flex; color: var(--pa-green-dark); margin-bottom: 12px; }
  .pa-cond-card h3 { font-family: var(--pa-geist); font-weight: 600; color: var(--pa-navy); font-size: 15px; margin: 0 0 6px; }
  .pa-cond-value { font-family: var(--pa-mono); font-weight: 600; color: var(--pa-green-dark); font-size: 17px; line-height: 1.3; margin: 0 0 8px; }
  .pa-cond-detail { color: var(--pa-muted); font-size: 13px; line-height: 1.55; margin: 0; }
```

- [ ] **Step 5: Rodar**

Run: `pnpm --filter mypet test pre-access/commercial-conditions`
Expected: PASS.
Run: `pnpm --filter mypet test`
Expected: PASS geral.

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/app/_components/pre-access/commercial-conditions.tsx apps/mypet/app/_components/pre-access/commercial-conditions.test.tsx apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(mypet): ícones nos cards de condições comerciais

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: "Como funciona em 4 passos" (substitui education-cards)

**Files:**
- Create: `apps/mypet/app/_components/pre-access/how-it-works.tsx`
- Delete: `apps/mypet/app/_components/pre-access/education-cards.tsx`
- Modify: `apps/mypet/app/page.tsx` (troca import/uso `EducationCards` → `HowItWorks`)
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (remove `/* education scroller */`, adiciona `/* steps */`)
- Test: `apps/mypet/app/_components/pre-access/how-it-works.test.tsx`

**Interfaces:**
- Consumes: `steps` de `../../pre-access-content`; `PaIcon` de `./icon`.
- Produces: `export function HowItWorks(): JSX.Element` — sem props. `<section id="como-funciona" aria-labelledby="como-funciona-title">`.

- [ ] **Step 1: Escrever o teste**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HowItWorks } from "./how-it-works";

describe("HowItWorks", () => {
  it("renderiza 4 passos numerados", () => {
    render(<HowItWorks />);
    const region = screen.getByRole("region", { name: /como funciona/i });
    expect(within(region).getByText("1")).toBeInTheDocument();
    expect(within(region).getByText("4")).toBeInTheDocument();
    expect(within(region).getByText("Acesso liberado na hora")).toBeInTheDocument();
    expect(within(region).getAllByRole("listitem")).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter mypet test pre-access/how-it-works`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `how-it-works.tsx`**

```tsx
import { steps } from "../../pre-access-content";
import { PaIcon } from "./icon";

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="pa-section pa-section--soft"
      aria-labelledby="como-funciona-title"
    >
      <div className="pa-wrap">
        <h2 id="como-funciona-title" className="pa-h2">Como funciona, em 4 passos</h2>
        <p className="pa-sec-lead">Do cadastro à entrega, sem cotação por WhatsApp.</p>
        <ol className="pa-steps" style={{ listStyle: "none", padding: 0 }}>
          {steps.map((s, i) => (
            <li key={s.id} className="pa-step">
              <span className="pa-step-num">{i + 1}</span>
              <span className="pa-step-icon">
                <PaIcon name={s.icon} size={22} />
              </span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: CSS em `styles.ts`**

Remover o bloco `/* education scroller */` inteiro. Adicionar:

```css
  /* steps */
  .pa-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 32px; position: relative; }
  .pa-steps::before { content: ""; position: absolute; top: 18px; left: 6%; right: 6%; height: 2px; background: var(--pa-line); z-index: 0; }
  .pa-step { position: relative; z-index: 1; }
  .pa-step-num { display: grid; place-items: center; width: 38px; height: 38px; border-radius: var(--pa-r-pill); background: var(--pa-navy); color: #fff; font-family: var(--pa-mono); font-weight: 600; font-size: 15px; }
  .pa-step-icon { display: inline-flex; color: var(--pa-green-dark); margin: 14px 0 8px; }
  .pa-step h3 { font-family: var(--pa-geist); font-weight: 600; color: var(--pa-navy); font-size: 15px; margin: 0 0 6px; }
  .pa-step p { color: var(--pa-muted); font-size: 13px; line-height: 1.55; margin: 0; }
  @media (max-width: 900px) {
    .pa-steps { grid-template-columns: 1fr; gap: 22px; }
    .pa-steps::before { top: 0; bottom: 0; left: 18px; right: auto; width: 2px; height: auto; }
  }
```

- [ ] **Step 5: Trocar em `page.tsx`**

Trocar `import { EducationCards } from "./_components/pre-access/education-cards";` por
`import { HowItWorks } from "./_components/pre-access/how-it-works";`
e no JSX `<EducationCards />` por `<HowItWorks />`.

- [ ] **Step 6: Deletar `education-cards.tsx`**

```bash
git rm apps/mypet/app/_components/pre-access/education-cards.tsx
```

- [ ] **Step 7: Rodar**

Run: `pnpm --filter mypet test pre-access/how-it-works`
Expected: PASS.
Run: `pnpm --filter mypet test`
Expected: PASS geral (nenhum import remanescente de `education-cards` / `educationCards`).

- [ ] **Step 8: Commit**

```bash
git add apps/mypet/app/_components/pre-access/how-it-works.tsx apps/mypet/app/_components/pre-access/how-it-works.test.tsx apps/mypet/app/_components/pre-access/styles.ts apps/mypet/app/page.tsx
git commit -m "feat(mypet): seção 'como funciona em 4 passos' (remove education-cards)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Vitrine do catálogo (funde popular-categories + fotos de produto)

**Files:**
- Create: `apps/mypet/app/_components/pre-access/catalog-preview.tsx` (via rename de `popular-categories.tsx`)
- Delete: `apps/mypet/app/_components/pre-access/popular-categories.tsx`
- Modify: `apps/mypet/app/page.tsx` (import/uso + passar `topCategories`/`thumbs` como já faz)
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (bloco `/* category tiles */` → `/* catalog preview */`)
- Test: `apps/mypet/app/_components/pre-access/catalog-preview.test.tsx`

**Interfaces:**
- Consumes: `categories: readonly {id;slug;name}[]`, `thumbs?: Record<string,string>` (idênticos aos de `PopularCategories` hoje).
- Produces: `export function CatalogPreview({ categories, thumbs }: { categories: readonly Category[]; thumbs?: Record<string, string> }): JSX.Element`. Mantém `id="categorias"`. **`aria-labelledby` aponta para um `<h2>` com o texto exato `Vitrine do catálogo`** (o `page.test.tsx` será atualizado na Task 13 para casar com esse nome).

- [ ] **Step 1: Escrever o teste**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CatalogPreview } from "./catalog-preview";

const cats = [
  { id: "1", slug: "racao", name: "Ração" },
  { id: "2", slug: "higiene", name: "Higiene" },
];

describe("CatalogPreview", () => {
  it("lista categorias sem qualquer preço", () => {
    render(<CatalogPreview categories={cats} thumbs={{}} />);
    const region = screen.getByRole("region", { name: "Vitrine do catálogo" });
    expect(within(region).getByText("Ração")).toBeInTheDocument();
    expect(within(region).queryByText(/R\$\s?\d/)).toBeNull();
    expect(within(region).queryByText(/\bSKU\b/i)).toBeNull();
  });

  it("aponta tudo para o formulário de acesso", () => {
    const { container } = render(<CatalogPreview categories={cats} thumbs={{}} />);
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((a) => a.getAttribute("href") === "#acesso")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter mypet test pre-access/catalog-preview`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Criar `catalog-preview.tsx`**

```tsx
// Server component. Recebe categorias + mapa opcional de imagens (id -> url).
// Só nome e foto. NENHUM preço, NENHUM SKU, NENHUM ProductCard nesta página.

type Category = { id: string; slug: string; name: string };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function CatalogPreview({
  categories,
  thumbs = {},
}: {
  categories: readonly Category[];
  thumbs?: Record<string, string>;
}) {
  return (
    <section id="categorias" className="pa-section" aria-labelledby="categorias-title">
      <div className="pa-wrap">
        <h2 id="categorias-title" className="pa-h2">Vitrine do catálogo</h2>
        <p className="pa-sec-lead">
          Reconheça o mix da sua loja. Preço, estoque e carrinho só na loja, depois do acesso.
        </p>

        <ul className="pa-cat-grid" style={{ listStyle: "none", padding: 0 }}>
          {categories.map((category) => {
            const src = thumbs[category.id];
            return (
              <li key={category.id}>
                <a className="pa-cat-tile" href="#acesso">
                  <span className="pa-cat-media">
                    {src ? (
                      <img src={src} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span className="pa-cat-fallback" aria-hidden>
                        {initials(category.name)}
                      </span>
                    )}
                  </span>
                  <span className="pa-cat-name">{category.name}</span>
                </a>
              </li>
            );
          })}
        </ul>

        <p className="pa-cat-note">
          Catálogo completo com quase 5 mil itens abre assim que você cria o acesso.
        </p>
      </div>
    </section>
  );
}
```

> Nota: a "fileira de fotos de produto" do spec fica atrás de assets que ainda não chegaram. Não adicionar `<img>` de produto com placeholder aleatório aqui (risco de parecer preço/mock). Manter só os tiles de categoria (que já têm foto real via `thumbs`) e a nota. Quando as fotos de produto reais chegarem, entram como um segundo `<ul className="pa-prod-strip">` nesta seção.

- [ ] **Step 4: CSS em `styles.ts`**

Renomear o comentário `/* category tiles */` para `/* catalog preview */` e ajustar/estender:

```css
  /* catalog preview */
  .pa-cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; margin-top: 28px; }
  .pa-cat-tile { display: flex; flex-direction: column; border: 1px solid var(--pa-line); border-radius: var(--pa-r-card); overflow: hidden; text-decoration: none; background: #fff; transition: transform .18s ease, box-shadow .18s ease; }
  .pa-cat-tile:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(15,31,69,0.12); }
  .pa-cat-media { aspect-ratio: 4 / 3; background: var(--pa-navy-soft); display: flex; align-items: center; justify-content: center; }
  .pa-cat-media img { width: 100%; height: 100%; object-fit: cover; }
  .pa-cat-fallback { font-family: var(--pa-geist); font-weight: 700; font-size: 24px; color: var(--pa-navy); opacity: .4; }
  .pa-cat-name { padding: 12px 14px; font-family: var(--pa-geist); font-weight: 600; font-size: 13px; color: var(--pa-navy); }
  .pa-cat-note { margin: 22px 0 0; font-size: 13px; color: var(--pa-muted); }
```

- [ ] **Step 5: Trocar em `page.tsx`**

`import { PopularCategories } from "./_components/pre-access/popular-categories";` → `import { CatalogPreview } from "./_components/pre-access/catalog-preview";`
`<PopularCategories categories={topCategories} thumbs={thumbs} />` → `<CatalogPreview categories={topCategories} thumbs={thumbs} />`

- [ ] **Step 6: Deletar o antigo**

```bash
git rm apps/mypet/app/_components/pre-access/popular-categories.tsx
```

- [ ] **Step 7: Rodar**

Run: `pnpm --filter mypet test pre-access/catalog-preview`
Expected: PASS.
Run: `pnpm --filter mypet test`
Expected: `page.test.tsx` **FALHA** no teste "mostra nomes de categoria sem qualquer preço" porque procura a region `"Categorias mais procuradas"`. Isso é esperado e corrigido na Task 13. Se estiver executando via subagent com gate estrito, anotar como falha conhecida e prosseguir; senão, aplicar já o ajuste do nome da region no `page.test.tsx` (ver Task 13, Step 2) e commitar junto.

- [ ] **Step 8: Commit**

```bash
git add apps/mypet/app/_components/pre-access/catalog-preview.tsx apps/mypet/app/_components/pre-access/catalog-preview.test.tsx apps/mypet/app/_components/pre-access/styles.ts apps/mypet/app/page.tsx
git commit -m "feat(mypet): vitrine do catálogo (renomeia popular-categories)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Depoimentos

**Files:**
- Create: `apps/mypet/app/_components/pre-access/testimonials.tsx`
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (bloco `/* testimonials */`)
- Test: `apps/mypet/app/_components/pre-access/testimonials.test.tsx`

**Interfaces:**
- Consumes: `testimonials` de `../../pre-access-content`; `PaIcon` de `./icon`.
- Produces: `export function Testimonials(): JSX.Element` — sem props. `<section aria-labelledby="depoimentos-title">` com `<h2 id="depoimentos-title">O que dizem os lojistas</h2>`.

- [ ] **Step 1: Escrever o teste**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Testimonials } from "./testimonials";

describe("Testimonials", () => {
  it("renderiza 3 depoimentos com atribuição", () => {
    render(<Testimonials />);
    const region = screen.getByRole("region", { name: "O que dizem os lojistas" });
    expect(within(region).getAllByRole("figure")).toHaveLength(3);
    expect(within(region).getByText(/Renata Alcântara/)).toBeInTheDocument();
    expect(within(region).getByText(/Sorocaba, SP/)).toBeInTheDocument();
  });

  it("não usa em-dash na atribuição", () => {
    const { container } = render(<Testimonials />);
    expect(container.textContent ?? "").not.toMatch(/[–—]/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter mypet test pre-access/testimonials`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `testimonials.tsx`**

```tsx
import { testimonials } from "../../pre-access-content";
import { PaIcon } from "./icon";

export function Testimonials() {
  return (
    <section className="pa-section" aria-labelledby="depoimentos-title">
      <div className="pa-wrap">
        <h2 id="depoimentos-title" className="pa-h2">O que dizem os lojistas</h2>
        <div className="pa-quote-grid">
          {testimonials.map((t) => (
            <figure key={t.id} className="pa-quote">
              <div className="pa-quote-stars" aria-label="5 de 5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <PaIcon key={i} name="Star" size={15} weight="fill" />
                ))}
              </div>
              <blockquote>{t.quote}</blockquote>
              <figcaption>
                <strong>{t.name}</strong>
                <span>{t.city} · {t.store}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: CSS em `styles.ts`**

```css
  /* testimonials */
  .pa-quote-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 28px; }
  .pa-quote { margin: 0; background: var(--pa-navy-soft); border-radius: var(--pa-r-card); padding: 24px; }
  .pa-quote-stars { display: flex; gap: 2px; color: var(--pa-green); margin-bottom: 12px; }
  .pa-quote blockquote { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: var(--pa-ink); }
  .pa-quote figcaption strong { display: block; font-family: var(--pa-geist); font-weight: 600; font-size: 14px; color: var(--pa-navy); }
  .pa-quote figcaption span { display: block; margin-top: 2px; font-size: 13px; color: var(--pa-muted); }
  @media (max-width: 900px) { .pa-quote-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter mypet test pre-access/testimonials`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/app/_components/pre-access/testimonials.tsx apps/mypet/app/_components/pre-access/testimonials.test.tsx apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(mypet): seção de depoimentos (dados placeholder)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Restyle do FAQ

**Files:**
- Modify: `apps/mypet/app/_components/pre-access/commercial-faq.tsx` (só classe do wrapper)
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (bloco `/* faq */`)
- Test: roda `page.test.tsx` (o teste do FAQ já existe: `getAllByRole("group").length >= 8`)

**Interfaces:**
- Consumes: `commercialFaq` (inalterado).
- Produces: `CommercialFaq` sem mudança de API. `id="faq"` mantido.

- [ ] **Step 1: Trocar o fundo creme por off-white no componente**

Em `commercial-faq.tsx`, trocar `className="pa-section pa-faq"` por `className="pa-section pa-section--soft pa-faq"` (mantém `pa-faq` para as regras específicas do accordion).

- [ ] **Step 2: Substituir o bloco `/* faq */` em `styles.ts`**

```css
  /* faq */
  .pa-faq .pa-wrap { max-width: 820px; }
  .pa-faq-list { margin-top: 24px; border-top: 1px solid var(--pa-line); }
  .pa-faq details { border-bottom: 1px solid var(--pa-line); }
  .pa-faq summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 4px; font-family: var(--pa-geist); font-weight: 600; font-size: 15px; color: var(--pa-navy); }
  .pa-faq summary::-webkit-details-marker { display: none; }
  .pa-faq summary::after { content: "+"; flex: 0 0 auto; width: 26px; height: 26px; border-radius: var(--pa-r-pill); background: var(--pa-green); color: #fff; font-weight: 600; display: grid; place-items: center; font-size: 16px; line-height: 1; }
  .pa-faq details[open] summary::after { content: "\\2212"; }
  .pa-faq details p { margin: 0; padding: 0 4px 18px; color: var(--pa-muted); font-size: 14px; line-height: 1.6; }
```

> O `content: "\\2212"` (sinal de menos) já era usado no arquivo original; manter o escape duplo dentro da template string.

- [ ] **Step 3: Rodar**

Run: `pnpm --filter mypet test`
Expected: PASS (o teste do FAQ conta `<details>` como role `group`, inalterado).

- [ ] **Step 4: Commit**

```bash
git add apps/mypet/app/_components/pre-access/commercial-faq.tsx apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(mypet): restyle do FAQ (off-white, Geist)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Faixa "Como a My Pet opera" enxuta

**Files:**
- Modify: `apps/mypet/app/_components/pre-access/institutional-trust.tsx`
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (bloco `/* institutional */`)
- Test: `apps/mypet/app/_components/pre-access/institutional-trust.test.tsx` (novo)

**Interfaces:**
- Consumes: `PaIcon` de `./icon`. Mantém a prop `{ categoryCount: number }`.
- Produces: `InstitutionalTrust({ categoryCount })` — `<section aria-labelledby="institucional-title">`, 3 pontos com ícone, uma frase cada.

- [ ] **Step 1: Escrever o teste**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { InstitutionalTrust } from "./institutional-trust";

describe("InstitutionalTrust", () => {
  it("mostra 3 pontos com ícone", () => {
    const { container } = render(<InstitutionalTrust categoryCount={12} />);
    const region = screen.getByRole("region", { name: "Como a My Pet opera" });
    expect(within(region).getByText(/Compra por CNPJ/)).toBeInTheDocument();
    expect(within(region).getByText(/12 categorias/)).toBeInTheDocument();
    expect(container.querySelectorAll(".pa-inst-item svg").length).toBe(3);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter mypet test pre-access/institutional-trust`
Expected: FAIL — sem `svg` nos itens; texto atual é mais longo.

- [ ] **Step 3: Reescrever `institutional-trust.tsx`**

```tsx
import { PaIcon } from "./icon";

export function InstitutionalTrust({ categoryCount }: { categoryCount: number }) {
  const items = [
    {
      id: "cnpj",
      icon: "Storefront",
      heading: "Compra por CNPJ",
      body: "Distribuição para o ramo pet. A loja é exclusiva para pessoa jurídica.",
    },
    {
      id: "catalogo",
      icon: "Stack",
      heading: categoryCount > 0 ? `${categoryCount} categorias em destaque` : "Catálogo por categoria",
      body: "O catálogo completo com preço abre depois do acesso.",
    },
    {
      id: "suporte",
      icon: "Headset",
      heading: "Suporte pós-acesso",
      body: "O WhatsApp fica para dúvida de pedido, não para liberar preço.",
    },
  ];

  return (
    <section className="pa-section pa-inst" aria-labelledby="institucional-title">
      <div className="pa-wrap">
        <h2 id="institucional-title" className="pa-h2">Como a My Pet opera</h2>
        <div className="pa-inst-grid">
          {items.map((item) => (
            <div key={item.id} className="pa-inst-item">
              <span className="pa-inst-icon"><PaIcon name={item.icon} size={22} /></span>
              <strong>{item.heading}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Substituir o bloco `/* institutional */` em `styles.ts`**

```css
  /* institutional */
  .pa-inst-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 24px; }
  .pa-inst-item { padding-top: 20px; border-top: 2px solid var(--pa-navy); }
  .pa-inst-icon { display: inline-flex; color: var(--pa-green-dark); margin-bottom: 10px; }
  .pa-inst-item strong { display: block; font-family: var(--pa-geist); font-weight: 600; color: var(--pa-navy); font-size: 15px; margin-bottom: 6px; }
  .pa-inst-item p { margin: 0; color: var(--pa-muted); font-size: 14px; line-height: 1.55; }
  @media (max-width: 900px) { .pa-inst-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Rodar**

Run: `pnpm --filter mypet test pre-access/institutional-trust`
Expected: PASS.
Run: `pnpm --filter mypet test`
Expected: PASS geral.

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/app/_components/pre-access/institutional-trust.tsx apps/mypet/app/_components/pre-access/institutional-trust.test.tsx apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(mypet): faixa institucional enxuta com ícones

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Faixa de CTA final

**Files:**
- Create: `apps/mypet/app/_components/pre-access/closing-cta.tsx`
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (bloco `/* closing cta */`)
- Test: `apps/mypet/app/_components/pre-access/closing-cta.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `export function ClosingCta(): JSX.Element` — `<section aria-labelledby="cta-final-title">` com `<h2 id="cta-final-title">` e um `<a class="pa-btn pa-btn-primary" href="#acesso">Criar acesso à loja</a>`.

- [ ] **Step 1: Escrever o teste**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ClosingCta } from "./closing-cta";

describe("ClosingCta", () => {
  it("tem um CTA para #acesso com o rótulo padrão", () => {
    render(<ClosingCta />);
    const region = screen.getByRole("region", { name: /criar acesso/i });
    const link = within(region).getByRole("link", { name: "Criar acesso à loja" });
    expect(link).toHaveAttribute("href", "#acesso");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter mypet test pre-access/closing-cta`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `closing-cta.tsx`**

```tsx
export function ClosingCta() {
  return (
    <section className="pa-closing" aria-labelledby="cta-final-title">
      <div className="pa-wrap pa-closing-inner">
        <h2 id="cta-final-title">Pronto para comprar no atacado</h2>
        <p>Cadastro com CNPJ e WhatsApp. A loja abre na hora, sem cotação por WhatsApp.</p>
        <a href="#acesso" className="pa-btn pa-btn-primary">Criar acesso à loja</a>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: CSS em `styles.ts`**

```css
  /* closing cta */
  .pa-closing { background: var(--pa-navy-dark); padding: 80px 0; }
  .pa-closing-inner { text-align: center; }
  .pa-closing h2 { font-family: var(--pa-geist); font-weight: 700; letter-spacing: -0.02em; color: #fff; font-size: clamp(24px, 3.2vw, 34px); margin: 0 0 12px; }
  .pa-closing p { color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 auto 24px; max-width: 52ch; }
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter mypet test pre-access/closing-cta`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/app/_components/pre-access/closing-cta.tsx apps/mypet/app/_components/pre-access/closing-cta.test.tsx apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(mypet): faixa de CTA final da landing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Composição da página + header/footer + testes de página

**Files:**
- Modify: `apps/mypet/app/page.tsx` (ordem das seções, header, footer)
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (blocos `/* header */`, `/* footer */`, `@media` finais, bloco `@media (prefers-reduced-motion: no-preference)` de fade-up)
- Modify: `apps/mypet/app/page.test.tsx`
- Test: `apps/mypet/app/page.test.tsx`

**Interfaces:**
- Consumes: `Hero`, `MetricsBar`, `CommercialConditions`, `HowItWorks`, `CatalogPreview`, `Testimonials`, `CommercialFaq`, `InstitutionalTrust`, `ClosingCta`.
- Produces: `LandingPage` (default export) — inalterado como assinatura.

- [ ] **Step 1: Atualizar `page.tsx`**

Imports (bloco no topo):

```tsx
import type { Metadata } from "next";
import { getCategories } from "@mypet/core/catalog";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { getCategoryThumbs } from "./_data/category-thumbs";
import { Hero } from "./_components/pre-access/hero";
import { MetricsBar } from "./_components/pre-access/metrics-bar";
import { CommercialConditions } from "./_components/pre-access/commercial-conditions";
import { HowItWorks } from "./_components/pre-access/how-it-works";
import { CatalogPreview } from "./_components/pre-access/catalog-preview";
import { Testimonials } from "./_components/pre-access/testimonials";
import { CommercialFaq } from "./_components/pre-access/commercial-faq";
import { InstitutionalTrust } from "./_components/pre-access/institutional-trust";
import { ClosingCta } from "./_components/pre-access/closing-cta";
import { LANDING_STYLES } from "./_components/pre-access/styles";
```

`<main>` (ordem do spec):

```tsx
      <main>
        <Hero />
        <MetricsBar />
        <CommercialConditions />
        <HowItWorks />
        <CatalogPreview categories={topCategories} thumbs={thumbs} />
        <Testimonials />
        <CommercialFaq />
        <InstitutionalTrust categoryCount={topCategories.length} />
        <ClosingCta />
      </main>
```

Header `<nav>`: acrescentar link para `#como-funciona` e manter o CTA:

```tsx
          <nav className="pa-nav" aria-label="Seções da página">
            <a href="#condicoes">Condições</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#categorias">Categorias</a>
            <a href="#faq">Dúvidas</a>
            <a href="#acesso" className="pa-nav-cta">Criar acesso</a>
          </nav>
```

O `<footer>` mantém a estrutura; só as classes/estilo mudam via CSS.

- [ ] **Step 2: Atualizar `page.test.tsx`**

Substituir o arquivo por:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@mypet/core/catalog", () => ({
  getCategories: async () => [
    { id: "1", slug: "racao", name: "Ração" },
    { id: "2", slug: "higiene", name: "Higiene" },
  ],
}));

vi.mock("./_data/category-thumbs", () => ({
  getCategoryThumbs: async () => ({}),
}));

import LandingPage from "./page";

describe("LandingPage", () => {
  it("renderiza condições, como funciona, depoimentos, FAQ e CTA final", async () => {
    render(await LandingPage());
    expect(screen.getByText("Pedido mínimo")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /como funciona/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "O que dizem os lojistas" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Números da operação" })).toBeInTheDocument();
    expect(screen.getAllByRole("group").length).toBeGreaterThanOrEqual(8); // <details> do FAQ
  });

  it("a vitrine do catálogo mostra categorias sem qualquer preço", async () => {
    render(await LandingPage());
    const vitrine = screen.getByRole("region", { name: "Vitrine do catálogo" });
    expect(within(vitrine).getByText("Ração")).toBeInTheDocument();
    expect(within(vitrine).queryByText(/R\$\s?\d/)).toBeNull();
    expect(within(vitrine).queryByText(/\bSKU\b/i)).toBeNull();
  });

  it("tem um único h1", async () => {
    render(await LandingPage());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("usa o mesmo rótulo de CTA de conversão no header, hero e faixa final", async () => {
    const { container } = render(await LandingPage());
    const acessoLinks = Array.from(container.querySelectorAll('a[href="#acesso"]'));
    expect(acessoLinks.length).toBeGreaterThanOrEqual(2);
  });

  it("não tem em-dash na copy visível da página", async () => {
    const { container } = render(await LandingPage());
    expect(container.textContent ?? "").not.toMatch(/[–—]/);
  });
});
```

- [ ] **Step 3: Header/footer/motion em `styles.ts`**

Substituir o bloco `/* header */`:

```css
  /* header */
  .pa-header { position: sticky; top: 0; z-index: 20; background: rgba(255,255,255,0.92); backdrop-filter: saturate(180%) blur(8px); border-bottom: 1px solid var(--pa-line); }
  .pa-header-row { display: flex; align-items: center; justify-content: space-between; height: 68px; }
  .pa-brand { display: flex; align-items: center; gap: 8px; font-family: var(--pa-geist); font-weight: 700; color: var(--pa-navy); font-size: 17px; }
  .pa-brand span:first-child { font-size: 20px; }
  .pa-nav { display: flex; align-items: center; gap: 22px; }
  .pa-nav a { color: var(--pa-muted); text-decoration: none; font-weight: 500; font-size: 14px; }
  .pa-nav a:hover { color: var(--pa-navy); }
  .pa-nav a.pa-nav-cta { color: #fff; background: var(--pa-green); padding: 8px 16px; border-radius: var(--pa-r-pill); font-weight: 600; }
  .pa-nav a.pa-nav-cta:hover { background: var(--pa-green-dark); color: #fff; }
```

Substituir o bloco `/* footer */`:

```css
  /* footer */
  .pa-footer { background: var(--pa-navy-dark); color: rgba(255,255,255,0.82); padding: 32px 0 calc(32px + env(safe-area-inset-bottom)); }
  .pa-footer-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; }
  .pa-footer-brand { display: flex; align-items: center; gap: 8px; font-family: var(--pa-geist); font-weight: 600; font-size: 14px; color: #fff; }
  .pa-footer small { color: rgba(255,255,255,0.55); font-size: 12px; max-width: 54ch; }
```

Substituir o bloco `@media (prefers-reduced-motion: no-preference)` por (inclui o fade-up leve das seções):

```css
  @media (prefers-reduced-motion: no-preference) {
    .pa-btn:active, .pa-btn-hero-ghost:active { transform: translateY(1px); }
    .pa-card:hover { transform: translateY(-3px); box-shadow: 0 14px 32px rgba(15,31,69,0.14); }
    .pa-section > .pa-wrap, .pa-inst > .pa-wrap, .pa-closing-inner { animation: pa-rise .5s ease both; animation-timeline: view(); animation-range: entry 0% cover 22%; }
  }
  @keyframes pa-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
```

Ajustar o `@media (max-width: 900px)` e `@media (max-width: 560px)` finais para incluir as novas seções:

```css
  @media (max-width: 900px) {
    .pa-hero-grid { grid-template-columns: 1fr; gap: 30px; }
    .pa-cond-grid { grid-template-columns: 1fr; }
    .pa-inst-grid { grid-template-columns: 1fr; }
    .pa-quote-grid { grid-template-columns: 1fr; }
    .pa-steps { grid-template-columns: 1fr; }
  }
  @media (max-width: 560px) {
    .pa-nav { gap: 12px; }
    .pa-nav a:not(.pa-nav-cta) { display: none; }
  }
```

- [ ] **Step 4: Rodar a suíte inteira do app**

Run: `pnpm --filter mypet test`
Expected: PASS — todos os arquivos (`page.test.tsx`, `pre-access-content.test.ts`, todos os `pre-access/*.test.tsx`, e os testes pré-existentes `loja`, `pedidos`, `sitemap`, `mega-menu`).

- [ ] **Step 5: Lint + build**

Run: `pnpm --filter mypet build`
Expected: build passa. Sem erro de RSC do Phosphor (importado via `/dist/ssr`). Sem `next/image` sem `sizes`.

Run (da raiz): `pnpm lint`
Expected: sem erros novos.

- [ ] **Step 6: Verificação visual final**

`pnpm --filter mypet dev` → `http://localhost:4100`. Checklist rápido:
- Hero navy cabe na viewport a 1280×800, CTA visível sem rolar.
- Só o hero tem eyebrow (nenhuma outra seção com label uppercase).
- Um acento verde só; zero amarelo; zero em-dash.
- Métricas em Geist Mono; foto de categoria nos tiles; depoimentos com estrelas.
- Mobile 375px: nav colapsa, grids viram 1 coluna, stepper vira vertical.
- `prefers-reduced-motion: reduce` no DevTools: nada anima.

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/app/page.tsx apps/mypet/app/page.test.tsx apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(mypet): composição final da landing (seções, header/footer, testes)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage**

| Requisito do spec | Task |
|---|---|
| Fonte Geist / Geist Mono | 1 |
| Tokens navy âncora + verde acento único, raio único | 1 |
| Dependência Phosphor via `/dist/ssr` | 1, 3 |
| `globals.css` mapeando `--font-sans/mono` | 1 |
| Arrays `metrics`, `steps`, `testimonials`; `icon` em conditions; remover `educationCards`; varredura em-dash | 2 |
| Hero navy com foto de fundo (`next/image` fill + overlay) + palavra em verde + card de acesso | 4 |
| Barra de métricas (4 números reais, sem contagem de lojas) | 5 |
| Condições com ícone + valor em mono | 6 |
| "Como funciona em 4 passos" (stepper) substituindo education-cards | 7 |
| Vitrine do catálogo (rename popular-categories), sem preço/SKU, invariante testada | 8, 13 |
| Depoimentos (placeholder fictício marcado) | 2, 9 |
| FAQ restyle off-white | 10 |
| Institucional enxuto com ícone | 11 |
| Faixa de CTA final navy, rótulo de CTA único | 12, 13 |
| Header uma linha + CTA pill; footer restyle sem version stamp | 13 |
| Só o hero com eyebrow | 4 (eyebrow), 13 (verificação) |
| Movimento dial 2-3, reduced-motion | 13 |
| Light-locked (sem dark mode) | 1 (nenhum bloco `prefers-color-scheme`) |
| Testes: seções presentes, invariante de preço, hrefs de CTA, sem em-dash | 13 (+ por-componente 2,4,5,7,8,9,12) |
| `education-cards` sem import quebrado | 2 (stub), 7 (remoção) |
| Fora do alcance: sem Tailwind novo, sem lib de animação, AccessForm/rotas intactas | respeitado em todas |

Sem lacuna identificada.

**2. Placeholder scan**

- Slots `picsum`/`TODO` são intencionais (assets pendentes do usuário), sempre acompanhados de comentário no código e não bloqueiam teste nem build. `testimonials` fictícios idem, com comentário de topo no array. Nenhum "TBD"/"implementar depois" em passo de plano; todo passo com código mostra o código completo.

**3. Type consistency**

- `PaIcon({ name, size?, weight? })` — assinatura idêntica nas tasks 3, 6, 7, 9, 11.
- `CatalogPreview({ categories, thumbs })` — mesmo shape de `PopularCategories`; `page.tsx` (task 8/13) passa `topCategories`/`thumbs` como antes.
- `metrics` = `{id,value,label}`, `steps` = `{id,icon,title,body}`, `testimonials` = `{id,quote,name,city,store}` — definidos na task 2, consumidos com esses campos nas tasks 5, 7, 9.
- `commercialConditions[i].icon` (string) — adicionado na task 2, lido na task 6.
- Region names usados em teste batem com `aria-label`/`aria-labelledby` do componente: "Números da operação" (5), "Condições comerciais" (6, já existe no componente atual via `aria-labelledby`), /como funciona/i (7,13), "Vitrine do catálogo" (8,13), "O que dizem os lojistas" (9,13), "Como a My Pet opera" (11), /criar acesso/i (12).

> Observação para o executor: o `aria-labelledby` de `CommercialConditions` já aponta para o `<h2>` "Condições comerciais" no componente atual — a `region` com esse nome acessível já funciona sem mudança extra.

Sem inconsistência remanescente.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-03-mypet-landing-redesign.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
