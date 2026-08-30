# Balcão de Negócios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à loja do `apps/mypet` um módulo de negociação de preço por volume ("Balcão de Negócios"): faixas de desconto por SKU configuradas no `apps/admin`, +5% logístico fixo para retirada/frete próprio, e solicitação sob validação comercial com snapshot imutável e fila de status no admin.

**Architecture:** Três frentes ligadas por 5 tabelas novas no Supabase `hub_catalogo`. `packages/core/src/balcao.ts` concentra as funções puras de cálculo + os fetches cacheados de regras/produtos elegíveis; `packages/core/src/balcao-server.ts` grava a solicitação (service role) e serve as leituras/mutações do admin. O `apps/mypet` ganha a área `/balcao` (cliente logado) que calcula a estimativa no cliente e a recalcula no servidor no envio. O `apps/admin` ganha o módulo "Balcão de Negócios" com CRUD de regras e a fila de solicitações. O preço-base nunca é duplicado: vem do mesmo caminho do catálogo (espelho Bling para `mypetbrasil`) e é congelado no snapshot no momento do envio.

**Tech Stack:** Next.js 16 (App Router, `"use cache"` / `cacheTag` / `updateTag`), React 19, TypeScript, Supabase JS (`@supabase/supabase-js`), zod 4, Vitest 4, pnpm workspaces. `apps/mypet` usa estilos inline com `PALETTE`; `apps/admin` usa Tailwind.

## Global Constraints

- **Escopo de canal:** só `mypetbrasil` nesta entrega. Schema é channel-keyed (`public.channel` enum) para estender depois sem migração. No admin, o seletor de canal aparece **desabilitado**, fixo em `mypetbrasil`.
- **Antes de escrever código Next.js:** ler o guia relevante em `node_modules/next/dist/docs/` (AGENTS.md — este Next tem breaking changes vs. training data).
- **Preço-base do `mypetbrasil`** vem do espelho Bling (view `v_precos_erp`, indexada por `reference`), via `channelUsesErpPrice(channel)` de `@mypet/core/catalog-utils`. Produto sem preço no espelho **não é elegível** ao Balcão.
- **Desconto logístico fixo:** `LOGISTICS_DISCOUNT_PCT = 5`, constante no código em `packages/core/src/balcao.ts`, **nunca** vem do banco.
- **Composição de descontos:** multiplicativa em cascata — `base × (1 − volume/100) × (1 − logistico/100)`, arredondada a centavos (`Math.round(n * 100) / 100`).
- **Faixa avaliada por SKU:** cada item olha só a própria quantidade.
- **Piso de envio:** só habilita enviar se ≥ 1 item atinge a menor faixa configurada; reforçado no servidor.
- **Opções logísticas:** apenas `retirada` e `frete_proprio`. Ambas aplicam os 5%.
- **Regra de SKU tem prioridade** sobre a regra da categoria do mesmo produto. Exclusão de SKU = regra `scope='sku'` com `excluded=true` e sem faixas → produto não elegível.
- **Snapshot imutável:** `balcao_request_items` nunca é alterado após o envio. Ajustes do admin ficam no `payload` de `balcao_request_events`.
- **RLS ligado desde a criação** em todas as tabelas novas. Site grava via `getHubServiceClient()` (service role) dentro de Server Action, depois de `requireBuyer()`. Sem `SELECT` anon nas tabelas de solicitação.
- **Nova cache tag `"balcao"`**, separada de `"catalog"`. Toda mutação de regra no admin chama `updateTag("balcao")`.
- **Retorno ao cliente:** só tela de confirmação. Sem acompanhamento persistente no site, sem e-mail/push, sem "virar pedido".
- **Texto fixo** exibido na página e na confirmação: *"Condição sujeita à validação de estoque, margem e disponibilidade."*
- **Testes:** cada mudança em `packages/core` roda `pnpm --filter @mypet/core test`. Antes de cada commit: `pnpm lint` e (quando tocar app) `pnpm --filter <app> build`.
- **Commits frequentes**, um por task no mínimo. Mensagens em português, prefixo `feat(balcao):` / `feat(mypet):` / `feat(admin):`.

---

## File Structure

**Criar:**
- `supabase/migrations/20260830120000_balcao_de_negocios.sql` — 5 tabelas + índices + RLS.
- `packages/core/src/balcao.ts` — constantes, tipos, funções puras (`round2`, `resolveRuleForProduct`, `resolveTier`, `computeLine`, `qualifiesForSubmit`, `buildEstimate`), fetches cacheados (`getBalcaoRules`, `getBalcaoEligibleProducts`).
- `packages/core/src/balcao.test.ts` — testes das funções puras + fetches (supabase mockado).
- `packages/core/src/balcao-server.ts` — `createBalcaoRequest`, `getBalcaoRequests`, `getBalcaoRequestById`, `updateBalcaoRequestStatus`.
- `packages/core/src/balcao-server.test.ts` — testes com supabase mockado.
- `apps/mypet/app/balcao/page.tsx` — server component: `requireBuyer`, carrega regras + produtos elegíveis.
- `apps/mypet/app/balcao/balcao-content.tsx` — client: montagem da solicitação, estimativa, envio, confirmação.
- `apps/mypet/app/balcao/actions.ts` — Server Action `submitBalcaoRequest` (recalcula no servidor).
- `apps/admin/app/(dashboard)/balcao/page.tsx` — lista de regras + form de criação.
- `apps/admin/app/(dashboard)/balcao/actions.ts` — `createRule`, `updateRule`, `deleteRule`, `upsertTiers`, `setExcluded`.
- `apps/admin/app/(dashboard)/balcao/[id]/page.tsx` — edição de regra + faixas + prévia.
- `apps/admin/app/(dashboard)/balcao/solicitacoes/page.tsx` — fila de solicitações + filtro por status.
- `apps/admin/app/(dashboard)/balcao/solicitacoes/[id]/page.tsx` — detalhe + ações (aprovar/ajustar/recusar/expirar).
- `apps/admin/app/(dashboard)/balcao/solicitacoes/actions.ts` — mutações de status chamando o core.
- `apps/admin/lib/balcao.ts` — helpers puros do admin (validação de faixas, cálculo de prévia).
- `apps/admin/lib/balcao.test.ts` — testes dos helpers (se o `apps/admin` tiver runner; senão, cobrir a lógica em `packages/core`).

**Modificar:**
- `packages/core/package.json` — adicionar exports `./balcao` e `./balcao-server`.
- `packages/core/src/components/site-nav.tsx` — prop opcional `balcaoHref` que renderiza o link "Balcão de Negócios".
- `apps/mypet/app/loja/page.tsx`, `apps/mypet/app/categoria/[slug]/page.tsx`, `apps/mypet/app/cotacao/page.tsx`, `apps/mypet/app/pedidos/page.tsx`, `apps/mypet/app/produtos/[id]/page.tsx` — passar `balcaoHref="/balcao"` ao `<SiteNav>`.
- `apps/mypet/app/produtos/[id]/page.tsx` — selo "Balcão de Negócios" quando o produto é elegível.
- `apps/admin/app/(dashboard)/layout.tsx` — item de sidebar "Balcão de Negócios" com submenu (Regras, Solicitações).

---

## Task 1: Migração — 5 tabelas + RLS

**Files:**
- Create: `supabase/migrations/20260830120000_balcao_de_negocios.sql`

**Interfaces:**
- Consumes: enum `public.channel`, tabelas `public.categories`, `public.buyers`, `public.admin_users` (já existem).
- Produces: tabelas `balcao_rules`, `balcao_rule_tiers`, `balcao_requests`, `balcao_request_items`, `balcao_request_events` com as colunas usadas por `balcao.ts` e `balcao-server.ts` nas tasks seguintes.

- [ ] **Step 1: Criar o arquivo de migração**

Create `supabase/migrations/20260830120000_balcao_de_negocios.sql`:

```sql
-- Balcão de Negócios: regras de desconto por volume + solicitações sob validação comercial.
-- Escopo desta entrega: canal mypetbrasil. Estrutura channel-keyed para estender depois.

-- Regras: uma por escopo (categoria inteira OU sku específico).
create table public.balcao_rules (
  id uuid primary key default gen_random_uuid(),
  channel public.channel not null,
  scope text not null check (scope in ('categoria', 'sku')),
  category_id uuid references public.categories(id) on delete cascade,
  product_reference text,
  excluded boolean not null default false,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'categoria' and category_id is not null and product_reference is null)
    or (scope = 'sku' and product_reference is not null and category_id is null)
  ),
  check (not excluded or scope = 'sku'),
  unique nulls not distinct (channel, scope, category_id, product_reference)
);

-- Faixas de uma regra: quantidade mínima + percentual de desconto.
create table public.balcao_rule_tiers (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.balcao_rules(id) on delete cascade,
  min_qty int not null check (min_qty >= 1),
  discount_pct numeric not null default 0 check (discount_pct >= 0),
  unique (rule_id, min_qty)
);

-- Cabeçalho da solicitação + snapshot do contexto do comprador.
create table public.balcao_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id),
  channel public.channel not null,
  logistics text not null check (logistics in ('retirada', 'frete_proprio')),
  note text,
  status text not null default 'enviada'
    check (status in ('enviada', 'em_analise', 'aprovada', 'ajustada', 'recusada', 'expirada')),
  buyer_snapshot jsonb not null,
  total_estimated numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index balcao_requests_status_idx on public.balcao_requests (status, created_at desc);
create index balcao_requests_buyer_idx on public.balcao_requests (buyer_id, created_at desc);

-- Fotografia imutável por linha da solicitação.
create table public.balcao_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.balcao_requests(id) on delete cascade,
  product_id uuid not null,
  product_reference text not null,
  product_name_snapshot text not null,
  qty int not null check (qty >= 1),
  base_price_snapshot numeric not null,
  tier_min_qty_snapshot int,
  volume_discount_pct_snapshot numeric not null default 0,
  logistics_discount_pct_snapshot numeric not null default 0,
  unit_price_estimated numeric not null,
  line_total_estimated numeric not null
);
create index balcao_request_items_request_idx on public.balcao_request_items (request_id);

-- Histórico de ações da equipe sobre a solicitação.
create table public.balcao_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.balcao_requests(id) on delete cascade,
  actor uuid references public.admin_users(id),
  action text not null
    check (action in ('criada', 'em_analise', 'aprovada', 'ajustada', 'recusada', 'expirada')),
  payload jsonb,
  created_at timestamptz not null default now()
);
create index balcao_request_events_request_idx on public.balcao_request_events (request_id, created_at);

-- RLS
alter table public.balcao_rules enable row level security;
alter table public.balcao_rule_tiers enable row level security;
alter table public.balcao_requests enable row level security;
alter table public.balcao_request_items enable row level security;
alter table public.balcao_request_events enable row level security;

-- Regras e faixas: leitura pública (o site calcula a estimativa e marca elegibilidade
-- com a anon key); escrita só admin.
create policy "anon reads balcao rules" on public.balcao_rules
  for select to anon using (true);
create policy "anon reads balcao rule tiers" on public.balcao_rule_tiers
  for select to anon using (true);
create policy "admins manage balcao rules" on public.balcao_rules
  for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
create policy "admins manage balcao rule tiers" on public.balcao_rule_tiers
  for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));

-- Solicitações: sem acesso anon. Site grava via service role (bypassa RLS).
-- Admin autenticado lê tudo, atualiza status e grava eventos.
create policy "admins read balcao requests" on public.balcao_requests
  for select to authenticated using (auth.uid() in (select id from public.admin_users));
create policy "admins update balcao requests" on public.balcao_requests
  for update to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
create policy "admins read balcao request items" on public.balcao_request_items
  for select to authenticated using (auth.uid() in (select id from public.admin_users));
create policy "admins manage balcao request events" on public.balcao_request_events
  for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
```

- [ ] **Step 2: Conferir o SQL contra o modelo de dados do spec**

Abrir `docs/superpowers/specs/2026-08-29-balcao-de-negocios-design.md`, seção "Modelo de dados", e conferir campo a campo (nomes, tipos, checks, unique) contra o arquivo criado. Ajustar qualquer divergência no `.sql`.
Expected: cada campo da seção "Modelo de dados" aparece na migração com o mesmo nome e a mesma restrição.

- [ ] **Step 3: Rodar o lint (não deve ser afetado)**

Run: `pnpm lint`
Expected: PASS (sem erros novos).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260830120000_balcao_de_negocios.sql
git commit -m "feat(balcao): migração das tabelas de regras e solicitações"
```

> Nota de execução: a aplicação da migração no projeto Supabase `hub_catalogo` é feita fora deste repo (mesmo fluxo de `20260828120000_pre_acesso.sql`). O restante do plano assume as tabelas já criadas no ambiente de teste/preview.

---

## Task 2: Core — funções puras de cálculo

**Files:**
- Create: `packages/core/src/balcao.ts`
- Create: `packages/core/src/balcao.test.ts`
- Modify: `packages/core/package.json` (adicionar export `./balcao`)

**Interfaces:**
- Consumes: nada além de tipos locais.
- Produces:
  - `LOGISTICS_DISCOUNT_PCT: number` (= 5)
  - `type BalcaoLogistics = "retirada" | "frete_proprio"`
  - `type BalcaoRuleScope = "categoria" | "sku"`
  - `type BalcaoTier = { minQty: number; discountPct: number }`
  - `type BalcaoRule = { id: string; scope: BalcaoRuleScope; categoryId: string | null; productReference: string | null; excluded: boolean; tiers: BalcaoTier[] }` (tiers ordenados asc por `minQty`)
  - `round2(n: number): number`
  - `resolveRuleForProduct(rules: BalcaoRule[], target: { productReference: string | null; categoryId: string | null }): BalcaoRule | null`
  - `resolveTier(tiers: BalcaoTier[], qty: number): BalcaoTier | null`
  - `computeLine(input: { basePrice: number; volumePct: number; logisticsApplies: boolean }): { unitPrice: number; volumePct: number; logisticsPct: number }`
  - `qualifiesForSubmit(lines: { tier: BalcaoTier | null }[]): boolean`

- [ ] **Step 1: Escrever os testes que falham**

Create `packages/core/src/balcao.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  LOGISTICS_DISCOUNT_PCT,
  round2,
  resolveRuleForProduct,
  resolveTier,
  computeLine,
  qualifiesForSubmit,
  type BalcaoRule,
} from "./balcao";

