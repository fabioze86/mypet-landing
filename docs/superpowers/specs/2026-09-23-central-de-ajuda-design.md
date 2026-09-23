# Central de Ajuda — design

- **Data:** 2026-09-23
- **Repositório:** `mypet-landing` (apps `admin` e `mypet`, projeto Supabase `hub_catalogo`)
- **Fora deste repositório:** `hub-clientes` (Hub Comercial) não é tocado nesta etapa.

## Contexto

A My Pet Brasil quer uma central de ajuda pública nos moldes do Bling: categorias,
artigos e busca, editável sem depender de desenvolvedor — hoje o único FAQ público
(`/perguntas-frequentes` em `apps/mypet`) é uma lista fixa hard-coded em
`apps/mypet/app/pre-access-content.ts` (`commercialFaq`), e qualquer mudança de
texto exige um deploy.

A análise das conversas de WhatsApp dos últimos 30 dias (487 conversas, 3.392
mensagens de cliente) mapeou os temas mais perguntados e virou um protótipo de
48 artigos em 11 categorias, publicado como Artifact e revisado pelo dono em
2026-09-23. As decisões tomadas nessa revisão (desconto à vista 5%, preço
somente atacado, Show Room com pedido mínimo R$ 150, sem personalização) são o
conteúdo de partida desta central — ver `docs/` do Hub,
`regras-comerciais-decisoes-2026-09-23` na memória do projeto.

**Decisão de direção:** esta central nasce para ser, no futuro, a fonte
verdadeira de informação comercial que o agente de atendimento do WhatsApp
(hoje em `hub-clientes`, lendo `comercial.regras_comerciais`) vai consultar —
invertendo o sentido de "fonte única" definido em 2026-09-02. Essa inversão é
**fora de escopo desta spec** (ver "Fases" abaixo); aqui só garantimos que o
desenho não crie obstáculo pra isso depois.

## Fora de escopo

- Qualquer mudança em `hub-clientes` ou em `comercial.regras_comerciais`.
- Sincronizar esta central com o Hub, nos dois sentidos.
- Editor de texto rico (WYSIWYG) — o corpo do artigo é Markdown num textarea.
- Preview do Markdown renderizado dentro do admin.
- Voto de utilidade ("Isso ajudou?") como métrica persistida.
- Hierarquia de subcategorias.
- Mexer em `/perguntas-frequentes` ou em `pre-access-content.ts` — continuam
  como estão, sem relação com a central nova.
- Corrigir o RLS desabilitado em `public._prisma_migrations` e
  `public.product_channel_prices` (achado do Supabase Advisor, não
  relacionado a este projeto — ver "Achado à parte" no fim).

## Fases

- **Fase 1 (esta spec):** tabelas, admin (CRUD) em `apps/admin`, página pública
  em `apps/mypet`, seed com os 48 artigos do protótipo.
- **Fase 2 (spec futura, separada):** expor uma API pública com segredo em
  `apps/mypet` (mesmo padrão de `GET /api/comercial/regras` no Hub, mas em
  sentido contrário) para o `hub-clientes` consumir; decidir ali como o
  agente passa a montar o FAQ a partir desta central, e o que fazer com
  `comercial.regras_comerciais` (aposentar ou manter para outro uso). Mexe em
  sistema de produção (o agente já está em produção real, com resposta
  fail-closed por instância) — por isso fica de fora daqui.

## Dados (projeto Supabase `hub_catalogo`, schema `public`)

Duas tabelas novas, seguindo o padrão de `categories` já existente (RLS
habilitado, `service_role` com acesso total, `anon`/`authenticated` só leitura
do que está publicado):

```sql
create table public.categorias_ajuda (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  titulo         text not null,
  descricao      text not null,
  icone          text not null,   -- ver enum de ícones abaixo
  ordem          integer not null default 0,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);

create table public.artigos_ajuda (
  id             uuid primary key default gen_random_uuid(),
  categoria_id   uuid not null references public.categorias_ajuda(id) on delete restrict,
  slug           text not null unique,
  titulo         text not null,
  resumo         text not null,
  corpo_markdown text not null,
  palavras_chave text not null default '',  -- termos de busca, livres, separados por espaço
  status         text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  ordem          integer not null default 0,
  nota_interna   text,  -- nunca sai pro público; mesmo papel do `observacao`
                          -- de comercial.regras_comerciais no Hub
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);

create index idx_artigos_ajuda_categoria_status
  on public.artigos_ajuda (categoria_id, status, ordem);
```

