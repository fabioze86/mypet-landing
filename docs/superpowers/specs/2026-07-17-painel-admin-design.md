# Painel administrativo (apps/admin)

**Data:** 2026-07-17
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

Hoje toda a operação de conteúdo do site (My Pet Brasil e Distribuidora) depende de
mexer direto no código via VS Code e olhar o resultado no front-end: não há como um
não-desenvolvedor cadastrar um lead, reorganizar uma categoria ou subir um banner. O
fluxo de leads ainda grava no Google Sheets (`packages/core/src/leads-server.ts`), e
não existe nenhuma tabela ou tela para banners — a home hoje tem um hero e uma faixa de
CTA fixos no código (`apps/*/app/page.tsx`).

Este spec cobre a primeira fatia do painel: **Clientes (leads), Categorias e Marketing
→ Banners**. Pedidos ("Vendas") e Cupons promocionais foram avaliados durante o
brainstorming e ficaram fora do escopo — o site não tem carrinho/checkout hoje, só
cotação via WhatsApp, então não haveria pedido real para listar nem lugar para aplicar
cupom.

### Estado real verificado (2026-07-17, Supabase MCP)

Existem **dois projetos Supabase distintos** na organização:

- **`hub_catalogo`** (`hsguyfiyqpuligijcjlw`) — é o projeto que os sites já usam hoje
  (`SUPABASE_URL`/`SUPABASE_ANON_KEY`), com `products` (5.372 linhas), `categories`
  (85 linhas), `product_channel_links`, `media_library`, `campaigns`,
  `creative_assets`. Também existem lá `app_users`, `marketingos_sessions` e
  `marketingos_user_permissions` (roles admin/editor/viewer) — resíduo de um sistema
  separado ("MarketingOS") que **não faz parte deste repositório** e não deve ser
  reaproveitado nem tocado por este projeto.
- **`Clientes`** (`nvqlnfbfhwikoighoatd`) — projeto de CRM/automação já maduro e
  independente (`clientes_unificados` com 5.011 linhas, integrações Pipedrive,
  WhatsApp, enriquecimento via Receita Federal). **Fora do escopo**: o módulo
  "Clientes" deste painel gerencia os leads capturados pelo site, não essa base.

O painel administrativo se conecta **apenas ao `hub_catalogo`**.

A tabela `categories` tem duas colunas de referência ao pai: `parent_id` e
`parent_category_id`. O código atual (`getCategories()` em
`packages/core/src/catalog.ts`) só lê `parent_id`. `parent_category_id` parece resíduo
de uma migração antiga. O painel trata `parent_id` como campo canônico;
`parent_category_id` não é populado nem exibido, mas também não é removido nesta
entrega (decisão de schema fica para quando/se confirmarmos que está mesmo morta).

## Arquitetura

Novo app **`apps/admin`** no monorepo pnpm (Next.js App Router), compartilhando
`packages/core` (tema, cliente Supabase, tipos). Deploy e domínio próprios, separado
dos sites públicos.

- **Banco:** `hub_catalogo`, mesmo projeto Supabase já usado pelos sites.
- **Autenticação:** Supabase Auth (email/senha). Tabela `admin_users` própria (perfil
  complementar de `auth.users`, com `role`), distinta de `app_users`/`marketingos_*`.
- **Middleware** protege todas as rotas do admin: sem sessão válida, redireciona para
  `/login`.
- **Mutações** via Server Actions; Route Handlers só para upload (Cloudflare Images).
- **Navegação** (sidebar) em módulo pai + submenu, já pensada para crescer:
  - Clientes
  - Categorias
  - Marketing
    - Banners

## Modelo de dados (novas tabelas em `hub_catalogo`, RLS habilitado desde a criação)

### `admin_users`
Perfil complementar de `auth.users`: `id` (= `auth.users.id`), `name`, `role`
(`admin` | `editor`), `created_at`. Nesta v1, `role` é apenas armazenado — qualquer
usuário autenticado em `admin_users` tem acesso completo aos três módulos. A
diferenciação de permissão por papel fica para uma iteração futura, se necessário.

