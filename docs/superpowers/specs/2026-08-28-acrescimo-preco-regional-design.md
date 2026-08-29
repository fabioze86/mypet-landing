# Acréscimo de preço regional (capital/interior) — apps/mypet

**Data:** 2026-08-28
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

A My Pet Brasil vende B2B para todo o país. O custo de atender um cliente varia por
região (frete, principalmente), então o mesmo produto não pode ter o mesmo preço em
São Paulo e no interior do Rio. Hoje o catálogo mostra um único preço por produto por
canal (`product_channel_prices.sale_price`), populado por um processo fora deste repo,
e **não existe nenhum conceito de UF/região** em lugar nenhum: `buyers` não tem
endereço, `orders` não tem UF nem total, e a mensagem de cotação no WhatsApp não leva
preço — só nome, SKU e quantidade.

O objetivo é permitir que, pelo painel admin, se configure um **percentual de acréscimo
sobre o preço base**, por estado, com cada estado dividido em **capital e interior**. O
cliente escolhe a região no próprio site e passa a ver os preços já ajustados.

Esta entrega cobre **apenas `apps/mypet`** (canal `mypetbrasil`). A estrutura é
channel-keyed para estender a `distribuidora` e `madpet` depois sem mudança de schema.

### Estado real verificado (2026-08-28)

- **Admin é único (mono-repo):** `apps/admin` (Next.js App Router, porta 4103, deploy
  próprio) atende todos os sites, distinguindo-os pelo campo `channel`. Conecta apenas
  ao projeto Supabase `hub_catalogo` (`hsguyfiyqpuligijcjlw`). Módulos atuais: Clientes
  (leads), Pedidos, Categorias, Funcionalidades (somente leitura), Marketing → Banners.
  Não há nenhuma tela de preço.
- **Preço no site:** `getCatalog()` / `getProductById()` em `packages/core/src/catalog.ts`
  trazem `salePrice` (número) e `priceLabel` a partir de `product_channel_prices`,
  cacheados com `"use cache"` + `cacheLife("days")` + tag `"catalog"`, com chave por
  canal.
- **`ProductCard`** (`packages/core/src/components/product-card.tsx`) já é
  `"use client"` e consome `useClientConfig()`. O preço é renderizado por
  `PriceLockSlot` em `packages/core/src/components/lead-gate.tsx`.
- **Cotação:** `apps/mypet` tem carrinho (`useCart`), `/cotacao`, `/pedidos`, auth de
  comprador (`/entrar`, `/completar-cadastro`). `CartItem` (`packages/core/src/cart.ts`)
  **não tem campo de preço**; `buildQuoteMessage` (`packages/core/src/whatsapp.ts`)
  lista só nome/SKU/qtd. A equipe cota manualmente depois.
- **Advisor Supabase:** `product_channel_prices` está com **RLS desabilitado** (exposta
  à anon key). Fora do escopo desta entrega, registrado aqui para decisão futura.

## Decisões do brainstorming

| Pergunta | Decisão |
| --- | --- |
| Como o app sabe a região do cliente? | Cliente seleciona no site (UF + capital/interior), guardado em cookie. |
| Escopo por canal | Só `apps/mypet` (`mypetbrasil`) agora; schema channel-keyed para estender depois. |
| Como preencher os percentuais | Padrão nacional + linhas de exceção por `(UF, capital/interior)`. |
| Abrangência do acréscimo | Percentual único sobre o `sale_price` de qualquer produto. |
| Estado inicial (antes de escolher região) | Exige escolher a região primeiro — preços ficam ocultos/travados. |
| Registro da região na cotação | Só uma linha na mensagem de WhatsApp; sem persistência em `orders`. |
| Conteúdo da mensagem | Só a linha de região + %; preços ajustados aparecem apenas no catálogo/PDP. |

## Arquitetura

Abordagem escolhida: **acréscimo aplicado no cliente**.

- Preço base continua vindo de `getCatalog()` / `getProductById()`, cache por canal
  intacto.