const catRule: BalcaoRule = {
  id: "r-cat",
  scope: "categoria",
  categoryId: "cat-1",
  productReference: null,
  excluded: false,
  tiers: [
    { minQty: 10, discountPct: 8 },
    { minQty: 25, discountPct: 12 },
    { minQty: 50, discountPct: 18 },
  ],
};

const skuRule: BalcaoRule = {
  id: "r-sku",
  scope: "sku",
  categoryId: null,
  productReference: "SKU-A",
  excluded: false,
  tiers: [{ minQty: 5, discountPct: 20 }],
};

const skuExcluded: BalcaoRule = {
  id: "r-x",
  scope: "sku",
  categoryId: null,
  productReference: "SKU-B",
  excluded: true,
  tiers: [],
};

describe("round2", () => {
  it("arredonda a centavos", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
    expect(round2(3.3333)).toBe(3.33);
  });
});

describe("resolveRuleForProduct", () => {
  it("regra de SKU vence a de categoria do mesmo produto", () => {
    const r = resolveRuleForProduct([catRule, skuRule], {
      productReference: "SKU-A",
      categoryId: "cat-1",
    });
    expect(r?.id).toBe("r-sku");
  });

  it("cai na regra de categoria quando não há regra de SKU", () => {
    const r = resolveRuleForProduct([catRule, skuRule], {
      productReference: "SKU-Z",
      categoryId: "cat-1",
    });
    expect(r?.id).toBe("r-cat");
  });

  it("SKU excluído devolve null mesmo com categoria habilitada", () => {
    const r = resolveRuleForProduct([catRule, skuExcluded], {
      productReference: "SKU-B",
      categoryId: "cat-1",
    });
    expect(r).toBeNull();
  });

  it("devolve null quando nada casa", () => {
    const r = resolveRuleForProduct([catRule], {
      productReference: "SKU-Q",
      categoryId: "cat-9",
    });
    expect(r).toBeNull();
  });
});

describe("resolveTier", () => {
  it("pega a maior faixa com minQty <= qty", () => {
    expect(resolveTier(catRule.tiers, 30)?.minQty).toBe(25);
    expect(resolveTier(catRule.tiers, 25)?.minQty).toBe(25);
    expect(resolveTier(catRule.tiers, 1000)?.minQty).toBe(50);
  });

  it("devolve null abaixo da menor faixa", () => {
    expect(resolveTier(catRule.tiers, 9)).toBeNull();
  });

  it("devolve null quando não há faixas", () => {
    expect(resolveTier([], 100)).toBeNull();
  });
});

describe("computeLine", () => {
  it("aplica volume e logístico em cascata, arredondado a centavos", () => {
    const r = computeLine({ basePrice: 100, volumePct: 12, logisticsApplies: true });
    // 100 * 0.88 * 0.95 = 83.6
    expect(r.unitPrice).toBe(83.6);
    expect(r.volumePct).toBe(12);
    expect(r.logisticsPct).toBe(LOGISTICS_DISCOUNT_PCT);
  });

  it("ignora os 5% quando logisticsApplies é false", () => {
    const r = computeLine({ basePrice: 100, volumePct: 12, logisticsApplies: false });
    expect(r.unitPrice).toBe(88);
    expect(r.logisticsPct).toBe(0);
  });

  it("sem faixa (volumePct 0) só aplica o logístico", () => {
    const r = computeLine({ basePrice: 50, volumePct: 0, logisticsApplies: true });
    expect(r.unitPrice).toBe(47.5);
  });
});

