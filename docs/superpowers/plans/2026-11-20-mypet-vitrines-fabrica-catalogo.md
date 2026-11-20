# Mypet: vitrines Linha de Fábrica e Catálogo completo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Duas vitrines independentes no app mypet, `/produtos` (portfólio completo, frete por zona de SP)
e `/fabrica` (linha de fábrica, frete grátis Brasil a partir de R$ 299), cada uma com o seu carrinho e
o seu pedido pelo WhatsApp com frete.

**Architecture:** A zona de frete sai do endereço do CNPJ (ReceitaWS), gravado em `buyers`. As regras de
frete são funções puras em `@mypet/core/frete`, com os valores em `apps/mypet/lib/frete.config.ts`. As
duas vitrines usam o mesmo componente de página, configurado por `apps/mypet/lib/vitrines.ts`. O
carrinho e os links ficam separados por contexto React: `CartProvider storageKey` e `VitrinePathProvider`
no layout de `/fabrica`. A finalização recalcula preço e frete no servidor (`priceCart`) antes de gravar
e de montar a mensagem.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents: true`), React 19, Supabase (PostgREST),
Vitest + Testing Library, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-11-20-mypet-vitrines-fabrica-catalogo-design.md`

## Global Constraints

- Antes de usar qualquer API do Next, ler o guia em `apps/mypet/node_modules/next/dist/docs/` (AGENTS.md:
  "This is NOT the Next.js you know").
- Copy visível no mypet: proibido "loja", "atacado" e "cotação" (inclui "Cotação"). A rota interna
  `/fabrica/cotacao` pode existir, mas o texto do link não usa a palavra.
- Preço é sempre o do canal `mypetbrasil`. Produto de fábrica = ligado a `ffa_fabrica` **e** a
  `mypetbrasil`, com preço `mypetbrasil`.
- Fábrica: grátis a partir de R$ 299,00 (subtotal >= 29900 centavos), senão R$ 19,90 fixo, em qualquer
  zona. Só entrega normal.
- Catálogo completo, zonas (mínimo grátis / normal / prioritária): bairros próximos 99,00 / 12,99 / 25,00;
  capital 200,00 / 20,00 / 30,00; grande SP 300,00 / 25,00 / 35,00; interior até 30 km 400,00 / sob
  consulta / não tem; interior além 700,00 / sob consulta / não tem; fora: sob consulta / não tem.
