# Distribuidora — identificação no acesso e "Fechar pedido" direto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na distribuidora, um pop-up obrigatório no primeiro acesso coleta Nome + WhatsApp (+ CNPJ opcional) e grava o lead; a barra flutuante "Fechar pedido" grava o pedido e abre o WhatsApp direto; `/cotacao` vira revisão sem formulário.

**Architecture:** Validação pura compartilhada (`br-validation.ts`) usada no cliente e nos handlers. Identidade guardada no `localStorage` com store `useSyncExternalStore`; `IdentityGateProvider` no layout mostra o pop-up e expõe `openIdentityGate()`. Hook `useCheckout()` concentra o fluxo pedido→WhatsApp, usado pela barra (`CheckoutBar`, que configura a `CartBar` do core via props opcionais novas) e por `/cotacao`.

**Tech Stack:** Next.js 16.2.6 (App Router, `cacheComponents: true`), React 19.2, Supabase, Vitest 4 + Testing Library, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-10-distribuidora-identificacao-fechar-pedido-design.md`

## Global Constraints

- Trabalhar direto na `main` (sem worktree).
- AGENTS.md: antes de usar API do Next, ler `apps/distribuidora/node_modules/next/dist/docs/`. Com `cacheComponents`, hooks de rota (`usePathname`) em componentes do layout ficam dentro de `<Suspense>`.
- Outros apps (mypet, madpet, azpetshop, distribuidora-instagram) não mudam de comportamento: props/parâmetros novos opcionais com default = atual. O handler `createLeadsPostHandler` (mypet + pop-up "Fale com") NÃO muda. O pré-acesso do mypet (`buyers`/`pre_access_attempts`) só tem o `isValidCnpj` extraído, sem mudança de comportamento.
- Pop-up: **Nome** e **WhatsApp** obrigatórios, **CNPJ** opcional (validado se preenchido). Sem e-mail. Lead vai para `leads` (canal `mypetbrasil`, `empresa: null`). Nunca gravar em `buyers`.
- WhatsApp é gravado normalizado: `55` + DDD + número (10 ou 11 dígitos após o 55). CNPJ gravado só com dígitos (ou `null`).
- Chave do `localStorage`: `mypet_identity`. Falha de rede/5xx ao gravar o lead libera o site mesmo assim.
- Moeda: `formatPrice` (NBSP após "R$"; em asserções de texto DOM normalize com `.replace(/\s/g, " ")`).
- Projeto Supabase: `hsguyfiyqpuligijcjlw` (hub_catalogo). `leads` tem policy `leads_insert_publico` (anon pode inserir).
- Testes: core → de `packages/core`, `npx vitest run <arquivo>` (o `pnpm --filter X test -- <arquivo>` ignora o filtro); componentes do core com `// @vitest-environment jsdom`. App distribuidora → de `apps/distribuidora`, `npx vitest run <arquivo>` (jsdom global).
- Commits terminam com linha em branco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- CNPJ válido para testes: `11222333000181` (`11.222.333/0001-81`).

## Desvios deliberados em relação à spec

- `rejectForeignRequest` (415/403) sai de `guest-orders-server.ts` para `packages/core/src/request-guards.ts`, compartilhado com o handler de lead.
- O handler de lead fica em arquivo novo `packages/core/src/identity-leads-server.ts` (export `./identity-leads-server`), não dentro de `leads-server.ts`, para não mexer nos testes/mocks do handler antigo.
- `br-validation.ts` também exporta `validateIdentity()`, usado no pop-up, no handler de lead e no handler de pedido — as mensagens de erro vêm dele (ex.: "Informe seu nome.", em vez de "Preencha nome e WhatsApp.").
- `useIdentity()` retorna `undefined` no servidor/antes da hidratação (pop-up oculto) — evita o pop-up piscar para quem já se identificou.
- Identidade tem fallback em memória quando o `localStorage` falha (senão o pop-up nunca fecharia nessa visita).

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20261010120000_leads_empresa_opcional.sql` | Criar | `leads.empresa` opcional |
| `apps/admin/lib/leads.ts`, `apps/admin/app/(dashboard)/clientes/page.tsx` | Modificar | empresa nula → "—" |
| `packages/core/src/br-validation.ts` (+ test) | Criar | CNPJ, WhatsApp, máscaras, `validateIdentity` |
| `packages/core/src/pre-access-server.ts` | Modificar | importa `isValidCnpj` |
| `packages/core/src/request-guards.ts` (+ test) | Criar | `rejectForeignRequest` |
| `packages/core/src/identity-leads-server.ts` (+ test) | Criar | `createIdentityLeadHandler` |
| `apps/distribuidora/app/api/leads/route.ts` | Modificar | usa o handler novo |
| `packages/core/src/guest-orders-server.ts` (+ test) | Modificar | empresa opcional, `validateIdentity` |
| `packages/core/src/whatsapp.ts` (+ test) | Modificar | `empresa?` |
| `packages/core/src/components/cart-bar.tsx` (+ test) | Modificar | props `actionLabel`, `onAction`, `busy`, `secondaryHref`, `secondaryLabel` |
| `apps/distribuidora/app/identity/identity-store.ts` (+ test) | Criar | `localStorage` + `useIdentity` |
| `apps/distribuidora/app/identity/submit-identity-lead.ts` | Criar | `POST /api/leads` |
| `apps/distribuidora/app/identity/identity-gate.tsx` (+ test) | Criar | provider + pop-up |
| `apps/distribuidora/app/checkout/use-checkout.ts` | Criar | pedido → WhatsApp |
| `apps/distribuidora/app/checkout/checkout-bar.tsx` (+ test) | Criar | barra "Fechar pedido" |
| `apps/distribuidora/app/cotacao/cotacao-content.tsx` (+ test) | Modificar | revisão sem formulário |
| `apps/distribuidora/app/layout.tsx` | Modificar | monta provider + `CheckoutBar` |

---

### Task 1: `leads.empresa` opcional + admin

**Files:**
- Create: `supabase/migrations/20261010120000_leads_empresa_opcional.sql`
- Modify: `apps/admin/lib/leads.ts`, `apps/admin/lib/leads.test.ts`, `apps/admin/app/(dashboard)/clientes/page.tsx:83`

**Interfaces:**
- Produces: `leads.empresa` nullable; `LeadRow.empresa: string | null`.

- [ ] **Step 1: Migration**

```sql
-- Lead da distribuidora (pop-up de identificação) não pede empresa.
alter table public.leads alter column empresa drop not null;
```

- [ ] **Step 2: Aplicar** — controlador aplica via MCP `apply_migration` (projeto `hsguyfiyqpuligijcjlw`, nome `leads_empresa_opcional`) após confirmação do usuário; verificar com `select is_nullable from information_schema.columns where table_name='leads' and column_name='empresa';` → `YES`.

- [ ] **Step 3: Teste do CSV (falha)** — em `apps/admin/lib/leads.test.ts`, adicionar:

```ts
it("empresa nula vira campo vazio no CSV", () => {
  const csv = leadsToCsv([
    { id: "1", nome: "Ana", empresa: null, whatsapp: "5511999999999", cnpj: null, channel: "mypetbrasil", status: "novo", created_at: "2026-10-10T10:00:00Z" },
  ]);
  expect(csv.split("\n")[1]).toBe("2026-10-10T10:00:00Z,Ana,,5511999999999,,mypetbrasil,novo");
});
```
Run (de `apps/admin`): `npx vitest run lib/leads.test.ts` — Expected: FAIL (tipo/`csvField(null)` quebra).

- [ ] **Step 4: Implementar** — `apps/admin/lib/leads.ts`: `empresa: string | null;` no `LeadRow`, e no `leadsToCsv` trocar `l.empresa` por `l.empresa ?? ""`. Em `clientes/page.tsx` linha 83: `<td className="px-4 py-3">{lead.empresa ?? "—"}</td>`.

- [ ] **Step 5: Verificar e commit**

Run (de `apps/admin`): `npx vitest run lib/leads.test.ts` → PASS; `pnpm --filter admin exec tsc --noEmit` → sem erros.

```bash
git add supabase/migrations/20261010120000_leads_empresa_opcional.sql apps/admin/lib/leads.ts apps/admin/lib/leads.test.ts "apps/admin/app/(dashboard)/clientes/page.tsx"
git commit -m "feat(db): empresa opcional em leads; admin mostra — quando vazia"
```

---

### Task 2: `br-validation.ts`

**Files:**
- Create: `packages/core/src/br-validation.ts`, `packages/core/src/br-validation.test.ts`
- Modify: `packages/core/src/pre-access-server.ts:40-56`, `packages/core/package.json` (exports)

**Interfaces:**
- Produces:
  - `onlyDigits(value: string): string`
  - `isValidCnpj(digits: string): boolean`
  - `normalizeWhatsapp(value: string): string | null` — `"55"` + 10/11 dígitos ou `null`
  - `formatCnpj(value: string): string` — máscara progressiva `11.222.333/0001-81`
  - `formatWhatsapp(value: string): string` — máscara progressiva `(11) 99999-9999` (aceita com ou sem `55`)
  - `type Identity = { nome: string; whatsapp: string; cnpj: string | null }`
  - `type IdentityField = "nome" | "whatsapp" | "cnpj"`
  - `validateIdentity(input: { nome?: unknown; whatsapp?: unknown; cnpj?: unknown }): { ok: true; value: Identity } | { ok: false; field: IdentityField; error: string }`

- [ ] **Step 1: Testes (falham)** — `packages/core/src/br-validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatCnpj, formatWhatsapp, isValidCnpj, normalizeWhatsapp, onlyDigits, validateIdentity } from "./br-validation";

