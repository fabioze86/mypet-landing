# Pedido Rápido — tabela densa de compra em massa (apps/mypet)

**Data:** 2026-09-17
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

A My Pet Brasil (canal `mypetbrasil`) vende B2B para pet shops que costumam fechar
pedidos de 20 a 50 SKUs por vez. Hoje o único caminho é `/loja`: grid de cards, uma
navegação por produto, busca com reload de página inteira. É a experiência certa para
quem está descobrindo o catálogo, mas pesada para quem já sabe o que quer comprar e só
precisa lançar quantidade por SKU o mais rápido possível.

Padrões de mercado B2B (Grainger Bulk Order, Uline Quick Order, NuORDER Digital Line
Sheet, Shopify Quick Order B2B Grid) resolvem isso com uma segunda superfície: tabela
densa, busca instantânea, quantidade editável linha a linha, adicionar sem sair da
tela. O Pedido Rápido é essa segunda superfície — **não substitui `/loja`**, que
continua existindo para quem quer navegar/descobrir.

### Estado real verificado (2026-09-17)

- **`/loja`** (`apps/mypet/app/loja/page.tsx`): `requireBuyer()` protege a rota; busca
  e filtro de marca são um `<form method="get">` que recarrega a página
  (`CatalogSection` em `packages/core/src/components/catalog-section.tsx`). Grid de
  `ProductCard` com `AddToCartControl` (stepper de quantidade + botão "Adicionar").
- **`/balcao`** (spec 2026-08-29): já é uma tabela compacta (foto, SKU, faixas de
  desconto, qtd, subtotal), mas cobre só produtos elegíveis a desconto por volume, é uma
  solicitação sob validação comercial (não um carrinho de compra), e usa suas próprias
  tabelas (`balcao_requests` etc.) — modelo diferente do que o Pedido Rápido precisa.
- **`/cotacao`** (`apps/mypet/app/cotacao/cotacao-content.tsx`): lê `useCart()` do
  `cart-provider`, lista os itens e finaliza abrindo o WhatsApp com o texto montado
  (`buildQuoteMessage`). **Não mostra preço nem total** — `CartItem` (`packages/core/src/cart.ts`)
  tem os campos `unitPrice`/`listPrice` no tipo, mas nada os preenche hoje;
  `AddToCartControl` chama `addItem` sem preço.
- **Carrinho** (`packages/core/src/cart.ts` + `components/cart-provider.tsx`):
  `localStorage`, chave `mypet_cart`, sincronizado via `useSyncExternalStore` + evento
  customizado. `addItem`/`updateQty`/`removeItem` são funções puras testadas
  (`cart.test.ts`).
- **Catálogo e preço** (`packages/core/src/catalog.ts`): `queryCatalog({ q, brand,
  categoryId, page, channel })` pagina por produto (`PAGE_SIZE = 24`, exclui
  `product_role = 'variant'`), resolve preço via `channelUsesErpPrice(channel)` →
  `fetchErpPrices()` (view `v_precos_erp`, canal `mypetbrasil`) ou
  `product_channel_prices.sale_price` nos demais canais, cacheado com `"use cache"` +
  `cacheLife("days")` + tag `"catalog"`.
- **Modelo de variante em uso**: `products.product_role` (`simple` | `parent` |
  `variant`) + `parent_product_id`. Produtos `parent` não têm preço próprio — hoje
  `applyStartingVariantPrices` só calcula um preço "a partir de" pro card; a lista de
  variantes completa só é buscada em `getProductById` → `getVariantsByParentId`, na
  página do produto. (O Hub também tem `product_bullets`, `kit_items`,
  `agent_search_aliases`, `product_attribute_values`/`species` — nenhum é consumido
  hoje por `apps/mypet`; fora do escopo desta entrega.)
- **Acesso ao Hub**: `getHubClient()` usa `SUPABASE_ANON_KEY` direto nas tabelas
  (`products`, `categories`, `product_channel_prices`, `product_channel_links`), sem API
  pública intermediária — mesmo padrão de todo o catálogo hoje; RLS do Hub já libera
  `SELECT` anônimo no necessário. `getHubServiceClient()` (service role) é usado só para
  escrita (`orders`, `balcao_requests`).