- A prioritária é sempre paga, mesmo com a normal grátis.
- CNPJ não localizado, comprador pendente ou fora de SP → zona `fora`.
- Carrinhos: `mypet_cart` (`/produtos`, `/pedido-rapido`, `/cotacao`) e `mypet_cart_fabrica` (`/fabrica/**`).
- Dinheiro em centavos (inteiros) dentro de `frete.ts`. Em `orders`/`order_items`, reais com 2 casas.
- `/catalogo` continua sendo o Catálogo digital estático. Não mexer na rewrite nem no proxy dele.
- Trabalhar direto na `main`, sem worktree (preferência do Fábio).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Testes: `pnpm --filter @mypet/core test` e `pnpm --filter mypet test` (ambos `vitest run`).

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20261120120000_vitrines_localizacao_frete.sql` | Colunas novas em `buyers` e `orders` |
| `packages/core/src/receitaws.ts` | Consulta pública da ReceitaWS → `localizado` / `nao_localizado` / `indisponivel` |
| `packages/core/src/buyers-server.ts` | `Buyer` com localização; `localizarComprador` |
| `apps/mypet/lib/localizacao.ts` | `agendarLocalizacao(buyer)` com `after()` |
| `scripts/backfill-buyers-localizacao.ts` | Preenche compradores antigos pelo cache do Hub Clientes |
| `packages/core/src/frete.ts` | `classificarZona`, `calcularFrete`, tipos e rótulos |
| `apps/mypet/lib/frete.config.ts` | Valores, faixas de CEP e listas de municípios |
| `packages/core/src/retail-checkout-server.ts` | `priceCart` com `alsoInChannel` e `checkStock` |
| `packages/core/src/orders-server.ts` | `createOrder` grava `unit_price`, `vitrine` e frete |
| `packages/core/src/components/cart-provider.tsx` | `storageKey` |
| `packages/core/src/components/vitrine-path.tsx` | `VitrinePathProvider` / `useVitrinePath` |
| `packages/core/src/catalog.ts` | `alsoInChannel` nas consultas; `isProductInChannel` |
| `packages/core/src/components/catalog-section.tsx` | Repassa `alsoInChannel` e `categoryId` |
| `apps/mypet/lib/vitrines.ts` | Configuração das duas vitrines |
| `apps/mypet/lib/zona.ts` | `zonaDoComprador(buyer)` |
| `apps/mypet/app/cotacao/actions.ts` | `finalizeQuote` com vitrine, modalidade e recálculo |
| `apps/mypet/app/cotacao/whatsapp-order.ts` | Mensagem com vitrine e frete |
| `apps/mypet/app/_components/frete/*` | `FreteFaixa`, `FreteResumo` |
| `apps/mypet/app/_components/vitrine/*` | `VitrinePage`, `VitrineCartBar`, `VITRINE_STYLES` |
| `apps/mypet/app/produtos/page.tsx` | Vitrine completa |
| `apps/mypet/app/fabrica/**` | Layout, vitrine, categoria, produto, finalização da fábrica |

---

### Task 1: Migration de localização e frete

**Files:**
- Create: `supabase/migrations/20261120120000_vitrines_localizacao_frete.sql`

**Interfaces:**
- Produces: colunas `buyers.uf`, `buyers.municipio`, `buyers.cep`, `buyers.localizacao_status`,
  `buyers.localizado_em`, `orders.vitrine`, `orders.shipping_mode`.

- [ ] **Step 1: Escrever a migration**

```sql
-- Vitrines Linha de Fábrica e Catálogo completo (apps/mypet).
-- buyers é compartilhada com apps/distribuidora: todas as colunas são opcionais.

alter table public.buyers
  add column if not exists uf text,
  add column if not exists municipio text,
  add column if not exists cep text,
  add column if not exists localizacao_status text,
  add column if not exists localizado_em timestamptz;

alter table public.buyers drop constraint if exists buyers_localizacao_status_check;
alter table public.buyers add constraint buyers_localizacao_status_check
  check (localizacao_status is null or localizacao_status in ('localizado', 'nao_localizado'));

alter table public.orders
  add column if not exists vitrine text,
  add column if not exists shipping_mode text;

alter table public.orders drop constraint if exists orders_vitrine_check;
alter table public.orders add constraint orders_vitrine_check
  check (vitrine is null or vitrine in ('completo', 'fabrica'));

alter table public.orders drop constraint if exists orders_shipping_mode_check;
alter table public.orders add constraint orders_shipping_mode_check
  check (shipping_mode is null or shipping_mode in ('normal', 'prioritaria', 'a_combinar'));
```

- [ ] **Step 2: Conferir a sintaxe num banco descartável, se houver Supabase local**

Run: `supabase db reset` (só se o Supabase local estiver configurado; senão pule)
Expected: migrations aplicadas sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261120120000_vitrines_localizacao_frete.sql
git commit -m "feat(db): colunas de localização do comprador e de frete do pedido

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

> **Passo manual (Fábio):** aplicar esta migration no Supabase `hub_catalogo` **antes** de publicar a
> Task 9. As Tasks 2 a 8 não dependem das colunas em produção.

---

### Task 2: Cliente ReceitaWS e `localizarComprador`

**Files:**
- Create: `packages/core/src/receitaws.ts`
- Create: `packages/core/src/receitaws.test.ts`
- Modify: `packages/core/src/buyers-server.ts`
- Modify: `packages/core/src/buyers-server.test.ts`
- Modify: `packages/core/package.json` (export `./receitaws`)

**Interfaces:**
- Produces:
  - `consultarCnpj(cnpj: string, fetchImpl?: typeof fetch, timeoutMs?: number): Promise<ReceitaConsulta>`
  - `type ReceitaConsulta = { kind: "localizado"; uf: string; municipio: string | null; cep: string | null } | { kind: "nao_localizado" } | { kind: "indisponivel" }`
  - `type LocalizacaoStatus = "localizado" | "nao_localizado" | null`
  - `Buyer` ganha `uf: string | null; municipio: string | null; cep: string | null; localizacao_status: LocalizacaoStatus`
  - `localizarComprador(supabase: SupabaseClient, buyer: Pick<Buyer, "id" | "cnpj" | "localizacao_status">, fetchImpl?: typeof fetch): Promise<void>`

- [ ] **Step 1: Teste do cliente**

`packages/core/src/receitaws.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { consultarCnpj } from "./receitaws";

const resp = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("consultarCnpj", () => {
  it("devolve localizado com uf, município e cep só com dígitos", async () => {
    const f = resp(200, { status: "OK", uf: "SP", municipio: "SAO PAULO", cep: "04.210-000" });
    expect(await consultarCnpj("12345678000199", f)).toEqual({
      kind: "localizado",
      uf: "SP",
      municipio: "SAO PAULO",
      cep: "04210000",
    });
    expect(f).toHaveBeenCalledWith("https://www.receitaws.com.br/v1/cnpj/12345678000199", expect.anything());
  });

  it("status ERROR vira nao_localizado", async () => {
    expect(await consultarCnpj("12345678000199", resp(200, { status: "ERROR", message: "CNPJ inválido" }))).toEqual({
      kind: "nao_localizado",
    });
  });

  it("200 sem uf vira nao_localizado", async () => {
    expect(await consultarCnpj("12345678000199", resp(200, { status: "OK" }))).toEqual({ kind: "nao_localizado" });
  });

  it("CNPJ fora do formato não consulta e vira nao_localizado", async () => {
    const f = resp(200, {});
    expect(await consultarCnpj("123", f)).toEqual({ kind: "nao_localizado" });
    expect(f).not.toHaveBeenCalled();
  });

  it("429, 500 e erro de rede viram indisponivel", async () => {
    expect(await consultarCnpj("12345678000199", resp(429, {}))).toEqual({ kind: "indisponivel" });
    expect(await consultarCnpj("12345678000199", resp(500, {}))).toEqual({ kind: "indisponivel" });
    const boom = vi.fn(async () => {
      throw new Error("rede");
    }) as unknown as typeof fetch;
    expect(await consultarCnpj("12345678000199", boom)).toEqual({ kind: "indisponivel" });
  });

  it("aceita CNPJ com máscara", async () => {
    const f = resp(200, { status: "OK", uf: "RJ", municipio: "RIO DE JANEIRO", cep: "20040002" });
    await consultarCnpj("12.345.678/0001-99", f);
    expect(f).toHaveBeenCalledWith("https://www.receitaws.com.br/v1/cnpj/12345678000199", expect.anything());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- receitaws`
Expected: FAIL (`Cannot find module './receitaws'`).

- [ ] **Step 3: Implementar `receitaws.ts`**

```ts
// Consulta pública da ReceitaWS (sem token, ~3 consultas/min; 429 quando passa).
// Copiado e reduzido de Hub Comercial V2/hub-clientes/lib/integracoes/receitaws/client.ts.

export type ReceitaConsulta =
  | { kind: "localizado"; uf: string; municipio: string | null; cep: string | null }
  | { kind: "nao_localizado" }
  | { kind: "indisponivel" };

type ReceitaWsResponse = { status?: string; uf?: string; municipio?: string; cep?: string };

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export async function consultarCnpj(
  cnpj: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<ReceitaConsulta> {
  const digitos = onlyDigits(cnpj ?? "");
  if (digitos.length !== 14) return { kind: "nao_localizado" };

  let resposta: Response;
  try {
    resposta = await fetchImpl(`https://www.receitaws.com.br/v1/cnpj/${digitos}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { kind: "indisponivel" };
  }
  if (!resposta.ok) return { kind: "indisponivel" };

  let data: ReceitaWsResponse;
  try {
    data = (await resposta.json()) as ReceitaWsResponse;
  } catch {
    return { kind: "indisponivel" };
  }
  if (data.status === "ERROR" || !data.uf) return { kind: "nao_localizado" };
  const cep = data.cep ? onlyDigits(data.cep) : "";
  return {
    kind: "localizado",
    uf: data.uf.trim().toUpperCase(),
    municipio: data.municipio?.trim() || null,
    cep: cep.length === 8 ? cep : null,
  };
}
```

Em `packages/core/package.json`, dentro de `exports`, depois de `"./br-validation"`:

```json
    "./receitaws": "./src/receitaws.ts",
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- receitaws`
Expected: PASS (6 testes).

- [ ] **Step 5: Testes de `getBuyerById` e `localizarComprador`**

Em `packages/core/src/buyers-server.test.ts`:
- troque o import para `import { getBuyerById, createBuyer, localizarComprador } from "./buyers-server";`
- adicione `import { fakeSupabase } from "./test-utils/fake-supabase";`
- no teste "retorna o buyer quando encontrado", inclua no `data` e no `toEqual`:
  `uf: null, municipio: null, cep: null, localizacao_status: null`
- acrescente ao final do arquivo:

```ts
describe("localizarComprador", () => {
  const ok = (body: unknown, status = 200) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  const buyer = { id: "u1", cnpj: "12345678000199", localizacao_status: null };

  it("grava localizado com uf, município e cep", async () => {
    const { client, calls } = fakeSupabase({ buyers: [{}] });
    await localizarComprador(client, buyer, ok({ status: "OK", uf: "SP", municipio: "SAO PAULO", cep: "04210000" }));
    const update = calls.find((c) => c.method === "update");
    expect(update?.args[0]).toMatchObject({
      uf: "SP",
      municipio: "SAO PAULO",
      cep: "04210000",
      localizacao_status: "localizado",
    });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "id" && c.args[1] === "u1")).toBe(true);
  });

  it("grava nao_localizado para CNPJ inválido", async () => {
    const { client, calls } = fakeSupabase({ buyers: [{}] });
    await localizarComprador(client, buyer, ok({ status: "ERROR" }));
    expect(calls.find((c) => c.method === "update")?.args[0]).toMatchObject({ localizacao_status: "nao_localizado" });
  });

  it("grava nao_localizado sem consultar quando não há CNPJ", async () => {
    const f = ok({});
    const { client, calls } = fakeSupabase({ buyers: [{}] });
    await localizarComprador(client, { ...buyer, cnpj: null }, f);
    expect(f).not.toHaveBeenCalled();
    expect(calls.find((c) => c.method === "update")?.args[0]).toMatchObject({ localizacao_status: "nao_localizado" });
  });

  it("não grava nada quando a ReceitaWS está indisponível", async () => {
    const { client, calls } = fakeSupabase({ buyers: [{}] });
    await localizarComprador(client, buyer, ok({}, 429));
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("não consulta quem já foi localizado", async () => {
    const f = ok({});
    const { client } = fakeSupabase({});
    await localizarComprador(client, { ...buyer, localizacao_status: "localizado" }, f);
    expect(f).not.toHaveBeenCalled();
  });

  it("não lança quando o update falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeSupabase({ buyers: [{ error: { message: "x" } }] });
    await expect(
      localizarComprador(client, buyer, ok({ status: "OK", uf: "SP", municipio: "SAO PAULO", cep: "04210000" })),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- buyers-server`
Expected: FAIL (`localizarComprador` não existe; `getBuyerById` sem os campos novos).

- [ ] **Step 7: Implementar em `buyers-server.ts`**

Substitua o tipo `Buyer` e o `select` de `getBuyerById`, e acrescente a função:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { consultarCnpj } from "./receitaws";

export type LocalizacaoStatus = "localizado" | "nao_localizado" | null;

export type Buyer = {
  id: string;
  email: string | null;
  nome: string | null;
  empresa: string | null;
  whatsapp: string;
  cnpj: string | null;
  uf: string | null;
  municipio: string | null;
  cep: string | null;
  localizacao_status: LocalizacaoStatus;
};

const BUYER_COLUMNS = "id, email, nome, empresa, whatsapp, cnpj, uf, municipio, cep, localizacao_status";

export async function getBuyerById(supabase: SupabaseClient, userId: string): Promise<Buyer | null> {
  const { data, error } = await supabase.from("buyers").select(BUYER_COLUMNS).eq("id", userId).single();
  if (error || !data) return null;
  return data as Buyer;
}

// Consulta a ReceitaWS e grava a localização do comprador. Nunca lança:
// indisponível (429, queda, timeout) não grava nada e fica para o próximo acesso.
export async function localizarComprador(
  supabase: SupabaseClient,
  buyer: Pick<Buyer, "id" | "cnpj" | "localizacao_status">,
  fetchImpl?: typeof fetch,
): Promise<void> {
  if (buyer.localizacao_status) return;
  try {
    const consulta = buyer.cnpj ? await consultarCnpj(buyer.cnpj, fetchImpl) : ({ kind: "nao_localizado" } as const);
    if (consulta.kind === "indisponivel") return;
    const agora = new Date().toISOString();
    const row =
      consulta.kind === "localizado"
        ? { uf: consulta.uf, municipio: consulta.municipio, cep: consulta.cep, localizacao_status: "localizado", localizado_em: agora }
        : { localizacao_status: "nao_localizado", localizado_em: agora };
    const { error } = await supabase.from("buyers").update(row).eq("id", buyer.id);
    if (error) console.error("[buyers] falha ao gravar localização:", error.message);
  } catch (error) {
    console.error("[buyers] falha ao localizar comprador:", error);
  }
}
```

(`CreateBuyerInput` e `createBuyer` ficam como estão.)

- [ ] **Step 8: Rodar o core inteiro**

Run: `pnpm --filter @mypet/core test`
Expected: PASS. Se algum teste que monta `Buyer` falhar por tipo, acrescente os quatro campos com `null` nesse teste.

- [ ] **Step 9: Typecheck do mypet (usa `Buyer`)**

Run: `pnpm --filter mypet exec tsc --noEmit`
Expected: sem erros. Onde houver objeto literal `Buyer` em teste do mypet, acrescente
`uf: null, municipio: null, cep: null, localizacao_status: null`.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/receitaws.ts packages/core/src/receitaws.test.ts packages/core/src/buyers-server.ts packages/core/src/buyers-server.test.ts packages/core/package.json apps/mypet
git commit -m "feat(core): localiza o comprador pelo CNPJ na ReceitaWS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Localização no cadastro e no acesso

**Files:**
- Create: `apps/mypet/lib/localizacao.ts`
- Create: `apps/mypet/lib/localizacao.test.ts`
- Modify: `apps/mypet/app/api/pre-acesso/route.ts`
- Modify: `apps/mypet/app/api/pre-acesso/route.test.ts`

**Interfaces:**
- Consumes: `localizarComprador`, `getBuyerById`, `Buyer` (Task 2)
- Produces: `agendarLocalizacao(buyer: Pick<Buyer, "id" | "cnpj" | "localizacao_status">): void`

- [ ] **Step 1: Ler a doc do `after`**

Run: `cat apps/mypet/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`
Ponto que importa: `after` funciona em Server Components, Server Functions e Route Handlers, e roda
depois da resposta, inclusive em `redirect`.

- [ ] **Step 2: Teste**

`apps/mypet/lib/localizacao.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const after = vi.fn((cb: () => unknown) => cb());
const localizarComprador = vi.fn(async () => {});

vi.mock("next/server", () => ({ after: (cb: () => unknown) => after(cb) }));
vi.mock("@mypet/core/supabase", () => ({ getHubServiceClient: () => ({ hub: true }) }));
vi.mock("@mypet/core/buyers-server", () => ({
  localizarComprador: (...args: unknown[]) => localizarComprador(...(args as [])),
}));

import { agendarLocalizacao } from "./localizacao";

beforeEach(() => {
  after.mockClear();
  localizarComprador.mockClear();
});

describe("agendarLocalizacao", () => {
  it("agenda a consulta para comprador pendente", () => {
    const buyer = { id: "u1", cnpj: "12345678000199", localizacao_status: null };
    agendarLocalizacao(buyer);
    expect(after).toHaveBeenCalledTimes(1);
    expect(localizarComprador).toHaveBeenCalledWith({ hub: true }, buyer);
  });

  it("não agenda para quem já tem status", () => {
    agendarLocalizacao({ id: "u1", cnpj: "1", localizacao_status: "nao_localizado" });
    expect(after).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter mypet test -- lib/localizacao`
Expected: FAIL (módulo não existe).

- [ ] **Step 4: Implementar**

`apps/mypet/lib/localizacao.ts`:

```ts
import { after } from "next/server";
import { getHubServiceClient } from "@mypet/core/supabase";
import { localizarComprador, type Buyer } from "@mypet/core/buyers-server";

// Dispara a consulta de CNPJ depois da resposta, sem segurar a página.
export function agendarLocalizacao(buyer: Pick<Buyer, "id" | "cnpj" | "localizacao_status">): void {
  if (buyer.localizacao_status) return;
  after(() => localizarComprador(getHubServiceClient(), buyer));
}
```

- [ ] **Step 5: Teste do cadastro**

Em `apps/mypet/app/api/pre-acesso/route.test.ts`, acrescente nos mocks do topo:

```ts
const agendarLocalizacao = vi.fn();
const getBuyerById = vi.fn();
vi.mock("@/lib/localizacao", () => ({ agendarLocalizacao: (b: unknown) => agendarLocalizacao(b) }));
vi.mock("@mypet/core/supabase", () => ({ getHubServiceClient: () => ({ hub: true }) }));
vi.mock("@mypet/core/buyers-server", () => ({ getBuyerById: (...a: unknown[]) => getBuyerById(...a) }));
```

e o teste (use o mesmo `provisionBuyer` mockado que o arquivo já tem, resolvendo `{ buyerId: "u1" }`):

```ts
it("agenda a localização do comprador depois do cadastro", async () => {
  const buyer = { id: "u1", cnpj: "12345678000199", localizacao_status: null };
  getBuyerById.mockResolvedValue(buyer);
  const res = await POST(requestWithBody(VALID_BODY));
  expect(res.status).toBe(201);
  expect(getBuyerById).toHaveBeenCalledWith({ hub: true }, "u1");
  expect(agendarLocalizacao).toHaveBeenCalledWith(buyer);
});
```

(`requestWithBody` e `VALID_BODY`: use os helpers que o arquivo já tem para montar o `NextRequest` do
caso de sucesso. Se tiverem outro nome, use os que existem.)

- [ ] **Step 6: Implementar no `route.ts`**

Imports novos:

```ts
import { getHubServiceClient } from "@mypet/core/supabase";
import { getBuyerById } from "@mypet/core/buyers-server";
import { agendarLocalizacao } from "@/lib/localizacao";
```

Logo depois de `const { buyerId } = await provisionBuyer(...)`:

```ts
    const buyer = await getBuyerById(getHubServiceClient(), buyerId).catch(() => null);
    if (buyer) agendarLocalizacao(buyer);
```

- [ ] **Step 7: Rodar**

Run: `pnpm --filter mypet test -- pre-acesso lib/localizacao`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/mypet/lib/localizacao.ts apps/mypet/lib/localizacao.test.ts apps/mypet/app/api/pre-acesso
git commit -m "feat(mypet): consulta a localização do CNPJ no cadastro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Script de preenchimento dos compradores antigos

**Files:**
- Create: `scripts/backfill-buyers-localizacao.ts`
- Create: `scripts/backfill-buyers-localizacao.test.ts`
- Modify: `package.json` (raiz, script `buyers:backfill-localizacao`)

**Interfaces:**
- Produces: `planejarBackfill(buyers: { id: string; cnpj: string | null }[], cache: CacheRow[]): BackfillUpdate[]`
  - `type CacheRow = { cnpj: string; status_consulta: string; uf: string | null; municipio: string | null; cep: string | null }`
  - `type BackfillUpdate = { id: string; uf: string; municipio: string | null; cep: string | null }`

- [ ] **Step 1: Teste da parte pura**

`scripts/backfill-buyers-localizacao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planejarBackfill } from "./backfill-buyers-localizacao";

describe("planejarBackfill", () => {
  const cache = [
    { cnpj: "11111111000111", status_consulta: "consultado", uf: "sp", municipio: "SAO PAULO", cep: "04.210-000" },
    { cnpj: "22222222000122", status_consulta: "erro", uf: null, municipio: null, cep: null },
    { cnpj: "33333333000133", status_consulta: "consultado", uf: null, municipio: null, cep: null },
  ];

  it("só preenche quem está no cache como consultado e com uf", () => {
    const buyers = [
      { id: "a", cnpj: "11.111.111/0001-11" },
      { id: "b", cnpj: "22222222000122" },
      { id: "c", cnpj: "33333333000133" },
      { id: "d", cnpj: null },
      { id: "e", cnpj: "99999999000199" },
    ];
    expect(planejarBackfill(buyers, cache)).toEqual([{ id: "a", uf: "SP", municipio: "SAO PAULO", cep: "04210000" }]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run scripts/backfill-buyers-localizacao.test.ts`
Expected: FAIL (módulo não existe). Se a raiz não tiver config do vitest, rode com `pnpm --filter @mypet/core exec vitest run ../../scripts/backfill-buyers-localizacao.test.ts`. Esse é o mesmo jeito que o `azpetshop-import-precos.test.ts` é rodado; confira no histórico com `git log -1 --stat -- scripts/azpetshop-import-precos.test.ts`.

- [ ] **Step 3: Implementar**

`scripts/backfill-buyers-localizacao.ts`:

```ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getHubServiceClient } from "@mypet/core/supabase";

// Preenche buyers.uf/municipio/cep a partir do cache da ReceitaWS do Hub Clientes
// (projeto Supabase "Clientes", schema leads). Roda localmente, uma vez.
//   CLIENTES_SUPABASE_URL=... CLIENTES_SUPABASE_SERVICE_ROLE_KEY=... pnpm buyers:backfill-localizacao --dry-run
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY (hub_catalogo) vêm do .env, como nos outros scripts.

export type CacheRow = { cnpj: string; status_consulta: string; uf: string | null; municipio: string | null; cep: string | null };
export type BackfillUpdate = { id: string; uf: string; municipio: string | null; cep: string | null };

const digits = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");

export function planejarBackfill(buyers: { id: string; cnpj: string | null }[], cache: CacheRow[]): BackfillUpdate[] {
  const porCnpj = new Map(cache.map((row) => [digits(row.cnpj), row]));
  const updates: BackfillUpdate[] = [];
  for (const buyer of buyers) {
    const row = porCnpj.get(digits(buyer.cnpj));
    if (!row || row.status_consulta !== "consultado" || !row.uf) continue;
    const cep = digits(row.cep);
    updates.push({ id: buyer.id, uf: row.uf.trim().toUpperCase(), municipio: row.municipio?.trim() || null, cep: cep.length === 8 ? cep : null });
  }
  return updates;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.CLIENTES_SUPABASE_URL;
  const key = process.env.CLIENTES_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Defina CLIENTES_SUPABASE_URL e CLIENTES_SUPABASE_SERVICE_ROLE_KEY no terminal.");

  const hub = getHubServiceClient();
  const clientes = createClient(url, key, { auth: { persistSession: false } });

  const { data: buyers, error: bErr } = await hub.from("buyers").select("id, cnpj").is("localizacao_status", null);
  if (bErr) throw new Error(bErr.message);
  const cnpjs = [...new Set((buyers ?? []).map((b) => digits(b.cnpj)).filter((c) => c.length === 14))];

  const cache: CacheRow[] = [];
  for (let i = 0; i < cnpjs.length; i += 200) {
    const { data, error } = await clientes
      .schema("leads")
      .from("cnpj_receita_cache")
      .select("cnpj, status_consulta, uf, municipio, cep")
      .in("cnpj", cnpjs.slice(i, i + 200));
    if (error) throw new Error(error.message);
    cache.push(...((data ?? []) as CacheRow[]));
  }

  const updates = planejarBackfill(buyers ?? [], cache);
  console.log(`Pendentes: ${buyers?.length ?? 0} · no cache: ${cache.length} · a preencher: ${updates.length}`);
  if (dryRun) return;

  const agora = new Date().toISOString();
  for (const u of updates) {
    const { error } = await hub
      .from("buyers")
      .update({ uf: u.uf, municipio: u.municipio, cep: u.cep, localizacao_status: "localizado", localizado_em: agora })
      .eq("id", u.id);
    if (error) console.error(`Falha em ${u.id}: ${error.message}`);
  }
  console.log("Concluído.");
}

if (process.argv[1]?.endsWith("backfill-buyers-localizacao.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

No `package.json` da raiz, em `scripts`:

```json
    "buyers:backfill-localizacao": "tsx scripts/backfill-buyers-localizacao.ts",
```

- [ ] **Step 4: Rodar o teste**

Run: o mesmo comando do Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-buyers-localizacao.ts scripts/backfill-buyers-localizacao.test.ts package.json
git commit -m "feat(scripts): preenche a localização dos compradores pelo cache do Hub Clientes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

> **Passo manual (Fábio), depois da migration:** rodar com `--dry-run`, conferir as contagens e rodar de verdade.

---

### Task 5: Regras de frete

**Files:**
- Create: `packages/core/src/frete.ts`
- Create: `packages/core/src/frete.test.ts`
- Create: `apps/mypet/lib/frete.config.ts`
- Modify: `packages/core/package.json` (export `./frete`)

**Interfaces:**
- Produces:
  - `type Zona = "bairros_proximos" | "capital" | "grande_sp" | "interior_30" | "interior_alem" | "fora"`
  - `type RegraFrete = "zona" | "fabrica"`
  - `type Modalidade = "normal" | "prioritaria"`
  - `type FaixaCep = { de: string; ate: string }` (8 dígitos)
  - `type TarifaZona = { minimoGratis: number | null; normal: number | null; prioritaria: number | null }` (centavos; `null` = não tem / sob consulta)
  - `type FreteConfig = { bairrosProximos: FaixaCep[]; grandeSp: string[]; interior30km: string[]; zonas: Record<Zona, TarifaZona>; fabrica: { minimoGratis: number; fixo: number }; prazoNormal: string }`
  - `classificarZona(loc: { uf: string | null; municipio: string | null; cep: string | null; status: "localizado" | "nao_localizado" | null }, config: FreteConfig): Zona`
  - `type FreteCalculo = { tipo: "gratis" | "fixo" | "a_combinar"; modalidade: Modalidade; valorCentavos: number | null; faltaParaGratisCentavos: number | null; minimoGratisCentavos: number | null; prioritariaDisponivel: boolean; prazo: string | null }`
  - `calcularFrete(input: { regra: RegraFrete; zona: Zona; subtotalCentavos: number; modalidade: Modalidade }, config: FreteConfig): FreteCalculo`
  - `shippingModeDe(calc: FreteCalculo): "normal" | "prioritaria" | "a_combinar"`
  - `ZONA_ROTULO: Record<Zona, string>`
  - `paraCentavos(reais: number): number`
  - `FRETE_CONFIG` (em `apps/mypet/lib/frete.config.ts`)

- [ ] **Step 1: Testes**

`packages/core/src/frete.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calcularFrete, classificarZona, shippingModeDe, paraCentavos, type FreteConfig } from "./frete";

const CONFIG: FreteConfig = {
  bairrosProximos: [{ de: "04200000", ate: "04299999" }],
  grandeSp: ["Santo André", "Guarulhos"],
  interior30km: ["Jundiaí"],
  zonas: {
    bairros_proximos: { minimoGratis: 9900, normal: 1299, prioritaria: 2500 },
    capital: { minimoGratis: 20000, normal: 2000, prioritaria: 3000 },
    grande_sp: { minimoGratis: 30000, normal: 2500, prioritaria: 3500 },
    interior_30: { minimoGratis: 40000, normal: null, prioritaria: null },
    interior_alem: { minimoGratis: 70000, normal: null, prioritaria: null },
    fora: { minimoGratis: null, normal: null, prioritaria: null },
  },
  fabrica: { minimoGratis: 29900, fixo: 1990 },
  prazoNormal: "12h a 48h",
};

const loc = (o: Partial<Parameters<typeof classificarZona>[0]>) =>
  ({ uf: "SP", municipio: "SAO PAULO", cep: "01001000", status: "localizado", ...o }) as Parameters<typeof classificarZona>[0];

describe("classificarZona", () => {
  it("CEP de bairro próximo vence o município", () => {
    expect(classificarZona(loc({ cep: "04210000" }), CONFIG)).toBe("bairros_proximos");
  });
  it("capital pelo município, sem ligar para acento e caixa", () => {
    expect(classificarZona(loc({ municipio: " São Paulo " }), CONFIG)).toBe("capital");
  });
  it("grande SP pela lista", () => {
    expect(classificarZona(loc({ municipio: "SANTO ANDRE", cep: "09000000" }), CONFIG)).toBe("grande_sp");
  });
  it("interior até 30 km pela lista", () => {
    expect(classificarZona(loc({ municipio: "JUNDIAI", cep: "13200000" }), CONFIG)).toBe("interior_30");
  });
  it("outro município de SP é interior além", () => {
    expect(classificarZona(loc({ municipio: "CAMPINAS", cep: "13000000" }), CONFIG)).toBe("interior_alem");
  });
  it("outra UF, não localizado e pendente caem em fora", () => {
    expect(classificarZona(loc({ uf: "RJ", municipio: "RIO DE JANEIRO" }), CONFIG)).toBe("fora");
    expect(classificarZona(loc({ status: "nao_localizado" }), CONFIG)).toBe("fora");
    expect(classificarZona(loc({ status: null }), CONFIG)).toBe("fora");
  });
});

describe("calcularFrete — fábrica", () => {
  const f = (subtotalCentavos: number, zona: Parameters<typeof calcularFrete>[0]["zona"] = "fora") =>
    calcularFrete({ regra: "fabrica", zona, subtotalCentavos, modalidade: "normal" }, CONFIG);

  it("abaixo de R$ 299 paga R$ 19,90 e mostra quanto falta", () => {
    expect(f(29899)).toMatchObject({ tipo: "fixo", valorCentavos: 1990, faltaParaGratisCentavos: 1, minimoGratisCentavos: 29900 });
  });
  it("exatamente R$ 299 é grátis", () => {
    expect(f(29900)).toMatchObject({ tipo: "gratis", valorCentavos: 0, faltaParaGratisCentavos: 0 });
  });
  it("vale igual em qualquer zona e nunca tem prioritária", () => {
    expect(f(10000, "capital")).toMatchObject({ tipo: "fixo", valorCentavos: 1990, prioritariaDisponivel: false });
    expect(calcularFrete({ regra: "fabrica", zona: "capital", subtotalCentavos: 10000, modalidade: "prioritaria" }, CONFIG).modalidade).toBe("normal");
  });
});

describe("calcularFrete — catálogo completo", () => {
  const c = (zona: Parameters<typeof calcularFrete>[0]["zona"], subtotalCentavos: number, modalidade: "normal" | "prioritaria" = "normal") =>
    calcularFrete({ regra: "zona", zona, subtotalCentavos, modalidade }, CONFIG);

  it("capital abaixo do mínimo paga a normal", () => {
    expect(c("capital", 19999)).toMatchObject({ tipo: "fixo", valorCentavos: 2000, faltaParaGratisCentavos: 1, prazo: "12h a 48h" });
  });
  it("capital no mínimo é grátis", () => {
    expect(c("capital", 20000)).toMatchObject({ tipo: "gratis", valorCentavos: 0 });
  });
  it("prioritária é paga mesmo com a normal grátis", () => {
    expect(c("bairros_proximos", 50000, "prioritaria")).toMatchObject({ tipo: "fixo", modalidade: "prioritaria", valorCentavos: 2500 });
  });
  it("prioritária só em bairros próximos, capital e grande SP", () => {
    expect(c("grande_sp", 100, "prioritaria")).toMatchObject({ modalidade: "prioritaria", valorCentavos: 3500, prioritariaDisponivel: true });
    expect(c("interior_30", 100, "prioritaria")).toMatchObject({ modalidade: "normal", prioritariaDisponivel: false });
  });
  it("interior abaixo do mínimo é a combinar; acima é grátis", () => {
    expect(c("interior_30", 39999)).toMatchObject({ tipo: "a_combinar", valorCentavos: null, prazo: null, faltaParaGratisCentavos: 1 });
    expect(c("interior_alem", 70000)).toMatchObject({ tipo: "gratis", valorCentavos: 0 });
  });
  it("fora é sempre a combinar, sem mínimo", () => {
    expect(c("fora", 999999)).toMatchObject({ tipo: "a_combinar", minimoGratisCentavos: null, faltaParaGratisCentavos: null });
  });
});

describe("auxiliares", () => {
  it("shippingModeDe", () => {
    expect(shippingModeDe(calcularFrete({ regra: "zona", zona: "fora", subtotalCentavos: 1, modalidade: "normal" }, CONFIG))).toBe("a_combinar");
    expect(shippingModeDe(calcularFrete({ regra: "zona", zona: "capital", subtotalCentavos: 1, modalidade: "prioritaria" }, CONFIG))).toBe("prioritaria");
  });
  it("paraCentavos arredonda", () => {
    expect(paraCentavos(19.9)).toBe(1990);
    expect(paraCentavos(0.1 + 0.2)).toBe(30);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- frete`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `packages/core/src/frete.ts`**

```ts
export type Zona = "bairros_proximos" | "capital" | "grande_sp" | "interior_30" | "interior_alem" | "fora";
export type RegraFrete = "zona" | "fabrica";
export type Modalidade = "normal" | "prioritaria";
export type FaixaCep = { de: string; ate: string };
export type TarifaZona = { minimoGratis: number | null; normal: number | null; prioritaria: number | null };
export type FreteConfig = {
  bairrosProximos: FaixaCep[];
  grandeSp: string[];
  interior30km: string[];
  zonas: Record<Zona, TarifaZona>;
  fabrica: { minimoGratis: number; fixo: number };
  prazoNormal: string;
};
export type FreteCalculo = {
  tipo: "gratis" | "fixo" | "a_combinar";
  modalidade: Modalidade;
  valorCentavos: number | null;
  faltaParaGratisCentavos: number | null;
  minimoGratisCentavos: number | null;
  prioritariaDisponivel: boolean;
  prazo: string | null;
};

export const ZONA_ROTULO: Record<Zona, string> = {
  bairros_proximos: "Bairros próximos (SP)",
  capital: "Capital de SP",
  grande_sp: "ABC e Grande SP",
  interior_30: "Interior até 30 km da capital",
  interior_alem: "Interior acima de 30 km da capital",
  fora: "Fora da área de entrega direta",
};

export const paraCentavos = (reais: number) => Math.round(reais * 100);

const normalizar = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, " ");

export function classificarZona(
  loc: { uf: string | null; municipio: string | null; cep: string | null; status: "localizado" | "nao_localizado" | null },
  config: FreteConfig,
): Zona {
  if (loc.status !== "localizado") return "fora";
  const cep = (loc.cep ?? "").replace(/\D/g, "");
  if (cep.length === 8 && config.bairrosProximos.some((f) => cep >= f.de && cep <= f.ate)) return "bairros_proximos";
  const municipio = normalizar(loc.municipio ?? "");
  if (municipio === "SAO PAULO") return "capital";
  if (config.grandeSp.some((m) => normalizar(m) === municipio)) return "grande_sp";
  if (config.interior30km.some((m) => normalizar(m) === municipio)) return "interior_30";
  if ((loc.uf ?? "").trim().toUpperCase() === "SP") return "interior_alem";
  return "fora";
}

export function calcularFrete(
  input: { regra: RegraFrete; zona: Zona; subtotalCentavos: number; modalidade: Modalidade },
  config: FreteConfig,
): FreteCalculo {
  const { subtotalCentavos } = input;
  const falta = (minimo: number) => Math.max(minimo - subtotalCentavos, 0);

  if (input.regra === "fabrica") {
    const { minimoGratis, fixo } = config.fabrica;
    const gratis = subtotalCentavos >= minimoGratis;
    return {
      tipo: gratis ? "gratis" : "fixo",
      modalidade: "normal",
      valorCentavos: gratis ? 0 : fixo,
      faltaParaGratisCentavos: falta(minimoGratis),
      minimoGratisCentavos: minimoGratis,
      prioritariaDisponivel: false,
      prazo: null,
    };
  }

  const tarifa = config.zonas[input.zona];
  const prioritariaDisponivel = tarifa.prioritaria !== null;
  const base = {
    faltaParaGratisCentavos: tarifa.minimoGratis === null ? null : falta(tarifa.minimoGratis),
    minimoGratisCentavos: tarifa.minimoGratis,
    prioritariaDisponivel,
  };

  if (input.modalidade === "prioritaria" && tarifa.prioritaria !== null) {
    return { ...base, tipo: "fixo", modalidade: "prioritaria", valorCentavos: tarifa.prioritaria, prazo: "mesmo dia (pedidos até 12h)" };
  }
  if (tarifa.minimoGratis !== null && subtotalCentavos >= tarifa.minimoGratis) {
    return { ...base, tipo: "gratis", modalidade: "normal", valorCentavos: 0, prazo: config.prazoNormal };
  }
  if (tarifa.normal !== null) {
    return { ...base, tipo: "fixo", modalidade: "normal", valorCentavos: tarifa.normal, prazo: config.prazoNormal };
  }
  return { ...base, tipo: "a_combinar", modalidade: "normal", valorCentavos: null, prazo: null };
}

export function shippingModeDe(calc: FreteCalculo): "normal" | "prioritaria" | "a_combinar" {
  return calc.tipo === "a_combinar" ? "a_combinar" : calc.modalidade;
}
```

Em `packages/core/package.json` → `exports`, depois de `"./features"`:

```json
    "./frete": "./src/frete.ts",
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- frete`
Expected: PASS.

- [ ] **Step 5: Configuração do mypet**

`apps/mypet/lib/frete.config.ts`:

```ts
import type { FreteConfig } from "@mypet/core/frete";

// Valores em centavos. REVISAR COM O FÁBIO antes de publicar a Task 11:
// - bairrosProximos: faixas de CEP de Ipiranga, Sacomã, Cursino, Saúde, Vila Mariana e São João Clímaco.
//   Ponto de partida: 04000-000 a 04299-999 (zona sul próxima ao CD). Ajustar com a lista real de CEPs atendidos.
// - interior30km: rascunho; municípios de SP fora da Grande SP a até ~30 km da divisa da capital.
export const FRETE_CONFIG: FreteConfig = {
  bairrosProximos: [{ de: "04000000", ate: "04299999" }],
  grandeSp: [
    "Arujá", "Barueri", "Biritiba-Mirim", "Caieiras", "Cajamar", "Carapicuíba", "Cotia", "Diadema",
    "Embu das Artes", "Embu-Guaçu", "Ferraz de Vasconcelos", "Francisco Morato", "Franco da Rocha",
    "Guararema", "Guarulhos", "Itapecerica da Serra", "Itapevi", "Itaquaquecetuba", "Jandira", "Juquitiba",
    "Mairiporã", "Mauá", "Mogi das Cruzes", "Osasco", "Pirapora do Bom Jesus", "Poá", "Ribeirão Pires",
    "Rio Grande da Serra", "Salesópolis", "Santa Isabel", "Santana de Parnaíba", "Santo André",
    "São Bernardo do Campo", "São Caetano do Sul", "São Lourenço da Serra", "Suzano", "Taboão da Serra",
    "Vargem Grande Paulista",
  ],
  interior30km: [
    "Jundiaí", "Várzea Paulista", "Campo Limpo Paulista", "Jarinu", "Atibaia", "Bom Jesus dos Perdões",
    "Nazaré Paulista", "São Roque", "Araçariguama", "Cabreúva", "Itupeva", "Mairinque", "Ibiúna",
  ],
  zonas: {
    bairros_proximos: { minimoGratis: 9900, normal: 1299, prioritaria: 2500 },
    capital: { minimoGratis: 20000, normal: 2000, prioritaria: 3000 },
    grande_sp: { minimoGratis: 30000, normal: 2500, prioritaria: 3500 },
    interior_30: { minimoGratis: 40000, normal: null, prioritaria: null },
    interior_alem: { minimoGratis: 70000, normal: null, prioritaria: null },
    fora: { minimoGratis: null, normal: null, prioritaria: null },
  },
  fabrica: { minimoGratis: 29900, fixo: 1990 },
  prazoNormal: "12h a 48h",
};
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter mypet exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/frete.ts packages/core/src/frete.test.ts packages/core/package.json apps/mypet/lib/frete.config.ts
git commit -m "feat(core): regras de frete por zona e da linha de fábrica

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

> **Checkpoint com o Fábio:** mostrar `bairrosProximos` e `interior30km` e ajustar antes da Task 11.

---

### Task 6: `priceCart` com recorte e `createOrder` com frete

**Files:**
- Modify: `packages/core/src/retail-checkout-server.ts:30-62`
- Modify: `packages/core/src/retail-checkout-server.test.ts`
- Modify: `packages/core/src/orders-server.ts:7-55`
- Modify: `packages/core/src/orders-server.test.ts`

**Interfaces:**
- Produces:
  - `priceCart(supabase, channel, lines, options?: { alsoInChannel?: string; checkStock?: boolean })`, com o mesmo retorno de hoje
  - `createOrder(supabase, input: { buyerId; channel; items: CartItem[]; agentConversationId?; vitrine?: "completo" | "fabrica"; shipping?: { mode: "normal" | "prioritaria" | "a_combinar"; subtotal: number; shippingPrice: number | null; total: number } })`, com o mesmo retorno de hoje

- [ ] **Step 1: Testes do `priceCart`**

Acrescente dentro de `describe("priceCart", ...)`:

```ts
  it("com alsoInChannel, filtra pelo segundo canal com alias", async () => {
    const { client, calls } = fakeSupabase({ products: [{ data: [productRow(ID_A, "Shampoo", 25, 5)] }] });
    await priceCart(client, "azpetshop", [{ id: ID_A, qty: 1 }], { alsoInChannel: "ffa_fabrica" });
    const select = calls.find((c) => c.method === "select");
    expect(String(select?.args[0])).toContain("fab:product_channel_links!inner(channel)");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "fab.channel" && c.args[1] === "ffa_fabrica")).toBe(true);
  });

  it("com alsoInChannel, item fora do recorte some da resposta e é recusado", async () => {
    const { client } = fakeSupabase({ products: [{ data: [] }] });
    const r = await priceCart(client, "azpetshop", [{ id: ID_A, qty: 1 }], { alsoInChannel: "ffa_fabrica" });
    expect(r).toEqual({ ok: false, error: "Algum item do carrinho não está mais à venda. Revise o carrinho." });
  });

  it("com checkStock false, aceita item sem estoque", async () => {
    const { client } = fakeSupabase({ products: [{ data: [productRow(ID_A, "Shampoo", 25, 0)] }] });
    const r = await priceCart(client, "azpetshop", [{ id: ID_A, qty: 3 }], { checkStock: false });
    expect(r).toMatchObject({ ok: true, subtotal: 75 });
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- retail-checkout-server`
Expected: os 3 testes novos falham. Os antigos continuam passando.

- [ ] **Step 3: Implementar**

Em `retail-checkout-server.ts`, troque a assinatura e o começo de `priceCart`:

```ts
export async function priceCart(
  supabase: SupabaseClient,
  channel: string,
  lines: CheckoutLine[],
  options: { alsoInChannel?: string; checkStock?: boolean } = {},
): Promise<{ ok: true; lines: PricedLine[]; subtotal: number } | { ok: false; error: string }> {
  const checkStock = options.checkStock !== false;
  const alsoEmbed = options.alsoInChannel ? ", fab:product_channel_links!inner(channel)" : "";
  let query = supabase
    .from("products")
    .select(`id, name, stock_qty, product_channel_prices(channel, sale_price, sale_updated_at), product_channel_links!inner(channel)${alsoEmbed}`)
    .in("id", lines.map((l) => l.id))
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel);
  if (options.alsoInChannel) query = query.eq("fab.channel", options.alsoInChannel);
  const { data, error } = await query;
```

E no laço, envolva as duas verificações de estoque:

```ts
    if (checkStock && inStockFromQty(row.stock_qty) === false) {
      return { ok: false, error: `${row.name} está esgotado. Remova do carrinho para continuar.` };
    }
    if (checkStock && row.stock_qty !== null && line.qty > row.stock_qty) {
      return { ok: false, error: `Só temos ${row.stock_qty} unidade(s) de ${row.name} em estoque.` };
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- retail-checkout-server`
Expected: PASS (antigos e novos).

- [ ] **Step 5: Testes do `createOrder`**

Em `packages/core/src/orders-server.test.ts`, acrescente (usando `fakeSupabase`, importado de `./test-utils/fake-supabase`):

```ts
describe("createOrder com vitrine e frete", () => {
  const item = { id: "p1", name: "Ração", sku: "R1", brand: null, img: "", qty: 2, unitPrice: 10.5 };

  it("grava vitrine, modalidade, valores e unit_price", async () => {
    const { client, calls } = fakeSupabase({ orders: [{ data: { id: "o1" } }], order_items: [{}] });
    const r = await createOrder(client, {
      buyerId: "b1",
      channel: "mypetbrasil",
      items: [item],
      vitrine: "fabrica",
      shipping: { mode: "normal", subtotal: 21, shippingPrice: 19.9, total: 40.9 },
    });
    expect(r).toEqual({ orderId: "o1", error: null });
    const orderInsert = calls.find((c) => c.table === "orders" && c.method === "insert");
    expect(orderInsert?.args[0]).toMatchObject({
      vitrine: "fabrica",
      shipping_mode: "normal",
      subtotal: 21,
      shipping_price: 19.9,
      total: 40.9,
    });
    const itemsInsert = calls.find((c) => c.table === "order_items" && c.method === "insert");
    expect(itemsInsert?.args[0]).toEqual([
      { order_id: "o1", product_id: "p1", product_name_snapshot: "Ração", qty: 2, unit_price: 10.5 },
    ]);
  });

  it("sem vitrine e sem frete, não manda as colunas novas", async () => {
    const { client, calls } = fakeSupabase({ orders: [{ data: { id: "o1" } }], order_items: [{}] });
    await createOrder(client, { buyerId: "b1", channel: "mypetbrasil", items: [{ ...item, unitPrice: undefined }] });
    const orderInsert = calls.find((c) => c.table === "orders" && c.method === "insert");
    expect(orderInsert?.args[0]).toEqual({ buyer_id: "b1", channel: "mypetbrasil", status: "pendente" });
    const itemsInsert = calls.find((c) => c.table === "order_items" && c.method === "insert");
    expect((itemsInsert?.args[0] as { unit_price: unknown }[])[0].unit_price).toBeNull();
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- orders-server`
Expected: FAIL nos testes novos.

- [ ] **Step 7: Implementar em `orders-server.ts`**

Troque o tipo do `input` e a montagem de `baseRow` e dos itens:

```ts
export async function createOrder(
  supabase: SupabaseClient,
  input: {
    buyerId: string;
    channel: Channel;
    items: CartItem[];
    agentConversationId?: string | null;
    vitrine?: "completo" | "fabrica";
    shipping?: { mode: "normal" | "prioritaria" | "a_combinar"; subtotal: number; shippingPrice: number | null; total: number };
  }
): Promise<{ orderId: string | null; error: string | null }> {
  if (input.items.length === 0) {
    return { orderId: null, error: "O carrinho está vazio." };
  }

  const baseRow: Record<string, unknown> = { buyer_id: input.buyerId, channel: input.channel, status: "pendente" };
  if (input.vitrine) baseRow.vitrine = input.vitrine;
  if (input.shipping) {
    baseRow.shipping_mode = input.shipping.mode;
    baseRow.subtotal = input.shipping.subtotal;
    baseRow.shipping_price = input.shipping.shippingPrice;
    baseRow.total = input.shipping.total;
  }
```

e, no insert de `order_items`:

```ts
    input.items.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      product_name_snapshot: item.name,
      qty: item.qty,
      unit_price: typeof item.unitPrice === "number" ? item.unitPrice : null,
    }))
```

Atualize os testes antigos de `createOrder` que fazem `toEqual` no insert de itens para incluir
`unit_price` (com `null` quando o item não tem `unitPrice`).

- [ ] **Step 8: Rodar o core**

Run: `pnpm --filter @mypet/core test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/retail-checkout-server.ts packages/core/src/retail-checkout-server.test.ts packages/core/src/orders-server.ts packages/core/src/orders-server.test.ts
git commit -m "feat(core): priceCart com recorte de canal e pedido com frete e preço unitário

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Carrinho por chave e caminho da vitrine

**Files:**
- Modify: `packages/core/src/components/cart-provider.tsx`
- Create: `packages/core/src/components/cart-provider.test.tsx`
- Create: `packages/core/src/components/vitrine-path.tsx`
- Modify: `packages/core/src/components/product-card.tsx:29,143`
- Modify: `packages/core/src/components/category-chips.tsx`
- Modify: `apps/mypet/app/_components/hub/hub-nav.tsx` (`ClienteActions`)

**Interfaces:**
- Produces:
  - `CartProvider({ children, storageKey = "mypet_cart" })`
  - `VitrinePathProvider({ basePath, children })`, `useVitrinePath(): string` (default `""`)
  - `CategoryChips({ categories, hrefBase = "", allHref = "/" })`

- [ ] **Step 1: Teste do carrinho**

`packages/core/src/components/cart-provider.test.tsx`:

```tsx
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { CartProvider, useCart } from "./cart-provider";

function Probe({ label }: { label: string }) {
  const { totalItems, addItem } = useCart();
  return (
    <button type="button" onClick={() => addItem({ id: label, name: label, sku: "", brand: null, img: "" }, 1)}>
      {label}:{totalItems}
    </button>
  );
}

beforeEach(() => localStorage.clear());

describe("CartProvider", () => {
  it("chaves diferentes não se misturam", () => {
    render(
      <>
        <CartProvider><Probe label="a" /></CartProvider>
        <CartProvider storageKey="mypet_cart_fabrica"><Probe label="b" /></CartProvider>
      </>,
    );
    act(() => screen.getByText("b:0").click());
    expect(screen.getByText("a:0")).toBeTruthy();
    expect(screen.getByText("b:1")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("mypet_cart_fabrica")!).items).toHaveLength(1);
    expect(localStorage.getItem("mypet_cart")).toBeNull();
  });

  it("sem storageKey usa mypet_cart", () => {
    render(<CartProvider><Probe label="a" /></CartProvider>);
    act(() => screen.getByText("a:0").click());
    expect(JSON.parse(localStorage.getItem("mypet_cart")!).items).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- cart-provider`
Expected: FAIL no primeiro teste (as duas instâncias usam a mesma chave).

- [ ] **Step 3: Implementar o store por chave**

Substitua tudo, de `const STORAGE_KEY` até `getServerSnapshot` inclusive, por:

```tsx
const DEFAULT_KEY = "mypet_cart";
const CART_EVENT = "mypet_cart_updated";
const EMPTY_CART: Cart = { items: [] };

type CartStore = { read: () => Cart; write: (cart: Cart) => void };
const stores = new Map<string, CartStore>();

function storeFor(key: string): CartStore {
  const existing = stores.get(key);
  if (existing) return existing;
  let cachedRaw: string | null = null;
  let cachedSnapshot: Cart = EMPTY_CART;
  const store: CartStore = {
    read() {
      let raw: string | null;
      try {
        raw = localStorage.getItem(key);
      } catch {
        raw = null;
      }
      if (raw === cachedRaw) return cachedSnapshot;
      cachedRaw = raw;
      try {
        cachedSnapshot = raw ? (JSON.parse(raw) as Cart) : EMPTY_CART;
      } catch {
        cachedSnapshot = EMPTY_CART;
      }
      return cachedSnapshot;
    },
    write(cart) {
      localStorage.setItem(key, JSON.stringify(cart));
      window.dispatchEvent(new Event(CART_EVENT));
    },
  };
  stores.set(key, store);
  return store;
}

function subscribe(callback: () => void) {
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getServerSnapshot(): Cart {
  return EMPTY_CART;
}
```

E o `CartProvider`:

```tsx
export function CartProvider({ children, storageKey = DEFAULT_KEY }: { children: React.ReactNode; storageKey?: string }) {
  const store = storeFor(storageKey);
  const cart = useSyncExternalStore(subscribe, store.read, getServerSnapshot);

  const addItemFn = useCallback((product: Omit<CartItem, "qty">, qty: number) => {
    store.write(addItemPure(store.read(), product, qty));
  }, [store]);

  const removeItemFn = useCallback((id: string, campaignId?: string) => {
    store.write(removeItemPure(store.read(), id, campaignId));
  }, [store]);

  const updateQtyFn = useCallback((id: string, qty: number, campaignId?: string) => {
    store.write(updateQtyPure(store.read(), id, qty, campaignId));
  }, [store]);

  const setLineFn = useCallback((product: Omit<CartItem, "qty" | "campaignId" | "campaignSlug">, qty: number) => {
    store.write(setLinePure(store.read(), product, qty));
  }, [store]);

  const clearFn = useCallback(() => {
    store.write(EMPTY_CART);
  }, [store]);
```

(o `return` com o `CartContext.Provider` continua igual).

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- cart-provider`
Expected: PASS.

- [ ] **Step 5: `vitrine-path.tsx`**

```tsx
"use client";

import { createContext, useContext } from "react";

// Prefixo das rotas da vitrine atual ("" no site normal, "/fabrica" na Linha de Fábrica).
// Os links de produto, de categoria e do carrinho montam o caminho com ele.
const VitrinePathContext = createContext("");

export function VitrinePathProvider({ basePath, children }: { basePath: string; children: React.ReactNode }) {
  return <VitrinePathContext.Provider value={basePath}>{children}</VitrinePathContext.Provider>;
}

export function useVitrinePath(): string {
  return useContext(VitrinePathContext);
}
```

- [ ] **Step 6: Links que usam o caminho**

`product-card.tsx`:
- `import { useVitrinePath } from "./vitrine-path";`
- no início de `ProductCard`: `const basePath = useVitrinePath();`
- linha 29: `href={\`${basePath}/produtos/${product.id}\`}`
- em `VerOpcoesLink`: acrescente `const basePath = useVitrinePath();` e use `href={\`${basePath}/produtos/${id}\`}`

`category-chips.tsx` (é Server Component, então recebe props):

```tsx
export function CategoryChips({
  categories,
  hrefBase = "",
  allHref = "/",
}: {
  categories: CategoryNode[];
  hrefBase?: string;
  allHref?: string;
}) {
```

Troque `href="/"` por `href={allHref}` e `href={\`/categoria/${c.slug}\`}` por `href={\`${hrefBase}/categoria/${c.slug}\`}`.

`apps/mypet/app/_components/hub/hub-nav.tsx`, dentro de `ClienteActions`:
- `import { useVitrinePath } from "@mypet/core/components/vitrine-path";`
- `const basePath = useVitrinePath();`
- `<a href={\`${basePath}/cotacao\`}>Seu pedido{count > 0 ? \` (${count})\` : ""}</a>`

- [ ] **Step 7: Teste do caminho no card**

Em `packages/core/src/components/product-card.test.tsx` (se não existir, crie seguindo o setup de
outro teste de componente em `packages/core/src/components/`, com o mesmo provider de `ClientConfig`
dos testes existentes):

```tsx
it("usa o caminho da vitrine no link do produto", () => {
  renderWithConfig(
    <VitrinePathProvider basePath="/fabrica">
      <ProductCard product={PRODUCT} />
    </VitrinePathProvider>,
  );
  expect(screen.getAllByRole("link")[0].getAttribute("href")).toBe(`/fabrica/produtos/${PRODUCT.id}`);
});
```

(`renderWithConfig` e `PRODUCT`: use o helper de render com `ClientConfig` e o produto de exemplo que
o arquivo ou os testes vizinhos já usam.)

- [ ] **Step 8: Rodar tudo que foi tocado**

Run: `pnpm --filter @mypet/core test && pnpm --filter mypet test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/components apps/mypet/app/_components/hub/hub-nav.tsx
git commit -m "feat(core): carrinho por chave e caminho de vitrine nos links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Recorte de canal no catálogo

**Files:**
- Modify: `packages/core/src/catalog.ts` (`queryCatalog`, `getCatalog`, `getBrands`, `getProductCount`, `getProductCategoryIds`, `getCategoriesWithProducts`; nova `isProductInChannel`)
- Modify: `packages/core/src/catalog.test.ts`
- Modify: `packages/core/src/components/catalog-section.tsx`

**Interfaces:**
- Produces:
  - `queryCatalog/getCatalog(params & { alsoInChannel?: string })`
  - `getBrands(channel: string, alsoInChannel?: string)`
  - `getProductCount(channel: string, alsoInChannel?: string)`
  - `getProductCategoryIds(channel: string, alsoInChannel?: string)`
  - `getCategoriesWithProducts(channel: string, alsoInChannel?: string)`
  - `isProductInChannel(id: string, channel: string): Promise<boolean>`
  - `CatalogSection` ganha `alsoInChannel?: string` e `categoryId?: string | string[]`

- [ ] **Step 1: Testes**

Em `packages/core/src/catalog.test.ts`, siga o mock de `getCatalogClient` que o arquivo já usa e
acrescente:

```ts
describe("alsoInChannel", () => {
  it("queryCatalog filtra pelo segundo canal com alias", async () => {
    const { client, calls } = fakeSupabase({ products: [{ data: [], count: 0 } as never] });
    mockCatalogClient(client);
    await queryCatalog({ page: 1, channel: "mypetbrasil", alsoInChannel: "ffa_fabrica" });
    expect(String(calls.find((c) => c.method === "select")?.args[0])).toContain("fab:product_channel_links!inner(channel)");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "fab.channel" && c.args[1] === "ffa_fabrica")).toBe(true);
  });

  it("sem alsoInChannel, a consulta não muda", async () => {
    const { client, calls } = fakeSupabase({ products: [{ data: [], count: 0 } as never] });
    mockCatalogClient(client);
    await queryCatalog({ page: 1, channel: "mypetbrasil" });
    expect(String(calls.find((c) => c.method === "select")?.args[0])).not.toContain("fab:");
  });

  it("isProductInChannel", async () => {
    const { client } = fakeSupabase({ product_channel_links: [{ data: { product_id: "p1" } }, { data: null }] });
    mockCatalogClient(client);
    expect(await isProductInChannel("p1", "ffa_fabrica")).toBe(true);
    expect(await isProductInChannel("p2", "ffa_fabrica")).toBe(false);
  });
});
```

(`mockCatalogClient`: use o jeito que o arquivo já tem de trocar `getCatalogClient`. Se for
`vi.mock("./supabase", ...)` com uma variável, atribua `client` a ela. Se `getBrands` e os outros têm
`"use cache"`, teste pela `queryCatalog`, que não tem cache, e pelos helpers sem cache. Se o fake não
tiver `not`, acrescente `"not"` em `CHAIN_METHODS` de `test-utils/fake-supabase.ts`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- catalog`
Expected: FAIL nos testes novos.

- [ ] **Step 3: Implementar**

No topo de `catalog.ts`, um auxiliar:

```ts
// Recorte: o produto também precisa estar ligado a `alsoInChannel` (ex.: linha de fábrica).
// Usa um segundo embed de product_channel_links com alias, filtrado por "fab.channel".
const alsoEmbed = (alsoInChannel?: string) => (alsoInChannel ? ", fab:product_channel_links!inner(channel)" : "");
```

Em `queryCatalog` e `getCatalog`, acrescente `alsoInChannel?: string` aos `params`. Em `queryCatalog`:

```ts
  const { q, brand, categoryId, page, channel, photo, pageSize, alsoInChannel } = params;
  ...
    .select(`${catalogSelect(photo)}, product_channel_links!inner(channel)${alsoEmbed(alsoInChannel)}`, { count: "exact" })
  ...
  if (alsoInChannel) query = query.eq("fab.channel", alsoInChannel);
```

(o `if` vai logo depois do `.order(...)`, antes dos filtros de `photo`).

Em `getBrands`, `getProductCount` e `getProductCategoryIds`, acrescente o parâmetro
`alsoInChannel?: string`, concatene `${alsoEmbed(alsoInChannel)}` ao final da string do `select` e
aplique `if (alsoInChannel) query = query.eq("fab.channel", alsoInChannel);`. Para isso, transforme o
encadeamento em `let query = ...` antes do `await`. Exemplo em `getBrands`:

```ts
export async function getBrands(channel: string, alsoInChannel?: string): Promise<string[]> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getCatalogClient();
  let query = supabase
    .from("products")
    .select(`brand, product_channel_links!inner(channel)${alsoEmbed(alsoInChannel)}`)
    .eq("status", "active")
    .neq("product_role", "variant")
    .eq("product_channel_links.channel", channel)
    .not("brand", "is", null);
  if (alsoInChannel) query = query.eq("fab.channel", alsoInChannel);
  const { data, error } = await query;
```

`getCategoriesWithProducts(channel: string, alsoInChannel?: string)` repassa para
`getProductCategoryIds(channel, alsoInChannel)`.

Nova função:

```ts
export async function isProductInChannel(id: string, channel: string): Promise<boolean> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const { data, error } = await getCatalogClient()
    .from("product_channel_links")
    .select("product_id")
    .eq("product_id", id)
    .eq("channel", channel)
    .maybeSingle();
  if (error) {
    console.error("[catalog] erro ao conferir canal do produto:", error.message);
    return false;
  }
  return Boolean(data);
}
```

`catalog-section.tsx`: acrescente às props `alsoInChannel?: string;` e `categoryId?: string | string[];`
(desestruture as duas) e troque as consultas:

```ts
    getCatalog({ q, brand, page, channel, alsoInChannel, categoryId }),
    getBrands(channel, alsoInChannel),
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test`
Expected: PASS.

- [ ] **Step 5: Conferir o alias contra o banco real**

Crie `C:\Users\MYPET~1\AppData\Local\Temp\claude\...\scratchpad\check-fab.ts` (fora do repo) com:

```ts
import "dotenv/config";
import { queryCatalog } from "@mypet/core/catalog";
const r = await queryCatalog({ page: 1, channel: "mypetbrasil", alsoInChannel: "ffa_fabrica", pageSize: 5 });
console.log(r.total, r.items.map((i) => i.name));
```

Run: `pnpm --filter mypet exec tsx --env-file=.env.local <caminho do check-fab.ts>`
Expected: `total` perto de 140 (os de fábrica com preço mypetbrasil), sem erro do PostgREST. Se der
erro de alias, confira a sintaxe de "embedded filters" com alias na doc do PostgREST antes de seguir.
Apague o arquivo depois.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/catalog.ts packages/core/src/catalog.test.ts packages/core/src/components/catalog-section.tsx packages/core/src/test-utils/fake-supabase.ts
git commit -m "feat(core): recorte por segundo canal nas consultas do catálogo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Vitrines, zona e finalização com frete no servidor

**Files:**
- Create: `apps/mypet/lib/vitrines.ts`
- Create: `apps/mypet/lib/zona.ts`
- Create: `apps/mypet/lib/zona.test.ts`
- Modify: `apps/mypet/app/cotacao/actions.ts`
- Modify: `apps/mypet/app/cotacao/actions.test.ts`
- Modify: `apps/mypet/app/cotacao/whatsapp-order.ts`
- Modify: `apps/mypet/app/cotacao/whatsapp-order.test.ts`

**Interfaces:**
- Consumes: `priceCart` (Task 6), `createOrder` (Task 6), `calcularFrete`, `classificarZona`, `shippingModeDe`, `paraCentavos`, `ZONA_ROTULO` (Task 5), `FRETE_CONFIG` (Task 5), `Buyer` (Task 2)
- Produces:
  - `type VitrineId = "completo" | "fabrica"`
  - `type Vitrine = { id: VitrineId; rotulo: string; basePath: string; homePath: string; alsoInChannel?: string; regraFrete: RegraFrete; cartKey: string }`
  - `VITRINES: Record<VitrineId, Vitrine>`
  - `zonaDoComprador(buyer: Pick<Buyer, "uf" | "municipio" | "cep" | "localizacao_status">): Zona`
  - `finalizeQuote(items: CartItem[], options?: { vitrine?: VitrineId; modalidade?: Modalidade; agentConversationId?: string }): Promise<FinalizeQuoteResult>`
  - `FinalizeQuoteResult = { ok: true; buyer: OrderBuyer; pedido: PedidoResumo } | { ok: false; error: string; needsAuth?: boolean }`
  - `PedidoResumo = { vitrine: VitrineId; items: CartItem[]; subtotal: number; zona: Zona; frete: FreteCalculo }`
  - `buildOrderWhatsAppUrl(buyer: OrderBuyer, pedido: PedidoResumo): string | null`

- [ ] **Step 1: `vitrines.ts` e `zona.ts`, com teste**

`apps/mypet/lib/vitrines.ts`:

```ts
import type { RegraFrete } from "@mypet/core/frete";

export type VitrineId = "completo" | "fabrica";
export type Vitrine = {
  id: VitrineId;
  rotulo: string;
  basePath: string;
  homePath: string;
  alsoInChannel?: string;
  regraFrete: RegraFrete;
  cartKey: string;
};

export const VITRINES: Record<VitrineId, Vitrine> = {
  completo: { id: "completo", rotulo: "Catálogo completo", basePath: "", homePath: "/produtos", regraFrete: "zona", cartKey: "mypet_cart" },
  fabrica: {
    id: "fabrica",
    rotulo: "Linha de Fábrica",
    basePath: "/fabrica",
    homePath: "/fabrica",
    alsoInChannel: "ffa_fabrica",
    regraFrete: "fabrica",
    cartKey: "mypet_cart_fabrica",
  },
};

export function isVitrineId(v: unknown): v is VitrineId {
  return v === "completo" || v === "fabrica";
}
```

`apps/mypet/lib/zona.ts`:

```ts
import { classificarZona, type Zona } from "@mypet/core/frete";
import type { Buyer } from "@mypet/core/buyers-server";
import { FRETE_CONFIG } from "./frete.config";

export function zonaDoComprador(buyer: Pick<Buyer, "uf" | "municipio" | "cep" | "localizacao_status">): Zona {
  return classificarZona(
    { uf: buyer.uf, municipio: buyer.municipio, cep: buyer.cep, status: buyer.localizacao_status },
    FRETE_CONFIG,
  );
}
```

`apps/mypet/lib/zona.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { zonaDoComprador } from "./zona";

describe("zonaDoComprador", () => {
  it("usa a config do mypet", () => {
    expect(zonaDoComprador({ uf: "SP", municipio: "Guarulhos", cep: "07000000", localizacao_status: "localizado" })).toBe("grande_sp");
    expect(zonaDoComprador({ uf: null, municipio: null, cep: null, localizacao_status: null })).toBe("fora");
  });
});
```

Run: `pnpm --filter mypet test -- lib/zona`
Expected: PASS.

- [ ] **Step 2: Testes da finalização**

Em `apps/mypet/app/cotacao/actions.test.ts`, acrescente o mock:

```ts
const priceCart = vi.fn();
vi.mock("@mypet/core/retail-checkout-server", () => ({ priceCart: (...a: unknown[]) => priceCart(...a) }));
```

Inclua `priceCart.mockReset();` no `beforeEach`. Nos testes antigos de sucesso, configure
`priceCart.mockResolvedValue({ ok: true, lines: [{ id: "p1", name: "Ração Premium", qty: 2, unitPrice: 50 }], subtotal: 100 })`,
o comprador do `requireBuyer` com `uf: "SP", municipio: "SAO PAULO", cep: "01001000", localizacao_status: "localizado"`,
e use IDs em formato UUID nos `ITEMS` (`"11111111-1111-4111-8111-111111111111"`), porque o
`parseCheckoutLines` exige UUID. Depois acrescente:

```ts
const UUID = "11111111-1111-4111-8111-111111111111";
const BUYER_SP = {
  id: "b1", nome: "Ana", empresa: "Pet A", whatsapp: "11999999999", cnpj: "12345678000199", email: null,
  uf: "SP", municipio: "SAO PAULO", cep: "01001000", localizacao_status: "localizado",
};
const LINE_ITEMS = [{ id: UUID, name: "Ração Premium", qty: 2, img: "x.jpg", brand: "B", sku: "R1", unitPrice: 1 }] as CartItem[];

describe("finalizeQuote com vitrine", () => {
  it("fábrica: recorta por ffa_fabrica, ignora estoque e grava frete fixo abaixo de R$ 299", async () => {
    requireBuyer.mockResolvedValue(BUYER_SP);
    priceCart.mockResolvedValue({ ok: true, lines: [{ id: UUID, name: "Ração Premium", qty: 2, unitPrice: 50 }], subtotal: 100 });
    createOrder.mockResolvedValue({ orderId: "o1", error: null });

    const r = await finalizeQuote(LINE_ITEMS, { vitrine: "fabrica" });

    expect(priceCart).toHaveBeenCalledWith(hubClient, "mypetbrasil", [{ id: UUID, qty: 2 }], { alsoInChannel: "ffa_fabrica", checkStock: false });
    expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({
      vitrine: "fabrica",
      shipping: { mode: "normal", subtotal: 100, shippingPrice: 19.9, total: 119.9 },
      items: [expect.objectContaining({ id: UUID, qty: 2, unitPrice: 50, img: "x.jpg" })],
    }));
    expect(r).toMatchObject({ ok: true, pedido: { vitrine: "fabrica", subtotal: 100, frete: { tipo: "fixo", valorCentavos: 1990 } } });
  });

  it("completo: zona do comprador e prioritária", async () => {
    requireBuyer.mockResolvedValue(BUYER_SP);
    priceCart.mockResolvedValue({ ok: true, lines: [{ id: UUID, name: "Ração Premium", qty: 2, unitPrice: 150 }], subtotal: 300 });
    createOrder.mockResolvedValue({ orderId: "o1", error: null });

    const r = await finalizeQuote(LINE_ITEMS, { vitrine: "completo", modalidade: "prioritaria" });

    expect(priceCart).toHaveBeenCalledWith(hubClient, "mypetbrasil", [{ id: UUID, qty: 2 }], { checkStock: false });
    expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({
      vitrine: "completo",
      shipping: { mode: "prioritaria", subtotal: 300, shippingPrice: 30, total: 330 },
    }));
    expect(r).toMatchObject({ ok: true, pedido: { zona: "capital" } });
  });

  it("fora de SP: a combinar, total igual ao subtotal", async () => {
    requireBuyer.mockResolvedValue({ ...BUYER_SP, uf: "RJ", municipio: "RIO DE JANEIRO" });
    priceCart.mockResolvedValue({ ok: true, lines: [{ id: UUID, name: "Ração Premium", qty: 2, unitPrice: 50 }], subtotal: 100 });
    createOrder.mockResolvedValue({ orderId: "o1", error: null });

    await finalizeQuote(LINE_ITEMS, { vitrine: "completo" });

    expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({
      shipping: { mode: "a_combinar", subtotal: 100, shippingPrice: null, total: 100 },
    }));
  });

  it("devolve o erro do priceCart sem gravar", async () => {
    requireBuyer.mockResolvedValue(BUYER_SP);
    priceCart.mockResolvedValue({ ok: false, error: "Algum item do carrinho não está mais à venda. Revise o carrinho." });

    const r = await finalizeQuote(LINE_ITEMS, { vitrine: "fabrica" });

    expect(r).toEqual({ ok: false, error: "Algum item do carrinho não está mais à venda. Revise o carrinho." });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("vitrine inválida vira completo", async () => {
    requireBuyer.mockResolvedValue(BUYER_SP);
    priceCart.mockResolvedValue({ ok: true, lines: [{ id: UUID, name: "Ração Premium", qty: 2, unitPrice: 50 }], subtotal: 100 });
    createOrder.mockResolvedValue({ orderId: "o1", error: null });

    await finalizeQuote(LINE_ITEMS, { vitrine: "xpto" as never });

    expect(createOrder).toHaveBeenCalledWith(hubClient, expect.objectContaining({ vitrine: "completo" }));
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter mypet test -- cotacao/actions`
Expected: FAIL.

- [ ] **Step 4: Implementar `actions.ts`**

Substitua imports, tipos e `finalizeQuote` (a função `ownedConversationId` fica igual):

```ts
"use server";

import { getHubServiceClient } from "@mypet/core/supabase";
import { createOrder } from "@mypet/core/orders-server";
import { priceCart } from "@mypet/core/retail-checkout-server";
import { parseCheckoutLines } from "@mypet/core/retail-checkout";
import { calcularFrete, paraCentavos, shippingModeDe, type FreteCalculo, type Modalidade, type Zona } from "@mypet/core/frete";
import { requireBuyer } from "@/lib/require-buyer";
import { clientConfig } from "@/client.config";
import { FRETE_CONFIG } from "@/lib/frete.config";
import { VITRINES, isVitrineId, type VitrineId } from "@/lib/vitrines";
import { zonaDoComprador } from "@/lib/zona";
import type { CartItem } from "@mypet/core/cart";
import type { Channel } from "@mypet/core/channels";

export type OrderBuyer = { nome: string; empresa: string; whatsapp: string; cnpj: string | null };
export type PedidoResumo = { vitrine: VitrineId; items: CartItem[]; subtotal: number; zona: Zona; frete: FreteCalculo };

export type FinalizeQuoteResult =
  | { ok: true; buyer: OrderBuyer; pedido: PedidoResumo }
  | { ok: false; error: string; needsAuth?: boolean };
```

```ts
export async function finalizeQuote(
  items: CartItem[],
  options: { vitrine?: VitrineId; modalidade?: Modalidade; agentConversationId?: string } = {},
): Promise<FinalizeQuoteResult> {
  const buyer = await requireBuyer();
  if (!buyer) {
    return { ok: false, error: "Faça seu cadastro para enviar o pedido.", needsAuth: true };
  }

  // Server action: os argumentos chegam do cliente sem garantia de tipo.
  const opts = (options && typeof options === "object" ? options : {}) as Record<string, unknown>;
  const vitrine = VITRINES[isVitrineId(opts.vitrine) ? opts.vitrine : "completo"];
  const modalidade: Modalidade = opts.modalidade === "prioritaria" ? "prioritaria" : "normal";
  const requestedConversationId = typeof opts.agentConversationId === "string" ? opts.agentConversationId : undefined;

  const lines = parseCheckoutLines(Array.isArray(items) ? items.map((i) => ({ id: i?.id, qty: i?.qty })) : items);
  if (!lines.ok) return { ok: false, error: lines.error };

  const supabase = getHubServiceClient();
  const channel = clientConfig.catalogChannel as Channel;
  const priced = await priceCart(
    supabase,
    channel,
    lines.value,
    vitrine.alsoInChannel ? { alsoInChannel: vitrine.alsoInChannel, checkStock: false } : { checkStock: false },
  );
  if (!priced.ok) return { ok: false, error: priced.error };

  const zona = zonaDoComprador(buyer);
  const frete = calcularFrete(
    { regra: vitrine.regraFrete, zona, subtotalCentavos: paraCentavos(priced.subtotal), modalidade },
    FRETE_CONFIG,
  );
  const shippingPrice = frete.valorCentavos === null ? null : frete.valorCentavos / 100;
  const total = Math.round((priced.subtotal + (shippingPrice ?? 0)) * 100) / 100;

  // Preço e nome do servidor; imagem, marca e SKU vêm do carrinho (só exibição).
  const byId = new Map(items.map((i) => [i.id, i]));
  const repriced: CartItem[] = priced.lines.map((line) => {
    const original = byId.get(line.id);
    return {
      id: line.id,
      name: line.name,
      qty: line.qty,
      unitPrice: line.unitPrice,
      sku: original?.sku ?? "",
      brand: original?.brand ?? null,
      img: original?.img ?? "",
    };
  });

  const agentConversationId = await ownedConversationId(supabase, buyer.id, requestedConversationId);
  const { error } = await createOrder(supabase, {
    buyerId: buyer.id,
    channel,
    items: repriced,
    agentConversationId,
    vitrine: vitrine.id,
    shipping: { mode: shippingModeDe(frete), subtotal: priced.subtotal, shippingPrice, total },
  });
  if (error) return { ok: false, error };

  return {
    ok: true,
    buyer: { nome: buyer.nome ?? "", empresa: buyer.empresa ?? "", whatsapp: buyer.whatsapp, cnpj: buyer.cnpj },
    pedido: { vitrine: vitrine.id, items: repriced, subtotal: priced.subtotal, zona, frete },
  };
}
```

Se um teste antigo esperar `createOrder` com `items` exatamente iguais aos recebidos, ajuste a
expectativa para os itens recalculados.

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter mypet test -- cotacao/actions`
Expected: PASS.

- [ ] **Step 6: Mensagem do WhatsApp: teste**

Em `apps/mypet/app/cotacao/whatsapp-order.test.ts`, substitua os testes de `buildOrderWhatsAppUrl` por
(mantendo o `vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", ...)` e o reimport de módulo que o arquivo já faz):

```ts
const BUYER = { nome: "Ana", empresa: "Pet A", whatsapp: "11999999999", cnpj: "12345678000199" };
const ITEM = { id: "p1", name: "Ração", sku: "R1", brand: null, img: "", qty: 2, unitPrice: 50 };

it("abre com a vitrine e fecha com região, entrega e frete", async () => {
  const { buildOrderWhatsAppUrl } = await loadModule();
  const url = buildOrderWhatsAppUrl(BUYER, {
    vitrine: "fabrica",
    items: [ITEM],
    subtotal: 100,
    zona: "fora",
    frete: { tipo: "fixo", modalidade: "normal", valorCentavos: 1990, faltaParaGratisCentavos: 19900, minimoGratisCentavos: 29900, prioritariaDisponivel: false, prazo: null },
  })!;
  const text = decodeURIComponent(url.split("text=")[1]);
  expect(text.startsWith("Pedido · Linha de Fábrica\n")).toBe(true);
  expect(text).toContain("Frete: R$ 19,90");
  expect(text).toContain("Total com frete: R$ 119,90");
  expect(text).toContain("Região: Fora da área de entrega direta");
});

it("frete a combinar", async () => {
  const { buildOrderWhatsAppUrl } = await loadModule();
  const text = decodeURIComponent(buildOrderWhatsAppUrl(BUYER, {
    vitrine: "completo",
    items: [ITEM],
    subtotal: 100,
    zona: "interior_30",
    frete: { tipo: "a_combinar", modalidade: "normal", valorCentavos: null, faltaParaGratisCentavos: 30000, minimoGratisCentavos: 40000, prioritariaDisponivel: false, prazo: null },
  })!.split("text=")[1]);
  expect(text.startsWith("Pedido · Catálogo completo\n")).toBe(true);
  expect(text).toContain("Frete: a combinar");
  expect(text).not.toContain("Total com frete");
});
```

(`loadModule`: o helper que o arquivo já usa para importar com a env aplicada. Se não existir, use
`await import("./whatsapp-order")` depois de `vi.resetModules()`.)

- [ ] **Step 7: Implementar `whatsapp-order.ts`**

```ts
import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
import { formatPrice } from "@mypet/core/catalog-utils";
import { ZONA_ROTULO } from "@mypet/core/frete";
import { VITRINES } from "@/lib/vitrines";
import type { OrderBuyer, PedidoResumo } from "./actions";

export type { OrderBuyer } from "./actions";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
const WHATSAPP_INTRO = "Olá! Quero fazer este pedido pela Tabela de Preços My Pet Brasil:";

export function hasWhatsAppNumber(): boolean {
  return WHATSAPP_NUMBER.length > 0;
}

function freteLines(pedido: PedidoResumo): string[] {
  const { frete } = pedido;
  const entrega = frete.modalidade === "prioritaria" ? "prioritária (mesmo dia, pedidos até 12h)" : "normal";
  const lines = ["", `Região: ${ZONA_ROTULO[pedido.zona]}`, `Entrega: ${entrega}`];
  if (frete.tipo === "a_combinar") {
    lines.push("Frete: a combinar");
  } else {
    lines.push(`Frete: ${frete.tipo === "gratis" ? "grátis" : formatPrice((frete.valorCentavos ?? 0) / 100)}`);
    lines.push(`Total com frete: ${formatPrice(pedido.subtotal + (frete.valorCentavos ?? 0) / 100)}`);
  }
  return lines;
}

export function buildOrderWhatsAppUrl(buyer: OrderBuyer, pedido: PedidoResumo): string | null {
  if (!hasWhatsAppNumber()) return null;
  const intro = `Pedido · ${VITRINES[pedido.vitrine].rotulo}\n${WHATSAPP_INTRO}`;
  const base = buildQuoteMessage(pedido.items, { ...buyer, cnpj: buyer.cnpj ?? undefined }, intro, { showPrices: true });
  return buildWhatsAppLink(WHATSAPP_NUMBER, [base, ...freteLines(pedido)].join("\n"));
}
```

Confira a saída de `formatPrice(19.9)` (`catalog-utils.ts:126`). Se não for `"R$ 19,90"` (por
exemplo, `"R$ 19,90"` com espaço não separável), ajuste a expectativa do teste para o formato real.

- [ ] **Step 8: Ajustar o chamador atual (compila até a Task 10)**

Em `cotacao-content.tsx`, no `handleSubmit`, troque
`const url = buildOrderWhatsAppUrl(cart.items, result.buyer);` por
`const url = buildOrderWhatsAppUrl(result.buyer, result.pedido);`.

- [ ] **Step 9: Rodar o mypet**

Run: `pnpm --filter mypet test && pnpm --filter mypet exec tsc --noEmit`
Expected: PASS, sem erros de tipo.

- [ ] **Step 10: Commit**

```bash
git add apps/mypet/lib apps/mypet/app/cotacao
git commit -m "feat(mypet): finalização recalcula preço e frete no servidor e manda a vitrine no WhatsApp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

> **Antes de publicar esta task:** a migration da Task 1 precisa estar aplicada em produção, senão o
> insert em `orders` falha por coluna inexistente.

---

### Task 10: Resumo de frete na finalização e no pedido rápido

**Files:**
- Create: `apps/mypet/app/_components/frete/frete-resumo.tsx`
- Create: `apps/mypet/app/_components/frete/frete-resumo.test.tsx`
- Create: `apps/mypet/app/_components/frete/frete-faixa.tsx`
- Create: `apps/mypet/app/_components/frete/frete-faixa.test.tsx`
- Modify: `apps/mypet/app/cotacao/cotacao-content.tsx`
- Modify: `apps/mypet/app/cotacao/page.tsx`
- Modify: `apps/mypet/app/pedido-rapido/page.tsx`
- Modify: `apps/mypet/app/pedido-rapido/pedido-rapido-table.tsx:251-260`

**Interfaces:**
- Consumes: `calcularFrete`, `ZONA_ROTULO`, `Zona`, `Modalidade` (Task 5), `FRETE_CONFIG`, `VITRINES`, `Vitrine`, `VitrineId` (Task 9), `agendarLocalizacao` (Task 3), `zonaDoComprador` (Task 9)
- Produces:
  - `FreteResumo({ regra, zona, subtotal, modalidade, onModalidade, palette })` (client), mostra a linha do frete, quanto falta, a escolha de modalidade e o total
  - `FreteFaixa({ regra, zona, palette })` (server), a faixa do topo
  - `CotacaoContent({ palette, vitrine, zona })`
  - `CotacaoPageBody({ vitrineId }: { vitrineId: VitrineId })`
  - `PedidoRapidoTable` ganha a prop `zona: Zona`

- [ ] **Step 1: Teste do `FreteResumo`**

`apps/mypet/app/_components/frete/frete-resumo.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { clientConfig } from "@/client.config";
import { FreteResumo } from "./frete-resumo";

const P = clientConfig.palette;

describe("FreteResumo", () => {
  it("fábrica abaixo do mínimo mostra o fixo e quanto falta", () => {
    render(<FreteResumo regra="fabrica" zona="fora" subtotal={100} modalidade="normal" onModalidade={() => {}} palette={P} />);
    expect(screen.getByText(/Faltam R\$\s?199,00 para o frete grátis/)).toBeTruthy();
    expect(screen.getByText(/R\$\s?19,90/)).toBeTruthy();
    expect(screen.queryByLabelText(/Prioritária/)).toBeNull();
  });

  it("capital oferece prioritária e avisa a troca", () => {
    const onModalidade = vi.fn();
    render(<FreteResumo regra="zona" zona="capital" subtotal={250} modalidade="normal" onModalidade={onModalidade} palette={P} />);
    expect(screen.getByText(/Frete grátis/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Prioritária/));
    expect(onModalidade).toHaveBeenCalledWith("prioritaria");
  });

  it("fora mostra a combinar", () => {
    render(<FreteResumo regra="zona" zona="fora" subtotal={250} modalidade="normal" onModalidade={() => {}} palette={P} />);
    expect(screen.getByText(/a combinar/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter mypet test -- frete-resumo`
Expected: FAIL.

- [ ] **Step 3: Implementar `FreteResumo`**

```tsx
"use client";

import { formatBRL } from "@mypet/core/catalog-utils";
import { calcularFrete, paraCentavos, type Modalidade, type RegraFrete, type Zona } from "@mypet/core/frete";
import type { Palette } from "@mypet/core/theme";
import { FRETE_CONFIG } from "@/lib/frete.config";

export function FreteResumo({
  regra,
  zona,
  subtotal,
  modalidade,
  onModalidade,
  palette: P,
}: {
  regra: RegraFrete;
  zona: Zona;
  subtotal: number;
  modalidade: Modalidade;
  onModalidade: (m: Modalidade) => void;
  palette: Palette;
}) {
  const frete = calcularFrete({ regra, zona, subtotalCentavos: paraCentavos(subtotal), modalidade }, FRETE_CONFIG);
  const freteNormal = calcularFrete({ regra, zona, subtotalCentavos: paraCentavos(subtotal), modalidade: "normal" }, FRETE_CONFIG);
  const valor = frete.valorCentavos === null ? null : frete.valorCentavos / 100;
  const tarifaPrioritaria = FRETE_CONFIG.zonas[zona].prioritaria;

  return (
    <div className="fr-box" style={{ borderColor: P.gray200 }}>
      {frete.prioritariaDisponivel && regra === "zona" && (
        <fieldset className="fr-modes">
          <legend className="fr-legend" style={{ color: P.navy }}>Entrega</legend>
          <label>
            <input type="radio" name="modalidade" checked={modalidade === "normal"} onChange={() => onModalidade("normal")} />{" "}
            Normal ({FRETE_CONFIG.prazoNormal}) · {freteNormal.tipo === "gratis" ? "grátis" : formatBRL((freteNormal.valorCentavos ?? 0) / 100)}
          </label>
          <label>
            <input type="radio" name="modalidade" checked={modalidade === "prioritaria"} onChange={() => onModalidade("prioritaria")} />{" "}
            Prioritária (mesmo dia, pedidos até 12h) · {formatBRL((tarifaPrioritaria ?? 0) / 100)}
          </label>
        </fieldset>
      )}

      <div className="fr-line" style={{ color: P.navy }}>
        <span>Frete</span>
        <strong>{frete.tipo === "a_combinar" ? "A combinar no WhatsApp" : frete.tipo === "gratis" ? "Frete grátis" : formatBRL(valor ?? 0)}</strong>
      </div>

      {frete.modalidade === "normal" && frete.faltaParaGratisCentavos !== null && frete.faltaParaGratisCentavos > 0 && (
        <p className="fr-hint" style={{ color: P.pinkDark }}>
          Faltam {formatBRL(frete.faltaParaGratisCentavos / 100)} para o frete grátis
        </p>
      )}
      {frete.tipo !== "a_combinar" && (
        <div className="fr-line fr-total" style={{ color: P.navy }}>
          <span>Total com frete</span>
          <strong>{formatBRL(subtotal + (valor ?? 0))}</strong>
        </div>
      )}
      <style>{FRETE_STYLES}</style>
    </div>
  );
}

const FRETE_STYLES = `
  .fr-box { border-top: 1px solid; margin-top: 12px; padding-top: 12px; display: grid; gap: 8px; }
  .fr-modes { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; font-size: 13px; }
  .fr-legend { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
  .fr-line { display: flex; justify-content: space-between; align-items: baseline; font-size: 14px; }
  .fr-total strong { font-size: 18px; font-variant-numeric: tabular-nums; }
  .fr-hint { margin: 0; font-size: 13px; font-weight: 600; }
`;
```

Run: `pnpm --filter mypet test -- frete-resumo`
Expected: PASS. Se `formatBRL` usar espaço não separável, as regex com `\s?` já cobrem.

- [ ] **Step 4: `FreteFaixa`, com teste**

`apps/mypet/app/_components/frete/frete-faixa.tsx`:

```tsx
import { formatBRL } from "@mypet/core/catalog-utils";
import { ZONA_ROTULO, type RegraFrete, type Zona } from "@mypet/core/frete";
import type { Palette } from "@mypet/core/theme";
import { FRETE_CONFIG } from "@/lib/frete.config";

export function textoFaixa(regra: RegraFrete, zona: Zona): string {
  if (regra === "fabrica") {
    return `Frete grátis para todo o Brasil acima de ${formatBRL(FRETE_CONFIG.fabrica.minimoGratis / 100)}. Abaixo disso, ${formatBRL(FRETE_CONFIG.fabrica.fixo / 100)}.`;
  }
  const minimo = FRETE_CONFIG.zonas[zona].minimoGratis;
  if (zona === "fora" || minimo === null) return "Frete sob consulta para a sua região.";
  return `Sua região: ${ZONA_ROTULO[zona]} · frete grátis a partir de ${formatBRL(minimo / 100)}.`;
}

export function FreteFaixa({ regra, zona, palette: P }: { regra: RegraFrete; zona: Zona; palette: Palette }) {
  return (
    <p role="note" style={{ background: P.pinkLight, color: P.navy, borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>
      🚚 {textoFaixa(regra, zona)}
    </p>
  );
}
```

`apps/mypet/app/_components/frete/frete-faixa.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { textoFaixa } from "./frete-faixa";

describe("textoFaixa", () => {
  it("fábrica", () => {
    expect(textoFaixa("fabrica", "capital")).toMatch(/Frete grátis para todo o Brasil acima de R\$\s?299,00/);
  });
  it("catálogo com zona", () => {
    expect(textoFaixa("zona", "capital")).toMatch(/Sua região: Capital de SP · frete grátis a partir de R\$\s?200,00/);
  });
  it("catálogo fora", () => {
    expect(textoFaixa("zona", "fora")).toBe("Frete sob consulta para a sua região.");
  });
});
```

Run: `pnpm --filter mypet test -- frete-faixa`
Expected: PASS.

- [ ] **Step 5: `CotacaoContent` com vitrine, zona e modalidade**

Em `cotacao-content.tsx`:
- imports novos:
  ```ts
  import type { Modalidade, Zona } from "@mypet/core/frete";
  import type { Vitrine } from "@/lib/vitrines";
  import { FreteResumo } from "../_components/frete/frete-resumo";
  ```
- assinatura: `export function CotacaoContent({ palette: PALETTE, vitrine, zona }: { palette: Palette; vitrine: Vitrine; zona: Zona })`
- estado: `const [modalidade, setModalidade] = useState<Modalidade>("normal");`
- chamada: `result = await finalizeQuote(cart.items, { vitrine: vitrine.id, modalidade });`
- troque os três `href="/pedido-rapido"` por `href={vitrine.homePath}`
- textos: "Abrir tabela de preços" vira `Ver produtos`, e "Consulte a tabela e adicione produtos para montar seu pedido." vira `Adicione produtos para montar seu pedido.`
- no card do total, troque a linha "Total:" por "Produtos:" e, logo abaixo do `cq-total`, inclua:
  ```tsx
  <FreteResumo regra={vitrine.regraFrete} zona={zona} subtotal={total} modalidade={modalidade} onModalidade={setModalidade} palette={PALETTE} />
  ```
- o texto de rodapé vira: "Abriremos o WhatsApp com o pedido pronto. Nosso time confirma estoque e pagamento com você."

- [ ] **Step 6: `cotacao/page.tsx` parametrizada**

```tsx
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { agendarLocalizacao } from "@/lib/localizacao";
import { zonaDoComprador } from "@/lib/zona";
import { VITRINES, type VitrineId } from "@/lib/vitrines";
import { BUYER_STYLES } from "../_components/buyer-area/styles";
import { HubNav } from "../_components/hub/hub-nav";
import { cadastroHref, viewerFromBuyer } from "../_components/hub/doors";
import { CotacaoContent } from "./cotacao-content";

const { palette: PALETTE } = clientConfig;

export default function CotacaoPage() {
  return (
    <Suspense fallback={null}>
      <CotacaoPageBody vitrineId="completo" />
    </Suspense>
  );
}

// exported for tests
export async function CotacaoPageBody({ vitrineId }: { vitrineId: VitrineId }) {
  const vitrine = VITRINES[vitrineId];
  const buyer = await requireBuyer();
  if (!buyer) redirect(cadastroHref(`${vitrine.basePath}/cotacao`));
  agendarLocalizacao(buyer);

  return (
    <div className="ba-page">
      <style>{BUYER_STYLES}</style>
      <LeadGateProvider>
        <HubNav viewer={viewerFromBuyer(buyer)} />
        <main className="ba-main ba-main--narrow">
          <Link href={vitrine.homePath} className="ba-back">
            ← Continuar escolhendo
          </Link>
          <h1 className="ba-h1" style={{ marginBottom: 20 }}>Seu pedido · {vitrine.rotulo}</h1>
          <CotacaoContent palette={PALETTE} vitrine={vitrine} zona={zonaDoComprador(buyer)} />
        </main>
      </LeadGateProvider>
    </div>
  );
}
```

Atualize `apps/mypet/app/cotacao/page.test.tsx` (se existir): chame `CotacaoPageBody({ vitrineId: "completo" })`,
acrescente `vi.mock("@/lib/localizacao", () => ({ agendarLocalizacao: vi.fn() }))`, e espere o redirecionamento
`"/cadastro?next=%2Fcotacao"`. Atualize também `cotacao-content.test.tsx`: renderize com
`vitrine={VITRINES.completo} zona="capital"` e ajuste os mocks de `finalizeQuote` para devolver `pedido`.

- [ ] **Step 7: Pedido rápido com zona e barra de frete**

`pedido-rapido/page.tsx`: depois do `redirect`, acrescente `agendarLocalizacao(buyer);` e passe
`zona={zonaDoComprador(buyer)}` ao `<PedidoRapidoTable ...>` (com os imports de `@/lib/localizacao`
e `@/lib/zona`). No teste da página, mocke `@/lib/localizacao`.

`pedido-rapido-table.tsx`:
- prop nova `zona: Zona` (`import type { Zona } from "@mypet/core/frete";`)
- `import { calcularFrete, paraCentavos } from "@mypet/core/frete";` e `import { FRETE_CONFIG } from "@/lib/frete.config";`
- dentro do bloco `{totalItems > 0 && (...)}`, abaixo do texto `{totalItems} ... — {brl(cartTotal)}`:
  ```tsx
  {(() => {
    const f = calcularFrete({ regra: "zona", zona, subtotalCentavos: paraCentavos(cartTotal), modalidade: "normal" }, FRETE_CONFIG);
    if (f.tipo === "gratis") return <span className="pr-cartbar-frete">Frete grátis</span>;
    if (f.faltaParaGratisCentavos) return <span className="pr-cartbar-frete">Faltam {brl(f.faltaParaGratisCentavos / 100)} para o frete grátis</span>;
    return null;
  })()}
  ```
- no CSS do componente: `.pr-cartbar-frete { display: block; font-size: 12px; font-weight: 600; opacity: 0.85; }`

Nos testes da tabela, passe `zona="capital"` nos renders.

- [ ] **Step 8: Rodar**

Run: `pnpm --filter mypet test && pnpm --filter mypet exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/mypet/app/_components/frete apps/mypet/app/cotacao apps/mypet/app/pedido-rapido
git commit -m "feat(mypet): frete e modalidade de entrega no pedido e na tabela

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Vitrine `/produtos`

**Files:**
- Create: `apps/mypet/app/_components/vitrine/vitrine-styles.ts`
- Create: `apps/mypet/app/_components/vitrine/vitrine-cart-bar.tsx`
- Create: `apps/mypet/app/_components/vitrine/vitrine-page.tsx`
- Create: `apps/mypet/app/_components/vitrine/vitrine-page.test.tsx`
- Create: `apps/mypet/app/produtos/page.tsx`

**Interfaces:**
- Consumes: `VITRINES`, `Vitrine` (Task 9), `zonaDoComprador` (Task 9), `agendarLocalizacao` (Task 3), `FreteFaixa` (Task 10), `CatalogSection` com `alsoInChannel`/`categoryId` e `getCategoriesWithProducts(channel, alsoInChannel)` (Task 8), `CategoryChips` com `hrefBase`/`allHref` (Task 7), `calcularFrete` (Task 5)
- Produces:
  - `VitrinePageBody({ vitrine, searchParams, categoriaSlug }: { vitrine: Vitrine; searchParams: Promise<{ q?: string; brand?: string; page?: string }>; categoriaSlug?: string })`
  - `VitrineCartBar({ vitrine, zona, palette })` (client)
  - `VITRINE_STYLES: string`

- [ ] **Step 1: `VITRINE_STYLES`**

`apps/mypet/app/_components/vitrine/vitrine-styles.ts`: exporte `export const VITRINE_STYLES = \`...\`;`
com o CSS de `.cat-btn`, `.cat-btn:hover`, `.cat-btn.active`, `.chip-row`, `.chip-row::-webkit-scrollbar`,
`.product-card`, `.product-card:hover`, `.unlock-btn`, `.cta-primary` e o bloco `@media` de
`.products-grid`/`.product-card-media`, **copiados de `apps/mypet/app/loja/page.tsx`** (o template literal
dentro de `<style>{\`...\`}</style>` no início de `LojaContent`). Os `${PALETTE.x}` viram os valores
lidos de `clientConfig.palette` no topo do arquivo:

```ts
import { clientConfig } from "@/client.config";
const PALETTE = clientConfig.palette;
export const VITRINE_STYLES = `
  /* cole aqui as regras listadas acima, sem as de html/body/* */
