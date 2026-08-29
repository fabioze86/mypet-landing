# Acréscimo de preço regional (capital/interior) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que clientes My Pet escolham UF e capital/interior para ver preços acrescidos, enquanto administradores configuram percentuais nacional e por exceção.

**Architecture:** A tabela `regional_price_rules` armazena regras por canal, com uma regra nacional e exceções `(UF, área)`. `@mypet/core/pricing` busca e cacheia as regras e concentra o cálculo puro; um provider de cliente lê/grava somente o cookie `mp_region` e torna a região disponível aos componentes de preço. O admin usa Server Actions autenticadas para mutar regras e o site aplica o percentual somente na renderização, sem alterar carrinho ou pedidos.

**Tech Stack:** Next.js 16.2 App Router com Cache Components (`"use cache"`, `cacheLife`, `cacheTag`, `updateTag`), React 19, TypeScript, Supabase/Postgres/RLS, Zod 4, Vitest e Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-08-28-acrescimo-preco-regional-design.md`

## Global Constraints

- Entregar somente para o canal `mypetbrasil`; o schema deve continuar channel-keyed para extensões futuras.
- `surcharge_pct` é numérico e maior ou igual a zero; descontos, preço por produto/categoria e persistência em `orders`/`buyers` estão fora de escopo.
- A região vem exclusivamente do cookie de cliente `mp_region` no formato `UF:area`, com `Max-Age` de 180 dias, `SameSite=Lax` e sem `HttpOnly`.
- Sem região válida, esconder/travar apenas preços existentes; `salePrice === null` continua como `Preço sob consulta` sem gate.
- Preço final: `Math.round(base * (1 + pct / 100) * 100) / 100`, formatado em BRL; exceção exata vence a regra nacional, e ausência de regra vale `0`.
- Regras públicas permitem somente `SELECT` à anon key; acesso completo é limitado a `admin_users` autenticados.
- O fetch de regras usa a tag `regional-pricing`, separada de `catalog`, com `cacheLife("days")`; cada mutação administrativa chama `updateTag("regional-pricing")`.
- A invalidação não atravessa os deployments independentes de `apps/admin` e `apps/mypet`; a propagação pode demorar o ciclo de cache/redeploy, conforme aceito no spec.
- Não alterar os arquivos já modificados pelo usuário: `apps/mypet/package.json`, `pnpm-lock.yaml` e `.github/skills/`.

---

## File Structure

- Create: `supabase/migrations/20260828130000_regional_price_rules.sql` — tabela, constraints, seed e políticas RLS.
- Create: `packages/core/src/pricing.ts` — tipos de região/regra, parser/formatador, fetch cacheado e helpers puros de preço.
- Create: `packages/core/src/pricing.test.ts` — cobertura dos helpers e do parser de cookie.
- Create: `apps/admin/lib/regional-pricing.ts` — constantes das 27 UFs, schemas Zod e helpers testáveis da tela/admin.
- Create: `apps/admin/lib/regional-pricing.test.ts` — validações e mensagem de duplicidade.
- Create: `apps/admin/app/(dashboard)/precos/actions.ts` — Server Actions autenticadas para CRUD da regra padrão/exceções.
- Create: `apps/admin/app/(dashboard)/precos/page.tsx` — Server Component que carrega e apresenta as regras do canal fixo.
- Create: `apps/admin/app/(dashboard)/precos/precos-client.tsx` — formulário client para editar regra padrão e linhas de exceção.
- Modify: `apps/admin/app/(dashboard)/layout.tsx` — item de navegação `Preços` imediatamente após `Categorias`.
- Create: `packages/core/src/components/region-pricing.tsx` — provider/context, modal bloqueante e indicador de região.
- Modify: `packages/core/src/components/lead-gate.tsx` — `PriceLockSlot` aceita preço numérico, aplica região e abre o seletor.
- Modify: `packages/core/src/components/product-card.tsx` — passa `salePrice` ao slot, sem usar label estático para o My Pet.
- Modify: `packages/core/src/components/product-variant-panel.tsx` — usa o slot regional no preço da PDP com/sem variantes.
- Modify: `packages/core/src/components/variant-table.tsx` — aplica o mesmo slot para cada variante de tabela.
- Modify: `apps/mypet/app/page.tsx` and `apps/mypet/app/produtos/[id]/page.tsx` — buscam regras no server e envolvem conteúdo com `RegionPricingProvider`.
- Modify: `apps/mypet/app/cotacao/actions.ts` — lê cookie e retorna a nota regional calculada com o resultado da cotação.
- Modify: `apps/mypet/app/cotacao/cotacao-content.tsx` — repassa a nota retornada ao formatter da mensagem.
- Modify: `packages/core/src/whatsapp.ts` and `packages/core/src/whatsapp.test.ts` — adiciona `regionNote` opcional sem quebrar os outros apps.

### Task 1: Criar armazenamento seguro das regras regionais

**Files:**
- Create: `supabase/migrations/20260828130000_regional_price_rules.sql`
- Test: banco Supabase local/remoto de desenvolvimento, via migration status e consultas SQL

**Interfaces:**
- Consumes: enum `public.channel` já usado por `product_channel_prices`.
- Produces: `public.regional_price_rules(id uuid, channel channel, uf text nullable, area text nullable, surcharge_pct numeric, updated_at timestamptz)` para core e admin.

- [ ] **Step 1: Escrever a migration com a tabela, restrições e seed nacional**

```sql
create table public.regional_price_rules (
  id uuid primary key default gen_random_uuid(),
  channel public.channel not null,
  uf text,
  area text,
  surcharge_pct numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (channel, uf, area),
  check ((uf is null and area is null) or (uf is not null and area is not null)),
  check (area is null or area in ('capital', 'interior')),
  check (surcharge_pct >= 0)
);

