# Distribuidora Instagram — hotsite de ofertas para lojistas (novo app)

**Data:** 2026-09-13
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

A Distribuidora Pet Shop quer um hotsite promocional para receber tráfego pago/orgânico
do Instagram, com uma única experiência de front-end orientada por dados de campanha
(sem criar página nova por campanha), permitindo que o lojista veja a oferta, confirme
o preço e conclua um pedido com o mínimo de fricção.

### Estado real verificado (2026-09-13)

- **"Hub Catálogo" não é um app** — é o projeto Supabase compartilhado (`hub_catalogo`)
  que centraliza produtos, categorias, preços e imagens. Todos os apps (`mypet`,
  `distribuidora`, `madpet`, `azpetshop`, `admin`) leem/gravam nele **direto** via
  `@mypet/core` (Supabase client), sem API HTTP intermediária. `apps/hub` é só um
  launcher de desenvolvimento local, sem lógica de dados.
- **Não existe checkout real em `apps/distribuidora`.** O fluxo atual é carrinho sem
  preço (`packages/core/src/cart.ts`) → `/cotacao` → link do WhatsApp
  (`packages/core/src/whatsapp.ts`). Existe `createOrder()`
  (`packages/core/src/orders-server.ts`) que grava `orders`/`order_items`, mas nenhuma
  página da distribuidora o usa hoje.
- **`orders`/`order_items` não têm nenhum campo de preço** (confirmado também na spec
  do Balcão de Negócios, 2026-08-29). `CartItem` também não tem preço. Ambas as tabelas
  não são geridas por migration neste repo (schema-base fora do controle de migrations
  do monorepo) — qualquer alteração precisa ser aditiva (`ALTER TABLE ADD COLUMN IF NOT
  EXISTS`).
- **Não existe cupom, pedido mínimo, campanha, oferta ou promoção** em nenhuma tabela
  do sistema. O mecanismo de desconto mais maduro é o **Balcão de Negócios**
  (`balcao_rules`/`balcao_rule_tiers`, desconto por volume/categoria com fluxo de
  aprovação manual) — não serve para preço promocional direto no card do produto.
- **Não existe GA4 nem tratamento de UTM** em nenhum app do monorepo — só Vercel
  Analytics (`@vercel/analytics/next`) no `layout.tsx` de cada app.
- **`apps/distribuidora` está com a marca MadPet** (roxo/verde, `client.config.ts`),
  não "Distribuidora Pet Shop" — a paleta navy/coral/dourado pedida no briefing não
  corresponde à identidade atual desse app.
- **Preço real por canal**: `mypetbrasil` usa o espelho Bling (`v_precos_erp`); demais
  canais (`ffa_fabrica`, `azpetshop`) usam `product_channel_prices.sale_price`. O canal
  usado por lojistas hoje (`apps/distribuidora` e `apps/madpet`) é **`ffa_fabrica`**,
  não `"distribuidora"` (esse nome de canal existe no enum mas está sem uso real).
- **Padrão de módulo channel-keyed com cache por tag**: `packages/core/src/balcao.ts`
  é a referência direta — arquivo puro (`balcao-calc.ts`, client-safe) + arquivo server
  (`balcao.ts`, `"use cache"` + `cacheTag` + `cacheLife`) + arquivo de mutação
  (`balcao-server.ts`, `service_role`, bypassa RLS).
- **Padrão de admin**: `apps/admin/app/(dashboard)/marketing/banners` (zod +
  Server Actions + `requireAdminSession()` + `updateTag(tag)`) é a referência direta
  para qualquer CRUD novo.
- **RLS**: convenção do repo para tabela nova é RLS ligado desde a criação — anon key
  só `SELECT` do que o site público precisa (campanhas ativas/itens), admin autenticado
  via `auth.uid() IN (SELECT id FROM admin_users)` tem acesso completo. Mesmo padrão de
  `leads`, `banners`, `balcao_rules`.