`;
```

Inclua também:

```css
  .vt-cartbar { position: sticky; bottom: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-top: 1px solid; }
  .vt-cartbar-info { display: grid; font-size: 14px; font-weight: 700; }
  .vt-cartbar-frete { font-size: 12px; font-weight: 600; opacity: 0.85; }
```

- [ ] **Step 2: `VitrineCartBar`**

```tsx
"use client";

import Link from "next/link";
import { formatBRL } from "@mypet/core/catalog-utils";
import { useCart } from "@mypet/core/components/cart-provider";
import { calcularFrete, paraCentavos, type Zona } from "@mypet/core/frete";
import type { Palette } from "@mypet/core/theme";
import { FRETE_CONFIG } from "@/lib/frete.config";
import type { Vitrine } from "@/lib/vitrines";

export function VitrineCartBar({ vitrine, zona, palette: P }: { vitrine: Vitrine; zona: Zona; palette: Palette }) {
  const { cart, totalItems } = useCart();
  if (totalItems === 0) return null;
  const subtotal = cart.items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.qty, 0);
  const f = calcularFrete({ regra: vitrine.regraFrete, zona, subtotalCentavos: paraCentavos(subtotal), modalidade: "normal" }, FRETE_CONFIG);
  return (
    <div className="vt-cartbar" style={{ background: P.white, borderColor: P.gray200 }}>
      <div className="vt-cartbar-info" style={{ color: P.navy }}>
        <span>{totalItems} {totalItems === 1 ? "item" : "itens"} — {formatBRL(subtotal)}</span>
        {f.tipo === "gratis" && <span className="vt-cartbar-frete">Frete grátis</span>}
        {f.tipo !== "gratis" && !!f.faltaParaGratisCentavos && (
          <span className="vt-cartbar-frete">Faltam {formatBRL(f.faltaParaGratisCentavos / 100)} para o frete grátis</span>
        )}
      </div>
      <Link href={`${vitrine.basePath}/cotacao`} className="ba-btn ba-btn-primary">
        Ver pedido
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Teste da página da vitrine**

`apps/mypet/app/_components/vitrine/vitrine-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireBuyer = vi.fn();
const agendarLocalizacao = vi.fn();
const getCategoriesWithProducts = vi.fn(async () => [{ id: "c1", name: "Cães", slug: "caes", parent_id: null }]);
const redirect = vi.fn((_to: string) => {
  throw new Error("REDIRECT");
});
const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("@/lib/localizacao", () => ({ agendarLocalizacao: (b: unknown) => agendarLocalizacao(b) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to), notFound: () => notFound() }));
vi.mock("@mypet/core/catalog", () => ({
  getCategoriesWithProducts: (...a: unknown[]) => getCategoriesWithProducts(...(a as [])),
}));

