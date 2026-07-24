# Painel administrativo (apps/admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `apps/admin`, um terceiro app Next.js no monorepo com login próprio (Supabase Auth) e três módulos — Clientes (leads), Categorias e Marketing → Banners — cobrindo o spec aprovado em `docs/superpowers/specs/2026-07-17-painel-admin-design.md`.

**Architecture:** Novo app Next.js 16.2.6 conectado ao mesmo Supabase `hub_catalogo` (`hsguyfiyqpuligijcjlw`) já usado por `apps/mypet`/`apps/distribuidora`, compartilhando `packages/core` (tema não é usado aqui — o admin tem sua própria UI simples em Tailwind). Autenticação via `@supabase/ssr` (cookies) com uma tabela `admin_users` própria. Toda mutação passa por Server Actions com validação `zod`; leitura pública de banners/leads-insert continua via Route Handlers/RLS. Lógica pura e testável (guards de exclusão, CSV, slugify, checagem de conflito de banner, chamada à API do Cloudflare Images) fica em módulos isolados testados com Vitest — a mesma separação "orquestração vs. lógica pura" que `catalog.ts`/`catalog-utils.ts` já usa neste repositório.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19.2.4, TypeScript, Tailwind CSS 4 (`@tailwindcss/postcss`, já usado por `mypet`/`distribuidora` mas deixado de lado em favor de estilo inline nas landing pages — aqui usamos as classes utilitárias de fato, por ser uma UI de dados/formulários, não uma página de marketing), `@supabase/supabase-js` + `@supabase/ssr`, `zod`, Vitest, pnpm workspaces. Migrações de schema aplicadas via MCP Supabase (`apply_migration`) no projeto `hsguyfiyqpuligijcjlw`.

## Global Constraints

- Conecta só ao Supabase `hub_catalogo` (`hsguyfiyqpuligijcjlw`). Nunca ao projeto `Clientes` nem a tabelas `app_users`/`marketingos_*` (pertencem a outro sistema).
- Nesta versão customizada do Next.js, middleware chama-se **`proxy.ts`** (função exportada `proxy`, não `middleware`) — confirmado em `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`. Não criar `middleware.ts`.
- Qualquer arquivo que use (direta ou transitivamente, via `@mypet/core`) a diretiva `"use cache"` exige `cacheComponents: true` no `next.config.ts` do app que o importa — confirmado em `node_modules/next/dist/docs/.../use-cache.md`.
- RLS habilitado em toda tabela nova desde a criação (`leads`, `banners`, `admin_users`). Ver políticas exatas em cada task de migração.
- `role` em `admin_users` é armazenado mas não enforced nesta v1 — qualquer usuário autenticado presente em `admin_users` tem acesso completo aos três módulos.
- Server Actions validam entrada com `zod` antes de tocar o Supabase.
- Sem testes de componente React neste repositório (convenção existente) — só lógica pura é testada com Vitest. Fluxos de UI/rota são verificados manualmente com o servidor de dev, um passo explícito por task.
- Toda mutação em `categories` e `banners` chama `revalidateTag("catalog")`/`revalidateTag("banners")` respectivamente, para refletir no site sem esperar `cacheLife("days")` expirar.
- Credenciais (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) só em `.env.local` (não versionado), nunca prefixadas com `NEXT_PUBLIC_`.

---

## Fase 0 — Fundação (`apps/admin` + autenticação)

### Task 1: Scaffold do app `apps/admin`

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/next.config.ts`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/postcss.config.mjs`
- Create: `apps/admin/next-env.d.ts`
- Create: `apps/admin/app/layout.tsx`
- Create: `apps/admin/app/globals.css`
- Create: `apps/admin/app/page.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: app Next.js funcional em `apps/admin`, rodável com `pnpm --filter admin dev`. Usado como base por todas as tasks seguintes.

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "@mypet/core": "workspace:*",
    "@supabase/ssr": "^0.8.0",
    "@supabase/supabase-js": "^2.108.2",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 2: Criar `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@mypet/core"],
};

export default nextConfig;
```

- [ ] **Step 3: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Criar `postcss.config.mjs`**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 5: Criar `next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 6: Criar `app/globals.css`**

```css
@import "tailwindcss";

:root {
  --background: #f8fafc;
  --foreground: #0f172a;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: ui-sans-serif, system-ui, sans-serif;
}
```

- [ ] **Step 7: Criar `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painel administrativo — My Pet Brasil",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Criar `app/page.tsx` (placeholder temporário, substituído na Task 8)**

```tsx
export default function Home() {
  return <p className="p-8 text-slate-600">Painel administrativo em construção.</p>;
}
```

- [ ] **Step 9: Instalar dependências e verificar que o app builda**

Run: `pnpm install`
Expected: instala sem erro, cria `apps/admin/node_modules` (via workspace hoist).

Run: `pnpm --filter admin build`
Expected: build concluído sem erro (rota `/` estática).

- [ ] **Step 10: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): scaffold do app apps/admin"
```

---

### Task 2: `Channel` compartilhado em `packages/core`

**Files:**
- Create: `packages/core/src/channels.ts`
- Test: `packages/core/src/channels.test.ts`
- Modify: `packages/core/package.json`

**Interfaces:**
- Consumes: nada.
- Produces: `CHANNELS: readonly ["mypetbrasil", "distribuidora"]`, `type Channel = "mypetbrasil" | "distribuidora"`, `isChannel(value: unknown): value is Channel` — usados pela Task 11 (`leads-server.ts`), Task 22 (`banners.ts`) e por `apps/admin` (Tasks 14, 23).

- [ ] **Step 1: Escrever o teste falho**

```ts
// packages/core/src/channels.test.ts
import { describe, it, expect } from "vitest";
import { CHANNELS, isChannel } from "./channels";

describe("CHANNELS", () => {
  it("contém exatamente os dois canais de site", () => {
    expect(CHANNELS).toEqual(["mypetbrasil", "distribuidora"]);
  });
});

describe("isChannel", () => {
  it("aceita os canais válidos", () => {
    expect(isChannel("mypetbrasil")).toBe(true);
    expect(isChannel("distribuidora")).toBe(true);
  });

  it("rejeita valores inválidos", () => {
    expect(isChannel("amazon")).toBe(false);
    expect(isChannel("")).toBe(false);
    expect(isChannel(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `pnpm --filter @mypet/core exec vitest run src/channels.test.ts`
Expected: FAIL — `./channels` não existe.

- [ ] **Step 3: Implementar**

```ts
// packages/core/src/channels.ts
export const CHANNELS = ["mypetbrasil", "distribuidora"] as const;

export type Channel = (typeof CHANNELS)[number];

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (CHANNELS as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `pnpm --filter @mypet/core exec vitest run src/channels.test.ts`
Expected: PASS.

- [ ] **Step 5: Expor no `package.json` de `@mypet/core`**

Em `packages/core/package.json`, dentro de `"exports"`, adicione a entrada (mantendo as demais):

```json
"./channels": "./src/channels.ts",
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/channels.ts packages/core/src/channels.test.ts packages/core/package.json
git commit -m "feat(core): adiciona tipo Channel compartilhado"
```

---

### Task 3: Migração — tabela `admin_users`

**Files:**
- Nenhum arquivo local — usa a ferramenta MCP `apply_migration` do Supabase (`project_id: hsguyfiyqpuligijcjlw`).

**Interfaces:**
- Consumes: nada.
- Produces: tabela `public.admin_users(id uuid pk, name text, role text, created_at timestamptz)` com RLS, usada pela Task 5 (`requireAdminSession`) e por toda policy futura que checa `exists (select 1 from admin_users where id = auth.uid())`.

- [ ] **Step 1: Aplicar a migração**

Use a ferramenta MCP Supabase `apply_migration` com `project_id: "hsguyfiyqpuligijcjlw"`, `name: "create_admin_users"` e o SQL:

```sql
create table public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'editor' check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "admin_users_select_self"
  on public.admin_users for select
  to authenticated
  using (id = auth.uid());
```

- [ ] **Step 2: Verificar**

Use a ferramenta MCP Supabase `list_tables` (`project_id: "hsguyfiyqpuligijcjlw"`, `schemas: ["public"]`, `verbose: false`) e confirme que `public.admin_users` aparece na lista com `rls_enabled: true`.

- [ ] **Step 3: Registrar a migração no controle de versão**

Não há pasta `supabase/migrations` neste repositório (as migrações são aplicadas direto via MCP). Documente a migração aplicada anexando o SQL acima ao final de `docs/superpowers/specs/2026-07-17-painel-admin-design.md`, numa nova seção `## Migrações aplicadas`, com data e nome:

```markdown

## Migrações aplicadas

- **2026-07-17 — create_admin_users**: cria `public.admin_users` com RLS (select apenas do próprio registro).
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-17-painel-admin-design.md
git commit -m "docs: registra migracao create_admin_users"
```

---

### Task 4: Bootstrap do primeiro usuário admin

**Files:** nenhum (passo operacional, feito no Supabase Studio + MCP).

**Interfaces:**
- Consumes: tabela `admin_users` da Task 3.
- Produces: um usuário capaz de logar no painel na Task 7.

- [ ] **Step 1: Criar o usuário no Supabase Auth**

No Supabase Studio do projeto `hub_catalogo` (`hsguyfiyqpuligijcjlw`) → **Authentication → Users → Add user**, crie um usuário com o e-mail e senha que o usuário do painel vai usar para logar. Marque "Auto Confirm User" para não depender de e-mail de confirmação.

- [ ] **Step 2: Descobrir o `id` do usuário criado**

Use a ferramenta MCP Supabase `execute_sql` (`project_id: "hsguyfiyqpuligijcjlw"`) com:

```sql
select id, email from auth.users order by created_at desc limit 5;
```

Anote o `id` (uuid) do usuário criado no Step 1.

- [ ] **Step 3: Inserir o perfil em `admin_users`**

Use `execute_sql` com o `id` obtido:

```sql
insert into public.admin_users (id, name, role)
values ('<uuid-do-step-2>', 'Nome do administrador', 'admin');
```

- [ ] **Step 4: Verificar**

```sql
select au.id, au.name, au.role, u.email
from public.admin_users au
join auth.users u on u.id = au.id;
```

Expected: uma linha com o e-mail e nome corretos.

Nenhum commit nesta task — é um passo de dados, não de código.

---

### Task 5: Cliente Supabase autenticado + DAL de sessão

**Files:**
- Create: `apps/admin/lib/supabase-server.ts`
- Create: `apps/admin/lib/auth.ts`
- Create: `apps/admin/.env.local.example`

**Interfaces:**
- Consumes: `SUPABASE_URL`/`SUPABASE_ANON_KEY` (env), tabela `admin_users` (Task 3).
- Produces: `createServerSupabaseClient(): Promise<SupabaseClient>` e `requireAdminSession(): Promise<{ supabase: SupabaseClient; userId: string; name: string; role: "admin" | "editor" }>` (redireciona para `/login` se não autenticado ou não presente em `admin_users`) — usados por todas as tasks de UI/actions daqui em diante (7, 8, 15, 19, 25).

- [ ] **Step 1: Criar `apps/admin/lib/supabase-server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY precisam estar definidos no ambiente.");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado a partir de um Server Component — ignorável, o proxy.ts
          // (Task 6) já cuida de renovar a sessão a cada request.
        }
      },
    },
  });
}
```

- [ ] **Step 2: Criar `apps/admin/lib/auth.ts`**

```ts
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "./supabase-server";

export type AdminSession = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
  name: string;
  role: "admin" | "editor";
};

export const requireAdminSession = cache(async (): Promise<AdminSession> => {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("admin_users")
    .select("name, role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  return {
    supabase,
    userId: user.id,
    name: profile.name,
    role: profile.role as "admin" | "editor",
  };
});
```

- [ ] **Step 3: Criar `apps/admin/.env.local.example`**

```bash
SUPABASE_URL=https://hsguyfiyqpuligijcjlw.supabase.co
SUPABASE_ANON_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/lib/supabase-server.ts apps/admin/lib/auth.ts apps/admin/.env.local.example
git commit -m "feat(admin): cliente Supabase autenticado e DAL de sessao"
```

---

### Task 6: `proxy.ts` protegendo as rotas do admin

**Files:**
- Create: `apps/admin/proxy.ts`

**Interfaces:**
- Consumes: `SUPABASE_URL`/`SUPABASE_ANON_KEY` (env).
- Produces: redireciona qualquer requisição não autenticada para `/login`; deixa `/login` acessível sem sessão.

- [ ] **Step 1: Criar `apps/admin/proxy.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginRoute) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/clientes";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/proxy.ts
git commit -m "feat(admin): protege rotas do painel via proxy.ts"
```

(Verificação end-to-end deste fluxo acontece na Task 9, depois que `/login` existir.)

---

### Task 7: Página e Server Actions de login/logout

**Files:**
- Create: `apps/admin/app/login/page.tsx`
- Create: `apps/admin/app/login/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (Task 5).
- Produces: `login(state, formData)` e `logout()`, usados pela Task 8 (botão de logout no shell).

- [ ] **Step 1: Criar `apps/admin/app/login/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const LoginSchema = z.object({
  email: z.string().email({ message: "Informe um e-mail válido." }),
  password: z.string().min(1, { message: "Informe a senha." }),
});

export type LoginState = { error?: string } | undefined;

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "E-mail ou senha incorretos." };
  }

  redirect("/clientes");
}

