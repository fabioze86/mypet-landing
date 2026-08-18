# Reposicionamento da caixa de compra na página de produto (PDP)

**Data:** 2026-08-18
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

Na página de produto (PDP), o controle de quantidade + botão "adicionar ao carrinho"
fica hoje abaixo da foto do produto, na mesma coluna do grid. O nome do produto fica
na coluna oposta. Resultado: o cliente precisa rolar a tela para encontrar o preço e o
botão de compra, mesmo em telas onde a foto e as informações caberiam lado a lado.

Pedido explícito (a partir do app `apps/distribuidora`, mas a mudança vale para todo
site que compartilhe o mesmo componente de PDP):

1. Preço + seletor de quantidade + botão de adicionar ao carrinho devem ficar ao lado
   da foto, visíveis acima da dobra — não embaixo dela.
2. Quando o produto tem variação, mas o grupo de variação não tem `variant_axis`
   cadastrado (ou seja, não há como rotular a variante como "Tamanho: M" etc.), não
   faz sentido mostrar a referência interna do SKU ao cliente. Nesse caso, a lista de
   variantes deve ser exibida como uma tabela/lista de preços — uma linha por
   variante, cada uma com nome (o mesmo nome já cadastrado no catálogo para aquele
   SKU), preço, quantidade e botão de adicionar, para que o cliente possa comprar
   qualquer uma delas diretamente da linha, sem um passo de "selecionar variante"
   antes.

Quando o `variant_axis` **está** cadastrado corretamente, o seletor de chips atual
(`variant-selector.tsx`, ex. `[P] [M] [G]`) continua sendo usado — só é substituído
pela tabela como *fallback* para grupos de variação sem esse dado.

## Escopo e arquivos afetados

O layout de PDP é compartilhado via `packages/core` entre `apps/distribuidora` e
`apps/mypet` (rotas `app/produtos/[id]/page.tsx` idênticas nos dois apps, ambas
delegando a UI para o mesmo componente). `apps/azpetshop` ainda não tem PDP, mas
herdará este layout no dia em que ganhar a rota. Não há como restringir a mudança só à
Distribuidora sem duplicar o componente — e como o pedido reconhece que "se o layout
de todos os sites estiver igual, vale para todos", a mudança é feita uma vez no
componente compartilhado.

Arquivos tocados:

- `packages/core/src/components/product-variant-panel.tsx` — reestruturação principal
  do layout (imagem + caixa de compra lado a lado) e nova lógica condicional
  chips-vs-tabela.
- `packages/core/src/components/add-to-cart-control.tsx` — sem mudança de
  implementação; passa a ser instanciado uma vez por linha da tabela (já é
  autocontido: cada instância gerencia seu próprio estado de quantidade).
- `apps/distribuidora/app/produtos/[id]/page.tsx` e
  `apps/mypet/app/produtos/[id]/page.tsx` — ajuste do grid para que nome do produto e
  marca (hoje na coluna direita) passem a fazer parte da caixa de compra, na coluna ao
  lado da imagem. Descrição e especificações físicas passam a ocupar a largura total,
  abaixo da área de imagem + caixa de compra.

Nenhuma mudança é necessária em `catalog.ts` / `catalog-utils.ts`: a query já traz
`product.variants` com `axis` e `salePrice`/`priceLabel` por variante, e
`variantLabel()` já cai para `variant.name` quando `axis` está vazio — que é
exatamente o texto a ser exibido em cada linha da tabela.

## Layout — desktop

Grid de 2 colunas mantido, mas o conteúdo migra de coluna: a caixa de compra (marca,
nome, SKU/EAN, preço, quantidade/CTA ou tabela de variantes) fica ao lado da imagem,
não mais embaixo dela.

**Produto simples, ou com variação e `variant_axis` preenchido (chips mantidos):**

```
┌─────────────────┐  Marca
│                 │  VESTIDO CHIC TULE ROSA
│      [IMG]      │  SKU/Ref: 23988   EAN: 7898794690223
│                 │
└─────────────────┘  [P] [M] [G]   ← chips, só se variant_axis existir
                      ATACADO B2B
                      R$ 41,99
                      [ - 1 + ]  [Adicionar +]
─────────────────────────────────────────────
Descrição do Produto
(texto completo, largura total)

Especificações Físicas
```

**Produto com variação e sem `variant_axis` (fallback tabela):**

```
┌─────────────────┐  Marca
│                 │  VESTIDO CHIC TULE ROSA (nome do produto pai/grupo)
│   [IMG fixa]    │  SKU/Ref do pai (se houver)
│                 │
└─────────────────┘  ┌──────────────────────┬─────────┬───────────────┐
                      │ Vestido Tule Rosa P  │ [-1+]   │ Adicionar +   │
                      │ R$ 41,99             │         │               │
                      ├──────────────────────┼─────────┼───────────────┤
                      │ Vestido Tule Rosa M  │ [-1+]   │ Adicionar +   │
                      │ R$ 41,99             │         │               │
                      ├──────────────────────┼─────────┼───────────────┤
                      │ Vestido Tule Rosa G  │ [-1+]   │ Adicionar +   │
                      │ R$ 44,99             │         │               │
                      └──────────────────────┴─────────┴───────────────┘
─────────────────────────────────────────────
Descrição / Especificações
```

Cada linha renderiza sua própria instância de `AddToCartControl`, recebendo o `id`,
`name`, `sku` e `img` daquela variante específica — o clique em "Adicionar" naquela
linha adiciona diretamente aquele SKU ao carrinho, sem exigir seleção prévia.

A imagem principal é fixa (a do produto pai ou da primeira variante) para todas as
linhas da tabela — não troca por interação, mantendo o componente simples.

## Layout — mobile

O grid já vira 1 coluna em `max-width: 768px` (regra existente em `page.tsx`). A nova
ordem de empilhamento passa a ser: imagem → marca/nome/SKU/EAN → preço + quantidade +
CTA (ou tabela de variantes) → descrição → especificações. Como a caixa de compra
passa a vir logo após a imagem (ao invés de depois de nome+descrição, como hoje),
continua visível sem exigir rolagem grande na maioria dos aparelhos — mesma prioridade
visual do desktop.

## Tabela com muitas variantes

Se um grupo tiver muitas linhas (mais que ~5–6 variantes), a tabela ganha
`max-height` com scroll interno (`overflow-y: auto`), para não estourar a área visível
e não empurrar a caixa de compra inteira para baixo da dobra em telas menores.

## Lógica de decisão chips vs. tabela

```
hasVariants = product.variants.length > 0          (já existe)
hasAxisData = product.variants.some(v => v.axis.length > 0)   (novo)

hasVariants && hasAxisData   → seletor de chips (comportamento atual, reposicionado)
hasVariants && !hasAxisData  → tabela de variantes (novo)
!hasVariants                 → preço + quantidade + CTA único (comportamento atual, reposicionado)
```

## Fora de escopo

- Não altera o cadastro de produtos no Supabase (`hub_catalogo`) nem tenta inferir
  agrupamento de variantes a partir do nome — a causa raiz de produtos como "Vestido
  Chic Tule Rosa" aparecerem como SKUs isolados (sem `parent_product_id`/`product_role
  = parent`) é um problema de dado de catálogo, gerenciado fora deste repositório, e
  não é resolvida por esta mudança de layout.
- Não altera `product-card-variant-cart.tsx` (card de listagem/catálogo) — este spec
  cobre apenas a página de produto individual (PDP).
- Não adiciona troca de imagem por variante na tabela de fallback (decisão explícita:
  imagem fixa).