import { VitrinePageBody } from "./vitrine-page";
import { VITRINES } from "@/lib/vitrines";

const BUYER = { id: "b1", nome: "Ana", empresa: null, whatsapp: "1", cnpj: null, email: null, uf: null, municipio: null, cep: null, localizacao_status: null };
const sp = Promise.resolve({});

beforeEach(() => {
  requireBuyer.mockReset();
  redirect.mockClear();
  notFound.mockClear();
  agendarLocalizacao.mockClear();
  getCategoriesWithProducts.mockClear();
});

describe("VitrinePageBody", () => {
  it("sem comprador, manda para o cadastro com volta para a vitrine", async () => {
    requireBuyer.mockResolvedValue(null);
    await expect(VitrinePageBody({ vitrine: VITRINES.fabrica, searchParams: sp })).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/cadastro?next=%2Ffabrica");
  });

  it("agenda a localização e busca categorias com o recorte da fábrica", async () => {
    requireBuyer.mockResolvedValue(BUYER);
    await VitrinePageBody({ vitrine: VITRINES.fabrica, searchParams: sp });
    expect(agendarLocalizacao).toHaveBeenCalledWith(BUYER);
    expect(getCategoriesWithProducts).toHaveBeenCalledWith("mypetbrasil", "ffa_fabrica");
  });

  it("categoria inexistente dá 404", async () => {
    requireBuyer.mockResolvedValue(BUYER);
    await expect(VitrinePageBody({ vitrine: VITRINES.fabrica, searchParams: sp, categoriaSlug: "xpto" })).rejects.toThrow("NOT_FOUND");
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `pnpm --filter mypet test -- vitrine-page`
Expected: FAIL.

- [ ] **Step 5: Implementar `vitrine-page.tsx`**

```tsx
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getCategoriesWithProducts } from "@mypet/core/catalog";
import { collectCategorySubtreeIds } from "@mypet/core/catalog-utils";
import { CatalogSection } from "@mypet/core/components/catalog-section";
import { CategoryChips } from "@mypet/core/components/category-chips";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { agendarLocalizacao } from "@/lib/localizacao";
import { zonaDoComprador } from "@/lib/zona";
import type { Vitrine } from "@/lib/vitrines";
import { BUYER_STYLES } from "../buyer-area/styles";
import { HubNav } from "../hub/hub-nav";
import { cadastroHref, viewerFromBuyer, type HubDoorId } from "../hub/doors";
import { FreteFaixa } from "../frete/frete-faixa";
import { VitrineCartBar } from "./vitrine-cart-bar";
import { VITRINE_STYLES } from "./vitrine-styles";

const { palette: PALETTE } = clientConfig;
const CHANNEL = clientConfig.catalogChannel;

export async function VitrinePageBody({
  vitrine,
  searchParams,
  categoriaSlug,
}: {
  vitrine: Vitrine;
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
  categoriaSlug?: string;
}) {
  const buyer = await requireBuyer();
  if (!buyer) redirect(cadastroHref(vitrine.homePath));
  agendarLocalizacao(buyer);

  const categories = await getCategoriesWithProducts(CHANNEL, vitrine.alsoInChannel);
  let categoryId: string[] | undefined;
  let categoriaNome: string | undefined;
  if (categoriaSlug) {
    const categoria = categories.find((c) => c.slug === categoriaSlug);
    if (!categoria) notFound();
    categoryId = collectCategorySubtreeIds(categories, categoria.id);
    categoriaNome = categoria.name;
  }

  const zona = zonaDoComprador(buyer);
  const { q, brand, page } = await searchParams;
  const current: HubDoorId = vitrine.id === "fabrica" ? "fabrica" : "produtos";

  return (
    <div className="ba-page">
      <style>{BUYER_STYLES}</style>
      <style>{VITRINE_STYLES}</style>
      <LeadGateProvider>
        <HubNav viewer={viewerFromBuyer(buyer)} current={current} />
        <main className="ba-main">
          <h1 className="ba-h1">{categoriaNome ? `${vitrine.rotulo} · ${categoriaNome}` : vitrine.rotulo}</h1>
          <FreteFaixa regra={vitrine.regraFrete} zona={zona} palette={PALETTE} />
          <CategoryChips categories={categories} hrefBase={vitrine.basePath} allHref={vitrine.homePath} />
          <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando produtos…</p>}>
            <CatalogSection
              q={q}
              brand={brand}
              page={page}
              channel={CHANNEL}
              alsoInChannel={vitrine.alsoInChannel}
              categoryId={categoryId}
              palette={PALETTE}
              addControl="stepper"
            />
          </Suspense>
        </main>
        <VitrineCartBar vitrine={vitrine} zona={zona} palette={PALETTE} />
      </LeadGateProvider>
    </div>
  );
}
```

Observação: o `HubDoorId` ganha `"produtos"` e `"fabrica"` só na Task 13. Para compilar agora, faça já
a mudança de tipo em `doors.ts`: `export type HubDoorId = "tabela" | "produtos" | "fabrica" | "catalogo" | "agente" | "duvidas";`.
As entradas em `DOORS` ficam para a Task 13.

Na vitrine `completo`, `basePath` é `""`, então as categorias apontam para `/categoria/<slug>` (a página
de categoria atual do mypet, portfólio completo) e "Todas" aponta para `/produtos`.

- [ ] **Step 6: Rota `/produtos`**

`apps/mypet/app/produtos/page.tsx`:

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { VITRINES } from "@/lib/vitrines";
import { VitrinePageBody } from "../_components/vitrine/vitrine-page";

export const metadata: Metadata = {
  title: "Produtos | My Pet Brasil",
  robots: { index: false, follow: false },
};

export default function ProdutosPage({ searchParams }: { searchParams: Promise<{ q?: string; brand?: string; page?: string }> }) {
  return (
    <Suspense fallback={null}>
      <VitrinePageBody vitrine={VITRINES.completo} searchParams={searchParams} />
    </Suspense>
  );
}
```

- [ ] **Step 7: Rodar**

Run: `pnpm --filter mypet test && pnpm --filter mypet exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Ver no navegador**

Run: `pnpm dev:mypet`, entrar com um comprador de teste e abrir `http://localhost:4100/produtos`.
Expected: faixa de frete, chips de categoria, grade de produtos com preço, barra do carrinho ao
adicionar, e "Ver pedido" levando a `/cotacao` com o resumo de frete. Use a skill `run` para
screenshot, se disponível.

- [ ] **Step 9: Commit**

```bash
git add apps/mypet/app/_components/vitrine apps/mypet/app/produtos/page.tsx apps/mypet/app/_components/hub/doors.ts
git commit -m "feat(mypet): vitrine /produtos com faixa e barra de frete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Vitrine `/fabrica`

**Files:**
- Create: `apps/mypet/app/fabrica/layout.tsx`
- Create: `apps/mypet/app/fabrica/page.tsx`
- Create: `apps/mypet/app/fabrica/categoria/[slug]/page.tsx`
- Create: `apps/mypet/app/fabrica/produtos/[id]/page.tsx`
- Create: `apps/mypet/app/fabrica/produtos/[id]/page.test.tsx`
- Create: `apps/mypet/app/fabrica/cotacao/page.tsx`

**Interfaces:**
- Consumes: `CartProvider storageKey`, `VitrinePathProvider` (Task 7), `isProductInChannel` (Task 8), `VitrinePageBody` (Task 11), `CotacaoPageBody({ vitrineId })` (Task 10), `VITRINES` (Task 9), `ProductPage` (default export de `apps/mypet/app/produtos/[id]/page.tsx`)

- [ ] **Step 1: Layout**

`apps/mypet/app/fabrica/layout.tsx`:

```tsx
import { CartProvider } from "@mypet/core/components/cart-provider";
import { VitrinePathProvider } from "@mypet/core/components/vitrine-path";
import { VITRINES } from "@/lib/vitrines";

// Tudo dentro de /fabrica usa o carrinho e os links da Linha de Fábrica.
export default function FabricaLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider storageKey={VITRINES.fabrica.cartKey}>
      <VitrinePathProvider basePath={VITRINES.fabrica.basePath}>{children}</VitrinePathProvider>
    </CartProvider>
  );
}
```

- [ ] **Step 2: Vitrine e categoria**

`apps/mypet/app/fabrica/page.tsx`:

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { VITRINES } from "@/lib/vitrines";
import { VitrinePageBody } from "../_components/vitrine/vitrine-page";

export const metadata: Metadata = {
  title: "Linha de Fábrica | My Pet Brasil",
  robots: { index: false, follow: false },
};

export default function FabricaPage({ searchParams }: { searchParams: Promise<{ q?: string; brand?: string; page?: string }> }) {
  return (
    <Suspense fallback={null}>
      <VitrinePageBody vitrine={VITRINES.fabrica} searchParams={searchParams} />
    </Suspense>
  );
}
```

`apps/mypet/app/fabrica/categoria/[slug]/page.tsx`:

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { VITRINES } from "@/lib/vitrines";
import { VitrinePageBody } from "../../../_components/vitrine/vitrine-page";

export const metadata: Metadata = { title: "Linha de Fábrica | My Pet Brasil", robots: { index: false, follow: false } };

async function Body({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  return <VitrinePageBody vitrine={VITRINES.fabrica} searchParams={searchParams} categoriaSlug={slug} />;
}

export default function FabricaCategoriaPage(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  return (
    <Suspense fallback={null}>
      <Body {...props} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Teste do produto da fábrica**

`apps/mypet/app/fabrica/produtos/[id]/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";

const isProductInChannel = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});
vi.mock("@mypet/core/catalog", () => ({ isProductInChannel: (...a: unknown[]) => isProductInChannel(...a) }));
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));
vi.mock("../../../produtos/[id]/page", () => ({ default: () => "PRODUCT_PAGE" }));

import { FabricaProdutoBody } from "./page";

describe("FabricaProdutoBody", () => {
  it("404 para produto que não é de fábrica", async () => {
    isProductInChannel.mockResolvedValue(false);
    await expect(FabricaProdutoBody({ params: Promise.resolve({ id: "p1" }) })).rejects.toThrow("NOT_FOUND");
    expect(isProductInChannel).toHaveBeenCalledWith("p1", "ffa_fabrica");
  });

  it("renderiza a página de produto para produto de fábrica", async () => {
    isProductInChannel.mockResolvedValue(true);
    const el = await FabricaProdutoBody({ params: Promise.resolve({ id: "p1" }) });
    expect(el).toBeTruthy();
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `pnpm --filter mypet test -- fabrica/produtos`
Expected: FAIL.

- [ ] **Step 5: Implementar produto e finalização**

`apps/mypet/app/fabrica/produtos/[id]/page.tsx`:

```tsx
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isProductInChannel } from "@mypet/core/catalog";
import { VITRINES } from "@/lib/vitrines";
import ProductPage from "../../../produtos/[id]/page";

export const metadata = { robots: { index: false, follow: false } };

// exported for tests
export async function FabricaProdutoBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isProductInChannel(id, VITRINES.fabrica.alsoInChannel!))) notFound();
  return <ProductPage params={params} />;
}

export default function FabricaProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <FabricaProdutoBody params={params} />
    </Suspense>
  );
}
```

`apps/mypet/app/fabrica/cotacao/page.tsx`:

```tsx
import { Suspense } from "react";
import { CotacaoPageBody } from "../../cotacao/page";

