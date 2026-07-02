# Carrinho de cotação consolidada — Spec de Design

## Contexto

Hoje cada produto tem um fluxo de cotação individual: clicar em "Solicitar cotação"
(no card, na página de produto ou no hero) abre um modal (`LeadGateProvider`) que
captura nome/empresa/whatsapp/cnpj e grava o lead via `POST /api/leads` no Google
Sheets. Não há como o lojista pedir cotação de vários produtos de uma vez.

Este documento especifica um carrinho de cotação: o cliente adiciona produtos com
quantidade, revisa tudo numa página dedicada e finaliza enviando os dados para o
Google Sheets (como hoje) e abrindo uma conversa de WhatsApp já com a lista de itens.

## Decisões

- **Destino da cotação consolidada:** link do WhatsApp (`wa.me`), montado no
  cliente com os itens e quantidades. Não é uma nova tabela/API de persistência de
  pedidos.
- **Fonte tipográfica:** mantém Nunito + Nunito Sans; não adiciona Plus Jakarta Sans.
- **Coexistência de fluxos:** o botão "Solicitar cotação" (cotação rápida, 1
  produto, modal atual) continua existindo sem alterações. O carrinho é um fluxo
  adicional, não uma substituição.
- **Registro do lead:** ao finalizar a cotação do carrinho, os dados de contato
  (nome, empresa, whatsapp, cnpj) são salvos via `POST /api/leads`, igual ao fluxo
  atual. O endpoint e a planilha não mudam de formato — a lista de itens não é
  gravada no Sheets, apenas na mensagem do WhatsApp.
- **Local de revisão do carrinho:** página dedicada `/cotacao`, não um painel
  lateral.
- **Seleção de quantidade:** stepper `[ - ] qty [ + ]` no próprio card do produto,
  antes de "Adicionar à cotação".
- **Número de WhatsApp de destino:** variável de ambiente
  `NEXT_PUBLIC_WHATSAPP_NUMBER` (client-side, não é segredo — é o número comercial
  usado no link `wa.me`). Valor placeholder em `.env.local`; configuração do número
  real fica fora do escopo desta implementação.

## Arquitetura

### Modelo de dados (`lib/cart.ts`, funções puras)

```ts
export type CartItem = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  qty: number;
};
export type Cart = { items: CartItem[] };

export function addItem(cart: Cart, product: Omit<CartItem, "qty">, qty: number): Cart;
export function removeItem(cart: Cart, id: string): Cart;
export function updateQty(cart: Cart, id: string, qty: number): Cart; // qty <= 0 remove o item
export function totalItems(cart: Cart): number;
```

`addItem` soma a quantidade se o produto já estiver no carrinho, em vez de
duplicar a linha.

### `CartProvider` (`components/cart-provider.tsx`, `'use client'`)

Mesmo padrão do `LeadGateProvider` já existente:

- Estado do carrinho em `useState<Cart>({ items: [] })`.
- Hidrata de `localStorage` (`mypet_cart`) num único `useEffect` na montagem.
- Persiste no `localStorage` a cada mudança (`useEffect` observando `cart`).
- Expõe `useCart(): { cart, addItem, removeItem, updateQty, totalItems }` via
  Context, lançando erro se usado fora do provider (mesmo padrão de
  `useLeadGate`).

Diferente do `LeadGateProvider` (que hoje vive dentro de cada página), o
`CartProvider` precisa envolver `app/layout.tsx` (root layout), porque o carrinho
deve persistir ao navegar entre `/` e `/produtos/[id]`.

`LeadGateProvider` **não muda de lugar**: continua instanciado dentro de cada
página (`app/page.tsx`, `app/produtos/[id]/page.tsx`), pois é ele quem renderiza o
modal de cotação rápida. O `SiteNav` compartilhado é renderizado dentro da árvore
de cada `LeadGateProvider` (como hoje o `<nav>` já é), então o `UnlockButton` do
nav continua funcionando sem mudanças. `CartProvider` (no layout, acima de tudo) e
`LeadGateProvider` (por página) coexistem como dois contexts independentes.

### Componentes

- **`SiteNav`** (`components/site-nav.tsx`, server component) — extrai a barra de
  navegação hoje duplicada em `app/page.tsx` e `app/produtos/[id]/page.tsx`: logo,
  texto "Exclusivo para lojistas", `UnlockButton` (cotação rápida) e `CartBadge`.
