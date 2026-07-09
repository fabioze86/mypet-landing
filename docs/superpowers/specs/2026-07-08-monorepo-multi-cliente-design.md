# Reestruturação em monorepo: core + apps por cliente

**Data:** 2026-07-08
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

O `mypet-landing` hoje é um único app Next.js para um único cliente (My Pet Brasil):
catálogo (via Supabase `hub_catalogo`), gate de leads e fluxo de cotação consolidada
(carrinho → WhatsApp). Não há login, checkout de pagamento nem painel administrativo.

Surgiu um segundo cliente real: **Distribuidora Petshop**
(`www.distribuidorapetshop.com.br`), que deve vender um **subconjunto diferente** do
mesmo catálogo de produtos (ex.: enquanto a mypet vende A–F, a distribuidora vende
C, D, O, J, K...). O objetivo desta entrega é reestruturar o repositório para que o
código comum (catálogo, carrinho, cotação, componentes) seja compartilhado entre os
dois clientes, e cada cliente tenha apenas o que é próprio (marca, tema, domínio,
canal de produtos).

### Estado real relevante (verificado em 2026-07-08)

- O projeto Supabase `hub_catalogo` (ref `hsguyfiyqpuligijcjlw`) já tem uma tabela
  `product_channel_links` com um enum `channel_kind` que **já inclui** os valores
  `mypetbrasil`, `amazon`, `mercadolivre` e `distribuidora`. Essa tabela foi construída
  para outra finalidade (sincronização de conteúdo com marketplaces — campos como
  `mkx_product_id`, `recon_state`, `sync_status`, `content_hash`), não para controlar a
  vitrine da landing.
- Hoje existem **5.367 vínculos**, todos com `channel = 'mypetbrasil'`; **nenhum** com
  `channel = 'distribuidora'`. O campo `is_active` dessa tabela está `false` em 100%
  das linhas (inclusive para `mypetbrasil`, que está em produção) — ou seja, esse
  campo não reflete visibilidade na vitrine e não deve ser usado para isso.
- Existe também uma tabela `brands` (paleta, logo, fonte, `storefront_url`) pensada
  para multi-marca, mas está **vazia** hoje. O tema atual da mypet está fixo em
  [`lib/theme.ts`](../../../lib/theme.ts) (`PALETTE`) e o nome/tagline estão fixos em
  [`app/layout.tsx`](../../../app/layout.tsx) e
  [`components/site-nav.tsx`](../../../components/site-nav.tsx).
- `lib/catalog.ts` hoje consulta `products` diretamente (`status = 'active'`), sem
  nenhum filtro por canal.
- Não há paleta/logo definidos para a Distribuidora ainda — nasce com uma paleta
  neutra provisória, substituível depois.
- O destino dos leads da Distribuidora (mesma planilha Google, aba separada, ou
  planilha própria) ainda não foi decidido — fica configurável por variável de
  ambiente, decisão de produto adiada.

## Decisões tomadas

| Tema | Decisão |
|------|---------|
| Ferramenta de monorepo | pnpm workspaces, **sem Turborepo** por enquanto (2 apps pequenos não justificam pipeline de cache; pode ser adicionado depois sem retrabalho) |
| Granularidade de pacotes | Um único `packages/core` (catálogo, carrinho, leads, whatsapp, tema, componentes). Nada de `ui`/`checkout`/`admin` separados agora — esse código não existe ainda |
| Origem da visibilidade por canal | Reaproveitar `product_channel_links.channel`, ignorando `is_active` (pertence a outra ferramenta). Visibilidade = **existência de um vínculo** para aquele canal |
| Compatibilidade da mypet | A mypet passa a exigir vínculo explícito também (`channel = 'mypetbrasil'`), mas como os 5.367 produtos já têm esse vínculo, o catálogo dela **não muda** |
| Catálogo da distribuidora | Nasce vazio; população de `product_channel_links` para `channel = 'distribuidora'` é um pré-requisito de dados no Hub, fora do escopo de código desta entrega |
| Tema da distribuidora | Paleta neutra provisória em `client.config.ts`, substituível quando a marca real existir |
| Destino dos leads da distribuidora | Configurável por variável de ambiente por app; decisão de produto adiada |
| Deploy | Dois projetos Vercel (um por app), cada um com seu domínio e variáveis de ambiente próprias |

## Escopo

### Nesta entrega

- Migrar o repositório para pnpm workspaces com `apps/mypet`, `apps/distribuidora` e
  `packages/core`, preservando o comportamento atual da mypet em cada etapa.