export const metadata = { title: "Seu pedido · Linha de Fábrica | My Pet Brasil", robots: { index: false, follow: false } };

export default function FabricaCotacaoPage() {
  return (
    <Suspense fallback={null}>
      <CotacaoPageBody vitrineId="fabrica" />
    </Suspense>
  );
}
```

- [ ] **Step 6: Rodar**

Run: `pnpm --filter mypet test && pnpm --filter mypet exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Ver no navegador os dois carrinhos**

Com `pnpm dev:mypet` rodando:
1. adicionar um item em `/produtos` e outro em `/fabrica`;
2. `/cotacao` mostra só o primeiro, e `/fabrica/cotacao` mostra só o segundo, com "Faltam R$ X para o frete grátis" e R$ 19,90;
3. o link "Seu pedido" do menu, dentro de `/fabrica`, leva a `/fabrica/cotacao`;
4. o card de produto em `/fabrica` leva a `/fabrica/produtos/<id>`, e "Adicionar" ali entra no carrinho da fábrica;
5. `/fabrica/produtos/<id de um produto que não é de fábrica>` dá 404.

- [ ] **Step 8: Commit**

```bash
git add apps/mypet/app/fabrica
git commit -m "feat(mypet): vitrine Linha de Fábrica com carrinho próprio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Menu, redirecionamento do `/loja` e revisão de copy

**Files:**
- Modify: `apps/mypet/app/_components/hub/doors.ts`
- Modify: `apps/mypet/app/_components/hub/doors.test.ts`
- Modify: `apps/mypet/app/loja/page.tsx:121`
- Modify: `apps/mypet/app/loja/page.test.tsx`
- Create: `apps/mypet/app/vitrines-copy.test.ts`

**Interfaces:**
- Consumes: `HubDoorId` com `produtos`/`fabrica` (Task 11)

- [ ] **Step 1: Testes do menu**

Em `doors.test.ts`, acrescente:

```ts
it("tem as portas na ordem combinada", () => {
  expect(hubDoors({ kind: "cliente", displayName: null }).map((d) => [d.id, d.label, d.href])).toEqual([
    ["tabela", "Tabela de preços", "/pedido-rapido"],
    ["produtos", "Produtos", "/produtos"],
    ["fabrica", "Linha de Fábrica", "/fabrica"],
    ["catalogo", "Catálogo", "/catalogo"],
    ["agente", "Agente", "/agente"],
    ["duvidas", "Dúvidas", "/central-de-ajuda"],
  ]);
});

