# Sincronização do catálogo da landing com o Catálogo Hub

**Data:** 2026-06-26
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

A landing page hoje exibe um catálogo de **16 produtos escritos à mão** no array `PRODUCTS` em
[`app/page.tsx`](../../../app/page.tsx) (linha 37). Não há integração de produtos com banco de
dados. O Google Sheets, presente no projeto, é usado **apenas para gravar leads** do formulário
de cadastro ([`app/api/leads/route.ts`](../../../app/api/leads/route.ts)) — não tem relação com
os produtos.

O objetivo é passar a alimentar o catálogo a partir do **Catálogo Hub**, que é um projeto
Supabase chamado `hub_catalogo` (ref `hsguyfiyqpuligijcjlw`, região us-east-2).

### Estado real do Hub (verificado em 2026-06-26)

- `products`: **5.367 produtos, todos com `status = 'active'`**. Campos relevantes: `name`,
  `brand`, `barcode` (EAN), `reference` (serve de SKU), `description`, `metadata` (jsonb).
- `product_assets`: **4.910 imagens** do tipo `main_image`, hospedadas no Cloudflare Images
  (`imagedelivery.net`). Logo, ~457 produtos **não têm imagem**.
- `category_id` está **nulo em 100% dos produtos**. A tabela `categories` tem 4 linhas
  (Cães, Gatos, Higiene, Banho & Tosa), sem hierarquia e **sem nenhum produto vinculado**.
- `product_prices` e `erp_items` estão **vazias** — não há preços nem dados de vendas.
- `metadata` só contém a chave `tags`, presente em **1 único produto**.

Consequências que moldaram o design:
- Não há como filtrar por categoria de forma útil (nenhum produto categorizado) → **categoria
  fica fora desta entrega**.
- Não há preço → a landing mantém o modelo atual de "preços liberados após cadastro".
- Nenhuma origem automática de badge (vendas, promoção, analytics) está populada no Hub.

## Decisões tomadas

| Tema | Decisão |
|------|---------|
| Fonte dos dados | Supabase `hub_catalogo`, tabela `products` + `product_assets` |
| Escopo de exibição | Catálogo completo (5.367), navegável com paginação |
| Busca / filtros | Busca por **nome** + filtro por **marca** (no servidor). Sem categoria nesta fase. |
| Atualização | Cache periódico (Next.js Cache Components: `use cache` + `cacheLife`) |
| Produtos sem imagem | Exibir todos, com **imagem placeholder** para os sem foto |
| Acesso ao banco | Opção A — policy RLS de **leitura pública** (só `status='active'`) + **anon key** |
| Badges | Sistema desacoplado; nesta entrega só badges **manuais** |
| Armazenamento de badges | Nova tabela `product_badges` no Hub |

## Escopo

### Nesta entrega
- Sincronizar o catálogo completo a partir do Hub.
- Paginação, busca por nome e filtro por marca — tudo no servidor.
- Placeholder para produtos sem imagem.
- Exibição de badges **manuais** (ex.: "Escolha da My Pet", "Novidade") lidos do Hub.
- `STATS` da landing passa a usar a contagem real de produtos.

### Fora de escopo (fases futuras)
- Categorias e filtro por categoria (depende de categorizar os produtos no Hub).
- Preços.
- Badge "Promoção" automático (depende de definir regra e campo de promoção no Hub).
- Badges "Mais vendidos" (depende de dados de venda) e "Mais visitados" (depende de
  integração com Google Analytics).
- Galeria de imagens e página de detalhe do produto.

## Arquitetura

App Router do Next.js 16 com **Cache Components** (`cacheComponents: true`). A página é
renderizada no servidor, consulta o Supabase por página/busca/marca e o resultado fica em cache
periódico. A interatividade que exige estado de cliente (modal de cadastro, "unlock", formulário
de leads) fica isolada em um Client Component.

### Componentes

**1. `lib/supabase.ts` — cliente do Hub**
- Usa `@supabase/supabase-js` (nova dependência).
- Lê `SUPABASE_URL` e `SUPABASE_ANON_KEY` do ambiente (`.env.local`).
- Acesso pela **opção A**: criar policies RLS de `SELECT` público em `products`,
  `product_assets` e `product_badges`, restritas a `status = 'active'` (em `products`). Nenhuma
  outra tabela do Hub é exposta.

**2. Migration no Hub — tabela `product_badges`**

