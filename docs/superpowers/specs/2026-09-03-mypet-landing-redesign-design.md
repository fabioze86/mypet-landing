# Redesign da landing pública do `apps/mypet`

Data: 2026-09-03
Alcance: reskin + mobília (mantém as seções e o conteúdo atuais, adiciona a
estrutura que falta e varia o ritmo). Não é overhaul de narrativa.

## Problema

A landing de pré-acesso do canal `mypetbrasil` (`apps/mypet/app/page.tsx` +
`_components/pre-access/*`) lê como rascunho ao lado de landings equivalentes
geradas no Lovable. As causas concretas, levantadas do código:

1. **Zero imagens.** `.pa-edu-mark` é um `<div>` vazio no lugar de ícone;
   categorias caem em iniciais de texto quando não há thumb.
2. **Fonte Nunito** (`layout.tsx`) — terminações arredondadas, registro
   "pet-hobby", não "distribuidora B2B".
3. **Sem prova social** — nenhuma métrica, nenhum depoimento.
4. **Sem sistema de ícones** — nenhuma lib instalada.
5. **Hero chapado** — faixa amarela full-bleed, sem foco visual nem profundidade.
6. **Ritmo repetido** — toda seção é `pa-wrap` + `h2` + lead + grid.
7. **Paleta incoerente** — o `<style>` da campanha (amarelo/navy/verde/creme) não
   bate com a paleta da marca em `client.config.ts` (pink/cyan/navy).
8. **Espaçamento apertado** (`52px` de seção) — pouco "respiro".

## Decisões travadas (do brainstorming)

- **Alcance:** reskin + mobília.
- **Paleta:** navy como âncora, verde como acento único, amarelo sai.
- **Fonte:** Geist (texto/título) + Geist Mono (números).
- **Imagens disponíveis:** fotos do CD/equipe/operação, fotos de produto, banco
  da campanha. Onde os arquivos não chegarem, usar slots `picsum` marcados TODO.
- **Prova social real:** depoimentos com nome + cidade + loja; contagem de
  itens/SKUs (~5 mil). **Não** usar contagem de lojas ativas (não sustentável).
- **Movimento:** dial 2–3. Só transições de hover + fade-up leve em CSS puro,
  atrás de `@media (prefers-reduced-motion: no-preference)`. Sem biblioteca.
- **Sem worktree / sem branch** — trabalho direto na `main` (preferência do
  usuário registrada).

## Sistema visual

Tema único, travado: página clara + faixas navy de âncora. Nenhuma seção
inverte para tema diferente no meio.

| Token | Valor |
|---|---|
| Fonte texto/título | `Geist` via `next/font/google`, var `--font-geist` |
| Fonte números | `Geist_Mono`, var `--font-geist-mono` (métricas, valores de condição, prazos) |
| Cor âncora | navy `#1A3472` / navy-dark `#0F1F45` (de `client.config.ts`) — hero, faixa de CTA, footer |
| Acento único | verde `#00A651` — CTAs, ícones, destaques, marcador do FAQ. Nenhuma outra cor de acento na página |
| Texto | ink `#0F1F45` sobre claro; branco 82% sobre navy |
| Muted | `#5A6580` |
| Fundo | branco nos cards; off-white `#F8F9FB` nas seções alternadas |
| Linha | `#DDE2EC` |
| Raio | card `16px`, input `10px`, pill `full` — escala única, aplicada em tudo |
| Sombra | tingida de navy, sutil, só em elevação real: `0 12px 32px rgba(15,31,69,.10)` |
| Ícones | `@phosphor-icons/react`, `weight="duotone"`, tamanho padrão 24 |
| Espaço de seção | `96px` desktop / `64px` `<900px` |

Implementação do estilo: **mantém o padrão atual** de um único bloco
`<style>{LANDING_STYLES}</style>` em `page.tsx`, alimentado por `styles.ts`.
`LANDING_STYLES` é reescrito por inteiro com os tokens acima. Sem migração para
Tailwind (fora do alcance; o padrão vigente é o `<style>` string).

Fontes: `layout.tsx` troca `Nunito`/`Nunito_Sans` por `Geist`/`Geist_Mono`.
`globals.css` atualiza `--font-sans` / `--font-mono` para as novas vars.

Copy: toda string visível que o redesign tocar tem `—` (em-dash) e `–`
(en-dash usado como separador) trocados por vírgula, ponto, parênteses ou
hífen. Vale para `pre-access-content.ts`, `styles.ts` e componentes.

## Estrutura da página (`page.tsx`)

Só o hero tem eyebrow. As demais seções entram só com o H2.