- Extrair para `packages/core`: `catalog.ts`, `catalog-utils.ts`, `cart.ts`, `leads.ts`,
  `whatsapp.ts`, `querystring.ts`, `supabase.ts`, tipos de tema, e os componentes
  compartilhados (`site-nav`, `cart-provider`, `cart-badge`, `product-card`,
  `catalog-section`, `lead-gate`, `add-to-cart-control`).
- Introduzir `client.config.ts` por app (nome, tagline, domínio, `catalogChannel`,
  paleta, logo) e um `ThemeProvider`/`useTheme()` em `packages/core` para eliminar o
  `PALETTE` fixo dos componentes compartilhados.
- Atualizar `getCatalog`/`getBrands`/`getProductById` em `packages/core/src/catalog.ts`
  para filtrar por `channel` via join com `product_channel_links`.
- Criar `apps/distribuidora` como novo app funcional (mesmas rotas: `/`,
  `/produtos/[id]`, `/cotacao`), com paleta neutra provisória e domínio
  `www.distribuidorapetshop.com.br`.
- Mover os testes vitest existentes junto com seus módulos para `packages/core`, sem
  alterar seu conteúdo, e adicionar um caso para o filtro por `channel`.

### Fora de escopo (fases futuras)

- Login, checkout de pagamento e painel administrativo (não existem hoje em nenhum
  cliente).
- Popular `product_channel_links` para `channel = 'distribuidora'` no Hub (tarefa de
  dados, não de código — pré-requisito para a distribuidora ter produtos visíveis).
- Definir marca/paleta/logo real da Distribuidora.
- Decidir o destino definitivo dos leads da Distribuidora (planilha própria vs. aba
  separada vs. banco).
- Configuração dos dois projetos Vercel (domínios, variáveis de ambiente) — passo
  operacional fora do repositório.
- Turborepo, pacotes adicionais (`ui`, `checkout`, `admin`), feature flags — só quando
  houver código real que justifique a divisão.

## Arquitetura

```
mypet-landing/                 (repo raiz)
├── apps/
│   ├── mypet/
│   │   ├── app/                 ← rotas atuais (/, /produtos/[id], /cotacao, /api/leads)
│   │   ├── public/
│   │   ├── client.config.ts     ← name, tagline, domain, catalogChannel, palette, logo
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── distribuidora/
│       ├── app/                 ← mesmas rotas
│       ├── public/
│       ├── client.config.ts
│       ├── next.config.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── core/
│       ├── src/
│       │   ├── catalog.ts, catalog-utils.ts
│       │   ├── cart.ts
│       │   ├── leads.ts
│       │   ├── whatsapp.ts
│       │   ├── querystring.ts
│       │   ├── supabase.ts
│       │   ├── theme.ts         ← tipos de Palette + ThemeProvider/useTheme
│       │   └── components/      ← site-nav, cart-provider, cart-badge, product-card,
│       │                           catalog-section, lead-gate, add-to-cart-control
│       ├── package.json
│       └── tsconfig.json
├── pnpm-workspace.yaml
├── package.json                 ← scripts raiz (pnpm -r / --filter)
└── ARCHITECTURE.md / AGENTS.md  ← atualizados para descrever o monorepo
```

Cada app é um projeto Next.js independente (próprio `next.config`, `package.json`,
build e deploy próprios), importando `@mypet/core` via workspace do pnpm. Uma correção
em `packages/core` beneficia os dois apps na próxima vez que cada um for rebuildado —
os deploys continuam independentes, não simultâneos automaticamente.

### `client.config.ts`

```ts
export const clientConfig = {
  name: "My Pet Brasil",
  tagline: "Atacado B2B",
  domain: "mypetbrasil.com.br",
  catalogChannel: "mypetbrasil", // chave em product_channel_links.channel
  palette: { pink: "#E5197A", /* ... */ },
  logo: { emoji: "🐾" },
};
```

`packages/core` nunca importa um `client.config.ts` específico. Cada app injeta o seu
via `ThemeProvider` no `layout.tsx` e passa `catalogChannel` para as funções de
catálogo.

### Filtro de catálogo por canal

`getCatalog`, `getBrands` e `getProductById` passam a receber `channel` como parâmetro
obrigatório e fazem `products` ⋈ `product_channel_links` (`eq('channel', channel)`),
sem depender de `is_active`. Como todos os 5.367 produtos já têm vínculo
`mypetbrasil`, o catálogo da mypet não muda. O catálogo da distribuidora começa vazio
até o vínculo `channel = 'distribuidora'` ser populado no Hub (fora do código).

