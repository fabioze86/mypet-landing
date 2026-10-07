# Distribuidora — compra pensada para WhatsApp

**Data:** 2026-10-07
**App:** `apps/distribuidora` (canal de catálogo `mypetbrasil`, domínio www.distribuidorapetshop.com.br)
**Referência:** https://whatsapp.paguemenos.com.br/catalog (Suri Shop by TOTVS)

## Objetivo

Aproximar o fluxo de compra da distribuidora de um catálogo de WhatsApp: adicionar rápido, ver o total o tempo todo e enviar ao WhatsApp um pedido com preço, total e número, gravado no banco.

## Escopo

1. Barra fixa de carrinho no rodapé.
2. Preço, subtotal e total no carrinho (`/cotacao`) e na mensagem do WhatsApp.
3. Gravar o pedido no banco antes de abrir o WhatsApp, **sem exigir login**.
4. Card com botão "Adicionar" que vira stepper ligado ao carrinho.
5. Home com busca em primeiro lugar e busca ao digitar.

**Fora do escopo:**
- lembrar os dados do cliente no fechamento;
- recompra;
- frete e mínimo de pedido no carrinho;
- listar em `/pedidos` os pedidos feitos sem login;
- rolagem infinita.

## Abordagem

Os componentes novos ficam em `@mypet/core`, e a distribuidora opta por eles via prop. Os outros apps (mypet, madpet, azpetshop, distribuidora-instagram) continuam com o comportamento atual. Todas as mudanças em funções compartilhadas são aditivas, com parâmetros opcionais e padrão igual ao de hoje.

## Componentes

### 1. `cartTotals(items)` — `packages/core/src/cart.ts`
Função pura que retorna:
- `totalUnits`: soma de `qty`;
- `totalValue`: soma de `unitPrice × qty` dos itens com preço;
- `pricedLines` e `unpricedLines`: contagem de linhas com e sem `unitPrice`.

### 2. `CartBar` — `packages/core/src/components/cart-bar.tsx` (client)
- Só aparece com `totalUnits > 0`. Fica em `position: fixed` no rodapé, respeitando `env(safe-area-inset-bottom)`, na cor de acento da paleta.
- Texto: "**N itens · R$ X** — Enviar pedido →". Se `unpricedLines > 0`, acrescenta "+ itens a consultar". Se nenhum item tiver preço, mostra só "N itens".
- Leva para `/cotacao`. Fica oculta quando `usePathname()` for `/cotacao`.
- Montada em `apps/distribuidora/app/layout.tsx`, dentro do `CartProvider`. O layout adiciona um `padding-bottom` ao body (altura da barra) para não cobrir o rodapé.

### 3. `CartStepperControl` — `packages/core/src/components/cart-stepper-control.tsx` (client)
- Lê a quantidade da linha no carrinho (`id`, sem `campaignId`).
- Quantidade 0: botão de largura total "Adicionar", que adiciona 1.
- Quantidade maior que 0: stepper `− N +` que chama `updateQty` direto. No `−` com N = 1, remove o item.
- `ProductCard` ganha a prop opcional `addControl?: "default" | "stepper"` (padrão `"default"`, igual a hoje). `CatalogSection` repassa a prop.

### 4. Busca ao digitar
- `CatalogSearchBox` — `packages/core/src/components/catalog-search-box.tsx` (client):
  - campo de busca fixo (sticky) abaixo da navegação;
  - depois de 300ms sem digitar, faz `router.replace` com `?q=` atualizado, preservando `brand`, removendo `page` e mantendo a rolagem;
  - campo vazio remove `q`.
- `CatalogSection` ganha a prop `liveSearch?: boolean`. Com `true`, não renderiza o formulário GET atual (campo, select de marca e botão "Filtrar"). Busca e paginação continuam no servidor via `searchParams`.
- Ordem da home da distribuidora: `SiteNav` → `CatalogSearchBox` → `CategoryChips` → grade. Os números e o texto de marketing **continuam no fim**, sem mudança.

### 5. Preço e total em `/cotacao`
- Cada linha mostra o preço unitário e o subtotal (`qty × unitPrice`), ou "a consultar" se não houver preço.
- Um bloco de resumo antes do formulário, com "Total de unidades" e "Total". Se houver itens sem preço, mostra o aviso "Itens sem preço serão confirmados pelo atendente".

