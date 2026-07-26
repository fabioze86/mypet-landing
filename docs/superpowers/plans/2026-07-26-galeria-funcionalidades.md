# Galeria de funcionalidades por site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um registro central de funcionalidades por site (`packages/core/src/features.ts`), plugá-lo no `ClientConfig` dos apps existentes, e expor uma tela somente-leitura no `apps/admin` que mostra qual funcionalidade está ativa em cada site.

**Architecture:** Um único módulo (`packages/core/src/features.ts`) exporta o tipo `Features`, o registro descritivo `FEATURE_REGISTRY` (usado só para render) e o mapa `SITES` (fonte da verdade de qual valor cada site usa). `apps/mypet` e `apps/distribuidora` (que já usam `ClientConfig`) e `apps/azpetshop` (config própria, sem esse tipo) passam a ler `features` de `SITES` em vez de qualquer valor hardcoded. `apps/admin` importa `FEATURE_REGISTRY` + `SITES` diretamente do pacote (nenhum import entre apps) e renderiza uma tabela.

**Tech Stack:** TypeScript, Next.js App Router (React Server Components), Vitest, Tailwind (classes já usadas no admin).

## Global Constraints

- Nenhuma mudança de comportamento visível nos 3 sites públicos nesta entrega — todos permanecem em `commerce: "quote"`.
- A tela do admin é somente leitura: sem Server Actions, sem escrita no Supabase.
- O modo `"cart"` existe só como valor de tipo/registro; nenhum componente lê ou reage a ele ainda.
- `packages/core` não pode importar nada de `apps/*` (regra geral do monorepo — dependência é sempre app → core, nunca o contrário).

---

### Task 1: Módulo `features.ts` no `packages/core`

**Files:**
- Create: `packages/core/src/features.ts`
- Create: `packages/core/src/features.test.ts`
- Modify: `packages/core/package.json:7-22` (bloco `exports`)

**Interfaces:**
- Produces: `export type CommerceMode = "quote" | "cart"`; `export type Features = { commerce: CommerceMode }`; `export type FeatureDefinition = { id: keyof Features; label: string; description: string; options: { value: string; label: string }[] }`; `export const FEATURE_REGISTRY: FeatureDefinition[]`; `export type SiteId = "mypet" | "distribuidora" | "azpetshop"`; `export const SITES: Record<SiteId, { name: string; features: Features }>`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/features.test.ts
import { describe, it, expect } from "vitest";
import { SITES, FEATURE_REGISTRY, type SiteId, type Features } from "./features";