- **`packages/core/src/pricing.ts`** (novo):
  - `getRegionalPricing(channel)` — busca as regras da tabela `regional_price_rules`,
    com `"use cache"` + `cacheLife("days")` + tag própria `"regional-pricing"`
    (separada de `"catalog"`, para não invalidar o catálogo ao mexer em percentual).
  - `resolveSurcharge(rules, uf, area): number` — puro. Precedência: regra exata
    `(uf, area)` → regra padrão nacional (`uf = null, area = null`) → `0`.
  - `applySurcharge(base: number, pct: number): number` — puro. `Math.round(base * (1 +
    pct / 100) * 100) / 100` (arredonda a centavos). `pct = 0` devolve `base`.
- **`RegionPricingProvider`** (client, em `packages/core/src/components/`): recebe as
  regras via prop (resolvidas no server component pai), lê o cookie `mp_region`, expõe
  `{ region, setRegion, surchargePct }` por context (`useRegionPricing()`). Envolve o
  app junto do `LeadGateProvider` na home e na PDP do `apps/mypet`.
- **Cookie `mp_region`**: valor `"<UF>:<area>"` (ex.: `"RJ:interior"`), `Max-Age` ~180
  dias, `SameSite=Lax`, **não** `HttpOnly` (o cliente precisa ler). É a única fonte da
  região — não encosta em `buyers`/`orders`.
- **Admin**: novo módulo `/precos`, canal fixo em `mypetbrasil` (seletor visível porém
  desabilitado, pronto para ativar outros canais).

## Modelo de dados

### Nova tabela `regional_price_rules` (em `hub_catalogo`, RLS habilitado na criação)

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | PK, `gen_random_uuid()` |
| `channel` | channel enum | `mypetbrasil` nesta entrega; outras linhas para outros canais depois |
| `uf` | text nullable | `NULL` = regra padrão nacional |
| `area` | text nullable | `capital` \| `interior`; `NULL` apenas quando `uf` é `NULL` |
| `surcharge_pct` | numeric | `>= 0`; ex.: `8.00` = +8%. Default `0` |
| `updated_at` | timestamptz | default `now()` |

- `UNIQUE (channel, uf, area)`.
- `CHECK ((uf IS NULL AND area IS NULL) OR (uf IS NOT NULL AND area IS NOT NULL))`.
- `CHECK (area IS NULL OR area IN ('capital','interior'))`.
- `CHECK (surcharge_pct >= 0)`.
- Migração cria a linha padrão nacional: `(mypetbrasil, NULL, NULL, 0)`.

### RLS

- Anon key (site público): `SELECT` liberado (o provider resolve as regras com a anon
  key). Nunca `INSERT`/`UPDATE`/`DELETE`.
- Admin autenticado (`auth.uid() IN (SELECT id FROM admin_users)`): acesso completo.
- Mesmo padrão já aplicado a `leads` e `banners`.

## Módulo Admin — `/precos`

Novo item na sidebar do `apps/admin`, abaixo de "Categorias".

- Cabeçalho: "Canal: My Pet Brasil" — seletor de canal renderizado desabilitado.
- **Acréscimo padrão nacional (%)**: campo único que edita a linha `(NULL, NULL)`.
- **Exceções por estado**: tabela com colunas `UF` (select das 27 UFs), `Área`
  (Capital / Interior), `Acréscimo (%)`, botão `Remover`. Linha "＋ Adicionar exceção"
  ao final.
- Server Actions: `updateDefaultRule`, `createRule`, `updateRule`, `deleteRule`. Cada
  uma valida entrada com schema zod antes de tocar o Supabase:
  - `surcharge_pct`: número, `>= 0`.
  - `uf`: valor em lista fechada das 27 UFs.
  - `area`: `capital` | `interior`.
  - `(channel, uf, area)` duplicado → mensagem "Já existe exceção para <UF> – <Área>".
- Toda mutação chama `updateTag("regional-pricing")`.

## Comportamento no site (`apps/mypet` + core)

### Gate de região (bloqueante)

- Sem cookie `mp_region`, todo slot de preço (card e PDP) mostra estado travado:
  "🔒 Selecione sua região para ver os preços" + botão "Escolher região".
- `RegionSelectorModal` (client, em core): select de UF (27) + toggle **Capital /
  Interior**. Ao confirmar, grava o cookie e o app re-renderiza com os preços
  ajustados. Sem chamada ao servidor.
- Indicador fixo no topo do catálogo: "Preços para **RJ – Interior** · alterar" —
  reabre o modal.
