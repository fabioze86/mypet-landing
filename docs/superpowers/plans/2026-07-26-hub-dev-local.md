# Hub de desenvolvimento local — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar porta fixa a cada app do monorepo, criar um app `apps/hub` que lista links para os 3 sites públicos + admin, e um comando único (`pnpm dev:all`) que sobe tudo de uma vez.

**Architecture:** Cada `apps/*/package.json` ganha `next dev -p <porta fixa>`. Um novo app `apps/hub` (Next.js mínimo, sem Supabase/auth/client.config) renderiza uma lista estática de cards linkando para as portas dos outros 4 apps. O root `package.json` ganha `dev:admin`, `dev:hub` e `dev:all` (este último via `concurrently`, rodando os 5 dev scripts ao mesmo tempo num terminal só).

**Tech Stack:** Next.js 16 (App Router), TypeScript, pnpm workspaces, `concurrently`.

## Global Constraints

- Nenhum status "online/offline" ao vivo no hub — só links fixos (`<a href>`), decisão explícita do usuário.
- O hub não deve importar nada de `packages/core` relacionado a `SITES`/`features.ts` — esse registro é sobre funcionalidades ativas por site, não sobre URLs/portas de dev; a lista de links do hub fica hardcoded no próprio `apps/hub`.
- Portas fixas: `mypet` 4100, `distribuidora` 4101, `azpetshop` 4102, `admin` 4103, `hub` 4104.
- A mudança de porta afeta só `next dev` (script `dev`); os scripts `build`/`start` de cada app não mudam.

---

### Task 1: Portas fixas nos 4 apps existentes + script `dev:admin` no root

**Files:**
- Modify: `apps/mypet/package.json` (script `dev`)
- Modify: `apps/distribuidora/package.json` (script `dev`)
- Modify: `apps/azpetshop/package.json` (script `dev`)
- Modify: `apps/admin/package.json` (script `dev`)
- Modify: `package.json` (raiz do monorepo — adiciona `dev:admin`)

**Interfaces:**
- Produces: cada app passa a escutar numa porta fixa e previsível quando rodado via `pnpm --filter <app> dev` ou `pnpm dev:<app>` — consumido pela Task 2 (o hub aponta para essas portas) e pelo script `dev:all` (também da Task 2).

Não há teste automatizado (Vitest) aplicável aqui — a verificação é funcional: subir cada
servidor e confirmar que responde na porta esperada.

- [ ] **Step 1: Definir porta fixa em `apps/mypet/package.json`**

Troque a linha `"dev": "next dev",` por:

```json
    "dev": "next dev -p 4100",
```

- [ ] **Step 2: Definir porta fixa em `apps/distribuidora/package.json`**

Troque a linha `"dev": "next dev",` por:

```json
    "dev": "next dev -p 4101",
```

- [ ] **Step 3: Definir porta fixa em `apps/azpetshop/package.json`**

Troque a linha `"dev": "next dev",` por:

```json
    "dev": "next dev -p 4102",
```

- [ ] **Step 4: Definir porta fixa em `apps/admin/package.json`**

Troque a linha `"dev": "next dev",` por:

```json
    "dev": "next dev -p 4103",
```

- [ ] **Step 5: Adicionar `dev:admin` ao `package.json` da raiz**

Hoje o bloco `scripts` da raiz tem `dev:mypet`, `dev:distribuidora`, `dev:azpetshop` mas
não tem `dev:admin`. Adicione a linha que falta, mantendo as demais:

```json
  "scripts": {
    "dev:mypet": "pnpm --filter mypet dev",
    "dev:distribuidora": "pnpm --filter distribuidora dev",
    "dev:azpetshop": "pnpm --filter azpetshop dev",
    "dev:admin": "pnpm --filter admin dev",
    "build": "pnpm -r build",
    "lint": "eslint",
    "test": "pnpm --filter @mypet/core test"
  },
```

- [ ] **Step 6: Verificar que cada app sobe na porta certa**

Rode cada comando abaixo (um de cada vez, a partir da raiz do repo), confirme o código
HTTP retornado, e derrube o processo em seguida:

```bash
pnpm --filter mypet dev &
sleep 5
curl -s -o /dev/null -w "mypet (4100): %{http_code}\n" http://localhost:4100
kill %1 2>/dev/null || true
```

Expected: `mypet (4100): 200`

```bash
pnpm --filter distribuidora dev &
sleep 5
curl -s -o /dev/null -w "distribuidora (4101): %{http_code}\n" http://localhost:4101
kill %1 2>/dev/null || true
```

Expected: `distribuidora (4101): 200`

```bash
pnpm --filter azpetshop dev &
sleep 5
curl -s -o /dev/null -w "azpetshop (4102): %{http_code}\n" http://localhost:4102
kill %1 2>/dev/null || true
```

Expected: `azpetshop (4102): 200`

```bash
pnpm --filter admin dev &
sleep 5
curl -s -o /dev/null -w "admin (4103): %{http_code}\n" http://localhost:4103
kill %1 2>/dev/null || true
```

Expected: `admin (4103): 200` ou `307`/`302` (redirect para `/login` — o admin exige
sessão; qualquer resposta HTTP válida confirma que o servidor subiu na porta certa).

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/package.json apps/distribuidora/package.json apps/azpetshop/package.json apps/admin/package.json package.json
git commit -m "feat: porta fixa por app + script dev:admin no root"
```

---

### Task 2: App `apps/hub` + `dev:hub`/`dev:all`

**Files:**
- Create: `apps/hub/package.json`
- Create: `apps/hub/next.config.ts`
- Create: `apps/hub/tsconfig.json`
- Create: `apps/hub/next-env.d.ts`
- Create: `apps/hub/app/layout.tsx`
- Create: `apps/hub/app/page.tsx`
- Modify: `package.json` (raiz — adiciona `dev:hub` e `dev:all`, adiciona `concurrently` em `devDependencies`)

**Interfaces:**
- Consumes: as portas fixas definidas na Task 1 (4100/4101/4102/4103).
- Produces: app `hub` rodável via `pnpm --filter hub dev` ou `pnpm dev:hub`, escutando em
  `:4104`; script `pnpm dev:all` na raiz, que sobe os 5 apps de uma vez.

- [ ] **Step 1: Criar `apps/hub/package.json`**

```json
{
  "name": "hub",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 4104",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Criar `apps/hub/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 3: Criar `apps/hub/tsconfig.json`**

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
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Criar `apps/hub/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 5: Criar `apps/hub/app/layout.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hub — Monorepo My Pet",
  description: "Acesso rápido aos sites e ao admin em desenvolvimento local.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F4F5F7" }}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Criar `apps/hub/app/page.tsx`**