## Decisões do brainstorming

| Pergunta | Decisão |
| --- | --- |
| Prioridade inicial | Tabela de "Pedido Rápido" cobrindo o catálogo inteiro (não só produtos com desconto por volume, que é o `/balcao`). |
| Onde vive na navegação | Rota nova **`/pedido-rapido`**, enxuta (sem banners/chips institucionais de `/loja`). Dois CTAs após liberar preço: "Navegar pelo catálogo" (`/loja`) e "Pedido rápido" (`/pedido-rapido`). `/loja` não muda. |
| Formato de interação | Tabela densa e ágil (referência: Shopify Quick Order B2B Grid) — **não** cards, **não** formulário de várias etapas. Busca instantânea sem reload de página, quantidade editável direto na linha, botão de carrinho por linha que adiciona na hora, sem passo de "revisar tudo" depois. |
| Variantes | **Sempre visíveis como linhas próprias** — nunca uma linha "pai" resumida. Produto com variante aparece uma vez por variante. |
| Preço no carrinho | Carrinho passa a guardar `unitPrice` no momento do `addItem` (Pedido Rápido **e** `/loja`, pra manter os dois consistentes). `/cotacao` passa a mostrar subtotal por linha e total geral. |
| Camada de dados | Nova função que achata produtos + variantes em linhas compráveis, reaproveitando o modelo `product_role`/`parent_product_id` já comprovado em produção — não migra para nenhum modelo alternativo não usado hoje (`product_groups`/`family_id`). |
| Escopo desta v1 | Fora: bullets de venda (`product_bullets`), combos (`kit_items`), filtro por espécie, busca semântica (`agent_search_aliases`). Encaixáveis depois sem redesenho. |

## Arquitetura

Duas frentes:

1. **`packages/core`** — nova função de dados que achata catálogo + variantes em linhas
   compráveis; extensão do carrinho para carregar preço.
2. **`apps/mypet`** — rota `/pedido-rapido` (tabela + busca instantânea + Server Action
   de busca), CTAs de entrada, e ajuste de `/cotacao` para exibir subtotal/total.

### `packages/core/src/catalog.ts` — `getCatalogLineItems`

```
getCatalogLineItems(params: { q?: string; brand?: string; page: number; channel: string })
  → Promise<{ items: CatalogLineItem[]; total: number; page: number; totalPages: number }>
```

- Busca uma página de produtos como `queryCatalog` já faz hoje (`product_role !=
  'variant'`, `q`/`brand`/paginação iguais).
- Para cada produto `product_role = 'parent'` da página, busca as variantes filhas
  (mesma query de `getVariantsByParentId`, uma chamada em lote por `parent_product_id`
  da página, não uma por produto) e substitui a entrada do pai por uma linha por
  variante.
- Produtos `simple` viram 1 linha cada.
- `CatalogLineItem` = `{ id, name, sku, brand, img, unitPrice: number | null,
  priceLabel: string | null, variantLabel: string | null }` — `variantLabel` é o eixo da
  variante (ex. "500g", "Azul") quando a linha vem de uma variante, `null` para produto
  simples. `id` é sempre o id comprável (produto simples ou variante), nunca o id do
  pai.
- **Paginação é por produto-pai buscado, não por linha renderizada** — uma página com
  produtos de muitas variantes pode render bem mais que `PAGE_SIZE` linhas. Mesmo
  trade-off aceito no `/balcao`; simples de implementar, sem paginação "exata" por linha
  nesta v1.
- Preço: mesma resolução de hoje (ERP para `mypetbrasil`, `product_channel_prices` nos
  demais). Linha sem preço resolvido → `unitPrice: null`, `priceLabel: "Preço sob
  consulta"`, **não pode ser adicionada** (input de quantidade desabilitado).
- Cache: reaproveita `"use cache"` + `cacheLife("days")` + tag `"catalog"` (mesma tag do
  catálogo — variante de preço já invalida junto).

