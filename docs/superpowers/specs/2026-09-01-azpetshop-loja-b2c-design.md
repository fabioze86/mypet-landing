# AZ Pet Shop — loja B2C acoplada ao blog

Data: 2026-09-01
App: `apps/azpetshop` (novo)
Status: aprovado para implementação

## Objetivo

Dar ao portal de conteúdo AZ Pet Shop (`C:\Projetos\azpetshop`, blog Astro no
Cloudflare) uma loja virtual de consumidor final, "nos mesmos moldes" das lojas
que já existem em `apps/` (`mypet`, `distribuidora`, `madpet`): novo app Next.js
no monorepo, consumindo `packages/core` e o mesmo Supabase `hub_catalogo`, com
a mecânica de **cotação por WhatsApp** — sem checkout com pagamento.

A loja nasce como app irmão dos outros, mas sem as camadas B2B que não se
aplicam a consumidor: sem trava de preço (LeadGate), sem contas, sem
dependência da tabela `buyers`.

## Decisões de escopo

- **Modelo comercial:** cotação (`features.commerce: "quote"`). Carrinho no
  navegador → mini-formulário (nome + WhatsApp) → link `wa.me` com o pedido
  consolidado. Zero pagamento online.
- **Onde mora:** novo app `apps/azpetshop` no monorepo pnpm. Deploy Vercel
  próprio, subdomínio `loja.azpetshop.com.br`. O blog Astro fica intocado em
  `azpetshop.com.br` (Cloudflare).
- **Catálogo:** mesmo Supabase `hub_catalogo`, canal novo `azpetshop`.
  Visibilidade por `product_channel_links` (`channel = 'azpetshop'`), populada
  fora deste repo.
- **Preço:** preço de varejo **separado**, gravado em `product_channel_prices`
  (`channel = 'azpetshop'`), alimentado por **importação de planilha**. Não usa
  o espelho Bling / `v_precos_erp`. Não entra em `ERP_PRICE_CHANNELS`.
- **Trava de preço:** nenhuma. Preço sempre visível ao consumidor. `LeadGate`,
  `UnlockButton` e `PriceLockSlot` não são usados neste app.
- **Contas:** nenhuma na v1. Sem `entrar`, `pedidos`, `completar-cadastro`, sem
  `buyers`, sem Supabase Auth.
- **Design/identidade:** **adiado**. O app entra com um tema provisório neutro
  (estrutura mínima, sem copiar o visual da distribuidora). A identidade visual
  final será um passe dedicado quando o usuário trouxer referências.
- **Integração com o blog:** fora de escopo agora. Os 109 posts MDX seguem com
  links de afiliado. Único toque no repo do blog: link "Loja" no header/footer.

## Arquitetura

### Novo app — `apps/azpetshop/`

Esqueleto derivado de `apps/distribuidora`, removendo o que é B2B.

```
apps/azpetshop/
  package.json            "dev": "next dev -p 4105", deps: @mypet/core, next, react, @supabase/ssr
  next.config.ts          espelho dos outros apps
  postcss.config.mjs      Tailwind 4
  tsconfig.json
  vercel.json
  client.config.ts        marca AZ Pet Shop, catalogChannel "azpetshop", paleta PROVISÓRIA
  app/
    layout.tsx            ClientConfigProvider + fontes; sem PWA
    globals.css
    page.tsx              home: nav + catálogo (sem LeadGateProvider)
    produtos/             PDP (reaproveita category-listing / product-card do core)
    categoria/            listagem por categoria
    cotacao/
      page.tsx            revisão do carrinho + mini-formulário
      actions.ts          server action: monta mensagem e link wa.me; grava lead leve
    sitemap.ts  robots.ts  opengraph-image.tsx
  public/
```

Rotas **removidas** em relação à distribuidora: `entrar/`, `pedidos/`,
`completar-cadastro/`, `manifest.ts`, `components/install-prompt`,
`components/register-sw`, `proxy.ts`.

### Mudanças em `packages/core`

Mínimas e aditivas:

- `src/channels.ts`: `"azpetshop"` em `ALL_CHANNEL_KINDS` e `CHANNEL_LABELS`
  (`"AZ Pet Shop"`).
- `src/features.ts`: `"azpetshop"` no tipo `SiteId` e no mapa `SITES`
  (`{ name: "AZ Pet Shop", features: { commerce: "quote" } }`).
- `src/whatsapp.ts`: `buildQuoteMessage` hoje fixa o texto "cotação de atacado".
  Adicionar um parâmetro opcional de texto de abertura (default mantém o atual)
  ou uma variante `buildRetailQuoteMessage`, para a loja B2C dizer algo como
  "Gostaria de finalizar este pedido:".
