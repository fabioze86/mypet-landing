# My Pet — Landing de pré-acesso B2B (sem magic link) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar `/` do `apps/mypet` numa landing pública de educação comercial e mover o e-commerce para `/loja`, protegido por uma sessão criada a partir de um cadastro mínimo de CNPJ + WhatsApp, sem confirmação por e-mail.

**Architecture:** O conteúdo de marketing fica público e renderizado no servidor em `/`. Um único client component (o formulário) faz `POST /api/pre-acesso`. O endpoint normaliza e valida os campos, aplica um limite de reenvio por CNPJ, grava/atualiza o comprador na tabela `buyers` (identidade = CNPJ) e devolve um cookie `mypet_acesso` assinado com HMAC. `/loja` recebe a composição de catálogo que hoje vive em `/` e passa a exigir esse cookie no servidor antes de qualquer consulta de preço. Não há Supabase Auth neste fluxo.

**Tech Stack:** Next.js 16.2 (App Router, React 19), TypeScript, Vitest 4, `@testing-library/react`, Supabase JS (cliente service-role via `@mypet/core/supabase`), `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-08-28-mypet-pre-acesso-landing-design.md`

## Global Constraints

- Leia o guia de Next.js 16 aplicável em `apps/mypet/node_modules/next/dist/docs/` antes de mexer em rotas, Route Handlers, `proxy.ts`, Server Actions ou metadata.
- `/` é público; `/loja` é a loja autenticada. Nenhum preço ou dado comercial protegido pode compor o HTML ou o bundle público de `/`.
- Campos de cadastro: **`cnpj` e `whatsapp` obrigatórios, `email` opcional**. Nenhum outro campo. Sem dados fictícios, depoimentos, números ou selos.
- Não criar sessão de navegador a partir de input não verificado por outra via que não seja o cadastro válido (CNPJ + WhatsApp).
- Normalizar e validar todo input não confiável no servidor. Devolver apenas erros genéricos e estáveis; nunca registrar CNPJ, e-mail ou WhatsApp crus em log.
- Exemplos comerciais existem só na configuração tipada `pre-access-content.ts`; nunca exibir `placeholder`, `TBD` ou `a definir` a um visitante.
- Manter dados pessoais fora dos eventos de analytics.
- Mensagens visíveis fixas do endpoint: `INVALID_INPUT` → HTTP 400 `Confira os dados informados e tente novamente.`; `RATE_LIMITED` → HTTP 429 `Aguarde alguns instantes antes de tentar novamente.`; `UNAVAILABLE` → HTTP 503 `Não foi possível liberar seu acesso agora. Tente novamente em instantes.`
- Cookie de sessão: nome `mypet_acesso`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age` de 2592000 (30 dias).
- Projeto Supabase alvo da migração: `hub_catalogo` (ref `hsguyfiyqpuligijcjlw`).
- `packages/core/src/auth-server.ts` e `safeNextPath` **permanecem** — `apps/distribuidora` depende deles. Só o `apps/mypet` deixa de usá-los.
- Preservar arquivos não relacionados que já estejam sem commit. Um commit focado por task.

---

## Estrutura de arquivos

| Caminho | Responsabilidade | Task |
| --- | --- | --- |
| `packages/core/src/access-session.ts` | Assinatura/verificação HMAC do token de sessão e constantes do cookie. Só `node:crypto`. | 1 |
| `packages/core/src/access-session.test.ts` | Cobertura do token. | 1 |
| `supabase/migrations/20260828120000_pre_acesso.sql` | Ajusta `buyers` (identidade por CNPJ, campos opcionais) e cria `pre_access_attempts`. | 2 |
| `packages/core/src/pre-access-server.ts` | Server-only: `normalizePreAccessInput`, `validatePreAccessInput`, `provisionBuyer`. Usa `getHubServiceClient()`. | 3 |
| `packages/core/src/pre-access-server.test.ts` | Cobertura da fronteira de provisionamento. | 3 |
| `packages/core/src/buyers-server.ts` | `Buyer.nome`/`empresa`/`email` viram `string \| null`; `createBuyer` não exige `nome`/`empresa`. | 3 |
| `apps/mypet/vitest.config.ts`, `apps/mypet/vitest.setup.ts` | Infra de teste do app (jsdom + jest-dom). | 4 |
| `apps/mypet/app/api/pre-acesso/route.ts` | `POST` público: `provisionBuyer` → `Set-Cookie` → mapa de erros. | 4 |
| `apps/mypet/app/api/pre-acesso/route.test.ts` | Cobertura do endpoint. | 4 |
| `apps/mypet/app/_components/pre-access/access-form.tsx` | Único client component: 3 campos, consentimento, estados de erro/sucesso. | 5 |
| `apps/mypet/app/_components/pre-access/access-form.test.tsx` | Cobertura do formulário. | 5 |
| `apps/mypet/lib/require-buyer.ts` | Lê o cookie, valida o token e carrega o comprador (service-role). | 6 |
| `apps/mypet/lib/require-buyer.test.ts` | Cobertura do guard. | 6 |
| `apps/mypet/app/loja/page.tsx` | Composição de catálogo movida de `/`, guardada por `requireBuyer()`. | 6 |
| `apps/mypet/app/loja/page.test.tsx` | Sem cookie → `redirect("/")`. | 6 |
| `apps/mypet/app/page.tsx` | Landing pública. Task 6 cria a versão mínima (hero + formulário); Task 7 acrescenta as seções. | 6, 7 |
| `apps/mypet/app/_components/pre-access/hero.tsx` | Hero com CTAs de rolagem para `#condicoes` e `#acesso`. | 6 |
| `apps/mypet/proxy.ts`, `apps/mypet/proxy.test.ts` | Matcher ganha `/loja/:path*`; anônimo em `/loja` → `redirect("/")`. | 6 |
| `apps/mypet/app/pre-access-content.ts` | Configuração tipada única: condições, cards, FAQ, textos institucionais. | 7 |
| `apps/mypet/app/_components/pre-access/commercial-conditions.tsx` | Três blocos comerciais. | 7 |
| `apps/mypet/app/_components/pre-access/education-cards.tsx` | Faixa horizontal navegável por teclado. | 7 |
| `apps/mypet/app/_components/pre-access/popular-categories.tsx` | Categorias reais, sem preço. | 7 |
| `apps/mypet/app/_components/pre-access/commercial-faq.tsx` | Accordion com as 8 perguntas. | 7 |
| `apps/mypet/app/_components/pre-access/institutional-trust.tsx` | Indicadores institucionais comprováveis. | 7 |
| `apps/mypet/app/page.test.tsx` | Landing não contém preço; contém as seções. | 7 |
| `apps/mypet/app/entrar/page.tsx`, `apps/mypet/app/entrar/callback/route.ts` | Passam a redirecionar para `/`. | 8 |
| `apps/mypet/app/completar-cadastro/page.tsx` | Redireciona para `/`. | 8 |
| `apps/mypet/app/cotacao/page.tsx`, `apps/mypet/app/pedidos/page.tsx` | Guard trocado para `requireBuyer()`; links `/` → `/loja`. | 8 |
| `apps/mypet/app/layout.tsx` | Metadata raiz para atacado B2B. | 8 |
| `apps/mypet/app/robots.ts` | Bloqueia também `/loja`. | 8 |
| `apps/mypet/app/sitemap.ts`, `apps/mypet/app/sitemap.test.ts` | `/` presente, `/loja` ausente. | 8 |
| `apps/mypet/.env.example` | Documenta `ACCESS_SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. | 8 |

**Fora de escopo deste plano (registrar como follow-up):** as rotas `/produtos/[id]` e `/categoria/[slug]` do `apps/mypet` continuam públicas e ainda exibem preço — condição pré-existente, não piorada por este plano. Proteger ou realocar essas rotas é um plano separado.

---

### Task 1: Token de sessão assinado (`@mypet/core/access-session`)

**Files:**
- Create: `packages/core/src/access-session.ts`
- Create: `packages/core/src/access-session.test.ts`
- Modify: `packages/core/package.json` (bloco `exports`)

**Interfaces:**
- Consumes: nada (só `node:crypto` e `process.env.ACCESS_SESSION_SECRET`).
- Produces:
  - `signAccessToken(buyerId: string, now?: number): string`
  - `verifyAccessToken(token: string | undefined | null, now?: number): { buyerId: string } | null`
  - `ACCESS_COOKIE: "mypet_acesso"`
  - `ACCESS_COOKIE_OPTS: { httpOnly: true; secure: true; sameSite: "lax"; path: "/"; maxAge: 2592000 }`
  - `ACCESS_MAX_AGE_MS: number` (30 dias em ms)

- [ ] **Step 1: Escrever o teste que falha**

Create `packages/core/src/access-session.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  signAccessToken,
  verifyAccessToken,
  ACCESS_COOKIE,
  ACCESS_COOKIE_OPTS,
} from "./access-session";

beforeEach(() => {
  process.env.ACCESS_SESSION_SECRET = "test-secret-0123456789";
});

