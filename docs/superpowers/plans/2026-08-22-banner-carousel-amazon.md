# Carrossel de Banner Estilo Amazon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o carrossel de banner principal da home (`CompactBanner`) se comportar como o carrossel de topo da Amazon.com — setas de navegação, peek do próximo card, scroll suave — sem alterar a arte dos banners em si.

**Architecture:** `compact-banner.tsx` continua sendo o server component que busca os dados (`getBanners`); a lista de banners passa a ser renderizada por um novo client component, `banner-carousel.tsx`, que cuida das setas e do comportamento de scroll. Ambos vivem em `packages/core/src/components/`, então a mudança vale automaticamente para `apps/mypet` e `apps/distribuidora` (que consomem o mesmo componente compartilhado).

**Tech Stack:** Next.js 16 / React 19 (Server + Client Components), TypeScript, CSS via `<style>` inline (padrão já usado no restante do projeto) — sem nova dependência.

## Global Constraints

- Sem instalar nenhuma lib de carrossel (decisão da spec: scroll nativo + `scrollBy`).
- Sem nova infraestrutura de teste de componente React (Vitest hoje só roda `*.test.ts` em ambiente `node`).
- Não alterar `mini-banner-strip.tsx`, `FallbackBanner`, nem a assinatura de `getBanners`/`CompactBanner`.
- Não editar `apps/distribuidora/app/page.tsx` nem `apps/mypet/app/page.tsx` — a mudança fica contida em `packages/core/src/components/`.
- Setas: só aparecem em dispositivos com mouse fino (`@media (hover: hover) and (pointer: fine)`), nunca em touch. Ocultas/removidas do DOM nos extremos do scroll. Visíveis em `:focus-visible` além de `:hover`.
- Respeitar `prefers-reduced-motion: reduce` no scroll das setas.

---

### Task 1: Criar o componente `BannerCarousel` e conectá-lo ao `CompactBanner`

**Files:**
- Create: `packages/core/src/components/banner-carousel.tsx`
- Modify: `packages/core/src/components/compact-banner.tsx:1-31`

**Interfaces:**
- Consumes: `Banner` (tipo existente, de `packages/core/src/banners.ts:7-14`: `{ id: string; type: BannerType; imageUrl: string; linkUrl: string | null; title: string | null; sortOrder: number }`).
- Produces: `BannerCarousel({ banners }: { banners: Banner[] })` — client component exportado de `packages/core/src/components/banner-carousel.tsx`, consumido por `CompactBanner`.

- [ ] **Step 1: Criar `banner-carousel.tsx`**