- **`CartBadge`** (`'use client'`, dentro de `SiteNav`) — ícone 🛒 com a contagem
  de `totalItems(cart)`, link para `/cotacao`. Sem contador visível quando vazio.
- **`AddToCartControl`** (`'use client'`, novo) — stepper de quantidade (inicia em
  1, mínimo 1) + botão "Adicionar à cotação"; usado no `ProductCard` e na página
  de produto.
- **`ProductCard`** — ganha o `AddToCartControl` abaixo do `UnlockButton`
  existente (o botão de cotação rápida não é removido).
- **Página `/cotacao`** (`app/cotacao/page.tsx`, `'use client'`) — lista os itens
  do carrinho (imagem, nome, SKU, marca, stepper de quantidade, remover),
  formulário de lead (nome, empresa, whatsapp, cnpj — mesmos campos e validação do
  modal atual) e botão "Finalizar cotação". Estado vazio com link de volta ao
  catálogo quando não há itens.

### Fluxo de envio (`/cotacao`)

1. Valida campos obrigatórios (nome, empresa, whatsapp).
2. `POST /api/leads` com os mesmos campos do fluxo atual (sem alterar o endpoint).
3. Se falhar: mostra erro inline (mesma mensagem genérica do modal atual), mantém
   o carrinho intacto, não abre o WhatsApp.
4. Se der certo: monta a mensagem via `buildQuoteMessage(items, customer)`
   (`lib/whatsapp.ts`, função pura) e abre
   `https://wa.me/${NEXT_PUBLIC_WHATSAPP_NUMBER}?text=<mensagem codificada>` em
   nova aba, limpa o carrinho (`localStorage` e estado) e mostra confirmação na
   própria página `/cotacao`.

Formato da mensagem (exemplo):

```
Olá! Gostaria de uma cotação de atacado:

- RAÇÃO PREMIUM 15KG (SKU 15675) — Qtd: 2
- AREIA HIGIÊNICA 4KG — Qtd: 3

Meus dados:
Nome: João
Empresa: Pet Shop X
WhatsApp: 11999999999
CNPJ: 12.345.678/0001-99
```

CNPJ é omitido da mensagem quando não informado (campo opcional, igual ao
formulário atual).

### Melhorias pontuais no código existente

Ao extrair o `SiteNav`, aproveito para corrigir dois problemas já existentes em
`app/layout.tsx` que afetam a navegação entre páginas (nunca ajustados desde o
`create-next-app`):

- `lang="en"` → `lang="pt-BR"` (o conteúdo inteiro do site é em português).
- `metadata` genérica ("Create Next App") → título/descrição reais do site.

## Testes

Seguindo o padrão já estabelecido no projeto (`lib/catalog-utils.test.ts`,
`lib/querystring.test.ts`):

- `lib/cart.test.ts` — `addItem` soma quantidade em item já existente; `removeItem`;
  `updateQty` remove o item quando `qty <= 0`; `totalItems`.
- `lib/whatsapp.test.ts` — `buildQuoteMessage` com 1 item, com múltiplos itens,
  com/sem CNPJ, encoding correto de acentos e emojis.
- `npm run build` e `npm run lint` continuam como critério de aceite (o branch já
  teve regressões de Cache Components e de lint que só apareceram no build).
- Verificação manual via `/run`: adicionar itens em cards diferentes; conferir o
  badge do nav atualizando; navegar entre `/` e `/produtos/[id]` mantendo o
  carrinho; ajustar/remover quantidade em `/cotacao`; finalizar e confirmar que o
  WhatsApp abre com a mensagem correta e que o lead aparece na planilha.

## Fora de escopo

- Persistência do carrinho no servidor (cookie de sessão ou banco).
- Registro dos itens da cotação na planilha do Google Sheets (só entra na
  mensagem do WhatsApp).
- Configuração do número real de WhatsApp em produção (fica um placeholder em
  `.env.local`).
- Nova fonte tipográfica (Plus Jakarta Sans).
- Preço, estoque ou qualquer valor monetário exibido — o texto "Preço sob
  consulta" continua sendo o único indicador.