| # | Seção | Componente | Família de layout | Estado |
|---|---|---|---|---|
| 1 | Header | inline em `page.tsx` | nav | restyle |
| 2 | Hero | `hero.tsx` | hero navy split (copy + card de acesso) | rework |
| 3 | Barra de métricas | `metrics-bar.tsx` | stat row | novo |
| 4 | Condições comerciais | `commercial-conditions.tsx` | 3 icon-cards | + ícones |
| 5 | Como funciona em 4 passos | `how-it-works.tsx` | stepper numerado | novo (substitui `education-cards.tsx`) |
| 6 | Vitrine do catálogo | `catalog-preview.tsx` | media grid | funde `popular-categories.tsx` + fotos de produto |
| 7 | Depoimentos | `testimonials.tsx` | testimonial cards | novo |
| 8 | FAQ | `commercial-faq.tsx` | accordion | restyle |
| 9 | Como a My Pet opera | `institutional-trust.tsx` | text band | enxugado |
| 10 | Faixa de CTA final | `closing-cta.tsx` | navy CTA band | novo |
| 11 | Footer | inline em `page.tsx` | footer | restyle |

Famílias de layout distintas: 9+. Sem zigzag repetido, sem marquee, sem
parallax, sem scroll-hijack.

### 2 — Hero (`hero.tsx`)

- `<section>` fundo navy `#0F1F45`, `position: relative`. Foto do CD via
  `next/image` com `fill` + `priority`, `object-fit: cover`, `opacity: .18`,
  atrás do conteúdo; um `<div>` de gradiente navy por cima (`z-index` entre
  imagem e conteúdo) garante contraste do texto. Conteúdo em `position:
  relative`. Sem foto: o navy chapado já se sustenta.
- Grid `1.05fr / 0.95fr`, colapsa para 1 coluna `<900px`.
- Esquerda: eyebrow verde (pílula) · H1 Geist, `clamp(32px, 4.6vw, 48px)`,
  máx. 2 linhas, **uma palavra em verde** (ex.: "condições de atacado
  **claras**") · lead ≤20 palavras · 2 CTAs (`Ver condições` primário branco,
  `Ver categorias` ghost com borda branca).
- Direita: card branco `id="acesso"` com `<AccessForm />` (inalterado),
  título "Criar acesso à loja" + sub. Sombra navy.
- `next/image` com `priority` na foto de fundo (LCP).
- Cabe na viewport a 1280×800: `pt-24` máx., sem tagline extra abaixo dos CTAs.

### 3 — Barra de métricas (`metrics-bar.tsx`)

- Faixa off-white, `pa-wrap`, 4 itens em linha (colapsa 2×2 `<700px`, 1 col
  `<480px`). Sem cards — só número + label, divididos por `border-left`.
- Número em Geist Mono, label em Geist muted.
- Dados de `pre-access-content.ts › metrics` (novo array). Rascunho:
  - `~5 mil` · itens no catálogo
  - `{categoryCount}` · categorias em destaque (vem de `page.tsx`)
  - `Brasil` · entrega para todas as regiões
  - `3 a 7 dias` · úteis no Sul e Sudeste após despacho
- **Nenhuma métrica inventada.** Todas derivam de `pre-access-content.ts` /
  contagem de categorias / regras já publicadas.

### 4 — Condições comerciais (`commercial-conditions.tsx`)

- Mantém os 3 itens de `commercialConditions`. Adiciona `icon` a cada item no
  content file (nome do glifo Phosphor: `CurrencyCircleDollar`, `CreditCard`,
  `Truck`).
- Card: ícone duotone verde no topo, `h3`, valor em Geist Mono verde-escuro,
  detalhe muted. Acento verde no topo do card mantido, 3px.
- Grid 3 col, 1 col `<900px`.

### 5 — Como funciona em 4 passos (`how-it-works.tsx`)

- Substitui `education-cards.tsx` (o intento de "auto-qualificação" migra para
  métricas + passos). `education-cards.tsx` e `educationCards` são removidos.
- 4 passos numa linha com linha de conexão horizontal atrás dos números
  (`::before` na row). Colapsa para vertical `<900px` com a linha à esquerda.
- Cada passo: círculo navy com número (Geist Mono) + ícone Phosphor pequeno,
  título, uma frase.
- Conteúdo de `pre-access-content.ts › steps` (novo array):
  1. Cadastro com CNPJ e WhatsApp
  2. Acesso liberado na hora
  3. Monta o pedido no carrinho
  4. Recebe no endereço do CNPJ

### 6 — Vitrine do catálogo (`catalog-preview.tsx`)

- Renomeia/expande `popular-categories.tsx`. Recebe `categories` + `thumbs`
  (como hoje) e opcionalmente `productImages` (fotos sem preço).
- Bloco A: tiles de categoria com foto (`thumbs`), fallback iniciais mantido
  mas restilizado (navy sobre navy-light).
- Bloco B: fileira horizontal de 4–6 fotos de produto, `scroll-snap`, cada uma
  com legenda curta (nome da categoria/linha), **sem preço, sem SKU**.
- Link de tudo para `#acesso`. Texto fixo: "preço, estoque e carrinho só na
  loja, depois do acesso".
- **Invariante:** nenhum preço/valor de produto nesta página. Coberto por teste.

