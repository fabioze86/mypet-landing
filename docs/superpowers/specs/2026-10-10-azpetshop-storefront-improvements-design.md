# Melhorias no storefront AZ Pet Shop — Design

- **Data:** 2026-10-10
- **Repo:** `mypet-landing` (app `apps/azpetshop` + pacote `packages/core`)
- **Loja:** `loja.azpetshop.com.br` (Next.js, lê do Supabase `hub_catalogo`)

## Contexto

A loja azpetshop é o app `apps/azpetshop` (Next.js na Vercel) que lê o catálogo
direto do Supabase `hub_catalogo` via `packages/core/src/catalog.ts`, filtrando
pelo canal `azpetshop`. Modelo de conversão: **cotação por WhatsApp** (sem
checkout no site).

Esta entrega cobre melhorias de conteúdo/SEO/UX na loja. **Prontidão para Google
Shopping** (checkout real, precificação em massa, páginas de política, feed/
Merchant Center, parcelamento, frete) está **fora de escopo** — ver seção final.

## Objetivos

1. **Busca interna** (hoje inexistente na UI).
2. **Página de produto (PDP):** breadcrumbs, descrição, ficha técnica,
   disponibilidade.
3. **SEO da PDP:** JSON-LD (Product/Offer + Breadcrumb), meta description real.
4. **Exibição Ref:** remover código de barras (EAN) da tela; trocar "SKU/Ref:"
   por "Ref:".

## Mapeamento de campos (hub → PDP)

Investigado no hub (2026-10-10). `meta_description`/`keywords`/`meta_title`
existem **só por canal** em `product_channel_links`; `description` existe no
mestre (`v_produtos_resolvidos`) **e** por canal. Cobertura nos 43 produtos
ativos do canal azpetshop: description (mestre e canal), meta_description e
keywords = 100%.

| Campo na PDP/SEO | Fonte primária | Fallback |
|---|---|---|
| Descrição (corpo) | `product_channel_links.description` (canal azpetshop) | `v_produtos_resolvidos.description` (mestre) → texto padrão |
| Meta description | `product_channel_links.meta_description` (azpetshop) | `description` sem tags, ~155 chars → fallback atual |
| Keywords (opcional) | `product_channel_links.keywords` (azpetshop) | omitir |
| Disponibilidade | `products.stock_qty` (`>0` = InStock; senão OutOfStock) | — |
| Preço | `product_channel_prices.sale_price` (azpetshop) | sem `offers` |
| `gtin13` | `products.barcode` | omitir |
| `sku` | `products.reference` | omitir |
| Título (H1/`name`) | `products.name` | — |
| Marca | `products.brand` | — |

**Ressalva de qualidade de dado (fora do código):** o conteúdo do canal
azpetshop pode conter texto incorreto herdado de enriquecimento antigo (ex.: o
condicionador ref 22670 tem description/meta "shampoo" no canal azpetshop,
enquanto o canal mypetbrasil está correto). Renderizar o conteúdo do canal vai
expor esses erros. Correção de conteúdo é tarefa de dado no hub, separada desta
entrega; recomenda-se spot-check dos 43 após o deploy.

## 1. Busca interna

- **Nova rota** `apps/azpetshop/app/busca/page.tsx`:
  - Lê `searchParams.q` (e `page`). Renderiza `SiteNav` + heading
    `Resultados para "{q}"` + `CatalogSection q={q} channel="azpetshop"`.
  - `q` vazio/ausente → estado inicial ("Digite o que procura").
  - `generateMetadata`: `robots: { index: false, follow: true }` (página de
    resultado não deve indexar); canonical para `/busca`.
- **`SiteNav` (core, `packages/core/src/components/site-nav.tsx`):** nova prop
  **opcional** `search?: { action: string; placeholder?: string }`. Quando
  presente, renderiza um `<form method="get" action={action}>` com
  `<input name="q">`. azpetshop passa `search={{ action: "/busca" }}`; demais
  apps não passam → sem alteração visual neles.
- **Backend (`queryCatalog` em `packages/core/src/catalog.ts`):** o filtro `q`
  passa de `ilike("name", …)` para
  `or("name.ilike.%q%,brand.ilike.%q%,reference.ilike.%q%")`. Mudança aditiva;
  afeta também o `?q=` da home de todos os apps (mais resultados). O termo é
  sanitizado (remover `,` e `%`/`_` para evitar quebrar o filtro PostgREST).

## 2. PDP — conteúdo

Portar a estrutura completa já existente na PDP da **distribuidora**
(`apps/distribuidora/app/produtos/[id]/page.tsx`) para a PDP azpetshop,
mantendo o visual/tokens do azpetshop:

- **Breadcrumbs** (Início / categoria(s) / produto) via
  `getCategoryPath(categories, product.categoryId)` — nav visual + ARIA.