describe("access-session", () => {
  it("faz round-trip de um buyerId válido", () => {
    const token = signAccessToken("buyer-1", 1_000_000);
    expect(verifyAccessToken(token, 1_000_000)).toEqual({ buyerId: "buyer-1" });
  });

  it("rejeita token com assinatura adulterada", () => {
    const token = signAccessToken("buyer-1", 1_000_000);
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa");
    expect(verifyAccessToken(tampered, 1_000_000)).toBeNull();
  });

  it("rejeita token expirado", () => {
    const token = signAccessToken("buyer-1", 1_000_000);
    const later = 1_000_000 + 2_592_000_000 + 1;
    expect(verifyAccessToken(token, later)).toBeNull();
  });

  it("rejeita token malformado ou ausente", () => {
    expect(verifyAccessToken(undefined)).toBeNull();
    expect(verifyAccessToken("")).toBeNull();
    expect(verifyAccessToken("sem-ponto")).toBeNull();
    expect(verifyAccessToken("a.b.c")).toBeNull();
  });

  it("rejeita token assinado com outro segredo", () => {
    const token = signAccessToken("buyer-1", 1_000_000);
    process.env.ACCESS_SESSION_SECRET = "outro-segredo";
    expect(verifyAccessToken(token, 1_000_000)).toBeNull();
  });

  it("expõe o nome e as opções do cookie exigidas pela spec", () => {
    expect(ACCESS_COOKIE).toBe("mypet_acesso");
    expect(ACCESS_COOKIE_OPTS).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 2_592_000,
    });
  });

  it("lança erro claro quando falta o segredo", () => {
    delete process.env.ACCESS_SESSION_SECRET;
    expect(() => signAccessToken("buyer-1")).toThrow(/ACCESS_SESSION_SECRET/);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar a falha**

Run: `pnpm --filter @mypet/core exec vitest run src/access-session.test.ts`
Expected: FAIL com "Cannot find module './access-session'".

- [ ] **Step 3: Implementar o módulo**

Create `packages/core/src/access-session.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "mypet_acesso";
export const ACCESS_MAX_AGE_MS = 2_592_000_000; // 30 dias
export const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: 2_592_000, // segundos
} as const;

type Payload = { b: string; exp: number };

function secret(): string {
  const value = process.env.ACCESS_SESSION_SECRET;
  if (!value) {
    throw new Error("ACCESS_SESSION_SECRET precisa estar definido no ambiente.");
  }
  return value;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function signAccessToken(buyerId: string, now: number = Date.now()): string {
  const payload: Payload = { b: buyerId, exp: now + ACCESS_MAX_AGE_MS };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyAccessToken(
  token: string | undefined | null,
  now: number = Date.now(),
): { buyerId: string } | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, mac] = parts;

  let expected: Buffer;
  let received: Buffer;
  try {
    expected = Buffer.from(sign(body), "base64url");
    received = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    if (typeof payload.b !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp <= now) return null;
    return { buyerId: payload.b };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Adicionar o export do pacote**

Modify `packages/core/package.json` — no objeto `exports`, adicionar após a linha `"./assistant-server"`:

```json
    "./access-session": "./src/access-session.ts",
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @mypet/core exec vitest run src/access-session.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/access-session.ts packages/core/src/access-session.test.ts packages/core/package.json
git commit -m "feat(core): add signed access-session token"
```

---

### Task 2: Migração do banco — identidade por CNPJ

**Files:**
- Create: `supabase/migrations/20260828120000_pre_acesso.sql`

**Interfaces:**
- Produces (no schema do projeto `hub_catalogo`):
  - `public.buyers` sem a FK `buyers_id_fkey`; `id` com default `gen_random_uuid()`; `nome`, `empresa`, `email` `NULL`-áveis; sem `buyers_email_key`; com `buyers_cnpj_key UNIQUE (cnpj)`; coluna `source text NOT NULL DEFAULT 'landing'`.
  - `public.pre_access_attempts (id bigint identity PK, cnpj text NOT NULL, ip_hash text, created_at timestamptz NOT NULL DEFAULT now())` + índice `pre_access_attempts_lookup (cnpj, created_at desc)`.
- Consumed por: Task 3 (`provisionBuyer` grava em `buyers` e conta `pre_access_attempts`).

- [ ] **Step 1: Escrever o arquivo de migração**

Create `supabase/migrations/20260828120000_pre_acesso.sql`:

```sql
-- Identidade do comprador passa a ser o CNPJ; id deixa de depender de auth.users
alter table public.buyers drop constraint if exists buyers_id_fkey;
alter table public.buyers alter column id set default gen_random_uuid();

-- Campos que o formulário aprovado não coleta
alter table public.buyers alter column nome drop not null;
alter table public.buyers alter column empresa drop not null;
alter table public.buyers alter column email drop not null;
alter table public.buyers drop constraint if exists buyers_email_key;

-- CNPJ como identificador de retorno
alter table public.buyers add constraint buyers_cnpj_key unique (cnpj);

-- Origem do cadastro (preparação para a ponte futura com o Hub Clientes)
alter table public.buyers add column if not exists source text not null default 'landing';

-- Limite de reenvio (antiabuso), sem PII crua além do CNPJ normalizado
create table if not exists public.pre_access_attempts (
  id bigint generated always as identity primary key,
  cnpj text not null,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists pre_access_attempts_lookup
  on public.pre_access_attempts (cnpj, created_at desc);

alter table public.pre_access_attempts enable row level security;
```

Notas para o implementador:
- A tabela `buyers` já existe e está vazia (0 linhas) — sem risco de migração de dados.
- `pre_access_attempts` fica sem policy: com RLS habilitada e nenhuma policy, `anon`/`authenticated` não têm acesso; o cliente service-role (usado por `provisionBuyer`) ignora RLS.
- `buyers` mantém RLS habilitada e as policies atuais baseadas em `auth.uid()` (inertes, mas não removidas por este plano).

- [ ] **Step 2: Aplicar a migração ao projeto `hub_catalogo`**

Este passo é executado pelo controlador da execução (tem a ferramenta do Supabase). Aplicar o conteúdo do arquivo ao projeto ref `hsguyfiyqpuligijcjlw`.

- [ ] **Step 3: Verificar o schema resultante**

Rodar contra `hub_catalogo`:

```sql
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'buyers'
  and column_name in ('id', 'nome', 'empresa', 'email', 'source')
order by column_name;

select conname from pg_constraint where conrelid = 'public.buyers'::regclass;

select to_regclass('public.pre_access_attempts');
```

Expected: `nome`, `empresa`, `email` com `is_nullable = YES`; `id` com default `gen_random_uuid()`; `source` presente com default `'landing'`. Em `pg_constraint`: existe `buyers_cnpj_key`, não existe `buyers_id_fkey` nem `buyers_email_key`. `to_regclass` resolve `pre_access_attempts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260828120000_pre_acesso.sql
git commit -m "feat(db): buyers identity by cnpj, add pre_access_attempts"
```

---

### Task 3: Núcleo de pré-acesso (`@mypet/core/pre-access-server`)

**Files:**
- Create: `packages/core/src/pre-access-server.ts`
- Create: `packages/core/src/pre-access-server.test.ts`
- Modify: `packages/core/src/buyers-server.ts`
- Modify: `packages/core/src/buyers-server.test.ts`
- Modify: `packages/core/package.json` (bloco `exports`)

**Interfaces:**
- Consumes: `getHubServiceClient()` de `./supabase`.
- Produces:
  - `type PreAccessInput = { cnpj: string; whatsapp: string; email?: string | null }`
  - `type PreAccessErrorCode = "INVALID_INPUT" | "RATE_LIMITED" | "UNAVAILABLE"`
  - `class PreAccessError extends Error { readonly code: PreAccessErrorCode }`
  - `normalizePreAccessInput(input: unknown): { cnpj: string; whatsapp: string; email: string | null }`
  - `validatePreAccessInput(input: { cnpj: string; whatsapp: string; email: string | null }): PreAccessErrorCode | null` (só retorna `"INVALID_INPUT"` ou `null`)
  - `provisionBuyer(input: unknown, ctx?: { ipHash?: string | null }): Promise<{ buyerId: string }>` — lança `PreAccessError`
  - `Buyer` (de `./buyers-server`) com `nome: string | null`, `empresa: string | null`, `email: string | null`
- Consumed por: Task 4 (`route.ts` chama `provisionBuyer`), Task 6 (`require-buyer.ts` usa `Buyer` e `getBuyerById`).

- [ ] **Step 1: Ajustar os tipos de `buyers-server.ts` (teste que falha)**

Modify `packages/core/src/buyers-server.test.ts` — adicionar dentro de `describe("createBuyer", ...)`:

```ts
  it("aceita nome e empresa nulos", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient;

    const result = await createBuyer(supabase, {
      id: "u1",
      email: null,
      whatsapp: "5511999999999",
      cnpj: "12345678000195",
    });

    expect(insert).toHaveBeenCalledWith({
      id: "u1",
      email: null,
      nome: null,
      empresa: null,
      whatsapp: "5511999999999",
      cnpj: "12345678000195",
    });
    expect(result.error).toBeNull();
  });
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `pnpm --filter @mypet/core exec vitest run src/buyers-server.test.ts`
Expected: FAIL de tipo/execução — `createBuyer` hoje exige `nome`/`empresa` e não aceita `email: null`.

- [ ] **Step 3: Atualizar `buyers-server.ts`**

Modify `packages/core/src/buyers-server.ts` — substituir os tipos e o corpo de `createBuyer`:

```ts
export type Buyer = {
  id: string;
  email: string | null;
  nome: string | null;
  empresa: string | null;
  whatsapp: string;
  cnpj: string | null;
};

export type CreateBuyerInput = {
  id: string;
  email?: string | null;
  nome?: string | null;
  empresa?: string | null;
  whatsapp: string;
  cnpj?: string | null;
};

export async function createBuyer(
  supabase: SupabaseClient,
  input: CreateBuyerInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("buyers").insert({
    id: input.id,
    email: input.email ?? null,
    nome: input.nome ?? null,
    empresa: input.empresa ?? null,
    whatsapp: input.whatsapp,
    cnpj: input.cnpj ?? null,
  });

  if (error) {
    console.error("[buyers] erro ao criar comprador:", error.message);
    return { error: "Não foi possível concluir seu cadastro. Tente novamente em instantes." };
  }

  return { error: null };
}
```

`getBuyerById` não muda de corpo — só passa a devolver o `Buyer` com campos anuláveis.

- [ ] **Step 4: Rodar os testes de `buyers-server` e confirmar que passam**

Run: `pnpm --filter @mypet/core exec vitest run src/buyers-server.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever os testes de `pre-access-server` (que falham)**

Create `packages/core/src/pre-access-server.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  attemptsCount: 0,
  buyerRow: null as { id: string; whatsapp: string } | null,
  insertError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  insertedRow: null as Record<string, unknown> | null,
  updatedRow: null as Record<string, unknown> | null,
};

vi.mock("./supabase", () => ({
  getHubServiceClient: () => ({
    from: (table: string) => {
      if (table === "pre_access_attempts") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          select: () => ({
            eq: () => ({
              gte: () => Promise.resolve({ count: state.attemptsCount, error: null }),
            }),
          }),
        };
      }
      // table === "buyers"
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: state.buyerRow, error: null }),
          }),
        }),
        insert: (row: Record<string, unknown>) => {
          state.insertedRow = row;
          return {
            select: () => ({
              single: () =>
                Promise.resolve(
                  state.insertError
                    ? { data: null, error: state.insertError }
                    : { data: { id: "new-buyer" }, error: null },
                ),
            }),
          };
        },
        update: (row: Record<string, unknown>) => {
          state.updatedRow = row;
          return { eq: () => Promise.resolve({ error: state.updateError }) };
        },
      };
    },
  }),
}));

