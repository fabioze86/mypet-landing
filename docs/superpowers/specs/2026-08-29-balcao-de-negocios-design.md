# Balcão de Negócios — negociação de preço por volume (apps/mypet)

**Data:** 2026-08-29
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

A My Pet Brasil (canal `mypetbrasil`) vende B2B e a loja exibe **um preço estático por
produto**, igual para todos, independente da quantidade. A equipe recebe muito contato
de leads querendo comprar em grande volume, e responder/negociar caso a caso é inviável
— boa parte não converte. Hoje não existe carrinho com preço fechado: `/cotacao` gera
um `orders` sem preço e a equipe cota manual por WhatsApp depois.

O **Balcão de Negócios** é um módulo dentro da loja (área interna, cliente logado) que
automatiza a parte repetitiva: para categorias/SKUs selecionados, apresenta faixas de
desconto por quantidade e uma vantagem logística fixa, deixa o cliente montar uma
solicitação com estimativa transparente e a envia para **validação comercial**. A
condição só vale depois que a equipe aprova. O objetivo é filtrar e qualificar o lead
de volume antes de gastar tempo humano, sem prometer margem antes de validar.

Esta entrega cobre **apenas `apps/mypet`** (canal `mypetbrasil`). O schema é
channel-keyed para estender a `distribuidora`/`madpet` depois sem migração.

### Estado real verificado (2026-08-29)

- **Preço do `mypetbrasil` vem do espelho Bling.** `getCatalog()` / `getProductById()`
  em `packages/core/src/catalog.ts` resolvem o preço via `channelUsesErpPrice(channel)`
  → `fetchErpPrices()` (view `v_precos_erp`, indexada por `reference`) →
  `applyErpPrice()`. Os demais canais usam `product_channel_prices.sale_price`
  (`salePriceFromChannelPrices`). Catálogo é cacheado com `"use cache"` +
  `cacheLife("days")` + tag `"catalog"`, chave por canal.
- **Admin é único (mono-repo):** `apps/admin` (Next.js App Router, deploy próprio),
  conecta só ao Supabase `hub_catalogo` (`hsguyfiyqpuligijcjlw`). Auth Supabase +
  tabela `admin_users`; middleware protege todas as rotas. Mutações via Server Actions,
  validação zod. Módulos atuais: Clientes (leads), Categorias, Pedidos, Funcionalidades
  (leitura), Marketing → Banners. Precedente de módulo channel-keyed com seletor de
  canal desabilitado: `/precos` (spec 2026-08-28).
- **Comprador no `apps/mypet`:** sessão por cookie HMAC, `requireBuyer()` em
  `apps/mypet/lib/require-buyer.ts`. Tabela `buyers` compartilhada (id uuid, identidade
  por CNPJ). Rotas `/entrar`, `/completar-cadastro`, `/cotacao`, `/pedidos`.
- **`orders` / `order_items` não têm nenhum campo de preço.** `createOrder()`
  (`packages/core/src/orders-server.ts`) grava `orders(buyer_id, channel,
  status='pendente')` + `order_items(product_id, product_name_snapshot, qty)`. `CartItem`
  (`packages/core/src/cart.ts`) também não tem preço. Logo, o Balcão precisa de tabelas
  próprias para o snapshot — não dá para pendurar em `orders`.
- **RLS:** padrão do repo para tabelas novas é RLS ligado desde a criação (anon key só
  `SELECT` no que o site público precisa; admin autenticado via `auth.uid() IN (SELECT
  id FROM admin_users)` tem acesso completo). Mesmo padrão de `leads`, `banners`,
  `regional_price_rules`.
- **Propagação de cache entre `apps/admin` e `apps/mypet`:** limitação já aceita
  (banners, categorias, `/precos`). `updateTag` invalida só o cache do app que chamou.

## Decisões do brainstorming

