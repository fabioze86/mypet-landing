# MAD PET — Home v2 (inspirada no atacado Zarpellon)

Data: 2026-08-30
App: `apps/madpet`
Status: aprovado para implementação

## Objetivo

Criar uma segunda versão da home do canal MAD PET (B2B, revenda para pet
shops), servida em `/v2`, com a **estrutura de seções do site atacadista da
Zarpellon** (grid grande de categorias, faixa de vantagens, seção escura
"sobre" com mídia, carrossel de depoimentos, newsletter, rodapé denso) mas com
a **identidade visual MAD PET**: paleta roxo/verde, fontes arredondadas
Fredoka/Nunito, tom pet.

A home atual (`app/page.tsx`) e todos os componentes compartilhados permanecem
intocados. Fica disponível para comparação lado a lado; nenhuma flag ou
substituição.

## Decisões de escopo

- **Rota:** nova página `app/v2/page.tsx`. Sem flag, sem env, sem A/B.
- **Estética:** estrutura Zarpellon, cara MAD PET.
- **Seções:** todas as do print que fazem sentido no canal — barra de aviso,
  header central, mosaico de categorias, faixa de vantagens, sobre + mídia,
  depoimentos, newsletter, rodapé denso.
- **Mosaico:** grid 2×3 — 4 tiles de linha (`PRODUCT_LINES`) + 2 tiles
  temáticos ("Novidades do mês", "Kit vitrine para começar").
- **Tile de linha:** faz scroll até o carrossel real da linha, renderizado na
  própria `/v2` via `LineSection` reaproveitado.
- **Tile temático:** abre WhatsApp com mensagem própria.
- **Depoimentos:** mock local em `lib/testimonials.ts` (5 placeholders).
- **Newsletter:** formulário só visual, sem POST, sem backend.
- **Código:** conjunto próprio de componentes em `components/v2/`,
  reaproveitando apenas dados e alguns componentes de infraestrutura.

## Arquitetura

### Arquivos novos

```
apps/madpet/app/v2/page.tsx                    server, exporta metadata própria
apps/madpet/components/v2/announcement-bar.tsx server
apps/madpet/components/v2/site-header.tsx      client (toggle mobile)
apps/madpet/components/v2/category-mosaic.tsx  server
apps/madpet/components/v2/advantages-strip.tsx server
apps/madpet/components/v2/about-block.tsx      server
apps/madpet/components/v2/testimonials-carousel.tsx client
apps/madpet/components/v2/newsletter-block.tsx client
apps/madpet/components/v2/site-footer.tsx      server
apps/madpet/lib/testimonials.ts               dado mock
```

### Arquivo existente alterado

- `apps/madpet/app/globals.css` — acrescentar, ao final, o bloco de classes
  responsivas com prefixo `mpv2-` (ver "Estilos"). Nenhuma regra existente é
  modificada.

### Reaproveitado sem cópia

- `LineSection` (`components/line-section.tsx`) — carrosséis de produto reais,
  canal `ffa_fabrica`, busca via `getCatalog`.
- `CatalogSection` (`components/catalog-section.tsx`) — wrapper/título do bloco
  de catálogo.
- `WhatsAppFloatButton` (`components/whatsapp-float-button.tsx`).
- `Logo` (`components/logo.tsx`).
- `BonePattern` (`components/bone-pattern.tsx`) — textura nos tiles temáticos.
- Dados: `buildWhatsAppLink` (`@mypet/core/whatsapp`), `clientConfig`
  (`client.config.ts`), `PRODUCT_LINES` (`lib/product-lines.ts`).
- Tema: `madPetPalette`, `theme` (`client-theme.ts`).

## Estrutura da página `/v2`

Ordem de render em `app/v2/page.tsx`:

1. `<AnnouncementBar />`
2. `<SiteHeader whatsappLink={genericWhatsappLink} />`
3. `<CategoryMosaic lines={PRODUCT_LINES} whatsappNumber={...} />`
4. `<AdvantagesStrip />`
5. `<CatalogSection>` + `PRODUCT_LINES.map(line => <LineSection ... />)`
   — mesmo padrão do `app/page.tsx` atual (tone alternado `plain`/`tint`).