describe("features registry", () => {
  it("declara os 3 sites esperados", () => {
    const ids = Object.keys(SITES).sort();
    expect(ids).toEqual(["azpetshop", "distribuidora", "mypet"]);
  });

  it("cada site preenche todas as chaves de Features", () => {
    const featureKeys = FEATURE_REGISTRY.map((f) => f.id).sort();
    for (const siteId of Object.keys(SITES) as SiteId[]) {
      const site = SITES[siteId];
      const siteKeys = Object.keys(site.features).sort();
      expect(siteKeys).toEqual(featureKeys);
    }
  });

  it("cada valor ativo em SITES existe nas opções do FEATURE_REGISTRY", () => {
    for (const siteId of Object.keys(SITES) as SiteId[]) {
      const site = SITES[siteId];
      for (const [featureId, value] of Object.entries(site.features) as [keyof Features, string][]) {
        const def = FEATURE_REGISTRY.find((f) => f.id === featureId);
        expect(def, `sem FeatureDefinition para "${featureId}"`).toBeTruthy();
        const valid = def!.options.some((o) => o.value === value);
        expect(valid, `valor "${value}" inválido para "${featureId}"`).toBe(true);
      }
    }
  });

  it("mypet e distribuidora começam em modo cotação", () => {
    expect(SITES.mypet.features.commerce).toBe("quote");
    expect(SITES.distribuidora.features.commerce).toBe("quote");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core test -- features.test.ts`
Expected: FAIL — `Cannot find module './features'` (o arquivo ainda não existe).

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/features.ts

export type CommerceMode = "quote" | "cart";

export type Features = {
  commerce: CommerceMode;
};

export type FeatureDefinition = {
  id: keyof Features;
  label: string;
  description: string;
  options: { value: string; label: string }[];
};

export const FEATURE_REGISTRY: FeatureDefinition[] = [
  {
    id: "commerce",
    label: "Modelo comercial",
    description:
      "Como o site apresenta preço e converte o visitante em contato/venda.",
    options: [
      { value: "quote", label: "Cotação (preço fechado + WhatsApp)" },
      { value: "cart", label: "Preço + carrinho (não implementado ainda)" },
    ],
  },
];

export type SiteId = "mypet" | "distribuidora" | "azpetshop";

export const SITES: Record<SiteId, { name: string; features: Features }> = {
  mypet: {
    name: "My Pet Brasil",
    features: { commerce: "quote" },
  },
  distribuidora: {
    name: "Distribuidora Petshop",
    features: { commerce: "quote" },
  },
  azpetshop: {
    name: "MAD PET",
    features: { commerce: "quote" },
  },
};
```

Adicione a entrada no `exports` de `packages/core/package.json` (mesmo padrão das
outras entradas, ex. `"./channels": "./src/channels.ts"`):

```json
    "./features": "./src/features.ts",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mypet/core test -- features.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features.ts packages/core/src/features.test.ts packages/core/package.json
git commit -m "feat(core): registro central de features por site"
```

---

### Task 2: `ClientConfig` ganha `features` e os 3 apps consomem `SITES`

**Files:**
- Modify: `packages/core/src/theme.tsx:26-33` (tipo `ClientConfig`)
- Modify: `apps/mypet/client.config.ts`
- Modify: `apps/distribuidora/client.config.ts`
- Modify: `apps/azpetshop/client.config.ts`

**Interfaces:**
- Consumes: `SITES` e `Features` de `Task 1` (`@mypet/core/features`).
- Produces: `ClientConfig.features: Features` — consumido futuramente pelos
  componentes de produto (fora de escopo aqui).

Nenhum teste automatizado dedicado nesta task (é só religação de valores existentes);
a garantia vem do `tsc`/build de cada app, que falha se `features` estiver ausente
onde o tipo `ClientConfig` exige.

- [ ] **Step 1: Adicionar `features` ao tipo `ClientConfig`**

Em `packages/core/src/theme.tsx`, importe o tipo e adicione o campo:

```ts
import type { Features } from "./features";

export type ClientConfig = {
  name: string;
  tagline: string;
  domain: string;
  catalogChannel: string;
  palette: Palette;
  logo: { emoji: string };
  features: Features;
};
```

- [ ] **Step 2: Atualizar `apps/mypet/client.config.ts`**

Adicione o import e o campo, sem tocar em mais nada do arquivo:

```ts
import type { ClientConfig } from "@mypet/core/theme";
import { SITES } from "@mypet/core/features";

export const clientConfig: ClientConfig = {
  name: "My Pet Brasil",
  tagline: "Atacado B2B",
  domain: "mypetbrasil.com.br",
  catalogChannel: "mypetbrasil",
  palette: {
    pink: "#E5197A",
    pinkDark: "#B8115F",
    pinkLight: "#FCE4F0",
    cyan: "#00C4D4",
    cyanDark: "#009BAA",
    cyanLight: "#E0F9FB",
    navy: "#1A3472",
    navyDark: "#0F1F45",
    navyLight: "#EDF0F8",
    orange: "#FF6A00",
    green: "#00A651",
    white: "#FFFFFF",
    gray50: "#F8F9FB",
    gray100: "#F0F2F6",
    gray200: "#DDE2EC",
    gray400: "#9CA8C0",
    gray600: "#5A6580",
    gray800: "#2D3550",
  },
  logo: { emoji: "🐾" },
  features: SITES.mypet.features,
};
```

- [ ] **Step 3: Atualizar `apps/distribuidora/client.config.ts`**

Mesmo padrão — adicionar import e trocar o final do objeto:

```ts
import type { ClientConfig } from "@mypet/core/theme";
import { SITES } from "@mypet/core/features";

export const clientConfig: ClientConfig = {
  name: "Distribuidora Petshop",
  tagline: "Atacado B2B",
  domain: "www.distribuidorapetshop.com.br",
  catalogChannel: "distribuidora",
  palette: {
    pink: "#475569",
    pinkDark: "#334155",
    pinkLight: "#F1F5F9",
    cyan: "#64748B",
    cyanDark: "#475569",
    cyanLight: "#F8FAFC",
    navy: "#0F172A",
    navyDark: "#020617",
    navyLight: "#F1F5F9",
    orange: "#B45309",
    green: "#15803D",
    white: "#FFFFFF",
    gray50: "#F8FAFC",
    gray100: "#F1F5F9",
    gray200: "#E2E8F0",
    gray400: "#94A3B8",
    gray600: "#475569",
    gray800: "#1E293B",
  },
  logo: { emoji: "🐾" },
  features: SITES.distribuidora.features,
};
```

- [ ] **Step 4: Atualizar `apps/azpetshop/client.config.ts`**

Esse arquivo não usa o tipo `ClientConfig` (estrutura própria, sem `palette`/`domain`).
Adicionar só o campo `features`, sem forçar o tipo:

```ts
import type { Channel } from "@mypet/core/channels";
import { SITES } from "@mypet/core/features";

export const clientConfig = {
  name: "MAD PET",
  tagline: "Acessórios de fabricação própria para cães e gatos",
  catalogChannel: "azpetshop" satisfies Channel,
  brand: "MAD PET",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511982053694",
  mainSiteUrl: "https://www.mypetbrasil.com.br",
  distribuidoraUrl: "https://www.distribuidorapetshop.com.br",
  marketplaceUrl: "",
  features: SITES.azpetshop.features,
};
```

- [ ] **Step 5: Rodar typecheck/build dos 3 apps**

Run: `pnpm --filter mypet build && pnpm --filter distribuidora build && pnpm --filter azpetshop build`
Expected: os 3 builds terminam sem erro de tipo (nenhuma página lê `features` ainda,
então não há mudança visual).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/theme.tsx apps/mypet/client.config.ts apps/distribuidora/client.config.ts apps/azpetshop/client.config.ts
git commit -m "feat: liga client.config dos 3 sites ao registro central de features"
```

---

### Task 3: Tela `/funcionalidades` no `apps/admin`

**Files:**
- Create: `apps/admin/app/(dashboard)/funcionalidades/page.tsx`
- Modify: `apps/admin/app/(dashboard)/layout.tsx:5-8` (array `NAV`)

**Interfaces:**
- Consumes: `SITES`, `FEATURE_REGISTRY`, `SiteId` de `Task 1` (`@mypet/core/features`); `requireAdminSession` de `apps/admin/lib/auth.ts` (mesmo padrão de `categorias/page.tsx:59`).
- Produces: rota `/funcionalidades` navegável pelo menu lateral.

- [ ] **Step 1: Adicionar a rota ao menu**

Em `apps/admin/app/(dashboard)/layout.tsx`, adicione ao array `NAV` (linha 5-8):

```ts
const NAV = [
  { href: "/clientes", label: "Clientes" },
  { href: "/categorias", label: "Categorias" },
  { href: "/funcionalidades", label: "Funcionalidades" },
];
```

- [ ] **Step 2: Criar a página**

```tsx
// apps/admin/app/(dashboard)/funcionalidades/page.tsx
import { SITES, FEATURE_REGISTRY, type SiteId } from "@mypet/core/features";
import { requireAdminSession } from "@/lib/auth";

const SITE_ORDER: SiteId[] = ["mypet", "distribuidora", "azpetshop"];

export default async function FuncionalidadesPage() {
  await requireAdminSession();

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-slate-800">Funcionalidades</h1>
      <p className="mb-6 text-sm text-slate-500">
        O que está ativo em cada site hoje. Somente leitura — para mudar, edite{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5">packages/core/src/features.ts</code>{" "}
        e faça o deploy.
      </p>

      <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-4 py-3">Funcionalidade</th>
            {SITE_ORDER.map((siteId) => (
              <th key={siteId} className="px-4 py-3">{SITES[siteId].name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_REGISTRY.map((feature) => (
            <tr key={feature.id} className="border-b border-slate-100">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-700">{feature.label}</p>
                <p className="text-xs text-slate-400">{feature.description}</p>
              </td>
              {SITE_ORDER.map((siteId) => {
                const value = SITES[siteId].features[feature.id];
                const option = feature.options.find((o) => o.value === value);
                return (
                  <td key={siteId} className="px-4 py-3 text-slate-600">
                    {option?.label ?? value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Testar manualmente**

Run: `pnpm --filter admin dev`
Abra `http://localhost:3000/funcionalidades` (login de admin já existente) e confirme:
- o menu lateral mostra "Funcionalidades";
- a tabela tem 1 linha ("Modelo comercial") e 3 colunas (My Pet Brasil, Distribuidora Petshop, MAD PET);
- as 3 células mostram "Cotação (preço fechado + WhatsApp)".

- [ ] **Step 4: Rodar build do admin**

Run: `pnpm --filter admin build`
Expected: build passa sem erro de tipo.

- [ ] **Step 5: Commit**

```bash
git add "apps/admin/app/(dashboard)/funcionalidades/page.tsx" "apps/admin/app/(dashboard)/layout.tsx"
git commit -m "feat(admin): tela somente-leitura da galeria de funcionalidades"
```

---

## Self-Review Notes

- **Cobertura do spec:** registro central (Task 1) ✅; `ClientConfig`/apps consumindo `SITES` (Task 2) ✅; tela somente-leitura no admin (Task 3) ✅; modo `"cart"` sem implementação (nenhuma task cria componente/lógica para ele — apenas existe como valor de tipo/registro) ✅; ativação continua sendo edição de código (nenhuma Server Action ou tabela criada) ✅.
- **Placeholders:** nenhum "TBD"/"similar to" — todo código de cada step está completo.
- **Consistência de tipos:** `Features`, `FeatureDefinition`, `SiteId`, `SITES`, `FEATURE_REGISTRY` usam os mesmos nomes e formatos em todas as tasks que os consomem (Task 2 e 3 importam exatamente o que a Task 1 exporta).