import { normalizePreAccessInput, validatePreAccessInput, provisionBuyer, PreAccessError } from "./pre-access-server";

beforeEach(() => {
  state.attemptsCount = 0;
  state.buyerRow = null;
  state.insertError = null;
  state.updateError = null;
  state.insertedRow = null;
  state.updatedRow = null;
});

describe("normalizePreAccessInput", () => {
  it("reduz cnpj e whatsapp a dígitos e normaliza o e-mail", () => {
    expect(
      normalizePreAccessInput({
        cnpj: "12.345.678/0001-95",
        whatsapp: "+55 (11) 99999-0000",
        email: "  LOJA@Example.com ",
      }),
    ).toEqual({ cnpj: "12345678000195", whatsapp: "5511999990000", email: "loja@example.com" });
  });

  it("trata e-mail ausente ou vazio como null", () => {
    expect(normalizePreAccessInput({ cnpj: "1", whatsapp: "2" }).email).toBeNull();
    expect(normalizePreAccessInput({ cnpj: "1", whatsapp: "2", email: "   " }).email).toBeNull();
  });
});

describe("validatePreAccessInput", () => {
  const ok = { cnpj: "12345678000195", whatsapp: "5511999990000", email: null };

  it("aceita cnpj + whatsapp válidos sem e-mail", () => {
    expect(validatePreAccessInput(ok)).toBeNull();
  });

  it("rejeita cnpj com dígito verificador errado", () => {
    expect(validatePreAccessInput({ ...ok, cnpj: "12345678000100" })).toBe("INVALID_INPUT");
  });

  it("rejeita whatsapp fora do padrão 55 + 10/11 dígitos", () => {
    expect(validatePreAccessInput({ ...ok, whatsapp: "11999990000" })).toBe("INVALID_INPUT");
  });

  it("rejeita e-mail presente e malformado", () => {
    expect(validatePreAccessInput({ ...ok, email: "sem-arroba" })).toBe("INVALID_INPUT");
  });
});

