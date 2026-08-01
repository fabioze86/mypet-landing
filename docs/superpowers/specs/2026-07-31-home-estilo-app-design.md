# Home estilo app (Mercado Livre / 99) — distribuidora e mypet

## Contexto e motivação

O usuário decidiu não desenvolver um app nativo (Android/iOS) por desproporção entre custo de manutenção e volume de clientes, e já está construindo a rota PWA (ver `docs/superpowers/specs/2026-07-31-pwa-distribuidora-design.md`). O próximo passo é fazer a experiência da home **parecer** um app nativo mesmo rodando no navegador — usando como referência visual os apps Mercado Livre e 99 (prints anexados pelo usuário).

O problema concreto na home atual: um hero gigante em texto (title 52px, ~600px de altura combinada com padding) empurra o catálogo de produtos para muito abaixo da primeira dobra da tela no mobile. Em apps de referência como Mercado Livre e 99, produtos/categorias/ofertas já aparecem nos primeiros segundos de scroll.

`apps/distribuidora/app/page.tsx` e `apps/mypet/app/page.tsx` são hoje arquivos **idênticos** (confirmado via diff). Esta entrega reescreve os dois.

## Objetivo

Redesenhar a home (`apps/distribuidora` e `apps/mypet`) para que, na primeira metade visível da tela no mobile, já apareçam: menu de categorias, banner promocional pequeno, ícones de navegação rápida, e o início do grid de produtos — replicando a densidade de informação e a hierarquia visual do Mercado Livre / 99, sem exigir instalação de app nativo.

## Escopo

**Dentro do escopo:**
- Reestruturação da ordem e do visual da home nos dois apps (`distribuidora`, `mypet`).
- Novo componente de chips de categoria horizontais roláveis.
- Novo componente de banner compacto (substitui o hero gigante), reaproveitando os banners tipo `"principal"` já cadastrados no Supabase (`getBanners`), corrigindo o bug de só exibir o primeiro banner (`const [banner] = ...`) para exibir todos em carrossel.
- Novo componente de ícones de navegação rápida (Kits, Ofertas, Cupons, Fabricação Própria) — **placeholder visual, sem destino funcional** nesta entrega (decisão explícita do usuário).
- Redesenho visual (não estrutural) das seções de estatísticas, CTA final e footer — mesmo conteúdo/dados, layout mais compacto e moderno.
- `mini-banner-strip.tsx` mantido sem alterações (já é compacto e horizontal, serve como segunda fileira de banners/ofertas).
- `product-card.tsx` e `catalog-section.tsx` mantidos sem alterações (visual já compatível com foto+título+preço do 99).

**Fora do escopo (não faz parte desta entrega):**
- Destinos reais dos 4 ícones de navegação rápida — ficam com `opacity` reduzida e sem link, para o usuário definir depois.
- Bottom navigation fixa (Início/Categorias/Carrinho/Pedidos) — decisão explícita do usuário de deixar para uma etapa futura separada.
- Mudança de fonte (`Nunito`/`Nunito Sans` mantidos).
- Qualquer link ou dado fictício novo no footer (redes sociais, contato) — mantém exatamente o conteúdo atual.
- Mudanças em `apps/azpetshop`, `apps/hub`, `apps/admin`.
- Página de produto, página de categoria, carrinho — só a home muda.

## Arquitetura

Novos componentes em `packages/core/src/components/` (compartilhados entre apps):

```
packages/core/src/components/
├── category-chips.tsx       (novo)
├── compact-banner.tsx       (novo — substitui hero-section.tsx, que é removido)
├── quick-nav-icons.tsx      (novo)
├── mini-banner-strip.tsx    (sem mudança)
├── product-card.tsx         (sem mudança)
└── catalog-section.tsx      (sem mudança)
```

`hero-section.tsx` é removido (toda referência migra para `compact-banner.tsx`).