export async function logout(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Criar `apps/admin/app/login/page.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form action={formAction} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-bold text-slate-800">Painel administrativo</h1>

        <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />

        <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />

        {state?.error && <p className="mb-4 text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/login
git commit -m "feat(admin): pagina e server actions de login/logout"
```

---

### Task 8: Shell do painel (sidebar + rotas protegidas)

**Files:**
- Create: `apps/admin/app/(dashboard)/layout.tsx`
- Modify: `apps/admin/app/page.tsx`
- Delete: nenhum

**Interfaces:**
- Consumes: `requireAdminSession` (Task 5), `logout` (Task 7).
- Produces: layout com sidebar (Clientes, Categorias, Marketing → Banners) envolvendo todas as rotas de `(dashboard)` — consumido pelas Tasks 15, 19, 25.

- [ ] **Step 1: Criar `apps/admin/app/(dashboard)/layout.tsx`**

```tsx
import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { logout } from "../login/actions";

const NAV = [
  { href: "/clientes", label: "Clientes" },
  { href: "/categorias", label: "Categorias" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white p-4">
        <p className="mb-6 px-2 text-sm font-bold text-slate-800">Painel admin</p>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Marketing
          </div>
          <Link
            href="/marketing/banners"
            className="rounded-lg px-3 py-2 pl-6 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Banners
          </Link>
        </nav>

        <form action={logout} className="mt-8 border-t border-slate-200 pt-4">
          <p className="mb-2 px-2 text-xs text-slate-400">{session.name}</p>
          <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100">
            Sair
          </button>
        </form>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Substituir `apps/admin/app/page.tsx` por um redirect**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/clientes");
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/\(dashboard\)/layout.tsx apps/admin/app/page.tsx
git commit -m "feat(admin): shell do painel com sidebar"
```

---

### Task 9: Verificação manual do fluxo de autenticação

**Files:** nenhum.

- [ ] **Step 1: Preencher `.env.local`**

Copie `apps/admin/.env.local.example` para `apps/admin/.env.local` e preencha `SUPABASE_URL`/`SUPABASE_ANON_KEY` com os valores do projeto `hub_catalogo` (obtidos no Supabase Studio → Project Settings → API).

- [ ] **Step 2: Rodar o servidor de dev**

Run: `pnpm --filter admin dev`

- [ ] **Step 3: Verificar redirecionamento sem sessão**

Acesse `http://localhost:3000/clientes` (ou a porta indicada no terminal) sem estar logado.
Expected: redireciona para `/login`.

- [ ] **Step 4: Verificar login**

Faça login com o e-mail/senha criados na Task 4.
Expected: redireciona para `/clientes` (página ainda não existe até a Task 15 — nesse ponto é esperado um 404 do Next, o que já confirma que passou pela autenticação; se a Task 15 já estiver implementada, confirma a listagem).

- [ ] **Step 5: Verificar logout**

Clique em "Sair" na sidebar.
Expected: redireciona para `/login`, e acessar `/clientes` de novo pede login.

Nenhum commit nesta task — é verificação manual.

---

## Fase 1 — Módulo Clientes (Leads)

### Task 10: Migração — tabela `leads`

**Files:** nenhum arquivo local — MCP Supabase.

**Interfaces:**
- Consumes: tipo `channel_kind` (enum já existente em `hub_catalogo`), `admin_users` (Task 3).
- Produces: tabela `public.leads`, usada pelas Tasks 11 e 14.

- [ ] **Step 1: Aplicar a migração**

`apply_migration` (`project_id: "hsguyfiyqpuligijcjlw"`, `name: "create_leads"`):

```sql
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text not null,
  whatsapp text not null,
  cnpj text,
  channel public.channel_kind not null check (channel in ('mypetbrasil', 'distribuidora')),
  status text not null default 'novo' check (status in ('novo', 'contatado', 'convertido', 'descartado')),
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

create policy "leads_insert_publico"
  on public.leads for insert
  to anon, authenticated
  with check (true);

create policy "leads_select_admin"
  on public.leads for select
  to authenticated
  using (exists (select 1 from public.admin_users where id = auth.uid()));

create policy "leads_update_admin"
  on public.leads for update
  to authenticated
  using (exists (select 1 from public.admin_users where id = auth.uid()))
  with check (exists (select 1 from public.admin_users where id = auth.uid()));
```

- [ ] **Step 2: Verificar**

`list_tables` (`project_id: "hsguyfiyqpuligijcjlw"`) → confirme `public.leads` com `rls_enabled: true`.

- [ ] **Step 3: Registrar e commitar**

Adicione ao `## Migrações aplicadas` do spec:

```markdown
- **2026-07-17 — create_leads**: cria `public.leads` (substitui o Google Sheets), com insert público e select/update restritos a `admin_users`.
```

```bash
git add docs/superpowers/specs/2026-07-17-painel-admin-design.md
git commit -m "docs: registra migracao create_leads"
```

---

### Task 11: Reescrever `leads-server.ts` para gravar no Supabase

**Files:**
- Modify: `packages/core/src/leads-server.ts`
- Create: `packages/core/src/leads-server.test.ts`
- Modify: `packages/core/package.json`

**Interfaces:**
- Consumes: `getHubClient` (`./supabase`), `Channel` (Task 2, `./channels`).
- Produces: `createLeadsPostHandler(channel: Channel): (req: NextRequest) => Promise<Response>` — usado pela Task 12 nas rotas de cada app.

- [ ] **Step 1: Escrever o teste falho**

```ts
// packages/core/src/leads-server.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const insertMock = vi.fn();
const calls: Record<string, unknown> = {};

vi.mock("./supabase", () => ({
  getHubClient: () => ({
    from: (table: string) => {
      calls["from"] = table;
      return { insert: insertMock };
    },
  }),
}));

import { createLeadsPostHandler } from "./leads-server";

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  insertMock.mockReset();
  for (const k of Object.keys(calls)) delete calls[k];
});

describe("createLeadsPostHandler", () => {
  it("grava o lead na tabela leads com o canal do handler", async () => {
    insertMock.mockResolvedValue({ error: null });
    const POST = createLeadsPostHandler("mypetbrasil");

    const res = await POST(fakeRequest({ nome: "João", empresa: "Pet X", whatsapp: "11999999999", cnpj: "" }));

    expect(calls["from"]).toBe("leads");
    expect(insertMock).toHaveBeenCalledWith({
      nome: "João",
      empresa: "Pet X",
      whatsapp: "11999999999",
      cnpj: null,
      channel: "mypetbrasil",
    });
    expect(res.status).toBe(200);
  });

  it("retorna 400 quando falta campo obrigatório", async () => {
    const POST = createLeadsPostHandler("distribuidora");
    const res = await POST(fakeRequest({ nome: "", empresa: "Pet X", whatsapp: "11999999999" }));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("retorna 500 genérico quando o Supabase falha", async () => {
    insertMock.mockResolvedValue({ error: { message: "conexão recusada" } });
    const POST = createLeadsPostHandler("mypetbrasil");
    const res = await POST(fakeRequest({ nome: "João", empresa: "Pet X", whatsapp: "11999999999" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Não foi possível salvar seu cadastro. Tente novamente em instantes.");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `pnpm --filter @mypet/core exec vitest run src/leads-server.test.ts`
Expected: FAIL — `createLeadsPostHandler` não existe (o arquivo hoje só exporta `POST` fixo usando `googleapis`).

- [ ] **Step 3: Reescrever `packages/core/src/leads-server.ts`**

```ts
import { NextRequest } from "next/server";
import { getHubClient } from "./supabase";
import type { Channel } from "./channels";

export function createLeadsPostHandler(channel: Channel) {
  return async function POST(req: NextRequest): Promise<Response> {
    const { nome, empresa, whatsapp, cnpj } = await req.json();

    if (!nome || !empresa || !whatsapp) {
      return Response.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const supabase = getHubClient();
    const { error } = await supabase.from("leads").insert({
      nome,
      empresa,
      whatsapp,
      cnpj: cnpj || null,
      channel,
    });

    if (error) {
      console.error("[leads] erro ao gravar lead:", error.message);
      return Response.json(
        { error: "Não foi possível salvar seu cadastro. Tente novamente em instantes." },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  };
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `pnpm --filter @mypet/core exec vitest run src/leads-server.test.ts`
Expected: PASS.

- [ ] **Step 5: Remover `googleapis` de `packages/core/package.json`**

Em `packages/core/package.json`, remova a linha `"googleapis": "^173.0.0",` do bloco `dependencies`.

Run: `pnpm install`
Expected: reconcile o lockfile sem erro.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/leads-server.ts packages/core/src/leads-server.test.ts packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): leads-server grava no Supabase em vez do Google Sheets"
```

---

### Task 12: Atualizar as rotas `/api/leads` de cada app

**Files:**
- Modify: `apps/mypet/app/api/leads/route.ts`
- Modify: `apps/distribuidora/app/api/leads/route.ts`

**Interfaces:**
- Consumes: `createLeadsPostHandler` (Task 11), `clientConfig.catalogChannel` (já existente em cada `client.config.ts`).
- Produces: `POST` de cada app gravando com o canal correto.

- [ ] **Step 1: Atualizar `apps/mypet/app/api/leads/route.ts`**

Substitua o conteúdo inteiro por:

```ts
import { createLeadsPostHandler } from "@mypet/core/leads-server";
import type { Channel } from "@mypet/core/channels";
import { clientConfig } from "@/client.config";

export const POST = createLeadsPostHandler(clientConfig.catalogChannel as Channel);
```

- [ ] **Step 2: Atualizar `apps/distribuidora/app/api/leads/route.ts`** (mesmo conteúdo, mesmo import relativo `@/client.config` — cada app resolve para o seu próprio arquivo)

```ts
import { createLeadsPostHandler } from "@mypet/core/leads-server";
import type { Channel } from "@mypet/core/channels";
import { clientConfig } from "@/client.config";

export const POST = createLeadsPostHandler(clientConfig.catalogChannel as Channel);
```

- [ ] **Step 3: Expor `./channels` também para os apps públicos**

Confirme que `packages/core/package.json` já tem `"./channels": "./src/channels.ts"` no `exports` (adicionado na Task 2) — nenhuma mudança adicional necessária.

- [ ] **Step 4: Build de sanidade**

Run: `pnpm --filter mypet build && pnpm --filter distribuidora build`
Expected: ambos buildam sem erro de tipo.

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/api/leads/route.ts apps/distribuidora/app/api/leads/route.ts
git commit -m "feat: rotas de leads passam o canal do site para o handler"
```

---

### Task 13: Remover variáveis de ambiente do Google Sheets do fluxo de leads

**Files:**
- Modify: `ARCHITECTURE.md`

**Interfaces:** nenhuma (limpeza de documentação).

- [ ] **Step 1: Atualizar `ARCHITECTURE.md` §1.1**

Em `ARCHITECTURE.md`, na lista de variáveis de ambiente por app (linha ~30-33), remova `GOOGLE_CREDENTIALS`, `GOOGLE_SHEET_ID` da lista (não são mais usadas por nenhum fluxo deste repositório após a Task 11) e adicione `SUPABASE_URL`, `SUPABASE_ANON_KEY` explicitamente caso ainda não estejam claros o suficiente — a linha já os lista, então confirme apenas a remoção das duas variáveis do Google.

Troque:

```markdown
Variáveis de ambiente por app (`.env.local`, não versionado):
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER`,
`GOOGLE_CREDENTIALS`, `GOOGLE_SHEET_ID`, `AI_PROVIDER`, `AI_MODEL`,
e as credenciais do provedor de IA escolhido:
```

por:

```markdown
Variáveis de ambiente por app (`.env.local`, não versionado):
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER`,
`AI_PROVIDER`, `AI_MODEL`, e as credenciais do provedor de IA escolhido:
```

- [ ] **Step 2: Atualizar a seção 3.2 (Cadastro do lead) e 7 (Google Sheets)**

Na seção `### 3.2 Cadastro do lead`, troque o passo 5-6:

```markdown
5. O servidor lê as credenciais do ambiente e cria um cliente Google.
6. O lead é anexado a `Leads!A:E`.
```

por:

```markdown
5. O servidor grava o lead na tabela `leads` do Supabase `hub_catalogo`, com o
   canal (`mypetbrasil`/`distribuidora`) resolvido a partir do `client.config.ts`
   do app, nunca enviado pelo navegador.
6. O painel administrativo (`apps/admin`) é a fonte de verdade para acompanhar
   e atualizar o status desses leads.
```

Na seção `### Google Sheets` (§7), adicione uma nota ao final indicando que essa integração foi descontinuada para leads:

```markdown

> **Atualizado em 2026-07-17:** o fluxo de leads não usa mais o Google Sheets —
> grava direto na tabela `leads` do Supabase `hub_catalogo`. Esta seção
> permanece como referência histórica.
```

- [ ] **Step 3: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: atualiza ARCHITECTURE.md apos migracao de leads para o Supabase"
```

---

### Task 14: Lógica pura do módulo Clientes no admin (`apps/admin/lib/leads.ts`)

**Files:**
- Create: `apps/admin/lib/leads.ts`
- Test: `apps/admin/lib/leads.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores (funções puras, recebem dados já carregados).
- Produces: `LEAD_STATUSES`, `type LeadStatus`, `leadsToCsv(leads: LeadRow[]): string` — usados pela Task 15.

- [ ] **Step 1: Escrever o teste falho**

```ts
// apps/admin/lib/leads.test.ts
import { describe, it, expect } from "vitest";
import { leadsToCsv, LEAD_STATUSES } from "./leads";

describe("LEAD_STATUSES", () => {
  it("lista os quatro status válidos", () => {
    expect(LEAD_STATUSES).toEqual(["novo", "contatado", "convertido", "descartado"]);
  });
});

describe("leadsToCsv", () => {
  it("gera um CSV com cabeçalho e uma linha por lead", () => {
    const csv = leadsToCsv([
      {
        id: "1",
        nome: "João",
        empresa: "Pet X",
        whatsapp: "11999999999",
        cnpj: null,
        channel: "mypetbrasil",
        status: "novo",
        created_at: "2026-07-17T10:00:00Z",
      },
    ]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("data,nome,empresa,whatsapp,cnpj,canal,status");
    expect(lines[1]).toBe("2026-07-17T10:00:00Z,João,Pet X,11999999999,,mypetbrasil,novo");
  });

  it("escapa vírgulas e aspas nos campos", () => {
    const csv = leadsToCsv([
      {
        id: "1",
        nome: "Pet Shop, Ração e Cia",
        empresa: 'A "Melhor" Loja',
        whatsapp: "11999999999",
        cnpj: null,
        channel: "distribuidora",
        status: "novo",
        created_at: "2026-07-17T10:00:00Z",
      },
    ]);
    const lines = csv.trim().split("\n");
    expect(lines[1]).toBe(
      '2026-07-17T10:00:00Z,"Pet Shop, Ração e Cia","A ""Melhor"" Loja",11999999999,,distribuidora,novo',
    );
  });

  it("retorna só o cabeçalho para lista vazia", () => {
    expect(leadsToCsv([]).trim()).toBe("data,nome,empresa,whatsapp,cnpj,canal,status");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `pnpm --filter admin exec vitest run lib/leads.test.ts`
Expected: FAIL — `./leads` não existe.

- [ ] **Step 3: Implementar `apps/admin/lib/leads.ts`**

```ts
export const LEAD_STATUSES = ["novo", "contatado", "convertido", "descartado"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type LeadRow = {
  id: string;
  nome: string;
  empresa: string;
  whatsapp: string;
  cnpj: string | null;
  channel: string;
  status: LeadStatus;
  created_at: string;
};

function csvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function leadsToCsv(leads: LeadRow[]): string {
  const header = "data,nome,empresa,whatsapp,cnpj,canal,status";
  const rows = leads.map((l) =>
    [l.created_at, l.nome, l.empresa, l.whatsapp, l.cnpj ?? "", l.channel, l.status]
      .map(csvField)
      .join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `pnpm --filter admin exec vitest run lib/leads.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/leads.ts apps/admin/lib/leads.test.ts
git commit -m "feat(admin): logica pura do modulo Clientes (status, CSV)"
```

---

### Task 15: Tela `/clientes` (listagem, filtros, mudança de status, exportação)

**Files:**
- Create: `apps/admin/app/(dashboard)/clientes/page.tsx`
- Create: `apps/admin/app/(dashboard)/clientes/actions.ts`
- Create: `apps/admin/app/(dashboard)/clientes/status-select.tsx`
- Create: `apps/admin/app/(dashboard)/clientes/export/route.ts`

**Interfaces:**
- Consumes: `requireAdminSession` (Task 5), `LEAD_STATUSES`, `LeadStatus`, `LeadRow`, `leadsToCsv` (Task 14).
- Produces: rota `/clientes` funcional.

- [ ] **Step 1: Criar `apps/admin/app/(dashboard)/clientes/actions.ts`**

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { LEAD_STATUSES } from "@/lib/leads";

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(LEAD_STATUSES),
});

export async function updateLeadStatus(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = UpdateStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) return;

  const { error } = await supabase
    .from("leads")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("[admin/clientes] erro ao atualizar status:", error.message);
    return;
  }

  revalidatePath("/clientes");
}
```

- [ ] **Step 2: Criar `apps/admin/app/(dashboard)/clientes/status-select.tsx`**

`<select>` com auto-submit via `onChange` precisa ser um Client Component — Server Components não podem passar event handlers para nenhum elemento da árvore que retornam, nem para tags HTML nativas. `updateLeadStatus` (Server Action) chega como prop normalmente, já que Server Actions são serializáveis através da fronteira servidor/cliente.

```tsx
"use client";

import type { LeadStatus } from "@/lib/leads";
import { LEAD_STATUSES } from "@/lib/leads";

export function StatusSelect({
  leadId,
  currentStatus,
  action,
}: {
  leadId: string;
  currentStatus: LeadStatus;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={leadId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </form>
  );
}
```

- [ ] **Step 3: Criar `apps/admin/app/(dashboard)/clientes/page.tsx`**

```tsx
import { requireAdminSession } from "@/lib/auth";
import { LEAD_STATUSES, type LeadRow } from "@/lib/leads";
import { updateLeadStatus } from "./actions";
import { StatusSelect } from "./status-select";

const CHANNEL_LABEL: Record<string, string> = {
  mypetbrasil: "My Pet Brasil",
  distribuidora: "Distribuidora",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { channel, status } = await searchParams;

  let query = supabase
    .from("leads")
    .select("id, nome, empresa, whatsapp, cnpj, channel, status, created_at")
    .order("created_at", { ascending: false });

  if (channel) query = query.eq("channel", channel);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  const leads = (data ?? []) as LeadRow[];

  const exportHref = `/clientes/export${channel || status ? "?" : ""}${[
    channel ? `channel=${channel}` : "",
    status ? `status=${status}` : "",
  ]
    .filter(Boolean)
    .join("&")}`;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Clientes</h1>
        <a
          href={exportHref}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Exportar CSV
        </a>
      </div>

      <form method="get" className="mb-4 flex gap-3">
        <select name="channel" defaultValue={channel ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os canais</option>
          <option value="mypetbrasil">My Pet Brasil</option>
          <option value="distribuidora">Distribuidora</option>
        </select>
        <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Filtrar
        </button>
      </form>

      {error && <p className="text-sm text-red-600">Erro ao carregar clientes: {error.message}</p>}

      <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Empresa</th>
            <th className="px-4 py-3">WhatsApp</th>
            <th className="px-4 py-3">Canal</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Data</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-slate-100">
              <td className="px-4 py-3">{lead.nome}</td>
              <td className="px-4 py-3">{lead.empresa}</td>
              <td className="px-4 py-3">{lead.whatsapp}</td>
              <td className="px-4 py-3">{CHANNEL_LABEL[lead.channel] ?? lead.channel}</td>
              <td className="px-4 py-3">
                <StatusSelect leadId={lead.id} currentStatus={lead.status} action={updateLeadStatus} />
              </td>
              <td className="px-4 py-3 text-slate-500">
                {new Date(lead.created_at).toLocaleString("pt-BR")}
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                Nenhum cliente encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Criar `apps/admin/app/(dashboard)/clientes/export/route.ts`**

```ts
import { requireAdminSession } from "@/lib/auth";
import { leadsToCsv, type LeadRow } from "@/lib/leads";

export async function GET(req: Request): Promise<Response> {
  const { supabase } = await requireAdminSession();
  const url = new URL(req.url);
  const channel = url.searchParams.get("channel");
  const status = url.searchParams.get("status");

  let query = supabase
    .from("leads")
    .select("id, nome, empresa, whatsapp, cnpj, channel, status, created_at")
    .order("created_at", { ascending: false });

  if (channel) query = query.eq("channel", channel);
  if (status) query = query.eq("status", status);

  const { data } = await query;
  const csv = leadsToCsv((data ?? []) as LeadRow[]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leads.csv"',
    },
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/\(dashboard\)/clientes
git commit -m "feat(admin): tela de Clientes com filtros, status inline e export CSV"
```

---

### Task 16: Verificação manual do módulo Clientes

**Files:** nenhum.

- [ ] **Step 1: Enviar um lead pelo site**

Rode `pnpm --filter mypet dev` e submeta o formulário de lead-gate na home.
Expected: sucesso, sem erro no console do navegador.

- [ ] **Step 2: Confirmar no Supabase**

`execute_sql` (`project_id: "hsguyfiyqpuligijcjlw"`): `select * from public.leads order by created_at desc limit 1;`
Expected: uma linha com `channel = 'mypetbrasil'` e os dados enviados.

- [ ] **Step 3: Ver no admin**

Rode `pnpm --filter admin dev`, acesse `/clientes` logado.
Expected: o lead enviado aparece na listagem.

- [ ] **Step 4: Mudar status e filtrar**

Troque o status do lead pelo `<select>` da linha; confirme que persiste ao recarregar a página. Filtre por canal `distribuidora` e confirme que a lista fica vazia (nenhum lead desse canal ainda).

- [ ] **Step 5: Exportar CSV**

Clique em "Exportar CSV".
Expected: baixa `leads.csv` com cabeçalho `data,nome,empresa,whatsapp,cnpj,canal,status` e a linha do lead de teste.

Nenhum commit — verificação manual.

---

## Fase 2 — Módulo Categorias

### Task 17: Lógica pura do módulo Categorias (`apps/admin/lib/categories.ts`)

**Files:**
- Create: `apps/admin/lib/categories.ts`
- Test: `apps/admin/lib/categories.test.ts`

**Interfaces:**
- Consumes: `CategoryNode` (`@mypet/core/catalog-utils`).
- Produces: `slugify(input: string): string`, `canDeleteCategory(categoryId, categories, productCountByCategory): { allowed: boolean; reason?: string }`, `flattenForSelect(tree: CategoryTreeNode[]): { id: string; label: string }[]`, `isDuplicateSlugError(error: { code?: string } | null): boolean` — usados pela Task 19.

- [ ] **Step 1: Escrever o teste falho**

```ts
// apps/admin/lib/categories.test.ts
import { describe, it, expect } from "vitest";
import { slugify, canDeleteCategory, flattenForSelect, isDuplicateSlugError } from "./categories";
import { buildCategoryTree, type CategoryNode } from "@mypet/core/catalog-utils";

describe("slugify", () => {
  it("normaliza acentos, espaços e maiúsculas", () => {
    expect(slugify("Ração & Petiscos")).toBe("racao-petiscos");
    expect(slugify("  Higiene  ")).toBe("higiene");
  });
});

describe("canDeleteCategory", () => {
  const categories: { id: string; parentId: string | null }[] = [
    { id: "c1", parentId: null },
    { id: "c2", parentId: "c1" },
  ];

  it("bloqueia quando há subcategoria filha", () => {
    const result = canDeleteCategory("c1", categories, new Map());
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/subcategorias/);
  });

  it("bloqueia quando há produtos vinculados", () => {
    const result = canDeleteCategory("c2", categories, new Map([["c2", 3]]));
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/3 produto/);
  });

  it("permite quando não há filhos nem produtos", () => {
    const result = canDeleteCategory("c2", categories, new Map());
    expect(result).toEqual({ allowed: true });
  });
});

describe("flattenForSelect", () => {
  it("indenta filhos por nível na label", () => {
    const nodes: CategoryNode[] = [
      { id: "c1", parentId: null, slug: "caes", name: "Cães", level: 1 },
      { id: "c2", parentId: "c1", slug: "caes-racao", name: "Ração", level: 2 },
    ];
    const tree = buildCategoryTree(nodes);
    expect(flattenForSelect(tree)).toEqual([
      { id: "c1", label: "Cães" },
      { id: "c2", label: "— Ração" },
    ]);
  });
});

describe("isDuplicateSlugError", () => {
  it("reconhece o código de violação de unicidade do Postgres", () => {
    expect(isDuplicateSlugError({ code: "23505" })).toBe(true);
  });

  it("retorna false para outros erros ou ausência de erro", () => {
    expect(isDuplicateSlugError({ code: "23503" })).toBe(false);
    expect(isDuplicateSlugError(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `pnpm --filter admin exec vitest run lib/categories.test.ts`
Expected: FAIL — `./categories` não existe.

- [ ] **Step 3: Implementar `apps/admin/lib/categories.ts`**

```ts
import type { CategoryTreeNode } from "@mypet/core/catalog-utils";

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function canDeleteCategory(
  categoryId: string,
  categories: { id: string; parentId: string | null }[],
  productCountByCategory: Map<string, number>,
): { allowed: boolean; reason?: string } {
  const hasChildren = categories.some((c) => c.parentId === categoryId);
  if (hasChildren) {
    return { allowed: false, reason: "Categoria tem subcategorias vinculadas." };
  }
  const productCount = productCountByCategory.get(categoryId) ?? 0;
  if (productCount > 0) {
    return { allowed: false, reason: `Categoria tem ${productCount} produto(s) vinculado(s).` };
  }
  return { allowed: true };
}

export function flattenForSelect(
  tree: CategoryTreeNode[],
  depth = 0,
): { id: string; label: string }[] {
  const prefix = depth === 0 ? "" : "— ".repeat(depth);
  return tree.flatMap((node) => [
    { id: node.id, label: `${prefix}${node.name}` },
    ...flattenForSelect(node.children, depth + 1),
  ]);
}

export function isDuplicateSlugError(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `pnpm --filter admin exec vitest run lib/categories.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/categories.ts apps/admin/lib/categories.test.ts
git commit -m "feat(admin): logica pura do modulo Categorias (slug, guarda de exclusao)"
```

---

### Task 18: Migração — política de escrita de admin em `categories`

**Files:** nenhum arquivo local — MCP Supabase.

**Interfaces:**
- Consumes: `admin_users` (Task 3).
- Produces: permissão de insert/update/delete para admins na tabela `categories` já existente.

- [ ] **Step 1: Checar policies existentes (informativo)**

`execute_sql` (`project_id: "hsguyfiyqpuligijcjlw"`): `select policyname, cmd from pg_policies where tablename = 'categories';`
Anote os nomes existentes para evitar colisão de nome na próxima etapa.

- [ ] **Step 2: Aplicar a migração**

`apply_migration` (`name: "categories_admin_write_policy"`):

```sql
create policy "categories_admin_write"
  on public.categories for all
  to authenticated
  using (exists (select 1 from public.admin_users where id = auth.uid()))
  with check (exists (select 1 from public.admin_users where id = auth.uid()));
```

- [ ] **Step 3: Verificar**

`execute_sql`: `select policyname, cmd from pg_policies where tablename = 'categories';`
Expected: `categories_admin_write` aparece na lista.

- [ ] **Step 4: Registrar e commitar**

```markdown
- **2026-07-17 — categories_admin_write_policy**: permite insert/update/delete em `public.categories` para usuários em `admin_users` (select público pré-existente não foi alterado).
```

```bash
git add docs/superpowers/specs/2026-07-17-painel-admin-design.md
git commit -m "docs: registra migracao categories_admin_write_policy"
```

---

### Task 19: Telas `/categorias` (listar árvore, criar, editar, excluir)

**Files:**
- Create: `apps/admin/app/(dashboard)/categorias/page.tsx`
- Create: `apps/admin/app/(dashboard)/categorias/actions.ts`
- Create: `apps/admin/app/(dashboard)/categorias/[id]/page.tsx`

**Interfaces:**
- Consumes: `getCategories` (`@mypet/core/catalog`), `buildCategoryTree` (`@mypet/core/catalog-utils`), `slugify`, `canDeleteCategory`, `flattenForSelect` (Task 17), `requireAdminSession` (Task 5).
- Produces: CRUD completo de categorias.

- [ ] **Step 1: Criar `apps/admin/app/(dashboard)/categorias/actions.ts`**

```ts
"use server";

import { z } from "zod";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { slugify, canDeleteCategory, isDuplicateSlugError } from "@/lib/categories";

const UpsertSchema = z.object({
  name: z.string().min(1, "Informe o nome."),
  slug: z.string().min(1, "Informe o slug."),
  parentId: z.string().uuid().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});

function levelFromParent(parentLevel: number | null): number {
  return (parentLevel ?? 0) + 1;
}

export async function createCategory(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();

  const rawParentId = formData.get("parentId");
  const parsed = UpsertSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || slugify(String(formData.get("name") ?? "")),
    parentId: rawParentId ? String(rawParentId) : null,
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) return;

  let level = 1;
  if (parsed.data.parentId) {
    const { data: parent } = await supabase
      .from("categories")
      .select("level")
      .eq("id", parsed.data.parentId)
      .single();
    level = levelFromParent(parent?.level ?? null);
  }

  const { error } = await supabase.from("categories").insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    parent_id: parsed.data.parentId,
    level,
    sort_order: parsed.data.sortOrder,
  });

  if (error) {
    if (isDuplicateSlugError(error)) {
      redirect("/categorias?error=slug_duplicado");
    }
    console.error("[admin/categorias] erro ao criar categoria:", error.message);
    redirect("/categorias?error=falha_ao_salvar");
  }

  revalidateTag("catalog");
  redirect("/categorias");
}

export async function updateCategory(id: string, formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();

  const rawParentId = formData.get("parentId");
  const parsed = UpsertSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    parentId: rawParentId ? String(rawParentId) : null,
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) return;

  let level = 1;
  if (parsed.data.parentId) {
    const { data: parent } = await supabase
      .from("categories")
      .select("level")
      .eq("id", parsed.data.parentId)
      .single();
    level = levelFromParent(parent?.level ?? null);
  }

  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      parent_id: parsed.data.parentId,
      level,
      sort_order: parsed.data.sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (isDuplicateSlugError(error)) {
      redirect(`/categorias/${id}?error=slug_duplicado`);
    }
    console.error("[admin/categorias] erro ao editar categoria:", error.message);
    redirect(`/categorias/${id}?error=falha_ao_salvar`);
  }

  revalidateTag("catalog");
  redirect("/categorias");
}

export async function deleteCategory(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: categories } = await supabase.from("categories").select("id, parent_id");
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  const guard = canDeleteCategory(
    id,
    (categories ?? []).map((c) => ({ id: c.id, parentId: c.parent_id })),
    new Map([[id, count ?? 0]]),
  );

  if (!guard.allowed) {
    console.warn("[admin/categorias] exclusão bloqueada:", guard.reason);
    return;
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    console.error("[admin/categorias] erro ao excluir categoria:", error.message);
    return;
  }

  revalidateTag("catalog");
}
```

- [ ] **Step 2: Criar `apps/admin/app/(dashboard)/categorias/page.tsx`**

```tsx
import Link from "next/link";
import { getCategories } from "@mypet/core/catalog";
import { buildCategoryTree, type CategoryTreeNode } from "@mypet/core/catalog-utils";
import { requireAdminSession } from "@/lib/auth";
import { flattenForSelect, canDeleteCategory } from "@/lib/categories";
import { createCategory, deleteCategory } from "./actions";

function TreeRows({ nodes, depth = 0 }: { nodes: CategoryTreeNode[]; depth?: number }) {
  return (
    <>
      {nodes.map((node) => (
        <>
          <tr key={node.id} className="border-b border-slate-100">
            <td className="px-4 py-3" style={{ paddingLeft: 16 + depth * 20 }}>{node.name}</td>
            <td className="px-4 py-3 text-slate-500">{node.slug}</td>
            <td className="px-4 py-3">
              <Link href={`/categorias/${node.id}`} className="text-sm font-semibold text-slate-700 underline">
                Editar
              </Link>
            </td>
            <td className="px-4 py-3">
              <DeleteButton id={node.id} hasChildren={node.children.length > 0} />
            </td>
          </tr>
          <TreeRows nodes={node.children} depth={depth + 1} />
        </>
      ))}
    </>
  );
}

function DeleteButton({ id, hasChildren }: { id: string; hasChildren: boolean }) {
  const guard = canDeleteCategory(id, hasChildren ? [{ id: "child", parentId: id }] : [], new Map());
  return (
    <form action={deleteCategory}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={!guard.allowed}
        title={guard.reason ?? undefined}
        className="rounded-lg px-3 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
      >
        Excluir
      </button>
    </form>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  slug_duplicado: "Já existe uma categoria com esse slug. Escolha outro.",
  falha_ao_salvar: "Não foi possível salvar a categoria. Tente novamente.",
};

export default async function CategoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminSession();
  const { error } = await searchParams;
  const categories = await getCategories();
  const tree = buildCategoryTree(categories);
  const options = flattenForSelect(tree);

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Categorias</h1>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={createCategory} className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nome</label>
          <input name="name" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug (opcional)</label>
          <input name="slug" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Categoria pai</label>
          <select name="parentId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">— nenhuma (nível 1) —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
          <input name="sortOrder" type="number" defaultValue={0} className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Criar categoria
        </button>
      </form>

      <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3"></th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <TreeRows nodes={tree} />
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Criar `apps/admin/app/(dashboard)/categorias/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getCategories } from "@mypet/core/catalog";
import { buildCategoryTree } from "@mypet/core/catalog-utils";
import { requireAdminSession } from "@/lib/auth";
import { flattenForSelect } from "@/lib/categories";
import { updateCategory } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  slug_duplicado: "Já existe uma categoria com esse slug. Escolha outro.",
  falha_ao_salvar: "Não foi possível salvar a categoria. Tente novamente.",
};

export default async function EditCategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const { error } = await searchParams;
  const categories = await getCategories();
  const node = categories.find((c) => c.id === id);
  if (!node) notFound();

  const tree = buildCategoryTree(categories);
  const options = flattenForSelect(tree).filter((o) => o.id !== id);
  const updateWithId = updateCategory.bind(null, id);

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-xl font-bold text-slate-800">Editar categoria</h1>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={updateWithId} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nome</label>
          <input name="name" defaultValue={node.name} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug</label>
          <input name="slug" defaultValue={node.slug} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Categoria pai</label>
          <select name="parentId" defaultValue={node.parentId ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">— nenhuma (nível 1) —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
          <input name="sortOrder" type="number" defaultValue={0} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Salvar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/\(dashboard\)/categorias
git commit -m "feat(admin): CRUD de categorias com guarda de exclusao"
```

---

### Task 20: Verificação manual do módulo Categorias

**Files:** nenhum.

- [ ] **Step 1: Criar categoria de teste**

No admin, acesse `/categorias`, crie uma categoria nível 1 "Categoria Teste".
Expected: aparece na árvore.

- [ ] **Step 2: Criar subcategoria**

Crie outra categoria com "Categoria Teste" como pai.
Expected: aparece indentada abaixo dela.

- [ ] **Step 3: Confirmar bloqueio de exclusão**

Tente excluir "Categoria Teste" (tem filho).
Expected: botão "Excluir" desabilitado com tooltip explicando o motivo.

- [ ] **Step 3.1: Confirmar aviso de slug duplicado**

Tente criar uma nova categoria usando o mesmo slug de "Categoria Teste".
Expected: volta para `/categorias` com a mensagem "Já existe uma categoria com esse slug. Escolha outro." — a categoria duplicada não é criada.

- [ ] **Step 4: Excluir a subárvore de baixo pra cima**

Exclua a subcategoria primeiro, depois "Categoria Teste".
Expected: ambas somem da árvore.

- [ ] **Step 5: Confirmar reflexo no site**

Acesse a home do `apps/mypet` (dev) e confirme, via mega menu, que a estrutura de categorias real (não a de teste, já excluída) continua intacta e responde às mudanças de nome/ordem feitas em categorias reais, se testadas.

Nenhum commit — verificação manual.

---

## Fase 3 — Módulo Marketing → Banners

### Task 21: Migração — tabela `banners`

**Files:** nenhum arquivo local — MCP Supabase.

**Interfaces:**
- Consumes: `channel_kind` (enum existente), `categories` (existente), `admin_users` (Task 3).
- Produces: `public.banners`, usada pelas Tasks 22, 23, 25.

- [ ] **Step 1: Aplicar a migração**

`apply_migration` (`name: "create_banners"`):

```sql
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('principal', 'mini', 'categoria')),
  channel public.channel_kind not null check (channel in ('mypetbrasil', 'distribuidora')),
  category_id uuid references public.categories(id) on delete cascade,
  image_url text not null,
  link_url text,
  title text,
  sort_order integer not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint banners_categoria_requires_category
    check (type <> 'categoria' or category_id is not null)
);

alter table public.banners enable row level security;

create policy "banners_select_publico"
  on public.banners for select
  to anon, authenticated
  using (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

create policy "banners_admin_all"
  on public.banners for all
  to authenticated
  using (exists (select 1 from public.admin_users where id = auth.uid()))
  with check (exists (select 1 from public.admin_users where id = auth.uid()));
```

- [ ] **Step 2: Verificar**

`list_tables` → confirme `public.banners` com `rls_enabled: true`.

- [ ] **Step 3: Registrar e commitar**

```markdown
- **2026-07-17 — create_banners**: cria `public.banners` (principal/mini/categoria, por canal), select público restrito a banners ativos e dentro da janela de agendamento, escrita restrita a `admin_users`.
```

```bash
git add docs/superpowers/specs/2026-07-17-painel-admin-design.md
git commit -m "docs: registra migracao create_banners"
```

---

### Task 22: Leitura pública de banners (`packages/core/src/banners.ts`)

**Files:**
- Create: `packages/core/src/banners.ts`
- Test: `packages/core/src/banners.test.ts`
- Modify: `packages/core/package.json`

**Interfaces:**
- Consumes: `getHubClient` (`./supabase`), `Channel` (`./channels`).
- Produces: `type Banner`, `getBanners(channel: Channel, type: "principal" | "mini" | "categoria", categoryId?: string): Promise<Banner[]>` — usado pelas Tasks 26 e 27.

- [ ] **Step 1: Escrever o teste falho**

```ts
// packages/core/src/banners.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
}));

const calls: Record<string, unknown> = {};

vi.mock("./supabase", () => {
  return {
    getHubClient: () => {
      const builder: Record<string, unknown> = {};
      const chain = (name: string) => (...args: unknown[]) => {
        calls[name] = args;
        return builder;
      };
      builder.select = chain("select");
      builder.eq = (...args: unknown[]) => {
        calls["eq"] = [...((calls["eq"] as unknown[][] | undefined) ?? []), args];
        return builder;
      };
      builder.order = chain("order");
      builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) => {
        resolve({
          data: [
            { id: "b1", type: "principal", image_url: "https://img/banner1", link_url: "/promo", title: "Promo", sort_order: 0 },
          ],
          error: null,
        });
      };
      return { from: chain("from") };
    },
  };
});

import { getBanners } from "./banners";

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
});