it("aceita as vitrines no next do cadastro", () => {
  expect(safeNext("/produtos", "/x")).toBe("/produtos");
  expect(safeNext("/fabrica", "/x")).toBe("/fabrica");
  expect(safeNext("/fabrica/cotacao", "/x")).toBe("/fabrica/cotacao");
});
```

Ajuste os testes antigos de `hubDoors` que contam 4 portas.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter mypet test -- doors`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Em `doors.ts`:

```ts
const DOORS: { id: HubDoorId; label: string; path: string; needsAccess: boolean }[] = [
  { id: "tabela", label: "Tabela de preços", path: "/pedido-rapido", needsAccess: true },
  { id: "produtos", label: "Produtos", path: "/produtos", needsAccess: true },
  { id: "fabrica", label: "Linha de Fábrica", path: "/fabrica", needsAccess: true },
  { id: "catalogo", label: "Catálogo", path: "/catalogo", needsAccess: true },
  { id: "agente", label: "Agente", path: "/agente", needsAccess: false },
  { id: "duvidas", label: "Dúvidas", path: "/central-de-ajuda", needsAccess: false },
];

const NEXT_ALLOWED = ["/pedido-rapido", "/produtos", "/fabrica", "/fabrica/cotacao", "/catalogo", "/agente", "/pedidos", "/cotacao"];
```