| Pergunta | Decisão |
| --- | --- |
| MVP automático ou sob validação? | **Sob validação** — estimativa + aprovação comercial. A condição só vale após aprovação. |
| Administração das regras | **Painel admin** (`apps/admin`), sem depender de dev. |
| Vantagem logística | **Desconto fixo de 5%**, fora da config comercial (constante no código). |
| Opções logísticas na solicitação | **Retirada** e **frete por conta do cliente** apenas. Não existe "MyPet cota o frete". |
| Habilitar categoria | Vale para todos os produtos atuais **e futuros** da categoria, com exclusão explícita de SKUs. |
| Regra de SKU vs categoria | Regra de SKU tem **prioridade** sobre a da categoria. |
| Faixas | Configuráveis por regra: `min_qty` + `discount_pct`. Percentual sobre o preço-base (o ERP pode atualizar o preço sem defasar a regra). |
| Como a faixa é atingida | **Por SKU** — cada item olha só a própria quantidade. |
| Composição dos descontos | **Multiplicativo em cascata**: `base × (1 − volume%) × (1 − 5%)`. |
| O que acontece após aprovação | **Só contato manual** — sistema registra + notifica a equipe pelo painel; equipe fecha por fora. Sem "virar pedido", sem preço travado em `/pedidos`. |
| Notificação da equipe | **Só no painel** — solicitação aparece na lista com status "enviada". Sem e-mail/push no MVP. |
| Retorno ao cliente | **Só tela de confirmação.** Nada persistente na loja. |
| Piso para enviar | **Precisa atingir pelo menos uma faixa** — botão de enviar só habilita se ≥ 1 item alcança a menor faixa configurada. |
| Snapshot | Fotografia imutável por solicitação (preço-base, faixa, descontos, unitário/total estimados, itens, comprador, logística). |
| Expiração | Status manual (`expirada`) pela equipe. Sem cron no MVP. |

## Arquitetura

Três frentes, ligadas pelas tabelas novas em `hub_catalogo`:

1. **`packages/core/src/balcao.ts`** (novo) — fetch cacheado das regras + funções puras
   de cálculo. Compartilhado entre o site e (leitura de prévia) o admin.
2. **`apps/mypet`** — área `/balcao` (cliente logado): página do Balcão, montagem da
   solicitação, cálculo da estimativa no cliente, envio via Server Action, tela de
   confirmação. Selo nos cards/PDP dos produtos elegíveis.
3. **`apps/admin`** — módulo "Balcão de Negócios": CRUD de regras/faixas/exclusões +
   fila de solicitações com ciclo de status e histórico.

O preço-base **não é duplicado**: o site resolve pelo mesmo caminho do catálogo
(ciente do canal — espelho Bling para `mypetbrasil`) e o valor resolvido é gravado no
snapshot no momento do envio.

### `packages/core/src/balcao.ts`

- `getBalcaoRules(channel): Promise<BalcaoRule[]>` — busca regras + faixas ativas e
  vigentes (`active = true`, `starts_at`/`ends_at` cobrindo agora). `"use cache"` +
  `cacheLife("days")` + `cacheTag("balcao")` (tag própria, separada de `"catalog"` —
  mexer em faixa não invalida o catálogo).
- `resolveRuleForProduct(rules, { productReference, categoryId }): BalcaoRule | null` —
  puro. Precedência: regra `scope='sku'` com `product_reference` igual → regra
  `scope='categoria'` com `category_id` igual → `null`. Uma regra de SKU com
  `excluded = true` devolve `null` (exclusão dentro de categoria habilitada).
- `resolveTier(tiers, qty): BalcaoTier | null` — puro. Maior `min_qty <= qty`; `null`
  se `qty` abaixo da menor faixa.
- `computeLine({ basePrice, volumePct, logisticsApplies }): { unitPrice: number;
  volumePct: number; logisticsPct: number }` — puro. `unitPrice = round2(basePrice × (1
  − volumePct/100) × (1 − (logisticsApplies ? LOGISTICS_DISCOUNT_PCT : 0)/100))`.
  `round2(n) = Math.round(n * 100) / 100`.
- `LOGISTICS_DISCOUNT_PCT = 5` — constante exportada, **não** vem do banco.
- `qualifiesForSubmit(lines): boolean` — puro. `true` se ao menos uma linha tem
  `tier !== null`.

### `apps/mypet` — área `/balcao`

- **`/balcao`** (server component): `requireBuyer()`; sem comprador → `redirect("/entrar")`.
  Carrega `getBalcaoRules(channel)` e a lista de produtos elegíveis (produtos cujo
  `category_id` tem regra de categoria ativa e sem exclusão, ou que têm regra de SKU
  ativa). Renderiza a página do Balcão com as categorias/produtos elegíveis e as faixas.
- **Montagem da solicitação** (client): o cliente adiciona linhas `{ productId, qty }`
  a partir dos elegíveis. Para cada linha, `resolveRuleForProduct` + `resolveTier` +
  `computeLine` rodam no cliente para mostrar faixa atingida, preço unitário estimado e
  economia (vs. preço-base). Toggle **retirada / frete próprio** recalcula os 5%. Campo
  de observação opcional. Botão "Enviar solicitação" habilita só quando
  `qualifiesForSubmit`.