- **Descrição do Produto:** seção com a descrição (ver mapeamento), com fallback
  quando vazia.
- **Ficha técnica:** tabela peso/largura/altura/comprimento quando houver.
- **Disponibilidade:** selo "Em estoque" / "Esgotado" a partir de
  `product.stock_qty`.

### Extensão de `getProductById` (core)

Hoje seleciona `product_channel_links!inner(channel)`. Passar a selecionar
também, do vínculo do canal, `description, meta_description, keywords, title`, e
do produto `stock_qty`. Expor no objeto retornado:
`channelDescription`, `channelMetaDescription`, `channelKeywords`, `stockQty`.
O corpo da PDP usa `channelDescription ?? description (mestre) ?? fallback`.

## 3. SEO / Schema (`packages/core/src/seo.ts`)

- Injetar na PDP azpetshop: `breadcrumbJsonLd` + (`productGroupJsonLd` quando
  `parent` com variações, senão `productJsonLd`) via `jsonLdScript`.
- **Ampliar `productJsonLd`** para aceitar `salePrice`, `stockQty`, `reference`,
  `barcode`, `domain` e emitir:
  - `sku` = reference; `gtin13` = barcode (quando houver);
  - `offers` **somente quando houver preço**: `price`, `priceCurrency: "BRL"`,
    `availability` (`InStock` se `stockQty>0`, senão `OutOfStock`),
    `itemCondition: "https://schema.org/NewCondition"`,
    `url` = canonical do produto.
  - Sem preço → sem `offers` (produto não é "feed-ready"; comportamento atual).
- **Novo helper `metaDescription(raw, fallback)`** no `seo.ts`: remove tags HTML,
  colapsa espaços, trunca em ~155 chars (sem cortar palavra no meio quando
  simples). Usado no `generateMetadata` da PDP:
  `metaDescription(channelMetaDescription ?? channelDescription ?? masterDescription, fallbackAtual)`.
- Organization JSON-LD: **já presente** em `apps/azpetshop/app/layout.tsx` — sem
  mudança.

## 4. Código de barras / Ref (componente compartilhado)

`packages/core/src/components/product-variant-panel.tsx` (usado por azpetshop,
distribuidora e mypet):

- Remover o selo `EAN/EAC: {barcode}`.
- Trocar o rótulo `SKU/Ref:` por `Ref:`.
- `barcode` permanece no tipo/props/dados (usado como `gtin13` no schema).

Decisão do usuário: aplicar em **todas as lojas**.

## Arquivos afetados

- **Novo:** `apps/azpetshop/app/busca/page.tsx`
- `apps/azpetshop/app/produtos/[id]/page.tsx` — breadcrumbs, descrição, ficha,
  disponibilidade, JSON-LD, meta description.
- `apps/azpetshop/app/page.tsx` e/ou `layout.tsx` — passar `search` ao `SiteNav`.
- `packages/core/src/components/site-nav.tsx` — prop `search`.
- `packages/core/src/components/product-variant-panel.tsx` — item 4.
- `packages/core/src/catalog.ts` — `queryCatalog` (q multi-campo); `getProductById`
  (campos do canal + `stock_qty`).
- `packages/core/src/catalog-utils.ts` — tipos `PdpProduct`/mapeamento se preciso.
- `packages/core/src/seo.ts` — `offers` em `productJsonLd`, helper `metaDescription`.

## Mudanças compartilhadas e impacto nas lojas irmãs

- **Item 4** (Ref/EAN): intencionalmente global (azpetshop, distribuidora, mypet).
- **`queryCatalog` q multi-campo:** aditivo; irmãs ganham busca por marca/ref também.
- **`productJsonLd.offers`:** aditivo; só emite `offers` quando há preço.
- **`SiteNav.search`:** opt-in; irmãs sem a prop não mudam.
- **`getProductById`:** novos campos no retorno; consumidores atuais não quebram.

## Testes / verificação

- `pnpm --filter @mypet/core test` (há testes de `catalog`, `seo`,
  `catalog-revalidation`); adicionar/ajustar testes para `metaDescription`,
  `productJsonLd` com `offers`, e `queryCatalog` multi-campo.
- Build do app: `pnpm --filter azpetshop build` (ou equivalente do monorepo).
- Validar JSON-LD no Rich Results Test / Schema Markup Validator após deploy.
- Cache: catálogo usa `"use cache"` + tag `catalog`; rota
  `/api/revalidate-catalog` já existe no azpetshop para expirar.

## Fora de escopo (agora)

Checkout real no site; precificação em massa dos produtos do canal azpetshop;
páginas/rodapé de políticas (troca, privacidade, contato, CNPJ, pagamento);
feed de produtos + Google Merchant Center; parcelamento (`installment`); frete/
calculadora de CEP; `aggregateRating` (0 reviews no hub); correção de conteúdo
"shampoo" no canal azpetshop (tarefa de dado no hub).