### `leads`
Substitui o Google Sheets como destino do formulário de lead-gate.

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | PK |
| `nome` | text | obrigatório |
| `empresa` | text | obrigatório |
| `whatsapp` | text | obrigatório |
| `cnpj` | text | opcional |
| `channel` | text | `mypetbrasil` \| `distribuidora`, resolvido no servidor a partir de `client.config.ts`, nunca enviado pelo cliente |
| `status` | text | `novo` \| `contatado` \| `convertido` \| `descartado`, default `novo` |
| `created_at` | timestamptz | default `now()` |

### `banners`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | PK |
| `type` | text | `principal` \| `mini` \| `categoria` |
| `channel` | text | `mypetbrasil` \| `distribuidora` (uma linha por canal; "ambos" = duas linhas) |
| `category_id` | uuid nullable | FK `categories.id`; obrigatório quando `type = categoria` |
| `image_url` | text | URL retornada pelo Cloudflare Images |
| `link_url` | text | destino do clique |
| `title` | text | usado como `alt` |
| `sort_order` | int | default 0 |
| `active` | boolean | default true |
| `starts_at` / `ends_at` | timestamptz nullable | agendamento opcional |
| `created_at` / `updated_at` | timestamptz | default `now()` |

Regra: no máximo um banner `categoria` ativo por `category_id` + `channel` — o admin
avisa antes de substituir.

### `categories` (reaproveitada, sem mudança de schema)
CRUD via admin sobre a tabela já existente (`id`, `parent_id`, `slug`, `name`, `level`,
`sort_order`).

## Módulo Clientes (Leads)

**No site:** `leads-server.ts` deixa de usar `googleapis` e passa a gravar via
`getHubClient()` (já existe em `packages/core/src/supabase.ts`), substituindo por
completo o Google Sheets (remove a dependência de `GOOGLE_CREDENTIALS`/
`GOOGLE_SHEET_ID` nesse fluxo). `channel` é resolvido no servidor a partir do
`catalogChannel` de cada `client.config.ts`.

**No admin (`/clientes`):**
- Tabela paginada: nome, empresa, WhatsApp, CNPJ, canal, status, data.
- Filtros por canal e status.
- Mudança de status inline (funil `novo → contatado → convertido/descartado`).
- Exportação CSV da lista filtrada.
- Sem edição dos dados do lead em si nesta v1 — é acompanhamento de funil, não CRM
  completo.

**Erros:** falha ao gravar no Supabase mantém a mesma mensagem genérica hoje exibida
ao usuário (`GENERIC_SERVER_ERROR` em `packages/core/src/leads.ts`); o erro real vai só
para o log do servidor.

## Módulo Categorias

Tela `/categorias`: árvore atual (níveis 1–3, ordenada por `sort_order`) em lista
aninhada. Reordenação por campo numérico editável (sem drag-and-drop nesta v1).

**Ações:**
- Criar: nome, slug (auto-gerado, editável), categoria pai opcional, nível derivado do
  pai.
- Editar: nome, slug, pai, `sort_order`.
- Excluir: bloqueado se existir produto com esse `category_id` **ou** categoria filha —
  botão desabilitado com tooltip explicando o motivo.
- Toda mutação chama `revalidateTag("catalog")` para refletir no site sem esperar o
  `cacheLife("days")` expirar.

**Fora do escopo:** gerenciar `channel_category_map` (mapeamento de categoria por
canal/marketplace — ligado à sincronização com Amazon/Mercado Livre, não à navegação
do site).

## Módulo Marketing → Banners

Tela `/marketing/banners`, filtrável por tipo (`principal`/`mini`/`categoria`) e canal.

**Criar/editar:**
- Upload de imagem para Cloudflare Images (credenciais fornecidas pelo usuário à parte
  — conta já existe); `image_url` grava a URL retornada.
- Campos: canal (uma ou ambas — grava uma linha por canal), link de destino, título/alt,
  `sort_order` (para rotação de múltiplos `mini`), agendamento opcional
  (`starts_at`/`ends_at`), toggle `active`.
