# Mega Menu de categorias (desktop + mobile)

**Data:** 2026-07-16
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

O menu principal hoje (`packages/core/src/components/site-nav.tsx`) é extremamente
simples: logo, um texto fixo ("Exclusivo para lojistas"), badge do carrinho e um botão
de CTA. Não existe nenhum link de navegação por categoria — o visitante só encontra
produtos via busca por nome/marca na grade da home (`catalog-section.tsx`) ou pelo
assistente de busca por IA.

O pedido inicial mencionava trazer "a estrutura e organização que já existe no
Catálogo Hub". Isso foi esclarecido durante o brainstorming: **"Catálogo Hub" não é um
componente visual no código** — é o nome do projeto Supabase (`hub_catalogo`) que
centraliza produtos e categorias. Não existe hoje nenhuma seção de UI com colunas/cards
de categoria para se inspirar. A base a reaproveitar é a **árvore de dados de
categorias já existente** (`getCategories()`), não um layout pré-existente.

O objetivo desta entrega é transformar o menu principal num Mega Menu responsivo
(hover no desktop, toque no mobile), alimentado dinamicamente por essa árvore de
categorias, com painéis multi-coluna, animação suave e acessibilidade completa —
inspirado em padrões de grandes e-commerces (Amazon, KaBuM, Miess).

### Estado real relevante (verificado em 2026-07-16, direto no Supabase `hub_catalogo`, projeto `hsguyfiyqpuligijcjlw`)

- Tabela `categories`: **14 categorias de nível 1, 47 de nível 2, 24 de nível 3**
  (hierarquia real de até 3 níveis via `parent_id`/`level`). Todos os `slug` são
  **globalmente únicos** (verificado por `group by slug having count(*) > 1` → vazio).
- Distribuição por categoria de nível 1 é bem desigual: "Cães" tem 9 subcategorias e 23
  sub-subcategorias; "Gatos" tem 9 subcategorias mas só 1 sub-subcategoria; 5
  categorias de nível 1 ("Montagem de Loja", "Animais Grande Porte", "Pesca",
  "Dispenser de Ração", "Kits") não têm nenhuma subcategoria.
- `products`: 5.372 produtos ativos, **4.583 já com `category_id` preenchido** (estado
  bem diferente do snapshot registrado em `2026-06-26-catalogo-hub-sync-design.md`,
  quando a categoria estava nula em praticamente todos os produtos — os dados
  evoluíram desde então).
- `getCategories()` (`packages/core/src/catalog.ts`) já expõe essa árvore como
  `CategoryNode[]` (`id`, `parentId`, `slug`, `name`, `level`), cacheada com Next.js
  Cache Components (`"use cache"` + `cacheLife("days")` + `cacheTag("catalog")`). Não
  há campo de ícone, imagem ou "destaque" no modelo.
- `queryCatalog`/`getCatalog` já aceitam `categoryId?: string | string[]`, incluindo
  array para subtree — usado hoje só pelo assistente de IA.
- `packages/core/src/assistant-server.ts` já implementa, localmente e sem exportar,
  duas funções reaproveitáveis: `collectCategorySubtreeIds(categories, rootId)`
  (percorre `parentId` e devolve todos os ids da subárvore) e a lógica de
  `pathFor`/`formatCategories` (monta o caminho completo "Pai > Filho" de uma
  categoria).
- `SiteNav` é `"use client"` (usa `useClientConfig()` para tema) e é renderizado
  individualmente em 6 `page.tsx` diferentes (home, `/produtos/[id]`, `/cotacao`, × 2
  apps: `mypet` e `distribuidora`) — não existe um layout único que os envolva com nav.
  Cada uma dessas páginas já busca seus próprios dados (ex.: `clientConfig.catalogChannel`)
  e passa como prop para os componentes que renderiza.
- Não existe nenhuma rota de listagem por categoria hoje — `/produtos` só tem
  `[id]/page.tsx` (detalhe), a grade de produtos vive embutida na home
  (`app/page.tsx`, seção `#catalogo`) com filtros `q`/`brand`/`page` via query string
  (`querystring.ts` → `buildCatalogQuery`).