describe("isValidCnpj", () => {
  it("aceita CNPJ válido", () => expect(isValidCnpj("11222333000181")).toBe(true));
  it("recusa dígito verificador errado", () => expect(isValidCnpj("11222333000182")).toBe(false));
  it("recusa dígitos repetidos e tamanho errado", () => {
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
  });
});

describe("normalizeWhatsapp", () => {
  it.each([
    ["(11) 99999-8888", "5511999998888"],
    ["11 3333-4444", "551133334444"],
    ["+55 11 99999-8888", "5511999998888"],
    ["5511999998888", "5511999998888"],
  ])("%s → %s", (input, expected) => expect(normalizeWhatsapp(input)).toBe(expected));

  it.each(["", "9999-8888", "119999988887777"])("recusa %s", (input) => expect(normalizeWhatsapp(input)).toBeNull());
});

describe("máscaras", () => {
  it("formatCnpj é progressiva", () => {
    expect(formatCnpj("11")).toBe("11");
    expect(formatCnpj("112223")).toBe("11.222.3");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("11.222.333/0001-8199")).toBe("11.222.333/0001-81");
  });
  it("formatWhatsapp é progressiva e aceita 55", () => {
    expect(formatWhatsapp("")).toBe("");
    expect(formatWhatsapp("1")).toBe("(1");
    expect(formatWhatsapp("119999")).toBe("(11) 9999");
    expect(formatWhatsapp("1133334444")).toBe("(11) 3333-4444");
    expect(formatWhatsapp("11999998888")).toBe("(11) 99999-8888");
    expect(formatWhatsapp("5511999998888")).toBe("(11) 99999-8888");
  });
  it("onlyDigits", () => expect(onlyDigits("a1-2.3")).toBe("123"));
});

describe("validateIdentity", () => {
  it("normaliza e aceita sem CNPJ", () => {
    expect(validateIdentity({ nome: "  Ana  ", whatsapp: "(11) 99999-8888", cnpj: "" })).toEqual({
      ok: true,
      value: { nome: "Ana", whatsapp: "5511999998888", cnpj: null },
    });
  });
  it("aceita CNPJ válido com máscara", () => {
    const result = validateIdentity({ nome: "Ana", whatsapp: "11999998888", cnpj: "11.222.333/0001-81" });
    expect(result).toEqual({ ok: true, value: { nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" } });
  });
  it.each([
    [{ nome: "", whatsapp: "11999998888" }, "nome", "Informe seu nome."],
    [{ nome: "A", whatsapp: "11999998888" }, "nome", "Informe seu nome."],
    [{ nome: "x".repeat(121), whatsapp: "11999998888" }, "nome", "Nome muito longo."],
    [{ nome: "Ana", whatsapp: "9999" }, "whatsapp", "Informe o WhatsApp com DDD."],
    [{ nome: "Ana", whatsapp: "11999998888", cnpj: "123" }, "cnpj", "CNPJ inválido."],
    [{ nome: 42, whatsapp: null }, "nome", "Informe seu nome."],
  ])("recusa %j", (input, field, error) => {
    expect(validateIdentity(input)).toEqual({ ok: false, field, error });
  });
});
```

Run (de `packages/core`): `npx vitest run src/br-validation.test.ts` — Expected: FAIL (módulo não existe).

- [ ] **Step 2: Implementar** — `packages/core/src/br-validation.ts`:

```ts
// Validações e máscaras brasileiras puras: usadas no navegador (pop-up) e nos handlers.

export type Identity = { nome: string; whatsapp: string; cnpj: string | null };
export type IdentityField = "nome" | "whatsapp" | "cnpj";

const MIN_NAME = 2;
const MAX_NAME = 120;

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digit = (length: number) => {
    let weight = length - 7;
    const sum = cnpj
      .slice(0, length)
      .split("")
      .reduce((total, char) => {
        const next = total + Number(char) * weight;
        weight = weight === 2 ? 9 : weight - 1;
        return next;
      }, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

// Mesmo formato gravado pelo pré-acesso do mypet: 55 + DDD + número.
export function normalizeWhatsapp(value: string): string | null {
  let digits = onlyDigits(value);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return /^\d{10,11}$/.test(digits) ? `55${digits}` : null;
}

export function formatCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += `.${d.slice(2, 5)}`;
  if (d.length > 5) out += `.${d.slice(5, 8)}`;
  if (d.length > 8) out += `/${d.slice(8, 12)}`;
  if (d.length > 12) out += `-${d.slice(12, 14)}`;
  return out;
}

export function formatWhatsapp(value: string): string {
  let d = onlyDigits(value);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const rest = d.slice(2);
  const cut = rest.length > 8 ? 5 : 4;
  return rest.length > cut ? `(${d.slice(0, 2)}) ${rest.slice(0, cut)}-${rest.slice(cut)}` : `(${d.slice(0, 2)}) ${rest}`;
}

export function validateIdentity(input: {
  nome?: unknown;
  whatsapp?: unknown;
  cnpj?: unknown;
}): { ok: true; value: Identity } | { ok: false; field: IdentityField; error: string } {
  const nome = typeof input.nome === "string" ? input.nome.trim() : "";
  if (nome.length < MIN_NAME) return { ok: false, field: "nome", error: "Informe seu nome." };
  if (nome.length > MAX_NAME) return { ok: false, field: "nome", error: "Nome muito longo." };

  const whatsapp = normalizeWhatsapp(typeof input.whatsapp === "string" ? input.whatsapp : "");
  if (!whatsapp) return { ok: false, field: "whatsapp", error: "Informe o WhatsApp com DDD." };

  const cnpjDigits = onlyDigits(typeof input.cnpj === "string" ? input.cnpj : "");
  if (cnpjDigits && !isValidCnpj(cnpjDigits)) return { ok: false, field: "cnpj", error: "CNPJ inválido." };

  return { ok: true, value: { nome, whatsapp, cnpj: cnpjDigits || null } };
}
```

- [ ] **Step 3: Rodar e ver passar** — `npx vitest run src/br-validation.test.ts` → PASS.

- [ ] **Step 4: Extrair do pré-acesso** — em `pre-access-server.ts`, apagar a função local `isValidCnpj` (linhas ~40-56) e adicionar no topo `import { isValidCnpj } from "./br-validation";`. Em `packages/core/package.json` → `exports`, após `"./banners"`: `"./br-validation": "./src/br-validation.ts",`.

Run: `npx vitest run src/pre-access-server.test.ts` → PASS (comportamento inalterado); depois a suíte inteira do core `pnpm --filter @mypet/core test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/br-validation.ts packages/core/src/br-validation.test.ts packages/core/src/pre-access-server.ts packages/core/package.json
git commit -m "feat(core): validação brasileira compartilhada (CNPJ, WhatsApp, identidade)"
```

---

### Task 3: Guarda de requisição + handler de lead da distribuidora

**Files:**
- Create: `packages/core/src/request-guards.ts`, `packages/core/src/request-guards.test.ts`
- Create: `packages/core/src/identity-leads-server.ts`, `packages/core/src/identity-leads-server.test.ts`
- Modify: `packages/core/src/guest-orders-server.ts` (remove `rejectForeignRequest` local, importa do novo módulo), `packages/core/package.json`, `apps/distribuidora/app/api/leads/route.ts`

**Interfaces:**
- Consumes: `validateIdentity` (Task 2); `getHubClient` (`./supabase`); `type Channel`.
- Produces:
  - `rejectForeignRequest(req: NextRequest): Response | null` (415 sem JSON; 403 Origin de outro host)
  - `createIdentityLeadHandler(channel: Channel): (req: NextRequest) => Promise<Response>` — 200 `{ ok: true }`, 400 `{ error, field }`, 415/403, 500 `{ error }`.

- [ ] **Step 1: Mover a guarda** — criar `packages/core/src/request-guards.ts` com o corpo EXATO da função `rejectForeignRequest` hoje em `guest-orders-server.ts` (linhas ~114-133), exportada:

```ts
import type { NextRequest } from "next/server";

// Rotas anônimas de escrita: só JSON e só do próprio site (bloqueia <form> cross-site text/plain).
export function rejectForeignRequest(req: NextRequest): Response | null {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Pedido inválido." }, { status: 415 });
  }
  const origin = req.headers.get("origin");
  if (origin !== null) {
    const host = req.headers.get("host") ?? req.nextUrl?.host;
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (!originHost || !host || originHost !== host) {
      return Response.json({ error: "Origem não permitida." }, { status: 403 });
    }
  }
  return null;
}
```

Em `guest-orders-server.ts`: apagar a função local e adicionar `import { rejectForeignRequest } from "./request-guards";`.

`packages/core/src/request-guards.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { rejectForeignRequest } from "./request-guards";

function req(headers: Record<string, string>): NextRequest {
  return { headers: new Headers({ host: "loja.exemplo.com", ...headers }), nextUrl: { host: "loja.exemplo.com" } } as unknown as NextRequest;
}

describe("rejectForeignRequest", () => {
  it("415 sem JSON", () => expect(rejectForeignRequest(req({ "content-type": "text/plain" }))?.status).toBe(415));
  it("403 com Origin de outro site", () =>
    expect(rejectForeignRequest(req({ "content-type": "application/json", origin: "https://mal.com" }))?.status).toBe(403));
  it("aceita mesma origem ou sem Origin", () => {
    expect(rejectForeignRequest(req({ "content-type": "application/json", origin: "https://loja.exemplo.com" }))).toBeNull();
    expect(rejectForeignRequest(req({ "content-type": "application/json; charset=utf-8" }))).toBeNull();
  });
});
```

Run: `npx vitest run src/request-guards.test.ts src/guest-orders-server.test.ts` → PASS.

- [ ] **Step 2: Testes do handler de lead (falham)** — `packages/core/src/identity-leads-server.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ insert: vi.fn(), error: null as null | { message: string } }));