describe("getBanners", () => {
  it("filtra por canal e tipo, mapeando snake_case para camelCase", async () => {
    const result = await getBanners("mypetbrasil", "principal");
    expect(calls["from"]).toEqual(["banners"]);
    expect(calls["eq"]).toContainEqual(["channel", "mypetbrasil"]);
    expect(calls["eq"]).toContainEqual(["type", "principal"]);
    expect(result).toEqual([
      { id: "b1", type: "principal", imageUrl: "https://img/banner1", linkUrl: "/promo", title: "Promo", sortOrder: 0 },
    ]);
  });

  it("retorna lista vazia para type=categoria sem categoryId", async () => {
    const result = await getBanners("mypetbrasil", "categoria");
    expect(result).toEqual([]);
  });

  it("filtra também por category_id quando type=categoria", async () => {
    await getBanners("distribuidora", "categoria", "cat-9");
    expect(calls["eq"]).toContainEqual(["category_id", "cat-9"]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `pnpm --filter @mypet/core exec vitest run src/banners.test.ts`
Expected: FAIL — `./banners` não existe.

- [ ] **Step 3: Implementar `packages/core/src/banners.ts`**

```ts
import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import type { Channel } from "./channels";

export type BannerType = "principal" | "mini" | "categoria";

export type Banner = {
  id: string;
  type: BannerType;
  imageUrl: string;
  linkUrl: string | null;
  title: string | null;
  sortOrder: number;
};

type RawBanner = {
  id: string;
  type: BannerType;
  image_url: string;
  link_url: string | null;
  title: string | null;
  sort_order: number;
};

function mapBanner(row: RawBanner): Banner {
  return {
    id: row.id,
    type: row.type,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    title: row.title,
    sortOrder: row.sort_order,
  };
}

export async function getBanners(
  channel: Channel,
  type: BannerType,
  categoryId?: string,
): Promise<Banner[]> {
  "use cache";
  cacheLife("days");
  cacheTag("banners");

  if (type === "categoria" && !categoryId) return [];

  const supabase = getHubClient();
  let query = supabase
    .from("banners")
    .select("id, type, image_url, link_url, title, sort_order")
    .eq("channel", channel)
    .eq("type", type)
    .order("sort_order", { ascending: true });

  if (type === "categoria" && categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[banners] erro ao consultar banners:", error.message);
    return [];
  }

  return ((data as RawBanner[]) ?? []).map(mapBanner);
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `pnpm --filter @mypet/core exec vitest run src/banners.test.ts`
Expected: PASS.

- [ ] **Step 5: Expor no `package.json`**

Adicione ao `exports` de `packages/core/package.json`:

```json
"./banners": "./src/banners.ts",
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/banners.ts packages/core/src/banners.test.ts packages/core/package.json
git commit -m "feat(core): leitura publica de banners cacheada"
```

---

### Task 23: Lógica pura + upload do módulo Banners no admin

**Files:**
- Create: `apps/admin/lib/banners.ts`
- Test: `apps/admin/lib/banners.test.ts`
- Create: `apps/admin/lib/cloudflare-images.ts`
- Test: `apps/admin/lib/cloudflare-images.test.ts`

**Interfaces:**
- Consumes: `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` (env).
- Produces: `findConflictingCategoryBanner(existing, candidate)`, `uploadImageToCloudflare(file: File)` — usados pela Task 25.

- [ ] **Step 1: Escrever o teste falho de `banners.ts`**

```ts
// apps/admin/lib/banners.test.ts
import { describe, it, expect } from "vitest";
import { findConflictingCategoryBanner } from "./banners";

const base = { id: "existing", type: "categoria" as const, channel: "mypetbrasil", category_id: "cat-1", active: true };

describe("findConflictingCategoryBanner", () => {
  it("retorna null quando o tipo não é categoria", () => {
    expect(findConflictingCategoryBanner([base], { type: "principal", channel: "mypetbrasil", category_id: null })).toBeNull();
  });

  it("encontra conflito com banner ativo na mesma categoria e canal", () => {
    const result = findConflictingCategoryBanner([base], { type: "categoria", channel: "mypetbrasil", category_id: "cat-1" });
    expect(result).toEqual({ id: "existing" });
  });

  it("ignora banners inativos", () => {
    const result = findConflictingCategoryBanner(
      [{ ...base, active: false }],
      { type: "categoria", channel: "mypetbrasil", category_id: "cat-1" },
    );
    expect(result).toBeNull();
  });

  it("ignora o próprio registro ao editar (mesmo id)", () => {
    const result = findConflictingCategoryBanner(
      [base],
      { id: "existing", type: "categoria", channel: "mypetbrasil", category_id: "cat-1" },
    );
    expect(result).toBeNull();
  });

  it("ignora categorias/canais diferentes", () => {
    const result = findConflictingCategoryBanner(
      [base],
      { type: "categoria", channel: "distribuidora", category_id: "cat-1" },
    );
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `pnpm --filter admin exec vitest run lib/banners.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `apps/admin/lib/banners.ts`**

```ts
export type ExistingBanner = {
  id: string;
  type: "principal" | "mini" | "categoria";
  channel: string;
  category_id: string | null;
  active: boolean;
};

export type CandidateBanner = {
  id?: string;
  type: "principal" | "mini" | "categoria";
  channel: string;
  category_id: string | null;
};

export function findConflictingCategoryBanner(
  existing: ExistingBanner[],
  candidate: CandidateBanner,
): { id: string } | null {
  if (candidate.type !== "categoria") return null;

  const conflict = existing.find(
    (b) =>
      b.id !== candidate.id &&
      b.type === "categoria" &&
      b.channel === candidate.channel &&
      b.category_id === candidate.category_id &&
      b.active,
  );

  return conflict ? { id: conflict.id } : null;
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `pnpm --filter admin exec vitest run lib/banners.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever o teste falho de `cloudflare-images.ts`**

```ts
// apps/admin/lib/cloudflare-images.test.ts
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { uploadImageToCloudflare } from "./cloudflare-images";

const file = new File(["conteudo"], "banner.jpg", { type: "image/jpeg" });

beforeEach(() => {
  process.env.CLOUDFLARE_ACCOUNT_ID = "acc-123";
  process.env.CLOUDFLARE_API_TOKEN = "token-abc";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
});

describe("uploadImageToCloudflare", () => {
  it("retorna a URL da primeira variante em caso de sucesso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, result: { variants: ["https://imagedelivery.net/x/y/public"] } }),
      }),
    );
    const result = await uploadImageToCloudflare(file);
    expect(result).toEqual({ url: "https://imagedelivery.net/x/y/public" });
  });

  it("retorna erro quando faltam credenciais", async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    const result = await uploadImageToCloudflare(file);
    expect(result).toEqual({ error: expect.stringContaining("Cloudflare Images") });
  });

  it("retorna erro genérico quando a API falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ success: false, errors: [] }) }));
    const result = await uploadImageToCloudflare(file);
    expect(result).toEqual({ error: "Não foi possível enviar a imagem. Tente novamente." });
  });
});
```

- [ ] **Step 6: Rodar e confirmar falha**

Run: `pnpm --filter admin exec vitest run lib/cloudflare-images.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implementar `apps/admin/lib/cloudflare-images.ts`**

```ts
export async function uploadImageToCloudflare(file: File): Promise<{ url: string } | { error: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return { error: "Cloudflare Images não está configurado (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN)." };
  }

  const body = new FormData();
  body.append("file", file);

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}` },
    body,
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    console.error("[cloudflare-images] upload falhou:", JSON.stringify(json.errors ?? json));
    return { error: "Não foi possível enviar a imagem. Tente novamente." };
  }

  const url = json.result?.variants?.[0];
  if (!url) {
    return { error: "Upload concluído, mas nenhuma URL foi retornada." };
  }

  return { url };
}
```

- [ ] **Step 8: Rodar e confirmar sucesso**

Run: `pnpm --filter admin exec vitest run lib/cloudflare-images.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/admin/lib/banners.ts apps/admin/lib/banners.test.ts apps/admin/lib/cloudflare-images.ts apps/admin/lib/cloudflare-images.test.ts
git commit -m "feat(admin): logica pura e upload Cloudflare Images do modulo Banners"
```

---

### Task 24: Configurar credenciais Cloudflare no ambiente local

**Files:** nenhum (config local).

- [ ] **Step 1: Preencher `.env.local`**

Em `apps/admin/.env.local`, preencha `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN` com as credenciais da conta Cloudflare Images já existente (fornecidas pelo usuário fora deste repositório).

- [ ] **Step 2: Confirmar o token tem permissão correta**

O token precisa da permissão **Cloudflare Images: Edit** na conta em questão (Cloudflare Dashboard → My Profile → API Tokens). Se o upload retornar 403 na Task 28, revisar esse escopo primeiro.

Nenhum commit — configuração local sensível.

---

### Task 25: Tela `/marketing/banners` (listar, criar, editar, excluir)

**Files:**
- Create: `apps/admin/app/(dashboard)/marketing/banners/page.tsx`
- Create: `apps/admin/app/(dashboard)/marketing/banners/actions.ts`

**Interfaces:**
- Consumes: `requireAdminSession` (Task 5), `getCategories`/`buildCategoryTree` (`@mypet/core`), `flattenForSelect` (Task 17), `findConflictingCategoryBanner` (Task 23), `uploadImageToCloudflare` (Task 23).
- Produces: CRUD completo de banners.

- [ ] **Step 1: Criar `apps/admin/app/(dashboard)/marketing/banners/actions.ts`**

```ts
"use server";

import { z } from "zod";
import { revalidateTag } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { findConflictingCategoryBanner, type ExistingBanner } from "@/lib/banners";
import { uploadImageToCloudflare } from "@/lib/cloudflare-images";

const BannerSchema = z.object({
  type: z.enum(["principal", "mini", "categoria"]),
  channel: z.enum(["mypetbrasil", "distribuidora"]),
  categoryId: z.string().uuid().nullable(),
  linkUrl: z.string().nullable(),
  title: z.string().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});

export type BannerFormState = { error?: string } | undefined;

async function resolveImageUrl(formData: FormData, existingUrl?: string): Promise<{ url: string } | { error: string }> {
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    return uploadImageToCloudflare(file);
  }
  if (existingUrl) return { url: existingUrl };
  return { error: "Selecione uma imagem para o banner." };
}