- Nenhuma mudança em `catalog.ts` / `catalog-utils.ts`: `queryCatalog` já aceita
  `channel: string` e filtra por `product_channel_links!inner(channel)` +
  `product_channel_prices.channel`. Com as linhas de canal e de preço no
  Supabase, o catálogo funciona sem tocar na query. `azpetshop` **não** entra em
  `ERP_PRICE_CHANNELS`, então o preço vem de `product_channel_prices`.

### Raiz do monorepo

- `package.json`: scripts `dev:azpetshop` e inclusão em `dev:all` / `build`.
- `hub` (`apps/hub`): card/link para o novo app na porta 4105.
- `pnpm-workspace.yaml`: já cobre `apps/*`, sem mudança.

### Repo do blog (`C:\Projetos\azpetshop`)

- `src/components/Header.astro` e `src/components/Footer.astro`: link "Loja" →
  `https://loja.azpetshop.com.br`. Nenhuma outra mudança; stack Astro/Cloudflare
  intocada.

## Fluxo de cotação (sem conta)

1. Consumidor navega no catálogo do canal `azpetshop`, com preço visível.
2. Adiciona itens ao carrinho (`cart-provider` do core, estado no navegador).
3. Em `/cotacao`, revisa itens e preenche **nome + WhatsApp** (sem empresa, sem
   CNPJ).
4. Server action `apps/azpetshop/app/cotacao/actions.ts`:
   - monta a mensagem com o helper do core
     (`buildQuoteMessage(items, { nome, empresa: "", whatsapp })` ou a variante
     de varejo);
   - grava um registro leve em `leads` do `hub_catalogo` com
     `channel = 'azpetshop'` (reaproveita `leads-server`), para histórico;
   - devolve o link `buildWhatsAppLink(NEXT_PUBLIC_WHATSAPP_NUMBER, msg)`.
5. Cliente redireciona para o `wa.me`.

Diferença deliberada em relação a `mypet`/`distribuidora`: aqui o
`finalizeQuote` **não** exige `buyer`/auth e **não** grava `order` — não há
`buyers` nem `orders` para este canal na v1.

## Importação de preços por planilha

Preço de varejo do canal `azpetshop` vive em `product_channel_prices`
(`channel = 'azpetshop'`, `sale_price`, `sale_updated_at`).

- Fonte: planilha (CSV/XLSX) com, no mínimo, **referência do produto** e
  **preço de varejo**.
- Mecanismo: script Node em `scripts/` (raiz do monorepo ou `apps/azpetshop/`),
  no mesmo espírito do `scripts/migrate.mjs` do blog: lê a planilha, resolve
  `product_id` pela referência e faz `upsert` em `product_channel_prices` com
  `channel = 'azpetshop'`. Usa a service key do Supabase (server-only).
- Idempotente: reexecutar com a mesma planilha não duplica linhas.
- Fora do fluxo de request; roda manualmente quando há atualização de preço.
- As linhas de `product_channel_links` (quais produtos a loja mostra) podem ser
  populadas pelo mesmo script ou à parte — decisão de implementação.

## Identidade visual (passe posterior)

Nesta etapa o `client.config.ts` entra com paleta **provisória** (pode ser uma
cópia neutra de uma das existentes) só para o app compilar e renderizar. A
`page.tsx` fica com layout mínimo, sem herdar a estética da distribuidora.

Quando o usuário trouxer referências, um spec próprio define paleta, fontes,
componentes de home e PDP — momento de decidir se usa a skill de design / Figma.

## Fora de escopo (evolução futura)

- Reconexão dos 109 posts MDX (PickBox, ComparisonTable, ProductHighlight) às
  páginas de produto da loja.
- Contas de consumidor + histórico de pedidos.
- Checkout com pagamento real (Pix/cartão), frete, status de pedido.
- PWA / push.
- Identidade visual final (spec próprio).

## Validação

- `pnpm lint` e `pnpm build` (todos os apps) sem erro.
- Catálogo da loja carrega **apenas** produtos com
  `product_channel_links.channel = 'azpetshop'`, com preço de varejo vindo de
  `product_channel_prices`.
- Cotação ponta a ponta no ambiente publicado: carrinho → formulário → `wa.me`
  com a mensagem correta; registro em `leads` com `channel = 'azpetshop'`.
- Preço sempre visível, sem modal de desbloqueio.
- Script de importação: planilha de exemplo popula `product_channel_prices`;
  reexecução não duplica.
- Viewport mobile.
- `hub` lista o novo app; blog exibe o link "Loja".