vi.mock("./supabase", () => ({
  getHubClient: () => ({
    from: (table: string) => {
      if (table !== "leads") throw new Error(`tabela inesperada: ${table}`);
      return {
        insert: async (row: unknown) => {
          state.insert(row);
          return { error: state.error };
        },
      };
    },
  }),
}));

import { createIdentityLeadHandler } from "./identity-leads-server";

function fakeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const all = new Headers({ "content-type": "application/json", host: "loja.exemplo.com", ...headers });
  return { json: async () => body, headers: all, nextUrl: { host: "loja.exemplo.com" } } as unknown as NextRequest;
}

const POST = createIdentityLeadHandler("mypetbrasil");

beforeEach(() => {
  state.insert.mockReset();
  state.error = null;
});

describe("createIdentityLeadHandler", () => {
  it("grava nome, WhatsApp normalizado, CNPJ só dígitos e empresa nula", async () => {
    const res = await POST(fakeRequest({ nome: " Ana ", whatsapp: "(11) 99999-8888", cnpj: "11.222.333/0001-81" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.insert).toHaveBeenCalledWith({
      nome: "Ana",
      empresa: null,
      whatsapp: "5511999998888",
      cnpj: "11222333000181",
      channel: "mypetbrasil",
    });
  });

  it("CNPJ é opcional", async () => {
    await POST(fakeRequest({ nome: "Ana", whatsapp: "11999998888" }));
    expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({ cnpj: null }));
  });

  it.each([
    [{ nome: "", whatsapp: "11999998888" }, "nome"],
    [{ nome: "Ana", whatsapp: "123" }, "whatsapp"],
    [{ nome: "Ana", whatsapp: "11999998888", cnpj: "11222333000182" }, "cnpj"],
  ])("400 com o campo inválido %j", async (body, field) => {
    const res = await POST(fakeRequest(body));
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe(field);
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("400 com JSON inválido", async () => {
    const req = { json: async () => { throw new SyntaxError("x"); }, headers: new Headers({ "content-type": "application/json" }), nextUrl: { host: "loja.exemplo.com" } } as unknown as NextRequest;
    expect((await POST(req)).status).toBe(400);
  });

  it("415 e 403 pela guarda", async () => {
    expect((await POST(fakeRequest({}, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(fakeRequest({}, { origin: "https://mal.com" }))).status).toBe(403);
  });

  it("500 quando o banco falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.error = { message: "falhou" };
    const res = await POST(fakeRequest({ nome: "Ana", whatsapp: "11999998888" }));
    expect(res.status).toBe(500);
  });
});
```

Run: `npx vitest run src/identity-leads-server.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar** — `packages/core/src/identity-leads-server.ts`:

```ts
import type { NextRequest } from "next/server";
import { getHubClient } from "./supabase";
import { rejectForeignRequest } from "./request-guards";
import { validateIdentity } from "./br-validation";
import type { Channel } from "./channels";

// Lead do pop-up de identificação da distribuidora: nome + WhatsApp, CNPJ opcional, sem empresa.
// O createLeadsPostHandler (pop-up "Fale com", mypet) continua separado e inalterado.
export function createIdentityLeadHandler(channel: Channel) {
  return async function POST(req: NextRequest): Promise<Response> {
    const rejected = rejectForeignRequest(req);
    if (rejected) return rejected;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const parsed = validateIdentity((body ?? {}) as Record<string, unknown>);
    if (!parsed.ok) return Response.json({ error: parsed.error, field: parsed.field }, { status: 400 });

    const { nome, whatsapp, cnpj } = parsed.value;
    const { error } = await getHubClient().from("leads").insert({ nome, empresa: null, whatsapp, cnpj, channel });
    if (error) {
      console.error("[identity-leads] erro ao gravar lead:", error.message);
      return Response.json({ error: "Não foi possível salvar seus dados agora." }, { status: 500 });
    }
    return Response.json({ ok: true });
  };
}
```

`packages/core/package.json` → `exports`, após `"./help-center"`: `"./identity-leads-server": "./src/identity-leads-server.ts",`.

`apps/distribuidora/app/api/leads/route.ts`:

```ts
import { createIdentityLeadHandler } from "@mypet/core/identity-leads-server";
import type { Channel } from "@mypet/core/channels";
import { clientConfig } from "@/client.config";

// Pop-up de identificação (nome + WhatsApp, CNPJ opcional) grava em leads.
export const POST = createIdentityLeadHandler(clientConfig.catalogChannel as Channel);
```

Atenção: o `LeadGateProvider` ("Fale com", ainda montado nas páginas da distribuidora) também posta em `/api/leads` com `{ nome, empresa, whatsapp, cnpj }` — continua funcionando (o handler novo ignora `empresa` e valida nome/WhatsApp/CNPJ). Isso é aceito.

- [ ] **Step 4: Verificar e commit**

Run: `npx vitest run src/identity-leads-server.test.ts` → PASS; `pnpm --filter @mypet/core test` → PASS; `pnpm --filter distribuidora exec tsc --noEmit` → sem erros.

```bash
git add packages/core/src/request-guards.ts packages/core/src/request-guards.test.ts packages/core/src/identity-leads-server.ts packages/core/src/identity-leads-server.test.ts packages/core/src/guest-orders-server.ts packages/core/package.json apps/distribuidora/app/api/leads/route.ts
git commit -m "feat(distribuidora): lead do pop-up de identificação (nome + WhatsApp, CNPJ opcional)"
```

---

### Task 4: Pedido e mensagem sem empresa

**Files:**
- Modify: `packages/core/src/guest-orders-server.ts` (`parseGuestOrder`, `GuestCustomer`, insert de `orders`)
- Modify: `packages/core/src/guest-orders-server.test.ts`
- Modify: `packages/core/src/whatsapp.ts:4-9,45-50`, `packages/core/src/whatsapp.test.ts`

**Interfaces:**
- Consumes: `validateIdentity` (Task 2).
- Produces: `QuoteCustomer = { nome: string; empresa?: string; whatsapp: string; cnpj?: string }`; pedido aceita `customer: { nome, whatsapp, cnpj?, empresa? }`.

- [ ] **Step 1: Testes (falham)**

Em `whatsapp.test.ts`, adicionar:

```ts
it("sem empresa omite a linha Empresa", () => {
  const items: CartItem[] = [{ id: "p1", name: "COLEIRA", sku: "", brand: null, img: "/c.jpg", qty: 1 }];
  const message = buildQuoteMessage(items, { nome: "Ana", whatsapp: "(11) 99999-8888" });
  expect(message).not.toContain("Empresa:");
  expect(message).toContain("Nome: Ana\nWhatsApp: (11) 99999-8888");
});
```

Em `guest-orders-server.test.ts`:
- Trocar o `customer` base por `{ nome: "João", whatsapp: "11999999999", cnpj: "" }` (sem empresa) e ajustar as expectativas do insert de `orders`: `customer_company: null`, `customer_whatsapp: "5511999999999"`.
- Onde um teste usa CNPJ preenchido, usar `"11.222.333/0001-81"` e esperar `customer_cnpj: "11222333000181"`.
- Remover/ajustar o caso de validação "sem empresa → 400" se existir (agora é válido).
- Adicionar:

```ts
it("aceita empresa quando enviada", async () => {
  await POST(fakeRequest({ items: [{ id: P1, qty: 1 }], customer: { ...customer, empresa: "Pet X" } }));
  expect(state.orderInsert).toHaveBeenCalledWith(expect.objectContaining({ customer_company: "Pet X" }));
});

it("400 com CNPJ inválido", async () => {
  const res = await POST(fakeRequest({ items: [{ id: P1, qty: 1 }], customer: { ...customer, cnpj: "123" } }));
  expect(res.status).toBe(400);
  expect(state.orderInsert).not.toHaveBeenCalled();
});

it("400 com WhatsApp inválido", async () => {
  const res = await POST(fakeRequest({ items: [{ id: P1, qty: 1 }], customer: { ...customer, whatsapp: "123" } }));
  expect(res.status).toBe(400);
});
```

Run (de `packages/core`): `npx vitest run src/whatsapp.test.ts src/guest-orders-server.test.ts` → FAIL.

- [ ] **Step 2: Implementar**

`whatsapp.ts`: tipo `empresa?: string;` e:

```ts
  const customerLines = [`Nome: ${customer.nome}`];
  if (customer.empresa) customerLines.push(`Empresa: ${customer.empresa}`);
  customerLines.push(`WhatsApp: ${customer.whatsapp}`);
  if (customer.cnpj) customerLines.push(`CNPJ: ${customer.cnpj}`);
```

`guest-orders-server.ts`:
- `import { validateIdentity } from "./br-validation";`
- `type GuestCustomer = { nome: string; empresa: string | null; whatsapp: string; cnpj: string | null };`
- Em `parseGuestOrder`, substituir o bloco de nome/empresa/whatsapp/cnpj (do `const nome = …` até o check de tamanhos) por:

```ts
  const identity = validateIdentity(customer ?? {});
  if (!identity.ok) return { ok: false, error: identity.error };
  const empresa = text(customer?.empresa);
  if (empresa.length > MAX_NAME) return { ok: false, error: "Algum dado está longo demais." };
```
e no retorno: `customer: { ...identity.value, empresa: empresa || null },`.
- Remover as constantes que ficarem sem uso (`MAX_WHATSAPP`, `MAX_CNPJ`) — manter `MAX_NAME` (usado na empresa).
- No insert de `orders`: `customer_company: customer.empresa,` (já é `string | null`).

- [ ] **Step 3: Verificar e commit**

Run: `npx vitest run src/whatsapp.test.ts src/guest-orders-server.test.ts` → PASS; `pnpm --filter @mypet/core test` → PASS; `pnpm --filter distribuidora test` e `pnpm --filter distribuidora exec tsc --noEmit` → PASS (o `cotacao-content` ainda manda empresa; continua válido).

```bash
git add packages/core/src/guest-orders-server.ts packages/core/src/guest-orders-server.test.ts packages/core/src/whatsapp.ts packages/core/src/whatsapp.test.ts
git commit -m "feat(pedidos): empresa opcional; pedido valida nome, WhatsApp e CNPJ"
```

---

### Task 5: `CartBar` com ação configurável

**Files:**
- Modify: `packages/core/src/components/cart-bar.tsx`, `packages/core/src/components/cart-bar.test.tsx`

**Interfaces:**
- Produces: `CartBar(props: { href?: string; actionLabel?: string; onAction?: () => void; busy?: boolean; secondaryHref?: string; secondaryLabel?: string })`. Sem `onAction`: idêntico a hoje (link inteiro para `href`, texto `"Enviar pedido →"`). Com `onAction`: container `div` fixo; resumo à esquerda; à direita link secundário (se houver) + `<button>` com `"{actionLabel} →"` (ou `"Enviando…"` quando `busy`, desabilitado).

- [ ] **Step 1: Testes (falham)** — adicionar ao `cart-bar.test.tsx` (mesmo setup/mocks do arquivo; usar `fireEvent` de `@testing-library/react`):

```tsx
  it("com onAction vira botão com o rótulo e chama a ação", () => {
    cart.items = [{ ...base, id: "a", name: "A", qty: 2, unitPrice: 10 }];
    const onAction = vi.fn();
    render(createElement(ClientConfigProvider, { config }, createElement(CartBar, { onAction, actionLabel: "Fechar pedido", secondaryHref: "/cotacao", secondaryLabel: "ver itens" })));
    fireEvent.click(screen.getByRole("button", { name: "Fechar pedido →" }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "ver itens" })).toHaveAttribute("href", "/cotacao");
  });

  it("busy mostra Enviando… e desabilita", () => {
    cart.items = [{ ...base, id: "a", name: "A", qty: 1, unitPrice: 10 }];
    render(createElement(ClientConfigProvider, { config }, createElement(CartBar, { onAction: vi.fn(), busy: true })));
    expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();
  });
```

Run: `npx vitest run src/components/cart-bar.test.tsx` → FAIL.

- [ ] **Step 2: Implementar** — em `cart-bar.tsx`, trocar a assinatura e o retorno de `CartBar` por:

```tsx
export function CartBar({
  href = DEFAULT_HREF,
  actionLabel = "Enviar pedido",
  onAction,
  busy = false,
  secondaryHref,
  secondaryLabel,
}: {
  href?: string;
  actionLabel?: string;
  /** Quando presente, a barra vira botão de ação em vez de link para `href`. */
  onAction?: () => void;
  busy?: boolean;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const { cart } = useCart();
  const { palette } = useClientConfig();
  const visible = useCartBarVisible(href);
  const totals = cartTotals(cart.items);

  if (!visible) return null;

  const unitsLabel = `${totals.totalUnits} ${totals.totalUnits === 1 ? "item" : "itens"}`;
  const valueLabel = totals.pricedLines > 0 ? ` · ${formatPrice(totals.totalValue)}` : "";
  const pendingLabel = totals.pricedLines > 0 && totals.unpricedLines > 0 ? " + itens a consultar" : "";

  const barStyle: React.CSSProperties = {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    minHeight: CART_BAR_HEIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 20px calc(12px + env(safe-area-inset-bottom))",
    background: palette.pink,
    color: palette.white,
    textDecoration: "none",
    fontFamily: "var(--font-nunito), sans-serif",
    fontSize: 15,
    fontWeight: 800,
    boxShadow: "0 -6px 20px rgba(15,31,69,0.18)",
  };

  const summary = (
    <span>
      {unitsLabel}
      {valueLabel}
      {pendingLabel && <span style={{ fontWeight: 600, opacity: 0.9 }}>{pendingLabel}</span>}
    </span>
  );

  return (
    <>
      <div aria-hidden style={{ height: `calc(${CART_BAR_HEIGHT}px + env(safe-area-inset-bottom))` }} />
      {onAction ? (
        <div style={barStyle}>
          {summary}
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {secondaryHref && secondaryLabel && (
              <Link href={secondaryHref} style={{ color: palette.white, fontSize: 13, fontWeight: 700, textDecoration: "underline", whiteSpace: "nowrap" }}>
                {secondaryLabel}
              </Link>
            )}
            <button
              type="button"
              onClick={onAction}
              disabled={busy}
              style={{
                whiteSpace: "nowrap",
                background: palette.white,
                color: palette.pinkDark,
                border: "none",
                borderRadius: 100,
                padding: "8px 16px",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 900,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "Enviando…" : `${actionLabel} →`}
            </button>
          </span>
        </div>
      ) : (
        <Link href={href} style={barStyle}>
          {summary}
          <span style={{ whiteSpace: "nowrap" }}>{actionLabel} →</span>
        </Link>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verificar e commit**

Run: `npx vitest run src/components/cart-bar.test.tsx` → PASS (inclusive os antigos: sem `onAction` continua link com "Enviar pedido →"); `pnpm --filter @mypet/core test` → PASS.

```bash
git add packages/core/src/components/cart-bar.tsx packages/core/src/components/cart-bar.test.tsx
git commit -m "feat(core): CartBar aceita ação, estado de envio e link secundário (opt-in)"
```

---

### Task 6: Identidade no cliente + pop-up

**Files:**
- Create: `apps/distribuidora/app/identity/identity-store.ts`, `apps/distribuidora/app/identity/identity-store.test.ts`
- Create: `apps/distribuidora/app/identity/submit-identity-lead.ts`
- Create: `apps/distribuidora/app/identity/identity-gate.tsx`, `apps/distribuidora/app/identity/identity-gate.test.tsx`
- Modify: `apps/distribuidora/app/layout.tsx`

**Interfaces:**
- Consumes: `validateIdentity`, `formatWhatsapp`, `formatCnpj`, `type Identity`, `type IdentityField` (`@mypet/core/br-validation`); `POST /api/leads` (Task 3); `useClientConfig` (`@mypet/core/theme`).
- Produces:
  - `readIdentity(): Identity | null`, `saveIdentity(identity: Identity): void`, `useIdentity(): Identity | null | undefined` (`undefined` = servidor/antes da hidratação), `__resetIdentityForTests(): void`
  - `submitIdentityLead(identity: Identity, fetchImpl?: typeof fetch): Promise<{ kind: "ok" } | { kind: "invalid"; field?: IdentityField; error: string } | { kind: "failed" }>`
  - `IdentityGateProvider({ children })` e `useIdentityGate(): { openIdentityGate: () => void }`

- [ ] **Step 1: Store — teste (falha)** — `identity-store.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetIdentityForTests, readIdentity, saveIdentity, useIdentity } from "./identity-store";

const ana = { nome: "Ana", whatsapp: "5511999998888", cnpj: null };

beforeEach(() => {
  localStorage.clear();
  __resetIdentityForTests();
});

describe("identity-store", () => {
  it("começa vazio e persiste ao salvar", () => {
    expect(readIdentity()).toBeNull();
    saveIdentity(ana);
    expect(readIdentity()).toEqual(ana);
    expect(JSON.parse(localStorage.getItem("mypet_identity") ?? "null")).toEqual(ana);
  });

  it("ignora conteúdo corrompido", () => {
    localStorage.setItem("mypet_identity", "{lixo");
    expect(readIdentity()).toBeNull();
  });

  it("useIdentity reage ao salvar", () => {
    const { result } = renderHook(() => useIdentity());
    expect(result.current).toBeNull();
    act(() => saveIdentity(ana));
    expect(result.current).toEqual(ana);
  });

  it("sem localStorage ainda guarda em memória", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    saveIdentity(ana);
    expect(readIdentity()).toEqual(ana);
    setItem.mockRestore();
  });
});
```

Run (de `apps/distribuidora`): `npx vitest run app/identity/identity-store.test.ts` → FAIL.

- [ ] **Step 2: Store — implementar** — `identity-store.ts`:

```ts
import { useSyncExternalStore } from "react";
import type { Identity } from "@mypet/core/br-validation";

const STORAGE_KEY = "mypet_identity";
const EVENT = "mypet_identity_updated";

let cachedRaw: string | null | undefined;
let cached: Identity | null = null;
// Fallback quando o localStorage está bloqueado: sem ele o pop-up nunca fecharia.
let memory: Identity | null = null;

function parse(raw: string): Identity | null {
  try {
    const value = JSON.parse(raw) as Partial<Identity> | null;
    if (value && typeof value.nome === "string" && typeof value.whatsapp === "string") {
      return { nome: value.nome, whatsapp: value.whatsapp, cnpj: typeof value.cnpj === "string" ? value.cnpj : null };
    }
  } catch {
    // conteúdo corrompido: trata como sem identidade
  }
  return null;
}

export function readIdentity(): Identity | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = raw ? parse(raw) : null;
  }
  return cached ?? memory;
}