Sem hierarquia de categoria: são 11 fixas, sem necessidade de subcategoria.
`slug` de artigo é único globalmente (não composto com categoria), o que
mantém a URL pública simples (`/central-de-ajuda/a/[slug]`) e dá a cada
artigo um identificador estável — o mesmo papel de `chave` em
`comercial.regras_comerciais`, útil se a Fase 2 vier a expor uma API por
artigo.

**Enum de ícones** (`icone`, validado por `zod` no admin, texto livre no
banco): `flag`, `user`, `box`, `tag`, `cart`, `card`, `truck`, `store`,
`swap`, `receipt`, `hands` — os mesmos 11 usados no protótipo, renderizados
no site com `@phosphor-icons/react` (já é dependência de `apps/mypet`).

**RLS:**

```sql
alter table public.categorias_ajuda enable row level security;
alter table public.artigos_ajuda enable row level security;

create policy "categorias_ajuda_service_role" on public.categorias_ajuda
  for all to service_role using (true) with check (true);
create policy "artigos_ajuda_service_role" on public.artigos_ajuda
  for all to service_role using (true) with check (true);

-- Leitura pública (anon) só do que está publicado — usado pela página de
-- apps/mypet caso ela leia com a chave anon em vez de service role.
create policy "artigos_ajuda_leitura_publicada" on public.artigos_ajuda
  for select to anon using (status = 'publicado');
create policy "categorias_ajuda_leitura_publica" on public.categorias_ajuda
  for select to anon using (true);
```

`apps/mypet` decide, na implementação, se lê com `service role` (server-only,
filtrando `status='publicado'` na query, como o resto do app já faz) ou com
`anon` amparado pelas policies acima; ambos os caminhos funcionam com este
schema.

## Admin (`apps/admin`)

Segue exatamente o padrão de `app/(dashboard)/categorias`: Server Components
para leitura, Server Actions com `zod` para escrita, `requireAdminSession()`
em toda página e toda action, `updateTag` do `next/cache` para invalidar.

- **Nav:** adiciona `{ href: "/central-ajuda", label: "Central de Ajuda" }`
  em `NAV` (`app/(dashboard)/layout.tsx`).
- **`/central-ajuda`** — lista de categorias (título, quantos artigos,
  quantos publicados). Form inline para criar categoria (título, descrição,
  ícone via `<select>`, ordem). Link "Editar" por linha; sem exclusão nesta
  primeira versão (só desativar não existe pra categoria — como são fixas,
  editar/reordenar basta).
- **`/central-ajuda/[categoriaId]`** — edita a categoria e lista os artigos
  dela (título, status, ordem), com form para criar artigo novo (nasce como
  `rascunho`).
- **`/central-ajuda/[categoriaId]/[artigoId]`** — formulário completo do
  artigo: título, resumo, corpo (`<textarea>` em Markdown, sem preview),
  palavras-chave, nota interna, ordem, e um toggle publicar/despublicar
  (Server Action separada, tipo `publicarArtigo(id, boolean)`, com
  `updateTag` para revalidar a página pública na hora). Sem exclusão de
  artigo nesta versão — "aposentar" um artigo é voltar o status para
  `rascunho`, que já tira ele do público; a linha continua auditável no
  banco, no mesmo espírito do `ativo` de `comercial.regras_comerciais` no
  Hub.
- **Validação:** `zod` — título e resumo obrigatórios, corpo obrigatório,
  slug gerado a partir do título se não informado (mesma função `slugify` já
  usada em `lib/categories.ts`), unicidade de slug tratada como em
  `createCategory` (`isDuplicateSlugError` → redirect com `?error=`).

## Página pública (`apps/mypet/app/central-de-ajuda`)

Reaproveita o sistema visual existente (`LANDING_STYLES`, classes `pa-*`) em
vez de introduzir uma linguagem visual nova — é uma seção do site, não um
produto à parte.