export async function createBanner(_state: BannerFormState, formData: FormData): Promise<BannerFormState> {
  const { supabase } = await requireAdminSession();

  const rawCategoryId = formData.get("categoryId");
  const parsed = BannerSchema.safeParse({
    type: formData.get("type"),
    channel: formData.get("channel"),
    categoryId: rawCategoryId ? String(rawCategoryId) : null,
    linkUrl: formData.get("linkUrl") || null,
    title: formData.get("title") || null,
    sortOrder: formData.get("sortOrder"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (parsed.data.type === "categoria" && !parsed.data.categoryId) {
    return { error: "Selecione a categoria para um banner do tipo categoria." };
  }

  const { data: existing } = await supabase
    .from("banners")
    .select("id, type, channel, category_id, active");

  const conflict = findConflictingCategoryBanner((existing ?? []) as ExistingBanner[], {
    type: parsed.data.type,
    channel: parsed.data.channel,
    category_id: parsed.data.categoryId,
  });

  if (conflict) {
    return { error: "Já existe um banner ativo para essa categoria e canal. Desative-o antes de criar outro." };
  }

  const imageResult = await resolveImageUrl(formData);
  if ("error" in imageResult) return { error: imageResult.error };

  const { error } = await supabase.from("banners").insert({
    type: parsed.data.type,
    channel: parsed.data.channel,
    category_id: parsed.data.categoryId,
    image_url: imageResult.url,
    link_url: parsed.data.linkUrl,
    title: parsed.data.title,
    sort_order: parsed.data.sortOrder,
    active: parsed.data.active,
  });

  if (error) {
    console.error("[admin/banners] erro ao criar banner:", error.message);
    return { error: "Não foi possível salvar o banner." };
  }

  revalidateTag("banners");
  return undefined;
}

export async function deleteBanner(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) {
    console.error("[admin/banners] erro ao excluir banner:", error.message);
    return;
  }

  revalidateTag("banners");
}

export async function toggleBannerActive(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  const { error } = await supabase
    .from("banners")
    .update({ active: !active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[admin/banners] erro ao alternar banner:", error.message);
    return;
  }

  revalidateTag("banners");
}
```

- [ ] **Step 2: Criar `apps/admin/app/(dashboard)/marketing/banners/page.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { useEffect, useState } from "react";
import { createBanner, deleteBanner, toggleBannerActive, type BannerFormState } from "./actions";

type CategoryOption = { id: string; label: string };
type BannerRow = {
  id: string;
  type: "principal" | "mini" | "categoria";
  channel: string;
  category_id: string | null;
  image_url: string;
  link_url: string | null;
  title: string | null;
  active: boolean;
};

export default function BannersPageClient({
  banners,
  categoryOptions,
}: {
  banners: BannerRow[];
  categoryOptions: CategoryOption[];
}) {
  const [state, formAction, pending] = useActionState<BannerFormState, FormData>(createBanner, undefined);
  const [type, setType] = useState<"principal" | "mini" | "categoria">("principal");

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Marketing → Banners</h1>

      <form action={formAction} className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="principal">Principal</option>
              <option value="mini">Mini</option>
              <option value="categoria">Categoria</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Canal</label>
            <select name="channel" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="mypetbrasil">My Pet Brasil</option>
              <option value="distribuidora">Distribuidora</option>
            </select>
          </div>
          {type === "categoria" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Categoria</label>
              <select name="categoryId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">— selecione —</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Imagem</label>
          <input name="image" type="file" accept="image/*" required className="text-sm" />
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Título / alt</label>
            <input name="title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Link de destino</label>
            <input name="linkUrl" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
            <input name="sortOrder" type="number" defaultValue={0} className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <input id="active" name="active" type="checkbox" defaultChecked />
            <label htmlFor="active" className="text-sm text-slate-600">Ativo</label>
          </div>
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button type="submit" disabled={pending} className="w-fit rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Enviando…" : "Adicionar banner"}
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banners.map((b) => (
          <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.image_url} alt={b.title ?? ""} className="mb-3 h-32 w-full rounded-lg object-cover" />
            <p className="text-sm font-semibold text-slate-800">{b.title ?? "(sem título)"}</p>
            <p className="mb-3 text-xs text-slate-500">{b.type} · {b.channel} {b.active ? "· ativo" : "· inativo"}</p>
            <div className="flex gap-2">
              <form action={toggleBannerActive}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="active" value={String(b.active)} />
                <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  {b.active ? "Desativar" : "Ativar"}
                </button>
              </form>
              <form action={deleteBanner}>
                <input type="hidden" name="id" value={b.id} />
                <button type="submit" className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                  Excluir
                </button>
              </form>
            </div>
          </div>
        ))}
        {banners.length === 0 && <p className="text-sm text-slate-400">Nenhum banner cadastrado.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar o Server Component que carrega os dados e renderiza o Client Component acima**

Crie `apps/admin/app/(dashboard)/marketing/banners/page-data.tsx`:

```tsx
import { getCategories } from "@mypet/core/catalog";
import { buildCategoryTree } from "@mypet/core/catalog-utils";
import { requireAdminSession } from "@/lib/auth";
import { flattenForSelect } from "@/lib/categories";
import BannersPageClient from "./page";

export default async function BannersPageData() {
  const { supabase } = await requireAdminSession();
  const { data } = await supabase
    .from("banners")
    .select("id, type, channel, category_id, image_url, link_url, title, active")
    .order("created_at", { ascending: false });

  const categories = await getCategories();
  const tree = buildCategoryTree(categories);
  const categoryOptions = flattenForSelect(tree);

  return <BannersPageClient banners={data ?? []} categoryOptions={categoryOptions} />;
}
```

Renomeie o arquivo do Step 2 de `page.tsx` para `banners-client.tsx` (o export default continua se chamando `BannersPageClient`), e ajuste o import em `page-data.tsx` para `./banners-client`. Em seguida, renomeie `page-data.tsx` para `page.tsx` — este é o arquivo que o Next de fato roteia como Server Component; ele importa e renderiza o Client Component com os dados já carregados no servidor.

Resultado final de arquivos:
- `apps/admin/app/(dashboard)/marketing/banners/page.tsx` (Server Component, é o conteúdo do Step 3, importando de `./banners-client`)
- `apps/admin/app/(dashboard)/marketing/banners/banners-client.tsx` (Client Component, é o conteúdo do Step 2)
- `apps/admin/app/(dashboard)/marketing/banners/actions.ts` (Step 1)

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/\(dashboard\)/marketing
git commit -m "feat(admin): tela de Marketing / Banners com upload e guarda de conflito"
```

---

### Task 26: Renderizar banner `principal` e `mini` na home dos dois apps

**Files:**
- Create: `packages/core/src/components/hero-section.tsx`
- Create: `packages/core/src/components/mini-banner-strip.tsx`
- Modify: `apps/mypet/app/page.tsx:260-312` (bloco `{/* HERO */}`)
- Modify: `apps/distribuidora/app/page.tsx:260-312` (bloco `{/* HERO */}`, texto idêntico ao de `mypet`)

**Interfaces:**
- Consumes: `getBanners` (Task 22), `UnlockButton` (`@mypet/core/components/lead-gate`), `Palette` (`@mypet/core/theme`).
- Produces: `<HeroSection>` e `<MiniBannerStrip>`, usados pelas duas apps.

- [ ] **Step 1: Criar `packages/core/src/components/hero-section.tsx`**, movendo o JSX estático atual para o branch de fallback:

```tsx
import { getBanners } from "../banners";
import { UnlockButton } from "./lead-gate";
import type { Palette } from "../theme";
import type { Channel } from "../channels";

export async function HeroSection({ channel, palette }: { channel: Channel; palette: Palette }) {
  const [banner] = await getBanners(channel, "principal");

  if (banner) {
    const image = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={banner.imageUrl} alt={banner.title ?? ""} style={{ width: "100%", display: "block" }} />
    );
    return (
      <section style={{ position: "relative", overflow: "hidden" }}>
        {banner.linkUrl ? <a href={banner.linkUrl}>{image}</a> : image}
      </section>
    );
  }

  return (
    <section style={{
      background: `linear-gradient(135deg, ${palette.navyDark} 0%, ${palette.navy} 60%, #1e4d8a 100%)`,
      padding: "80px 24px 72px",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: "50%", background: palette.pink, opacity: 0.08 }} />
      <div style={{ position: "absolute", bottom: -80, left: "30%", width: 400, height: 400, borderRadius: "50%", background: palette.cyan, opacity: 0.06 }} />

      <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center", position: "relative" }}>
        <div className="fade-up" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 100, padding: "6px 16px", marginBottom: 28,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: palette.cyan, display: "inline-block" }} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>Atacado exclusivo para pet shops • Sem intermediários</span>
        </div>

        <h1 className="fade-up fade-up-1 hero-title" style={{
          fontSize: 52, fontWeight: 900, color: palette.white, lineHeight: 1.15,
          marginBottom: 20, letterSpacing: "-0.02em",
        }}>
          Monte seu pedido em minutos.<br />
          <span style={{ color: palette.cyan }}>Sem precisar falar com ninguém.</span>
        </h1>

        <p className="fade-up fade-up-2" style={{ fontSize: 18, color: "rgba(255,255,255,0.75)", marginBottom: 36, maxWidth: 580, margin: "0 auto 36px", lineHeight: 1.6 }}>
          Catálogo completo de ração, higiene, brinquedos e mais com preços sob consulta para lojistas.
        </p>

        <div className="fade-up fade-up-3" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 48 }}>
          <UnlockButton className="cta-primary">
            💬 Solicitar cotação
          </UnlockButton>
          <a href="#catalogo" className="cta-secondary" style={{ textDecoration: "none", display: "inline-block" }}>
            Ver catálogo
          </a>
        </div>

        <p className="fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          {["✅ Cadastro em 10 segundos", "📦 Estoque em tempo real", "🚚 Entrega em 48h SP", "💬 Sem atendimento necessário", "🏷️ Preços sob consulta"].map((t) => (
            <span key={t} style={{
              background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 100, padding: "6px 14px", fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 600,
            }}>{t}</span>
          ))}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Criar `packages/core/src/components/mini-banner-strip.tsx`**