- Nenhuma biblioteca de menu/animação está instalada em nenhum `package.json` do
  monorepo (sem framer-motion, sem Radix, sem Headless UI). O padrão visual atual é
  inline styles lendo a `Palette` do tema (`theme.tsx`), com Tailwind v4 disponível mas
  pouco usado nos componentes compartilhados.

## Decisões tomadas

| Tema | Decisão |
|------|---------|
| Escopo de apps | Implementado em `packages/core` (componente compartilhado), valendo para `apps/mypet` e `apps/distribuidora` ao mesmo tempo |
| Fonte de dados | Reaproveita `getCategories()` já cacheado — sem nova tabela, sem mudança de schema |
| Destaques (banners/produtos em destaque nas colunas) | **Fora de escopo** nesta entrega — o modelo de categoria não tem imagem/banner e não há tempo hábil de curadoria manual agora |
| Ícones por categoria | **Fora de escopo** — texto puro, sem mapa de ícones a manter |
| Biblioteca de UI | **Radix UI** (`@radix-ui/react-navigation-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-accordion`) — primitives headless que resolvem teclado/ARIA corretamente por padrão, estilizados com o padrão inline-style/`Palette` já usado no projeto; animação via CSS puro sobre os atributos `data-state` do Radix, sem framer-motion |
| Níveis mostrados no painel do menu | 2 níveis (categoria de nível 1 na barra, subcategorias de nível 2 nas colunas do painel). Nível 3 não aparece no menu — fica acessível como refinamento dentro da página de categoria |
| Destino do clique numa categoria/subcategoria | Nova rota dedicada `/categoria/[slug]`, com listagem de produtos própria (não reaproveita a grade da home) |
| UX mobile | Drawer full-screen com acordeão (Radix `Dialog` + `Accordion`), não o mesmo painel do desktop adaptado para toque |

## Escopo

### Nesta entrega

- Extrair `collectCategorySubtreeIds` e a lógica de caminho (`pathFor`) de
  `assistant-server.ts` para `packages/core/src/catalog-utils.ts` como funções
  exportadas e testáveis (`collectCategorySubtreeIds`, `getCategoryPath`), reexportadas
  por `assistant-server.ts` no lugar da implementação local duplicada. Mover o tipo
  `CategoryNode` de `catalog.ts` para `catalog-utils.ts` junto com os demais tipos
  puros (`catalog.ts` já importa de `catalog-utils.ts`; mantê-lo lá evitaria import
  circular).
- Novo helper `buildCategoryTree(categories: CategoryNode[])` em `catalog-utils.ts`,
  que agrupa a lista plana em nós com `children[]`, usado tanto pelo Mega Menu quanto
  pela página de categoria (chips de refinamento).
- Novo componente `packages/core/src/components/mega-menu.tsx` (client), usando
  `@radix-ui/react-navigation-menu`: barra com as categorias de nível 1; categorias
  sem filhos viram link direto; categorias com filhos viram trigger que abre um painel
  largura-total (mesmo `maxWidth: 1200` do resto do site) com colunas por
  subcategoria de nível 2, mais um link "Ver todos os produtos de [Categoria]" no
  topo do painel apontando para `/categoria/[slug]` da própria categoria de nível 1.
- Novo componente `packages/core/src/components/mobile-menu.tsx` (client), usando
  `@radix-ui/react-dialog` (drawer full-screen) + `@radix-ui/react-accordion`
  (expansão de categoria → subcategorias). Acionado por um botão de menu (☰) que só
  aparece abaixo do breakpoint mobile.
- `SiteNav` passa a receber `categories: CategoryNode[]` como prop, chama
  `buildCategoryTree(categories)` uma única vez e repassa a árvore resultante para
  `MegaMenu`/`MobileMenu`, que renderiza internamente (troca de um pelo outro via CSS
  `media query`, não JS, para não duplicar fetch/estado nem recomputar a árvore duas
  vezes). Continua `"use client"`.