export function saveIdentity(identity: Identity): void {
  memory = identity;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // segue só com a memória
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// undefined no servidor e antes da hidratação: o pop-up só decide depois.
export function useIdentity(): Identity | null | undefined {
  return useSyncExternalStore<Identity | null | undefined>(subscribe, readIdentity, () => undefined);
}

export function __resetIdentityForTests(): void {
  cachedRaw = undefined;
  cached = null;
  memory = null;
}
```

Run: `npx vitest run app/identity/identity-store.test.ts` → PASS.

- [ ] **Step 3: Envio do lead** — `submit-identity-lead.ts`:

```ts
import type { Identity, IdentityField } from "@mypet/core/br-validation";

export type SubmitIdentityResult =
  | { kind: "ok" }
  | { kind: "invalid"; field?: IdentityField; error: string }
  | { kind: "failed" };

// Só 400 segura o pop-up; rede/5xx liberam o site (erro nosso não prende o cliente).
export async function submitIdentityLead(identity: Identity, fetchImpl: typeof fetch = fetch): Promise<SubmitIdentityResult> {
  try {
    const res = await fetchImpl("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identity),
    });
    if (res.ok) return { kind: "ok" };
    const data = await res.json().catch(() => ({}));
    if (res.status === 400) {
      return {
        kind: "invalid",
        field: data.field === "nome" || data.field === "whatsapp" || data.field === "cnpj" ? data.field : undefined,
        error: typeof data.error === "string" ? data.error : "Confira os dados.",
      };
    }
    console.error("[identidade] falha ao gravar lead:", res.status, data?.error);
    return { kind: "failed" };
  } catch (error) {
    console.error("[identidade] falha ao gravar lead:", error);
    return { kind: "failed" };
  }
}
```

- [ ] **Step 4: Pop-up — teste (falha)** — `identity-gate.test.tsx`:

```tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientConfigProvider } from "@mypet/core/theme";
import { clientConfig } from "@/client.config";
import { __resetIdentityForTests, readIdentity, saveIdentity } from "./identity-store";
import { IdentityGateProvider, useIdentityGate } from "./identity-gate";