- Quando `type = categoria`: seleção obrigatória de categoria (reaproveita a árvore do
  módulo Categorias); aviso ao tentar duplicar banner ativo para a mesma
  categoria+canal.

**No site:**
- Nova função `getBanners(channel, type, categoryId?)` em `packages/core`, cacheada com
  `"use cache"` e tag própria `"banners"` (separada de `"catalog"`, para não invalidar
  o catálogo inteiro a cada troca de banner).
- Home (`apps/*/app/page.tsx`): banner `principal` substitui o hero fixo atual; banners
  `mini` ganham uma faixa própria. Ambos com fallback para o visual atual quando não
  há banner ativo cadastrado — a home nunca quebra por falta de conteúdo.
- `/categoria/[slug]`: busca o banner `categoria` daquele `category_id`, se existir.

## Segurança

- RLS habilitado em `leads`, `banners`, `admin_users` desde a criação.
- Chave anon (site público): `INSERT` em `leads`; `SELECT` em `banners` filtrado por
  `active` e janela de agendamento. Nunca `SELECT`/`UPDATE`/`DELETE` nas tabelas
  administrativas.
- Admin autenticado (Supabase Auth, `auth.uid() in admin_users`): acesso completo às
  três tabelas novas e a `categories`.
- Cada Server Action valida entrada com schema próprio antes de tocar o Supabase
  (padrão já sugerido em `ARCHITECTURE.md §5`).

## Testes mínimos por mudança

Além de `npm run lint` e `npm run build`:

- **Leads:** campo obrigatório ausente, gravação bem-sucedida, canal correto por app.
- **Categorias:** exclusão bloqueada com produtos/filhos vinculados, slug duplicado.
- **Banners:** upload falho não deixa registro órfão sem imagem; banner de categoria
  duplicado no mesmo canal é avisado; banner com `ends_at` no passado não aparece no
  site.

## Decisões e trade-offs

| Decisão | Motivo |
| --- | --- |
| Painel em app novo (`apps/admin`), não rota dentro de `apps/mypet` | Deploy/domínio próprios, não mistura código público com administrativo |
| Supabase Auth em vez de tabela de sessão própria | Menos código para manter; hash de senha e recuperação já resolvidos |
| `admin_users` própria, não reaproveita `app_users`/`marketingos_*` | Essas tabelas pertencem a um sistema separado, fora deste repositório |
| Leads substituem Google Sheets por completo (não gravação paralela) | Simplicidade; Sheets deixa de ser fonte de verdade |
| Banners específicos por canal | mypet e distribuidora são marcas/domínios diferentes com públicos distintos |
| Banner de categoria vinculado a uma categoria específica | Requisito explícito do usuário — não é um banner genérico repetido em toda página de categoria |
| Cloudflare Images para upload | Consistente com `media_library.provider` já existente no schema; conta já existe |
| Exclusão de categoria bloqueada com produtos/filhos vinculados | Evita órfãos em `products.category_id` e quebra de cache do catálogo |
| Pedidos e Cupons fora do escopo | Site não tem checkout hoje; adicionar esses módulos sem um caso de uso real seria especulativo |

## Próximos passos

1. Revisão deste spec pelo usuário.
2. Plano de implementação (`writing-plans`), provavelmente em fatias: (a) fundação do
   `apps/admin` + auth, (b) módulo Clientes + migração do fluxo de leads, (c) módulo
   Categorias, (d) módulo Banners + integração Cloudflare Images + render no site.

## Migrações aplicadas

- **2026-07-17 — create_admin_users**: cria `public.admin_users` com RLS (select apenas do próprio registro).
- **2026-07-17 — create_leads**: cria `public.leads` (substitui o Google Sheets), com insert público e select/update restritos a `admin_users`.
- **2026-07-17 — categories_admin_write_policy**: permite insert/update/delete em `public.categories` para usuários em `admin_users` (select público pré-existente não foi alterado).