describe("provisionBuyer", () => {
  const valid = { cnpj: "12.345.678/0001-95", whatsapp: "55 11 99999-0000", email: "loja@example.com" };

  it("cria um comprador novo quando o CNPJ não existe", async () => {
    const result = await provisionBuyer(valid);
    expect(result).toEqual({ buyerId: "new-buyer" });
    expect(state.insertedRow).toMatchObject({
      cnpj: "12345678000195",
      whatsapp: "5511999990000",
      email: "loja@example.com",
      source: "landing",
    });
  });

  it("atualiza o comprador quando o CNPJ existe e o WhatsApp confere", async () => {
    state.buyerRow = { id: "b-1", whatsapp: "5511999990000" };
    const result = await provisionBuyer({ ...valid, email: "novo@example.com" });
    expect(result).toEqual({ buyerId: "b-1" });
    expect(state.updatedRow).toMatchObject({ whatsapp: "5511999990000", email: "novo@example.com" });
  });

  it("recusa quando o CNPJ existe mas o WhatsApp não confere", async () => {
    state.buyerRow = { id: "b-1", whatsapp: "5511888880000" };
    await expect(provisionBuyer(valid)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(state.updatedRow).toBeNull();
  });

  it("recusa input inválido antes de qualquer escrita", async () => {
    await expect(provisionBuyer({ cnpj: "111", whatsapp: "x" })).rejects.toBeInstanceOf(PreAccessError);
    expect(state.insertedRow).toBeNull();
  });

  it("aplica RATE_LIMITED acima de 5 tentativas em 5 min", async () => {
    state.attemptsCount = 6;
    await expect(provisionBuyer(valid)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("mapeia erro do banco para UNAVAILABLE", async () => {
    state.insertError = { message: "connection refused" };
    await expect(provisionBuyer(valid)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});
```

- [ ] **Step 6: Rodar e confirmar a falha**

Run: `pnpm --filter @mypet/core exec vitest run src/pre-access-server.test.ts`
Expected: FAIL com "Cannot find module './pre-access-server'".

- [ ] **Step 7: Implementar `pre-access-server.ts`**

Create `packages/core/src/pre-access-server.ts`:

```ts
import { getHubServiceClient } from "./supabase";

export type PreAccessInput = { cnpj: string; whatsapp: string; email?: string | null };
export type NormalizedInput = { cnpj: string; whatsapp: string; email: string | null };
export type PreAccessErrorCode = "INVALID_INPUT" | "RATE_LIMITED" | "UNAVAILABLE";

export class PreAccessError extends Error {
  constructor(public readonly code: PreAccessErrorCode) {
    super(code);
    this.name = "PreAccessError";
  }
}

const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 5;
const MAX_FIELD_LEN = 120;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizePreAccessInput(input: unknown): NormalizedInput {
  const raw = (input ?? {}) as Record<string, unknown>;
  const email = str(raw.email).trim().toLowerCase();
  return {
    cnpj: str(raw.cnpj).replace(/\D/g, ""),
    whatsapp: str(raw.whatsapp).replace(/\D/g, ""),
    email: email.length > 0 ? email : null,
  };
}

function isValidCnpj(cnpj: string): boolean {
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

function isValidEmail(email: string): boolean {
  const at = email.indexOf("@");
  return at > 0 && at === email.lastIndexOf("@") && email.slice(at + 1).length > 0;
}

export function validatePreAccessInput(input: NormalizedInput): PreAccessErrorCode | null {
  if (input.cnpj.length > MAX_FIELD_LEN || input.whatsapp.length > MAX_FIELD_LEN) return "INVALID_INPUT";
  if ((input.email?.length ?? 0) > MAX_FIELD_LEN) return "INVALID_INPUT";
  if (!isValidCnpj(input.cnpj)) return "INVALID_INPUT";
  if (!/^55\d{10,11}$/.test(input.whatsapp)) return "INVALID_INPUT";
  if (input.email !== null && !isValidEmail(input.email)) return "INVALID_INPUT";
  return null;
}

async function assertUnderRateLimit(cnpj: string, ipHash: string | null): Promise<void> {
  const db = getHubServiceClient();
  await db.from("pre_access_attempts").insert({ cnpj, ip_hash: ipHash });
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error } = await db
    .from("pre_access_attempts")
    .select("id", { count: "exact", head: true })
    .eq("cnpj", cnpj)
    .gte("created_at", since);
  if (error) throw new PreAccessError("UNAVAILABLE");
  if ((count ?? 0) > RATE_MAX) throw new PreAccessError("RATE_LIMITED");
}

export async function provisionBuyer(
  input: unknown,
  ctx: { ipHash?: string | null } = {},
): Promise<{ buyerId: string }> {
  const normalized = normalizePreAccessInput(input);
  if (validatePreAccessInput(normalized)) throw new PreAccessError("INVALID_INPUT");

  await assertUnderRateLimit(normalized.cnpj, ctx.ipHash ?? null);

  const db = getHubServiceClient();

  const { data: existing, error: readError } = await db
    .from("buyers")
    .select("id, whatsapp")
    .eq("cnpj", normalized.cnpj)
    .maybeSingle();
  if (readError) throw new PreAccessError("UNAVAILABLE");

  if (existing) {
    if (existing.whatsapp !== normalized.whatsapp) throw new PreAccessError("INVALID_INPUT");
    const patch: Record<string, unknown> = { whatsapp: normalized.whatsapp };
    if (normalized.email !== null) patch.email = normalized.email;
    const { error: updateError } = await db.from("buyers").update(patch).eq("id", existing.id);
    if (updateError) throw new PreAccessError("UNAVAILABLE");
    return { buyerId: existing.id as string };
  }

  const { data: inserted, error: insertError } = await db
    .from("buyers")
    .insert({
      cnpj: normalized.cnpj,
      whatsapp: normalized.whatsapp,
      email: normalized.email,
      source: "landing",
    })
    .select("id")
    .single();
  if (insertError || !inserted) throw new PreAccessError("UNAVAILABLE");

  return { buyerId: inserted.id as string };
}
```

- [ ] **Step 8: Adicionar o export do pacote**

Modify `packages/core/package.json` — no objeto `exports`, adicionar a linha (ordem alfabética, após `"./orders-server"`):

```json
    "./pre-access-server": "./src/pre-access-server.ts",
```

- [ ] **Step 9: Rodar os testes focados e o typecheck**

Run: `pnpm --filter @mypet/core exec vitest run src/pre-access-server.test.ts src/buyers-server.test.ts`
Expected: PASS.

Run: `pnpm --filter @mypet/core exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/pre-access-server.ts packages/core/src/pre-access-server.test.ts packages/core/src/buyers-server.ts packages/core/src/buyers-server.test.ts packages/core/package.json
git commit -m "feat(core): add pre-access provisioning by cnpj"
```

---

### Task 4: Infra de teste do app + endpoint `POST /api/pre-acesso`

**Files:**
- Modify: `apps/mypet/package.json`
- Create: `apps/mypet/vitest.config.ts`
- Create: `apps/mypet/vitest.setup.ts`
- Create: `apps/mypet/app/api/pre-acesso/route.ts`
- Create: `apps/mypet/app/api/pre-acesso/route.test.ts`

**Interfaces:**
- Consumes: `provisionBuyer` de `@mypet/core/pre-access-server`; `signAccessToken`, `ACCESS_COOKIE`, `ACCESS_COOKIE_OPTS` de `@mypet/core/access-session`.
- Produces: `POST(request: NextRequest): Promise<Response>` em `app/api/pre-acesso/route.ts`. Sucesso: HTTP 201, corpo `{ ok: true }`, header `Set-Cookie` com `mypet_acesso`. Erros: HTTP 400/429/503, corpo `{ error: { code, message } }` com as mensagens fixas.
- Consumed por: Task 5 (o formulário faz `POST` para esta rota).

- [ ] **Step 1: Instalar as devDependencies de teste do app**

Run:

```bash
pnpm --filter mypet add -D vitest@^4 @vitejs/plugin-react@^4 @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6 jsdom@^25
```

- [ ] **Step 2: Criar a config e o setup do Vitest**

Create `apps/mypet/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["app/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}", "*.test.{ts,tsx}"],
  },
});
```

Create `apps/mypet/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Modify `apps/mypet/package.json` — adicionar em `scripts`:

```json
    "test": "vitest run"
```

- [ ] **Step 3: Escrever o teste do endpoint (que falha)**

Create `apps/mypet/app/api/pre-acesso/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const provisionBuyer = vi.fn();

vi.mock("@mypet/core/pre-access-server", () => ({
  provisionBuyer: (...args: unknown[]) => provisionBuyer(...args),
  PreAccessError: class PreAccessError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

vi.mock("@mypet/core/access-session", () => ({
  signAccessToken: () => "signed-token",
  ACCESS_COOKIE: "mypet_acesso",
  ACCESS_COOKIE_OPTS: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 2_592_000 },
}));

import { POST } from "./route";
import { PreAccessError } from "@mypet/core/pre-access-server";

function fakeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: new Headers({ "x-forwarded-for": "203.0.113.7" }),
  } as unknown as NextRequest;
}

beforeEach(() => {
  provisionBuyer.mockReset();
});

describe("POST /api/pre-acesso", () => {
  it("responde 201 com cookie de sessão quando o cadastro é válido", async () => {
    provisionBuyer.mockResolvedValue({ buyerId: "b-1" });
    const res = await POST(fakeRequest({ cnpj: "12.345.678/0001-95", whatsapp: "5511999990000" }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("mypet_acesso=signed-token");
    expect(cookie).toContain("HttpOnly");
  });

  it("não devolve dado pessoal no corpo", async () => {
    provisionBuyer.mockResolvedValue({ buyerId: "b-1" });
    const res = await POST(fakeRequest({ cnpj: "12345678000195", whatsapp: "5511999990000", email: "loja@example.com" }));
    expect(JSON.stringify(await res.json())).not.toContain("loja@example.com");
  });

  it("mapeia INVALID_INPUT para 400 com a mensagem fixa", async () => {
    provisionBuyer.mockRejectedValue(new PreAccessError("INVALID_INPUT"));
    const res = await POST(fakeRequest({ cnpj: "1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual({
      code: "INVALID_INPUT",
      message: "Confira os dados informados e tente novamente.",
    });
  });

  it("mapeia RATE_LIMITED para 429", async () => {
    provisionBuyer.mockRejectedValue(new PreAccessError("RATE_LIMITED"));
    const res = await POST(fakeRequest({ cnpj: "12345678000195", whatsapp: "5511999990000" }));
    expect(res.status).toBe(429);
    expect((await res.json()).error.message).toBe("Aguarde alguns instantes antes de tentar novamente.");
  });

  it("mapeia erro inesperado para 503", async () => {
    provisionBuyer.mockRejectedValue(new Error("boom"));
    const res = await POST(fakeRequest({ cnpj: "12345678000195", whatsapp: "5511999990000" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.message).toBe(
      "Não foi possível liberar seu acesso agora. Tente novamente em instantes.",
    );
  });
});
```

- [ ] **Step 4: Rodar e confirmar a falha**

Run: `pnpm --filter mypet exec vitest run app/api/pre-acesso/route.test.ts`
Expected: FAIL com "Cannot find module './route'".

- [ ] **Step 5: Implementar o endpoint**

Create `apps/mypet/app/api/pre-acesso/route.ts`:

```ts
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { provisionBuyer, PreAccessError } from "@mypet/core/pre-access-server";
import { signAccessToken, ACCESS_COOKIE, ACCESS_COOKIE_OPTS } from "@mypet/core/access-session";

const MESSAGES: Record<string, { status: number; message: string }> = {
  INVALID_INPUT: { status: 400, message: "Confira os dados informados e tente novamente." },
  RATE_LIMITED: { status: 429, message: "Aguarde alguns instantes antes de tentar novamente." },
  UNAVAILABLE: {
    status: 503,
    message: "Não foi possível liberar seu acesso agora. Tente novamente em instantes.",
  },
};

function hashIp(header: string | null): string | null {
  const ip = header?.split(",")[0]?.trim();
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function serializeCookie(name: string, value: string, opts: typeof ACCESS_COOKIE_OPTS): string {
  return [
    `${name}=${value}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    `SameSite=${opts.sameSite === "lax" ? "Lax" : opts.sameSite}`,
    opts.httpOnly ? "HttpOnly" : "",
    opts.secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.json().catch(() => null);
  try {
    const { buyerId } = await provisionBuyer(body, {
      ipHash: hashIp(request.headers.get("x-forwarded-for")),
    });
    const res = Response.json({ ok: true }, { status: 201 });
    res.headers.append(
      "Set-Cookie",
      serializeCookie(ACCESS_COOKIE, signAccessToken(buyerId), ACCESS_COOKIE_OPTS),
    );
    return res;
  } catch (error) {
    const code = error instanceof PreAccessError ? error.code : "UNAVAILABLE";
    const { status, message } = MESSAGES[code] ?? MESSAGES.UNAVAILABLE;
    return Response.json({ error: { code, message } }, { status });
  }
}
```

- [ ] **Step 6: Rodar os testes do endpoint**

Run: `pnpm --filter mypet exec vitest run app/api/pre-acesso/route.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/package.json apps/mypet/vitest.config.ts apps/mypet/vitest.setup.ts apps/mypet/app/api/pre-acesso pnpm-lock.yaml
git commit -m "feat(mypet): add pre-acesso endpoint and app test setup"
```

---

### Task 5: Componente do formulário de acesso

**Files:**
- Create: `apps/mypet/app/_components/pre-access/access-form.tsx`
- Create: `apps/mypet/app/_components/pre-access/access-form.test.tsx`

**Interfaces:**
- Consumes: `POST /api/pre-acesso` (via `fetch`).
- Produces: `export function AccessForm(): JSX.Element` — client component. Faz `fetch("/api/pre-acesso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cnpj, whatsapp, email }) })` com os valores como digitados (`email` vira `""` quando em branco). Em resposta OK: navega para `/loja` via `window.location.assign`. Em resposta não-OK: mostra a mensagem vinda de `error.message`, ou a genérica de 503 se não houver.
- Consumed por: Task 6 (`hero`/`page.tsx` renderizam `<AccessForm />` na âncora `#acesso`).

- [ ] **Step 1: Escrever o teste do formulário (que falha)**

Create `apps/mypet/app/_components/pre-access/access-form.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessForm } from "./access-form";

const assign = vi.fn();

beforeEach(() => {
  assign.mockReset();
  vi.stubGlobal("fetch", vi.fn());
  Object.defineProperty(window, "location", { value: { assign }, writable: true });
});

describe("AccessForm", () => {
  it("envia exatamente cnpj, whatsapp e email para /api/pre-acesso", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    const user = userEvent.setup();
    render(<AccessForm />);

    await user.type(screen.getByLabelText("CNPJ"), "12.345.678/0001-95");
    await user.type(screen.getByLabelText("WhatsApp"), "(11) 99999-0000");
    await user.type(screen.getByLabelText(/E-mail/), "loja@example.com");
    await user.click(screen.getByRole("button", { name: "Criar acesso à loja" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/pre-acesso",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          cnpj: "12.345.678/0001-95",
          whatsapp: "(11) 99999-0000",
          email: "loja@example.com",
        }),
      }),
    );
    expect(assign).toHaveBeenCalledWith("/loja");
  });

  it("envia email vazio quando o campo fica em branco", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    const user = userEvent.setup();
    render(<AccessForm />);

    await user.type(screen.getByLabelText("CNPJ"), "12345678000195");
    await user.type(screen.getByLabelText("WhatsApp"), "5511999990000");
    await user.click(screen.getByRole("button", { name: "Criar acesso à loja" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/pre-acesso",
      expect.objectContaining({
        body: JSON.stringify({ cnpj: "12345678000195", whatsapp: "5511999990000", email: "" }),
      }),
    );
  });

  it("mostra a mensagem de erro do servidor e não navega", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: "INVALID_INPUT", message: "Confira os dados informados e tente novamente." } }),
    });
    const user = userEvent.setup();
    render(<AccessForm />);

    await user.type(screen.getByLabelText("CNPJ"), "1");
    await user.type(screen.getByLabelText("WhatsApp"), "2");
    await user.click(screen.getByRole("button", { name: "Criar acesso à loja" }));

    expect(await screen.findByText("Confira os dados informados e tente novamente.")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `pnpm --filter mypet exec vitest run app/_components/pre-access/access-form.test.tsx`
Expected: FAIL com "Cannot find module './access-form'".

- [ ] **Step 3: Implementar o formulário**

Create `apps/mypet/app/_components/pre-access/access-form.tsx`:

```tsx
"use client";

import { useState } from "react";

const GENERIC_ERROR = "Não foi possível liberar seu acesso agora. Tente novamente em instantes.";

export function AccessForm() {
  const [cnpj, setCnpj] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/pre-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj, whatsapp, email }),
      });
      if (response.ok) {
        window.location.assign("/loja");
        return;
      }
      const data = await response.json().catch(() => null);
      setError(data?.error?.message ?? GENERIC_ERROR);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id="criar-acesso" onSubmit={handleSubmit} noValidate>
      <label htmlFor="pa-cnpj">CNPJ</label>
      <input
        id="pa-cnpj"
        name="cnpj"
        autoComplete="organization"
        required
        value={cnpj}
        onChange={(e) => setCnpj(e.target.value)}
      />

      <label htmlFor="pa-whatsapp">WhatsApp</label>
      <input
        id="pa-whatsapp"
        name="whatsapp"
        autoComplete="tel"
        inputMode="tel"
        required
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
      />

      <label htmlFor="pa-email">E-mail (opcional)</label>
      <input
        id="pa-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {error ? (
        <p role="alert">{error}</p>
      ) : null}

      <p>
        Ao criar o acesso você concorda com o uso dos dados para liberação da loja, conforme a{" "}
        <a href="/politica-de-privacidade">política de privacidade</a>.
      </p>

      <button type="submit" disabled={submitting}>
        {submitting ? "Enviando…" : "Criar acesso à loja"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Rodar os testes do formulário**

Run: `pnpm --filter mypet exec vitest run app/_components/pre-access/access-form.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/_components/pre-access/access-form.tsx apps/mypet/app/_components/pre-access/access-form.test.tsx
git commit -m "feat(mypet): add access-form client component"
```

---

### Task 6: Estrutura de duas rotas — `/loja` protegida e `/` mínima

**Files:**
- Create: `apps/mypet/lib/require-buyer.ts`
- Create: `apps/mypet/lib/require-buyer.test.ts`
- Rename+modify: `apps/mypet/app/page.tsx` → `apps/mypet/app/loja/page.tsx`
- Create: `apps/mypet/app/loja/page.test.tsx`
- Create: `apps/mypet/app/page.tsx` (nova landing mínima)
- Create: `apps/mypet/app/_components/pre-access/hero.tsx`
- Modify: `apps/mypet/proxy.ts`
- Create: `apps/mypet/proxy.test.ts`

**Interfaces:**
- Consumes: `verifyAccessToken`, `ACCESS_COOKIE` de `@mypet/core/access-session`; `getBuyerById` de `@mypet/core/buyers-server`; `getHubServiceClient` de `@mypet/core/supabase`; `AccessForm` de `../_components/pre-access/access-form`; `cookies` de `next/headers`.
- Produces:
  - `apps/mypet/lib/require-buyer.ts`: `requireBuyer(): Promise<Buyer | null>`
  - `apps/mypet/app/loja/page.tsx`: a composição de catálogo (antes em `/`), com guard no topo.
  - `apps/mypet/app/page.tsx`: landing pública mínima com `<Hero />` e `<AccessForm />`, âncoras `#condicoes` e `#acesso`.
  - `apps/mypet/app/_components/pre-access/hero.tsx`: `export function Hero(): JSX.Element`.
  - `proxy.ts`: `config.matcher` inclui `"/loja/:path*"`; requisição anônima a `/loja*` → `NextResponse.redirect(origin + "/")`.
- Consumed por: Task 7 (compõe mais seções em `page.tsx`), Task 8 (`cotacao`/`pedidos` importam `requireBuyer`).

- [ ] **Step 1: Escrever o teste de `require-buyer` (que falha)**

Create `apps/mypet/lib/require-buyer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieGet = vi.fn();
const maybeSingle = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

vi.mock("@mypet/core/supabase", () => ({
  getHubServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: maybeSingle }) }) }),
  }),
}));

vi.mock("@mypet/core/access-session", () => ({
  ACCESS_COOKIE: "mypet_acesso",
  verifyAccessToken: (token: string | undefined) =>
    token === "good" ? { buyerId: "b-1" } : null,
}));

import { requireBuyer } from "./require-buyer";

beforeEach(() => {
  cookieGet.mockReset();
  maybeSingle.mockReset();
});

describe("requireBuyer", () => {
  it("retorna null quando não há cookie", async () => {
    cookieGet.mockReturnValue(undefined);
    expect(await requireBuyer()).toBeNull();
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("retorna null quando o token é inválido", async () => {
    cookieGet.mockReturnValue({ value: "bad" });
    expect(await requireBuyer()).toBeNull();
  });

  it("retorna o comprador quando o token é válido", async () => {
    cookieGet.mockReturnValue({ value: "good" });
    maybeSingle.mockResolvedValue({ data: { id: "b-1", cnpj: "12345678000195" }, error: null });
    expect(await requireBuyer()).toMatchObject({ id: "b-1" });
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `pnpm --filter mypet exec vitest run lib/require-buyer.test.ts`
Expected: FAIL com "Cannot find module './require-buyer'".

- [ ] **Step 3: Implementar `require-buyer.ts`**

Create `apps/mypet/lib/require-buyer.ts`:

```ts
import { cookies } from "next/headers";
import { getHubServiceClient } from "@mypet/core/supabase";
import { getBuyerById } from "@mypet/core/buyers-server";
import { verifyAccessToken, ACCESS_COOKIE } from "@mypet/core/access-session";
import type { Buyer } from "@mypet/core/buyers-server";

export async function requireBuyer(): Promise<Buyer | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  return getBuyerById(getHubServiceClient(), payload.buyerId);
}
```

- [ ] **Step 4: Rodar os testes de `require-buyer`**

Run: `pnpm --filter mypet exec vitest run lib/require-buyer.test.ts`
Expected: PASS.

- [ ] **Step 5: Mover a composição de catálogo para `/loja`**

Run: `git mv apps/mypet/app/page.tsx apps/mypet/app/loja/page.tsx`

Modify `apps/mypet/app/loja/page.tsx`:
- No topo do `export default async function Home(...)` (renomeie para `LojaPage`), antes de `const categories = await getCategories();`, adicionar:

```ts
  const buyer = await requireBuyer();
  if (!buyer) redirect("/");
