# Galeria visual de opções de funcionalidade (`apps/gallery`)

**Data:** 2026-07-26
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

O usuário quer testar visualmente funcionalidades novas de UI antes de decidir se e
onde aplicá-las, sem colocar nada em produção. O pedido inicial era um card de produto
com seletor de variação + adicionar ao carrinho direto na listagem
(`apps/mypet`), mas durante o brainstorming ficou claro que o objetivo real é maior:
**uma biblioteca permanente de opções**, não um teste único de "antes vs. depois".

Motivação explícita do usuário: "se amanhã eu tenho 20 clientes e cada um quer uma
funcionalidade diferente, eu já tenho uma biblioteca pronta de consulta e
implementação." Ou seja, para um mesmo "espaço" da UI (ex.: card de produto na
listagem) podem existir múltiplas opções (A, B, C...) que convivem — nenhuma é
"antiga" nem "nova", são alternativas que diferentes clientes podem escolher.

Isso é **diferente** do spec `2026-07-26-galeria-funcionalidades-design.md` (registro
`packages/core/src/features.ts` / `SITES`, que controla qual *modo* está ativo em
produção em cada site, com tela somente-leitura no `apps/admin`). Os dois nomes
parecidos são coincidência do brainstorming do mesmo dia — não têm relação de
dependência entre si. Este spec cobre a fase *anterior* à produção: um lugar pra ver
as opções funcionando de verdade antes de decidir aplicar alguma delas via `SITES`.

## Decisões já tomadas no brainstorming

- **Dados reais do catálogo** (Supabase `hub_catalogo`, canal `mypet`), só leitura —
  não fixtures/mock, pra a pré-visualização ficar realista.
- **Só local** (`pnpm --filter gallery dev`), sem deploy público — zero infra extra,
  zero risco de exposição.
- **Componentes de produção de verdade** em `packages/core/src/components` — cada
  opção da galeria é um componente real, pronto pra qualquer app importar. "Aplicar
  pra um cliente" = trocar o import, não portar/reescrever código de protótipo.
- Organização por **slot** (um "espaço" de UI, ex. "card de produto em listagem") com
  N **opções** dentro dele, todas exibidas juntas pra comparação visual — não é
  before/after.

## Arquitetura

### Novo app `apps/gallery`

Next.js App Router, local-only, seguindo o mesmo padrão leve do `apps/hub` já
existente. Porta `4105` (próxima livre após mypet `4100`, distribuidora `4101`,
azpetshop `4102`, admin `4103`, hub `4104`). Adicionado ao script `dev:all` da raiz.

Reaproveita as mesmas env vars do Supabase que `apps/mypet` já usa
(`SUPABASE_URL`/`SUPABASE_ANON_KEY` — chave pública, só leitura, mesmo valor, sem
segredo novo).

### Registro central: `packages/core/src/gallery-registry.ts`

```ts
import type { ComponentType } from "react";
import type { CatalogProduct } from "./catalog-utils";

export type GalleryOption = {
  id: string;                                    // "a-lead-gate" | "b-variacao-carrinho"
  label: string;                                  // "A — Preço travado (cotação)"
  component: ComponentType<{ product: CatalogProduct }>;
  notes?: string;                                 // ex.: "requer produto com 2+ variantes"
};

export type GallerySlot = {
  id: string;                                     // "card-produto-listagem"
  label: string;                                  // "Card de produto em listagem"
  description: string;
  productIds: string[];                           // produtos reais curados pra demo
  options: GalleryOption[];
};

export const GALLERY_SLOTS: GallerySlot[] = [ /* preenchido na Task de implementação */ ];
```

`productIds` fica no registro (não hardcoded na página) porque cada slot pode
precisar de um conjunto diferente de produtos de exemplo (ex.: um slot de variação
precisa de um produto com 2+ variantes; outro slot pode não precisar).

### Rotas

- `apps/gallery/app/page.tsx` — índice: lista `GALLERY_SLOTS`, link pra cada um.
- `apps/gallery/app/[slotId]/page.tsx` — Server Component. Busca o slot no registro
  (`notFound()` se `slotId` não existir), busca os produtos de `productIds` via
  `getProductById(id, "mypet")` (mesma função já usada pela PDP — inclui variantes
  quando o produto é `parent`), e renderiza cada `GalleryOption.component` num grid,
  uma coluna por opção, mesmos produtos em todas.

### Providers (`apps/gallery/app/layout.tsx`)

- `ClientConfigProvider` com a config do `mypet` (os dados vêm do canal `mypet`, faz
  sentido usar a paleta dele).
- `LeadGateProvider` — necessário pra Opção A (`ProductCard` atual) funcionar de
  verdade, incluindo o clique em "Solicitar cotação" desbloqueando o preço.
- `CartProvider` próprio da galeria — carrinho isolado em `localStorage` do
  `apps/gallery` (chave/app diferente, não compartilha estado com `apps/mypet` nem
  nenhum outro app).

## Primeiro conteúdo: slot "Card de produto em listagem"

**`GALLERY_SLOTS[0]`** — `id: "card-produto-listagem"`.

### Opção A — `ProductCard` (existente, sem alteração)

Import direto de `packages/core/src/components/product-card.tsx` como já é hoje:
preço atrás do lead-gate, CTA "Solicitar cotação" + `AddToCartControl`.