- As 6 `page.tsx` que hoje renderizam `<SiteNav />` passam a chamar `getCategories()`
  (server, já cacheado) antes e repassar como prop — mesmo padrão que já usam para
  `clientConfig`/`channel`.
- Nova rota `apps/{mypet,distribuidora}/app/categoria/[slug]/page.tsx`: busca a
  categoria pelo slug (via `getCategories()`, filtrando em memória — não há
  `getCategoryBySlug` na base de dados, e a lista inteira já vem cacheada e é pequena o
  bastante para filtrar em memória), monta breadcrumb subindo por `parentId` via
  `getCategoryPath`, calcula a subtree via `collectCategorySubtreeIds` e lista produtos
  com `getCatalog({ categoryId: subtreeIds, page, channel })`, reaproveitando
  `ProductCard` e a paginação no mesmo estilo de `catalog-section.tsx`. Se a categoria
  tiver filhos diretos (via `buildCategoryTree`), eles aparecem como chips de
  refinamento no topo da listagem, cada um linkando para `/categoria/[slug-do-filho]`.
  Categoria inexistente → `notFound()`.
- Instalar `@radix-ui/react-navigation-menu`, `@radix-ui/react-dialog`,
  `@radix-ui/react-accordion` em `packages/core`.

### Fora de escopo (fases futuras)

- Destaques/banners/produtos em destaque nas colunas do painel.
- Ícones por categoria.
- Breadcrumb/SEO avançado (`generateMetadata` customizado por categoria, dados
  estruturados) além do título básico da página.
- Busca/filtro combinando categoria com `q`/`brand` na mesma URL da página de
  categoria (a página de categoria nesta entrega é uma listagem simples, sem os
  controles de busca por texto/marca que a home já tem).
- Reordenar ou curar manualmente a ordem das categorias no menu (segue a ordem que já
  vem de `sort_order` no banco, via `getCategories()`).

## Arquitetura

```
page.tsx (server, × 6: home/produtos/cotacao × mypet/distribuidora)
  → getCategories()  [cacheado, "use cache", cacheTag("catalog")]
  → <SiteNav categories={categories} />
      (client; já usa useClientConfig() pro tema)
      → <MegaMenu categories={tree} />     [visível ≥ breakpoint desktop, via CSS]
           @radix-ui/react-navigation-menu
           - categoria sem filhos → <NavigationMenu.Link asChild><Link href="/categoria/[slug]" /></NavigationMenu.Link>
           - categoria com filhos → <NavigationMenu.Trigger> + <NavigationMenu.Content>
               painel largura-total, colunas por subcategoria (nível 2)
               link "Ver todos de [Categoria]" → /categoria/[slug-nivel-1]
      → <MobileMenu categories={tree} />   [visível < breakpoint desktop, via CSS]
           @radix-ui/react-dialog (drawer full-screen)
             @radix-ui/react-accordion (categoria → subcategorias nível 2)

apps/{app}/app/categoria/[slug]/page.tsx (novo)
  → getCategories() [mesmo cache] → acha o node pelo slug, monta breadcrumb (getCategoryPath)
  → collectCategorySubtreeIds(categories, node.id) → subtreeIds
  → getCatalog({ categoryId: subtreeIds, page, channel: clientConfig.catalogChannel })
  → breadcrumb + (se houver filhos diretos) chips de refinamento + grade de ProductCard + paginação
```

### Helpers extraídos/novos em `catalog-utils.ts`

```ts
export type CategoryNode = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  level: number | null;
};

export type CategoryTreeNode = CategoryNode & { children: CategoryTreeNode[] };

export function buildCategoryTree(categories: CategoryNode[]): CategoryTreeNode[];

export function collectCategorySubtreeIds(categories: CategoryNode[], rootId: string): string[];

export function getCategoryPath(categories: CategoryNode[], nodeId: string): CategoryNode[]; // raiz → nó, em ordem
```