```

- Adicionar os imports: `import { redirect } from "next/navigation";` e `import { requireBuyer } from "@/lib/require-buyer";`.
- Substituir o wrapper `<LeadGateProvider>` … `</LeadGateProvider>` por `<>` … `</>` e remover o import de `LeadGateProvider`.
- Remover a seção "CTA BANNER" que usa `<UnlockButton …>` e o import de `UnlockButton`. Manter o restante da seção de rodapé.
- Em `generateMetadata`, trocar `canonicalUrl(clientConfig.domain, "/")` por `canonicalUrl(clientConfig.domain, "/loja")`.
- Não há links `href="/"` de catálogo neste arquivo além do canonical; se algum componente filho apontar para `/`, isso é tratado nas tasks seguintes.

- [ ] **Step 6: Escrever o teste da página `/loja` (que falha)**

Create `apps/mypet/app/loja/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireBuyer = vi.fn();
const redirect = vi.fn(() => {
  throw new Error("REDIRECT");
});

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@mypet/core/catalog", () => ({
  getCategories: async () => [],
  getProductCount: async () => 0,
}));

import LojaPage from "./page";

beforeEach(() => {
  requireBuyer.mockReset();
  redirect.mockClear();
});

describe("LojaPage", () => {
  it("redireciona para / quando não há comprador", async () => {
    requireBuyer.mockResolvedValue(null);
    await expect(LojaPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/");
  });
});
```

Nota: se a renderização do server component puxar componentes de catálogo pesados, restrinja o teste ao caminho de `redirect` — o mock de `@mypet/core/catalog` acima cobre o mínimo. Se surgirem outros imports de dados, mocke-os com retorno vazio no mesmo bloco.

- [ ] **Step 7: Criar a landing mínima e o hero**

Create `apps/mypet/app/_components/pre-access/hero.tsx`:

```tsx
export function Hero() {
  return (
    <section aria-labelledby="hero-title" style={{ padding: "64px 24px", maxWidth: 960, margin: "0 auto" }}>
      <p style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
        Atacado para pet shops
      </p>
      <h1 id="hero-title" style={{ fontSize: 40, fontWeight: 900, margin: "12px 0 16px" }}>
        Abasteça sua loja com condições claras
      </h1>
      <p style={{ fontSize: 18, maxWidth: 640 }}>
        Veja pedido mínimo, desconto por volume e prazos antes de entrar na loja. Sem cotação por
        WhatsApp para começar.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
        <a href="#condicoes" className="cta-primary">Ver condições</a>
        <a href="#acesso" className="cta-secondary">Já tenho acesso</a>
      </div>
    </section>
  );
}
```

Create `apps/mypet/app/page.tsx`:

```tsx
import type { Metadata } from "next";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { Hero } from "./_components/pre-access/hero";
import { AccessForm } from "./_components/pre-access/access-form";

export function generateMetadata(): Metadata {
  return {
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/") },
  };
}

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <section id="acesso" aria-labelledby="acesso-title" style={{ padding: "48px 24px", maxWidth: 480, margin: "0 auto" }}>
        <h2 id="acesso-title">Criar acesso à loja</h2>
        <AccessForm />
      </section>
    </main>
  );
}
```

Nota: as classes `cta-primary` / `cta-secondary` já existem no CSS global movido para `/loja`; nesta task a landing pode ficar sem estilo fino — Task 7 acrescenta o bloco visual. O que importa aqui: `h1` único, âncoras `#condicoes` e `#acesso`, e o formulário renderizado.