6. `<AboutBlock whatsappLink={atacadistaLink} />`
7. `<TestimonialsCarousel />`
8. `<NewsletterBlock />`
9. `<SiteFooter mainSiteUrl distribuidoraUrl whatsappLink />`
10. `<WhatsAppFloatButton link={genericWhatsappLink} />`

`page.tsx` monta os links do WhatsApp (genérico, atacadista, um por tile
temático) e passa por props, como a home atual faz.

`export const metadata` próprio da rota: título/descrição focados em "catálogo
de fabricação própria para revenda".

## Componentes

### `announcement-bar.tsx` (server)

Faixa `palette.purpleDark`, texto branco 12px, `letter-spacing` caps,
centralizado: "Frete grátis para revenda a partir de R$ [VALOR] em pedido".
`VALOR` como constante no topo do arquivo (placeholder para ajuste comercial).

### `site-header.tsx` (client)

Precisa de estado para o toggle mobile — `"use client"`.

- Wordmark centralizado (`<Logo>`).
- Nav abaixo do wordmark: **Catálogo · Vantagens · Sobre · Depoimentos** (âncoras
  `#catalogo`, `#vantagens`, `#sobre`, `#depoimentos`) + botão verde
  ("Quero revender", `whatsappLink`, `target="_blank"`).
- `position: sticky; top: 0; z-index`. Sombra `theme.shadowCard` ao rolar
  (listener de scroll simples, ou sempre com sombra leve — implementação livre).
- Mobile (<760px): nav colapsa em botão hambúrguer (`.mpv2-nav-toggle`) que
  abre/fecha painel vertical. Disclosure próprio com `useState`, sem
  biblioteca. `aria-expanded` no botão, `aria-label`.

### `category-mosaic.tsx` (server)

- Cabeçalho enxuto: h2 "O catálogo de fabricação própria" (Fredoka) + 1 linha
  de apoio (`palette.gray600`). `id="catalogo"` neste bloco **ou** deixar o
  `id="catalogo"` no `CatalogSection` — usar `id` distinto aqui
  (`id="mosaico"`) para não duplicar. A âncora "Catálogo" do header aponta para
  o mosaico (`#mosaico`).
- Grid `.mpv2-mosaic` (`repeat(3,1fr)`), gap ~16px.
- **4 tiles de linha** (de `PRODUCT_LINES`):
  - `aspect-ratio: 3 / 4`, `borderRadius: theme.radiusCard`, `overflow: hidden`.
  - Foto `https://picsum.photos/seed/madpet-mosaic-<slug>/600/800` com
    `<img>` + comentário `TODO` de foto real / `next/image` (padrão já usado no
    app).
  - Gradiente escuro no rodapé do tile + label `line.label` em Fredoka branco.
  - Pílula "clique e confira" — borda `1px solid rgba(255,255,255,0.7)`,
    `borderRadius: theme.radiusPill`, texto branco pequeno.
  - `<a href={"#" + line.slug}>` — os `LineSection` já têm `id={line.slug}` e
    `scrollMarginTop: 80`.
  - Classe `mp-card` para hover.
- **2 tiles temáticos:**
  - "Novidades do mês" — fundo `palette.purple` + `<BonePattern>`.
  - "Kit vitrine para começar" — fundo `palette.purpleDark` + `<BonePattern>`.
  - Mesma moldura/label/pílula dos tiles de linha, sem foto.
  - `<a href={buildWhatsAppLink(whatsappNumber, msg)}>` com `msg` própria de
    cada tile (ex.: "Quero ver as novidades MAD PET do mês para revenda." /
    "Quero montar um kit inicial MAD PET para a vitrine da minha loja.").
    `target="_blank" rel="noopener noreferrer"`.

### `advantages-strip.tsx` (server)

- `id="vantagens"`. Fundo `palette.white`. Título centralizado "Vantagens em
  revender MAD PET" (Fredoka).
- Grid `.mpv2-adv` (4 col). Cada item:
  - Ícone SVG inline, traço, `stroke="currentColor"`, cor `palette.purple`,
    ~32px.
  - Título curto (800) + 1 linha de apoio (`palette.gray600`).