### Tema compartilhado

`packages/core` expõe um `ThemeProvider`/`useTheme()`. Os componentes compartilhados
trocam o import direto de `PALETTE` por `useTheme()`, recebendo a paleta do
`client.config.ts` do app em uso. `layout.tsx` e `site-nav.tsx` deixam de ter
nome/tagline/logo fixos, recebendo-os via `client.config.ts`.

## Fluxo de dados (catálogo, por app)

```
Visitante → apps/{app}/app/page.tsx (Server Component, lê searchParams)
          → @mypet/core getCatalog({ q, brand, page, channel: clientConfig.catalogChannel })
          → @mypet/core supabase.ts (anon key do Hub — mesmo projeto para os dois apps)
          → Supabase hub_catalogo: products ⋈ product_channel_links (channel = X) ⋈
            product_assets ⋈ product_badges
          ← items + total + badges (só produtos vinculados ao canal do app)
          → render da grade, com paleta/marca do client.config.ts do app
```

## Estratégia de migração

1. Criar o esqueleto do monorepo (`pnpm-workspace.yaml`, `packages/core`,
   `apps/mypet`) e mover o código atual para dentro de `apps/mypet` **sem alterar
   comportamento** — build e testes devem passar de forma idêntica antes de qualquer
   extração.
2. Extrair `lib/*` e os componentes compartilhados para `packages/core`, com
   `apps/mypet` importando de `@mypet/core`. Validar que a mypet continua idêntica.
3. Introduzir `client.config.ts` na mypet (extrair nome/paleta/canal do que hoje está
   hardcoded), validar novamente.
4. Escrever `apps/distribuidora` a partir do template da mypet, com seu próprio
   `client.config.ts` (paleta neutra provisória, canal `distribuidora`, domínio
   `www.distribuidorapetshop.com.br`).
5. Atualizar `packages/core/src/catalog.ts` para filtrar por `channel`.
6. **Fora do código:** popular `product_channel_links` no Hub para os produtos da
   distribuidora, e configurar dois projetos Vercel (um por app, `root directory`
   apontando para `apps/mypet` e `apps/distribuidora`), cada um com seu domínio e
   variáveis de ambiente.

Cada etapa é validável isoladamente (`npm run lint`, build, suíte vitest), reduzindo o
risco de quebrar a mypet em produção durante a migração.

## Tratamento de erros e casos de borda

- **Canal sem produtos vinculados** (caso inicial da distribuidora): `getCatalog`
  retorna lista vazia — a UI já trata isso hoje (estado vazio / mensagem de catálogo
  indisponível), sem necessidade de tratamento novo.
- **`client.config.ts` ausente ou incompleto:** deve falhar no build (erro de tipo do
  TypeScript), não em runtime — preferível a um app subir com tema quebrado ou canal
  indefinido.
- **Hub indisponível:** mantém o comportamento já existente de `getCatalog`
  (cache "stale" via `use cache` quando houver; lista vazia + log quando não houver).

## Estratégia de testes

- Os testes atuais (`cart.test.ts`, `catalog-utils.test.ts`, `catalog.test.ts`,
  `leads.test.ts`, `querystring.test.ts`, `whatsapp.test.ts`) migram para
  `packages/core` junto dos seus módulos, sem alteração de conteúdo além do necessário
  para os novos imports.
- `catalog.test.ts` ganha um caso novo cobrindo o filtro por `channel` (query inclui o
  join com `product_channel_links` e o parâmetro é obrigatório).
- Verificação manual via `/run`: mypet continua mostrando o catálogo completo após a
  migração; distribuidora sobe com catálogo vazio (esperado, até a população de dados
  no Hub) sem quebrar a página.

## Riscos e mitigações

- **Quebrar a mypet em produção durante a migração:** mitigado pela ordem incremental
  da migração (mover → extrair → configurar), validando build/lint/testes a cada
  etapa antes de prosseguir.
- **Confundir `is_active` de `product_channel_links` com visibilidade de vitrine:**
  mitigado por não usar esse campo — a regra é apenas a existência do vínculo para o
  canal.
- **Distribuidora no ar sem produtos:** é esperado nesta entrega; o catálogo populado
  depende de uma tarefa de dados separada no Hub, fora deste escopo.
- **Deriva de tema entre apps:** mitigado pelo `ThemeProvider`/`useTheme()` centralizado
  em `packages/core` — nenhum componente compartilhado importa uma paleta fixa.