### 6. Mensagem do WhatsApp — `packages/core/src/whatsapp.ts`
`buildQuoteMessage(items, customer, intro?, options?)` recebe `options?: { showPrices?: boolean; orderNumber?: number }`.
- Com `showPrices`, cada linha fica `- Nome (SKU X) — 12 × R$ 9,90 = R$ 118,80`. Sem preço, `— Qtd: 12 (a consultar)`. Depois da lista vêm `Total de unidades: N` e `Total: R$ X`.
- Com `orderNumber`, a primeira linha vira `Pedido #1042`.
- Sem `options`, a saída fica idêntica à de hoje.

O valor que aparece na mensagem é o que **o servidor devolveu** (ver item 7). Se a gravação falhar, usa o preço do carrinho.

### 7. Gravação do pedido

**Migration** `supabase/migrations/20261007120000_orders_guest_checkout.sql`:
- `orders.buyer_id` aceita nulo;
- `orders`: novas colunas `customer_name text`, `customer_company text`, `customer_whatsapp text`, `customer_cnpj text` (todas podem ser nulas) e `number bigint generated always as identity` (único);
- `order_items`: nova coluna `unit_price numeric(12,2)` (pode ser nula);
- `getOrdersByBuyer` e as políticas RLS existentes não mudam. A gravação usa service role.

**Preços no servidor** — `getChannelPrices(productIds, channel)` em `packages/core/src/catalog.ts`: retorna `Map<productId, salePrice>` a partir de `product_channel_prices`, com a mesma regra de preço de venda usada pelo catálogo.

**Handler** — `createOrdersPostHandler({ orderChannel, priceChannel })` em `packages/core/src/orders-server.ts`, no padrão de `createLeadsPostHandler`:
- **Entrada:** `{ items: { id, qty }[], customer: { nome, empresa, whatsapp, cnpj? } }`.
- **Validação (400):**
  - `nome`, `empresa` e `whatsapp` são obrigatórios;
  - `items` precisa ter entre 1 e 200 linhas;
  - `qty` precisa ser inteiro entre 1 e 9999;
  - `id` precisa ser uuid.
- **Preço:** busca nome e preço no servidor pelo `priceChannel`; o preço enviado pelo navegador é ignorado. Um produto que não existe no canal é recusado (400).
- **Comprador:** se houver sessão do Supabase Auth, preenche `buyer_id = auth.uid`; senão, fica nulo.
- **Gravação:** insere `orders` e `order_items` com service role (`getHubServiceClient`). Se os itens falharem, apaga o pedido órfão.
- **Resposta:** `{ number, items: [{ id, unitPrice }], total }`; em caso de erro, 500 `{ error }`.
- Rota `apps/distribuidora/app/api/pedidos/route.ts` exporta `POST = createOrdersPostHandler({ orderChannel: "distribuidora", priceChannel: clientConfig.catalogChannel })`.
  - O preço vem do canal de catálogo (`mypetbrasil`).
  - O pedido é gravado com `channel = 'distribuidora'` (o `orders_channel_check` já aceita esse valor). Assim fica separado dos pedidos do app mypet, que usam `mypetbrasil`.

**Fluxo de envio em `/cotacao`:**
1. Botão "Enviar pedido pelo WhatsApp →" fica em estado de carregamento.
2. Envia `POST /api/pedidos`.
3. **Se der certo:** monta a mensagem com `orderNumber` e os preços do servidor.
4. **Se falhar** (rede ou 5xx): monta a mensagem sem número, com os preços do carrinho, e registra o erro no `console.error`. A venda não é bloqueada.
5. Se a resposta for 400 de validação: mostra o erro no formulário e não abre o WhatsApp.
6. Abre `wa.me` (`window.open(link, "_self")`) e limpa o carrinho.

## Testes

- `cart.test.ts`: casos de `cartTotals` (vazio, com preço, misto, sem preço).
- `whatsapp.test.ts`: sem `options` a saída não muda; com `showPrices`; com `orderNumber`; linha "a consultar".
- `orders-server.test.ts`: validação (400), preço vindo do servidor e não do navegador, produto fora do canal, `buyer_id` nulo sem sessão, rollback quando os itens falham.
- Componentes: `cart-stepper-control.test.tsx` (adicionar, incrementar, remover no 0) e `cart-bar.test.tsx` (oculta vazia ou em `/cotacao`, mostra total).
- `cotacao-content.test.tsx`: total exibido; envio chama a API e abre o WhatsApp com o número; falha da API ainda abre o WhatsApp.

## Riscos

- **Endpoint anônimo de escrita:** pode receber spam. Mitigação nesta entrega: validação e limites de tamanho. Rate limit fica para depois, se aparecer abuso.
- **`buyers` compartilhada com o mypet:** este desenho não cria buyer. O pedido sem login guarda o cliente em colunas do próprio `orders`, sem tocar em `buyers`.
