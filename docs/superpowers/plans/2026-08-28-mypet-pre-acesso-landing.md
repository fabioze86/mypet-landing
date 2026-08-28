# My Pet pré-acesso B2B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `/` into a lead-education landing and release the authenticated B2B store at `/loja` after a minimal CNPJ, e-mail and WhatsApp registration.

**Architecture:** Keep marketing content public and server-rendered at `/`; isolate the interactive registration form in a client component. The e-mail magic link remains the proof of e-mail ownership and the automatic approval mechanism: after the visitor submits the three fields, an access request is stored, Supabase sends the link, and the callback consumes the matching request to create the buyer profile and redirect to `/loja`. Supabase remains the system of record; server-only core modules perform validation, throttling and buyer provisioning.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Vitest, Supabase SSR/Auth, `@mypet/core`.

**Spec:** `docs/superpowers/specs/2026-08-28-mypet-pre-acesso-landing-design.md`

## Global Constraints

- Read the applicable Next.js 16 guides under `apps/mypet/node_modules/next/dist/docs/` before changing routes, Route Handlers, Proxy, Server Actions or metadata.
- `/` is public; `/loja` is the authenticated storefront; prices and protected catalog data must never be returned to a non-authenticated request.
- Registration fields are only `cnpj`, `email` and `whatsapp`; no fictitious customer data, testimonials, commercial terms or social proof may be shipped.
- E-mail magic-link confirmation is the automatic approval boundary; do not create a browser session from unverified form input.
- Validate and normalize every untrusted input server-side. Return only stable, generic errors and never log raw CNPJ, e-mail or WhatsApp.
- Use commercial examples only in the typed configuration, never display `placeholder`, `TBD` or `a definir` to a visitor.
- Keep personal data out of analytics events and protect repeated submissions with the database-backed throttle below.
- Preserve unrelated uncommitted files. Make one focused commit per task.

---