- [ ] **Step 8: Atualizar o `proxy.ts` e escrever seu teste**

Modify `apps/mypet/proxy.ts`:
- No `config.matcher`, adicionar `"/loja/:path*"` e `"/loja"`.
- Depois de `await supabase.auth.getUser();`, antes de `return response;`, adicionar:

```ts
  const { pathname } = request.nextUrl;
  if (pathname === "/loja" || pathname.startsWith("/loja/")) {
    const { verifyAccessToken, ACCESS_COOKIE } = await import("@mypet/core/access-session");
    if (!verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }
```

Create `apps/mypet/proxy.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

vi.mock("@mypet/core/access-session", () => ({
  ACCESS_COOKIE: "mypet_acesso",
  verifyAccessToken: (t: string | undefined) => (t === "good" ? { buyerId: "b" } : null),
}));

import { proxy } from "./proxy";

function fakeRequest(url: string, cookie?: string): NextRequest {
  return {
    nextUrl: new URL(url),
    url,
    cookies: { get: (n: string) => (cookie ? { name: n, value: cookie } : undefined), getAll: () => [] },
  } as unknown as NextRequest;
}

describe("proxy", () => {
  it("redireciona /loja anônimo para /", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const res = await proxy(fakeRequest("https://app.test/loja"));
    expect(res.headers.get("location")).toBe("https://app.test/");
  });

  it("deixa passar /loja com cookie válido", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const res = await proxy(fakeRequest("https://app.test/loja", "good"));
    expect(res.headers.get("location")).toBeNull();
  });
});
```

- [ ] **Step 9: Rodar os testes focados e o build**

Run: `pnpm --filter mypet exec vitest run lib/require-buyer.test.ts app/loja/page.test.tsx proxy.test.ts`
Expected: PASS.

Run: `pnpm --filter mypet build`
Expected: build conclui sem erro; `/` e `/loja` aparecem na lista de rotas.

- [ ] **Step 10: Commit**

```bash
git add apps/mypet/lib apps/mypet/app/loja apps/mypet/app/page.tsx apps/mypet/app/_components/pre-access/hero.tsx apps/mypet/proxy.ts apps/mypet/proxy.test.ts
git commit -m "feat(mypet): move storefront to protected /loja, add minimal landing"
```

---

### Task 7: Conteúdo educativo da landing

**Files:**
- Create: `apps/mypet/app/pre-access-content.ts`
- Create: `apps/mypet/app/_components/pre-access/commercial-conditions.tsx`
- Create: `apps/mypet/app/_components/pre-access/education-cards.tsx`
- Create: `apps/mypet/app/_components/pre-access/popular-categories.tsx`
- Create: `apps/mypet/app/_components/pre-access/commercial-faq.tsx`
- Create: `apps/mypet/app/_components/pre-access/institutional-trust.tsx`
- Modify: `apps/mypet/app/page.tsx`
- Create: `apps/mypet/app/page.test.tsx`

**Interfaces:**
- Consumes: `getCategories()` de `@mypet/core/catalog`; `pre-access-content.ts`.
- Produces:
  - `pre-access-content.ts` exporta `commercialConditions`, `educationCards`, `commercialFaq`, `institutionalPoints` como `const` imutáveis tipados.
  - Cada componente é um server component sem preço e sem import de módulo de catálogo com preço (exceto `popular-categories`, que só usa nomes de categoria).
  - `page.tsx` compõe: `Hero`, `CommercialConditions` (id `condicoes`), `EducationCards`, `PopularCategories`, `CommercialFaq`, `InstitutionalTrust`, e a seção `#acesso` com `AccessForm`.

- [ ] **Step 1: Escrever o teste da landing (que falha)**

Create `apps/mypet/app/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@mypet/core/catalog", () => ({
  getCategories: async () => [
    { id: "1", slug: "racao", name: "Ração" },
    { id: "2", slug: "higiene", name: "Higiene" },
  ],
}));

import LandingPage from "./page";

describe("LandingPage", () => {
  it("renderiza as três condições comerciais e as oito perguntas do FAQ", async () => {
    render(await LandingPage());
    expect(screen.getByText("Pedido mínimo")).toBeInTheDocument();
    expect(screen.getByText("Desconto por volume")).toBeInTheDocument();
    expect(screen.getByText("Entrega, frete e prazo")).toBeInTheDocument();
    expect(screen.getAllByRole("group").length).toBeGreaterThanOrEqual(8); // <details> do FAQ
  });

  it("mostra nomes de categoria sem qualquer preço", async () => {
    render(await LandingPage());
    expect(screen.getByText("Ração")).toBeInTheDocument();
    expect(screen.queryByText(/Preço do canal distribuidora/)).toBeNull();
    expect(screen.queryByText(/R\$\s?\d/)).toBeNull();
  });

  it("tem um único h1", async () => {
    render(await LandingPage());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `pnpm --filter mypet exec vitest run app/page.test.tsx`
Expected: FAIL — os textos das seções ainda não existem.

- [ ] **Step 3: Criar a configuração de conteúdo**

Create `apps/mypet/app/pre-access-content.ts`:

```ts
// Valores comerciais abaixo são EXEMPLOS DE DESENVOLVIMENTO. Substituir pelos
// números reais antes de produção — sem alterar os componentes que os consomem.