- **Artigo da Meta consultado** (`facebook.com/business/help/1324891268731018`): trata
  da URL de checkout da **sacolinha nativa** do Instagram/Facebook Shopping (Commerce
  Manager, catálogo de produtos, domínio verificado no Business Manager) — não se aplica
  a tráfego de anúncio/post com link direto, que é o escopo desta entrega. Fica como
  nota de compatibilidade futura (ver "Fora desta entrega").
- **Meta Pixel** (compartilhamento de eventos de comportamento — `AddToCart`,
  `InitiateCheckout`, `Purchase`, `ViewContent` — para retargeting/anúncios dinâmicos):
  mapeia diretamente para os eventos de analytics já previstos no briefing
  (`add_to_cart`, `begin_checkout`, `purchase`, `view_offer_item`). Entra nesta entrega
  como um segundo provider do mesmo módulo de analytics, ao lado do GA4. **Conversions
  API (server-side) fica fora desta entrega** — só o Pixel via browser por agora.
  Anúncios dinâmicos de catálogo (produtos sugeridos por comportamento) só ativam de
  verdade quando existir um catálogo no Commerce Manager com IDs batendo com os
  `content_ids`/CPRO emitidos pelo Pixel — mesma dependência de infraestrutura da
  sacolinha nativa (ver "Fora desta entrega").

## Decisões do brainstorming

| Pergunta | Decisão |
| --- | --- |
| Onde implementar | **Novo app `apps/distribuidora-instagram`** (decisão do usuário, substitui a premissa inicial de reaproveitar `apps/distribuidora` — a identidade visual e o objetivo de conversão autônoma exigida conflitam com o app existente, que está com marca MadPet e sem checkout). |
| Canal de catálogo | **Mesmo canal `ffa_fabrica`** de `apps/distribuidora` — mesmos produtos/preços, sem cadastro duplicado. |
| Autenticação | **Reaproveita Supabase Auth (magic link) + tabela `buyers` compartilhada** — mesmo lojista pode comprar nos dois sites com a mesma conta. |
| CTA principal / checkout | **Checkout mínimo real**: cria pedido de verdade (`createOrder` estendido), sem WhatsApp no fluxo principal. Sem gateway de pagamento (não existe em nenhum app hoje) — pedido fica "pendente" para acompanhamento comercial, igual ao `/pedidos` já existente. |
| Cupom | **Aplica desconto percentual real** no preço exibido (não é só cosmético), validado contra a campanha ativa. |
| Pedido mínimo / barra de progresso | **Não implementar nesta entrega** — não existe regra de pedido mínimo no sistema hoje; decisão registrada como limitação real, não inventar regra de negócio. |
| Analytics/UTM | **UTM + GA4 completos** — núcleo do objetivo de medir campanha, implementado do zero (não existe hoje), isolado neste novo app (não mexe no analytics dos outros apps). |
| Identidade visual | **Paleta navy/coral/dourado da "Distribuidora Pet Shop"** aplicada ao app novo inteiro (não é mais uma questão de "só nas rotas de oferta", já que o app inteiro é dedicado a isso). |
| Sacolinha nativa Meta (Commerce Manager) | **Fora desta entrega**, mas URLs de produto e do carrinho devem ficar estáveis/canônicas para permitir configurar isso depois sem retrabalho. |
| Meta Pixel / Conversions API | **Só Pixel (browser) nesta entrega**, ao lado do GA4 no mesmo módulo de analytics. Conversions API (server-side) fica para depois. |

## Arquitetura

### Novo app: `apps/distribuidora-instagram`

Next.js 16 / React 19 / TypeScript estrito / Tailwind 4 — mesma stack e convenções dos
demais apps do monorepo (`cacheComponents: true`, `transpilePackages: ["@mypet/core"]`,
Vitest colocalizado). Marca "Distribuidora Pet Shop", `catalogChannel: "ffa_fabrica"`,
paleta:

```ts
palette: {
  navy: "#061C5C", navyDark: "#04123E", navyLight: "#E7EAF5",
  pink: "#F52D45",     // usado como cor de ação/promocional no slot semântico existente
  cyan: "#F5B51B",     // usado como cor de destaque/selo no slot semântico existente
  white: "#FFFFFF", gray50: "#F7F5F2", gray800: "#222222",
  ...
}
```

(mapeamento exato dos slots semânticos do `ClientConfig`/`theme.tsx` fica a critério do
plano de implementação — o ponto fixo é que as 6 cores do briefing devem aparecer nos
lugares certos: navy institucional, coral para CTA/promoção, dourado para destaque.)

Reaproveita de `@mypet/core`: `catalog`, `catalog-utils`, `cart`, `auth-server`,
`supabase` / `supabase-server` / `supabase-browser`, `channels`, `orders-server`
(estendido), `theme`, `whatsapp` (só para o CTA secundário de dúvidas),
`querystring`. Componentes de UI genéricos existentes (`site-nav`, `cart-badge`,
`login-form`, `complete-signup-form`) são reaproveitados como estão; os componentes
específicos de oferta são novos (ver seção de rotas).

### Modelo de dados novo (Supabase `hub_catalogo`)

Migration aditiva `supabase/migrations/2026091X_offer_campaigns.sql`:

```sql
create table offer_campaigns (
  id uuid primary key default gen_random_uuid(),
  channel text not null references... -- mesmo domínio do enum Channel (check constraint, sem FK a tabela de enum)
  slug text not null,
  title text,
  subtitle text,
  badge text,
  coupon_code text,
  coupon_description text,
  coupon_discount_pct numeric,
  coupon_valid_until timestamptz,
  freight_message text,
  primary_cta_label text,
  secondary_cta_label text,
  hero_priority int not null default 0,
  flash_offer boolean not null default false,
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, slug)
);

create table offer_campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references offer_campaigns(id) on delete cascade,
  product_id uuid not null references products(id),
  promotional_price numeric not null,
  min_quantity int not null default 1,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
```

Princípios (idênticos ao Balcão de Negócios):

- **Status é sempre calculado em runtime** a partir de `active` + `starts_at` +
  `ends_at` (`draft` = `!active`; `scheduled` = `active` e `starts_at` futuro;
  `active` = dentro da janela; `expired` = `ends_at` passado) — nunca armazenado como
  enum manual, para nunca exibir campanha desatualizada como ativa.
- **Preço de tabela (riscado) nunca é salvo** em `offer_campaign_items` — é sempre lido
  ao vivo do preço real do produto no canal (`channelUsesErpPrice`/`v_precos_erp` ou
  `product_channel_prices`), igual ao Balcão. Desconto = `(preço real − promotional_price)
  / preço real`. Produto sem preço real válido é excluído da campanha; campanha sem
  nenhum item válido é tratada como indisponível (nunca preço fictício).
- **RLS**: `anon` só `select` de campanhas com `active = true` e dentro da janela
  (view ou política combinando `active`/`starts_at`/`ends_at`); admin (`admin_users`)
  tem CRUD completo.

Extensão aditiva em `orders` / `order_items` (`ALTER TABLE ... ADD COLUMN IF NOT
EXISTS`):

- `orders`: `campaign_id uuid null references offer_campaigns(id)`, `utm_source text`,
  `utm_medium text`, `utm_campaign text`, `utm_content text`, `total_amount numeric`.
- `order_items`: `list_price_snapshot numeric`, `promo_price_snapshot numeric`,
  `coupon_code_snapshot text`.

### `packages/core` — módulos novos/estendidos

- **`offers-calc.ts`** (puro, client-safe): tipos `OfferCampaign`/`OfferItem`
  (adaptação do contrato do briefing à realidade dos dados — sem `checkoutUrl`
  fabricado, por exemplo, já que o destino é sempre o carrinho do próprio app),
  `resolveCampaignStatus`, `isCampaignLiveAt`, `calculateDiscountPct`,
  `applyCouponDiscount`.