### Opção B — `ProductCardVariantCart` (novo)

Novo arquivo `packages/core/src/components/product-card-variant-cart.tsx`:

- coração de favoritar no canto superior esquerdo (estado visual local via
  `useState`, sem persistência — é demonstração, não funcionalidade real de
  favoritos);
- badge "NOVO" no canto superior direito quando aplicável, mapeado para o código
  `novidade` já existente em `badgeStyle(code, palette)` (sem criar 4º código);
- imagem do produto;
- seletor de variação como pills numa linha (só aparece com 2+ variantes, mesma
  regra do `VariantSelector` da PDP). **Não** reaproveita o componente
  `VariantSelector` como está — aquele é layout em coluna com label "Escolha uma
  opção", pensado pra PDP; o card precisa de pills compactos numa única linha ao
  lado do botão "+". Reaproveita só o helper `variantLabel()` de
  `variant-selector.tsx` pra manter o texto do pill consistente com a PDP;
- estado da variante selecionada: `useState` local no próprio componente,
  pré-selecionando `variants[0]` (o "+" nunca fica morto esperando escolha). Isso é
  possível porque `VariantSelector`/lógica de seleção já é desacoplada de
  `useSelectedVariant` (que é só o hook usado na PDP para persistir na query string)
  — o card não precisa de um hook novo, só de estado local direto;
- nome do produto, preço + parcelamento (mesmos dados já disponíveis via
  `PriceLockSlot`/preço resolvido, reaproveitados como já existem);
- botão circular "+" à direita do seletor: chama `useCart().addItem(...)` com
  `id: variant.id` (convenção já usada na PDP: `cartId = variantOverride?.id ??
  product.id`) e `qty=1`, com feedback visual rápido (mesmo padrão "Adicionado ✓" já
  usado em `AddToCartControl`), sem navegar para a PDP;
- produto sem variação (só 1 variante/produto simples): "+" adiciona direto, sem
  mostrar seletor.

### Produtos de demonstração

`productIds` do slot precisa incluir pelo menos: 1 produto com 2+ variantes (pra
exercitar o seletor de pills) e 1 produto simples sem variação (pra exercitar o
caminho "+" direto). IDs concretos a escolher na implementação, consultando o
catálogo real do canal `mypet`.

## Testes mínimos

- `packages/core`: teste do `gallery-registry.ts` garantindo que todo `GallerySlot`
  tem ao menos 1 `GalleryOption` e que os `id` de opção são únicos dentro do slot
  (mesmo padrão de sanity check do `features.test.ts` já existente).
- Sem teste automatizado de UI — a validação é visual: rodar
  `pnpm --filter gallery dev`, abrir `/card-produto-listagem` e comparar as duas
  opções lado a lado com produtos reais. É o propósito do app.

## Fora de escopo

- Deploy público da galeria.
- Qualquer mudança em `apps/mypet`, `apps/distribuidora` ou `apps/azpetshop` — a
  galeria não altera nenhum app existente, só lê o catálogo (read-only).
- Ligar a Opção B em produção em qualquer site — isso é uma decisão futura separada
  (via o mecanismo de `SITES`/`features.ts` do outro spec, se fizer sentido, ou
  diretamente trocando o import no app do cliente escolhido).
- Persistência real de favoritos (o coração da Opção B é só visual/demonstrativo).
- Slots além do primeiro — o registro nasce pronto pra crescer, mas só o slot "card
  de produto em listagem" ganha conteúdo real nesta entrega. Novos slots seguem o
  mesmo padrão sem precisar de spec novo, a menos que envolvam decisão de design não
  trivial.

## Decisões e trade-offs

| Decisão | Motivo |
| --- | --- |
| App novo (`apps/gallery`) em vez de Storybook ou rotas escondidas num app existente | Dados reais + providers de app (`CartProvider`/`LeadGateProvider`) exigidos; Storybook complicaria isso, e rotas dentro de um app de cliente misturam protótipo com produção — o oposto do que o usuário quer |
| Componentes de opção vivem em `packages/core`, não dentro de `apps/gallery` | "Implementar pra um cliente" precisa ser trocar um import, não portar código de protótipo depois |
| Opções mostradas juntas (grid), não "antes/depois" | Reflete o modelo real: múltiplas opções válidas coexistindo pra clientes diferentes, não uma substituindo a outra |
| Seletor de variação do card não reaproveita `VariantSelector` (componente), só `variantLabel()` (helper) | Layouts diferentes (coluna com label vs. linha compacta ao lado do "+"); forçar reuso do componente todo exigiria props extras só pra esse caso, mais complexo que ter uma renderização própria pequena |
| Carrinho da galeria é isolado (`localStorage` próprio do app) | Testar "adicionar ao carrinho" sem afetar o carrinho real de nenhum site |

## Próximos passos

1. Plano de implementação (`writing-plans`): (a) scaffold `apps/gallery` + porta +
   `dev:all`, (b) `gallery-registry.ts` + teste, (c) página índice + página de slot
   com fetch real, (d) `ProductCardVariantCart` (Opção B), (e) wiring do slot
   "card-produto-listagem" com Opção A + Opção B + produtos curados.
2. Quando o usuário decidir aplicar alguma opção num cliente real, isso é um plano
   separado (trocar o import no app do cliente, possivelmente ligado ao mecanismo de
   `SITES`/`features.ts`).
