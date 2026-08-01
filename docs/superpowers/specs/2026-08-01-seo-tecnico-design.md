# SEO técnico — Spec de Design

## Contexto

Um levantamento factual de `apps/mypet` e `packages/core` (feito em conversa
anterior, ver histórico) identificou lacunas de SEO técnico que precisam ser
fechadas antes de considerar `apps/mypet` pronto para substituir a plataforma
atual (mypetbrasil.com) sem perder rankeamento no Google:

- `robots.txt` não existe em nenhum app.
- Não há `canonical` em nenhuma página.
- Não há Open Graph / Twitter Card em nenhuma página.
- JSON-LD existe só parcialmente: `productGroupJsonLd()` em
  `packages/core/src/seo.ts` cobre apenas produtos com variantes
  (`productRole === "parent"`); produtos simples não têm JSON-LD nenhum; não
  existe `BreadcrumbList` nem `Organization`.
- Nenhum componente usa `next/image` — todo lugar usa `<img>` puro, sem
  otimização automática de formato/tamanho (impacto em LCP/Core Web Vitals,
  fator de ranking do Google).
- Cada página (`page.tsx`, `produtos/[id]/page.tsx`, `categoria/[slug]/page.tsx`,
  `cotacao/page.tsx`) injeta um bloco `<style>` com `@import
  url(...fonts.googleapis.com...)` carregando Nunito/Nunito Sans de forma
  render-blocking, duplicado em cada arquivo, apesar de já existir uma fonte
  configurada via `next/font/google` (Geist) no `layout.tsx` raiz — que hoje
  não é usada visualmente.

Esta spec cobre **os dois apps que competem por SEO em produção**,
`apps/mypet` e `apps/distribuidora`, aplicando o mesmo padrão nos dois,
reaproveitando ao máximo `packages/core`.

## Decisões

- **Escopo dos dois apps juntos**: `apps/mypet` e `apps/distribuidora`
  recebem o mesmo tratamento nesta spec/plano, já que compartilham
  `packages/core` e os mesmos componentes de catálogo/PDP.
- **Redirects 301: fora de escopo.** As URLs de produto/categoria do app novo
  são consideradas idênticas às da plataforma atual — não há mudança de
  estrutura de URL a mapear.
- **`Offer`/preço: fora de escopo.** O modelo de negócio é "sob consulta" —
  não existe preço real no banco. JSON-LD de produto usa apenas `@type:
  Product`, sem bloco `offers`, para não reportar dado estruturado
  inconsistente com a página (risco de penalidade/warning no Google).
- **Reviews/`AggregateRating`: fora de escopo** — não existem reviews no
  produto hoje (fora de escopo também da spec de identidade/pedidos).
- **`robots.txt` bloqueia rotas privadas/transacionais**: `/entrar`,
  `/completar-cadastro`, `/cotacao`, `/pedidos`, `/api/`. Essas páginas
  exigem login ou são fluxo transacional, sem conteúdo de busca relevante —
  bloquear evita gasto de crawl budget.
- **Canonical da PDP sempre sem query string**: todas as variantes de um
  produto (`?variante=<id>`) apontam para a URL canônica do produto pai
  (`/produtos/{id}`), consolidando sinal de SEO num único URL e evitando
  conteúdo duplicado.
- **Sem arte de logo própria**: nenhum dos dois apps tem um arquivo de logo
  real (só SVGs padrão do template Next.js). A imagem padrão de Open Graph
  (para home/categoria e fallback de produto sem imagem) e o `logo` do
  Organization JSON-LD são resolvidos pela mesma imagem gerada
  dinamicamente via `next/og`, usando `clientConfig.name`, `tagline` e
  `palette` (já existentes em `client.config.ts` de cada app) — sem
  depender de arte pronta.
- **Fonte: manter Nunito, mas via `next/font/google`**, substituindo Geist
  (hoje configurado mas não usado visualmente) no `layout.tsx` raiz de cada
  app. Isso resolve o problema de performance (render-blocking) sem mudar a
  identidade visual do site.
- **`next/image` nesta spec cobre os componentes compartilhados**
  (`product-card.tsx`, `product-variant-panel.tsx`, `category-listing.tsx`
  em `packages/core/src/components/`), usados pelos dois apps desta spec.
  `apps/azpetshop` não usa esses componentes de catálogo hoje e fica fora de
  escopo.