```tsx
import { getBanners } from "../banners";
import type { Channel } from "../channels";

export async function MiniBannerStrip({ channel }: { channel: Channel }) {
  const banners = await getBanners(channel, "mini");
  if (banners.length === 0) return null;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 0", display: "flex", gap: 16, overflowX: "auto" }}>
      {banners.map((b) => {
        const image = (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.imageUrl} alt={b.title ?? ""} style={{ width: 280, height: 140, objectFit: "cover", borderRadius: 12, display: "block" }} />
        );
        return b.linkUrl ? (
          <a key={b.id} href={b.linkUrl}>{image}</a>
        ) : (
          <span key={b.id}>{image}</span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Expor os dois componentes no `package.json`**

Confirme que `"./components/*": "./src/components/*.tsx"` já cobre ambos (padrão já existente) — nenhuma mudança necessária no `exports`.

- [ ] **Step 4: Modificar `apps/mypet/app/page.tsx`**

Adicione o import no topo do arquivo, junto aos demais imports de `@mypet/core`:

```tsx
import { HeroSection } from "@mypet/core/components/hero-section";
import { MiniBannerStrip } from "@mypet/core/components/mini-banner-strip";
```

Troque o bloco inteiro `{/* HERO */}` (da abertura `<section style={{...HERO...}}>` até o `</section>` correspondente, atualmente linhas 260-312) por:

```tsx
        {/* HERO */}
        <Suspense fallback={<div style={{ minHeight: 480, background: PALETTE.navyDark }} />}>
          <HeroSection channel={clientConfig.catalogChannel as Channel} palette={PALETTE} />
        </Suspense>

        <Suspense fallback={null}>
          <MiniBannerStrip channel={clientConfig.catalogChannel as Channel} />
        </Suspense>