const fetchMock = vi.fn();

function Reopen() {
  const { openIdentityGate } = useIdentityGate();
  return <button onClick={openIdentityGate}>Alterar dados</button>;
}

function renderGate() {
  return render(
    <ClientConfigProvider config={clientConfig}>
      <IdentityGateProvider>
        <p>conteúdo</p>
        <Reopen />
      </IdentityGateProvider>
    </ClientConfigProvider>,
  );
}

function fill(nome: string, whatsapp: string, cnpj = "") {
  fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: nome } });
  fireEvent.change(screen.getByLabelText("WhatsApp com DDD"), { target: { value: whatsapp } });
  fireEvent.change(screen.getByLabelText("CNPJ (opcional)"), { target: { value: cnpj } });
  fireEvent.click(screen.getByRole("button", { name: "Acessar catálogo" }));
}

beforeEach(() => {
  localStorage.clear();
  __resetIdentityForTests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("IdentityGateProvider", () => {
  it("abre sem identidade e não tem botão de fechar", () => {
    renderGate();
    expect(screen.getByRole("dialog", { name: "Acesse o catálogo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
  });

  it("não abre quando já identificado", () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    renderGate();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("mascara os campos ao digitar", () => {
    renderGate();
    fireEvent.change(screen.getByLabelText("WhatsApp com DDD"), { target: { value: "11999998888" } });
    fireEvent.change(screen.getByLabelText("CNPJ (opcional)"), { target: { value: "11222333000181" } });
    expect(screen.getByLabelText("WhatsApp com DDD")).toHaveValue("(11) 99999-8888");
    expect(screen.getByLabelText("CNPJ (opcional)")).toHaveValue("11.222.333/0001-81");
  });

  it("valida no cliente sem chamar a API", () => {
    renderGate();
    fill("Ana", "123");
    expect(screen.getByText("Informe o WhatsApp com DDD.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("grava o lead, salva a identidade e fecha", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    renderGate();
    await act(async () => fill("Ana", "(11) 99999-8888", "11.222.333/0001-81"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" });
    expect(readIdentity()).toEqual({ nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" });
  });

  it("libera o site quando a API falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("offline"));
    renderGate();
    await act(async () => fill("Ana", "11999998888"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(readIdentity()?.nome).toBe("Ana");
  });

  it("400 do servidor mostra o erro e mantém aberto", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ field: "cnpj", error: "CNPJ inválido." }) });
    renderGate();
    await act(async () => fill("Ana", "11999998888"));
    expect(await screen.findByText("CNPJ inválido.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Alterar dados reabre com os dados atuais e pode fechar", () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: "Alterar dados" }));
    expect(screen.getByLabelText("Seu nome")).toHaveValue("Ana");
    expect(screen.getByLabelText("WhatsApp com DDD")).toHaveValue("(11) 99999-8888");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

Run: `npx vitest run app/identity/identity-gate.test.tsx` → FAIL.

- [ ] **Step 5: Pop-up — implementar** — `identity-gate.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useClientConfig } from "@mypet/core/theme";
import { formatCnpj, formatWhatsapp, validateIdentity, type Identity, type IdentityField } from "@mypet/core/br-validation";
import { saveIdentity, useIdentity } from "./identity-store";
import { submitIdentityLead } from "./submit-identity-lead";

type IdentityGateValue = { openIdentityGate: () => void };
const IdentityGateContext = createContext<IdentityGateValue | null>(null);

export function useIdentityGate(): IdentityGateValue {
  const ctx = useContext(IdentityGateContext);
  if (!ctx) throw new Error("useIdentityGate deve ser usado dentro de IdentityGateProvider");
  return ctx;
}

// Pop-up obrigatório na primeira visita (sem identidade salva); reabre por "Alterar dados".
export function IdentityGateProvider({ children }: { children: React.ReactNode }) {
  const identity = useIdentity();
  const [editing, setEditing] = useState(false);
  const required = identity === null;
  const open = required || editing;

  return (
    <IdentityGateContext.Provider value={{ openIdentityGate: () => setEditing(true) }}>
      {children}
      {open && (
        <IdentityDialog
          initial={identity ?? null}
          dismissible={!required}
          onDone={() => setEditing(false)}
        />
      )}
    </IdentityGateContext.Provider>
  );
}

function IdentityDialog({
  initial,
  dismissible,
  onDone,
}: {
  initial: Identity | null;
  dismissible: boolean;
  onDone: () => void;
}) {
  const { palette, name } = useClientConfig();
  const [form, setForm] = useState({
    nome: initial?.nome ?? "",
    whatsapp: initial ? formatWhatsapp(initial.whatsapp) : "",
    cnpj: initial?.cnpj ? formatCnpj(initial.cnpj) : "",
  });
  const [errors, setErrors] = useState<Partial<Record<IdentityField, string>>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    const parsed = validateIdentity(form);
    if (!parsed.ok) {
      setErrors({ [parsed.field]: parsed.error });
      return;
    }
    setErrors({});
    setSending(true);
    const result = await submitIdentityLead(parsed.value);
    if (result.kind === "invalid") {
      setErrors(result.field ? { [result.field]: result.error } : { nome: result.error });
      setSending(false);
      return;
    }
    saveIdentity(parsed.value);
    setSending(false);
    onDone();
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: `1.5px solid ${palette.gray200}`,
    borderRadius: 10,
    fontSize: 16,
    color: palette.gray800,
    outline: "none",
  };
  const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: palette.navy, marginBottom: 6 };
  const errorStyle: React.CSSProperties = { color: palette.orange, fontSize: 12, marginTop: 4 };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,31,69,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-gate-title"
        style={{ background: palette.white, borderRadius: 20, padding: "28px 22px", width: "100%", maxWidth: 420, fontFamily: "var(--font-nunito), sans-serif" }}
      >
        <h2 id="identity-gate-title" style={{ fontSize: 22, fontWeight: 900, color: palette.navy, marginBottom: 6 }}>
          Acesse o catálogo
        </h2>
        <p style={{ fontSize: 14, color: palette.gray600, marginBottom: 20 }}>
          Informe seus dados para ver os produtos da {name} e fechar pedidos pelo WhatsApp.
        </p>
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="identity-nome" style={label}>Seu nome</label>
            <input
              id="identity-nome"
              autoFocus
              autoComplete="name"
              value={form.nome}
              onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
              style={input}
            />
            {errors.nome && <p role="alert" style={errorStyle}>{errors.nome}</p>}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="identity-whatsapp" style={label}>WhatsApp com DDD</label>
            <input
              id="identity-whatsapp"
              inputMode="tel"
              autoComplete="tel-national"
              value={form.whatsapp}
              onChange={(event) => setForm((current) => ({ ...current, whatsapp: formatWhatsapp(event.target.value) }))}
              style={input}
            />
            {errors.whatsapp && <p role="alert" style={errorStyle}>{errors.whatsapp}</p>}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="identity-cnpj" style={label}>CNPJ (opcional)</label>
            <input
              id="identity-cnpj"
              inputMode="numeric"
              value={form.cnpj}
              onChange={(event) => setForm((current) => ({ ...current, cnpj: formatCnpj(event.target.value) }))}
              style={input}
            />
            {errors.cnpj && <p role="alert" style={errorStyle}>{errors.cnpj}</p>}
          </div>
          <button
            type="submit"
            disabled={sending}
            style={{
              width: "100%",
              padding: 14,
              background: palette.pink,
              color: palette.white,
              border: "none",
              borderRadius: 10,
              fontFamily: "inherit",
              fontSize: 16,
              fontWeight: 800,
              cursor: sending ? "default" : "pointer",
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? "Salvando…" : "Acessar catálogo"}
          </button>
        </form>
        {dismissible && (
          <button
            type="button"
            onClick={onDone}
            style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: palette.gray400, fontSize: 13, cursor: "pointer" }}
          >
            Fechar
          </button>
        )}
      </div>
    </div>
  );
}
```

Nota: o botão "Acessar catálogo" muda para "Salvando…" durante o envio; nos testes o clique já dispara o submit antes do re-render.

Run: `npx vitest run app/identity/identity-gate.test.tsx` → PASS.

- [ ] **Step 6: Montar no layout** — `apps/distribuidora/app/layout.tsx`: importar `import { IdentityGateProvider } from "./identity/identity-gate";` e envolver o conteúdo do `CartProvider`:

```tsx
          <CartProvider>
            <IdentityGateProvider>
              {children}
              {/* usePathname em rota com parâmetro dinâmico exige Suspense com cacheComponents. */}
              <Suspense fallback={null}>
                <CartBar />
                {/* Dentro do CartProvider para subir acima da CartBar. */}
                <InstallPrompt />
              </Suspense>
            </IdentityGateProvider>
          </CartProvider>
```

- [ ] **Step 7: Verificar e commit**

Run (de `apps/distribuidora`): `npx vitest run` → PASS; `pnpm --filter distribuidora exec tsc --noEmit` → sem erros; `pnpm --filter distribuidora build` → build ok (o pop-up é client-only, não pode quebrar a pré-renderização).

```bash
git add apps/distribuidora/app/identity apps/distribuidora/app/layout.tsx
git commit -m "feat(distribuidora): pop-up de identificação obrigatório no primeiro acesso"
```

---

### Task 7: "Fechar pedido" direto + `/cotacao` como revisão

**Files:**
- Create: `apps/distribuidora/app/checkout/use-checkout.ts`
- Create: `apps/distribuidora/app/checkout/checkout-bar.tsx`, `apps/distribuidora/app/checkout/checkout-bar.test.tsx`
- Modify: `apps/distribuidora/app/cotacao/cotacao-content.tsx`, `apps/distribuidora/app/cotacao/cotacao-content.test.tsx`
- Modify: `apps/distribuidora/app/layout.tsx`

**Interfaces:**
- Consumes: `useIdentity` (Task 6), `useIdentityGate` (Task 6), `CartBar` props (Task 5), `registerOrder`/`applyServerPrices` (`app/cotacao/register-order.ts`, já existem), `buildQuoteMessage`/`buildWhatsAppLink` (`@mypet/core/whatsapp`, `empresa` opcional pela Task 4), `formatWhatsapp`/`formatCnpj` (Task 2).
- Produces: `useCheckout(): { checkout: () => Promise<void>; sending: boolean; error: string }`; `CheckoutBar()`.

- [ ] **Step 1: Hook** — `use-checkout.ts`:

```ts
"use client";

import { useCallback, useRef, useState } from "react";
import { useCart } from "@mypet/core/components/cart-provider";
import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
import { formatCnpj, formatWhatsapp } from "@mypet/core/br-validation";
import { useIdentity } from "../identity/identity-store";
import { useIdentityGate } from "../identity/identity-gate";
import { applyServerPrices, registerOrder } from "../cotacao/register-order";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511981030532";
const ORDER_INTRO = "Olá! Quero fazer este pedido:";

// Grava o pedido com os dados do pop-up e abre o WhatsApp. Só erro de validação (400) segura o envio.
export function useCheckout() {
  const { cart, clear } = useCart();
  const identity = useIdentity();
  const { openIdentityGate } = useIdentityGate();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // Guarda síncrona contra duplo toque: o disabled só vale após o render.
  const inFlight = useRef(false);

  const checkout = useCallback(async () => {
    if (inFlight.current || cart.items.length === 0) return;
    if (!identity) {
      openIdentityGate();
      return;
    }
    inFlight.current = true;
    setSending(true);
    setError("");

    const result = await registerOrder(cart.items, {
      nome: identity.nome,
      whatsapp: identity.whatsapp,
      ...(identity.cnpj ? { cnpj: identity.cnpj } : {}),
    });
    if (result.kind === "invalid") {
      setError(result.error);
      setSending(false);
      inFlight.current = false;
      return;
    }

    const items = result.kind === "ok" ? applyServerPrices(cart.items, result.prices, result.unavailableIds) : cart.items;
    const message = buildQuoteMessage(
      items,
      {
        nome: identity.nome,
        whatsapp: formatWhatsapp(identity.whatsapp),
        ...(identity.cnpj ? { cnpj: formatCnpj(identity.cnpj) } : {}),
      },
      ORDER_INTRO,
      { showPrices: true, orderNumber: result.kind === "ok" ? result.number : undefined },
    );
    window.open(buildWhatsAppLink(WHATSAPP_NUMBER, message), "_self");
    clear();
    setSending(false);
    inFlight.current = false;
  }, [cart.items, clear, identity, openIdentityGate]);

  return { checkout, sending, error };
}
```

- [ ] **Step 2: Barra — teste (falha)** — `checkout-bar.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { clientConfig } from "@/client.config";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const mocks = vi.hoisted(() => ({ registerOrder: vi.fn() }));
vi.mock("../cotacao/register-order", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../cotacao/register-order")>()),
  registerOrder: mocks.registerOrder,
}));

import { __resetIdentityForTests, saveIdentity } from "../identity/identity-store";
import { IdentityGateProvider } from "../identity/identity-gate";
import { CheckoutBar } from "./checkout-bar";

const P1 = "11111111-1111-4111-8111-111111111111";

function renderBar() {
  return render(
    <ClientConfigProvider config={clientConfig}>
      <CartProvider>
        <IdentityGateProvider>
          <CheckoutBar />
        </IdentityGateProvider>
      </CartProvider>
    </ClientConfigProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  __resetIdentityForTests();
  mocks.registerOrder.mockReset();
  localStorage.setItem("mypet_cart", JSON.stringify({ items: [{ id: P1, name: "Coleira", sku: "COL-1", brand: null, img: "/c.jpg", qty: 2, unitPrice: 10 }] }));
});

describe("CheckoutBar", () => {
  it("Fechar pedido grava e abre o WhatsApp com os dados da identidade", async () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "ok", number: 1042, prices: new Map([[P1, 10]]), unavailableIds: [] });

    renderBar();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Fechar pedido →" })));

    expect(mocks.registerOrder).toHaveBeenCalledWith(expect.any(Array), { nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" });
    const message = decodeURIComponent(String(open.mock.calls[0][0]).split("?text=")[1]);
    expect(message.split("\n")[0]).toBe("Pedido #1042");
    expect(message).toContain("Nome: Ana");
    expect(message).toContain("WhatsApp: (11) 99999-8888");
    expect(message).toContain("CNPJ: 11.222.333/0001-81");
    expect(message).not.toContain("Empresa:");
    expect(open.mock.calls[0][1]).toBe("_self");
  });

  it("tem link ver itens para /cotacao", () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    renderBar();
    expect(screen.getByRole("link", { name: "ver itens" })).toHaveAttribute("href", "/cotacao");
  });

  it("erro de validação aparece e não abre o WhatsApp", async () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "invalid", error: "Há um item inválido no carrinho." });
    renderBar();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Fechar pedido →" })));
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Há um item inválido no carrinho.");
  });

  it("duplo toque registra um pedido só", async () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    vi.spyOn(window, "open").mockReturnValue(null);
    let resolve!: (v: unknown) => void;
    mocks.registerOrder.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderBar();
    const button = screen.getByRole("button", { name: "Fechar pedido →" });
    fireEvent.click(button);
    fireEvent.click(button);
    await act(async () => resolve({ kind: "failed" }));
    expect(mocks.registerOrder).toHaveBeenCalledOnce();
  });
});
```

Run: `npx vitest run app/checkout/checkout-bar.test.tsx` → FAIL (módulo não existe).

- [ ] **Step 3: Barra — implementar** — `checkout-bar.tsx`:

```tsx
"use client";

import { CartBar, CART_BAR_HEIGHT } from "@mypet/core/components/cart-bar";
import { useClientConfig } from "@mypet/core/theme";
import { useCheckout } from "./use-checkout";

export function CheckoutBar() {
  const { checkout, sending, error } = useCheckout();
  const { palette } = useClientConfig();
  return (
    <>
      {error && (
        <p
          role="alert"
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: `calc(${CART_BAR_HEIGHT + 8}px + env(safe-area-inset-bottom))`,
            zIndex: 41,
            background: palette.white,
            color: palette.orange,
            border: `1px solid ${palette.gray200}`,
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 6px 20px rgba(15,31,69,0.15)",
          }}
        >
          {error}
        </p>
      )}
      <CartBar
        actionLabel="Fechar pedido"
        onAction={() => void checkout()}
        busy={sending}
        secondaryHref="/cotacao"
        secondaryLabel="ver itens"
      />
    </>
  );
}
```

No `layout.tsx`, trocar `<CartBar />` por `<CheckoutBar />` (import `import { CheckoutBar } from "./checkout/checkout-bar";` e remover o import de `CartBar` se ficar sem uso). Manter dentro do mesmo `<Suspense>`.

Run: `npx vitest run app/checkout/checkout-bar.test.tsx` → PASS.

- [ ] **Step 4: `/cotacao` — teste (falha)** — substituir `cotacao-content.test.tsx` inteiro por:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { formatPrice } from "@mypet/core/catalog-utils";
import { clientConfig } from "@/client.config";

const mocks = vi.hoisted(() => ({ registerOrder: vi.fn() }));
vi.mock("./register-order", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./register-order")>()),
  registerOrder: mocks.registerOrder,
}));

import { __resetIdentityForTests, saveIdentity } from "../identity/identity-store";
import { IdentityGateProvider } from "../identity/identity-gate";
import { CotacaoContent } from "./cotacao-content";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

function renderPage() {
  return render(
    <ClientConfigProvider config={clientConfig}>
      <CartProvider>
        <IdentityGateProvider>
          <CotacaoContent palette={clientConfig.palette} />
        </IdentityGateProvider>
      </CartProvider>
    </ClientConfigProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  __resetIdentityForTests();
  mocks.registerOrder.mockReset();
  localStorage.setItem(
    "mypet_cart",
    JSON.stringify({
      items: [
        { id: P1, name: "Coleira", sku: "COL-1", brand: "MadPet", img: "/c.jpg", qty: 2, unitPrice: 10 },
        { id: P2, name: "Guia", sku: "", brand: null, img: "/g.jpg", qty: 1 },
      ],
    }),
  );
  saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" });
});

describe("CotacaoContent (revisão)", () => {
  it("mostra itens, total e os dados identificados, sem formulário", () => {
    renderPage();
    expect(screen.getAllByText(formatPrice(20)!.replace(/\s/g, " ")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("a consultar")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("(11) 99999-8888")).toBeInTheDocument();
    expect(screen.getByText("11.222.333/0001-81")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("Alterar dados reabre o pop-up", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Alterar dados" }));
    expect(screen.getByRole("dialog", { name: "Acesse o catálogo" })).toBeInTheDocument();
  });

  it("Fechar pedido pelo WhatsApp grava e abre o WhatsApp", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "ok", number: 1042, prices: new Map([[P1, 12], [P2, null]]), unavailableIds: [] });
    renderPage();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Fechar pedido pelo WhatsApp/ })));
    const message = decodeURIComponent(String(open.mock.calls[0][0]).split("?text=")[1]);
    expect(message.split("\n")[0]).toBe("Pedido #1042");
    expect(message).toContain(`Coleira (SKU COL-1) — 2 × ${formatPrice(12)} = ${formatPrice(24)}`);
    expect(message).toContain("Guia — Qtd: 1 (a consultar)");
  });

  it("erro de validação aparece acima do botão", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "invalid", error: "Há um item inválido no carrinho." });
    renderPage();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Fechar pedido pelo WhatsApp/ })));
    expect(screen.getByRole("alert")).toHaveTextContent("Há um item inválido no carrinho.");
  });
});
```

Run: `npx vitest run app/cotacao/cotacao-content.test.tsx` → FAIL.

- [ ] **Step 5: `/cotacao` — implementar** — em `cotacao-content.tsx`:
1. Imports: remover `useRef`, `useState` (se sem uso), `buildQuoteMessage`, `buildWhatsAppLink`, `applyServerPrices`, `registerOrder`, e as constantes `WHATSAPP_NUMBER`/`ORDER_INTRO`. Adicionar:

```tsx
import { formatCnpj, formatWhatsapp } from "@mypet/core/br-validation";
import { useCheckout } from "../checkout/use-checkout";
import { useIdentity } from "../identity/identity-store";
import { useIdentityGate } from "../identity/identity-gate";
```

2. No corpo: remover `form`, `submitError`, `submitting`, `inFlight` e `handleSubmit`; adicionar logo após `useCart()`:

```tsx
  const identity = useIdentity();
  const { openIdentityGate } = useIdentityGate();
  const { checkout, sending, error } = useCheckout();