insert into public.regional_price_rules (channel, uf, area, surcharge_pct)
values ('mypetbrasil', null, null, 0);
```

- [ ] **Step 2: Adicionar RLS e as três políticas necessárias**

```sql
alter table public.regional_price_rules enable row level security;

create policy "anon can read regional price rules"
on public.regional_price_rules for select to anon using (true);

create policy "admins manage regional price rules"
on public.regional_price_rules for all to authenticated
using (auth.uid() in (select id from public.admin_users))
with check (auth.uid() in (select id from public.admin_users));
```

- [ ] **Step 3: Aplicar a migration no ambiente de desenvolvimento e verificar o schema**

Run: `supabase db push`

Expected: a migration é aplicada sem erro e a tabela passa a existir.

```sql
select channel, uf, area, surcharge_pct
from public.regional_price_rules
where channel = 'mypetbrasil';
```

Expected: exatamente uma linha com `uf` e `area` nulos e `surcharge_pct = 0`. A constraint `UNIQUE NULLS NOT DISTINCT` também impede uma segunda regra nacional para o canal.

- [ ] **Step 4: Verificar as regras de integridade e RLS**

Run as papel com permissão de migração: tente inserir `('mypetbrasil', 'RJ', null, 1)` e `('mypetbrasil', null, 'capital', 1)` em uma transação a ser revertida.

Expected: ambas falham pelo `CHECK`; a anon key consegue `SELECT`, mas `INSERT`, `UPDATE` e `DELETE` retornam negação de RLS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260828130000_regional_price_rules.sql
git commit -m "feat(db): add regional price rules"
```

### Task 2: Centralizar tipos, resolução e cálculo de preço no core

**Files:**
- Create: `packages/core/src/pricing.ts`
- Create: `packages/core/src/pricing.test.ts`
- Modify: `packages/core/package.json` (exportar `./pricing`)