```

Adicione `import type { Channel } from "@mypet/core/channels";` junto aos demais imports.

- [ ] **Step 5: Repetir o Step 4 exatamente igual em `apps/distribuidora/app/page.tsx`** (mesmo bloco de import, mesma substituição — os dois arquivos são idênticos nessa região, confirmado por `diff` antes de escrever este plano).

- [ ] **Step 6: Build de sanidade**

Run: `pnpm --filter mypet build && pnpm --filter distribuidora build`
Expected: build passa sem erro de tipo (nenhum banner cadastrado ainda → cai no fallback estático, comportamento visual idêntico ao atual).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/components/hero-section.tsx packages/core/src/components/mini-banner-strip.tsx apps/mypet/app/page.tsx apps/distribuidora/app/page.tsx
git commit -m "feat: home renderiza banner principal e faixa de mini banners quando cadastrados"
```

---

### Task 27: Renderizar banner de `categoria` em `/categoria/[slug]`

**Files:**
- Modify: `packages/core/src/components/category-listing.tsx`

**Interfaces:**
- Consumes: `getBanners` (Task 22).
- Produces: banner de categoria exibido logo abaixo do `<h1>` da página, quando existir.

- [ ] **Step 1: Adicionar o import**

No topo de `packages/core/src/components/category-listing.tsx`, adicione:

```tsx
import { getBanners } from "../banners";
import type { Channel } from "../channels";
```

- [ ] **Step 2: Buscar o banner junto com o restante dos dados**

Logo após a linha `const catalog = await getCatalog({ categoryId: subtreeIds, page, channel });` (linha 30), adicione:

```tsx
  const [categoryBanner] = await getBanners(channel as Channel, "categoria", node.id);
```

- [ ] **Step 3: Renderizar o banner**

Logo após `<h1 style={{ fontSize: 26, fontWeight: 900, color: palette.navy, marginBottom: 16 }}>{node.name}</h1>` (linha 52), adicione:

```tsx
      {categoryBanner && (
        <div style={{ marginBottom: 20 }}>
          {categoryBanner.linkUrl ? (
            <a href={categoryBanner.linkUrl}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={categoryBanner.imageUrl} alt={categoryBanner.title ?? node.name} style={{ width: "100%", borderRadius: 16, display: "block" }} />
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={categoryBanner.imageUrl} alt={categoryBanner.title ?? node.name} style={{ width: "100%", borderRadius: 16, display: "block" }} />
          )}
        </div>
      )}
```

- [ ] **Step 4: Build de sanidade**

Run: `pnpm --filter mypet build && pnpm --filter distribuidora build`
Expected: build passa sem erro.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/category-listing.tsx
git commit -m "feat: pagina de categoria renderiza banner especifico quando cadastrado"
```

---

### Task 28: Verificação manual completa do módulo Banners

**Files:** nenhum.

- [ ] **Step 1: Cadastrar um banner principal**

No admin (`/marketing/banners`), crie um banner tipo "Principal", canal "My Pet Brasil", com uma imagem qualquer.
Expected: upload completa, card aparece na grade com "· ativo".

- [ ] **Step 2: Confirmar na home**

Acesse a home do `apps/mypet` (dev).
Expected: o hero estático some, dá lugar à imagem do banner.

- [ ] **Step 3: Desativar e confirmar fallback**

No admin, clique "Desativar" no banner.
Expected: recarregando a home do site, volta a mostrar o hero estático (o `revalidateTag("banners")` já invalidou o cache).

- [ ] **Step 4: Cadastrar banner de categoria e checar conflito**

Crie um banner tipo "Categoria" para uma categoria real do catálogo. Tente criar um segundo banner "Categoria" para a mesma categoria+canal, ativo.
Expected: segunda tentativa retorna o erro "Já existe um banner ativo para essa categoria e canal...".

- [ ] **Step 5: Confirmar banner de categoria no site**

Acesse `/categoria/<slug-da-categoria-escolhida>` no `apps/mypet` dev.
Expected: o banner aparece logo abaixo do título da categoria.

- [ ] **Step 6: Cadastrar mini banners e confirmar a faixa**

Crie dois banners tipo "Mini" para o mesmo canal.
Expected: uma faixa horizontal com as duas imagens aparece na home, logo abaixo do hero/banner principal.

Nenhum commit — verificação manual encerra o plano.