## Planned file structure

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/202608280001_pre_access.sql` | Add the pending access-request record and make legacy buyer identity fields optional. |
| `packages/core/src/pre-access.ts` | Shared public types plus client-side API adapter. |
| `packages/core/src/pre-access-server.ts` | Server-only normalization, validation, throttle, request persistence and buyer provisioning. |
| `packages/core/src/pre-access*.test.ts` | Unit coverage for the access boundary. |
| `apps/mypet/app/api/pre-acesso/route.ts` | Public POST endpoint that persists the request and starts magic-link authentication. |
| `apps/mypet/app/entrar/callback/route.ts` | Exchanges the code, provisions a buyer from the pending request and redirects safely to `/loja`. |
| `apps/mypet/app/loja/page.tsx` | Relocated current catalog home, guarded by verified buyer access. |
| `apps/mypet/app/_components/pre-access/*` | Focused landing sections and interactive access form. |
| `apps/mypet/app/pre-access-content.ts` | Typed commercial examples, FAQ and public category copy. |
| `apps/mypet/app/page.tsx` | Public landing composition and metadata. |
| `apps/mypet/proxy.ts` | Session refresh and protection for every `/loja` path. |
| `apps/mypet/app/sitemap.ts`, `apps/mypet/app/robots.ts` | Index only public content and exclude authenticated routes. |

### Task 1: Create the persisted automatic-approval boundary

**Files:**
- Create: `supabase/migrations/202608280001_pre_access.sql`
- Create: `packages/core/src/pre-access-server.ts`
- Create: `packages/core/src/pre-access-server.test.ts`
- Modify: `packages/core/src/buyers-server.ts`
- Modify: `packages/core/src/buyers-server.test.ts`

**Interfaces:**
- Produces `PreAccessInput`, `createPreAccessRequest(input, channel)`, `consumePreAccessRequestForUser(user)`, and `requireBuyer(supabase)` from `pre-access-server.ts`.
- Produces a `Buyer` with `nome` and `empresa` nullable, because the approved form does not collect them.
- Later tasks call `createPreAccessRequest` before sending the magic link and call `consumePreAccessRequestForUser` only after Supabase has verified the e-mail.

- [ ] **Step 1: Add failing unit tests for normalization, validation, throttle and buyer provisioning**

```ts
it("normalizes the three approved fields", () => {
  expect(normalizePreAccessInput({ cnpj: "12.345.678/0001-95", email: " LOJA@EXAMPLE.COM ", whatsapp: "+55 (11) 99999-9999" }))
    .toEqual({ cnpj: "12345678000195", email: "loja@example.com", whatsapp: "5511999999999" });
});

it("rejects an invalid CNPJ before persistence", async () => {
  await expect(createPreAccessRequest({ cnpj: "111", email: "loja@example.com", whatsapp: "5511999999999" }, "mypetbrasil"))
    .rejects.toMatchObject({ code: "INVALID_INPUT" });
});

it("creates a buyer only from a request matching the verified auth e-mail", async () => {
  const result = await consumePreAccessRequestForUser({ id: "user-1", email: "loja@example.com" });
  expect(result).toEqual({ ok: true });
});
```

- [ ] **Step 2: Run the new tests and confirm they fail because the access module does not exist**

Run: `pnpm --filter @mypet/core exec vitest run src/pre-access-server.test.ts`

Expected: FAIL with module-not-found or missing exports.

- [ ] **Step 3: Add the database migration and minimal server module**

```sql
alter table public.buyers alter column nome drop not null;
alter table public.buyers alter column empresa drop not null;

create table public.pre_access_requests (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  cnpj text not null,
  email text not null,
  whatsapp text not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  auth_user_id uuid references auth.users(id),
  unique (channel, email)
);

create index pre_access_requests_recent_lookup
  on public.pre_access_requests (channel, email, created_at desc);
```

```ts
export type PreAccessInput = { cnpj: string; email: string; whatsapp: string };
export type PreAccessErrorCode = "INVALID_INPUT" | "RATE_LIMITED" | "UNAVAILABLE";

export function normalizePreAccessInput(input: PreAccessInput): PreAccessInput {
  return {
    cnpj: input.cnpj.replace(/\D/g, ""),
    email: input.email.trim().toLowerCase(),
    whatsapp: input.whatsapp.replace(/\D/g, ""),
  };
}
```

Implement the standard CNPJ check-digit algorithm; reject e-mail without one `@` and a non-empty domain; accept WhatsApp only when it has 12 or 13 digits beginning with `55`. Query `pre_access_requests` for the same normalized channel/e-mail in the preceding five minutes and throw `RATE_LIMITED` before upserting. Upsert the normalized record, preserving `created_at` only for a new request. During callback, query the pending record by verified `user.email` and channel, insert the nullable-name buyer row with `id`, `email`, `cnpj` and `whatsapp`, then mark the request consumed in the same server-side flow.

- [ ] **Step 4: Apply the migration to the project’s Supabase database and verify its schema**

Run in the Supabase SQL editor against `hub_catalogo`:

```sql
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'buyers'
  and column_name in ('nome', 'empresa');

select to_regclass('public.pre_access_requests');
```

Expected: `nome` and `empresa` are nullable; the table resolves as `pre_access_requests`.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `pnpm --filter @mypet/core exec vitest run src/pre-access-server.test.ts src/buyers-server.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the data-access boundary**

```bash
git add supabase/migrations/202608280001_pre_access.sql packages/core/src/pre-access-server.ts packages/core/src/pre-access-server.test.ts packages/core/src/buyers-server.ts packages/core/src/buyers-server.test.ts
git commit -m "feat: add pre-access buyer provisioning"
```

### Task 2: Expose a safe registration endpoint and complete callback provisioning

**Files:**
- Create: `apps/mypet/app/api/pre-acesso/route.ts`
- Create: `apps/mypet/app/api/pre-acesso/route.test.ts`
- Modify: `packages/core/src/auth-server.ts`
- Modify: `packages/core/src/auth-server.test.ts`
- Modify: `apps/mypet/app/entrar/callback/route.ts`

**Interfaces:**
- Consumes `createPreAccessRequest`, `consumePreAccessRequestForUser`, `safeNextPath` and Supabase `signInWithOtp`.
- Produces `POST /api/pre-acesso` returning `{ ok: true }`, `{ error: { code, message } }` with status 400, 429 or 503, and callback redirect to `/loja`.

- [ ] **Step 1: Write failing route and callback tests**

```ts
it("stores a valid request and sends a magic link with /loja as destination", async () => {
  const res = await POST(fakeRequest({ cnpj: "12345678000195", email: "loja@example.com", whatsapp: "5511999999999" }));
  expect(res.status).toBe(201);
  expect(signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ email: "loja@example.com" }));
});

it("redirects an authenticated pending request to /loja", async () => {
  const res = await GET(fakeRequest("https://app.test/entrar/callback?code=ok&next=%2Floja"));
  expect(res.headers.get("location")).toBe("https://app.test/loja");
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm --filter @mypet/core exec vitest run src/auth-server.test.ts && pnpm --filter mypet exec vitest run app/api/pre-acesso/route.test.ts`

Expected: FAIL because the endpoint and provisioning call are absent.

- [ ] **Step 3: Implement the endpoint and callback contract**

```ts
// app/api/pre-acesso/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const requestRecord = await createPreAccessRequest(body, "mypetbrasil");
  const supabase = createBrowserlessAuthClient();
  const callback = new URL("/entrar/callback", request.nextUrl.origin);
  callback.searchParams.set("next", "/loja");
  await supabase.auth.signInWithOtp({ email: requestRecord.email, options: { emailRedirectTo: callback.toString() } });
  return Response.json({ ok: true }, { status: 201 });
}
```

Keep the Supabase service-role client confined to `pre-access-server.ts`; the route returns neither a database record nor normalized personal data. Map `INVALID_INPUT` to 400, `RATE_LIMITED` to 429 and all unexpected provider/database errors to 503 with the exact visitor message `Não foi possível liberar seu acesso agora. Tente novamente em instantes.`. Update `createAuthCallbackHandler` to use `/loja` as its fallback, call buyer provisioning after `exchangeCodeForSession`, and send a user without a matching pending request to `/entrar?erro=acesso-nao-solicitado` instead of the legacy complete-signup route.

- [ ] **Step 4: Re-run focused tests**

Run: `pnpm --filter @mypet/core exec vitest run src/auth-server.test.ts && pnpm --filter mypet exec vitest run app/api/pre-acesso/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the endpoint and callback changes**

```bash
git add apps/mypet/app/api/pre-acesso apps/mypet/app/entrar/callback/route.ts packages/core/src/auth-server.ts packages/core/src/auth-server.test.ts
git commit -m "feat: add automatic pre-access approval flow"
```

### Task 3: Move and protect the storefront

**Files:**
- Create: `apps/mypet/app/loja/page.tsx`
- Modify: `apps/mypet/proxy.ts`
- Modify: `apps/mypet/app/entrar/page.tsx`
- Modify: `apps/mypet/app/completar-cadastro/page.tsx`
- Modify: `apps/mypet/app/cotacao/page.tsx`
- Modify: `apps/mypet/app/pedidos/page.tsx`

**Interfaces:**
- Consumes `requireBuyer(supabase)` and an authenticated Supabase session.
- Produces a `/loja` home that only renders its catalog after buyer verification, while all protected entry points direct anonymous visitors to `/entrar?next=/loja`.

- [ ] **Step 1: Write the failing access-guard tests**

```ts
it("sends an anonymous /loja request to the login route", async () => {
  const response = await proxy(fakeRequest("https://app.test/loja"));
  expect(response.headers.get("location")).toContain("/entrar?next=%2Floja");
});

it("does not render catalog markup before requireBuyer succeeds", async () => {
  await expect(renderStorefrontWithoutBuyer()).rejects.toMatchObject({ digest: expect.any(String) });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter mypet exec vitest run proxy.test.ts app/loja/page.test.tsx`

Expected: FAIL because `/loja` and the matcher do not exist.

- [ ] **Step 3: Relocate the current catalog home and enforce the buyer check**

Move the current root catalog composition into `app/loja/page.tsx`. At the top of its server component, obtain `createServerSupabaseClient()`, call `requireBuyer`, and `redirect('/entrar?next=/loja')` when it returns false. Replace every root-home-specific link in the moved file with `/loja`-relative destinations. Expand the Proxy matcher to `"/loja/:path*"` and return a redirect for anonymous sessions; retain it only as optimistic routing, with the server page check as the authoritative protection.

```ts
const supabase = await createServerSupabaseClient();
if (!(await requireBuyer(supabase))) {
  redirect("/entrar?next=/loja");
}
```

Change the login and callback fallbacks from `/cotacao` to `/loja`. Redirect the obsolete `/completar-cadastro` route to `/entrar?next=/loja`; it must no longer collect name or company.

- [ ] **Step 4: Run focused tests and a production build**

Run: `pnpm --filter mypet exec vitest run proxy.test.ts app/loja/page.test.tsx && pnpm --filter mypet build`

Expected: PASS and a successful build.

- [ ] **Step 5: Commit the protected store relocation**

```bash
git add apps/mypet/app/loja apps/mypet/proxy.ts apps/mypet/app/entrar apps/mypet/app/completar-cadastro apps/mypet/app/cotacao apps/mypet/app/pedidos
git commit -m "feat: move My Pet storefront to protected loja route"
```

### Task 4: Build the public educational landing and access form

**Files:**
- Create: `apps/mypet/app/pre-access-content.ts`
- Create: `apps/mypet/app/_components/pre-access/hero.tsx`
- Create: `apps/mypet/app/_components/pre-access/commercial-conditions.tsx`
- Create: `apps/mypet/app/_components/pre-access/education-cards.tsx`
- Create: `apps/mypet/app/_components/pre-access/popular-categories.tsx`
- Create: `apps/mypet/app/_components/pre-access/commercial-faq.tsx`
- Create: `apps/mypet/app/_components/pre-access/access-form.tsx`
- Create: `apps/mypet/app/_components/pre-access/access-form.test.tsx`
- Modify: `apps/mypet/app/page.tsx`

**Interfaces:**
- `pre-access-content.ts` exports `commercialConditions`, `educationCards` and `commercialFaq` as immutable public content.
- `AccessForm` POSTs exactly `{ cnpj, email, whatsapp }` to `/api/pre-acesso`, displays generic errors and then an e-mail-link confirmation.
- `page.tsx` imports server-safe content and never imports catalog pricing modules.

- [ ] **Step 1: Write failing client tests for the approved minimal form**

```tsx
it("posts only CNPJ, e-mail and WhatsApp", async () => {
  render(<AccessForm />);
  await user.type(screen.getByLabelText("CNPJ"), "12.345.678/0001-95");
  await user.type(screen.getByLabelText("E-mail"), "loja@example.com");
  await user.type(screen.getByLabelText("WhatsApp"), "(11) 99999-9999");
  await user.click(screen.getByRole("button", { name: "Criar acesso à loja" }));
  expect(fetch).toHaveBeenCalledWith("/api/pre-acesso", expect.objectContaining({ body: JSON.stringify({ cnpj: "12.345.678/0001-95", email: "loja@example.com", whatsapp: "(11) 99999-9999" }) }));
});
```

- [ ] **Step 2: Run the form test and confirm failure**

Run: `pnpm --filter mypet exec vitest run app/_components/pre-access/access-form.test.tsx`

Expected: FAIL because `AccessForm` does not exist.

- [ ] **Step 3: Implement content and focused sections**

```ts
export const commercialConditions = [
  { title: "Pedido mínimo", value: "A partir de R$ 500", detail: "Exemplo de condição comercial" },
  { title: "Desconto por volume", value: "Até 12%", detail: "Exemplo de faixa progressiva" },
  { title: "Entrega", value: "Em até 5 dias úteis", detail: "Exemplo para regiões atendidas" },
] as const;
```

Use semantic `section`, `h1`/`h2`, `button` and `details`/`summary` elements. The hero CTA scrolls to `#condicoes`; the second CTA scrolls to `#criar-acesso`. Cards form a keyboard-scrollable horizontal list on small screens. The form is the only client component; it renders labels, `autoComplete` values (`organization`, `email`, `tel`), an explicit privacy-consent sentence and a success state: `Enviamos um link para seu e-mail. Abra-o para entrar na loja.` Keep WhatsApp as informational support after the FAQ, not a primary CTA.

Compose all sections in the new root `page.tsx`; show real categories from `getCategories()` but no product price or price component. Do not add testimonial cards until approved, attributable content exists; render an institutional trust section instead.

- [ ] **Step 4: Run component tests, lint and local visual review**

Run: `pnpm --filter mypet exec vitest run app/_components/pre-access/access-form.test.tsx && pnpm lint && pnpm dev:mypet`

Expected: tests and lint PASS. Manually verify at `http://localhost:4100` in 375 px and 1440 px widths: hero, three commercial cards, FAQ, keyboard focus, form error and sent-link state.

- [ ] **Step 5: Commit the public landing**

```bash
git add apps/mypet/app/page.tsx apps/mypet/app/pre-access-content.ts apps/mypet/app/_components/pre-access
git commit -m "feat: add My Pet B2B pre-access landing"
```

### Task 5: Finish public metadata, discoverability and regression coverage

**Files:**
- Modify: `apps/mypet/app/layout.tsx`
- Modify: `apps/mypet/app/sitemap.ts`
- Modify: `apps/mypet/app/robots.ts`
- Create: `apps/mypet/app/page.test.tsx`
- Modify: `packages/core/src/auth-server.test.ts`

**Interfaces:**
- Produces landing-specific `Metadata` and a sitemap in which `/` is the public priority URL while `/loja`, access, quote and order routes are absent.

- [ ] **Step 1: Write failing SEO and privacy regression tests**

```ts
it("indexes the public landing but not the protected loja route", async () => {
  const entries = await sitemap();
  expect(entries.map((entry) => entry.url)).toContain("https://mypetbrasil.com.br");
  expect(entries.map((entry) => entry.url)).not.toContain("https://mypetbrasil.com.br/loja");
});

it("does not include catalog product-price UI in public landing output", async () => {
  expect(await renderPublicLanding()).not.toContain("Preço do canal distribuidora");
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run: `pnpm --filter mypet exec vitest run app/page.test.tsx app/sitemap.test.ts`

Expected: FAIL until the public/protected URLs and page assertions are updated.

- [ ] **Step 3: Implement metadata and final guards**

Set the root title and description to mention `atacado para pet shops` and `condições de compra` without inventing metrics. Keep organization JSON-LD only with verifiable organization fields. Mark `/loja`, `/entrar`, `/completar-cadastro`, `/cotacao`, `/pedidos` and `/api/` as disallowed in robots; never add `/loja` to the sitemap. Update callback tests so unsafe `next` values still resolve to `/loja`.

- [ ] **Step 4: Run the complete verification suite**

Run: `pnpm --filter @mypet/core test && pnpm lint && pnpm --filter mypet build`

Expected: all tests, lint and build PASS.

- [ ] **Step 5: Perform the release smoke test**

Verify manually with a test CNPJ/e-mail/WhatsApp:

1. `/` has no protected catalog price in server HTML or loaded public data; the approved public commercial-condition copy remains visible.
2. `/loja` as anonymous redirects to login.
3. A valid form submission creates one pending request and sends a magic link.
4. Opening the link creates one buyer and reaches `/loja`.
5. A second link/open request does not duplicate the buyer.
6. Invalid and rapid duplicate submissions show only the documented generic feedback.

- [ ] **Step 6: Commit the production-readiness pass**

```bash
git add apps/mypet/app/layout.tsx apps/mypet/app/sitemap.ts apps/mypet/app/robots.ts apps/mypet/app/page.test.tsx packages/core/src/auth-server.test.ts
git commit -m "feat: finalize pre-access SEO and safeguards"
```

## Plan self-review

- **Spec coverage:** Tasks 1-2 implement minimal data collection, automatic e-mail-backed approval, validation, throttle and safe errors. Task 3 implements `/loja` and server-side price gating. Task 4 implements the approved guided landing sections, placeholders, FAQ, responsive and accessible form. Task 5 covers metadata, robots, sitemap, privacy regression, build and end-to-end smoke checks.
- **No-placeholder check:** the only commercial values listed are explicitly development examples in the configuration and must be replaced before production. No task defers behavior without a concrete endpoint, type, database table, command or acceptance assertion.
- **Type consistency:** `PreAccessInput` is the sole registration payload across the form, endpoint and server module. Callback provisioning consumes the authenticated Supabase user and redirects through `safeNextPath` with `/loja` as fallback.