export const commercialConditions = [
  {
    id: "pedido-minimo",
    title: "Pedido mínimo",
    value: "A partir de R$ 500",
    detail: "Exemplo de condição comercial para o primeiro pedido.",
  },
  {
    id: "desconto-volume",
    title: "Desconto por volume",
    value: "Até 12%",
    detail: "Exemplo de faixa progressiva por quantidade.",
  },
  {
    id: "entrega",
    title: "Entrega, frete e prazo",
    value: "Em até 5 dias úteis",
    detail: "Exemplo de prazo para regiões atendidas.",
  },
] as const;

export const educationCards = [
  { id: "como-comprar", title: "Como funciona a compra", body: "Cadastro, acesso à loja e pedido pelo carrinho.", href: "#condicoes" },
  { id: "condicoes", title: "Condições de compra", body: "Pedido mínimo, descontos e formas de pagamento.", href: "#condicoes" },
  { id: "categorias", title: "Categorias disponíveis", body: "Veja se o mix atende sua loja.", href: "#categorias" },
  { id: "entrega-pagamento", title: "Entrega e pagamento", body: "Prazos, regiões e meios de pagamento.", href: "#faq" },
] as const;

export const commercialFaq = [
  { q: "Qual é o pedido mínimo?", a: "Exemplo: a partir de R$ 500 no primeiro pedido." },
  { q: "Há desconto para compras em maior quantidade?", a: "Exemplo: sim, faixas progressivas por volume." },
  { q: "A My Pet vende para pessoa física?", a: "Não. A loja é exclusiva para CNPJ do ramo pet." },
  { q: "Quais são as formas de pagamento?", a: "Exemplo: boleto e Pix; prazo conforme análise." },
  { q: "Como é calculado o frete e quais regiões são atendidas?", a: "Exemplo: por peso e destino, nas regiões atendidas." },
  { q: "Qual é o prazo de entrega?", a: "Exemplo: até 5 dias úteis após a confirmação." },
  { q: "Preciso de CNPJ para comprar?", a: "Sim. O CNPJ identifica sua loja no acesso." },
  { q: "Como acesso os preços?", a: "Crie o acesso com CNPJ e WhatsApp; os preços aparecem em /loja." },
] as const;

export const institutionalPoints = [
  { id: "cnpj", label: "Operação com CNPJ ativo no ramo de distribuição pet." },
  { id: "catalogo", label: "Catálogo com marcas e categorias listadas nesta página." },
  { id: "suporte", label: "Suporte por WhatsApp após o acesso, para dúvidas de pedido." },
] as const;
```

- [ ] **Step 4: Criar os componentes de seção**

Create `apps/mypet/app/_components/pre-access/commercial-conditions.tsx`:

```tsx
import { commercialConditions } from "../../pre-access-content";