describe("qualifiesForSubmit", () => {
  it("false quando nenhuma linha atinge faixa", () => {
    expect(qualifiesForSubmit([{ tier: null }, { tier: null }])).toBe(false);
  });

  it("true quando ao menos uma linha atinge faixa", () => {
    expect(qualifiesForSubmit([{ tier: null }, { tier: { minQty: 10, discountPct: 8 } }])).toBe(true);
  });

  it("false para lista vazia", () => {
    expect(qualifiesForSubmit([])).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `pnpm --filter @mypet/core test -- balcao.test`
Expected: FAIL — `Cannot find module './balcao'`.

- [ ] **Step 3: Implementar `balcao.ts` (só as funções puras)**

Create `packages/core/src/balcao.ts`:

```ts
/**
 * Balcão de Negócios — funções puras de cálculo.
 *
 * O preço-base vem do mesmo caminho do catálogo (espelho Bling para mypetbrasil).
 * As faixas são percentuais sobre esse preço, avaliadas POR SKU. O desconto
 * logístico é fixo e mora só aqui, nunca no banco.
 */

export const LOGISTICS_DISCOUNT_PCT = 5;

export type BalcaoLogistics = "retirada" | "frete_proprio";
export type BalcaoRuleScope = "categoria" | "sku";

export type BalcaoTier = { minQty: number; discountPct: number };

export type BalcaoRule = {
  id: string;
  scope: BalcaoRuleScope;
  categoryId: string | null;
  productReference: string | null;
  excluded: boolean;
  /** Ordenadas asc por minQty. */
  tiers: BalcaoTier[];
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Precedência: regra scope='sku' com productReference igual → regra
 * scope='categoria' com categoryId igual → null. Uma regra de SKU com
 * excluded=true devolve null (produto tirado de uma categoria habilitada).
 */
export function resolveRuleForProduct(
  rules: BalcaoRule[],
  target: { productReference: string | null; categoryId: string | null },
): BalcaoRule | null {
  if (target.productReference) {
    const skuRule = rules.find(
      (r) => r.scope === "sku" && r.productReference === target.productReference,
    );
    if (skuRule) return skuRule.excluded ? null : skuRule;
  }
  if (target.categoryId) {
    const catRule = rules.find(
      (r) => r.scope === "categoria" && r.categoryId === target.categoryId,
    );
    if (catRule) return catRule;
  }
  return null;
}

/** Maior faixa com minQty <= qty; null se qty abaixo da menor faixa. */
export function resolveTier(tiers: BalcaoTier[], qty: number): BalcaoTier | null {
  let match: BalcaoTier | null = null;
  for (const tier of tiers) {
    if (qty >= tier.minQty && (match === null || tier.minQty > match.minQty)) {
      match = tier;
    }
  }
  return match;
}

/** Cascata multiplicativa, arredondada a centavos. */
export function computeLine(input: {
  basePrice: number;
  volumePct: number;
  logisticsApplies: boolean;
}): { unitPrice: number; volumePct: number; logisticsPct: number } {
  const logisticsPct = input.logisticsApplies ? LOGISTICS_DISCOUNT_PCT : 0;
  const unitPrice = round2(
    input.basePrice * (1 - input.volumePct / 100) * (1 - logisticsPct / 100),
  );
  return { unitPrice, volumePct: input.volumePct, logisticsPct };
}

/** Piso de envio: ao menos uma linha precisa atingir uma faixa. */
export function qualifiesForSubmit(lines: { tier: BalcaoTier | null }[]): boolean {
  return lines.some((l) => l.tier !== null);
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `pnpm --filter @mypet/core test -- balcao.test`
Expected: PASS (todos os `describe` acima).

- [ ] **Step 5: Adicionar o export no `package.json` do core**

Modify `packages/core/package.json` — no objeto `exports`, adicionar a linha (mantendo ordem alfabética, logo após `"./banners"`):

```json
    "./balcao": "./src/balcao.ts",
```

- [ ] **Step 6: Lint + commit**

Run: `pnpm lint`
Expected: PASS

```bash
git add packages/core/src/balcao.ts packages/core/src/balcao.test.ts packages/core/package.json
git commit -m "feat(balcao): funções puras de cálculo de faixa e desconto"
```

---

## Task 3: Core — fetch cacheado das regras (`getBalcaoRules`)

**Files:**
- Modify: `packages/core/src/balcao.ts`
- Modify: `packages/core/src/balcao.test.ts`

**Interfaces:**
- Consumes: `getHubClient` de `./supabase`; `cacheLife`, `cacheTag` de `next/cache`; tabelas `balcao_rules` + `balcao_rule_tiers` (Task 1).
- Produces: `getBalcaoRules(channel: string): Promise<BalcaoRule[]>` — só regras `active` e vigentes agora (`starts_at`/`ends_at` cobrindo o momento), com `tiers` ordenadas asc por `minQty`. Cache: `"use cache"` + `cacheLife("days")` + `cacheTag("balcao")`.
- Também exporta a função pura interna `mapRulesFromRows(rows): BalcaoRule[]` e `isRuleLiveAt(row, now): boolean` para teste sem cache.

- [ ] **Step 1: Escrever os testes que falham**

Append a `packages/core/src/balcao.test.ts`:

```ts
import { mapRulesFromRows, isRuleLiveAt } from "./balcao";

describe("isRuleLiveAt", () => {
  const now = new Date("2026-08-30T12:00:00Z");
  it("true quando active e sem janela de vigência", () => {
    expect(isRuleLiveAt({ active: true, starts_at: null, ends_at: null }, now)).toBe(true);
  });
  it("false quando inactive", () => {
    expect(isRuleLiveAt({ active: false, starts_at: null, ends_at: null }, now)).toBe(false);
  });
  it("false antes de starts_at", () => {
    expect(
      isRuleLiveAt({ active: true, starts_at: "2026-09-01T00:00:00Z", ends_at: null }, now),
    ).toBe(false);
  });
  it("false depois de ends_at", () => {
    expect(
      isRuleLiveAt({ active: true, starts_at: null, ends_at: "2026-08-01T00:00:00Z" }, now),
    ).toBe(false);
  });
});

describe("mapRulesFromRows", () => {
  it("mapeia colunas snake_case e ordena as faixas asc", () => {
    const rules = mapRulesFromRows([
      {
        id: "r1",
        scope: "categoria",
        category_id: "c1",
        product_reference: null,
        excluded: false,
        balcao_rule_tiers: [
          { min_qty: 25, discount_pct: "12.00" },
          { min_qty: 10, discount_pct: "8" },
        ],
      },
    ]);
    expect(rules).toEqual([
      {
        id: "r1",
        scope: "categoria",
        categoryId: "c1",
        productReference: null,
        excluded: false,
        tiers: [
          { minQty: 10, discountPct: 8 },
          { minQty: 25, discountPct: 12 },
        ],
      },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- balcao.test`
Expected: FAIL — `mapRulesFromRows`/`isRuleLiveAt` não exportados.

- [ ] **Step 3: Implementar o fetch em `balcao.ts`**

Append a `packages/core/src/balcao.ts`:

```ts
import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";

type RawTier = { min_qty: number; discount_pct: number | string };
type RawRule = {
  id: string;
  scope: BalcaoRuleScope;
  category_id: string | null;
  product_reference: string | null;
  excluded: boolean;
  balcao_rule_tiers: RawTier[] | null;
};

export function isRuleLiveAt(
  row: { active: boolean; starts_at: string | null; ends_at: string | null },
  now: Date,
): boolean {
  if (!row.active) return false;
  if (row.starts_at && new Date(row.starts_at) > now) return false;
  if (row.ends_at && new Date(row.ends_at) < now) return false;
  return true;
}

export function mapRulesFromRows(rows: RawRule[]): BalcaoRule[] {
  return rows.map((row) => ({
    id: row.id,
    scope: row.scope,
    categoryId: row.category_id,
    productReference: row.product_reference,
    excluded: row.excluded,
    tiers: (row.balcao_rule_tiers ?? [])
      .map((t) => ({ minQty: t.min_qty, discountPct: Number(t.discount_pct) }))
      .sort((a, b) => a.minQty - b.minQty),
  }));
}

export async function getBalcaoRules(channel: string): Promise<BalcaoRule[]> {
  "use cache";
  cacheLife("days");
  cacheTag("balcao");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("balcao_rules")
    .select(
      "id, scope, category_id, product_reference, excluded, active, starts_at, ends_at, balcao_rule_tiers(min_qty, discount_pct)",
    )
    .eq("channel", channel);

  if (error) {
    console.error("[balcao] erro ao consultar regras:", error.message);
    return [];
  }

  const now = new Date();
  const live = ((data as unknown as (RawRule & { active: boolean; starts_at: string | null; ends_at: string | null })[]) ?? [])
    .filter((row) => isRuleLiveAt(row, now));
  return mapRulesFromRows(live);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- balcao.test`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

Run: `pnpm lint`
Expected: PASS

```bash
git add packages/core/src/balcao.ts packages/core/src/balcao.test.ts
git commit -m "feat(balcao): fetch cacheado das regras (tag balcao)"
```

---

## Task 4: Core — produtos elegíveis + `buildEstimate`

**Files:**
- Modify: `packages/core/src/balcao.ts`
- Modify: `packages/core/src/balcao.test.ts`

**Interfaces:**
- Consumes: `getHubClient`, `channelUsesErpPrice` de `./catalog-utils`, `getBalcaoRules` (Task 3), `resolveRuleForProduct` / `resolveTier` / `computeLine` / `qualifiesForSubmit` (Task 2).
- Produces:
  - `type BalcaoEligibleProduct = { id: string; name: string; sku: string; brand: string | null; img: string; categoryId: string | null; basePrice: number; rule: BalcaoRule }`
  - `getBalcaoEligibleProducts(channel: string): Promise<BalcaoEligibleProduct[]>` — produtos ativos, não-variante, com preço-base resolvido e uma regra vigente que não seja exclusão. Cache `"use cache"` + `cacheLife("days")` + `cacheTag("balcao")`.
  - `type EstimateSelection = { productId: string; qty: number }`
  - `type EstimateLine = { product: BalcaoEligibleProduct; qty: number; tier: BalcaoTier | null; volumePct: number; logisticsPct: number; unitPrice: number; lineTotal: number }`
  - `buildEstimate(input: { products: BalcaoEligibleProduct[]; selections: EstimateSelection[]; logistics: BalcaoLogistics }): { lines: EstimateLine[]; totalEstimated: number; qualifies: boolean }` — pura. Ignora `selection` cujo `productId` não está em `products` ou cujo `qty < 1`.

- [ ] **Step 1: Escrever os testes que falham (só `buildEstimate`; o fetch é coberto no Step 5)**

Append a `packages/core/src/balcao.test.ts`:

```ts
import { buildEstimate, type BalcaoEligibleProduct } from "./balcao";

const prodA: BalcaoEligibleProduct = {
  id: "pa",
  name: "Ração A 15kg",
  sku: "SKU-A",
  brand: "Marca",
  img: "/a.png",
  categoryId: "cat-1",
  basePrice: 100,
  rule: {
    id: "r1",
    scope: "categoria",
    categoryId: "cat-1",
    productReference: null,
    excluded: false,
    tiers: [
      { minQty: 10, discountPct: 10 },
      { minQty: 25, discountPct: 15 },
    ],
  },
};

const prodB: BalcaoEligibleProduct = {
  ...prodA,
  id: "pb",
  name: "Ração B 15kg",
  sku: "SKU-B",
  basePrice: 200,
};

describe("buildEstimate", () => {
  it("calcula cada linha por SKU com logística aplicada", () => {
    const r = buildEstimate({
      products: [prodA, prodB],
      selections: [
        { productId: "pa", qty: 12 },
        { productId: "pb", qty: 8 },
      ],
      logistics: "retirada",
    });

    // linha A: faixa 10 (10%) + 5% => 100 * 0.9 * 0.95 = 85.5, total 1026
    expect(r.lines[0]).toMatchObject({ qty: 12, volumePct: 10, logisticsPct: 5, unitPrice: 85.5, lineTotal: 1026 });
    // linha B: sem faixa (qty 8), só 5% => 200 * 0.95 = 190, total 1520
    expect(r.lines[1]).toMatchObject({ qty: 8, tier: null, volumePct: 0, unitPrice: 190, lineTotal: 1520 });
    expect(r.totalEstimated).toBe(2546);
    expect(r.qualifies).toBe(true);
  });

  it("qualifies false quando nenhuma linha atinge faixa", () => {
    const r = buildEstimate({
      products: [prodA],
      selections: [{ productId: "pa", qty: 3 }],
      logistics: "frete_proprio",
    });
    expect(r.qualifies).toBe(false);
  });

  it("descarta selection sem produto e qty < 1", () => {
    const r = buildEstimate({
      products: [prodA],
      selections: [
        { productId: "zzz", qty: 10 },
        { productId: "pa", qty: 0 },
      ],
      logistics: "retirada",
    });
    expect(r.lines).toEqual([]);
    expect(r.totalEstimated).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- balcao.test`
Expected: FAIL — `buildEstimate` não exportado.

- [ ] **Step 3: Implementar em `balcao.ts`**

Append a `packages/core/src/balcao.ts`:

```ts
import { channelUsesErpPrice } from "./catalog-utils";

export type BalcaoEligibleProduct = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  categoryId: string | null;
  basePrice: number;
  rule: BalcaoRule;
};

export type EstimateSelection = { productId: string; qty: number };

export type EstimateLine = {
  product: BalcaoEligibleProduct;
  qty: number;
  tier: BalcaoTier | null;
  volumePct: number;
  logisticsPct: number;
  unitPrice: number;
  lineTotal: number;
};

export function buildEstimate(input: {
  products: BalcaoEligibleProduct[];
  selections: EstimateSelection[];
  logistics: BalcaoLogistics;
}): { lines: EstimateLine[]; totalEstimated: number; qualifies: boolean } {
  const byId = new Map(input.products.map((p) => [p.id, p]));
  const lines: EstimateLine[] = [];

  for (const sel of input.selections) {
    const product = byId.get(sel.productId);
    if (!product || sel.qty < 1) continue;

    const tier = resolveTier(product.rule.tiers, sel.qty);
    const { unitPrice, volumePct, logisticsPct } = computeLine({
      basePrice: product.basePrice,
      volumePct: tier?.discountPct ?? 0,
      logisticsApplies: true, // no MVP sempre há retirada ou frete próprio
    });

    lines.push({
      product,
      qty: sel.qty,
      tier,
      volumePct,
      logisticsPct,
      unitPrice,
      lineTotal: round2(unitPrice * sel.qty),
    });
  }

  const totalEstimated = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  return { lines, totalEstimated, qualifies: qualifiesForSubmit(lines) };
}

type RawEligibleRow = {
  id: string;
  name: string;
  reference: string | null;
  brand: string | null;
  category_id: string | null;
  product_assets: { url: string; type: string | null }[] | null;
  product_channel_prices: { sale_price: number | string | null }[] | null;
};

export async function getBalcaoEligibleProducts(
  channel: string,
): Promise<BalcaoEligibleProduct[]> {
  "use cache";
  cacheLife("days");
  cacheTag("balcao");

  const rules = await getBalcaoRules(channel);
  const categoryIds = [
    ...new Set(rules.filter((r) => r.scope === "categoria").map((r) => r.categoryId!)),
  ];
  const skuRefs = [
    ...new Set(
      rules
        .filter((r) => r.scope === "sku" && !r.excluded)
        .map((r) => r.productReference!),
    ),
  ];
  if (categoryIds.length === 0 && skuRefs.length === 0) return [];

  const supabase = getHubClient();
  const orParts: string[] = [];
  if (categoryIds.length > 0) orParts.push(`category_id.in.(${categoryIds.join(",")})`);
  if (skuRefs.length > 0) {
    orParts.push(`reference.in.(${skuRefs.map((r) => `"${r}"`).join(",")})`);
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, reference, brand, category_id, product_assets(url, type), product_channel_prices(sale_price), product_channel_links!inner(channel)",
    )
    .eq("status", "active")
    .neq("product_role", "variant")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel)
    .or(orParts.join(","))
    .order("name", { ascending: true });

  if (error) {
    console.error("[balcao] erro ao consultar produtos elegíveis:", error.message);
    return [];
  }

  const rows = (data as unknown as RawEligibleRow[]) ?? [];

  // Preço-base: espelho Bling para canais ERP, senão product_channel_prices.
  let priceByRef = new Map<string, number>();
  if (channelUsesErpPrice(channel)) {
    const refs = [...new Set(rows.map((r) => r.reference).filter((r): r is string => !!r))];
    if (refs.length > 0) {
      const { data: erp, error: erpErr } = await supabase
        .from("v_precos_erp")
        .select("reference, preco")
        .in("reference", refs);
      if (erpErr) {
        console.error("[balcao] erro ao consultar preços do ERP:", erpErr.message);
      } else {
        for (const p of (erp as { reference: string | null; preco: number | string | null }[]) ?? []) {
          if (!p.reference || p.preco == null) continue;
          const v = Number(p.preco);
          if (Number.isFinite(v)) priceByRef.set(p.reference, v);
        }
      }
    }
  }

  const out: BalcaoEligibleProduct[] = [];
  for (const row of rows) {
    const rule = resolveRuleForProduct(rules, {
      productReference: row.reference,
      categoryId: row.category_id,
    });
    if (!rule) continue; // inclui o caso de SKU excluído

    let basePrice: number | null = null;
    if (channelUsesErpPrice(channel)) {
      basePrice = row.reference ? priceByRef.get(row.reference) ?? null : null;
    } else {
      const raw = row.product_channel_prices?.find((p) => p.sale_price != null)?.sale_price;
      basePrice = raw == null ? null : Number(raw);
    }
    if (basePrice == null || !Number.isFinite(basePrice)) continue;

    out.push({
      id: row.id,
      name: row.name,
      sku: row.reference ?? "",
      brand: row.brand,
      img: row.product_assets?.find((a) => a.type === "image")?.url
        ?? row.product_assets?.[0]?.url
        ?? "/placeholder-produto.svg",
      categoryId: row.category_id,
      basePrice,
      rule,
    });
  }
  return out;
}
```

- [ ] **Step 4: Rodar os testes de `buildEstimate` e ver passar**

Run: `pnpm --filter @mypet/core test -- balcao.test`
Expected: PASS.

- [ ] **Step 5: Teste do fetch `getBalcaoEligibleProducts` com supabase mockado**

Append a `packages/core/src/balcao.test.ts`:

```ts
import { vi } from "vitest";

describe("getBalcaoEligibleProducts", () => {
  it("resolve preço do ERP, aplica a regra e descarta produto sem preço", async () => {
    vi.resetModules();
    vi.doMock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));
    vi.doMock("./supabase", () => ({
      getHubClient: () => ({
        from: (table: string) => {
          if (table === "balcao_rules") {
            return {
              select: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "r1",
                        scope: "categoria",
                        category_id: "cat-1",
                        product_reference: null,
                        excluded: false,
                        active: true,
                        starts_at: null,
                        ends_at: null,
                        balcao_rule_tiers: [{ min_qty: 10, discount_pct: "10" }],
                      },
                    ],
                    error: null,
                  }),
              }),
            };
          }
          if (table === "products") {
            const chain = {
              select: () => chain,
              eq: () => chain,
              neq: () => chain,
              or: () => chain,
              order: () =>
                Promise.resolve({
                  data: [
                    { id: "pa", name: "A", reference: "SKU-A", brand: null, category_id: "cat-1", product_assets: [], product_channel_prices: [] },
                    { id: "pb", name: "B", reference: "SKU-B", brand: null, category_id: "cat-1", product_assets: [], product_channel_prices: [] },
                  ],
                  error: null,
                }),
            };
            return chain;
          }
          // v_precos_erp
          return {
            select: () => ({
              in: () => Promise.resolve({ data: [{ reference: "SKU-A", preco: "100.00" }], error: null }),
            }),
          };
        },
      }),
    }));

    const mod = await import("./balcao");
    const result = await mod.getBalcaoEligibleProducts("mypetbrasil");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "pa", sku: "SKU-A", basePrice: 100, categoryId: "cat-1" });
    expect(result[0].rule.tiers).toEqual([{ minQty: 10, discountPct: 10 }]);
    vi.doUnmock("next/cache");
    vi.doUnmock("./supabase");
  });
});
```

- [ ] **Step 6: Rodar tudo, lint, commit**

Run: `pnpm --filter @mypet/core test -- balcao.test`
Expected: PASS.
Run: `pnpm lint`
Expected: PASS.

```bash
git add packages/core/src/balcao.ts packages/core/src/balcao.test.ts
git commit -m "feat(balcao): produtos elegíveis com preço-base e buildEstimate"
```

---

## Task 5: Core — `createBalcaoRequest`

**Files:**
- Create: `packages/core/src/balcao-server.ts`
- Create: `packages/core/src/balcao-server.test.ts`
- Modify: `packages/core/package.json` (export `./balcao-server`)

**Interfaces:**
- Consumes: `SupabaseClient` de `@supabase/supabase-js`; `Channel` de `./channels`; `BalcaoLogistics` de `./balcao`.
- Produces:
  - `type BalcaoRequestItemInput = { productId: string; productReference: string; productName: string; qty: number; basePrice: number; tierMinQty: number | null; volumeDiscountPct: number; logisticsDiscountPct: number; unitPrice: number; lineTotal: number }`
  - `type CreateBalcaoRequestInput = { buyerId: string; channel: Channel; logistics: BalcaoLogistics; note: string | null; buyerSnapshot: { nome: string | null; empresa: string | null; whatsapp: string; cnpj: string | null }; items: BalcaoRequestItemInput[]; totalEstimated: number }`
  - `createBalcaoRequest(supabase: SupabaseClient, input: CreateBalcaoRequestInput): Promise<{ requestId: string | null; error: string | null }>` — insere `balcao_requests`, depois `balcao_request_items`, depois um `balcao_request_events` com `action='criada'`. Rejeita `items` vazio.

- [ ] **Step 1: Escrever os testes que falham**

Create `packages/core/src/balcao-server.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBalcaoRequest, type CreateBalcaoRequestInput } from "./balcao-server";

const baseInput: CreateBalcaoRequestInput = {
  buyerId: "b1",
  channel: "mypetbrasil",
  logistics: "retirada",
  note: "sem pressa",
  buyerSnapshot: { nome: "Fulano", empresa: "Pet X", whatsapp: "11999", cnpj: "123" },
  items: [
    {
      productId: "pa",
      productReference: "SKU-A",
      productName: "Ração A",
      qty: 12,
      basePrice: 100,
      tierMinQty: 10,
      volumeDiscountPct: 10,
      logisticsDiscountPct: 5,
      unitPrice: 85.5,
      lineTotal: 1026,
    },
  ],
  totalEstimated: 1026,
};

describe("createBalcaoRequest", () => {
  it("rejeita quando não há itens", async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;
    const r = await createBalcaoRequest(supabase, { ...baseInput, items: [] });
    expect(r).toEqual({ requestId: null, error: "A solicitação está vazia." });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("grava cabeçalho, itens (snapshot) e evento criada", async () => {
    const reqSingle = vi.fn().mockResolvedValue({ data: { id: "req1" }, error: null });
    const itemsInsert = vi.fn().mockResolvedValue({ error: null });
    const eventsInsert = vi.fn().mockResolvedValue({ error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "balcao_requests") {
          return { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: reqSingle };
        }
        if (table === "balcao_request_items") return { insert: itemsInsert };
        return { insert: eventsInsert };
      }),
    } as unknown as SupabaseClient;

    const r = await createBalcaoRequest(supabase, baseInput);

    expect(r).toEqual({ requestId: "req1", error: null });
    expect(itemsInsert).toHaveBeenCalledWith([
      {
        request_id: "req1",
        product_id: "pa",
        product_reference: "SKU-A",
        product_name_snapshot: "Ração A",
        qty: 12,
        base_price_snapshot: 100,
        tier_min_qty_snapshot: 10,
        volume_discount_pct_snapshot: 10,
        logistics_discount_pct_snapshot: 5,
        unit_price_estimated: 85.5,
        line_total_estimated: 1026,
      },
    ]);
    expect(eventsInsert).toHaveBeenCalledWith({
      request_id: "req1",
      actor: null,
      action: "criada",
      payload: null,
    });
  });

  it("devolve erro genérico quando o cabeçalho falha", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
      })),
    } as unknown as SupabaseClient;
    const r = await createBalcaoRequest(supabase, baseInput);
    expect(r.requestId).toBeNull();
    expect(r.error).toBe("Não foi possível registrar sua solicitação. Tente novamente em instantes.");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- balcao-server.test`
Expected: FAIL — `Cannot find module './balcao-server'`.

- [ ] **Step 3: Implementar `balcao-server.ts`**

Create `packages/core/src/balcao-server.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel } from "./channels";
import type { BalcaoLogistics } from "./balcao";