Atualize o comentário do topo ("as quatro entradas" → "as entradas"). Em `hub-nav.tsx`, faça o mesmo
no comentário "as quatro portas".

Em `loja/page.tsx`, linha 121: `redirect("/pedido-rapido");` → `redirect("/produtos");`, e o comentário
acima passa a ser `// /loja antiga: a vitrine agora é /produtos.` Em `loja/page.test.tsx`, troque a
expectativa do redirecionamento para `"/produtos"`.

- [ ] **Step 4: Teste de copy das páginas novas**

`apps/mypet/app/vitrines-copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regra do mypet: nada de "loja", "atacado" ou "cotação" em texto visível.
// Confere os literais de texto (entre aspas, crases ou em JSX) dos arquivos novos.
const ARQUIVOS = [
  "_components/vitrine/vitrine-page.tsx",
  "_components/vitrine/vitrine-cart-bar.tsx",
  "_components/frete/frete-faixa.tsx",
  "_components/frete/frete-resumo.tsx",
  "cotacao/cotacao-content.tsx",
  "cotacao/page.tsx",
  "cotacao/whatsapp-order.ts",
  "produtos/page.tsx",
  "fabrica/page.tsx",
  "fabrica/cotacao/page.tsx",
  "_components/hub/doors.ts",
  "../lib/vitrines.ts",
  "../lib/frete.config.ts",
  "../../../packages/core/src/frete.ts",
];
const PROIBIDAS = /\b(loja|atacado|cota[cç][aã]o)\b/i;

function textosVisiveis(src: string): string[] {
  const semImports = src.replace(/^import .*$/gm, "").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const literais = [...semImports.matchAll(/(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g)].map((m) => m[2]);
  const jsx = [...semImports.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]);
  return [...literais, ...jsx].filter((t) => !t.startsWith("/") && !t.startsWith("@") && !t.startsWith("."));
}

describe("copy das vitrines", () => {
  for (const arquivo of ARQUIVOS) {
    it(`${arquivo} não usa palavras proibidas`, () => {
      const src = readFileSync(join(__dirname, arquivo), "utf8");
      expect(textosVisiveis(src).filter((t) => PROIBIDAS.test(t))).toEqual([]);
    });
  }
});
```