## Arquitetura

### `robots.txt` (novo, por app)

`apps/{mypet,distribuidora}/app/robots.ts`, usando `MetadataRoute.Robots` do
Next.js (mesmo padrão de `app/sitemap.ts` já existente), lendo `domain` de
`client.config.ts`:

```ts
import type { MetadataRoute } from "next";
import { clientConfig } from "@/client.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/entrar", "/completar-cadastro", "/cotacao", "/pedidos", "/api/"],
    },
    sitemap: `https://${clientConfig.domain}/sitemap.xml`,
  };
}
```

### Canonical URLs

Nova função em `packages/core/src/seo.ts`:

```ts
export function canonicalUrl(domain: string, path: string): string {
  return `https://${domain}${path}`;
}
```

Usada em `generateMetadata` de `produtos/[id]/page.tsx` (sempre
`/produtos/{id}`, ignorando `searchParams.variante`) e de
`categoria/[slug]/page.tsx` (`/categoria/{slug}`), via `alternates: {
canonical }`.

### Open Graph / Twitter Card + imagem gerada

- `layout.tsx` raiz de cada app ganha `metadataBase: new
  URL(\`https://${clientConfig.domain}\`)` no objeto `metadata`, necessário
  para o Next resolver URLs relativas de imagem OG.
- Novo arquivo `apps/{mypet,distribuidora}/app/opengraph-image.tsx`, usando
  `next/og` (`ImageResponse`), 1200×630, montado a partir de
  `clientConfig.name`, `clientConfig.tagline` e `clientConfig.palette`
  (cores de fundo/texto do app). Cobre automaticamente home, categoria e
  qualquer página sem `openGraph.images` explícito (comportamento padrão do
  Next.js: um `opengraph-image.tsx` em `app/` vira fallback para toda a
  árvore de rotas abaixo, a menos que uma rota defina o próprio).
- `generateMetadata` da PDP (`produtos/[id]/page.tsx`) ganha bloco
  `openGraph: { images: [mainImage(product.product_assets)] }` e
  `twitter: { card: "summary_large_image", images: [...] }` — usa a imagem
  principal do produto quando existe; a fallback `opengraph-image.tsx` cobre
  o caso de produto sem imagem (hoje resolvido por
  `placeholder-produto.svg` no `<img>`, mas OG precisa de PNG/JPG, não SVG).

### JSON-LD completo

Em `packages/core/src/seo.ts`, além de `productGroupJsonLd` (mantido sem
mudança):

`PdpProductForSeo` (tipo já existente em `seo.ts`) ganha um novo campo
`image: string` (resolvido via `mainImage(product.product_assets)` no
`page.tsx` da PDP, mesma função já usada para o `<img>`/`next/image` da
página), necessário para popular o `image` do JSON-LD abaixo:

```ts
// Produtos simples (sem variantes) — hoje sem nenhum JSON-LD.
export function productJsonLd(product: PdpProductForSeo, domain: string) {
  if (product.productRole === "parent") return null; // usa productGroupJsonLd
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.id,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.description ? { description: product.description } : {}),
    ...(product.image ? { image: product.image } : {}),
    url: `https://${domain}/produtos/${product.id}`,
  };
}

// Breadcrumb — reaproveita a mesma lista de itens já usada no breadcrumb
// visual de category-listing.tsx e da PDP.
export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
  domain: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `https://${domain}${item.path}`,
    })),
  };
}