```tsx
type SiteLink = {
  name: string;
  description: string;
  url: string;
};

const SITES: SiteLink[] = [
  {
    name: "My Pet Brasil",
    description: "Site público — atacado B2B (porta 4100)",
    url: "http://localhost:4100",
  },
  {
    name: "Distribuidora Petshop",
    description: "Site público — atacado B2B (porta 4101)",
    url: "http://localhost:4101",
  },
  {
    name: "MAD PET (azpetshop)",
    description: "Site público — acessórios (porta 4102)",
    url: "http://localhost:4102",
  },
  {
    name: "Admin",
    description: "Painel administrativo (porta 4103)",
    url: "http://localhost:4103",
  },
];

export default function HubPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: "#1A1A2E" }}>
        Hub de desenvolvimento
      </h1>
      <p style={{ color: "#555", marginBottom: 32 }}>
        Acesso rápido aos apps do monorepo rodando localmente.
      </p>

      <div style={{ display: "grid", gap: 16 }}>
        {SITES.map((site) => (
          <a
            key={site.url}
            href={site.url}
            style={{
              display: "block",
              padding: "20px 24px",
              borderRadius: 12,
              border: "1px solid #E0E0E0",
              background: "#FFFFFF",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{site.name}</p>
            <p style={{ fontSize: 14, color: "#666" }}>{site.description}</p>
            <p style={{ fontSize: 13, color: "#999", marginTop: 8 }}>{site.url}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Adicionar `dev:hub`, `dev:all` e `concurrently` ao `package.json` da raiz**

Adicione `concurrently` em `devDependencies` (mantendo `eslint`/`eslint-config-next` já
existentes), e os dois scripts novos:

```json
{
  "name": "mypet-landing",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev:mypet": "pnpm --filter mypet dev",
    "dev:distribuidora": "pnpm --filter distribuidora dev",
    "dev:azpetshop": "pnpm --filter azpetshop dev",
    "dev:admin": "pnpm --filter admin dev",
    "dev:hub": "pnpm --filter hub dev",
    "dev:all": "concurrently -n mypet,distribuidora,azpetshop,admin,hub -c blue,green,yellow,magenta,cyan \"pnpm dev:mypet\" \"pnpm dev:distribuidora\" \"pnpm dev:azpetshop\" \"pnpm dev:admin\" \"pnpm dev:hub\"",
    "build": "pnpm -r build",
    "lint": "eslint",
    "test": "pnpm --filter @mypet/core test"
  },
  "devDependencies": {
    "concurrently": "^9",
    "eslint": "^9",
    "eslint-config-next": "16.2.6"
  }
}
```

- [ ] **Step 8: Instalar dependências**

Run: `pnpm install`
Expected: instala `concurrently` no root e cria o link do workspace `hub` (novo membro de
`apps/*`, já coberto pelo `pnpm-workspace.yaml` existente); termina sem erro.

- [ ] **Step 9: Rodar o hub isoladamente e verificar o conteúdo da página**

```bash
pnpm --filter hub dev &
sleep 5
curl -s http://localhost:4104 | grep -o 'http://localhost:410[0-3]' | sort -u
kill %1 2>/dev/null || true
```

Expected: a saída lista as 4 URLs (`http://localhost:4100`, `:4101`, `:4102`, `:4103`),
uma por linha — confirma que os 4 cards estão presentes na página renderizada.

- [ ] **Step 10: Rodar `pnpm dev:all` e verificar que os 5 processos sobem juntos**

```bash
pnpm dev:all &
sleep 8
for port in 4100 4101 4102 4103 4104; do
  curl -s -o /dev/null -w "porta $port: %{http_code}\n" "http://localhost:$port"
done
kill %1 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
```

Expected: as 5 portas respondem com um código HTTP válido (200 para mypet/distribuidora/
azpetshop/hub; 200/302/307 para admin, que redireciona sem sessão).

- [ ] **Step 11: Rodar o build de todos os apps para confirmar que nada quebrou**

Run: `pnpm build`
Expected: build passa para os 5 apps (`mypet`, `distribuidora`, `azpetshop`, `admin`,
`hub`), sem erro de tipo.

- [ ] **Step 12: Commit**

```bash
git add apps/hub package.json pnpm-lock.yaml
git commit -m "feat: app hub de desenvolvimento local + comando dev:all"
```

---

## Self-Review Notes

- **Cobertura do spec:** portas fixas nos 4 apps existentes (Task 1) ✅; script `dev:admin`
  que faltava no root (Task 1, Step 5) ✅; app `hub` com página de links, sem status ao
  vivo, sem depender de `packages/core/src/features.ts` (Task 2) ✅; comando único
  `dev:all` via `concurrently` (Task 2, Step 7) ✅; nenhuma mudança em `build`/`start` dos
  apps existentes (só o script `dev` foi tocado em cada um) ✅.
- **Placeholders:** nenhum "TBD"/"similar to" — cada step tem o conteúdo completo do
  arquivo ou comando.
- **Consistência:** as portas usadas no `apps/hub/app/page.tsx` (4100/4101/4102/4103)
  batem exatamente com as definidas na Task 1; os nomes dos scripts (`dev:mypet`,
  `dev:distribuidora`, `dev:azpetshop`, `dev:admin`, `dev:hub`) usados em `dev:all` (Task
  2, Step 7) batem com os scripts criados nas Tasks 1 e 2.