- **`offers.ts`** (server, `"use cache"` + `cacheTag("offers")` + `cacheLife("hours")`
  — mesma janela do Balcão, para refletir início/fim de campanha em até ~1h):
  `getActiveCampaigns(channel)`, `getCampaignBySlug(channel, slug)`. Segue exatamente
  o padrão de join de `getBalcaoEligibleProducts` (resolve preço real por
  `channelUsesErpPrice`, filtra item sem preço, filtra campanha sem item válido).
- **`offers-server.ts`** (mutação/service client, se necessário para o admin — a
  decidir no plano se o CRUD do admin acessa a tabela direto ou via essa camada,
  seguindo o padrão de `banners`, que acessa direto).
- **`cart.ts`**: `CartItem` ganha campos **opcionais** `campaignId?`, `campaignSlug?`,
  `unitPrice?`, `listPrice?` — mudança aditiva, não quebra `azpetshop`/`mypet`/
  `distribuidora`, que continuam sem esses campos.
- **`orders-server.ts`**: `createOrder` aceita `campaignId?`, `couponCode?`,
  `utm?: { source, medium, campaign, content }` e grava os snapshots de preço por item
  e o `total_amount`.
- **`utm.ts`** (puro): parse/merge de `utm_*` em URL, helper `withUtm(href, utm)`.
- **`analytics.tsx`** (novo componente + `trackOfferEvent()`), plugado só no
  `layout.tsx` do `apps/distribuidora-instagram`. Dois providers no mesmo wrapper:
  GA4 (`gtag`) e **Meta Pixel** (`fbq`, script `fbevents.js`, `NEXT_PUBLIC_META_PIXEL_ID`).
  Eventos: `view_offer_campaign`, `view_offer_item` (→ Pixel `ViewContent`),
  `click_offer_cta`, `copy_coupon`, `apply_coupon`, `add_to_cart` (→ Pixel `AddToCart`),
  `begin_checkout` (→ Pixel `InitiateCheckout`), `purchase` (→ Pixel `Purchase`), com
  `campaign_id`/`campaign_slug`/`offer_id`/`product_id`/`cpro` (como `content_ids` no
  Pixel)/`value`/`currency`/`utm_*` quando disponíveis. Conversions API (server-side)
  fica fora desta entrega.

### Admin (`apps/admin`)

Novo módulo `(dashboard)/marketing/ofertas`, mesmo padrão de `marketing/banners`:
zod schema, Server Actions (`createCampaign`, `updateCampaign`, `deleteCampaign`,
`toggleCampaignActive`, `addCampaignItem`, `removeCampaignItem`, `reorderCampaignItems`),
`requireAdminSession()`, `updateTag("offers")` em toda mutação. Tela de itens usa busca
de produto por referência/nome (query simples em `products`, filtrando
`product_channel_links.channel = 'ffa_fabrica'`).

**É aqui que a equipe cria/edita campanhas**: slug, título, subtítulo, badge, cupom
(código/descrição/%/validade), mensagem de frete, CTAs, prioridade no hero, flag de
oferta relâmpago, ativo/vigência, e os produtos participantes com preço promocional.
**A URL de cada campanha para usar em anúncios é sempre**
`https://<domínio-do-app-novo>/ofertas-para-lojistas/<slug>`.

### Rotas do novo app

