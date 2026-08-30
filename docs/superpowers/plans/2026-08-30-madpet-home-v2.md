# MAD PET Home v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar em `/v2` uma segunda home do canal MAD PET com a estrutura de seções do atacado Zarpellon (barra de aviso, header central, mosaico de categorias, faixa de vantagens, sobre com mídia, depoimentos, newsletter, rodapé denso) e a identidade visual MAD PET.

**Architecture:** Nova rota App Router `apps/madpet/app/v2/page.tsx` (server component) que monta um conjunto próprio de componentes em `apps/madpet/components/v2/`, reaproveitando dados (`PRODUCT_LINES`, `clientConfig`, `buildWhatsAppLink`), tema (`madPetPalette`, `theme`) e os componentes de catálogo existentes (`CatalogSection`, `LineSection`, `WhatsAppFloatButton`, `Logo`, `BonePattern`). Único arquivo existente alterado: append de classes `mpv2-*` em `app/globals.css`. A home v1 (`app/page.tsx`) não é tocada.

**Tech Stack:** Next.js 16.2.6 (App Router, React 19.2.4), TypeScript, Tailwind v4 apenas via `@import` no globals (o layout usa `style` inline + tokens do tema, padrão do app). Sem libs novas.

## Global Constraints

- **Sem infraestrutura de teste no app `madpet`** — não há `test` script nem runner. O gate de cada task é `pnpm --filter madpet build` concluir sem erro (typecheck incluso) + inspeção visual em `/v2`. Não criar arquivos de teste.
- **Idioma de estilo:** `style` inline nos componentes + `madPetPalette as palette` e `theme` de `@/client-theme`. Sem CSS-in-JS, sem novas dependências.
- **Fontes:** `fontFamily: "var(--font-fredoka)"` em títulos; corpo herda Nunito do `body`.
- **Paleta (brand guide, `client-theme.ts`):** Verde Mad **só em AÇÃO** (botões WhatsApp, selo de frete) — nunca fundo de área grande nem texto. Áreas de impacto em `palette.purpleDark` (#523078). Base clara alternando `palette.white` / `palette.purpleLight`. Azul/amarelo só dentro do `<Logo>`.
- **Imagens:** placeholders `https://picsum.photos/seed/<seed>/<w>/<h>` com `<img>` precedido de `{/* eslint-disable-next-line @next/next/no-img-element */}` e um comentário `TODO` de foto/vídeo real — padrão já usado em `hero.tsx` e `why-resell.tsx`.
- **Prefixo de classe CSS:** `mpv2-` para tudo que for adicionado ao globals, evitando colisão com as classes `mp-*` da v1.
- **WhatsApp:** `buildWhatsAppLink(phoneNumber: string, message: string): string` de `@mypet/core/whatsapp`. Links externos sempre com `target="_blank" rel="noopener noreferrer"`.
- **Acessibilidade:** um único `<h1>` na página (no `CategoryMosaic`); demais títulos `<h2>`/`<h3>`. Ícones decorativos com `aria-hidden="true"`.
- **Branch:** trabalhar direto em `main` (preferência registrada do usuário — sem worktree). Commit por task.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/madpet/app/v2/page.tsx` | **Criar.** Rota `/v2`. Server component. Monta links do WhatsApp, ordena as seções, exporta `metadata`. |
| `apps/madpet/app/globals.css` | **Modificar (append).** Classes responsivas `mpv2-mosaic`, `mpv2-adv`, `mpv2-about`, `mpv2-footer`, `mpv2-nav`, `mpv2-nav-toggle`. |
| `apps/madpet/components/v2/announcement-bar.tsx` | **Criar.** Faixa topo estática (frete grátis por faixa). Server. |
| `apps/madpet/components/v2/site-header.tsx` | **Criar.** Header sticky, wordmark central + nav + CTA. Toggle mobile. Client. |
| `apps/madpet/components/v2/category-mosaic.tsx` | **Criar.** Grid 2×3: 4 tiles de linha (âncora) + 2 temáticos (WhatsApp). Contém o `<h1>`. Server. |
| `apps/madpet/components/v2/advantages-strip.tsx` | **Criar.** 4 vantagens com ícone SVG inline. Server. |
| `apps/madpet/components/v2/about-block.tsx` | **Criar.** Seção escura + bloco de mídia (thumb + play, sem player) + CTA atacadista. Server. |
| `apps/madpet/lib/testimonials.ts` | **Criar.** Tipo `Testimonial` + `TESTIMONIALS` (5 mocks). |
| `apps/madpet/components/v2/testimonials-carousel.tsx` | **Criar.** Carrossel de 1 depoimento, setas + dots. Client. |
| `apps/madpet/components/v2/newsletter-block.tsx` | **Criar.** Form e-mail só visual (`preventDefault`, estado local). Client. |
| `apps/madpet/components/v2/site-footer.tsx` | **Criar.** Rodapé escuro, 4 colunas + sociais SVG. Server. |

Reaproveitados sem alteração: `components/catalog-section.tsx`, `components/line-section.tsx`, `components/whatsapp-float-button.tsx`, `components/logo.tsx`, `components/bone-pattern.tsx`.

---

## Task 1: Rota `/v2` + classes responsivas

**Files:**
- Create: `apps/madpet/app/v2/page.tsx`
- Modify: `apps/madpet/app/globals.css` (append no final)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:
  - Rota `/v2` renderizável.
  - `default export HomeV2()` — server component; nas tasks seguintes recebe imports e elementos de seção.
  - Classes CSS: `.mpv2-mosaic`, `.mpv2-adv`, `.mpv2-about`, `.mpv2-footer`, `.mpv2-nav`, `.mpv2-nav.mpv2-nav-open`, `.mpv2-nav-toggle`.

- [ ] **Step 1: Criar `apps/madpet/app/v2/page.tsx` com o esqueleto**

```tsx
import type { Metadata } from "next";
import { madPetPalette as palette } from "@/client-theme";

export const metadata: Metadata = {
  title: "MAD PET | Catálogo de fabricação própria para revenda em pet shop",
  description:
    "Mosaico de linhas, vantagens de revenda, depoimentos de lojistas e pedido pelo WhatsApp. Bandanas, laços, peitorais e coleiras MAD PET de fabricação própria.",
};

export default function HomeV2() {
  return (
    <div id="topo" style={{ background: palette.white, minHeight: "100vh" }}>
      {/* seções entram nas próximas tasks */}
    </div>
  );
}
```

- [ ] **Step 2: Append das classes responsivas no final de `apps/madpet/app/globals.css`**

```css

/* ---- Home v2 (/v2) — grids responsivos. Prefixo mpv2- evita colisão com mp-. ---- */
.mpv2-mosaic {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.mpv2-adv {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
.mpv2-about {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  align-items: center;
}
.mpv2-footer {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 32px;
}
.mpv2-nav {
  display: flex;
  gap: 22px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}
.mpv2-nav-toggle {
  display: none;
}
@media (max-width: 900px) {
  .mpv2-mosaic {
    grid-template-columns: repeat(2, 1fr);
  }
  .mpv2-about {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 760px) {
  .mpv2-adv {
    grid-template-columns: repeat(2, 1fr);
  }
  .mpv2-footer {
    grid-template-columns: 1fr 1fr;
  }
  .mpv2-nav {
    display: none;
  }
  .mpv2-nav.mpv2-nav-open {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    padding-top: 12px;
  }
  .mpv2-nav-toggle {
    display: inline-flex;
  }
}
@media (max-width: 560px) {
  .mpv2-mosaic {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 480px) {
  .mpv2-adv,
  .mpv2-footer {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Build**

Run: `pnpm --filter madpet build`
Expected: PASS — sem erros de tipo. Saída lista a rota `/v2` entre as rotas geradas.

- [ ] **Step 4: Verificação visual (opcional mas recomendada)**

Run: `pnpm --filter madpet dev` e abrir `http://localhost:4102/v2`
Expected: página em branco (fundo branco, altura de viewport), sem erro no console.

- [ ] **Step 5: Commit**

```bash
git add apps/madpet/app/v2/page.tsx apps/madpet/app/globals.css
git commit -m "feat(madpet): scaffold rota /v2 e grids responsivos da home v2"
```

---

## Task 2: `AnnouncementBar` + wiring

**Files:**
- Create: `apps/madpet/components/v2/announcement-bar.tsx`
- Modify: `apps/madpet/app/v2/page.tsx`

**Interfaces:**
- Consumes: `HomeV2` (Task 1).
- Produces: `export function AnnouncementBar(): JSX.Element` — sem props.

- [ ] **Step 1: Criar `apps/madpet/components/v2/announcement-bar.tsx`**

```tsx
import { madPetPalette as palette } from "@/client-theme";

/** Valor mínimo de pedido para frete grátis na revenda. Ajuste comercial. */
const FRETE_GRATIS_MINIMO = "R$ 600";

export function AnnouncementBar() {
  return (
    <div
      style={{
        background: palette.purpleDark,
        color: palette.white,
        textAlign: "center",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "9px 16px",
      }}
    >
      Frete grátis para revenda a partir de {FRETE_GRATIS_MINIMO} em pedido
    </div>
  );
}
```

- [ ] **Step 2: Ligar em `page.tsx`**

Adicionar o import após a linha `import { madPetPalette as palette } from "@/client-theme";`:

```tsx
import { AnnouncementBar } from "@/components/v2/announcement-bar";
```

Substituir o comentário `{/* seções entram nas próximas tasks */}` por:

```tsx
      <AnnouncementBar />
```

- [ ] **Step 3: Build**

Run: `pnpm --filter madpet build`
Expected: PASS.

- [ ] **Step 4: Verificação visual**

Abrir `/v2`: faixa roxo-profunda no topo, texto branco maiúsculo centralizado.

- [ ] **Step 5: Commit**

```bash
git add apps/madpet/components/v2/announcement-bar.tsx apps/madpet/app/v2/page.tsx
git commit -m "feat(madpet): barra de aviso da home v2"
```

---

## Task 3: `SiteHeader` (sticky + toggle mobile) + wiring

**Files:**
- Create: `apps/madpet/components/v2/site-header.tsx`
- Modify: `apps/madpet/app/v2/page.tsx`

**Interfaces:**
- Consumes: `Logo` de `@/components/logo` (`{ size?: number; variant?: "lockup" | "plain" }`).
- Produces: `export function SiteHeader(props: { whatsappLink: string }): JSX.Element` — client component.

- [ ] **Step 1: Criar `apps/madpet/components/v2/site-header.tsx`**

```tsx
"use client";

import { useState } from "react";
import { madPetPalette as palette, theme } from "@/client-theme";
import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { href: "#mosaico", label: "Catálogo" },
  { href: "#vantagens", label: "Vantagens" },
  { href: "#sobre", label: "Sobre" },
  { href: "#depoimentos", label: "Depoimentos" },
];

export function SiteHeader({ whatsappLink }: { whatsappLink: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      style={{
        background: palette.white,
        borderBottom: `1px solid ${palette.purpleLight}`,
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: theme.shadowCard,
      }}
    >
      <div
        style={{
          maxWidth: theme.maxWidth,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <span style={{ width: 40 }} aria-hidden="true" />
          <a href="#topo" aria-label="MAD PET, ir para o início" style={{ display: "inline-flex" }}>
            <Logo size={22} />
          </a>
          <button
            type="button"
            className="mpv2-nav-toggle"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${palette.purpleLight}`,
              borderRadius: theme.radiusInput,
              background: palette.white,
              cursor: "pointer",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={palette.gray800}
              strokeWidth="2"
              aria-hidden="true"
            >
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        <nav aria-label="Seções da página" className={`mpv2-nav${open ? " mpv2-nav-open" : ""}`}>
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="mp-link"
              onClick={() => setOpen(false)}
              style={{ color: palette.gray800, fontWeight: 700, fontSize: 14, textDecoration: "none" }}
            >
              {l.label}
            </a>
          ))}
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mp-btn mp-btn-green"
            style={{
              background: palette.greenDark,
              color: palette.white,
              fontWeight: 800,
              fontSize: 14,
              padding: "9px 18px",
              borderRadius: theme.radiusPill,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Quero revender
          </a>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Ligar em `page.tsx`**

Adicionar imports (após o import de `AnnouncementBar`):

```tsx
import { SiteHeader } from "@/components/v2/site-header";
import { buildWhatsAppLink } from "@mypet/core/whatsapp";
import { clientConfig } from "@/client.config";
```

Trocar o corpo de `HomeV2` para montar o link e renderizar o header:

```tsx
export default function HomeV2() {
  const genericWhatsappLink = buildWhatsAppLink(
    clientConfig.whatsappNumber,
    "Olá! Tenho loja e quero a tabela de revenda da linha MAD PET."
  );

  return (
    <div id="topo" style={{ background: palette.white, minHeight: "100vh" }}>
      <AnnouncementBar />
      <SiteHeader whatsappLink={genericWhatsappLink} />
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `pnpm --filter madpet build`
Expected: PASS.

- [ ] **Step 4: Verificação visual**

Abrir `/v2`: wordmark centralizado, nav horizontal abaixo com 4 links + botão verde. Rolar a página: header gruda no topo. Estreitar < 760px: nav some, aparece botão hambúrguer; clicar abre painel vertical; clicar num link fecha.

- [ ] **Step 5: Commit**

```bash
git add apps/madpet/components/v2/site-header.tsx apps/madpet/app/v2/page.tsx
git commit -m "feat(madpet): header central sticky com menu mobile na home v2"
```

---

## Task 4: `CategoryMosaic` + wiring

**Files:**
- Create: `apps/madpet/components/v2/category-mosaic.tsx`
- Modify: `apps/madpet/app/v2/page.tsx`

**Interfaces:**
- Consumes:
  - `PRODUCT_LINES: ProductLine[]` de `@/lib/product-lines`, onde `ProductLine = { slug: string; label: string; categoryId: string; bannerTitle: string; bannerCopy: string }`.
  - `buildWhatsAppLink(phone: string, msg: string): string`.
  - `BonePattern` de `@/components/bone-pattern` (`{ color?: string; opacity?: number }`).
- Produces: `export function CategoryMosaic(props: { lines: ProductLine[]; whatsappNumber: string }): JSX.Element` — server component. Contém o único `<h1>` da página. Seção com `id="mosaico"`.

- [ ] **Step 1: Criar `apps/madpet/components/v2/category-mosaic.tsx`**

```tsx
import { madPetPalette as palette, theme } from "@/client-theme";
import { BonePattern } from "@/components/bone-pattern";
import { buildWhatsAppLink } from "@mypet/core/whatsapp";
import type { ProductLine } from "@/lib/product-lines";

type Tile =
  | { kind: "line"; label: string; href: string; seed: string }
  | { kind: "theme"; label: string; href: string; bg: string };

export function CategoryMosaic({
  lines,
  whatsappNumber,
}: {
  lines: ProductLine[];
  whatsappNumber: string;
}) {
  const tiles: Tile[] = [
    ...lines.map((l) => ({
      kind: "line" as const,
      label: l.label,
      href: `#${l.slug}`,
      seed: `madpet-mosaic-${l.slug}`,
    })),
    {
      kind: "theme" as const,
      label: "Novidades do mês",
      href: buildWhatsAppLink(
        whatsappNumber,
        "Olá! Quero ver as novidades MAD PET do mês para revenda."
      ),
      bg: palette.purple,
    },
    {
      kind: "theme" as const,
      label: "Kit vitrine para começar",
      href: buildWhatsAppLink(
        whatsappNumber,
        "Olá! Quero montar um kit inicial MAD PET para a vitrine da minha loja."
      ),
      bg: palette.purpleDark,
    },
  ];

  return (
    <section id="mosaico" style={{ background: palette.white, scrollMarginTop: 96 }}>
      <div style={{ maxWidth: theme.maxWidth, margin: "0 auto", padding: "56px 24px 32px" }}>
        <h1
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: "clamp(28px, 4.4vw, 40px)",
            fontWeight: 700,
            color: palette.gray800,
            lineHeight: 1.12,
            marginBottom: 10,
          }}
        >
          O catálogo de fabricação própria
        </h1>
        <p
          style={{
            fontSize: 16,
            color: palette.gray600,
            lineHeight: 1.65,
            maxWidth: "58ch",
            marginBottom: 28,
          }}
        >
          Quatro linhas para revender, do mini ao extra grande. Toque numa linha para ver as peças
          ou fale no WhatsApp para novidades e kit de vitrine.
        </p>

        <div className="mpv2-mosaic">
          {tiles.map((tile) => {
            const external = tile.href.startsWith("http");
            return (
              <a
                key={tile.label}
                href={tile.href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="mp-card"
                style={{
                  position: "relative",
                  overflow: "hidden",
                  aspectRatio: "3 / 4",
                  borderRadius: theme.radiusCard,
                  textDecoration: "none",
                  display: "block",
                  background: tile.kind === "theme" ? tile.bg : palette.purpleDark,
                }}
              >
                {tile.kind === "line" ? (
                  <>
                    {/* TODO: trocar por foto real da linha (pet usando o produto, luz clara),
                        600x800, e migrar para next/image quando a origem final existir. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://picsum.photos/seed/${tile.seed}/600/800`}
                      alt={`Linha de ${tile.label.toLowerCase()} MAD PET para revenda`}
                      width={600}
                      height={800}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </>
                ) : (
                  <BonePattern color={palette.white} opacity={0.1} />
                )}

                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(38,16,60,0) 45%, rgba(38,16,60,0.72) 100%)",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 16,
                    right: 16,
                    bottom: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-fredoka)",
                      fontSize: 20,
                      fontWeight: 700,
                      color: palette.white,
                    }}
                  >
                    {tile.label}
                  </span>
                  <span
                    style={{
                      alignSelf: "flex-start",
                      border: "1px solid rgba(255,255,255,0.7)",
                      borderRadius: theme.radiusPill,
                      padding: "5px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: palette.white,
                    }}
                  >
                    Clique e confira
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Ligar em `page.tsx`**

Adicionar imports:

```tsx
import { CategoryMosaic } from "@/components/v2/category-mosaic";
import { PRODUCT_LINES } from "@/lib/product-lines";
```

Adicionar o elemento após `<SiteHeader ... />`:

```tsx
      <CategoryMosaic lines={PRODUCT_LINES} whatsappNumber={clientConfig.whatsappNumber} />
```

- [ ] **Step 3: Build**

Run: `pnpm --filter madpet build`
Expected: PASS.

- [ ] **Step 4: Verificação visual**

Abrir `/v2`: grid 3 colunas com 6 tiles (Bandanas, Laços, Peitorais, Coleiras + "Novidades do mês" roxo + "Kit vitrine para começar" roxo-profundo). Cada tile: foto/textura, label Fredoka branco, pílula "CLIQUE E CONFIRA", hover eleva. Clicar em "Novidades do mês" abre `wa.me` em nova aba com a mensagem certa. Estreitar: 3→2 col em 900px, 2→1 col em 560px.

- [ ] **Step 5: Commit**

```bash
git add apps/madpet/components/v2/category-mosaic.tsx apps/madpet/app/v2/page.tsx
git commit -m "feat(madpet): mosaico de categorias 2x3 da home v2"
```

---

## Task 5: `AdvantagesStrip` + wiring

**Files:**
- Create: `apps/madpet/components/v2/advantages-strip.tsx`
- Modify: `apps/madpet/app/v2/page.tsx`

**Interfaces:**
- Consumes: `HomeV2`.
- Produces: `export function AdvantagesStrip(): JSX.Element` — server component. Seção com `id="vantagens"`.

- [ ] **Step 1: Criar `apps/madpet/components/v2/advantages-strip.tsx`**

```tsx
import { madPetPalette as palette, theme } from "@/client-theme";

const ITEMS = [
  {
    title: "Fabricação própria",
    copy: "Linha nossa, do corte ao acabamento. Você repõe o que vende sem esperar contêiner.",
    d: "M3 21V9l9-6 9 6v12M9 21v-6h6v6",
  },
  {
    title: "Giro rápido na gôndola",
    copy: "Cor que para o cliente na prateleira antes de qualquer argumento de venda.",
    d: "M3 17l6-6 4 4 8-8M15 7h6v6",
  },
  {
    title: "Frete grátis por faixa",
    copy: "Fechou a faixa de pedido, o frete sai de graça para todo o Brasil.",
    d: "M3 7h11v8H3zM14 10h4l3 3v2h-7M6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  },
  {
    title: "Pedido pelo WhatsApp",
    copy: "Sem cadastro em portal. Você fala com o comercial e já sai com a condição.",
    d: "M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z",
  },
];

export function AdvantagesStrip() {
  return (
    <section id="vantagens" style={{ background: palette.white, scrollMarginTop: 96 }}>
      <div style={{ maxWidth: theme.maxWidth, margin: "0 auto", padding: "24px 24px 64px" }}>
        <h2
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: "clamp(22px, 3.4vw, 30px)",
            fontWeight: 700,
            color: palette.gray800,
            textAlign: "center",
            marginBottom: 36,
          }}
        >
          Vantagens em revender MAD PET
        </h2>
        <div className="mpv2-adv">
          {ITEMS.map((item) => (
            <div key={item.title} style={{ textAlign: "center", padding: "0 8px" }}>
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke={palette.purple}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ marginBottom: 12 }}
              >
                <path d={item.d} />
              </svg>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: palette.gray800, marginBottom: 6 }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 13.5, color: palette.gray600, lineHeight: 1.6 }}>{item.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Ligar em `page.tsx`**

Import:

```tsx
import { AdvantagesStrip } from "@/components/v2/advantages-strip";
```

Elemento após `<CategoryMosaic ... />`:

```tsx
      <AdvantagesStrip />
```

- [ ] **Step 3: Build**

Run: `pnpm --filter madpet build`
Expected: PASS.

- [ ] **Step 4: Verificação visual**

Abrir `/v2`: linha de 4 itens centrados (ícone roxo de traço + título + frase). 4→2 col em 760px, 2→1 col em 480px. Âncora `#vantagens` do header rola até aqui.

- [ ] **Step 5: Commit**

```bash
git add apps/madpet/components/v2/advantages-strip.tsx apps/madpet/app/v2/page.tsx
git commit -m "feat(madpet): faixa de vantagens da home v2"
```

---

## Task 6: Carrosséis de catálogo reais (`CatalogSection` + `LineSection`)

**Files:**
- Modify: `apps/madpet/app/v2/page.tsx`

**Interfaces:**
- Consumes:
  - `CatalogSection` de `@/components/catalog-section` (`{ children: React.ReactNode }`, renderiza `<section id="catalogo">` com título próprio).
  - `LineSection` de `@/components/line-section` — **async server component** com props `{ line: ProductLine; channel: string; brand: string; whatsappNumber: string; tone: "plain" | "tint" }`. Renderiza `<div id={line.slug} style={{ scrollMarginTop: 80 }}>` com carrossel de produtos buscados via `getCatalog`.
  - `clientConfig` (`{ catalogChannel: "ffa_fabrica", brand: "MAD PET", whatsappNumber: string, ... }`).
- Produces: destinos de âncora `#bandanas`, `#lacos`, `#peitorais`, `#coleiras` na página `/v2`.

- [ ] **Step 1: Ligar em `page.tsx`**

Imports:

```tsx
import { CatalogSection } from "@/components/catalog-section";
import { LineSection } from "@/components/line-section";
```

Elemento após `<AdvantagesStrip />` (mesmo padrão da home v1, `tone` alternando):

```tsx
      <CatalogSection>
        {PRODUCT_LINES.map((line, i) => (
          <LineSection
            key={line.slug}
            line={line}
            channel={clientConfig.catalogChannel}
            brand={clientConfig.brand}
            whatsappNumber={clientConfig.whatsappNumber}
            tone={i % 2 === 0 ? "plain" : "tint"}
          />
        ))}
      </CatalogSection>
```

- [ ] **Step 2: Build**

Run: `pnpm --filter madpet build`
Expected: PASS. (O build pode logar `[madpet] erro ao buscar catalogo da linha ...` se a origem de catálogo não estiver acessível no ambiente — é o `try/catch` do `LineSection`; não quebra o build.)

- [ ] **Step 3: Verificação visual**

Abrir `/v2`: bloco "O catálogo que vai pra sua prateleira" seguido de 4 blocos de linha (título + copy + carrossel de produtos ou aviso "entra no catálogo em breve" com fundo verde-claro se vazio). Voltar ao mosaico e clicar no tile "Bandanas": a página rola até o bloco `#bandanas`.

- [ ] **Step 4: Commit**

```bash
git add apps/madpet/app/v2/page.tsx
git commit -m "feat(madpet): carrosséis de linha reais na home v2"
```

---

## Task 7: `AboutBlock` + wiring

**Files:**
- Create: `apps/madpet/components/v2/about-block.tsx`
- Modify: `apps/madpet/app/v2/page.tsx`

**Interfaces:**
- Consumes: `BonePattern`; `buildWhatsAppLink`; `clientConfig.whatsappNumber`.
- Produces: `export function AboutBlock(props: { whatsappLink: string }): JSX.Element` — server component. Seção com `id="sobre"`.

- [ ] **Step 1: Criar `apps/madpet/components/v2/about-block.tsx`**

```tsx
import { madPetPalette as palette, theme } from "@/client-theme";
import { BonePattern } from "@/components/bone-pattern";

export function AboutBlock({ whatsappLink }: { whatsappLink: string }) {
  return (
    <section
      id="sobre"
      style={{
        position: "relative",
        overflow: "hidden",
        background: palette.purpleDark,
        scrollMarginTop: 96,
      }}
    >
      <BonePattern color={palette.white} opacity={0.06} />
      <div
        className="mpv2-about"
        style={{
          position: "relative",
          maxWidth: theme.maxWidth,
          margin: "0 auto",
          padding: "72px 24px",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-fredoka)",
              fontSize: "clamp(24px, 3.8vw, 34px)",
              fontWeight: 700,
              color: palette.white,
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            Sobre a MAD PET
          </h2>
          <p
            style={{
              fontSize: 15.5,
              color: "rgba(255,255,255,0.9)",
              lineHeight: 1.7,
              marginBottom: 14,
            }}
          >
            A MAD PET é a linha própria de acessórios do Grupo AZ: bandana, laço, peitoral e coleira
            fabricados do corte ao acabamento na nossa produção. Sem importadora no meio, a reposição
            é rápida e o preço nasce pensado para você revender bem.
          </p>
          <p
            style={{
              fontSize: 15.5,
              color: "rgba(255,255,255,0.9)",
              lineHeight: 1.7,
              marginBottom: 28,
            }}
          >
            Cor que chama o olhar na gôndola, material que aguenta o uso e uma grade enxuta que cobre
            do mini ao extra grande. É o acessório que gira sem esforço de venda no seu balcão.
          </p>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mp-btn mp-btn-light"
            style={{
              background: palette.white,
              color: palette.purple,
              fontWeight: 800,
              fontSize: 15,
              padding: "14px 28px",
              borderRadius: theme.radiusPill,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Seja nosso cliente atacadista
          </a>
        </div>

        <div
          style={{
            position: "relative",
            borderRadius: theme.radiusCard,
            overflow: "hidden",
            border: "6px solid rgba(255,255,255,0.14)",
            aspectRatio: "4 / 3",
            background: palette.purple,
          }}
        >
          {/* TODO: trocar por vídeo institucional real quando disponível. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://picsum.photos/seed/madpet-sobre-video/1200/900"
            alt="Bastidores da produção MAD PET"
            width={1200}
            height={900}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(38,16,60,0.28)",
            }}
          >
            <span
              style={{
                width: 66,
                height: 66,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.92)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill={palette.purple} aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Ligar em `page.tsx`**

Import:

```tsx
import { AboutBlock } from "@/components/v2/about-block";
```

Dentro de `HomeV2`, montar o segundo link do WhatsApp logo após `genericWhatsappLink`:

```tsx
  const atacadistaLink = buildWhatsAppLink(
    clientConfig.whatsappNumber,
    "Olá! Quero ser cliente atacadista MAD PET e receber a tabela de revenda."
  );
```

Elemento após o `</CatalogSection>`:

```tsx
      <AboutBlock whatsappLink={atacadistaLink} />
```

- [ ] **Step 3: Build**

Run: `pnpm --filter madpet build`
Expected: PASS.

- [ ] **Step 4: Verificação visual**

Abrir `/v2`: seção roxo-profunda com textura de ossos, texto branco à esquerda + botão branco "Seja nosso cliente atacadista", thumb com botão de play (sem player) à direita. 2→1 col em 900px. Âncora `#sobre` rola até aqui.

- [ ] **Step 5: Commit**

```bash
git add apps/madpet/components/v2/about-block.tsx apps/madpet/app/v2/page.tsx
git commit -m "feat(madpet): seção sobre com mídia e CTA atacadista na home v2"
```

---

## Task 8: `lib/testimonials.ts` + `TestimonialsCarousel` + wiring

**Files:**
- Create: `apps/madpet/lib/testimonials.ts`
- Create: `apps/madpet/components/v2/testimonials-carousel.tsx`
- Modify: `apps/madpet/app/v2/page.tsx`

**Interfaces:**
- Produces:
  - `export type Testimonial = { name: string; city: string; quote: string }`
  - `export const TESTIMONIALS: Testimonial[]` (5 itens)
  - `export function TestimonialsCarousel(): JSX.Element` — client component, sem props. Seção com `id="depoimentos"`.

- [ ] **Step 1: Criar `apps/madpet/lib/testimonials.ts`**

```ts
export type Testimonial = {
  name: string;
  city: string;
  quote: string;
};

/**
 * Depoimentos placeholder de lojistas. Trocar por depoimentos reais de pet
 * shops que revendem MAD PET quando disponíveis.
 */
export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Camila Rocha",
    city: "Petland — Curitiba/PR",
    quote:
      "A bandana MAD PET é a que mais sai da minha vitrine. Cliente pega no impulso, no caixa, sem eu precisar oferecer.",
  },
  {
    name: "Rodrigo Alves",
    city: "Mundo Pet — Sorocaba/SP",
    quote:
      "Reposição rápida e sem furo de estoque. Peço pelo WhatsApp de manhã e já fecho a condição na hora.",
  },
  {
    name: "Fernanda Lima",
    city: "Cão & Cia — Belo Horizonte/MG",
    quote:
      "O peitoral tem acabamento de marca cara e preço que me deixa margem folgada. Virou item fixo da loja.",
  },
  {
    name: "Marcos Tavares",
    city: "Pet Center — Florianópolis/SC",
    quote:
      "Comecei com o kit de vitrine e em duas semanas já tinha refeito o pedido. Gira de verdade.",
  },
  {
    name: "Patrícia Nunes",
    city: "AuAu Pet Shop — Campinas/SP",
    quote:
      "Coleira e guia combinando puxam a venda casada. O cliente leva o conjunto quase sempre.",
  },
];
```

- [ ] **Step 2: Criar `apps/madpet/components/v2/testimonials-carousel.tsx`**

```tsx
"use client";

import { useState } from "react";
import { madPetPalette as palette, theme } from "@/client-theme";
import { TESTIMONIALS } from "@/lib/testimonials";

const arrowStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: "none",
  background: palette.white,
  boxShadow: theme.shadowCard,
  fontSize: 22,
  lineHeight: 1,
  color: palette.purple,
  cursor: "pointer",
};

export function TestimonialsCarousel() {
  const [i, setI] = useState(0);
  const total = TESTIMONIALS.length;
  const t = TESTIMONIALS[i];

  const go = (next: number) => setI((next + total) % total);

  return (
    <section id="depoimentos" style={{ background: palette.purpleLight, scrollMarginTop: 96 }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "64px 24px", textAlign: "center" }}>
        <h2
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: "clamp(22px, 3.4vw, 30px)",
            fontWeight: 700,
            color: palette.gray800,
            marginBottom: 28,
          }}
        >
          O que dizem os lojistas
        </h2>

        <div
          style={{
            background: palette.white,
            borderRadius: theme.radiusCard,
            boxShadow: theme.shadowCard,
            padding: "36px 28px",
          }}
        >
          <p
            style={{
              fontSize: 17,
              color: palette.gray800,
              lineHeight: 1.7,
              fontStyle: "italic",
              marginBottom: 18,
            }}
          >
            &ldquo;{t.quote}&rdquo;
          </p>
          <p style={{ fontSize: 14, fontWeight: 800, color: palette.gray800 }}>{t.name}</p>
          <p style={{ fontSize: 13, color: palette.gray600 }}>{t.city}</p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginTop: 22,
          }}
        >
          <button
            type="button"
            aria-label="Depoimento anterior"
            onClick={() => go(i - 1)}
            style={arrowStyle}
          >
            &lsaquo;
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {TESTIMONIALS.map((_, d) => (
              <button
                key={d}
                type="button"
                aria-label={`Ir para depoimento ${d + 1}`}
                aria-current={d === i}
                onClick={() => setI(d)}
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  background: d === i ? palette.purple : "rgba(113,68,164,0.3)",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Próximo depoimento"
            onClick={() => go(i + 1)}
            style={arrowStyle}
          >
            &rsaquo;
          </button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Ligar em `page.tsx`**

Import:

```tsx
import { TestimonialsCarousel } from "@/components/v2/testimonials-carousel";
```

Elemento após `<AboutBlock ... />`:

```tsx
      <TestimonialsCarousel />
```

- [ ] **Step 4: Build**

Run: `pnpm --filter madpet build`
Expected: PASS.

- [ ] **Step 5: Verificação visual**

Abrir `/v2`: fundo lavanda, card branco com aspas + depoimento + nome/cidade, setas ‹ › e 5 dots. Clicar nas setas/dots troca o depoimento; o dot ativo fica roxo cheio.

- [ ] **Step 6: Commit**

```bash
git add apps/madpet/lib/testimonials.ts apps/madpet/components/v2/testimonials-carousel.tsx apps/madpet/app/v2/page.tsx
git commit -m "feat(madpet): carrossel de depoimentos de lojistas na home v2"
```

---

## Task 9: `NewsletterBlock` + wiring

**Files:**
- Create: `apps/madpet/components/v2/newsletter-block.tsx`
- Modify: `apps/madpet/app/v2/page.tsx`

**Interfaces:**
- Produces: `export function NewsletterBlock(): JSX.Element` — client component, sem props. Sem requisição de rede.

- [ ] **Step 1: Criar `apps/madpet/components/v2/newsletter-block.tsx`**

```tsx
"use client";

import { useState } from "react";
import { madPetPalette as palette, theme } from "@/client-theme";

export function NewsletterBlock() {
  const [sent, setSent] = useState(false);

  return (
    <section style={{ background: palette.white }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "56px 24px", textAlign: "center" }}>
        <h2
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: "clamp(20px, 3vw, 26px)",
            fontWeight: 700,
            color: palette.gray800,
            marginBottom: 8,
          }}
        >
          Receba novidades e reajustes de tabela
        </h2>
        <p style={{ fontSize: 14.5, color: palette.gray600, lineHeight: 1.6, marginBottom: 22 }}>
          Seja o primeiro a saber de lançamentos de linha e mudanças na condição de revenda.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}
        >
          <input
            type="email"
            required
            aria-label="Seu e-mail"
            placeholder="seu@email.com.br"
            disabled={sent}
            style={{
              flex: "1 1 260px",
              maxWidth: 340,
              padding: "13px 16px",
              fontSize: 15,
              borderRadius: theme.radiusInput,
              border: `1px solid ${palette.purpleLight}`,
              fontFamily: "inherit",
            }}
          />
          <button
            type="submit"
            className="mp-btn mp-btn-green"
            disabled={sent}
            style={{
              background: palette.greenDark,
              color: palette.white,
              fontWeight: 800,
              fontSize: 15,
              padding: "13px 26px",
              borderRadius: theme.radiusPill,
              border: "none",
              cursor: sent ? "default" : "pointer",
            }}
          >
            Enviar
          </button>
        </form>

        <p
          aria-live="polite"
          style={{ minHeight: 20, marginTop: 14, fontSize: 13.5, color: palette.green }}
        >
          {sent ? "Pronto! Em breve você recebe nossas novidades." : ""}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Ligar em `page.tsx`**

Import:

```tsx
import { NewsletterBlock } from "@/components/v2/newsletter-block";
```

Elemento após `<TestimonialsCarousel />`:

```tsx
      <NewsletterBlock />
```

- [ ] **Step 3: Build**

Run: `pnpm --filter madpet build`
Expected: PASS.

- [ ] **Step 4: Verificação visual**

Abrir `/v2`: título + subtítulo + input de e-mail + botão verde "Enviar". Submeter com um e-mail válido: campos ficam desabilitados e aparece "Pronto! Em breve você recebe nossas novidades." Aba de rede do navegador **não** registra requisição.

- [ ] **Step 5: Commit**

```bash
git add apps/madpet/components/v2/newsletter-block.tsx apps/madpet/app/v2/page.tsx
git commit -m "feat(madpet): bloco de newsletter (visual) na home v2"
```

---

## Task 10: `SiteFooter` + `WhatsAppFloatButton` + verificação final

**Files:**
- Create: `apps/madpet/components/v2/site-footer.tsx`
- Modify: `apps/madpet/app/v2/page.tsx`

**Interfaces:**
- Consumes:
  - `Logo` (`variant="plain"`).
  - `WhatsAppFloatButton` de `@/components/whatsapp-float-button` (`{ link: string }`).
  - `clientConfig.mainSiteUrl`, `clientConfig.distribuidoraUrl`, `clientConfig.whatsappNumber`.
- Produces: `export function SiteFooter(props: { mainSiteUrl: string; distribuidoraUrl: string; whatsappLink: string }): JSX.Element` — server component.

- [ ] **Step 1: Criar `apps/madpet/components/v2/site-footer.tsx`**

```tsx
import { madPetPalette as palette, theme } from "@/client-theme";
import { Logo } from "@/components/logo";

const SOCIALS = [
  {
    label: "Instagram",
    d: "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.5.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .5 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.5 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.5-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.5a3.8 3.8 0 0 1-1.4-.9 3.8 3.8 0 0 1-.9-1.4c-.2-.4-.4-1-.5-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.5-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.5C8.4 2.2 8.8 2.2 12 2.2zm0 3.3a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm0 10.7a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4zm6.8-10.9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z",
  },
  {
    label: "Facebook",
    d: "M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3V13h2.5v8h3.7z",
  },
  {
    label: "YouTube",
    d: "M21.6 7.2s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16 4.1 12 4.1 12 4.1s-4 0-6.8.2c-.4.1-1.3.1-2 .9-.6.6-.8 2-.8 2S2.2 8.8 2.2 10.5v1.6c0 1.6.2 3.3.2 3.3s.2 1.4.8 2c.8.8 1.8.8 2.3.9 1.6.2 6.5.2 6.5.2s4 0 6.8-.2c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.3v-1.6c0-1.6-.2-3.3-.2-3.3zM9.9 14.6V8.9l5.3 2.9-5.3 2.8z",
  },
  {
    label: "TikTok",
    d: "M16.5 3c.4 2.3 1.7 3.7 3.9 3.9v2.7c-1.3.1-2.5-.3-3.9-1.1v5.6c0 4.2-3.4 6.4-6.7 5.3-2.6-.9-3.7-3.9-2.6-6.4.9-2 3-3.1 5.2-2.8v2.8c-.4-.1-.8-.2-1.2-.1-1.2.1-2 1-1.9 2.3.1 1.3 1.3 2.1 2.6 1.8 1-.3 1.6-1.2 1.6-2.4V3h2.9z",
  },
];

export function SiteFooter({
  mainSiteUrl,
  distribuidoraUrl,
  whatsappLink,
}: {
  mainSiteUrl: string;
  distribuidoraUrl: string;
  whatsappLink: string;
}) {
  const linkStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    textDecoration: "none",
    lineHeight: 2,
  };
  const headStyle: React.CSSProperties = {
    color: palette.white,
    fontSize: 13,
    marginBottom: 6,
    fontWeight: 800,
  };

  return (
    <footer style={{ background: palette.purpleDark, padding: "56px 24px 32px" }}>
      <div style={{ maxWidth: theme.maxWidth, margin: "0 auto" }}>
        <div className="mpv2-footer">
          <div style={{ maxWidth: 300 }}>
            <Logo size={22} variant="plain" />
            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.72)",
                marginTop: 14,
                lineHeight: 1.6,
              }}
            >
              Linha própria de acessórios do Grupo AZ. Fabricação própria, venda para revenda.
            </p>
          </div>

          <nav aria-label="Catálogo" style={{ display: "flex", flexDirection: "column" }}>
            <strong style={headStyle}>Catálogo</strong>
            <a href="#bandanas" className="mp-link" style={linkStyle}>Bandanas</a>
            <a href="#lacos" className="mp-link" style={linkStyle}>Laços</a>
            <a href="#peitorais" className="mp-link" style={linkStyle}>Peitorais</a>
            <a href="#coleiras" className="mp-link" style={linkStyle}>Coleiras</a>
          </nav>

          <nav aria-label="Institucional" style={{ display: "flex", flexDirection: "column" }}>
            <strong style={headStyle}>Institucional</strong>
            <a href="#vantagens" className="mp-link" style={linkStyle}>Como comprar para revender</a>
            <a href={mainSiteUrl} className="mp-link" style={linkStyle}>My Pet Brasil</a>
            <a href={distribuidoraUrl} className="mp-link" style={linkStyle}>Distribuidora Petshop</a>
          </nav>

          <nav aria-label="Contato" style={{ display: "flex", flexDirection: "column" }}>
            <strong style={headStyle}>Contato</strong>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mp-link"
              style={linkStyle}
            >
              Falar com o comercial
            </a>
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="mp-link"
                  style={{ color: "rgba(255,255,255,0.82)" }}
                >
                  {/* TODO: apontar para as URLs reais das redes MAD PET */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={s.d} />
                  </svg>
                </a>
              ))}
            </div>
          </nav>
        </div>

        <p
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            marginTop: 40,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          © 2026 MAD PET, Grupo AZ. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Ligar em `page.tsx`**

Imports:

```tsx
import { SiteFooter } from "@/components/v2/site-footer";
import { WhatsAppFloatButton } from "@/components/whatsapp-float-button";
```

Elementos após `<NewsletterBlock />`:

```tsx
      <SiteFooter
        mainSiteUrl={clientConfig.mainSiteUrl}
        distribuidoraUrl={clientConfig.distribuidoraUrl}
        whatsappLink={genericWhatsappLink}
      />
      <WhatsAppFloatButton link={genericWhatsappLink} />
```

- [ ] **Step 3: Build**

Run: `pnpm --filter madpet build`
Expected: PASS.

- [ ] **Step 4: Verificação final completa**

Run: `pnpm --filter madpet dev`, abrir `http://localhost:4102/v2` e conferir:
- As 10 seções renderizam na ordem: barra de aviso → header → mosaico → vantagens → catálogo (4 linhas) → sobre → depoimentos → newsletter → rodapé → botão flutuante WhatsApp.
- Tiles de linha do mosaico rolam até o carrossel correto (`#bandanas`, `#lacos`, `#peitorais`, `#coleiras`).
- Tiles temáticos abrem `wa.me` em nova aba com a mensagem de cada um.
- Header: sticky ao rolar; em < 760px o hambúrguer abre/fecha o menu.
- Carrossel de depoimentos navega por setas e dots.
- Newsletter mostra estado "enviado" sem requisição de rede.
- Rodapé: 4 colunas, ícones sociais, linha legal.
- Redimensionar a janela e confirmar as quebras em 900 / 760 / 560 / 480 px sem scroll horizontal.
- Abrir `http://localhost:4102/` (home v1) e confirmar que está **idêntica** à de antes.

- [ ] **Step 5: Commit**

```bash
git add apps/madpet/components/v2/site-footer.tsx apps/madpet/app/v2/page.tsx
git commit -m "feat(madpet): rodapé denso e wiring final da home v2"
```

---

## Self-Review

**1. Spec coverage:**

| Requisito do spec | Task |
|---|---|
| Rota `app/v2/page.tsx`, server, `metadata` própria | 1, expandida até 10 |
| Home v1 e componentes compartilhados intocados | Todas (só append em globals.css na Task 1) |
| Append `mpv2-*` no globals.css | 1 |
| `AnnouncementBar` (frete grátis, valor constante) | 2 |
| `SiteHeader` client, wordmark central, nav, sticky, toggle mobile | 3 |
| `CategoryMosaic` 2×3, 4 linhas (âncora) + 2 temáticos (WhatsApp), `<h1>` único, pílula "clique e confira" | 4 |
| `AdvantagesStrip` 4 ícones SVG (fabricação própria, giro, frete por faixa, WhatsApp) | 5 |
| Carrosséis reais via `CatalogSection` + `LineSection`, destino do scroll dos tiles | 6 |
| `AboutBlock` escuro, mídia thumb+play sem player, CTA atacadista | 7 |
| `lib/testimonials.ts` (5 mocks) + `TestimonialsCarousel` client (setas + dots, sem autoplay) | 8 |
| `NewsletterBlock` client, form só visual sem POST | 9 |
| `SiteFooter` escuro, 4 colunas, sociais SVG placeholder, sem selos/pagamento/app | 10 |
| `WhatsAppFloatButton` reaproveitado | 10 |
| Mapeamento estético Zarpellon→MAD PET (preto→purpleDark, Fredoka, pílulas, verde só em ação) | 2,3,4,7,10 |
| Acessibilidade (h1 único, aria nos controles, alt em imagens) | 3,4,8 |
| Verificação por `pnpm --filter madpet build` + render (sem testes automatizados) | todas |

Sem lacunas.

**2. Placeholder scan:** Todos os passos de código trazem o código completo. `TODO`s presentes são de conteúdo real futuro (fotos, vídeo, URLs de redes sociais), explicitamente previstos no spec como fora de escopo — não são lacunas do plano.

**3. Type consistency:**
- `SiteHeader({ whatsappLink })`, `AboutBlock({ whatsappLink })`, `CategoryMosaic({ lines, whatsappNumber })`, `SiteFooter({ mainSiteUrl, distribuidoraUrl, whatsappLink })` — assinaturas idênticas entre a definição (Tasks 3/4/7/10) e o uso em `page.tsx`.
- `LineSection` — props `{ line, channel, brand, whatsappNumber, tone }` conforme `components/line-section.tsx` atual; `channel={clientConfig.catalogChannel}` (string literal `"ffa_fabrica"`).
- `Testimonial` / `TESTIMONIALS` definidos na Task 8 e consumidos só pelo `TestimonialsCarousel` da mesma task.
- `buildWhatsAppLink(phone, message)` — mesma ordem de argumentos em todos os usos (Tasks 3, 4, 7).
- Classes CSS `mpv2-nav` / `mpv2-nav-open` / `mpv2-nav-toggle` — nomes iguais entre o globals (Task 1) e o `SiteHeader` (Task 3).

Sem inconsistências.