| Coluna | Tipo | Observação |
|--------|------|------------|
| `id` | uuid PK | `gen_random_uuid()` |
| `product_id` | uuid FK → `products.id` | |
| `kind` | text | check: `manual` \| `promocao` \| `mais_vendido` \| `mais_visitado` |
| `label` | text | texto exibido (ex.: "Escolha da My Pet") |
| `code` | text | identificador estável p/ estilo (ex.: `escolha_mypet`, `novidade`) |
| `priority` | int | qual badge mostrar quando houver mais de um (maior vence) |
| `starts_at` | timestamptz null | validade opcional |
| `ends_at` | timestamptz null | validade opcional |
| `created_at` | timestamptz | `now()` |

Esta entrega só grava/lê `kind = 'manual'`; a estrutura já comporta as fases futuras sem
reescrita.

**3. `lib/catalog.ts` — camada de dados**
- `getCatalog({ q, brand, page })`:
  - `'use cache'` + `cacheLife('days')` + `cacheTag('catalog')`.
  - Join `products` ⋈ `product_assets` (apenas `type = 'main_image'`) ⋈ `product_badges`
    (badge vigente — dentro de `starts_at`/`ends_at` — de maior `priority`).
  - Filtros: `ilike` em `name` para `q`; `eq` em `brand`.
  - Ordenação estável (ex.: `name`), `range` para paginação (página padrão de 24 itens).
  - Retorna `{ items, total, totalPages, page }`.
- `getBrands()`: marcas distintas (para o filtro), cacheada com `cacheLife('days')`.
- Mapeamento para a UI: `name`→nome, `reference`→SKU, `brand`→marca,
  `product_assets.url`→imagem (ou placeholder), badge→`{ label, code }`.

**4. `next.config` — habilitar `cacheComponents: true`.**

**5. Refatorar [`app/page.tsx`](../../../app/page.tsx)**
- Vira **Server Component**: lê `searchParams` (`q`, `brand`, `page`), chama
  `getCatalog`/`getBrands` e renderiza a grade + controles.
- A parte interativa com estado (modal de cadastro, `unlocked`, formulário que envia para
  `/api/leads`) sai para um **Client Component** (ex.: `components/lead-gate.tsx`), preservando o
  fluxo atual.
- Busca, filtro e paginação funcionam por **navegação com `searchParams`** (form GET + links),
  sem baixar o catálogo inteiro para o cliente.
- `STATS` ("5.000+ SKUs") passa a refletir a contagem real.
- Estilo dos badges: mapeado no front pelo `code` (como o objeto `BADGES` atual), com fallback
  neutro para códigos desconhecidos.

**6. Fase 2 (opcional, fora desta entrega):** route handler `/api/revalidate` chamando
`revalidateTag('catalog')`, acionável por webhook do Hub quando o catálogo muda.

## Fluxo de dados

```
Visitante → app/page.tsx (Server Component, lê searchParams)
          → lib/catalog.ts getCatalog() [use cache + cacheLife('days')]
          → lib/supabase.ts (anon key)
          → Supabase hub_catalogo: products ⋈ product_assets ⋈ product_badges (RLS leitura pública)
          ← items + total + badges
          → render da grade; placeholder p/ sem imagem; badge por code
```

## Tratamento de erros

- **Hub indisponível com cache existente:** `use cache` serve a versão *stale* — a página
  continua funcionando.
- **Falha sem cache (ex.: primeiro build):** `getCatalog` retorna lista vazia + log; a UI mostra
  "catálogo temporariamente indisponível" em vez de quebrar.
- **Produto sem imagem:** usa o placeholder; nunca renderiza imagem quebrada.

## Estratégia de testes

- **TDD em `lib/catalog.ts`:** mapeamento de campos (Hub → forma usada pela UI) e montagem da
  query (filtros `q`/`brand`, paginação, seleção do badge vigente) com o cliente Supabase
  mockado.
- **Verificação manual** da página rodando via `/run`: busca, troca de marca, navegação entre
  páginas, produto com e sem imagem, produto com badge manual.

## Variáveis de ambiente novas

- `SUPABASE_URL` — URL do projeto `hub_catalogo`.
- `SUPABASE_ANON_KEY` — chave pública (anon) do projeto.

## Riscos e mitigações

- **Busca textual livre cacheia mal** (muitas combinações de `q`): aceitável neste volume; se
  preciso, usar `cacheLife` mais curto para resultados de busca e manter `days` para listagem
  base e marcas.
- **Crescimento do catálogo:** paginação no servidor escala sem mudança de arquitetura.
- **Premissa de categorização futura:** quando os produtos forem categorizados no Hub, basta
  adicionar o filtro por categoria reusando o mesmo padrão de `searchParams`.