- **`/central-de-ajuda`** — grade das categorias (ícone, título, descrição),
  na ordem definida no admin.
- **`/central-de-ajuda/c/[categoriaSlug]`** — lista dos artigos publicados da
  categoria (título + resumo), na ordem definida no admin. Categoria sem
  nenhum artigo publicado mostra estado vazio, não 404.
- **`/central-de-ajuda/a/[artigoSlug]`** — artigo: título, corpo renderizado
  de Markdown para HTML (biblioteca `marked`, dependência nova em
  `apps/mypet` — não existe conversor de Markdown no monorepo hoje), e um
  link "Veja também" para os outros artigos da mesma categoria. Artigo em
  rascunho responde 404 nesta rota (não é gerado em `generateStaticParams`
  nem aceito em busca direta pela URL).
- **`/central-de-ajuda/busca`** — formulário GET simples (`?q=`), busca no
  servidor com `ilike` em `titulo`, `resumo`, `palavras_chave` e
  `corpo_markdown` dos artigos publicados, sem JS de busca instantânea —
  consistente com o resto do site, que é todo server-rendered sem ilhas de
  busca ao vivo.
- **Metadata:** `generateMetadata` por página usando `titulo`/`resumo` do
  artigo ou da categoria, com `canonicalUrl` (`@mypet/core/seo`), no mesmo
  padrão de `/perguntas-frequentes`.
- **Navegação:** adiciona um link para `/central-de-ajuda` onde fizer sentido
  no layout público (rodapé e/ou página de `/perguntas-frequentes`, que
  passa a poder linkar para a central sem ser substituída por ela).

## Seed de conteúdo

Uma migration única insere as 11 categorias e os 48 artigos do protótipo
revisado em 2026-09-23 (Artifact `central-de-ajuda-mypet.html`), convertendo
o corpo de cada artigo de HTML para Markdown equivalente (parágrafos, listas,
tabelas, negrito, links) e movendo o campo `rev` de cada artigo (onde
existia) para `nota_interna`. Todos os 48 nascem como `status = 'rascunho'`,
para o dono revisar e publicar aos poucos pelo admin — nenhum vai ao ar
sozinho com a migration.

A tabela abaixo é o mapeamento categoria → ícone → quantidade de artigos, que
a migration segue:

| Categoria | slug | ícone | artigos |
|---|---|---|---|
| Primeiros passos | `primeiros-passos` | `flag` | 4 |
| Cadastro e acesso | `cadastro` | `user` | 4 |
| Catálogo e produtos | `catalogo` | `box` | 5 |
| Preços, mínimo e descontos | `precos` | `tag` | 5 |
| Como fazer um pedido | `pedido` | `cart` | 5 |
| Pagamento | `pagamento` | `card` | 5 |
| Frete e entrega | `entrega` | `truck` | 5 |
| Show Room | `loja` | `store` | 4 |
| Trocas e problemas | `trocas` | `swap` | 5 |
| Notas fiscais | `notas` | `receipt` | 2 |
| Parcerias | `parcerias` | `hands` | 4 |

## Testes

- `lib/categories.ts`/equivalente para ajuda: função de `slugify` e
  unicidade já tem teste (`categories.test.ts`); artigos usam a mesma
  função, sem teste novo necessário além do que cobre a Server Action.
- Teste de integração leve nas Server Actions de criar/editar/publicar
  artigo (padrão dos `*.test.ts` já existentes em `apps/admin/lib`).
- Teste da rota de busca: `ilike` retorna artigo publicado e não retorna
  rascunho.
- Sem teste de renderização de Markdown em si (biblioteca de terceiro já
  testada); um teste de snapshot simples garante que a página do artigo
  renderiza título + corpo sem erro.

## Achado à parte (Supabase Advisor)

O projeto `hub_catalogo` tem RLS **desabilitado** em duas tabelas hoje:
`public._prisma_migrations` e `public.product_channel_prices` — expostas à
chave anon. Não é meu escopo aqui e não mexo nisso nesta spec, mas o dono
precisa saber e decidir a política de acesso antes de habilitar.