`assistant-server.ts` passa a importar `collectCategorySubtreeIds` e a construir
`formatCategories` em cima de `getCategoryPath`, em vez de manter sua própria cópia.

### Breakpoint desktop/mobile

Reaproveita o mesmo breakpoint já usado hoje em CSS do repo (`@media (max-width: 768px)`,
visto em `produtos/[id]/page.tsx`). `SiteNav` renderiza os dois componentes
(`MegaMenu` e `MobileMenu`) sempre, alternando visibilidade via CSS
(`display: none` acima/abaixo do breakpoint) — evita divergência de hidratação entre
servidor e cliente por checar `window.innerWidth` em JS.

## Tratamento de erros e casos de borda

- **Categoria com slug inexistente em `/categoria/[slug]`:** `notFound()` (padrão já
  usado em `produtos/[id]/page.tsx`).
- **Categoria de nível 1 sem nenhum produto na subtree (ex. categoria nova, ainda sem
  produtos vinculados):** mesma UI de "nenhum produto encontrado" que
  `catalog-section.tsx` já usa, sem tratamento especial.
- **`getCategories()` retorna lista vazia (erro no Supabase):** `catalog.ts` já loga o
  erro e devolve `[]`; `MegaMenu`/`MobileMenu` renderizam a barra sem itens de
  categoria (nav ainda funciona: logo, carrinho, CTA continuam visíveis) — sem quebrar
  a página.
- **Categoria com muitos filhos (ex. "Cães", 9 subcategorias) em tela estreita de
  desktop (ex. laptop 1280px):** grid de colunas usa `auto-fit`/`minmax`, então reduz o
  número de colunas e aumenta linhas em vez de estourar a largura do painel.
- **Toque acidental fora do drawer mobile:** `Dialog` do Radix já fecha ao tocar fora
  e devolve foco ao botão que abriu — comportamento padrão do primitive, sem código
  extra.

## Estratégia de testes

- Unitários em `catalog-utils.test.ts`: `buildCategoryTree` (agrupamento correto,
  categoria sem filhos vira nó com `children: []`), `collectCategorySubtreeIds`
  (raiz sem filhos devolve só o próprio id; raiz com netos devolve os 3 níveis),
  `getCategoryPath` (nó de nível 1 devolve array de 1; nó de nível 3 devolve os 3
  ancestrais em ordem raiz→nó).
- Unitário/regressão em `assistant-server.test.ts` (se existir): confirmar que o
  comportamento do assistente não muda após trocar a implementação local pelas
  funções importadas de `catalog-utils.ts`.
- Validação manual via `/run` nos dois apps: abrir a home, passar o mouse em "Cães"
  (categoria com mais subcategorias) e confirmar colunas/animação; testar navegação
  por teclado (Tab, setas, Esc) no painel; testar no viewport mobile o drawer +
  acordeão; clicar numa subcategoria e confirmar que `/categoria/[slug]` lista os
  produtos certos e o breadcrumb bate com a hierarquia; clicar num chip de
  refinamento de nível 3 e confirmar que a subtree filtra corretamente.

## Riscos e mitigações

- **14 categorias de nível 1 não cabem numa barra horizontal em telas menores de
  desktop (ex. 1024–1280px):** mitigado por permitir quebra de linha ou rolagem
  horizontal da barra nesse intervalo, mantendo o drawer mobile como solução completa
  abaixo do breakpoint principal.
- **Categoria com produtos zerados na subtree gerando página de categoria "vazia" e
  ruim para SEO:** aceito nesta entrega (mesmo comportamento da grade principal hoje);
  não há curadoria de quais categorias aparecem no menu.
- **Divergência de hidratação (SSR vs. client) ao decidir desktop/mobile:** mitigado
  por renderizar os dois componentes sempre e alternar por CSS, não por
  `window.innerWidth` em JS.
- **Duplicar lógica de subtree/path entre o assistente de IA e o Mega Menu:**
  mitigado extraindo para `catalog-utils.ts` como primeira tarefa da implementação,
  antes de escrever os componentes novos.