export type BalcaoRequestItemInput = {
  productId: string;
  productReference: string;
  productName: string;
  qty: number;
  basePrice: number;
  tierMinQty: number | null;
  volumeDiscountPct: number;
  logisticsDiscountPct: number;
  unitPrice: number;
  lineTotal: number;
};

export type BalcaoBuyerSnapshot = {
  nome: string | null;
  empresa: string | null;
  whatsapp: string;
  cnpj: string | null;
};

export type CreateBalcaoRequestInput = {
  buyerId: string;
  channel: Channel;
  logistics: BalcaoLogistics;
  note: string | null;
  buyerSnapshot: BalcaoBuyerSnapshot;
  items: BalcaoRequestItemInput[];
  totalEstimated: number;
};

export async function createBalcaoRequest(
  supabase: SupabaseClient,
  input: CreateBalcaoRequestInput,
): Promise<{ requestId: string | null; error: string | null }> {
  if (input.items.length === 0) {
    return { requestId: null, error: "A solicitação está vazia." };
  }

  const { data: req, error: reqError } = await supabase
    .from("balcao_requests")
    .insert({
      buyer_id: input.buyerId,
      channel: input.channel,
      logistics: input.logistics,
      note: input.note,
      status: "enviada",
      buyer_snapshot: input.buyerSnapshot,
      total_estimated: input.totalEstimated,
    })
    .select("id")
    .single();

  if (reqError || !req) {
    console.error("[balcao] erro ao criar solicitação:", reqError?.message);
    return {
      requestId: null,
      error: "Não foi possível registrar sua solicitação. Tente novamente em instantes.",
    };
  }

  const { error: itemsError } = await supabase.from("balcao_request_items").insert(
    input.items.map((it) => ({
      request_id: req.id,
      product_id: it.productId,
      product_reference: it.productReference,
      product_name_snapshot: it.productName,
      qty: it.qty,
      base_price_snapshot: it.basePrice,
      tier_min_qty_snapshot: it.tierMinQty,
      volume_discount_pct_snapshot: it.volumeDiscountPct,
      logistics_discount_pct_snapshot: it.logisticsDiscountPct,
      unit_price_estimated: it.unitPrice,
      line_total_estimated: it.lineTotal,
    })),
  );

  if (itemsError) {
    console.error("[balcao] erro ao gravar itens da solicitação:", itemsError.message);
    return {
      requestId: null,
      error: "Não foi possível registrar os itens da solicitação. Tente novamente em instantes.",
    };
  }

  const { error: eventError } = await supabase.from("balcao_request_events").insert({
    request_id: req.id,
    actor: null,
    action: "criada",
    payload: null,
  });
  if (eventError) {
    console.error("[balcao] erro ao gravar evento inicial:", eventError.message);
  }

  return { requestId: req.id as string, error: null };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- balcao-server.test`
Expected: PASS.

- [ ] **Step 5: Export + lint + commit**

Modify `packages/core/package.json` — no `exports`, após `"./balcao"`:

```json
    "./balcao-server": "./src/balcao-server.ts",
```

Run: `pnpm lint`
Expected: PASS.

```bash
git add packages/core/src/balcao-server.ts packages/core/src/balcao-server.test.ts packages/core/package.json
git commit -m "feat(balcao): gravação da solicitação com snapshot imutável"
```

---

## Task 6: Core — leituras e mutação de status para o admin

**Files:**
- Modify: `packages/core/src/balcao-server.ts`
- Modify: `packages/core/src/balcao-server.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient`.
- Produces:
  - `type BalcaoRequestStatus = "enviada" | "em_analise" | "aprovada" | "ajustada" | "recusada" | "expirada"`
  - `type BalcaoRequestListRow = { id: string; buyer: BalcaoBuyerSnapshot; logistics: BalcaoLogistics; status: BalcaoRequestStatus; totalEstimated: number; createdAt: string }`
  - `getBalcaoRequests(supabase, filter: { status?: BalcaoRequestStatus }): Promise<BalcaoRequestListRow[]>` — ordenado por `created_at desc`.
  - `type BalcaoRequestItemRow = { productId: string; productReference: string; productName: string; qty: number; basePrice: number; tierMinQty: number | null; volumeDiscountPct: number; logisticsDiscountPct: number; unitPrice: number; lineTotal: number }`
  - `type BalcaoRequestEventRow = { actor: string | null; action: string; payload: unknown; createdAt: string }`
  - `type BalcaoRequestDetail = BalcaoRequestListRow & { note: string | null; items: BalcaoRequestItemRow[]; events: BalcaoRequestEventRow[] }`
  - `getBalcaoRequestById(supabase, id: string): Promise<BalcaoRequestDetail | null>`
  - `updateBalcaoRequestStatus(supabase, input: { id: string; actorId: string; action: Exclude<BalcaoRequestStatus, "enviada"> | "em_analise"; payload?: unknown }): Promise<{ error: string | null }>` — atualiza `balcao_requests.status` + `updated_at` e insere um `balcao_request_events` com `actor`, `action`, `payload`.

- [ ] **Step 1: Escrever os testes que falham**

Append a `packages/core/src/balcao-server.test.ts`:

```ts
import { getBalcaoRequests, getBalcaoRequestById, updateBalcaoRequestStatus } from "./balcao-server";

describe("getBalcaoRequests", () => {
  it("mapeia linhas e aplica filtro de status", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "req1",
          buyer_snapshot: { nome: "F", empresa: "X", whatsapp: "11", cnpj: null },
          logistics: "retirada",
          status: "enviada",
          total_estimated: "1026.00",
          created_at: "2026-08-30T10:00:00Z",
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq, order });
    const supabase = { from: vi.fn(() => ({ select })) } as unknown as import("@supabase/supabase-js").SupabaseClient;

    const rows = await getBalcaoRequests(supabase, { status: "enviada" });
    expect(eq).toHaveBeenCalledWith("status", "enviada");
    expect(rows[0]).toEqual({
      id: "req1",
      buyer: { nome: "F", empresa: "X", whatsapp: "11", cnpj: null },
      logistics: "retirada",
      status: "enviada",
      totalEstimated: 1026,
      createdAt: "2026-08-30T10:00:00Z",
    });
  });
});