### 7 — Depoimentos (`testimonials.tsx`)

- 3 cards em grid (1 col `<900px`), fundo navy-light `#EDF0F8`.
- Card: 5 estrelas verdes (glifo `Star` duotone), citação (máx. 3 linhas),
  nome + cidade + loja em linha de atribuição (sem em-dash, usar `·` ou
  quebra).
- Conteúdo de `pre-access-content.ts › testimonials` (novo array).
- **Placeholder até o usuário fornecer:** 3 entradas marcadas
  `// TODO: depoimento real` com nomes/cidades/lojas plausíveis do ramo pet BR
  e comentário no topo do array avisando que são fictícios até substituição.

### 8 — FAQ (`commercial-faq.tsx`)

- Só restyle. Sai do creme, entra em off-white. `summary` em Geist, marcador
  `+ / −` vira círculo verde. Todas as perguntas de `commercialFaq` ficam,
  nascem fechadas.

### 9 — Como a My Pet opera (`institutional-trust.tsx`)

- Enxuga para uma faixa curta: 3 pontos (`Compra por CNPJ`, `{n} categorias`,
  `Suporte pós-acesso`) em linha, cada um com ícone Phosphor pequeno, sem os
  parágrafos longos atuais (uma frase cada). Antes da faixa de CTA.

### 10 — Faixa de CTA final (`closing-cta.tsx`)

- Banda navy `#0F1F45`, `pa-wrap`, centralizada: H2 branco + uma frase +
  1 CTA verde para `#acesso` ("Criar acesso à loja"). Intenção de CTA única
  na página inteira: "criar acesso" (header, hero primário, faixa final usam
  o mesmo rótulo; o hero tem um secundário de navegação, não de conversão).

### 11 — Footer

- Restyle navy-dark, Geist, crédito Zemann.ai mantido. Sem version stamp, sem
  strip de locale/hora.

## Arquivos afetados

Novos:
- `apps/mypet/app/_components/pre-access/metrics-bar.tsx`
- `apps/mypet/app/_components/pre-access/how-it-works.tsx`
- `apps/mypet/app/_components/pre-access/catalog-preview.tsx` (de
  `popular-categories.tsx`)
- `apps/mypet/app/_components/pre-access/testimonials.tsx`
- `apps/mypet/app/_components/pre-access/closing-cta.tsx`

Alterados:
- `apps/mypet/app/layout.tsx` — fontes Geist/Geist Mono
- `apps/mypet/app/globals.css` — `--font-sans` / `--font-mono`
- `apps/mypet/app/_components/pre-access/styles.ts` — `LANDING_STYLES`
  reescrito por inteiro
- `apps/mypet/app/page.tsx` — nova composição de seções + header/footer restyle
- `apps/mypet/app/_components/pre-access/hero.tsx` — rework
- `apps/mypet/app/_components/pre-access/commercial-conditions.tsx` — ícones
- `apps/mypet/app/_components/pre-access/commercial-faq.tsx` — restyle
- `apps/mypet/app/_components/pre-access/institutional-trust.tsx` — enxugar
- `apps/mypet/app/pre-access-content.ts` — novos arrays `metrics`, `steps`,
  `testimonials`; campo `icon` em `commercialConditions`; varredura de em-dash
- `apps/mypet/package.json` — dependência `@phosphor-icons/react`

Removidos:
- `apps/mypet/app/_components/pre-access/education-cards.tsx`
- `educationCards` em `pre-access-content.ts`

## Assets pendentes do usuário

Se não chegarem, entram como slot `picsum` + comentário `{/* TODO: asset real */}`.

1. Foto do hero (CD/operação) e 4–6 fotos de produto para a vitrine (ou aval
   para reusar as thumbs de catálogo da `/loja`).
2. 2–3 depoimentos reais: texto + nome + cidade + loja.
3. Confirmação do texto das 4 métricas.

## Testes

`apps/mypet/app/page.test.tsx` (já existe) é estendido:

- Renderiza sem erro com `getCategories` / `getCategoryThumbs` mockados.
- Cada seção nova aparece (`metrics-bar`, `how-it-works`, `testimonials`,
  `closing-cta`) — por role/heading acessível.
- **Invariante de preço:** o HTML renderizado da landing não contém `R$` nem
  padrão de preço. (protege a vitrine nova.)
- CTA "criar acesso" aparta com `href="#acesso"` no header, hero e faixa final.
- `education-cards` deixou de ser referenciado (sem import quebrado).

`pnpm --filter mypet test` verde antes de concluir.

## Fora do alcance

- Migração para Tailwind/shadcn.
- Biblioteca de animação / scroll-telling.
- Mudança de conteúdo do FAQ ou das regras comerciais.
- Alteração do `AccessForm`, das rotas, do fluxo de pré-acesso ou de qualquer
  coisa em `/loja`.
- Dark mode (a landing é light-locked por decisão).