// Organization — renderizado uma vez no layout raiz de cada app.
export function organizationJsonLd(config: ClientConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.name,
    url: `https://${config.domain}`,
    logo: `https://${config.domain}/opengraph-image`,
  };
}
```

- `productJsonLd` é usado na PDP quando `productRole !== "parent"`;
  `productGroupJsonLd` continua sendo usado quando `productRole === "parent"`
  — mutuamente exclusivos, cobrindo os dois casos.
- `breadcrumbJsonLd` é usado na PDP (Home > Categoria > Produto) e na página
  de categoria (Home > Categoria), a partir dos mesmos itens já montados
  para o breadcrumb visual em `category-listing.tsx`.
- `organizationJsonLd` é renderizado uma vez via `<script
  type="application/ld+json">` no `layout.tsx` raiz de cada app (não em cada
  página).

### `next/image` nos componentes compartilhados

- `packages/core/src/components/product-card.tsx`,
  `product-variant-panel.tsx`, `category-listing.tsx`: troca de `<img>` por
  `next/image`.
- `apps/{mypet,distribuidora}/next.config.ts` ganham `images.remotePatterns`
  apontando para o host do Supabase Storage (`hostname: "*.supabase.co"`),
  cobrindo qualquer projeto Supabase sem precisar do ref exato.
- Cards em grid (listagem) usam `fill` + `sizes` apropriado ao layout de
  grid, dentro de um container com `aspect-ratio` fixo (evita CLS, já que o
  tamanho real da imagem em `product_assets.url` não é conhecido
  antecipadamente).
- Imagem principal da PDP usa `fill` também, com `priority` (ajuda o LCP da
  página mais importante para conversão).
- `placeholder-produto.svg` continua sendo o fallback quando
  `product_assets` está vazio (`next/image` aceita SVG local normalmente,
  diferente do caso de OG image que exige raster).

### Fonte: Nunito via `next/font/google`

`layout.tsx` raiz de cada app troca `Geist`/`Geist_Mono` (não usados
visualmente hoje) por `Nunito`/`Nunito_Sans` de `next/font/google`, mesma
API já em uso, só trocando a fonte:

```ts
import { Nunito, Nunito_Sans } from "next/font/google";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const nunitoSans = Nunito_Sans({ variable: "--font-nunito-sans", subsets: ["latin"] });
```

Os blocos `<style>` com `@import url(...fonts.googleapis.com...)` são
removidos de `page.tsx`, `produtos/[id]/page.tsx`,
`categoria/[slug]/page.tsx`, `cotacao/page.tsx` (dos dois apps), e qualquer
CSS que referenciava a fonte por `font-family: 'Nunito', ...` passa a
referenciar a variável CSS exposta pelo `next/font` (`var(--font-nunito)`).

## Erros e casos-limite

| Caso | Comportamento |
| --- | --- |
| Produto sem imagem (`product_assets` vazio) | OG usa a `opengraph-image.tsx` gerada (fallback), não o SVG de placeholder |
| Produto simples sem `description`/`brand` | `productJsonLd` omite os campos opcionais (mesmo padrão já usado em `productGroupJsonLd`) |
| PDP acessada via `?variante=<id>` | Canonical sempre aponta para a URL sem query; `productGroupJsonLd().hasVariant[].url` continua tendo a query (não é o canonical da página, é a URL de cada variante dentro do grupo) |
| `next/image` com URL de host fora de `*.supabase.co` | Build falha (comportamento padrão do Next.js para host não configurado) — aceitável, força consistência de onde as imagens são hospedadas |

## Testes

Seguindo o padrão já estabelecido (`*.test.ts` ao lado do código, funções
puras testadas isoladamente):

- `seo.test.ts` — `productJsonLd` (com/sem campos opcionais, retorna `null`
  quando `productRole === "parent"`), `breadcrumbJsonLd` (monta
  `itemListElement` corretamente), `canonicalUrl` (monta URL correta),
  `organizationJsonLd` (campos obrigatórios presentes).
- Verificação manual via `/run`, nos dois apps:
  - `/robots.txt` reflete as rotas bloqueadas e referencia o sitemap certo.
  - Google Rich Results Test valida `Product`/`ProductGroup`/`BreadcrumbList`/`Organization` sem erros.
  - Facebook Sharing Debugger mostra imagem/título/descrição corretos para
    home, categoria e PDP (com e sem imagem de produto).
  - Inspecionar visualmente que a troca de fonte (Nunito via `next/font`)
    não alterou a aparência do site.
- `npm run build` e `npm run lint` continuam como critério de aceite.

## Fora de escopo

- Redirects 301 (URLs consideradas idênticas às da plataforma atual).
- `Offer`/preço em JSON-LD (produto não tem preço no modelo atual).
- `AggregateRating`/reviews (não existem).
- `apps/azpetshop` (não usa os componentes de catálogo compartilhados desta
  spec).
- Analytics/tracking (GA4, GTM, Meta Pixel, Merchant Center) — spec
  separada.
- Arte de logo definitiva (a imagem gerada via `next/og` é uma solução
  provisória até haver um logo real).