```tsx
// packages/core/src/components/banner-carousel.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Banner } from "../banners";

const CARD_WIDTH_DESKTOP = 320;
const CARD_GAP = 10;

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollPrev(el.scrollLeft > 0);
    setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, banners.length]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: direction * (CARD_WIDTH_DESKTOP + CARD_GAP),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className="bc-wrap">
      <style>{`
        .bc-wrap { position: relative; }
        .bc-track {
          display: flex;
          gap: ${CARD_GAP}px;
          overflow-x: auto;
          padding: 0 16px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .bc-track::-webkit-scrollbar { display: none; }
        .bc-item {
          scroll-snap-align: start;
          flex: 0 0 auto;
          width: 85vw;
          max-width: ${CARD_WIDTH_DESKTOP}px;
        }
        .bc-item img { width: 100%; height: 150px; object-fit: cover; border-radius: 14px; display: block; }
        @media (min-width: 641px) {
          .bc-item { width: ${CARD_WIDTH_DESKTOP}px; }
        }
        .bc-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: rgba(0,0,0,0.45);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          opacity: 0;
          transition: opacity 0.2s, background 0.2s, transform 0.2s;
          z-index: 2;
        }
        .bc-arrow-prev { left: 8px; }
        .bc-arrow-next { right: 8px; }
        @media (hover: hover) and (pointer: fine) {
          .bc-wrap:hover .bc-arrow { opacity: 1; }
          .bc-arrow:hover { background: rgba(0,0,0,0.65); transform: translateY(-50%) scale(1.06); }
        }
        .bc-arrow:focus-visible { opacity: 1; outline: 2px solid #fff; outline-offset: 2px; }
        @media (hover: none), (pointer: coarse) {
          .bc-arrow { display: none; }
        }
      `}</style>

      {canScrollPrev && (
        <button
          type="button"
          aria-label="Banner anterior"
          className="bc-arrow bc-arrow-prev"
          onClick={() => scrollByCard(-1)}
        >
          <ChevronIcon direction="left" />
        </button>
      )}

      <div className="bc-track" ref={trackRef}>
        {banners.map((b) => {
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.imageUrl} alt={b.title ?? ""} />
          );
          return (
            <div key={b.id} className="bc-item">
              {b.linkUrl ? <a href={b.linkUrl}>{image}</a> : image}
            </div>
          );
        })}
      </div>

      {canScrollNext && (
        <button
          type="button"
          aria-label="Próximo banner"
          className="bc-arrow bc-arrow-next"
          onClick={() => scrollByCard(1)}
        >
          <ChevronIcon direction="right" />
        </button>
      )}
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  const points = direction === "left" ? "15 6 9 12 15 18" : "9 6 15 12 9 18";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points={points} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 2: Atualizar `compact-banner.tsx` para usar o `BannerCarousel`**

Substituir o conteúdo de `packages/core/src/components/compact-banner.tsx` (mantendo `FallbackBanner` sem nenhuma alteração):

```tsx
import { getBanners } from "../banners";
import type { Palette } from "../theme";
import type { Channel } from "../channels";
import { BannerCarousel } from "./banner-carousel";

export async function CompactBanner({ channel, palette }: { channel: Channel; palette: Palette }) {
  const banners = await getBanners(channel, "principal");

  if (banners.length === 0) {
    return <FallbackBanner palette={palette} />;
  }

  return <BannerCarousel banners={banners} />;
}

function FallbackBanner({ palette }: { palette: Palette }) {
  return (
    <div className="banner-row">
      <div
        className="banner-row-item"
        style={{
          height: 150,
          minWidth: 280,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${palette.navyDark} 0%, ${palette.navy} 60%, #1e4d8a 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
        }}
      >
        <p style={{ color: palette.white, fontSize: 15, fontWeight: 800, textAlign: "center", lineHeight: 1.4 }}>
          Atacado exclusivo para pet shops. Preços sob consulta.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rodar o build para verificar tipos**

Run: `pnpm --filter mypet build`
Expected: build conclui sem erro de TypeScript (o build do Next tipa o grafo inteiro, incluindo `packages/core`, já que `banner-carousel.tsx` passa a ser importado por `compact-banner.tsx`, que é importado por `apps/mypet/app/page.tsx`).

- [ ] **Step 4: Rodar o lint**

Run: `pnpm lint`
Expected: sem erros novos nos dois arquivos criados/modificados (o `eslint-disable-next-line @next/next/no-img-element` já cobre o uso de `<img>`).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/banner-carousel.tsx packages/core/src/components/compact-banner.tsx
git commit -m "feat(core): carrossel de banner estilo Amazon no CompactBanner"
```

---

### Task 2: Verificação manual em navegador

**Files:** nenhum (task de QA, sem alteração de código).

**Interfaces:**
- Consumes: `BannerCarousel` (Task 1), rodando dentro de `apps/mypet` via `CompactBanner`.

- [ ] **Step 1: Confirmar que existem banners do tipo `"principal"` cadastrados**

O `CompactBanner` só renderiza o `BannerCarousel` quando `getBanners(channel, "principal")` retorna pelo menos 1 item para o canal configurado em `apps/mypet/client.config.ts` (`catalogChannel`). Se a tabela `banners` no Supabase estiver vazia para esse canal/tipo, a home vai mostrar o `FallbackBanner` (inalterado) em vez do carrossel novo — cadastre ao menos 2-3 banners de teste do tipo `"principal"` para esse canal antes de seguir (ou confirme com quem administra o Supabase que já existem).

- [ ] **Step 2: Subir o dev server**

Run: `pnpm dev:mypet`
Expected: servidor sobe em `http://localhost:4100` sem erro no terminal.

- [ ] **Step 3: Verificar comportamento desktop**

Abrir `http://localhost:4100` numa janela larga (>1024px). Confirmar:
- Cards do banner aparecem lado a lado com o último parcialmente cortado (peek).
- Nenhuma seta aparece até passar o mouse sobre a área do carrossel.
- Ao passar o mouse (hover), a seta "próximo" aparece do lado direito (a seta "anterior" não aparece ainda, pois o scroll está no início).
- Clicar na seta "próximo" rola suavemente um card para a direita; a seta "anterior" passa a aparecer no hover.
- Rolar até o fim faz a seta "próximo" desaparecer.
- Usando `Tab` no teclado, a seta focada fica visível mesmo sem hover do mouse (outline branco visível).

- [ ] **Step 4: Verificar comportamento mobile**

Abrir o DevTools, ativar emulação de dispositivo móvel (ex: iPhone 12, 390px de largura) com emulação de touch ativa. Confirmar:
- Nenhuma seta aparece em nenhum momento.
- É possível arrastar/deslizar o carrossel horizontalmente (swipe) e ele "encaixa" no card seguinte ao soltar (scroll-snap).
- O próximo card fica parcialmente visível na borda direita (peek), sinalizando que há mais conteúdo.

- [ ] **Step 5: Confirmar que `apps/distribuidora` não quebrou**

Run: `pnpm dev:distribuidora`
Abrir a home e confirmar que o banner principal também renderiza o novo carrossel (ou o `FallbackBanner`, se não houver banners cadastrados para o canal da distribuidora) sem erros no console.