(O filtro ignora caminhos que começam com `/`, como `/fabrica/cotacao`, e nomes de módulo.)

- [ ] **Step 5: Rodar tudo**

Run: `pnpm --filter mypet test && pnpm --filter @mypet/core test && pnpm --filter mypet exec tsc --noEmit && pnpm lint`
Expected: PASS. Se o teste de copy pegar algo, troque o texto (nunca a regra).

- [ ] **Step 6: Build**

Run: `pnpm --filter mypet build`
Expected: build sem erro (o `cacheComponents` acusa acesso a dados fora de `Suspense`; se acusar,
envolva o trecho apontado num `Suspense`, seguindo o padrão das páginas existentes).

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/app/_components/hub apps/mypet/app/loja apps/mypet/app/vitrines-copy.test.ts
git commit -m "feat(mypet): menu com Produtos e Linha de Fábrica, /loja leva a /produtos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Depois das tasks (Fábio)

1. Aplicar a migration da Task 1 no Supabase `hub_catalogo` antes de publicar a Task 9.
2. `CLIENTES_SUPABASE_URL=... CLIENTES_SUPABASE_SERVICE_ROLE_KEY=... pnpm buyers:backfill-localizacao --dry-run`, conferir as contagens e rodar sem `--dry-run`.
3. Revisar `bairrosProximos` e `interior30km` em `apps/mypet/lib/frete.config.ts`.
4. Testar no navegador com um comprador de SP (capital) e um de fora: as duas vitrines, os dois carrinhos, prioritária, frete a combinar e a mensagem do WhatsApp.
5. Atualizar a memória `project_mypet_pedido_rapido_fluxo_principal` (o `/loja` agora leva a `/produtos`).