### `packages/core/src/cart.ts` — preço na linha do carrinho

- `CartItem.unitPrice` (já existe no tipo) passa a ser preenchido por quem chama
  `addItem`. Sem mudança de assinatura — o campo já é opcional.
- `AddToCartControl` (`packages/core/src/components/add-to-cart-control.tsx`) ganha uma
  prop opcional `unitPrice?: number` repassada para `addItem`. Chamadores atualizados
  nesta entrega: `ProductCard` (`/loja`) passa `product.salePrice ?? undefined`, e o novo
  componente do Pedido Rápido passa `line.unitPrice ?? undefined`.
- Itens já salvos no `localStorage` de sessões antigas (sem `unitPrice`) continuam
  válidos — `unitPrice` é `undefined`/ausente, tratado como "sem preço" no total (ver
  `/cotacao` abaixo). Nenhuma migração de dado do cliente é necessária.

### `apps/mypet/app/pedido-rapido/` (nova rota, cliente logado)

- **`page.tsx`** (server component): `requireBuyer()`; sem comprador →
  `redirect("/entrar")`. Busca a primeira página via `getCatalogLineItems({ page: 1,
  channel })` e a lista de marcas (`getBrands`, já existe) para o filtro. Renderiza
  layout enxuto: cabeçalho com busca + filtro de marca, tabela, barra fixa de total.
  Sem `SiteNav` completo/banners — só um link de volta para `/loja`.
- **Busca/filtro instantâneos** (client component `PedidoRapidoTable`): input de busca
  com debounce (~300ms); a cada mudança (texto, marca, página), chama a Server Action
  `searchLineItems(params)` (novo arquivo `actions.ts`), que roda `getCatalogLineItems`
  no servidor e devolve o JSON — atualiza a tabela em memória, **sem navegar a URL**.
  Loading local (skeleton nas linhas) enquanto a busca corre, sem bloquear o resto da
  tela.
- **Linha da tabela**: thumb pequena (`img`), nome + marca, `variantLabel` quando
  houver, SKU, `priceLabel`, input numérico de quantidade, botão de carrinho.
  - Quantidade: `<input type="number">`, valor inicial = quantidade já no carrinho para
    aquele `id` (se houver), mínimo 0. Não é um stepper — digita direto, como a
    referência do Shopify.
  - Botão de carrinho: `onClick` chama `addItem`/`updateQty` (mesma lógica do
    `cart-provider`) com a quantidade atual do input; feedback local de "✓ adicionado"
    por ~1,5s (mesmo padrão do `AddToCartControl`). Sem modal, sem navegação.
  - Linha sem `unitPrice` (produto sem preço no canal): input desabilitado, texto "Preço
    sob consulta" no lugar do botão.
- **Paginação**: mesmo padrão visual de `/loja` (números de página), mas o clique dispara
  a mesma Server Action em vez de navegação de página inteira.
- **Barra fixa** (rodapé, sempre visível): "`N itens — R$ total`" — `N` = soma de `qty`
  de todos os itens do carrinho (`totalItems`, já existe); `total` = soma de `qty ×
  unitPrice` só dos itens que têm `unitPrice` definido (itens sem preço não entram na
  soma, mas continuam contados em `N`). Botão "Ver meu pedido →" navega para `/cotacao`.

### `apps/mypet/app/cotacao/cotacao-content.tsx` — subtotal e total

- Cada linha do carrinho passa a mostrar subtotal (`item.unitPrice != null ? item.unitPrice
  * item.qty : null`) — quando `unitPrice` é `undefined` (item antigo ou sem preço),
  mostra "—" no lugar do subtotal, sem quebrar o cálculo do total.
- Bloco de total geral (soma dos subtotais definidos) acima do botão "Finalizar
  cotação →". Fluxo de finalização (WhatsApp) não muda — `buildQuoteMessage` continua
  recebendo os itens como hoje.

### Entrada / CTAs

