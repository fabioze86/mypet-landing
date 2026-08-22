# Carrossel de banner principal estilo Amazon

## Contexto e motivação

O usuário quer que o banner principal da home de `apps/mypet` fique com o mesmo formato, disposição e experiência do carrossel de banners de topo da home da Amazon.com (referência: print anexado pelo usuário — fileira de cards lado a lado, setas de navegação nas laterais, peek do próximo card, comportamento equivalente no mobile), **ignorando o conteúdo/arte visual de cada banner** — o pedido é sobre a moldura/comportamento do carrossel, não sobre redesenhar as imagens em si.

## Escopo

**Dentro do escopo:**
- Componente `CompactBanner` (`packages/core/src/components/compact-banner.tsx`), que hoje renderiza o banner principal logo abaixo dos chips de categoria em `apps/mypet/app/page.tsx`.
- Como `CompactBanner` é um componente compartilhado (`packages/core`), usado também por `apps/distribuidora/app/page.tsx` (páginas mantidas intencionalmente idênticas, conforme `docs/superpowers/specs/2026-07-31-home-estilo-app-design.md`), a mudança será feita no componente compartilhado — o novo comportamento vale para os dois apps.
- Comportamento de carrossel: setas de navegação (desktop), peek do próximo card, scroll suave, sem dots, sem autoplay.

**Fora do escopo:**
- `MiniBannerStrip` (segunda fileira de banners, antes do catálogo) — permanece como está hoje.
- Redesenho da arte/conteúdo dos banners (imagens, textos, proporções internas de cada criativo).
- `apps/azpetshop`, `apps/hub`, `apps/admin`.
- Nova infraestrutura de teste de componente React (Vitest hoje só roda `*.test.ts` em ambiente `node`, sem `jsdom`).

## Abordagem técnica

Sem dependência nova. Implementação nativa: scroll horizontal com `scroll-snap` (já usado hoje) + botões de seta que chamam `scrollBy({ left, behavior: "smooth" })` + listener de `scroll`/`resize` para habilitar/desabilitar as setas nos extremos.

Rejeitada: instalar `embla-carousel-react`. Traria drag physics e uma API pronta de `canScrollPrev/canScrollNext`, mas é uma dependência nova num pacote compartilhado por todos os apps do monorepo, e o comportamento pedido (setas + peek + snap) não exige uma lib — o scroll nativo já resolve o swipe mobile.

## Arquitetura

`compact-banner.tsx` é hoje um server component `async` que busca dados (`getBanners`) e renderiza tudo inline. Passa a ser dividido em dois:

- **`compact-banner.tsx`** (server, sem mudança de assinatura): continua chamando `getBanners(channel, "principal")`; se a lista vier vazia, renderiza `FallbackBanner` (sem alterações). Se houver banners, passa `banners` + `palette` para o novo componente de UI.
- **`banner-carousel.tsx`** (novo, `packages/core/src/components/banner-carousel.tsx`, `"use client"`): recebe `banners: Banner[]` e `palette: Palette`. Cuida de: ref do container de scroll, estado de habilitado/desabilitado de cada seta, listeners de `scroll`/`resize`, e renderização dos botões de seta sobrepostos.

Motivo da divisão: `useRef`/`useState`/listeners de evento exigem client component; não faz sentido converter `compact-banner.tsx` inteiro em client só por causa da interação das setas, perdendo o fetch direto no server.

## Comportamento visual e UX

- **Cards**: mantém `border-radius: 14px`, `object-fit: cover`, `flex: 0 0 auto`, largura fixa por breakpoint.
- **Peek**: layout não tenta encaixar um número exato de cards na largura do container — o último card visível fica parcialmente cortado, sinalizando que há mais conteúdo pra rolar (igual ao print da Amazon).
- **Setas**: botões circulares (~40px), fundo `rgba(0,0,0,0.45)`, ícone chevron branco, `position: absolute` sobre as bordas esquerda/direita do carrossel, leve `box-shadow`. Clique dispara `scrollBy({ left: ±(largura do card + gap), behavior: "smooth" })` (respeitando `prefers-reduced-motion`, ver seção de acessibilidade).
- **Estado disabled**: seta esquerda com `display: none` quando `scrollLeft <= 0`; seta direita com `display: none` quando `scrollLeft + clientWidth >= scrollWidth - 1`. Recalculado em listener de `scroll` (throttled) e `resize`.
- **Hover**: no desktop, as setas ficam ocultas por padrão e aparecem com fade ao passar o mouse sobre o carrossel (igual à Amazon); leve escurecimento/scale no `:hover` do próprio botão.
- **Sem dots, sem autoplay** — o carrossel de topo da Amazon usado como referência não usa nenhum dos dois.

## Responsividade

- **Mobile** (larguras estreitas / dispositivos sem mouse fino): setas nunca aparecem — detecção via `@media (hover: hover) and (pointer: fine)`, não apenas largura de viewport, para não esconder as setas em tablets com mouse. Peek obtido com cards que não ocupam 100% da viewport (largura ~85vw), mantendo `scroll-snap-type: x mandatory` / `scroll-snap-align: start` para o alinhamento ao soltar o swipe.
- **Desktop**: setas aparecem no hover do container; vários cards visíveis por vez, com peek do próximo card na borda.
- Dimensões de card mantêm a base atual (320×150 no desktop); a largura mobile passa a ser relativa (`~85vw`) em vez de fixa, para gerar o peek.

## Acessibilidade

- Botões de seta com `aria-label="Banner anterior"` / `aria-label="Próximo banner"`, `type="button"`.
- Setas focáveis via teclado (`Tab`); aparecem também em `:focus-visible`, não só `:hover`, para não excluir navegação por teclado.
- Respeita `prefers-reduced-motion: reduce` — usa `scroll-behavior: auto` em vez de `smooth` quando o usuário sinalizou preferência por menos movimento.

## Tratamento de erro / casos vazios

- Sem mudança: `banners.length === 0` continua renderizando `FallbackBanner`, exatamente como hoje.

## Testes / verificação

- Sem nova infraestrutura de teste de componente (fora de escopo).
- Verificação manual: `npm run dev` em `apps/mypet`, checar no viewport desktop que as setas aparecem/desaparecem corretamente nos extremos do scroll, e no viewport mobile (375px) que o swipe funciona com peek e sem setas visíveis. Conferir também que `apps/distribuidora` continua funcionando normalmente, já que o componente é compartilhado.