describe("updateBalcaoRequestStatus", () => {
  it("atualiza status e grava evento com actor e payload", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const eventInsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "balcao_requests") {
          return { update: vi.fn().mockReturnValue({ eq: updateEq }) };
        }
        return { insert: eventInsert };
      }),
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    const r = await updateBalcaoRequestStatus(supabase, {
      id: "req1",
      actorId: "admin-1",
      action: "aprovada",
      payload: { nota: "ok" },
    });
    expect(r).toEqual({ error: null });
    expect(eventInsert).toHaveBeenCalledWith({
      request_id: "req1",
      actor: "admin-1",
      action: "aprovada",
      payload: { nota: "ok" },
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- balcao-server.test`
Expected: FAIL — funções não exportadas.

- [ ] **Step 3: Implementar em `balcao-server.ts`**

Append a `packages/core/src/balcao-server.ts`:

```ts
import type { BalcaoLogistics } from "./balcao";

export type BalcaoRequestStatus =
  | "enviada"
  | "em_analise"
  | "aprovada"
  | "ajustada"
  | "recusada"
  | "expirada";

export type BalcaoRequestListRow = {
  id: string;
  buyer: BalcaoBuyerSnapshot;
  logistics: BalcaoLogistics;
  status: BalcaoRequestStatus;
  totalEstimated: number;
  createdAt: string;
};

export type BalcaoRequestItemRow = {
  productId: string;
  productReference: string;
  productName: string;
  qty: number;
  basePrice: number;
  tierMinQty: number | null;
  volumeDiscountPct: number;
  logisticsDiscountPct: number;
  unitPrice: number;
  lineTotal: number;
};

export type BalcaoRequestEventRow = {
  actor: string | null;
  action: string;
  payload: unknown;
  createdAt: string;
};

export type BalcaoRequestDetail = BalcaoRequestListRow & {
  note: string | null;
  items: BalcaoRequestItemRow[];
  events: BalcaoRequestEventRow[];
};

export async function getBalcaoRequests(
  supabase: SupabaseClient,
  filter: { status?: BalcaoRequestStatus },
): Promise<BalcaoRequestListRow[]> {
  let query = supabase
    .from("balcao_requests")
    .select("id, buyer_snapshot, logistics, status, total_estimated, created_at");
  if (filter.status) query = query.eq("status", filter.status);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("[balcao] erro ao listar solicitações:", error.message);
    return [];
  }

  return (
    (data as {
      id: string;
      buyer_snapshot: BalcaoBuyerSnapshot;
      logistics: BalcaoLogistics;
      status: BalcaoRequestStatus;
      total_estimated: number | string;
      created_at: string;
    }[]) ?? []
  ).map((row) => ({
    id: row.id,
    buyer: row.buyer_snapshot,
    logistics: row.logistics,
    status: row.status,
    totalEstimated: Number(row.total_estimated),
    createdAt: row.created_at,
  }));
}

export async function getBalcaoRequestById(
  supabase: SupabaseClient,
  id: string,
): Promise<BalcaoRequestDetail | null> {
  const { data, error } = await supabase
    .from("balcao_requests")
    .select(
      "id, buyer_snapshot, logistics, status, total_estimated, note, created_at, " +
        "balcao_request_items(product_id, product_reference, product_name_snapshot, qty, base_price_snapshot, tier_min_qty_snapshot, volume_discount_pct_snapshot, logistics_discount_pct_snapshot, unit_price_estimated, line_total_estimated), " +
        "balcao_request_events(actor, action, payload, created_at)",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[balcao] erro ao buscar solicitação:", error?.message);
    return null;
  }

  const row = data as Record<string, unknown> & {
    balcao_request_items: Record<string, unknown>[] | null;
    balcao_request_events: Record<string, unknown>[] | null;
  };

  return {
    id: row.id as string,
    buyer: row.buyer_snapshot as BalcaoBuyerSnapshot,
    logistics: row.logistics as BalcaoLogistics,
    status: row.status as BalcaoRequestStatus,
    totalEstimated: Number(row.total_estimated),
    createdAt: row.created_at as string,
    note: (row.note as string | null) ?? null,
    items: (row.balcao_request_items ?? []).map((it) => ({
      productId: it.product_id as string,
      productReference: it.product_reference as string,
      productName: it.product_name_snapshot as string,
      qty: it.qty as number,
      basePrice: Number(it.base_price_snapshot),
      tierMinQty: (it.tier_min_qty_snapshot as number | null) ?? null,
      volumeDiscountPct: Number(it.volume_discount_pct_snapshot),
      logisticsDiscountPct: Number(it.logistics_discount_pct_snapshot),
      unitPrice: Number(it.unit_price_estimated),
      lineTotal: Number(it.line_total_estimated),
    })),
    events: (row.balcao_request_events ?? [])
      .map((ev) => ({
        actor: (ev.actor as string | null) ?? null,
        action: ev.action as string,
        payload: ev.payload ?? null,
        createdAt: ev.created_at as string,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export async function updateBalcaoRequestStatus(
  supabase: SupabaseClient,
  input: {
    id: string;
    actorId: string;
    action: Exclude<BalcaoRequestStatus, "enviada"> | "em_analise";
    payload?: unknown;
  },
): Promise<{ error: string | null }> {
  const { error: updError } = await supabase
    .from("balcao_requests")
    .update({ status: input.action, updated_at: new Date().toISOString() })
    .eq("id", input.id);

  if (updError) {
    console.error("[balcao] erro ao atualizar status:", updError.message);
    return { error: "Não foi possível atualizar a solicitação." };
  }

  const { error: evError } = await supabase.from("balcao_request_events").insert({
    request_id: input.id,
    actor: input.actorId,
    action: input.action,
    payload: input.payload ?? null,
  });
  if (evError) {
    console.error("[balcao] erro ao gravar evento de status:", evError.message);
    return { error: "Status atualizado, mas o histórico não foi gravado." };
  }

  return { error: null };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- balcao-server.test`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

Run: `pnpm lint`
Expected: PASS.

```bash
git add packages/core/src/balcao-server.ts packages/core/src/balcao-server.test.ts
git commit -m "feat(balcao): leituras e mutação de status das solicitações"
```

---

## Task 7: apps/mypet — Server Action `submitBalcaoRequest`

**Files:**
- Create: `apps/mypet/app/balcao/actions.ts`

**Interfaces:**
- Consumes: `requireBuyer` de `@/lib/require-buyer`; `getHubServiceClient` de `@mypet/core/supabase`; `getBalcaoEligibleProducts`, `buildEstimate`, `type BalcaoLogistics`, `type EstimateSelection` de `@mypet/core/balcao`; `createBalcaoRequest` de `@mypet/core/balcao-server`; `clientConfig` de `@/client.config`.
- Produces:
  - `type SubmitBalcaoInput = { selections: { productId: string; qty: number }[]; logistics: BalcaoLogistics; note: string }`
  - `type SubmitBalcaoResult = { ok: true } | { ok: false; error: string; needsAuth?: boolean }`
  - `submitBalcaoRequest(input: SubmitBalcaoInput): Promise<SubmitBalcaoResult>` — server action. Recarrega produtos elegíveis, **recalcula** com `buildEstimate` (fonte da verdade), rejeita se não qualifica ou se nenhuma linha válida, grava via `createBalcaoRequest`.

- [ ] **Step 1: Ler o guia do Next sobre Server Actions**

Run: `ls node_modules/next/dist/docs/` e ler o material sobre `"use server"` / Server Actions / `app-router`.
Expected: entender a assinatura atual de Server Actions neste Next (breaking changes vs. training data — ver AGENTS.md).

- [ ] **Step 2: Implementar a action**

Create `apps/mypet/app/balcao/actions.ts`:

```ts
"use server";

import { getHubServiceClient } from "@mypet/core/supabase";
import {
  getBalcaoEligibleProducts,
  buildEstimate,
  type BalcaoLogistics,
} from "@mypet/core/balcao";
import { createBalcaoRequest } from "@mypet/core/balcao-server";
import { requireBuyer } from "@/lib/require-buyer";
import { clientConfig } from "@/client.config";
import type { Channel } from "@mypet/core/channels";

export type SubmitBalcaoInput = {
  selections: { productId: string; qty: number }[];
  logistics: BalcaoLogistics;
  note: string;
};

export type SubmitBalcaoResult =
  | { ok: true }
  | { ok: false; error: string; needsAuth?: boolean };

const VALID_LOGISTICS: BalcaoLogistics[] = ["retirada", "frete_proprio"];

export async function submitBalcaoRequest(
  input: SubmitBalcaoInput,
): Promise<SubmitBalcaoResult> {
  const buyer = await requireBuyer();
  if (!buyer) {
    return {
      ok: false,
      error: "Você precisa criar um acesso para enviar a solicitação.",
      needsAuth: true,
    };
  }

  if (!VALID_LOGISTICS.includes(input.logistics)) {
    return { ok: false, error: "Escolha retirada ou frete por conta própria." };
  }

  const channel = clientConfig.catalogChannel as Channel;
  const products = await getBalcaoEligibleProducts(channel);

  // Fonte da verdade: recalcula no servidor, ignora números vindos do cliente.
  const cleanSelections = input.selections
    .map((s) => ({ productId: String(s.productId), qty: Math.floor(Number(s.qty)) }))
    .filter((s) => s.qty >= 1);

  const { lines, totalEstimated, qualifies } = buildEstimate({
    products,
    selections: cleanSelections,
    logistics: input.logistics,
  });

  if (lines.length === 0) {
    return { ok: false, error: "Nenhum item elegível na solicitação." };
  }
  if (!qualifies) {
    return {
      ok: false,
      error: "Aumente a quantidade de ao menos um item até a menor faixa para enviar.",
    };
  }

  const { error } = await createBalcaoRequest(getHubServiceClient(), {
    buyerId: buyer.id,
    channel,
    logistics: input.logistics,
    note: input.note.trim() ? input.note.trim().slice(0, 2000) : null,
    buyerSnapshot: {
      nome: buyer.nome,
      empresa: buyer.empresa,
      whatsapp: buyer.whatsapp,
      cnpj: buyer.cnpj,
    },
    items: lines.map((l) => ({
      productId: l.product.id,
      productReference: l.product.sku,
      productName: l.product.name,
      qty: l.qty,
      basePrice: l.product.basePrice,
      tierMinQty: l.tier?.minQty ?? null,
      volumeDiscountPct: l.volumePct,
      logisticsDiscountPct: l.logisticsPct,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    totalEstimated,
  });

  if (error) return { ok: false, error };
  return { ok: true };
}
```

- [ ] **Step 3: Verificar type-check / build do app**

Run: `pnpm --filter mypet build`
Expected: PASS (compila; a rota `/balcao` ainda não existe como página, mas a action compila).

- [ ] **Step 4: Lint + commit**

Run: `pnpm lint`
Expected: PASS.

```bash
git add apps/mypet/app/balcao/actions.ts
git commit -m "feat(mypet): server action do Balcão com recálculo no servidor"
```

---

## Task 8: apps/mypet — página `/balcao` e conteúdo cliente

**Files:**
- Create: `apps/mypet/app/balcao/page.tsx`
- Create: `apps/mypet/app/balcao/balcao-content.tsx`

**Interfaces:**
- Consumes: `requireBuyer`; `redirect` de `next/navigation`; `getCategories` de `@mypet/core/catalog`; `getBalcaoEligibleProducts`, `buildEstimate`, `LOGISTICS_DISCOUNT_PCT`, tipos de `@mypet/core/balcao`; `SiteNav` de `@mypet/core/components/site-nav`; `clientConfig`; `submitBalcaoRequest` de `./actions`.
- Produces: rota `/balcao` renderizada; nenhuma exportação usada por outras tasks.

- [ ] **Step 1: Ler o guia do Next sobre páginas/Server Components**

Run: `ls node_modules/next/dist/docs/` e revisar `app-router` / `pages-and-layouts` / `use-cache`.
Expected: confirmar assinatura de página (async server component, `searchParams` como Promise — ver `cotacao/page.tsx`).

- [ ] **Step 2: Implementar `page.tsx`**

Create `apps/mypet/app/balcao/page.tsx`:

```tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { getCategories } from "@mypet/core/catalog";
import { getBalcaoEligibleProducts } from "@mypet/core/balcao";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { BalcaoContent } from "./balcao-content";
import type { Channel } from "@mypet/core/channels";

const { palette: PALETTE } = clientConfig;

export const metadata = {
  title: "Balcão de Negócios | My Pet Brasil",
  robots: { index: false, follow: false },
};

export default function BalcaoPage() {
  return (
    <Suspense fallback={null}>
      <BalcaoPageBody />
    </Suspense>
  );
}

// exportado para testes
export async function BalcaoPageBody() {
  const buyer = await requireBuyer();
  if (!buyer) redirect("/entrar");

  const channel = clientConfig.catalogChannel as Channel;
  const [categories, products] = await Promise.all([
    getCategories(),
    getBalcaoEligibleProducts(channel),
  ]);

  const serializable = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    brand: p.brand,
    img: p.img,
    categoryId: p.categoryId,
    basePrice: p.basePrice,
    rule: p.rule,
  }));

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } body { margin: 0; }
        .cta-primary { background: ${PALETTE.pink}; color: #fff; border: none; border-radius: 100px; padding: 12px 24px; font-weight: 800; font-size: 14px; cursor: pointer; }
        .cta-primary:disabled { background: ${PALETTE.gray200}; color: ${PALETTE.gray400}; cursor: not-allowed; }`}</style>
      <SiteNav categories={categories} balcaoHref="/balcao" />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 80px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 6 }}>
          Balcão de Negócios
        </h1>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 24, maxWidth: 640 }}>
          Condições diferenciadas por quantidade em produtos selecionados. Escolha os itens,
          informe as quantidades e envie a solicitação — nossa equipe valida e retorna com a
          condição confirmada.
        </p>
        {serializable.length === 0 ? (
          <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: PALETTE.navy }}>
              Nenhum produto no Balcão de Negócios no momento.
            </p>
          </div>
        ) : (
          <BalcaoContent products={serializable} palette={PALETTE} />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Implementar `balcao-content.tsx`**

Create `apps/mypet/app/balcao/balcao-content.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buildEstimate,
  LOGISTICS_DISCOUNT_PCT,
  type BalcaoEligibleProduct,
  type BalcaoLogistics,
} from "@mypet/core/balcao";
import type { Palette } from "@mypet/core/theme";
import { submitBalcaoRequest } from "./actions";

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const DISCLAIMER = "Condição sujeita à validação de estoque, margem e disponibilidade.";

export function BalcaoContent({
  products,
  palette: P,
}: {
  products: BalcaoEligibleProduct[];
  palette: Palette;
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [logistics, setLogistics] = useState<BalcaoLogistics>("retirada");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const selections = useMemo(
    () =>
      Object.entries(qty)
        .map(([productId, q]) => ({ productId, qty: q }))
        .filter((s) => s.qty >= 1),
    [qty],
  );

  const estimate = useMemo(
    () => buildEstimate({ products, selections, logistics }),
    [products, selections, logistics],
  );

  if (submitted) {
    return (
      <div style={{ background: P.white, border: `1px solid ${P.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: P.navy, marginBottom: 8 }}>Solicitação enviada!</h2>
        <p style={{ fontSize: 14, color: P.gray600, marginBottom: 8 }}>
          Nossa equipe vai analisar e entrar em contato com a condição confirmada.
        </p>
        <p style={{ fontSize: 12, color: P.gray400, marginBottom: 20 }}>{DISCLAIMER}</p>
        <Link href="/loja" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  const setQ = (id: string, v: number) =>
    setQty((cur) => ({ ...cur, [id]: Number.isFinite(v) && v > 0 ? Math.floor(v) : 0 }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    const result = await submitBalcaoRequest({ selections, logistics, note });
    if (!result.ok) {
      if (result.needsAuth) {
        router.push("/entrar");
        return;
      }
      setError(result.error);
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ background: P.white, border: `1px solid ${P.gray200}`, borderRadius: 16, overflow: "hidden" }}>
        {products.map((p, i) => {
          const line = estimate.lines.find((l) => l.product.id === p.id);
          return (
            <div key={p.id} style={{ display: "flex", gap: 16, padding: 16, alignItems: "center", borderBottom: i < products.length - 1 ? `1px solid ${P.gray100}` : "none" }}>
              <img src={p.img} alt={p.name} style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: P.navy }}>{p.name}</p>
                <p style={{ fontSize: 11, color: P.gray400 }}>SKU: {p.sku} · base {brl(p.basePrice)}</p>
                <p style={{ fontSize: 11, color: P.gray600 }}>
                  Faixas: {p.rule.tiers.map((t) => `${t.minQty}+ (−${t.discountPct}%)`).join(" · ") || "sem faixa"}
                </p>
              </div>
              <input
                type="number"
                min={0}
                aria-label={`Quantidade de ${p.name}`}
                value={qty[p.id] ?? ""}
                onChange={(e) => setQ(p.id, Number(e.target.value))}
                style={{ width: 72, padding: "8px 10px", border: `1.5px solid ${P.gray200}`, borderRadius: 8, fontSize: 14 }}
              />
              <div style={{ width: 150, textAlign: "right" }}>
                {line ? (
                  <>
                    <p style={{ fontSize: 14, fontWeight: 800, color: P.navy }}>{brl(line.unitPrice)}/un.</p>
                    <p style={{ fontSize: 11, color: line.tier ? P.green : P.gray400 }}>
                      {line.tier ? `faixa ${line.tier.minQty}+ · −${line.volumePct}%` : "sem faixa"} · −{line.logisticsPct}% log.
                    </p>
                    <p style={{ fontSize: 11, color: P.gray600 }}>{brl(line.lineTotal)}</p>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: P.gray400 }}>—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: P.white, border: `1px solid ${P.gray200}`, borderRadius: 16, padding: 20, display: "grid", gap: 16 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: P.navy, marginBottom: 8 }}>Modalidade logística (−{LOGISTICS_DISCOUNT_PCT}%)</p>
          <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>
            <input type="radio" name="logistics" checked={logistics === "retirada"} onChange={() => setLogistics("retirada")} /> Retirada no ponto de apoio
          </label>
          <label style={{ display: "block", fontSize: 14 }}>
            <input type="radio" name="logistics" checked={logistics === "frete_proprio"} onChange={() => setLogistics("frete_proprio")} /> Frete por conta própria
          </label>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 800, color: P.navy, display: "block", marginBottom: 6 }}>Observação (opcional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} style={{ width: "100%", padding: 10, border: `1.5px solid ${P.gray200}`, borderRadius: 8, fontSize: 14, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontSize: 12, color: P.gray600 }}>Total estimado</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: P.navy }}>{brl(estimate.totalEstimated)}</p>
          </div>
          <button className="cta-primary" disabled={submitting || !estimate.qualifies} onClick={handleSubmit}>
            {submitting ? "Enviando..." : "Enviar solicitação"}
          </button>
        </div>
        {!estimate.qualifies && selections.length > 0 && (
          <p style={{ fontSize: 12, color: P.orange }}>
            Aumente a quantidade de ao menos um item até a menor faixa para enviar.
          </p>
        )}
        {error && <p style={{ fontSize: 13, color: "#c0143c" }}>{error}</p>}
        <p style={{ fontSize: 12, color: P.gray400 }}>{DISCLAIMER}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build do app**

Run: `pnpm --filter mypet build`
Expected: PASS. A rota `/balcao` aparece no output do build.

- [ ] **Step 5: Verificação manual rápida**

Run: `pnpm dev:mypet` e abrir `http://localhost:<porta>/balcao`.
Expected: sem sessão de comprador → redireciona para `/entrar`. Com sessão e regras cadastradas no ambiente → lista os produtos elegíveis, o total estimado reage à quantidade, o botão só habilita ao atingir uma faixa.

- [ ] **Step 6: Lint + commit**

Run: `pnpm lint`
Expected: PASS.

```bash
git add apps/mypet/app/balcao/page.tsx apps/mypet/app/balcao/balcao-content.tsx
git commit -m "feat(mypet): página /balcao com estimativa e envio"
```

---

## Task 9: apps/mypet + core — entrada na navegação e selo na PDP

**Files:**
- Modify: `packages/core/src/components/site-nav.tsx`
- Modify: `apps/mypet/app/loja/page.tsx:305`
- Modify: `apps/mypet/app/categoria/[slug]/page.tsx:165`
- Modify: `apps/mypet/app/cotacao/page.tsx:95`
- Modify: `apps/mypet/app/pedidos/page.tsx:75`
- Modify: `apps/mypet/app/produtos/[id]/page.tsx:167` (+ selo)

**Interfaces:**
- Consumes: `getBalcaoRules`, `resolveRuleForProduct` de `@mypet/core/balcao` (na PDP).
- Produces: `SiteNav` aceita `balcaoHref?: string`.

- [ ] **Step 1: Adicionar a prop opcional ao `SiteNav`**

Modify `packages/core/src/components/site-nav.tsx`:

Assinatura:
```tsx
export function SiteNav({
  categories,
  balcaoHref,
}: {
  categories: CategoryNode[];
  balcaoHref?: string;
}) {
```

Dentro de `<div className="site-nav-actions" ...>`, antes de `<CartBadge />`:
```tsx
{balcaoHref && (
  <Link
    href={balcaoHref}
    style={{ fontSize: 13, fontWeight: 800, color: palette.pink, textDecoration: "none", whiteSpace: "nowrap" }}
  >
    Balcão de Negócios
  </Link>
)}
```

- [ ] **Step 2: Passar `balcaoHref="/balcao"` nos 5 call sites do mypet**

Em cada arquivo, trocar `<SiteNav categories={categories} />` por `<SiteNav categories={categories} balcaoHref="/balcao" />`:
- `apps/mypet/app/loja/page.tsx:305`
- `apps/mypet/app/categoria/[slug]/page.tsx:165`
- `apps/mypet/app/cotacao/page.tsx:95`
- `apps/mypet/app/pedidos/page.tsx:75`
- `apps/mypet/app/produtos/[id]/page.tsx:167`

- [ ] **Step 3: Selo na PDP**

Modify `apps/mypet/app/produtos/[id]/page.tsx`:

No topo, junto dos imports:
```tsx
import { getBalcaoRules, resolveRuleForProduct } from "@mypet/core/balcao";
```

Onde o produto já é carregado (após `getProductById`), adicionar:
```tsx
const balcaoRules = await getBalcaoRules(clientConfig.catalogChannel);
const balcaoEligible =
  product.salePrice != null &&
  resolveRuleForProduct(balcaoRules, {
    productReference: product.sku || null,
    categoryId: product.categoryId ?? null,
  }) !== null;
```

Perto do nome/preço do produto, renderizar o selo:
```tsx
{balcaoEligible && (
  <Link
    href="/balcao"
    style={{ display: "inline-block", background: PALETTE.pinkLight, color: PALETTE.pink, fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 100, textDecoration: "none", marginBottom: 8 }}
  >
    Disponível no Balcão de Negócios →
  </Link>
)}
```

> Se `PALETTE`/`clientConfig`/`Link` ainda não estiverem importados nessa página, adicionar os imports (`Link` de `next/link`, `clientConfig` de `@/client.config`).

- [ ] **Step 4: Build + lint**

Run: `pnpm --filter mypet build`
Expected: PASS.
Run: `pnpm --filter @mypet/core test`
Expected: PASS (nenhum teste de `SiteNav` quebrado — a prop é opcional).
Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/site-nav.tsx apps/mypet/app/loja/page.tsx apps/mypet/app/categoria apps/mypet/app/cotacao/page.tsx apps/mypet/app/pedidos/page.tsx apps/mypet/app/produtos
git commit -m "feat(mypet): entrada do Balcão na navegação e selo na PDP"
```

---

## Task 10: apps/admin — helpers puros de regra e prévia

**Files:**
- Create: `apps/admin/lib/balcao.ts`
- Create: `apps/admin/lib/balcao.test.ts` (só se `apps/admin` tiver runner de teste; conferir no Step 1)

**Interfaces:**
- Consumes: `computeLine`, `resolveTier`, `type BalcaoTier` de `@mypet/core/balcao`.
- Produces:
  - `parseTiersInput(raw: { minQty: unknown; discountPct: unknown }[]): { tiers: BalcaoTier[] } | { error: string }` — valida: `minQty` inteiro ≥ 1, `discountPct` número ≥ 0, sem `minQty` repetido; devolve ordenado asc.
  - `previewUnitPrice(basePrice: number, tiers: BalcaoTier[], qty: number): { tierMinQty: number | null; volumePct: number; unitPriceWithLogistics: number; unitPriceNoLogistics: number }` — usa `resolveTier` + `computeLine`.

- [ ] **Step 1: Verificar runner de teste do admin**

Run: `cat apps/admin/package.json`
Expected: se houver `"test"` com vitest, escrever `apps/admin/lib/balcao.test.ts` no padrão dos outros libs do admin. **Se não houver**, pular o arquivo de teste e mover a cobertura destes helpers para `packages/core/src/balcao.test.ts` (importando de `@mypet/core/balcao` os equivalentes — nesse caso, implementar `parseTiersInput`/`previewUnitPrice` em `packages/core/src/balcao.ts` em vez de `apps/admin/lib/balcao.ts`, e ajustar os imports das Tasks 11–12).

- [ ] **Step 2: Escrever o teste (assumindo runner no admin; senão, ver Step 1)**

Create `apps/admin/lib/balcao.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseTiersInput, previewUnitPrice } from "./balcao";

describe("parseTiersInput", () => {
  it("ordena por minQty e converte números", () => {
    const r = parseTiersInput([
      { minQty: "25", discountPct: "12" },
      { minQty: "10", discountPct: "8" },
    ]);
    expect(r).toEqual({ tiers: [{ minQty: 10, discountPct: 8 }, { minQty: 25, discountPct: 12 }] });
  });

  it("rejeita minQty repetido", () => {
    const r = parseTiersInput([
      { minQty: "10", discountPct: "8" },
      { minQty: "10", discountPct: "12" },
    ]);
    expect(r).toEqual({ error: "Há faixas com a mesma quantidade mínima." });
  });

  it("rejeita discountPct negativo", () => {
    const r = parseTiersInput([{ minQty: "10", discountPct: "-1" }]);
    expect(r).toEqual({ error: "O desconto de cada faixa precisa ser zero ou positivo." });
  });

  it("rejeita minQty < 1 ou não inteiro", () => {
    expect(parseTiersInput([{ minQty: "0", discountPct: "8" }])).toEqual({
      error: "A quantidade mínima de cada faixa precisa ser um inteiro ≥ 1.",
    });
    expect(parseTiersInput([{ minQty: "2.5", discountPct: "8" }])).toEqual({
      error: "A quantidade mínima de cada faixa precisa ser um inteiro ≥ 1.",
    });
  });
});

describe("previewUnitPrice", () => {
  it("aplica faixa + logística e também a versão sem logística", () => {
    const r = previewUnitPrice(100, [{ minQty: 10, discountPct: 12 }], 15);
    expect(r).toEqual({
      tierMinQty: 10,
      volumePct: 12,
      unitPriceWithLogistics: 83.6,
      unitPriceNoLogistics: 88,
    });
  });

  it("sem faixa devolve tierMinQty null", () => {
    const r = previewUnitPrice(100, [{ minQty: 10, discountPct: 12 }], 3);
    expect(r.tierMinQty).toBeNull();
    expect(r.volumePct).toBe(0);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter admin test -- balcao.test` (ou o comando equivalente do admin)
Expected: FAIL — `Cannot find module './balcao'`.

- [ ] **Step 4: Implementar `apps/admin/lib/balcao.ts`**

Create `apps/admin/lib/balcao.ts`:

```ts
import { computeLine, resolveTier, type BalcaoTier } from "@mypet/core/balcao";

export function parseTiersInput(
  raw: { minQty: unknown; discountPct: unknown }[],
): { tiers: BalcaoTier[] } | { error: string } {
  const tiers: BalcaoTier[] = [];
  for (const row of raw) {
    const minQty = Number(row.minQty);
    const discountPct = Number(row.discountPct);
    if (!Number.isInteger(minQty) || minQty < 1) {
      return { error: "A quantidade mínima de cada faixa precisa ser um inteiro ≥ 1." };
    }
    if (!Number.isFinite(discountPct) || discountPct < 0) {
      return { error: "O desconto de cada faixa precisa ser zero ou positivo." };
    }
    tiers.push({ minQty, discountPct });
  }
  const seen = new Set<number>();
  for (const t of tiers) {
    if (seen.has(t.minQty)) return { error: "Há faixas com a mesma quantidade mínima." };
    seen.add(t.minQty);
  }
  tiers.sort((a, b) => a.minQty - b.minQty);
  return { tiers };
}

export function previewUnitPrice(
  basePrice: number,
  tiers: BalcaoTier[],
  qty: number,
): {
  tierMinQty: number | null;
  volumePct: number;
  unitPriceWithLogistics: number;
  unitPriceNoLogistics: number;
} {
  const tier = resolveTier(tiers, qty);
  const volumePct = tier?.discountPct ?? 0;
  return {
    tierMinQty: tier?.minQty ?? null,
    volumePct,
    unitPriceWithLogistics: computeLine({ basePrice, volumePct, logisticsApplies: true }).unitPrice,
    unitPriceNoLogistics: computeLine({ basePrice, volumePct, logisticsApplies: false }).unitPrice,
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter admin test -- balcao.test`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

Run: `pnpm lint`
Expected: PASS.

```bash
git add apps/admin/lib/balcao.ts apps/admin/lib/balcao.test.ts
git commit -m "feat(admin): helpers de validação de faixa e prévia de preço"
```

---

## Task 11: apps/admin — módulo de regras (lista, criação, sidebar)

**Files:**
- Create: `apps/admin/app/(dashboard)/balcao/actions.ts`
- Create: `apps/admin/app/(dashboard)/balcao/page.tsx`
- Modify: `apps/admin/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `requireAdminSession` de `@/lib/auth`; `updateTag` de `next/cache`; `redirect` de `next/navigation`; `z` de `zod`; `getCategories` de `@mypet/core/catalog`; `parseTiersInput` de `@/lib/balcao`.
- Produces (em `actions.ts`):
  - `createRule(formData: FormData): Promise<void>` — cria regra `categoria` ou `sku` (com faixas via campos `tiers` JSON). Valida, insere `balcao_rules` + `balcao_rule_tiers`, `updateTag("balcao")`, `redirect("/balcao")`.
  - `deleteRule(formData: FormData): Promise<void>` — apaga por `id` (cascade nas faixas), `updateTag("balcao")`.
  - `setExcluded(formData: FormData): Promise<void>` — cria/atualiza regra `scope='sku'` com `excluded=true` para `product_reference` informado, `updateTag("balcao")`.

- [ ] **Step 1: Ler o guia do Next sobre Server Actions + `updateTag`**

Run: `ls node_modules/next/dist/docs/` — revisar `use-cache` / `updateTag` / server actions. Conferir contra `apps/admin/app/(dashboard)/categorias/actions.ts` (mesmo padrão: `updateTag` importado de `next/cache`).

- [ ] **Step 2: Implementar `actions.ts`**

Create `apps/admin/app/(dashboard)/balcao/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { parseTiersInput } from "@/lib/balcao";

const CHANNEL = "mypetbrasil";

const CreateRuleSchema = z
  .object({
    scope: z.enum(["categoria", "sku"]),
    categoryId: z.string().uuid().nullable(),
    productReference: z.string().min(1).nullable(),
    startsAt: z.string().nullable(),
    endsAt: z.string().nullable(),
  })
  .refine(
    (d) =>
      (d.scope === "categoria" && d.categoryId && !d.productReference) ||
      (d.scope === "sku" && d.productReference && !d.categoryId),
    { message: "Escopo inconsistente com os campos preenchidos." },
  );

export async function createRule(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();

  const scope = String(formData.get("scope") ?? "");
  const parsed = CreateRuleSchema.safeParse({
    scope,
    categoryId: formData.get("categoryId") ? String(formData.get("categoryId")) : null,
    productReference: formData.get("productReference")
      ? String(formData.get("productReference")).trim()
      : null,
    startsAt: formData.get("startsAt") ? String(formData.get("startsAt")) : null,
    endsAt: formData.get("endsAt") ? String(formData.get("endsAt")) : null,
  });
  if (!parsed.success) {
    redirect("/balcao?error=dados_invalidos");
  }

  let rawTiers: { minQty: unknown; discountPct: unknown }[] = [];
  try {
    rawTiers = JSON.parse(String(formData.get("tiers") ?? "[]"));
  } catch {
    redirect("/balcao?error=faixas_invalidas");
  }
  if (rawTiers.length === 0) {
    redirect("/balcao?error=sem_faixas");
  }
  const tiersResult = parseTiersInput(rawTiers);
  if ("error" in tiersResult) {
    redirect("/balcao?error=faixas_invalidas");
  }

  const { data: rule, error: ruleError } = await supabase
    .from("balcao_rules")
    .insert({
      channel: CHANNEL,
      scope: parsed.data.scope,
      category_id: parsed.data.categoryId,
      product_reference: parsed.data.productReference,
      excluded: false,
      active: true,
      starts_at: parsed.data.startsAt || null,
      ends_at: parsed.data.endsAt || null,
    })
    .select("id")
    .single();

  if (ruleError || !rule) {
    console.error("[admin/balcao] erro ao criar regra:", ruleError?.message);
    redirect("/balcao?error=falha_ao_salvar");
  }

  const { error: tiersError } = await supabase.from("balcao_rule_tiers").insert(
    tiersResult.tiers.map((t) => ({
      rule_id: rule.id,
      min_qty: t.minQty,
      discount_pct: t.discountPct,
    })),
  );
  if (tiersError) {
    console.error("[admin/balcao] erro ao gravar faixas:", tiersError.message);
    redirect("/balcao?error=falha_ao_salvar");
  }

  updateTag("balcao");
  redirect("/balcao");
}

export async function deleteRule(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { error } = await supabase.from("balcao_rules").delete().eq("id", id);
  if (error) {
    console.error("[admin/balcao] erro ao excluir regra:", error.message);
    return;
  }
  updateTag("balcao");
  redirect("/balcao");
}

const ExcludeSchema = z.object({ productReference: z.string().min(1) });

export async function setExcluded(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = ExcludeSchema.safeParse({
    productReference: String(formData.get("productReference") ?? "").trim(),
  });
  if (!parsed.success) redirect("/balcao?error=dados_invalidos");

  const { error } = await supabase.from("balcao_rules").upsert(
    {
      channel: CHANNEL,
      scope: "sku",
      category_id: null,
      product_reference: parsed.data.productReference,
      excluded: true,
      active: true,
    },
    { onConflict: "channel,scope,category_id,product_reference" },
  );
  if (error) {
    console.error("[admin/balcao] erro ao excluir SKU:", error.message);
    redirect("/balcao?error=falha_ao_salvar");
  }
  updateTag("balcao");
  redirect("/balcao");
}
```

- [ ] **Step 3: Implementar `page.tsx` (lista + form de criação + exclusão de SKU)**

Create `apps/admin/app/(dashboard)/balcao/page.tsx`:

```tsx
import Link from "next/link";
import { getCategories } from "@mypet/core/catalog";
import { getHubClient } from "@mypet/core/supabase";
import { requireAdminSession } from "@/lib/auth";
import { createRule, deleteRule, setExcluded } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  dados_invalidos: "Dados inválidos. Revise os campos.",
  faixas_invalidas: "As faixas informadas são inválidas.",
  sem_faixas: "Adicione ao menos uma faixa (quantidade mínima + desconto).",
  falha_ao_salvar: "Não foi possível salvar. Tente novamente.",
};

type RuleRow = {
  id: string;
  scope: "categoria" | "sku";
  category_id: string | null;
  product_reference: string | null;
  excluded: boolean;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  balcao_rule_tiers: { min_qty: number; discount_pct: number }[] | null;
};

export default async function BalcaoRegrasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminSession();
  const { error } = await searchParams;
  const categories = await getCategories();
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const { data } = await getHubClient()
    .from("balcao_rules")
    .select(
      "id, scope, category_id, product_reference, excluded, active, starts_at, ends_at, balcao_rule_tiers(min_qty, discount_pct)",
    )
    .eq("channel", "mypetbrasil")
    .order("scope", { ascending: true });
  const rules = (data as RuleRow[] | null) ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Balcão de Negócios — Regras</h1>
        <Link href="/balcao/solicitacoes" className="text-sm font-semibold text-slate-700 underline">
          Ver solicitações →
        </Link>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        Canal: <strong>My Pet Brasil</strong>
        <select disabled className="ml-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-400">
          <option>My Pet Brasil</option>
        </select>
      </p>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      {/* Criar regra */}
      <form action={createRule} className="mb-8 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <label className="text-sm">
          Escopo
          <select name="scope" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="categoria">Categoria</option>
            <option value="sku">SKU específico</option>
          </select>
        </label>
        <label className="text-sm">
          Categoria (se escopo = categoria)
          <select name="categoryId" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Referência do produto (se escopo = SKU)
          <input name="productReference" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          Faixas — JSON <code>[{'{'}"minQty":10,"discountPct":8{'}'}]</code>
          <input name="tiers" defaultValue='[{"minQty":10,"discountPct":8},{"minQty":25,"discountPct":12}]' className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs" />
        </label>
        <label className="text-sm">
          Início da vigência (opcional)
          <input type="datetime-local" name="startsAt" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          Fim da vigência (opcional)
          <input type="datetime-local" name="endsAt" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <div className="md:col-span-2">
          <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
            Criar regra
          </button>
        </div>
      </form>

      {/* Excluir SKU de uma categoria habilitada */}
      <form action={setExcluded} className="mb-8 flex items-end gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <label className="text-sm">
          Excluir SKU do Balcão (referência)
          <input name="productReference" className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
          Excluir SKU
        </button>
      </form>

      <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-4 py-3">Escopo</th>
            <th className="px-4 py-3">Alvo</th>
            <th className="px-4 py-3">Faixas</th>
            <th className="px-4 py-3">Vigência</th>
            <th className="px-4 py-3">Ativa</th>
            <th className="px-4 py-3"></th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="px-4 py-3">{r.scope}</td>
              <td className="px-4 py-3">
                {r.scope === "categoria" ? catName.get(r.category_id ?? "") ?? r.category_id : r.product_reference}
                {r.excluded && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">excluído</span>}
              </td>
              <td className="px-4 py-3">
                {(r.balcao_rule_tiers ?? [])
                  .slice()
                  .sort((a, b) => a.min_qty - b.min_qty)
                  .map((t) => `${t.min_qty}+ (−${t.discount_pct}%)`)
                  .join(" · ") || "—"}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {r.starts_at ? new Date(r.starts_at).toLocaleDateString("pt-BR") : "—"} …{" "}
                {r.ends_at ? new Date(r.ends_at).toLocaleDateString("pt-BR") : "—"}
              </td>
              <td className="px-4 py-3">{r.active ? "sim" : "não"}</td>
              <td className="px-4 py-3">
                {!r.excluded && (
                  <Link href={`/balcao/${r.id}`} className="font-semibold text-slate-700 underline">
                    Editar
                  </Link>
                )}
              </td>
              <td className="px-4 py-3">
                <form action={deleteRule}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="font-semibold text-red-600 hover:underline">Excluir</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Adicionar o item de sidebar**

Modify `apps/admin/app/(dashboard)/layout.tsx` — depois do bloco "Marketing / Banners", dentro do `<nav>`:

```tsx
<div className="mt-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
  Balcão de Negócios
</div>
<Link href="/balcao" className="rounded-lg px-3 py-2 pl-6 text-sm font-medium text-slate-600 hover:bg-slate-100">
  Regras
</Link>
<Link href="/balcao/solicitacoes" className="rounded-lg px-3 py-2 pl-6 text-sm font-medium text-slate-600 hover:bg-slate-100">
  Solicitações
</Link>
```

- [ ] **Step 5: Build + lint**

Run: `pnpm --filter admin build`
Expected: PASS. Rotas `/balcao` e `/balcao/solicitacoes` (esta ainda 404 até a Task 12) no output.
Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "apps/admin/app/(dashboard)/balcao/actions.ts" "apps/admin/app/(dashboard)/balcao/page.tsx" "apps/admin/app/(dashboard)/layout.tsx"
git commit -m "feat(admin): módulo de regras do Balcão + item de sidebar"
```

---

## Task 12: apps/admin — edição de regra, faixas e prévia

**Files:**
- Create: `apps/admin/app/(dashboard)/balcao/[id]/page.tsx`
- Modify: `apps/admin/app/(dashboard)/balcao/actions.ts` (adicionar `updateRule`)

**Interfaces:**
- Consumes: `requireAdminSession`; `updateTag`; `redirect`; `notFound` de `next/navigation`; `z`; `parseTiersInput`, `previewUnitPrice` de `@/lib/balcao`; `getHubClient` de `@mypet/core/supabase`.
- Produces: `updateRule(id: string, formData: FormData): Promise<void>` — atualiza `active`, vigência e substitui as faixas (delete + insert), `updateTag("balcao")`.

- [ ] **Step 1: Adicionar `updateRule` em `actions.ts`**

Append a `apps/admin/app/(dashboard)/balcao/actions.ts`:

```ts
const UpdateRuleSchema = z.object({
  active: z.boolean(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
});

export async function updateRule(id: string, formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();

  const parsed = UpdateRuleSchema.safeParse({
    active: formData.get("active") === "on",
    startsAt: formData.get("startsAt") ? String(formData.get("startsAt")) : null,
    endsAt: formData.get("endsAt") ? String(formData.get("endsAt")) : null,
  });
  if (!parsed.success) redirect(`/balcao/${id}?error=dados_invalidos`);

  let rawTiers: { minQty: unknown; discountPct: unknown }[] = [];
  try {
    rawTiers = JSON.parse(String(formData.get("tiers") ?? "[]"));
  } catch {
    redirect(`/balcao/${id}?error=faixas_invalidas`);
  }
  const tiersResult = parseTiersInput(rawTiers);
  if ("error" in tiersResult) redirect(`/balcao/${id}?error=faixas_invalidas`);
  if (tiersResult.tiers.length === 0) redirect(`/balcao/${id}?error=sem_faixas`);

  const { error: updError } = await supabase
    .from("balcao_rules")
    .update({
      active: parsed.data.active,
      starts_at: parsed.data.startsAt || null,
      ends_at: parsed.data.endsAt || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updError) {
    console.error("[admin/balcao] erro ao atualizar regra:", updError.message);
    redirect(`/balcao/${id}?error=falha_ao_salvar`);
  }

  await supabase.from("balcao_rule_tiers").delete().eq("rule_id", id);
  const { error: tiersError } = await supabase.from("balcao_rule_tiers").insert(
    tiersResult.tiers.map((t) => ({ rule_id: id, min_qty: t.minQty, discount_pct: t.discountPct })),
  );
  if (tiersError) {
    console.error("[admin/balcao] erro ao regravar faixas:", tiersError.message);
    redirect(`/balcao/${id}?error=falha_ao_salvar`);
  }

  updateTag("balcao");
  redirect("/balcao");
}
```

- [ ] **Step 2: Implementar `[id]/page.tsx` (edição + prévia)**

Create `apps/admin/app/(dashboard)/balcao/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getCategories } from "@mypet/core/catalog";
import { getHubClient } from "@mypet/core/supabase";
import { requireAdminSession } from "@/lib/auth";
import { previewUnitPrice } from "@/lib/balcao";
import { updateRule } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  dados_invalidos: "Dados inválidos. Revise os campos.",
  faixas_invalidas: "As faixas informadas são inválidas.",
  sem_faixas: "Adicione ao menos uma faixa.",
  falha_ao_salvar: "Não foi possível salvar. Tente novamente.",
};

export default async function EditBalcaoRulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; previewQty?: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const { error, previewQty } = await searchParams;

  const { data } = await getHubClient()
    .from("balcao_rules")
    .select(
      "id, scope, category_id, product_reference, excluded, active, starts_at, ends_at, balcao_rule_tiers(min_qty, discount_pct)",
    )
    .eq("id", id)
    .single();
  if (!data) notFound();

  const rule = data as {
    id: string;
    scope: "categoria" | "sku";
    category_id: string | null;
    product_reference: string | null;
    active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    balcao_rule_tiers: { min_qty: number; discount_pct: number }[] | null;
  };

  const categories = await getCategories();
  const alvo =
    rule.scope === "categoria"
      ? categories.find((c) => c.id === rule.category_id)?.name ?? rule.category_id
      : rule.product_reference;

  const tiers = (rule.balcao_rule_tiers ?? [])
    .map((t) => ({ minQty: t.min_qty, discountPct: t.discount_pct }))
    .sort((a, b) => a.minQty - b.minQty);
  const tiersJson = JSON.stringify(tiers);

  // Prévia com preço-base do ERP (por referência). Só quando escopo = sku.
  let previewBase: number | null = null;
  if (rule.scope === "sku" && rule.product_reference) {
    const { data: p } = await getHubClient()
      .from("v_precos_erp")
      .select("preco")
      .eq("reference", rule.product_reference)
      .maybeSingle();
    previewBase = p?.preco != null ? Number(p.preco) : null;
  }
  const qty = Number(previewQty) > 0 ? Math.floor(Number(previewQty)) : 15;
  const preview = previewBase != null ? previewUnitPrice(previewBase, tiers, qty) : null;
  const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  return (
    <div className="max-w-xl">
      <h1 className="mb-2 text-xl font-bold text-slate-800">Editar regra do Balcão</h1>
      <p className="mb-6 text-sm text-slate-500">
        {rule.scope} · <strong>{alvo}</strong>
      </p>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={updateRule.bind(null, id)} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={rule.active} /> Regra ativa
        </label>
        <label className="text-sm">
          Faixas (JSON)
          <input name="tiers" defaultValue={tiersJson} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs" />
        </label>
        <label className="text-sm">
          Início da vigência
          <input type="datetime-local" name="startsAt" defaultValue={rule.starts_at?.slice(0, 16) ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          Fim da vigência
          <input type="datetime-local" name="endsAt" defaultValue={rule.ends_at?.slice(0, 16) ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Salvar
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-2 text-sm font-bold text-slate-700">Prévia</h2>
        {rule.scope !== "sku" ? (
          <p className="text-sm text-slate-500">Prévia disponível apenas para regras de SKU (preço-base do ERP por referência).</p>
        ) : previewBase == null ? (
          <p className="text-sm text-slate-500">Sem preço no espelho do ERP para <code>{rule.product_reference}</code>.</p>
        ) : (
          <form method="get" className="text-sm text-slate-700">
            <p>Preço-base ERP: <strong>{brl(previewBase)}</strong></p>
            <label className="mt-2 block">
              Quantidade para simular
              <input name="previewQty" type="number" min={1} defaultValue={qty} className="ml-2 w-24 rounded border border-slate-300 px-2 py-1" />
            </label>
            <button type="submit" className="mt-2 rounded-lg bg-slate-200 px-3 py-1 text-xs font-semibold">Recalcular</button>
            {preview && (
              <div className="mt-3">
                <p>Faixa atingida: <strong>{preview.tierMinQty ? `${preview.tierMinQty}+` : "nenhuma"}</strong> (−{preview.volumePct}%)</p>
                <p>Unitário com retirada/frete próprio (−5%): <strong>{brl(preview.unitPriceWithLogistics)}</strong></p>
                <p className="text-slate-500">Sem vantagem logística: {brl(preview.unitPriceNoLogistics)}</p>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build + lint**

Run: `pnpm --filter admin build`
Expected: PASS.
Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/admin/app/(dashboard)/balcao/[id]/page.tsx" "apps/admin/app/(dashboard)/balcao/actions.ts"
git commit -m "feat(admin): edição de regra do Balcão com faixas e prévia"
```

---

## Task 13: apps/admin — fila de solicitações (lista, detalhe, ações)

**Files:**
- Create: `apps/admin/app/(dashboard)/balcao/solicitacoes/page.tsx`
- Create: `apps/admin/app/(dashboard)/balcao/solicitacoes/[id]/page.tsx`
- Create: `apps/admin/app/(dashboard)/balcao/solicitacoes/actions.ts`

**Interfaces:**
- Consumes: `requireAdminSession` (dá `supabase` + `userId`); `getBalcaoRequests`, `getBalcaoRequestById`, `updateBalcaoRequestStatus`, tipos de `@mypet/core/balcao-server`; `redirect`, `notFound` de `next/navigation`; `z`.
- Produces (em `actions.ts`):
  - `advanceStatus(formData: FormData): Promise<void>` — lê `id`, `action` (`em_analise` | `aprovada` | `recusada` | `expirada`), `payload` opcional (`motivo`/`justificativa` em texto). Chama `updateBalcaoRequestStatus` com `actorId = userId`. `redirect(\`/balcao/solicitacoes/${id}\`)`.
  - `adjustRequest(formData: FormData): Promise<void>` — `id` + `justificativa` (obrigatória) + `ajustes` (JSON livre com as alterações por linha). Chama `updateBalcaoRequestStatus` com `action: "ajustada"` e `payload: { justificativa, ajustes }`. **Não** altera `balcao_request_items`.

- [ ] **Step 1: Implementar `actions.ts`**

Create `apps/admin/app/(dashboard)/balcao/solicitacoes/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { updateBalcaoRequestStatus } from "@mypet/core/balcao-server";

const AdvanceSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["em_analise", "aprovada", "recusada", "expirada"]),
  motivo: z.string().nullable(),
});

export async function advanceStatus(formData: FormData): Promise<void> {
  const { supabase, userId } = await requireAdminSession();
  const parsed = AdvanceSchema.safeParse({
    id: formData.get("id"),
    action: formData.get("action"),
    motivo: formData.get("motivo") ? String(formData.get("motivo")) : null,
  });
  if (!parsed.success) return;

  if (parsed.data.action === "recusada" && !parsed.data.motivo?.trim()) {
    redirect(`/balcao/solicitacoes/${parsed.data.id}?error=motivo_obrigatorio`);
  }

  const { error } = await updateBalcaoRequestStatus(supabase, {
    id: parsed.data.id,
    actorId: userId,
    action: parsed.data.action,
    payload: parsed.data.motivo?.trim() ? { motivo: parsed.data.motivo.trim() } : undefined,
  });
  if (error) {
    redirect(`/balcao/solicitacoes/${parsed.data.id}?error=falha`);
  }
  redirect(`/balcao/solicitacoes/${parsed.data.id}`);
}

const AdjustSchema = z.object({
  id: z.string().uuid(),
  justificativa: z.string().min(1),
  ajustes: z.string().min(1),
});

export async function adjustRequest(formData: FormData): Promise<void> {
  const { supabase, userId } = await requireAdminSession();
  const parsed = AdjustSchema.safeParse({
    id: formData.get("id"),
    justificativa: String(formData.get("justificativa") ?? "").trim(),
    ajustes: String(formData.get("ajustes") ?? "").trim(),
  });
  if (!parsed.success) {
    redirect(`/balcao/solicitacoes/${formData.get("id")}?error=justificativa_obrigatoria`);
  }

  const { error } = await updateBalcaoRequestStatus(supabase, {
    id: parsed.data.id,
    actorId: userId,
    action: "ajustada",
    payload: { justificativa: parsed.data.justificativa, ajustes: parsed.data.ajustes },
  });
  if (error) {
    redirect(`/balcao/solicitacoes/${parsed.data.id}?error=falha`);
  }
  redirect(`/balcao/solicitacoes/${parsed.data.id}`);
}
```

- [ ] **Step 2: Implementar a lista `solicitacoes/page.tsx`**

Create `apps/admin/app/(dashboard)/balcao/solicitacoes/page.tsx`:

```tsx
import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { getBalcaoRequests, type BalcaoRequestStatus } from "@mypet/core/balcao-server";

const STATUSES: BalcaoRequestStatus[] = [
  "enviada",
  "em_analise",
  "aprovada",
  "ajustada",
  "recusada",
  "expirada",
];

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { status } = await searchParams;
  const active = STATUSES.includes(status as BalcaoRequestStatus)
    ? (status as BalcaoRequestStatus)
    : undefined;

  const rows = await getBalcaoRequests(supabase, { status: active });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Balcão — Solicitações</h1>
        <Link href="/balcao" className="text-sm font-semibold text-slate-700 underline">← Regras</Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/balcao/solicitacoes" className={`rounded-full px-3 py-1 text-xs font-semibold ${!active ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>
          Todas
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/balcao/solicitacoes?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${active === s ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Comprador</th>
            <th className="px-4 py-3">Logística</th>
            <th className="px-4 py-3">Total estimado</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhuma solicitação.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleString("pt-BR")}</td>
              <td className="px-4 py-3">
                {r.buyer.empresa ?? r.buyer.nome ?? "—"}<br />
                <span className="text-xs text-slate-400">{r.buyer.whatsapp}{r.buyer.cnpj ? ` · ${r.buyer.cnpj}` : ""}</span>
              </td>
              <td className="px-4 py-3">{r.logistics === "retirada" ? "Retirada" : "Frete próprio"}</td>
              <td className="px-4 py-3">{brl(r.totalEstimated)}</td>
              <td className="px-4 py-3">{r.status}</td>
              <td className="px-4 py-3">
                <Link href={`/balcao/solicitacoes/${r.id}`} className="font-semibold text-slate-700 underline">Abrir</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Implementar o detalhe `solicitacoes/[id]/page.tsx`**

Create `apps/admin/app/(dashboard)/balcao/solicitacoes/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { getBalcaoRequestById } from "@mypet/core/balcao-server";
import { advanceStatus, adjustRequest } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  motivo_obrigatorio: "Informe o motivo da recusa.",
  justificativa_obrigatoria: "Informe a justificativa e os ajustes.",
  falha: "Não foi possível concluir a ação.",
};

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export default async function SolicitacaoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { id } = await params;
  const { error } = await searchParams;

  const req = await getBalcaoRequestById(supabase, id);
  if (!req) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-bold text-slate-800">Solicitação {req.id.slice(0, 8)}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {new Date(req.createdAt).toLocaleString("pt-BR")} · status <strong>{req.status}</strong> ·{" "}
        {req.logistics === "retirada" ? "Retirada" : "Frete próprio"}
      </p>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-bold text-slate-700">Comprador (snapshot)</h2>
        <p>{req.buyer.empresa ?? "—"} · {req.buyer.nome ?? "—"}</p>
        <p className="text-slate-500">{req.buyer.whatsapp}{req.buyer.cnpj ? ` · CNPJ ${req.buyer.cnpj}` : ""}</p>
        {req.note && <p className="mt-2 rounded bg-slate-50 p-2 text-slate-600">Obs.: {req.note}</p>}
      </div>

      <table className="mb-2 w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-3 py-2">Produto</th>
            <th className="px-3 py-2">Qtd</th>
            <th className="px-3 py-2">Base</th>
            <th className="px-3 py-2">Faixa</th>
            <th className="px-3 py-2">−vol.</th>
            <th className="px-3 py-2">−log.</th>
            <th className="px-3 py-2">Unit. est.</th>
            <th className="px-3 py-2">Total linha</th>
          </tr>
        </thead>
        <tbody>
          {req.items.map((it) => (
            <tr key={it.productId} className="border-b border-slate-100">
              <td className="px-3 py-2">{it.productName}<br /><span className="text-xs text-slate-400">{it.productReference}</span></td>
              <td className="px-3 py-2">{it.qty}</td>
              <td className="px-3 py-2">{brl(it.basePrice)}</td>
              <td className="px-3 py-2">{it.tierMinQty ? `${it.tierMinQty}+` : "—"}</td>
              <td className="px-3 py-2">{it.volumeDiscountPct}%</td>
              <td className="px-3 py-2">{it.logisticsDiscountPct}%</td>
              <td className="px-3 py-2">{brl(it.unitPrice)}</td>
              <td className="px-3 py-2">{brl(it.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mb-6 text-right text-sm font-bold text-slate-800">Total estimado: {brl(req.totalEstimated)}</p>

      <div className="mb-6 flex flex-wrap gap-3">
        {(["em_analise", "aprovada", "expirada"] as const).map((a) => (
          <form key={a} action={advanceStatus}>
            <input type="hidden" name="id" value={req.id} />
            <input type="hidden" name="action" value={a} />
            <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
              Marcar {a}
            </button>
          </form>
        ))}
        <form action={advanceStatus} className="flex items-end gap-2">
          <input type="hidden" name="id" value={req.id} />
          <input type="hidden" name="action" value="recusada" />
          <label className="text-sm">
            Motivo da recusa
            <input name="motivo" className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Recusar</button>
        </form>
      </div>

      <form action={adjustRequest} className="mb-8 grid gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="id" value={req.id} />
        <h2 className="text-sm font-bold text-slate-700">Ajustar (não altera o snapshot original)</h2>
        <label className="text-sm">
          Justificativa
          <input name="justificativa" className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          Ajustes (texto livre: linha, nova qtd, novo preço…)
          <textarea name="ajustes" rows={3} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="justify-self-start rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
          Registrar ajuste
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-bold text-slate-700">Histórico</h2>
        <ul className="space-y-1">
          {req.events.map((ev, i) => (
            <li key={i} className="text-slate-600">
              <span className="text-slate-400">{new Date(ev.createdAt).toLocaleString("pt-BR")}</span> — <strong>{ev.action}</strong>
              {ev.payload ? <> · <code className="text-xs">{JSON.stringify(ev.payload)}</code></> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build + lint**

Run: `pnpm --filter admin build`
Expected: PASS. Rotas `/balcao/solicitacoes` e `/balcao/solicitacoes/[id]` no output.
Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 5: Verificação manual do fluxo ponta a ponta**

1. `pnpm dev:all`.
2. No admin: criar uma regra de categoria com faixas `10+ (8%)`, `25+ (12%)`.
3. No mypet (`/balcao`, logado): montar solicitação com 12 un. de um produto elegível + retirada → total estimado reflete `base × 0.92 × 0.95`; enviar.
4. No admin (`/balcao/solicitacoes`): a solicitação aparece como `enviada`; abrir o detalhe, conferir o snapshot, marcar `em_analise` e `aprovada`; conferir o histórico com dois eventos + o `criada`.

Expected: todos os passos funcionam; o snapshot no detalhe bate com o cálculo do site.

- [ ] **Step 6: Commit**

```bash
git add "apps/admin/app/(dashboard)/balcao/solicitacoes"
git commit -m "feat(admin): fila de solicitações do Balcão com ações e histórico"
```

---

## Self-Review

**1. Spec coverage:**

| Requisito do spec | Task |
| --- | --- |
| 5 tabelas + RLS em `hub_catalogo` | Task 1 |
| `balcao.ts` funções puras + testes | Task 2 |
| `getBalcaoRules` cacheado (tag `balcao`) | Task 3 |
| `getBalcaoEligibleProducts` + `buildEstimate` | Task 4 |
| `createBalcaoRequest` (snapshot imutável + evento `criada`) | Task 5 |
| Leituras admin + `updateBalcaoRequestStatus` | Task 6 |
| Server Action com recálculo no servidor + piso de envio | Task 7 |
| Área `/balcao` (cliente logado, estimativa, confirmação, disclaimer) | Task 8 |
| Item de navegação + selo na PDP | Task 9 |
| Helpers de validação de faixa + prévia | Task 10 |
| Admin: CRUD de regras (categoria/SKU), exclusão de SKU, vigência, ativar/desativar, `updateTag("balcao")` | Tasks 11–12 |
| Admin: prévia com preço do ERP | Task 12 |
| Admin: fila de solicitações, filtro por status, detalhe do snapshot, aprovar/ajustar/recusar/expirar, histórico de eventos | Task 13 |
| Canal fixo `mypetbrasil` com seletor desabilitado | Task 11 (Step 3) |
| Cascata multiplicativa, faixa por SKU, 5% fixo no código | Task 2 (constante + `computeLine`), Task 4 (`buildEstimate`) |
| Sem "virar pedido", sem e-mail/push, sem acompanhamento no site | Fora do escopo — nenhuma task o adiciona (confirmado) |

Sem lacunas.

**2. Placeholder scan:** nenhum "TBD/TODO/etc." Todos os steps de código trazem o código completo. Os steps de verificação manual descrevem passos concretos e o resultado esperado.

**3. Type consistency:**
- `BalcaoRule` / `BalcaoTier` / `BalcaoLogistics` definidos na Task 2, reusados nas Tasks 3, 4, 5, 7, 10 com os mesmos campos (`minQty`/`discountPct`, `scope`/`categoryId`/`productReference`/`excluded`/`tiers`).
- `BalcaoEligibleProduct` definido na Task 4, consumido nas Tasks 7 e 8 com os mesmos campos (`id`, `name`, `sku`, `brand`, `img`, `categoryId`, `basePrice`, `rule`).
- `createBalcaoRequest` (Task 5) recebe `BalcaoRequestItemInput` com `productReference`/`tierMinQty`/`volumeDiscountPct`/`logisticsDiscountPct`/`unitPrice`/`lineTotal`; a Task 7 monta exatamente esse objeto a partir de `EstimateLine` (Task 4).
- `updateBalcaoRequestStatus` (Task 6) tem `action: Exclude<BalcaoRequestStatus,"enviada"> | "em_analise"`; a Task 13 só passa `em_analise` | `aprovada` | `recusada` | `expirada` | `ajustada`. Consistente.
- `getBalcaoRequestById` (Task 6) devolve `items` e `events`; a Task 13 detalhe consome `req.items[*].{productName,productReference,qty,basePrice,tierMinQty,volumeDiscountPct,logisticsDiscountPct,unitPrice,lineTotal}` e `req.events[*].{createdAt,action,payload}` — todos presentes no tipo.
- `updateTag` / `cacheTag` — a tag literal `"balcao"` é a mesma em `balcao.ts` (Tasks 3–4) e nas actions do admin (Tasks 11–12).
- `SiteNav` ganha `balcaoHref?: string` na Task 9 e é chamado com essa prop nos 5 call sites na mesma task.

**Ponto de atenção registrado para a execução:** na Task 10, Step 1 decide se os helpers `parseTiersInput`/`previewUnitPrice` vivem em `apps/admin/lib/balcao.ts` (se o admin tiver runner de teste) ou em `packages/core/src/balcao.ts` (se não tiver). As Tasks 11–12 importam de `@/lib/balcao`; se a decisão for mover para o core, trocar esses imports para `@mypet/core/balcao`.

---

## Próximo passo após executar todas as tasks

Rodar a bateria final: `pnpm lint && pnpm --filter @mypet/core test && pnpm --filter mypet build && pnpm --filter admin build`. Depois, aplicar a migração `20260830120000_balcao_de_negocios.sql` no projeto Supabase `hub_catalogo` (fluxo fora do repo) e cadastrar as primeiras regras pelo painel.