- Os quatro itens:
  1. **Fabricação própria** — "Linha nossa, do corte ao acabamento. Reposição
     sem esperar contêiner."
  2. **Giro rápido na gôndola** — "Cor que para o cliente na prateleira antes
     de qualquer argumento de venda."
  3. **Frete grátis por faixa de pedido** — "Fechou a faixa, o frete sai de
     graça para todo o Brasil."
  4. **Tabela e pedido no WhatsApp** — "Sem cadastro em portal. Você fala com o
     comercial e já sai com a condição."
  (Textos podem ser ajustados na implementação; manter tom de
  `why-resell.tsx`.)

### `about-block.tsx` (server)

- `id="sobre"`. Seção `palette.purpleDark`, `<BonePattern color={white}
  opacity={0.06}>` opcional.
- Grid `.mpv2-about` (2 col):
  - Esquerda: h2 "Sobre a MAD PET" (Fredoka, branco) + 2 parágrafos (base:
    conteúdo de `why-resell.tsx` / `seo-block.tsx`) + botão branco "Seja nosso
    cliente atacadista" (`whatsappLink` atacadista, `target="_blank"`).
  - Direita: bloco de mídia = `<img>` `picsum` (`aspect-ratio: 4/3`,
    `borderRadius: theme.radiusCard`) com overlay escuro leve e botão de play
    desenhado em SVG centralizado. **Sem player real.** Comentário `TODO:
    trocar por vídeo institucional`.

### `testimonials-carousel.tsx` (client)

- `id="depoimentos"`. `"use client"`, `useState` para índice.
- Importa `TESTIMONIALS` de `lib/testimonials.ts`.
- Mostra 1 depoimento por vez: aspas decorativas, `quote`, e `name` — `city`.
- Controles: setas ‹ › (`aria-label` "anterior"/"próximo") + linha de dots
  clicáveis (`aria-label` "ir para depoimento N", `aria-current`).
- Sem autoplay. Fundo `palette.purpleLight`, card branco `theme.shadowCard`.

### `newsletter-block.tsx` (client)

- `"use client"`. Fundo `palette.white` (ou `purpleLight`).
- Título "Receba novidades e reajustes de tabela" + subtítulo curto.
- `<form onSubmit>`: `e.preventDefault()`, seta estado local `sent=true`.
- Antes: input `type="email"` `required` + botão "Enviar" (verde).
- Depois: mensagem "Em breve você recebe nossas novidades." Sem requisição.
- `aria-live="polite"` na região de status.

### `site-footer.tsx` (server)