- Na primeira visita sem cookie, o `RegionSelectorModal` abre automaticamente como
  overlay bloqueante (com backdrop, sem botão de fechar sem escolher), já que o
  requisito é "exige escolher a região primeiro". O catálogo fica visível atrás, mas
  os preços permanecem travados até a escolha.
- Cookie presente mas com UF fora da lista → tratado como sem região (reabre o modal).

### Cálculo e exibição

- `PriceLockSlot` passa a consumir `useRegionPricing()`: recebe `product.salePrice`
  (número já disponível) e renderiza `applySurcharge(base, pct)` formatado em BRL
  (`Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`).
- Mesmo tratamento na PDP (`apps/mypet/app/produtos/[id]/page.tsx`) e em variantes com
  preço.
- `salePrice === null` → mantém "Preço sob consulta" (comportamento atual), sem gate.

### Mensagem de cotação

- `finalizeQuote` (`apps/mypet/app/cotacao/actions.ts`) lê o cookie `mp_region` no
  servidor e passa um `regionNote` opcional para `buildQuoteMessage`.
- Nova linha na mensagem: `Região de entrega: RJ — Interior (acréscimo aplicado: +8%)`.
  Itens seguem sem preço.
- `buildQuoteMessage` ganha um parâmetro opcional; a assinatura atual continua válida
  para os demais apps.

## Escopo

**Dentro:**
- Tabela `regional_price_rules` + migração com RLS e linha padrão nacional.
- Módulo `/precos` no `apps/admin` (canal fixo `mypetbrasil`).
- `packages/core/src/pricing.ts` (fetch cacheado + helpers puros),
  `RegionPricingProvider`, `RegionSelectorModal`, integração em `PriceLockSlot`.
- Integração no `apps/mypet`: gate na home e na PDP, linha de região na mensagem de
  cotação.

**Fora (YAGNI):**
- Outros canais (`distribuidora`, `madpet`) — estrutura já é channel-keyed; depois é
  inserir linhas e montar o provider nesses apps.
- Variação do acréscimo por categoria/marca/produto; isenção por produto.
- Desconto (percentual é `>= 0`).
- Persistir região em `orders`/`buyers`; preços por item ou total na mensagem.
- Detecção automática de capital por cidade/IP — o cliente declara.
- Propagação de cache entre `apps/admin` e `apps/mypet`.

## Limitações conhecidas (aceitas nesta entrega)

- **Propagação de cache entre apps:** `updateTag("regional-pricing")` invalida apenas o
  cache do `apps/admin`. O `apps/mypet` é deploy Next.js separado, com cache próprio —
  mudanças de percentual podem levar até o `cacheLife("days")` para aparecer no site,
  ou exigir redeploy. Mesma limitação já aceita para banners e categorias no spec do
  painel admin (2026-07-17).
- **RLS de `product_channel_prices`:** permanece desabilitado (fora do escopo). Decisão
  de habilitar com políticas fica para outra entrega.
- **Precisão capital/interior:** depende da declaração honesta do cliente; não há
  validação por CEP/cidade.

## Testes mínimos por mudança

Além de `npm run lint` e `npm run build`:

- **Unit `resolveSurcharge`:** match exato `(uf, area)` vence o padrão; sem match usa o
  padrão nacional; sem padrão → `0`.
- **Unit `applySurcharge`:** arredondamento a centavos; `pct = 0` devolve a base.
- **Admin:** atualizar o padrão nacional; adicionar e remover exceção; `(uf, area)`
  duplicado rejeitado com mensagem; `surcharge_pct` inválido/negativo rejeitado.
- **Site:** sem cookie → preços ocultos + seletor exibido; com cookie → preço ajustado
  no card e na PDP; `salePrice null` → "Preço sob consulta" sem gate; mensagem de
  cotação contém a linha de região.

## Próximos passos

1. Revisão deste spec pelo usuário.
2. Plano de implementação (`writing-plans`), provavelmente em fatias: (a) migração +
   `pricing.ts` com helpers e testes; (b) módulo `/precos` no admin; (c)
   `RegionPricingProvider` + `RegionSelectorModal` + `PriceLockSlot` no core; (d)
   integração no `apps/mypet` (home, PDP, mensagem de cotação).