**Interfaces:**
- Consumes: `getHubClient()` e o contrato da Task 1.
- Produces: `type RegionalArea = "capital" | "interior"`; `type Region = { uf: Uf; area: RegionalArea }`; `type RegionalPriceRule`; `const UFS`; `parseRegion(value: string | null | undefined): Region | null`; `formatRegion(region: Region): string`; `getRegionalPricing(channel: string): Promise<RegionalPriceRule[]>`; `resolveSurcharge(rules, uf, area): number`; `applySurcharge(base, pct): number`.

- [ ] **Step 1: Escrever testes falhando para precedência, fallback, arredondamento e cookie inválido**

```ts
it("prioriza a exceção exata sobre a regra nacional", () => {
  expect(resolveSurcharge([
    { channel: "mypetbrasil", uf: null, area: null, surchargePct: 3 },
    { channel: "mypetbrasil", uf: "RJ", area: "interior", surchargePct: 8 },
  ], "RJ", "interior")).toBe(8);
});

it("usa zero sem regra nacional e arredonda a centavos", () => {
  expect(resolveSurcharge([], "BA", "capital")).toBe(0);
  expect(applySurcharge(19.99, 8)).toBe(21.59);
});

it("rejeita região fora das 27 UFs", () => {
  expect(parseRegion("XX:capital")).toBeNull();
});
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `pnpm --filter @mypet/core test -- pricing.test.ts`

Expected: FAIL porque o módulo `./pricing` ainda não existe.

- [ ] **Step 3: Implementar o contrato puro e a leitura cacheada**

```ts
export async function getRegionalPricing(channel: string): Promise<RegionalPriceRule[]> {
  "use cache";
  cacheLife("days");
  cacheTag("regional-pricing");
  const { data, error } = await getHubClient()
    .from("regional_price_rules")
    .select("channel, uf, area, surcharge_pct")
    .eq("channel", channel);
  if (error) return [];
  return (data ?? []).map((row) => ({
    channel: row.channel,
    uf: row.uf,
    area: row.area as RegionalArea | null,
    surchargePct: Number(row.surcharge_pct),
  }));
}

export function applySurcharge(base: number, pct: number): number {
  return pct === 0 ? base : Math.round(base * (1 + pct / 100) * 100) / 100;
}
```

- [ ] **Step 4: Completar `resolveSurcharge`, `parseRegion` e `formatRegion` sem depender de APIs do navegador**

```ts
export function resolveSurcharge(rules: RegionalPriceRule[], uf: Uf, area: RegionalArea): number {
  return rules.find((rule) => rule.uf === uf && rule.area === area)?.surchargePct
    ?? rules.find((rule) => rule.uf === null && rule.area === null)?.surchargePct
    ?? 0;
}
```

Ensure `parseRegion` accepts only exactly `UF:capital` or `UF:interior`; `formatRegion({ uf: "RJ", area: "interior" })` returns `RJ — Interior`.

- [ ] **Step 5: Rodar os testes do core**

Run: `pnpm --filter @mypet/core test -- pricing.test.ts`

Expected: PASS, incluindo base sem acréscimo e fallback nacional.

- [ ] **Step 6: Commit**

```bash
git add packages/core/package.json packages/core/src/pricing.ts packages/core/src/pricing.test.ts
git commit -m "feat(core): add regional pricing helpers"
```

### Task 3: Implementar gestão de preços no painel administrativo

**Files:**
- Create: `apps/admin/lib/regional-pricing.ts`
- Create: `apps/admin/lib/regional-pricing.test.ts`
- Create: `apps/admin/app/(dashboard)/precos/actions.ts`
- Create: `apps/admin/app/(dashboard)/precos/page.tsx`
- Create: `apps/admin/app/(dashboard)/precos/precos-client.tsx`
- Modify: `apps/admin/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `UFS`, `RegionalArea`, `RegionalPriceRule` de `@mypet/core/pricing`; `requireAdminSession()`; tabela da Task 1.
- Produces: rotas `/precos` e quatro Server Actions: `updateDefaultRule(formData)`, `createRule(prevState, formData)`, `updateRule(prevState, formData)`, `deleteRule(formData)`.