- Fundo `palette.purpleDark`, `padding` generoso.
- 4 colunas (`.mpv2-footer`):
  1. Marca: `<Logo variant="plain">` + 1 linha ("Linha própria de acessórios do
     Grupo AZ. Fabricação própria, venda para revenda.").
  2. **Catálogo:** 4 links → âncoras `#bandanas`, `#lacos`, `#peitorais`,
     `#coleiras`.
  3. **Institucional:** "Como comprar para revender" (`#como-comprar` — ou a
     âncora que existir na v2; se não houver seção "como comprar" na v2, apontar
     para `#vantagens`), "My Pet Brasil" (`mainSiteUrl`), "Distribuidora
     Petshop" (`distribuidoraUrl`).
  4. **Contato:** "Falar com o comercial" (`whatsappLink`, `target="_blank"`).
- Linha de ícones sociais: SVG inline (Instagram, Facebook, YouTube, TikTok),
  `href="#"` placeholder + comentário `TODO: URLs reais`.
- Linha legal: "© 2026 MAD PET, Grupo AZ. Todos os direitos reservados."
- **Não inclui:** selos de meio de pagamento, badges de App Store/Google Play,
  enquete de satisfação — sem backend, fora de escopo.

### `lib/testimonials.ts`

```ts
export type Testimonial = {
  name: string;
  city: string;
  quote: string;
};

export const TESTIMONIALS: Testimonial[] = [
  // 5 depoimentos placeholder de lojistas de pet shop.
  // Trocar por depoimentos reais quando disponíveis.
];
```

## Estilos

Idioma mantido: `style` inline + `madPetPalette` + tokens `theme` + fontes
`var(--font-fredoka)` / `var(--font-nunito)`. Sem CSS-in-JS, sem libs.

Bloco acrescentado ao fim de `app/globals.css` (prefixo `mpv2-` evita colisão
com as classes `mp-*` da v1):

- `.mpv2-mosaic` — `grid-template-columns: repeat(3,1fr)`;
  `@media (max-width:900px)` → 2 col; `@media (max-width:560px)` → 1 col.
- `.mpv2-adv` — 4 col; `≤760px` → 2 col; `≤480px` → 1 col.
- `.mpv2-about` — `1fr 1fr`; `≤900px` → 1 col.
- `.mpv2-footer` — 4 col; `≤760px` → 2 col; `≤480px` → 1 col.
- `.mpv2-nav` — flex inline; `≤760px` → `display:none` (painel controlado por
  estado no componente).
- `.mpv2-nav-toggle` — `display:none`; `≤760px` → `display:inline-flex`.

Hover/foco reaproveita `.mp-card`, `.mp-btn`, `.mp-link` já existentes.
`prefers-reduced-motion` já é tratado globalmente.

### Mapeamento estético Zarpellon → MAD PET

| Zarpellon | MAD PET v2 |
|---|---|
| Preto das áreas de impacto | `palette.purpleDark` (#523078) — barra de aviso, sobre, rodapé |
| Serifada fina / dourado | Fredoka em roxo/branco |
| Pílula "clique e confira" | Mesma pílula, borda `rgba(255,255,255,0.7)` |
| Fundo base clara | `palette.white` / `palette.purpleLight` alternando |
| Acento de ação | Verde Mad (`greenDark`) só em botões de ação e selo de frete |

## Fluxo de dados

- `app/v2/page.tsx` (server): monta `genericWhatsappLink`, `atacadistaLink` e
  mensagens dos tiles temáticos; passa tudo por props.
- `LineSection` (async server) busca catálogo real por linha (`getCatalog`,
  canal `ffa_fabrica`), com o mesmo `try/catch` que já tem hoje.
- Somente `site-header`, `testimonials-carousel` e `newsletter-block` são
  `"use client"`. Todo o resto é server component.

## Acessibilidade

- Um `<h1>` na página (no cabeçalho do mosaico ou num eyebrow visualmente
  discreto); demais títulos `<h2>`/`<h3>` em ordem.
- Navegação por teclado no header mobile (`aria-expanded`, foco visível — já
  coberto pelo `:focus-visible` global) e no carrossel (`aria-label` nas setas,
  `aria-current` nos dots).
- Contraste: textos sobre `purpleDark`/`purple` em branco ou
  `rgba(255,255,255,≥0.82)`; textos funcionais em `gray600`/`gray800` sobre
  claro (já validados no brand guide).
- `alt` descritivo em todas as imagens; ícones decorativos com
  `aria-hidden="true"`.

## Fora de escopo / riscos

- Fotos e vídeo: placeholders `picsum` + `TODO`, como no resto do app.
- Newsletter sem backend; links sociais `href="#"` + `TODO`.
- Enquete de satisfação, selos de pagamento e badges de app do print: não
  entram.
- Home v1 e componentes compartilhados: não são modificados (única exceção:
  append em `globals.css`).
- Sem testes automatizados — o app `madpet` não tem setup de teste.

## Verificação

- `pnpm --filter madpet build` sem erros; typecheck limpo (`tsc` via build do
  Next 16).
- `pnpm --filter madpet dev` (porta 4102), abrir `/v2`:
  - render das 10 seções na ordem;
  - tiles de linha rolam até o carrossel correto;
  - tiles temáticos abrem WhatsApp com a mensagem certa;
  - header sticky e toggle mobile funcionam;
  - carrossel de depoimentos navega (setas + dots);
  - newsletter mostra estado "enviado" sem requisição de rede;
  - quebras responsivas em 900 / 760 / 480 px sem overflow horizontal.
- Home atual `/` continua idêntica.