- **Envio** — Server Action `submitBalcaoRequest(input)` em
  `apps/mypet/app/balcao/actions.ts`:
  - `requireBuyer()` de novo (nunca confia no cliente); `channel` vem do
    `client.config.ts`.
  - **Recalcula tudo no servidor** a partir das regras e do preço-base resolvido
    naquele instante (a estimativa do cliente é descartável). Rejeita se algum
    `productId` não é elegível ou se `qualifiesForSubmit` é `false`.
  - Grava `balcao_requests` + `balcao_request_items` (snapshot) + primeiro
    `balcao_request_events` (`action = 'criada'`), via `getHubServiceClient()`.
  - Retorna `{ ok: true }` → tela de confirmação. Sem persistência de acompanhamento no
    site.
- **Selo nos produtos elegíveis**: card e PDP mostram um selo "Balcão de Negócios" com
  link para `/balcao`. A decisão de elegibilidade usa `resolveRuleForProduct` com as
  regras já carregadas no server component pai.
- Texto fixo na página e na confirmação: *"Condição sujeita à validação de estoque,
  margem e disponibilidade."*

### `apps/admin` — módulo "Balcão de Negócios"

Novo item de sidebar. Cabeçalho "Canal: My Pet Brasil" com seletor de canal
renderizado desabilitado (padrão de `/precos`).

- **Regras** (`/balcao/regras`):
  - Lista de regras (categoria e SKU), com vigência e status.
  - Criar/editar regra de **categoria**: escolhe a categoria, define faixas (`min_qty` +
    `discount_pct`), vigência opcional, ativar/desativar.
  - Criar/editar regra de **SKU**: escolhe o produto (por referência), faixas próprias,
    vigência, ativar/desativar. Sobrepõe a regra da categoria do produto.
  - **Excluir SKU** de uma categoria habilitada: cria regra de SKU com `excluded =
    true` (sem faixas).
  - **Prévia**: dado um produto e uma quantidade, mostra preço-base atual do ERP, faixa
    atingida, desconto de volume, +5% logístico (cascata) e unitário estimado.
  - Server Actions (`createRule`, `updateRule`, `deleteRule`, `upsertTiers`,
    `setExcluded`) com validação zod: `discount_pct` número `>= 0`; `min_qty` inteiro
    `>= 1`; faixas de uma regra com `min_qty` únicos; categoria/produto em lista
    fechada. Toda mutação chama `updateTag("balcao")`.
- **Solicitações** (`/balcao/solicitacoes`):
  - Lista paginada com filtro por status (`enviada`, `em_analise`, `aprovada`,
    `ajustada`, `recusada`, `expirada`) e busca por comprador.
  - Detalhe: snapshot completo — comprador (do `buyer_snapshot`), logística,
    observação, e por item: preço-base, faixa (`tier_min_qty_snapshot`), `%` de volume,
    `%` logístico, unitário e total estimados; total geral da solicitação.
  - Ações: **aprovar** a estimativa; **ajustar** (editar preço/qtd por linha com
    justificativa obrigatória → status `ajustada`); **recusar** (com motivo); marcar
    **expirada**. Cada ação grava um `balcao_request_events` com `actor = auth.uid()`.
  - O snapshot original em `balcao_request_items` **nunca** é sobrescrito; ajustes
    ficam no `payload` do evento (auditoria).

## Modelo de dados (novas tabelas em `hub_catalogo`, RLS ligado na criação)

### `balcao_rules`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | PK, `gen_random_uuid()` |
| `channel` | channel enum | `mypetbrasil` nesta entrega |
| `scope` | text | `categoria` \| `sku` |
| `category_id` | uuid nullable | FK `categories.id`; obrigatório quando `scope='categoria'` |
| `product_reference` | text nullable | referência (SKU) do produto; obrigatório quando `scope='sku'` |
| `excluded` | boolean | default `false`; `true` só faz sentido em `scope='sku'` (exclui da categoria habilitada) |
| `active` | boolean | default `true` |
| `starts_at` / `ends_at` | timestamptz nullable | vigência opcional |
| `created_at` / `updated_at` | timestamptz | default `now()` |

- `CHECK ((scope='categoria' AND category_id IS NOT NULL AND product_reference IS NULL)
  OR (scope='sku' AND product_reference IS NOT NULL AND category_id IS NULL))`.
- `CHECK (NOT excluded OR scope='sku')`.
- `UNIQUE (channel, scope, category_id, product_reference)`.

### `balcao_rule_tiers`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | PK |
| `rule_id` | uuid | FK `balcao_rules.id` `ON DELETE CASCADE` |
| `min_qty` | int | `>= 1` |
| `discount_pct` | numeric | `>= 0` (ex.: `12.00` = 12%) |