```
apps/distribuidora-instagram/app/
├── ofertas-para-lojistas/
│   ├── page.tsx            # home: barra de campanha, hero, OfferCard grid,
│   │                       # ofertas relâmpago (CampaignCountdown), categorias
│   │                       # de reposição (channel_categories existente)
│   └── [slug]/page.tsx     # landing de campanha: CampaignHero, OfferPrice,
│                           # CouponCard, complementares, MobileOfferCta fixo
├── carrinho/page.tsx        # checkout mínimo real: itens com snapshot de
│                           # preço, aplica cupom, "Finalizar pedido" ->
│                           # createOrder estendido; exige login preservando
│                           # next + UTM + carrinho (client-side, sobrevive
│                           # ao redirect)
├── entrar/page.tsx + entrar/callback/route.ts   # mesmo padrão de auth
├── produtos/[id]/page.tsx   # página canônica de produto (estável, pensando em
│                           # futura integração de catálogo/sacolinha nativa)
├── proxy.ts                 # refresh de sessão Supabase + captura de UTM
│                           # (grava cookie httpOnly, mesmo padrão de
│                           # access-session.ts) nas primeiras visitas com
│                           # utm_* na querystring
├── layout.tsx, page.tsx (redirect/home -> /ofertas-para-lojistas), manifest.ts,
│   robots.ts, sitemap.ts
```

Componentes novos em `packages/core/components`: `CampaignHero`, `OfferCard`,
`OfferPrice`, `CouponCard`, `CampaignCountdown`, `MobileOfferCta`.

Fluxo de checkout: CTA "Aproveitar oferta"/"Adicionar ao pedido" adiciona o item ao
carrinho (com `campaignId`/`unitPrice`/`listPrice`) e leva a `/carrinho` com contexto
de campanha e UTM preservados na URL/cookie. Em `/carrinho`, "Finalizar pedido" exige
sessão; se não autenticado, redireciona a `/entrar?next=/carrinho` (UTM no cookie,
carrinho no client). Ao concluir, `createOrder` grava o pedido "pendente" com
snapshots e redireciona para uma página de confirmação ("Pedido registrado, nossa
equipe entra em contato — igual ao `/pedidos` do `apps/distribuidora`). Um CTA
secundário discreto ("Falar com atendimento") usa `buildWhatsAppLink` só para dúvidas,
nunca como caminho principal.

### Resiliência

- Falha do Supabase (Hub) → estado de erro elegante com link "tentar novamente"
  (reload da rota), nunca preço em cache expirado exibido como atual.
- Slug de campanha expirada → CTA de compra desabilitado, mensagem "oferta encerrada"
  + link para `/ofertas-para-lojistas`.
- Campanha/produto sem preço real válido → excluído do resultado; zero itens válidos
  → página trata como oferta indisponível, sem inventar preço.

### Fora desta entrega (limitações reais do sistema, não deste hotsite)

- **Gateway de pagamento online**: não existe em nenhum app hoje. "Finalizar pedido"
  cria um pedido "pendente" para acompanhamento comercial — pagamento continua sendo
  tratado fora do site, como já ocorre em `/pedidos`.
- **Pedido mínimo / barra de progresso**: não implementado — decisão já registrada.
- **Estoque**: catálogo não modela estoque hoje; `availability` sempre `in_stock`
  a menos que o Hub passe a ter esse dado.
- **Sacolinha nativa do Instagram/Facebook (Commerce Manager, domínio verificado)**:
  fora do escopo — depende de infraestrutura fora do repo (verificação de domínio no
  Meta Business Manager, feed de produtos). O design mantém `/produtos/[id]` e
  `/carrinho` como URLs estáveis para permitir configurar isso depois sem
  retrabalho de rotas.

## Testes

- `packages/core`: testes puros para `offers-calc.ts` (cálculo de desconto,
  vigência/status da campanha, aplicação de cupom).
- `apps/distribuidora-instagram` (Vitest colocalizado, mesmo padrão de
  `apps/distribuidora`): renderização de campanha ativa (título/imagem/preço
  anterior/promocional vindos do Hub), cálculo correto do percentual de desconto,
  não exibição de campanha expirada, fallback elegante quando a consulta ao Hub falha,
  CTA levando ao carrinho com contexto de campanha, preservação de UTM pela navegação
  até o carrinho.