`packages/core/src/banners.ts`: `getBanners` não muda de assinatura; o consumo em `compact-banner.tsx` usa a lista inteira retornada (hoje `hero-section.tsx` descartava tudo exceto `[0]`).

Nova ordem de `apps/distribuidora/app/page.tsx` e `apps/mypet/app/page.tsx` (idênticos, como hoje):

```
SiteNav (sem mudança)
→ CategoryChips
→ CompactBanner (carrossel ~150px)
→ QuickNavIcons
→ MiniBannerStrip (sem mudança)
→ Catálogo (grid de produtos — DynamicCatalog, sem mudança de lógica)
→ AssistantSearch (reposicionado — antes ficava logo após o hero)
→ Estatísticas (redesenhada — mesmos 4 dados)
→ CTA final (redesenhada — mesmo texto/botão)
→ Footer (redesenhado — mesmo conteúdo)
```

## Componentes

### `category-chips.tsx`
Recebe `tree: CategoryTreeNode[]` (mesma fonte que já alimenta `MegaMenu`/`MobileMenu`, via `buildCategoryTree`). Renderiza chips horizontais roláveis (`overflow-x: auto`, sem scrollbar visível), "Todas" sempre como primeiro chip e marcado ativo (a home já mostra o catálogo completo). Cada chip de categoria linka para `/categoria/{slug}` — rota que já existe hoje via `MegaMenu`/`MobileMenu`, sem lógica de filtro nova.

### `compact-banner.tsx`
Server component `async`, recebe `channel` e `palette`. Busca `getBanners(channel, "principal")` e renderiza **todos** os banners retornados (correção do bug atual que só usava o primeiro) num carrossel horizontal com `scroll-snap`, altura fixa ~150px, `object-fit: cover`, cantos arredondados (14px). Se a lista vier vazia, renderiza `FallbackBanner` — mesmo gradiente navy/pink usado hoje no hero, porém compacto (mesma altura ~150px, sem headline de 52px, só um texto curto centralizado).

### `quick-nav-icons.tsx`
Client-agnostic (não precisa de `"use client"`), recebe só `palette` via `useClientConfig()`. Lista fixa de 4 itens (`Kits`, `Ofertas`, `Cupons`, `Fabricação Própria`) com emoji + label, `opacity: 0.55`, sem `href`. Layout `flex`, `justify-content: space-around`.

### Estatísticas, CTA, Footer
Mesma lógica/dados de hoje (`StatsCount`, texto do CTA, conteúdo do footer), só o markup/CSS muda: estatísticas ganham ícone e padding reduzido (28px → 16px, sem borda divisória vertical); CTA reduz padding vertical (64px → 44px) e troca o emoji solto por um badge circular; footer ganha layout em duas linhas no mobile e `padding-bottom: env(safe-area-inset-bottom)`.

## Tratamento de erro / casos vazios

- `compact-banner.tsx` sem banners cadastrados → `FallbackBanner` (nunca quebra o layout, nunca fica vazio).
- `category-chips.tsx` sem categorias (`tree.length === 0`) → não renderiza nada (mesmo padrão já usado em `MobileMenu`).
- `quick-nav-icons.tsx` não depende de dado externo — sempre renderiza os 4 itens fixos.

## Testes / verificação

- Sem testes automatizados de snapshot visual (fora de escopo — mudança é primariamente de CSS/markup).
- `getBanners` ganha um teste unitário cobrindo que `compact-banner.tsx` consome a lista inteira (não só o primeiro item) — regressão do bug identificado nesta spec.
- Verificação manual: `npm run dev` nos dois apps, conferir no viewport mobile (375px) que categoria/banner/ícones/início do catálogo aparecem sem rolar mais que ~1 tela.
- Conferir que `apps/distribuidora/app/page.tsx` e `apps/mypet/app/page.tsx` continuam idênticos após a mudança (mesma decisão de duplicação que já existe hoje, não é objetivo desta entrega mudar isso).