- [ ] **Step 1: Escrever testes de schema e conflito antes de criar as actions**

```ts
it("aceita as 27 UFs e percentual zero ou positivo", () => {
  expect(exceptionRuleSchema.safeParse({ uf: "RJ", area: "interior", surchargePct: "8" }).success).toBe(true);
});

it("rejeita percentual negativo e UF inválida", () => {
  expect(exceptionRuleSchema.safeParse({ uf: "XX", area: "capital", surchargePct: "-1" }).success).toBe(false);
});

it("explica a exceção duplicada", () => {
  expect(duplicateRuleMessage("RJ", "interior")).toBe("Já existe exceção para RJ – Interior");
});
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `pnpm --filter admin test -- regional-pricing.test.ts`

Expected: FAIL porque `apps/admin/lib/regional-pricing.ts` ainda não existe.

- [ ] **Step 3: Implementar schemas e constantes compartilhadas da tela**

```ts
export const defaultRuleSchema = z.object({ surchargePct: z.coerce.number().finite().min(0) });
export const exceptionRuleSchema = defaultRuleSchema.extend({
  uf: z.enum(UFS),
  area: z.enum(["capital", "interior"]),
});
export const ADMIN_CHANNEL = "mypetbrasil";
```

Use `duplicateRuleMessage(uf, area)` para a cópia exata do spec, com `Capital`/`Interior` formatados por `formatRegion`.

- [ ] **Step 4: Implementar as Server Actions com autenticação, Zod e `updateTag`**

```ts
export async function updateDefaultRule(formData: FormData) {
  const { supabase } = await requireAdminSession();
  const parsed = defaultRuleSchema.safeParse({ surchargePct: formData.get("surchargePct") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { error } = await supabase.from("regional_price_rules")
    .update({ surcharge_pct: parsed.data.surchargePct, updated_at: new Date().toISOString() })
    .eq("channel", ADMIN_CHANNEL).is("uf", null).is("area", null);
  if (error) return { error: "Não foi possível salvar o acréscimo padrão." };
  updateTag("regional-pricing");
  return undefined;
}
```

For `createRule`, map unique-constraint error `23505` to `duplicateRuleMessage`; for update/delete validate UUID `id`, scope every mutation to `channel = ADMIN_CHANNEL`, and never trust a channel from the form.

- [ ] **Step 5: Criar a página e o formulário client**

The Server Component must call `requireAdminSession()`, select and order `id, channel, uf, area, surcharge_pct` for `mypetbrasil`, split the null/null default from exceptions, and pass serializable rows to `PrecosClient`.

`PrecosClient` must render: disabled select labelled `Canal: My Pet Brasil`; a default-percent form; an exceptions table with UF select, Capital/Interior select, numeric `step="0.01" min="0"` input, save/remove controls; and an `＋ Adicionar exceção` row. Bind create/update forms with `useActionState` so validation and duplicate messages remain on the page.

- [ ] **Step 6: Adicionar a rota à sidebar**

```ts
const NAV = [
  { href: "/clientes", label: "Clientes" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/categorias", label: "Categorias" },
  { href: "/precos", label: "Preços" },
  { href: "/funcionalidades", label: "Funcionalidades" },
];
```

- [ ] **Step 7: Rodar testes e verificação do painel**

Run: `pnpm --filter admin test -- regional-pricing.test.ts && pnpm --filter admin build`

Expected: PASS; em `/precos`, atualizar padrão, criar/remover exceção e tentar duplicar `RJ/Interior` confirma os estados descritos no spec.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/lib/regional-pricing.ts apps/admin/lib/regional-pricing.test.ts apps/admin/app/(dashboard)/precos apps/admin/app/(dashboard)/layout.tsx
git commit -m "feat(admin): manage regional price rules"
```

### Task 4: Criar provider, seletor bloqueante e exibição regional reutilizável

**Files:**
- Create: `packages/core/src/components/region-pricing.tsx`
- Modify: `packages/core/src/components/lead-gate.tsx`
- Modify: `packages/core/src/components/product-card.tsx`
- Modify: `packages/core/src/components/product-variant-panel.tsx`
- Modify: `packages/core/src/components/variant-table.tsx`

**Interfaces:**
- Consumes: `Region`, `RegionalPriceRule`, `parseRegion`, `resolveSurcharge`, `applySurcharge`, `formatRegion` e `UFS` da Task 2.
- Produces: `RegionPricingProvider({ rules, children })`; `useRegionPricing(): { region: Region | null; surchargePct: number; setRegion(region: Region): void; openSelector(): void }`; `RegionSelectorModal`; `RegionPricingIndicator`; preço regional consistente em card, PDP e variantes.

- [ ] **Step 1: Escrever os testes de componente para os três estados de preço**

Create `packages/core/src/components/region-pricing.test.tsx` and update `packages/core/vitest.config.ts` to include `src/**/*.test.tsx` with `jsdom` only if existing component tests already need it.

```tsx
it("trava preço existente sem cookie e abre modal obrigatório", () => {
  render(<RegionPricingProvider rules={[]}><PriceLockSlot salePrice={10} /></RegionPricingProvider>);
  expect(screen.getByText("Selecione sua região para ver os preços")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("mostra preço acrescido após escolher RJ interior", async () => {
  // rules: default 0, RJ/interior 8; selecionar ambos e confirmar
  expect(await screen.findByText("R$ 10,80")).toBeInTheDocument();
});

it("mantém preço sob consulta sem gate", () => {
  render(<RegionPricingProvider rules={[]}><PriceLockSlot salePrice={null} /></RegionPricingProvider>);
  expect(screen.getByText("Preço sob consulta")).toBeInTheDocument();
  expect(screen.queryByText("Selecione sua região para ver os preços")).toBeNull();
});
```

- [ ] **Step 2: Rodar a nova suíte para confirmar a falha**

Run: `pnpm --filter @mypet/core test -- region-pricing.test.tsx`

Expected: FAIL porque `RegionPricingProvider` e o novo contrato de `PriceLockSlot` não existem.

- [ ] **Step 3: Implementar contexto e persistência de cookie no cliente**

Read `document.cookie` na inicialização com `parseRegion`; se inválido, mantenha `region: null`. Em `setRegion`, escreva exatamente:

```ts
document.cookie = `mp_region=${region.uf}:${region.area}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax`;
```

Atualize estado imediatamente após a escrita. O modal abre por padrão quando não houver região válida, não tem botão de fechar e ignora clique no backdrop; o indicador só aparece com região válida e oferece `alterar` para reabrir o modal.

- [ ] **Step 4: Alterar o slot de preço para trabalhar com número bruto**

```tsx
export function PriceLockSlot({ salePrice }: { salePrice: number | null }) {
  const { region, surchargePct, openSelector } = useRegionPricing();
  if (salePrice === null) return <PriceText value="Preço sob consulta" detail="Solicite sua cotação" />;
  if (!region) return <button onClick={openSelector}>🔒 Selecione sua região para ver os preços</button>;
  return <PriceText value={brl.format(applySurcharge(salePrice, surchargePct))} detail="Preço para sua região" />;
}
```

Keep `LeadGateProvider` and `UnlockButton` unchanged. Change `ProductCard` to pass `product.salePrice`, and replace every direct `priceLabel` render in `ProductVariantPanel` and `VariantTable` with this slot so simple products, selected variants and table variants follow the identical gate. Do not change `AddToCartControl` or `CartItem`.

- [ ] **Step 5: Rodar testes do core**

Run: `pnpm --filter @mypet/core test -- region-pricing.test.tsx && pnpm --filter @mypet/core test`

Expected: PASS, including no regression in cart/catalog helpers.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/region-pricing.tsx packages/core/src/components/region-pricing.test.tsx packages/core/src/components/lead-gate.tsx packages/core/src/components/product-card.tsx packages/core/src/components/product-variant-panel.tsx packages/core/src/components/variant-table.tsx packages/core/vitest.config.ts
git commit -m "feat(core): gate prices by selected region"
```

### Task 5: Integrar regras no My Pet e incluir a região na cotação

**Files:**
- Modify: `apps/mypet/app/page.tsx`
- Modify: `apps/mypet/app/produtos/[id]/page.tsx`
- Modify: `apps/mypet/app/cotacao/actions.ts`
- Modify: `apps/mypet/app/cotacao/cotacao-content.tsx`
- Modify: `packages/core/src/whatsapp.ts`
- Modify: `packages/core/src/whatsapp.test.ts`

**Interfaces:**
- Consumes: `getRegionalPricing`, `parseRegion`, `resolveSurcharge`, `formatRegion`, `RegionPricingProvider`, `RegionPricingIndicator` (Tasks 2 and 4); `cookies()` from `next/headers`.
- Produces: home/PDP providers supplied with server-fetched rules; `FinalizeQuoteResult` success includes `regionNote?: string`; `buildQuoteMessage(items, customer, regionNote?)` remains compatible with every existing two-argument caller.

- [ ] **Step 1: Escrever o teste falhando do novo argumento da mensagem**

```ts
it("insere a nota regional sem incluir preço nos itens", () => {
  const message = buildQuoteMessage(items, customer, "Região de entrega: RJ — Interior (acréscimo aplicado: +8%)");
  expect(message).toContain("Região de entrega: RJ — Interior (acréscimo aplicado: +8%)");
  expect(message).not.toContain("R$");
});
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `pnpm --filter @mypet/core test -- whatsapp.test.ts`

Expected: FAIL porque `buildQuoteMessage` ainda recebe dois argumentos.

- [ ] **Step 3: Tornar a nota regional opcional no formatter**

```ts
export function buildQuoteMessage(items: CartItem[], customer: QuoteCustomer, regionNote?: string): string {
  return [
    "Olá! Gostaria de uma cotação de atacado:",
    "",
    ...(regionNote ? [regionNote, ""] : []),
    itemLines,
    "",
    "Meus dados:",
    ...customerLines,
  ].join("\n");
}
```

Keep the existing two-argument test unchanged and make it pass.

- [ ] **Step 4: Buscar regras no server e envolver home/PDP**

In each route, obtain rules with `await getRegionalPricing(clientConfig.catalogChannel)` in the server component and wrap the existing `LeadGateProvider` subtree:

```tsx
<RegionPricingProvider rules={rules}>
  <LeadGateProvider>{/* existing route UI, including RegionPricingIndicator near the catalog top */}</LeadGateProvider>
</RegionPricingProvider>
```

Render `RegionPricingIndicator` immediately above the catalog results on the home page; it is a no-op until a valid cookie is selected. Do not read `cookies()` inside a cached function: the provider reads the non-HttpOnly cookie on the client.

- [ ] **Step 5: Calcular a nota no Server Action e devolvê-la ao cliente**

After validating the buyer and before returning success, use the request cookie and cached rules:

```ts
const region = parseRegion((await cookies()).get("mp_region")?.value);
const rules = await getRegionalPricing(clientConfig.catalogChannel);
const surchargePct = region ? resolveSurcharge(rules, region.uf, region.area) : null;
const regionNote = region && surchargePct !== null
  ? `Região de entrega: ${formatRegion(region)} (acréscimo aplicado: +${surchargePct}%)`
  : undefined;
```

Add `regionNote?: string` to the successful branch of `FinalizeQuoteResult`, return it with `buyer`, then change `CotacaoContent` to call `buildQuoteMessage(cart.items, buyer, result.regionNote)`. This preserves the existing order creation and deliberately does not persist the region.

- [ ] **Step 6: Executar as verificações automatizadas e de navegador**

Run: `pnpm --filter @mypet/core test -- whatsapp.test.ts && pnpm --filter mypet build && pnpm lint`

Expected: all commands pass.

Manual browser acceptance on `pnpm --filter mypet dev`:

- Delete `mp_region`: a card and PDP hide numeric prices and present the non-dismissible selector.
- Choose `RJ` + `Interior`: cards, simple PDP, selected variants and variant-table rows show base × 1.08 rounded to cents; the top indicator says `Preços para RJ — Interior · alterar`.
- Set cookie to `XX:capital`: the selector returns and prices remain hidden.
- Open a product without `salePrice`: it says `Preço sob consulta` and does not open a region gate for that slot.
- Finalize a quotation with a selected region: WhatsApp contains exactly one regional-note line and contains no item price.

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/app/page.tsx apps/mypet/app/produtos/[id]/page.tsx apps/mypet/app/cotacao/actions.ts apps/mypet/app/cotacao/cotacao-content.tsx packages/core/src/whatsapp.ts packages/core/src/whatsapp.test.ts
git commit -m "feat(mypet): apply regional pricing to catalog and quotes"
```

### Task 6: Verificação integrada e documentação de entrega

**Files:**
- Modify: `docs/superpowers/specs/2026-08-28-acrescimo-preco-regional-design.md` only if implementation uncovers a factual divergence; otherwise no documentation edit.

**Interfaces:**
- Consumes: todos os artefatos das Tasks 1–5.
- Produces: evidência de testes/build e confirmação de que o escopo aceito não cresceu.

- [ ] **Step 1: Executar a suíte de testes de cada workspace afetado**

Run: `pnpm --filter @mypet/core test && pnpm --filter admin test`

Expected: PASS, cobrindo helpers de preço, schemas administrativos e mensagem WhatsApp.

- [ ] **Step 2: Executar lint e builds completos afetados**

Run: `pnpm lint && pnpm --filter admin build && pnpm --filter mypet build`

Expected: saída de sucesso dos três comandos, sem erro de Cache Components, Server Action ou tipagem.

- [ ] **Step 3: Fazer a aceitação manual cross-app**

Verify `apps/admin` `/precos` against the default/exceptions requirements and `apps/mypet` against every browser bullet from Task 5. Confirm in Supabase that the anonymous role cannot mutate `regional_price_rules` and that authenticated non-admin users cannot mutate it either.

- [ ] **Step 4: Registrar somente divergências reais**

If no divergence is found, do not change the approved spec. If a factual implementation constraint differs, update the exact section in the spec with the chosen behavior and why; never introduce expansion to other channels, per-product rules, buyer/order persistence, or cross-deploy invalidation.

- [ ] **Step 5: Commit the final verification/documentation change, if any**

```bash
git status --short
git add docs/superpowers/specs/2026-08-28-acrescimo-preco-regional-design.md
git commit -m "docs: record regional pricing delivery notes"
```

Run this commit only when Step 4 made a spec edit; otherwise no empty commit.

## Plan Self-Review

- **Spec coverage:** Task 1 implements the schema, seed and RLS. Task 2 implements cached reads, parsing, precedence and cent rounding. Task 3 covers the fixed-channel admin UI/actions, validation, duplicate feedback, sidebar and cache tag. Task 4 covers cookie/provider/modal/gate/indicator and all price surfaces (card, PDP and variants). Task 5 supplies server rules to the two My Pet routes and the optional quote note without item prices or persistence. Task 6 verifies the stated limitations and all minimum tests.
- **No-placeholder scan:** completed; each task names concrete files, interfaces, commands and expected outcomes.
- **Type consistency:** `Region`, `RegionalArea`, `RegionalPriceRule`, `getRegionalPricing`, `resolveSurcharge`, `applySurcharge`, `RegionPricingProvider`, and `regionNote` are defined before their later consumers.