- `UNIQUE (rule_id, min_qty)`.
- Regra `excluded = true` não tem faixas.

### `balcao_requests`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | PK |
| `buyer_id` | uuid | FK `buyers.id` |
| `channel` | channel enum | `mypetbrasil` |
| `logistics` | text | `retirada` \| `frete_proprio` |
| `note` | text nullable | observação do cliente |
| `status` | text | `enviada` \| `em_analise` \| `aprovada` \| `ajustada` \| `recusada` \| `expirada`; default `enviada` |
| `buyer_snapshot` | jsonb | `{ nome, empresa, whatsapp, cnpj }` no momento do envio |
| `total_estimated` | numeric | soma de `line_total_estimated` no envio |
| `created_at` / `updated_at` | timestamptz | default `now()` |

- `CHECK (logistics IN ('retirada','frete_proprio'))`.
- `CHECK (status IN ('enviada','em_analise','aprovada','ajustada','recusada','expirada'))`.

### `balcao_request_items` (imutável após o envio)

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | PK |
| `request_id` | uuid | FK `balcao_requests.id` `ON DELETE CASCADE` |
| `product_id` | uuid | id do produto |
| `product_reference` | text | referência (SKU) no envio |
| `product_name_snapshot` | text | nome no envio |
| `qty` | int | `>= 1` |
| `base_price_snapshot` | numeric | preço-base resolvido no envio |
| `tier_min_qty_snapshot` | int nullable | faixa atingida (`null` se nenhuma) |
| `volume_discount_pct_snapshot` | numeric | `%` de volume aplicado (`0` se nenhuma faixa) |
| `logistics_discount_pct_snapshot` | numeric | `5` ou `0` |
| `unit_price_estimated` | numeric | unitário após cascata |
| `line_total_estimated` | numeric | `unit_price_estimated × qty` |

### `balcao_request_events`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | PK |
| `request_id` | uuid | FK `balcao_requests.id` `ON DELETE CASCADE` |
| `actor` | uuid nullable | `admin_users.id`; `null` quando o próprio sistema/cliente cria |
| `action` | text | `criada` \| `em_analise` \| `aprovada` \| `ajustada` \| `recusada` \| `expirada` |
| `payload` | jsonb nullable | justificativa, ajustes por linha, motivo de recusa |
| `created_at` | timestamptz | default `now()` |

### RLS

- **`balcao_rules` / `balcao_rule_tiers`**: anon key `SELECT` liberado (o site lê as
  regras para calcular a estimativa e marcar elegibilidade); nunca `INSERT`/`UPDATE`/
  `DELETE`. Admin autenticado: acesso completo.
- **`balcao_requests` / `balcao_request_items` / `balcao_request_events`**: sem acesso
  anon. Escrita do site é feita com `getHubServiceClient()` (service role) dentro da
  Server Action, depois de `requireBuyer()`. Admin autenticado: `SELECT` + `UPDATE` de
  status / `INSERT` de eventos. Sem `SELECT` público — o cliente não acompanha pelo
  site.

## Cálculo — regras de negócio

- **Preço-base** (`base_price_snapshot`): resolvido no servidor, no envio, pelo mesmo
  caminho do catálogo, ciente do canal. `mypetbrasil` → espelho Bling (`v_precos_erp`
  por `reference`). Se o produto não tem preço (`null`), **não é elegível** ao Balcão.
- **Volume**: `resolveTier(tiers, qty)` por SKU. Sem faixa → `volume_discount_pct = 0`.
- **Logística**: `retirada` ou `frete_proprio` → `logistics_discount_pct = 5`; caso
  contrário `0`. (No MVP sempre há uma das duas; o campo existe para o snapshot ser
  autoexplicativo.)
- **Cascata**: `unit = round2(base × (1 − volume/100) × (1 − logistics/100))`.
- **Piso de envio**: `qualifiesForSubmit` exige ≥ 1 linha com faixa. Reforçado no
  servidor.
- **Sem acúmulo** com cupons/promoções — não existem hoje nesse canal; fora do escopo.

## Cache

- Nova tag `"balcao"` para `getBalcaoRules`. Mutações no admin chamam
  `updateTag("balcao")`.
- **Limitação aceita:** `updateTag("balcao")` invalida só o cache do `apps/admin`. O
  `apps/mypet` é deploy separado — mudança de regra/faixa pode levar até o
  `cacheLife("days")` para refletir no site, ou exigir redeploy. Mesma limitação já
  aceita para banners, categorias e `/precos`.

## Escopo