export function CommercialConditions() {
  return (
    <section id="condicoes" aria-labelledby="condicoes-title" style={{ padding: "48px 24px", maxWidth: 960, margin: "0 auto" }}>
      <h2 id="condicoes-title">Condições comerciais</h2>
      <ul style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", listStyle: "none", padding: 0 }}>
        {commercialConditions.map((c) => (
          <li key={c.id} style={{ border: "1px solid #DDE2EC", borderRadius: 16, padding: 20 }}>
            <h3>{c.title}</h3>
            <p style={{ fontSize: 22, fontWeight: 900 }}>{c.value}</p>
            <p>{c.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `apps/mypet/app/_components/pre-access/education-cards.tsx`:

```tsx
import { educationCards } from "../../pre-access-content";

export function EducationCards() {
  return (
    <section aria-labelledby="educacao-title" style={{ padding: "24px" }}>
      <h2 id="educacao-title">Antes de entrar na loja</h2>
      <ul
        style={{ display: "flex", gap: 12, overflowX: "auto", listStyle: "none", padding: "8px 0", scrollSnapType: "x mandatory" }}
      >
        {educationCards.map((card) => (
          <li key={card.id} style={{ flex: "0 0 240px", scrollSnapAlign: "start", border: "1px solid #DDE2EC", borderRadius: 16, padding: 16 }}>
            <a href={card.href}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `apps/mypet/app/_components/pre-access/popular-categories.tsx`:

```tsx
import { getCategories } from "@mypet/core/catalog";

export async function PopularCategories() {
  const categories = await getCategories();
  return (
    <section id="categorias" aria-labelledby="categorias-title" style={{ padding: "48px 24px", maxWidth: 960, margin: "0 auto" }}>
      <h2 id="categorias-title">Categorias mais procuradas</h2>
      <ul style={{ display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none", padding: 0 }}>
        {categories.map((category) => (
          <li key={category.id} style={{ border: "1px solid #DDE2EC", borderRadius: 100, padding: "6px 14px" }}>
            {category.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `apps/mypet/app/_components/pre-access/commercial-faq.tsx`:

```tsx
import { commercialFaq } from "../../pre-access-content";

export function CommercialFaq() {
  return (
    <section id="faq" aria-labelledby="faq-title" style={{ padding: "48px 24px", maxWidth: 760, margin: "0 auto" }}>
      <h2 id="faq-title">Perguntas frequentes</h2>
      {commercialFaq.map((item) => (
        <details key={item.q} style={{ borderBottom: "1px solid #DDE2EC", padding: "12px 0" }}>
          <summary style={{ fontWeight: 700, cursor: "pointer" }}>{item.q}</summary>
          <p style={{ marginTop: 8 }}>{item.a}</p>
        </details>
      ))}
    </section>
  );
}
```

Create `apps/mypet/app/_components/pre-access/institutional-trust.tsx`:

```tsx
import { institutionalPoints } from "../../pre-access-content";

export function InstitutionalTrust() {
  return (
    <section aria-labelledby="institucional-title" style={{ padding: "48px 24px", maxWidth: 760, margin: "0 auto" }}>
      <h2 id="institucional-title">Sobre a operação</h2>
      <ul>
        {institutionalPoints.map((point) => (
          <li key={point.id}>{point.label}</li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: Compor as seções em `page.tsx`**

Modify `apps/mypet/app/page.tsx` — substituir o corpo de `LandingPage`:

```tsx
export default async function LandingPage() {
  return (
    <main>
      <Hero />
      <CommercialConditions />
      <EducationCards />
      <PopularCategories />
      <CommercialFaq />
      <InstitutionalTrust />
      <section id="acesso" aria-labelledby="acesso-title" style={{ padding: "48px 24px", maxWidth: 480, margin: "0 auto" }}>
        <h2 id="acesso-title">Criar acesso à loja</h2>
        <AccessForm />
      </section>
    </main>
  );
}
```

Adicionar os imports das cinco seções. Manter `generateMetadata` como está. `LandingPage` passa a ser `async` porque `PopularCategories` é `async` (é um filho, então `LandingPage` em si não precisa `await`, mas o teste chama `await LandingPage()` — mantenha `async` para casar).

- [ ] **Step 6: Rodar os testes e o build**

Run: `pnpm --filter mypet exec vitest run app/page.test.tsx`
Expected: PASS (3 testes).

Run: `pnpm --filter mypet build`
Expected: build sem erro.

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/app/pre-access-content.ts apps/mypet/app/_components/pre-access apps/mypet/app/page.tsx apps/mypet/app/page.test.tsx
git commit -m "feat(mypet): add educational landing sections"
```

---

### Task 8: Rotas legadas, metadata pública, sitemap, robots e env

**Files:**
- Modify: `apps/mypet/app/entrar/page.tsx`
- Modify: `apps/mypet/app/entrar/callback/route.ts`
- Modify: `apps/mypet/app/completar-cadastro/page.tsx`
- Modify: `apps/mypet/app/cotacao/page.tsx`
- Modify: `apps/mypet/app/pedidos/page.tsx`
- Modify: `apps/mypet/app/layout.tsx`
- Modify: `apps/mypet/app/robots.ts`
- Modify: `apps/mypet/app/sitemap.ts`
- Create: `apps/mypet/app/sitemap.test.ts`
- Create: `apps/mypet/.env.example`

**Interfaces:**
- Consumes: `requireBuyer` de `@/lib/require-buyer` (Task 6).
- Produces: `/entrar`, `/entrar/callback`, `/completar-cadastro` redirecionam para `/`; `/cotacao` e `/pedidos` exigem comprador; `robots` bloqueia `/loja`; `sitemap` sem `/loja`.

- [ ] **Step 1: Escrever o teste do sitemap (que falha)**

Create `apps/mypet/app/sitemap.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@mypet/core/catalog", () => ({
  getSitemapProducts: async () => [],
  getCategories: async () => [{ id: "1", slug: "racao", name: "Ração" }],
}));

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("inclui a raiz e nunca a loja protegida", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://mypetbrasil.com.br");
    expect(urls).not.toContain("https://mypetbrasil.com.br/loja");
  });
});
```

- [ ] **Step 2: Rodar e confirmar (pode já passar)**

Run: `pnpm --filter mypet exec vitest run app/sitemap.test.ts`
Expected: PASS já com o sitemap atual (que não lista `/loja`). Este teste é a trava de regressão; se falhar, ajuste o `sitemap.ts` para não incluir `/loja`.

- [ ] **Step 3: Redirecionar as rotas de login legadas**

Modify `apps/mypet/app/entrar/page.tsx` — substituir todo o arquivo por:

```tsx
import { redirect } from "next/navigation";

export default function EntrarPage() {
  redirect("/#acesso");
}
```

Modify `apps/mypet/app/entrar/callback/route.ts` — substituir por:

```ts
import { NextResponse, type NextRequest } from "next/server";

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}
```

Modify `apps/mypet/app/completar-cadastro/page.tsx` — substituir todo o arquivo por:

```tsx
import { redirect } from "next/navigation";

export default function CompletarCadastroPage() {
  redirect("/#acesso");
}
```

Nota: `apps/mypet/app/completar-cadastro/actions.ts` deixa de ser usado. Deixe o arquivo como está (não referenciado) ou remova-o junto com este commit se o `tsc` reclamar de import órfão — verifique com o typecheck do Step 6.

- [ ] **Step 4: Trocar o guard de `/cotacao` e `/pedidos`**

Modify `apps/mypet/app/pedidos/page.tsx` — em `PedidosContent`, substituir o bloco Supabase Auth:

```ts
  const buyer = await requireBuyer();
  if (!buyer) {
    redirect("/");
  }
  const orders = await getOrdersByBuyer(getHubServiceClient(), buyer.id);
```

Ajustar imports: remover `createServerSupabaseClient`, adicionar `import { requireBuyer } from "@/lib/require-buyer";` e `import { getHubServiceClient } from "@mypet/core/supabase";`. Manter `redirect` e `getOrdersByBuyer`.

Modify `apps/mypet/app/cotacao/page.tsx`:
- Adicionar no topo de `CotacaoPage`, antes de `const categories = await getCategories();`:

```ts
  const buyer = await requireBuyer();
  if (!buyer) redirect("/");
```

- Adicionar `import { redirect } from "next/navigation";` e `import { requireBuyer } from "@/lib/require-buyer";`.
- Trocar o `href="/"` do link "Voltar ao catálogo" por `href="/loja"`.

Se `apps/mypet/app/cotacao/cotacao-content.tsx` tiver `href="/"` de catálogo, trocar por `href="/loja"`.

- [ ] **Step 5: Metadata, robots e env**

Modify `apps/mypet/app/layout.tsx` — trocar o campo `description` da `metadata`:

```ts
  description:
    "Atacado para pet shops: veja condições de compra, pedido mínimo e categorias antes de acessar a loja.",
```

Modify `apps/mypet/app/robots.ts` — no array `disallow`, adicionar `"/loja"` como primeiro item:

```ts
      disallow: ["/loja", "/entrar", "/completar-cadastro", "/cotacao", "/pedidos", "/api/"],
```

Create `apps/mypet/.env.example`:

```bash
# URL do projeto Supabase hub_catalogo
SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
# Chave anônima (leitura pública do catálogo)
SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Chave service-role — usada só server-side por pre-access-server / require-buyer
SUPABASE_SERVICE_ROLE_KEY=
# Segredo HMAC do cookie de sessão mypet_acesso (string aleatória longa)
ACCESS_SESSION_SECRET=
```

- [ ] **Step 6: Rodar a suíte completa e o build**

Run: `pnpm --filter @mypet/core test`
Expected: PASS.

Run: `pnpm --filter mypet exec vitest run`
Expected: PASS (todos os testes do app).

Run: `pnpm --filter mypet exec tsc --noEmit`
Expected: sem erros (se acusar import órfão em `completar-cadastro/actions.ts` ou `entrar` antigo, remover o arquivo órfão neste commit).

Run: `pnpm lint`
Expected: PASS.

Run: `pnpm --filter mypet build`
Expected: build sem erro; rotas `/` e `/loja` presentes; `/entrar`, `/completar-cadastro` como redirects.

- [ ] **Step 7: Smoke test manual**

Com `ACCESS_SESSION_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`, rodar `pnpm dev:mypet` e verificar em 375 px e 1440 px:

1. `/` não tem preço no HTML nem em dados carregados; hero, 3 condições, FAQ (8), categorias e formulário aparecem; nenhum texto "a definir"/"placeholder".
2. `/loja` como anônimo redireciona para `/`.
3. Cadastro com CNPJ + WhatsApp válidos cria um comprador e leva a `/loja` com preços.
4. Voltar a `/`, limpar o cookie `mypet_acesso`, refazer o cadastro com o mesmo CNPJ e o mesmo WhatsApp → entra de novo.
5. Mesmo CNPJ com WhatsApp diferente → erro genérico, sem acesso.
6. Seis envios rápidos do mesmo CNPJ → o 6º mostra a mensagem de limite.
7. CNPJ inválido → mensagem de correção; nenhuma linha nova em `buyers`.

- [ ] **Step 8: Commit**

```bash
git add apps/mypet/app/entrar apps/mypet/app/completar-cadastro apps/mypet/app/cotacao apps/mypet/app/pedidos apps/mypet/app/layout.tsx apps/mypet/app/robots.ts apps/mypet/app/sitemap.ts apps/mypet/app/sitemap.test.ts apps/mypet/.env.example
git commit -m "feat(mypet): retire legacy auth routes, guard cotacao/pedidos, public metadata"
```

---

## Plan self-review

**Cobertura da spec:**
- Cadastro CNPJ + WhatsApp + e-mail opcional, normalização e validação server-side → Task 3 (`normalizePreAccessInput`, `validatePreAccessInput`).
- Liberação imediata por cookie assinado, sem magic link → Task 1 (token) + Task 4 (`Set-Cookie`).
- Limite de reenvio por CNPJ (5 em 5 min) → Task 3 (`assertUnderRateLimit`) + Task 2 (`pre_access_attempts`).
- Retorno pelo mesmo formulário, servidor decide pelo CNPJ; WhatsApp precisa bater → Task 3 (`provisionBuyer`).
- `/loja` recebe o catálogo e exige comprador no servidor → Task 6 (`requireBuyer` + guard + `proxy`).
- `/` sem preço, com hero/condições/cards/categorias/FAQ/institucional/formulário → Tasks 6 e 7; trava de regressão de preço em `app/page.test.tsx`.
- Migração no `hub_catalogo` (FK, campos opcionais, `cnpj` único, `source`, `pre_access_attempts`) → Task 2.
- Envs `ACCESS_SESSION_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` → Task 8 (`.env.example`).
- Infra de teste do app → Task 4.
- Rotas legadas (`/entrar`, `/completar-cadastro`, callback) e guard de `/cotacao`/`/pedidos` → Task 8.
- Metadata B2B, robots bloqueia `/loja`, sitemap sem `/loja` → Task 8.
- `auth-server.ts`/`safeNextPath` preservados para `apps/distribuidora` → registrado nas Global Constraints; nenhuma task os remove.

**Lacunas conhecidas (fora de escopo, registradas):** `/produtos/[id]` e `/categoria/[slug]` do `apps/mypet` seguem públicas com preço — condição pré-existente; plano separado.

**Scan de placeholders:** nenhum passo usa "TBD"/"depois"/"tratar erros adequadamente". Todo passo de código traz o código. Os valores comerciais em `pre-access-content.ts` são exemplos rotulados como tal no próprio arquivo, o que a spec exige — não são placeholders de plano.

**Consistência de tipos:**
- `PreAccessInput`/`NormalizedInput` definidos na Task 3 e consumidos como `unknown` pela rota da Task 4 (a rota não referencia o shape interno).
- `signAccessToken(buyerId)` / `verifyAccessToken(token) → { buyerId }` — mesmos nomes nas Tasks 1, 4 e 6.
- `ACCESS_COOKIE` / `ACCESS_COOKIE_OPTS` — mesma forma nas Tasks 1, 4, 6.
- `requireBuyer(): Promise<Buyer | null>` — definido na Task 6, consumido na Task 8.
- `Buyer` com `nome`/`empresa`/`email` anuláveis — Task 3, usado na Task 6.
- `provisionBuyer(input, ctx?) → { buyerId }` — Task 3, chamado na Task 4.