- Após liberação de preço (CNPJ + WhatsApp em `#acesso`), a tela/seção que hoje leva
  direto para `/loja` passa a oferecer dois CTAs: **"Navegar pelo catálogo"** (`/loja`)
  e **"Pedido rápido"** (`/pedido-rapido`). Mesmo padrão visual dos CTAs existentes na
  home.
- `SiteNav` (`packages/core/src/components/site-nav.tsx`) ganha um link para
  `/pedido-rapido` ao lado do link existente para `/balcao`.

## Escopo

**Dentro:**
- `packages/core/src/catalog.ts`: `getCatalogLineItems` (achata produto + variante em
  linhas compráveis) com testes.
- `packages/core/src/cart.ts` / `add-to-cart-control.tsx`: prop `unitPrice` opcional,
  repassada ao `addItem`.
- `apps/mypet`: rota `/pedido-rapido` (server component + client table + Server Action
  de busca), CTAs de entrada em `#acesso`/`SiteNav`, ajuste de `/cotacao` para
  subtotal/total.

**Fora (YAGNI):**
- `product_bullets`, `kit_items`, filtro por espécie, busca semântica
  (`agent_search_aliases`).
- Paginação exata por linha renderizada (fica por produto-pai buscado).
- Importar/colar lista de SKUs+quantidades de planilha (bulk paste/CSV) — fica para uma
  entrega futura se houver demanda de clientes que compram por planilha.
- "Comprar novamente" / recompra a partir do histórico de `/pedidos`.
- Mudança em `/balcao` ou nas tabelas `balcao_*` — módulos independentes.
- Mudança no fluxo de finalização de `/cotacao` (continua WhatsApp, sem checkout
  próprio).
- Coluna de estoque — não existe campo de estoque no schema hoje.

## Limitações conhecidas (aceitas nesta entrega)

- **Paginação por produto, não por linha:** uma página pode render bem mais linhas que
  `PAGE_SIZE` quando há produtos com muitas variantes na página buscada.
- **Itens antigos do carrinho sem preço:** carrinhos salvos antes desta mudança mostram
  "—" no subtotal em `/cotacao` até o cliente adicionar o item de novo (ou o carrinho
  ser limpo).
- **Sem contagem regressiva de estoque:** a quantidade digitada não é validada contra
  disponibilidade — mesmo comportamento de `/loja` hoje.

## Testes mínimos por mudança

Além de `npm run lint` e `npm run build`:

- **Unit `getCatalogLineItems`:** produto `simple` vira 1 linha; produto `parent` com N
  variantes vira N linhas (nenhuma linha "pai" resumida); produto sem preço resolvido →
  `unitPrice: null`; `q`/`brand`/paginação repassados corretamente para a busca de
  produtos-base.
- **Unit `cart.ts`:** `addItem` com `unitPrice` grava o campo; `addItem` sem `unitPrice`
  mantém compatível com chamadas antigas (campo ausente, não quebra).
- **Component `PedidoRapidoTable`:** digitar na busca dispara a Server Action com
  debounce (não uma vez por tecla); linha sem preço desabilita input e some o botão de
  carrinho; clique no botão de carrinho reflete na barra fixa de total sem reload;
  quantidade inicial do input reflete o que já está no carrinho.
- **`/pedido-rapido` (server):** sem comprador → `redirect("/entrar")`.
- **`/cotacao`:** item com `unitPrice` mostra subtotal correto; item sem `unitPrice`
  mostra "—" e não entra no total geral; total geral soma só os itens com preço.

## Próximos passos

1. Revisão deste spec pelo usuário.
2. Plano de implementação (`writing-plans`), provavelmente em fatias:
   (a) `getCatalogLineItems` em `packages/core/src/catalog.ts` + testes;
   (b) prop `unitPrice` em `cart.ts`/`AddToCartControl`, repassada por `ProductCard`;
   (c) rota `/pedido-rapido` (server component + tabela client + Server Action de busca
   + barra fixa de total);
   (d) subtotal/total em `/cotacao`;
   (e) CTAs de entrada (`#acesso`, `SiteNav`).