**Dentro:**
- Tabelas `balcao_rules`, `balcao_rule_tiers`, `balcao_requests`,
  `balcao_request_items`, `balcao_request_events` + migração com RLS.
- `packages/core/src/balcao.ts`: fetch cacheado + funções puras + testes.
- `apps/mypet`: área `/balcao` (cliente logado), montagem da solicitação com estimativa,
  Server Action de envio com recálculo no servidor, tela de confirmação, selo nos
  produtos elegíveis, item de navegação.
- `apps/admin`: módulo "Balcão de Negócios" — CRUD de regras/faixas/exclusões com
  prévia, fila de solicitações com ciclo de status, ajuste com justificativa, histórico
  de eventos.

**Fora (YAGNI):**
- Desconto automático no carrinho / checkout com preço fechado.
- "Virar pedido" / preço travado em `/pedidos` / integração com `orders`.
- Área de acompanhamento da solicitação no site (status para o cliente).
- E-mail ou push para a equipe.
- Contador de validade / expiração automática (cron).
- Terceira opção logística ("MyPet cota o frete").
- Outros canais (`distribuidora`, `madpet`) — schema já é channel-keyed.
- Acúmulo/interação com cupons e promoções.
- Propagação de cache entre `apps/admin` e `apps/mypet`.
- Permissão por papel no admin (qualquer `admin_users` tem acesso completo, como nos
  outros módulos).

## Limitações conhecidas (aceitas nesta entrega)

- **Propagação de cache entre apps** (acima).
- **Estimativa ≠ compromisso:** o texto deixa explícito que a condição depende de
  validação; o cálculo no cliente é só orientativo e é descartado no servidor.
- **Elegibilidade depende de `reference`:** regras de SKU usam a referência do produto;
  produto sem `reference` não pode ter regra de SKU (só entra por categoria).
- **Expiração manual:** solicitações antigas não expiram sozinhas; a equipe marca
  `expirada`.
- **Sem `SELECT` público das solicitações:** se no futuro o cliente for acompanhar pelo
  site, será preciso política de RLS por `buyer_id` (a sessão do `apps/mypet` é cookie
  HMAC, não Supabase Auth — provavelmente via Server Action com service role, como no
  `/pedidos`).

## Testes mínimos por mudança

Além de `npm run lint` e `npm run build`:

- **Unit `resolveRuleForProduct`:** regra de SKU vence a de categoria; `excluded=true`
  devolve `null`; sem regra devolve `null`.
- **Unit `resolveTier`:** maior `min_qty <= qty`; abaixo da menor faixa → `null`;
  igualdade exata na faixa conta.
- **Unit `computeLine`:** cascata multiplicativa; arredondamento a centavos;
  `logisticsApplies=false` ignora os 5%; `volumePct=0` sem faixa.
- **Unit `qualifiesForSubmit`:** `false` sem nenhuma faixa; `true` com ≥ 1.
- **Server Action `submitBalcaoRequest`:** sem comprador → erro `needsAuth`; produto
  não elegível → rejeitado; sem faixa em nenhuma linha → rejeitado; caminho feliz grava
  `balcao_requests` + itens + evento `criada` e devolve `ok`; snapshot usa o preço-base
  resolvido no servidor, não o enviado pelo cliente.
- **Admin regras:** criar regra de categoria com faixas; `discount_pct` negativo
  rejeitado; `min_qty` duplicado na mesma regra rejeitado; regra de SKU sobrepõe a de
  categoria na prévia; `excluded` remove o produto da elegibilidade; toda mutação
  chama `updateTag("balcao")`.
- **Admin solicitações:** aprovar muda status e grava evento; ajustar exige
  justificativa e grava `payload`; recusar exige motivo; `balcao_request_items` não é
  alterado por ajuste.
- **Site:** produto elegível mostra selo e entra no `/balcao`; produto não elegível
  não; produto sem preço não é elegível; botão de envio desabilitado sem faixa;
  confirmação exibida após envio.

## Próximos passos

1. Revisão deste spec pelo usuário.
2. Plano de implementação (`writing-plans`), provavelmente em fatias:
   (a) migração das 5 tabelas + RLS;
   (b) `packages/core/src/balcao.ts` (fetch cacheado + puros) com testes;
   (c) módulo "Balcão de Negócios" no `apps/admin` (regras + prévia);
   (d) fila de solicitações no `apps/admin` (status + ajuste + histórico);
   (e) área `/balcao` no `apps/mypet` (montagem + estimativa + Server Action + confirmação);
   (f) selo de elegibilidade nos cards/PDP + item de navegação.