```

(Os hooks ficam ANTES do `if (cart.items.length === 0) return …` — regra dos hooks.)

3. Substituir o último bloco (o `<div>` com `<h2>Seus dados para o pedido</h2>` e o `<form>`) por:

```tsx
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: PALETTE.navy }}>Seus dados</h2>
          <button
            type="button"
            onClick={openIdentityGate}
            style={{ background: "none", border: "none", color: PALETTE.pink, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
          >
            Alterar dados
          </button>
        </div>
        {identity && (
          <dl style={{ fontSize: 14, color: PALETTE.gray800, marginBottom: 20, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
            <dt style={{ color: PALETTE.gray600 }}>Nome</dt>
            <dd>{identity.nome}</dd>
            <dt style={{ color: PALETTE.gray600 }}>WhatsApp</dt>
            <dd>{formatWhatsapp(identity.whatsapp)}</dd>
            {identity.cnpj && (
              <>
                <dt style={{ color: PALETTE.gray600 }}>CNPJ</dt>
                <dd>{formatCnpj(identity.cnpj)}</dd>
              </>
            )}
          </dl>
        )}
        {error && (
          <p role="alert" style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{error}</p>
        )}
        <button type="button" className="form-submit" disabled={sending} onClick={() => void checkout()}>
          {sending ? "Registrando pedido…" : "Fechar pedido pelo WhatsApp →"}
        </button>
      </div>
```

- [ ] **Step 6: Verificar e commit**

Run (de `apps/distribuidora`): `npx vitest run` → PASS (todos); `pnpm --filter distribuidora exec tsc --noEmit` → sem erros; `pnpm --filter distribuidora build` → ok.

```bash
git add apps/distribuidora/app/checkout apps/distribuidora/app/cotacao apps/distribuidora/app/layout.tsx
git commit -m "feat(distribuidora): Fechar pedido direto no WhatsApp; /cotacao vira revisão"
```

---

### Task 8: Verificação final

- [ ] `pnpm --filter @mypet/core test`, `pnpm --filter distribuidora test`, `pnpm --filter admin test`, `pnpm --filter mypet test` → PASS.
- [ ] `pnpm --filter distribuidora build`, `pnpm --filter admin build`, `pnpm --filter mypet build` → ok (mypet: confirma que a extração do `isValidCnpj` e o `QuoteCustomer.empresa?` não quebraram nada).
- [ ] Teste manual (`pnpm --filter distribuidora dev`, porta 4101, viewport mobile): pop-up aparece na primeira visita e não fecha; CNPJ inválido mostra erro; após enviar, navega; recarregar não mostra o pop-up; adicionar itens → barra "Fechar pedido" abre `wa.me` com "Pedido #NNNN", Nome/WhatsApp/CNPJ; "ver itens" abre `/cotacao` com "Seus dados" e "Alterar dados".
- [ ] Supabase: `select nome, empresa, whatsapp, cnpj, channel from leads order by created_at desc limit 1;` → lead do teste com `empresa` nula; apagar leads/pedidos de teste depois (confirmar com o usuário).
