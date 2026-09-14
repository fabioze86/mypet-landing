# Distribuidora Instagram — Fundação (app, dados, admin, hotsite de leitura) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar no ar o novo app `apps/distribuidora-instagram`, com o modelo de dados de campanhas no Hub Catálogo, um CRUD de campanhas no `apps/admin` e as páginas públicas `/ofertas-para-lojistas` e `/ofertas-para-lojistas/[slug]` exibindo produtos, preço, desconto e cupom reais — sem finalizar pedido (isso é o plano 2).

**Architecture:** Novo app Next.js 16 (canal `ffa_fabrica`, mesmo catálogo de `apps/distribuidora`) consumindo diretamente o Supabase `hub_catalogo` via `@mypet/core`, seguindo exatamente o padrão de `balcao.ts`/`balcao-calc.ts` (arquivo puro + arquivo server cacheado) e o padrão de admin de `marketing/banners` (zod + Server Actions + `requireAdminSession`). Preço de tabela nunca é salvo — é sempre resolvido ao vivo a partir do preço real do produto no canal.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, TypeScript estrito, Tailwind CSS 4, Supabase/Postgres, Vitest 4, `@testing-library/react`, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-13-distribuidora-instagram-ofertas-design.md`

## Global Constraints

- Canal de catálogo: **`ffa_fabrica`** (mesmo canal de `apps/distribuidora`) — não criar canal novo.
- Preço de tabela (riscado) nunca é armazenado em `offer_campaign_items` — é sempre lido ao vivo do preço real do produto (`product_channel_prices` ou `v_precos_erp`, conforme `channelUsesErpPrice`).
- Status da campanha (`draft`/`scheduled`/`active`/`expired`) é sempre **calculado em runtime** a partir de `active` + `starts_at` + `ends_at` — nunca armazenado como enum manual.
- Campanha ou item sem preço real válido é excluído do resultado; campanha sem nenhum item válido nunca é exibida com preço fictício.
- RLS obrigatório em toda tabela nova desde a criação: leitura pública (`anon`) sem filtro de data (o filtro de vigência é feito em `packages/core`, igual ao Balcão de Negócios); escrita só `admin_users`.
- Este plano **não inclui** checkout, cupom aplicado ao total, autenticação de comprador, UTM nem analytics — isso é assunto dos planos 2 e 3.
- Não alterar `apps/distribuidora`, `apps/madpet`, `apps/azpetshop` nem `apps/mypet`.
- Toda mudança em `packages/core/src/cart.ts` deve ser aditiva (campos opcionais), sem quebrar os apps que já usam `CartItem`.

---

### Task 1: Scaffold do app `apps/distribuidora-instagram`

**Files:**
- Create: `apps/distribuidora-instagram/package.json`
- Create: `apps/distribuidora-instagram/next.config.ts`
- Create: `apps/distribuidora-instagram/next.config.test.ts`
- Create: `apps/distribuidora-instagram/tsconfig.json`
- Create: `apps/distribuidora-instagram/postcss.config.mjs`
- Create: `apps/distribuidora-instagram/vitest.config.ts`
- Create: `apps/distribuidora-instagram/vitest.setup.ts`
- Create: `apps/distribuidora-instagram/.env.example`
- Create: `apps/distribuidora-instagram/vercel.json`
- Create: `apps/distribuidora-instagram/client.config.ts`
- Create: `apps/distribuidora-instagram/app/globals.css`
- Create: `apps/distribuidora-instagram/app/layout.tsx`
- Create: `apps/distribuidora-instagram/app/page.tsx`
- Modify: `packages/core/src/features.ts`
- Modify: `package.json` (raiz)

**Interfaces:**
- Produces: `SITES.distribuidoraInstagram: { name, features: { commerce: "cart" } }` em `@mypet/core/features`.
- Produces: `clientConfig: ClientConfig` exportado de `apps/distribuidora-instagram/client.config.ts`, com `catalogChannel: "ffa_fabrica"`.
- Consumes: `ClientConfig`/`Palette` de `@mypet/core/theme` (tipos já existentes).

- [ ] **Step 1: Adicionar o novo site em `features.ts`**

Em `packages/core/src/features.ts`, altere o tipo `SiteId` e o registro `SITES`:

```ts
export type SiteId = "mypet" | "distribuidora" | "madpet" | "azpetshop" | "distribuidoraInstagram";

export const SITES: Record<SiteId, { name: string; features: Features }> = {
  mypet: {
    name: "My Pet Brasil",
    features: { commerce: "quote" },
  },
  distribuidora: {
    name: "Distribuidora Petshop",
    features: { commerce: "quote" },
  },
  madpet: {
    name: "MAD PET",
    features: { commerce: "quote" },
  },
  azpetshop: {
    name: "AZ Pet Shop",
    features: { commerce: "cart" },
  },
  distribuidoraInstagram: {
    name: "Distribuidora Pet Shop",
    features: { commerce: "cart" },
  },
};
```

`commerce: "cart"` faz `showsListPrice()` retornar `true` — o preço promocional aparece direto no card, sem o `PriceLockSlot` de B2B (consistente com a decisão de checkout mínimo real).

- [ ] **Step 2: Criar `package.json` do novo app**

```json
{
  "name": "distribuidora-instagram",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 4106",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "@mypet/core": "workspace:*",
    "@supabase/ssr": "^0.8.0",
    "@vercel/analytics": "^2.0.1",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.3",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^5.2.0",
    "jsdom": "^25.0.1",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 3: Copiar configs de infraestrutura idênticas às de `apps/distribuidora`**

`apps/distribuidora-instagram/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@mypet/core"],
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "imagedelivery.net" }],
  },
};

export default nextConfig;
```

`apps/distribuidora-instagram/next.config.test.ts` (idêntico ao de `apps/distribuidora`):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("next.config", () => {
  it("publica URL e anon key usando as variáveis privadas como fallback", async () => {
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { default: config } = await import("./next.config");

    expect(config.env).toMatchObject({
      NEXT_PUBLIC_SUPABASE_URL: "https://projeto.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });
  });
});
```

`apps/distribuidora-instagram/tsconfig.json`:

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

`apps/distribuidora-instagram/postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

`apps/distribuidora-instagram/vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const appRoot = fileURLToPath(new URL(".", import.meta.url)).replace(/[/\\]$/, "");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": appRoot },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["app/**/*.test.{ts,tsx}", "*.test.ts"],
  },
});
```

`apps/distribuidora-instagram/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());
```

`apps/distribuidora-instagram/vercel.json`:

```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "outputDirectory": ".next"
}
```

`apps/distribuidora-instagram/.env.example`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 4: Criar `client.config.ts` com a paleta Distribuidora Pet Shop**

```ts
import type { ClientConfig } from "@mypet/core/theme";
import { SITES } from "@mypet/core/features";

// Identidade Distribuidora Pet Shop — hotsite de ofertas para lojistas (tráfego Instagram).
// Papéis do briefing mapeados nos slots semânticos do core (mesma estrutura de Palette
// usada por todos os apps — não existe slot "coral"/"dourado" nativo, então:
//  pink*  -> Coral promocional (#F52D45) — CTA, preço, ação
//  cyan*  -> Dourado de destaque (#F5B51B) — selos, badges, prioridade
//  navy*  -> Azul-marinho institucional (#061C5C) — cabeçalhos, fundos de impacto
//  gray*  -> Grafite (#222222) sobre branco aquecido (#F7F5F2)
export const clientConfig: ClientConfig = {
  name: "Distribuidora Pet Shop",
  tagline: "O atacado pet de todo dia",
  domain: "ofertas.distribuidorapetshop.com.br",
  catalogChannel: "ffa_fabrica",
  palette: {
    pink: "#F52D45",
    pinkDark: "#C81F34",
    pinkLight: "#FDE4E7",
    cyan: "#F5B51B",
    cyanDark: "#C68E0E",
    cyanLight: "#FDF1D6",
    navy: "#061C5C",
    navyDark: "#04123E",
    navyLight: "#E7EAF5",
    orange: "#B45309",
    green: "#16794F",
    white: "#FFFFFF",
    gray50: "#F7F5F2",
    gray100: "#EFEDEA",
    gray200: "#E2DFDB",
    gray400: "#A8A29B",
    gray600: "#5C5850",
    gray800: "#222222",
  },
  logo: { emoji: "🐾" },
  features: SITES.distribuidoraInstagram.features,
};
```

- [ ] **Step 5: Criar `app/globals.css`, `app/layout.tsx` e `app/page.tsx` mínimos**

`apps/distribuidora-instagram/app/globals.css` (idêntico ao de `apps/distribuidora`):

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-nunito);
  --font-mono: var(--font-nunito-sans);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-nunito), sans-serif;
}

html,
body {
  max-width: 100%;
  overflow-x: clip;
}

img,
svg,
video,
canvas {
  max-width: 100%;
}
```

`apps/distribuidora-instagram/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { organizationJsonLd, jsonLdScript } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${clientConfig.domain}`),
  title: `${clientConfig.name} — ${clientConfig.tagline}`,
  description: "Ofertas para lojistas: preço promocional, cupom e reposição de estoque para pet shops.",
};

export const viewport: Viewport = {
  themeColor: clientConfig.palette.navy,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${nunitoSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd(clientConfig)) }}
        />
        <ClientConfigProvider config={clientConfig}>
          <CartProvider>{children}</CartProvider>
          <Analytics />
        </ClientConfigProvider>
      </body>
    </html>
  );
}
```

`apps/distribuidora-instagram/app/page.tsx` (a home do app é a listagem de ofertas):

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/ofertas-para-lojistas");
}
```

- [ ] **Step 6: Adicionar scripts do novo app no `package.json` raiz**

Em `package.json` (raiz), adicione o script individual e inclua o app em `dev:all`:

```json
"dev:distribuidora-instagram": "pnpm --filter distribuidora-instagram dev",
```

E atualize a linha `dev:all` acrescentando `distribuidora-instagram` à lista de nomes/cores e ao comando `concurrently`:

```json
"dev:all": "concurrently -n mypet,distribuidora,madpet,admin,hub,azpetshop,distribuidora-instagram -c blue,green,yellow,magenta,cyan,red,white \"pnpm --filter mypet dev\" \"pnpm --filter distribuidora dev\" \"pnpm --filter madpet dev\" \"pnpm --filter admin dev\" \"pnpm --filter hub dev\" \"pnpm --filter azpetshop dev\" \"pnpm --filter distribuidora-instagram dev\"",
```

- [ ] **Step 7: Instalar dependências e rodar os testes de config**

Run: `pnpm install`
Expected: lockfile atualizado, novo workspace `distribuidora-instagram` reconhecido (o glob `apps/*` do `pnpm-workspace.yaml` já cobre o novo diretório).

Run: `pnpm --filter distribuidora-instagram test`
Expected: PASS (`next.config.test.ts`).

Run: `pnpm --filter distribuidora-instagram build`
Expected: build concluído sem erros (a home redireciona para `/ofertas-para-lojistas`, que ainda não existe — isso é esperado até a Task 9; se o build falhar por rota inexistente, ignore neste passo e revalide ao final da Task 9).

- [ ] **Step 8: Commit**

```bash
git add apps/distribuidora-instagram package.json packages/core/src/features.ts pnpm-lock.yaml
git commit -m "feat(distribuidora-instagram): scaffold do app com identidade Distribuidora Pet Shop"
```

---

### Task 2: Migration — `offer_campaigns` e `offer_campaign_items`

**Files:**
- Create: `supabase/migrations/20260913120000_offer_campaigns.sql`

**Interfaces:**
- Produces: `public.offer_campaigns(id, channel, slug, title, subtitle, badge, coupon_code, coupon_description, coupon_discount_pct, coupon_valid_until, freight_message, primary_cta_label, secondary_cta_label, hero_priority, flash_offer, active, starts_at, ends_at, created_at, updated_at)`.
- Produces: `public.offer_campaign_items(id, campaign_id, product_id, promotional_price, min_quantity, sort_order, created_at)`.

- [ ] **Step 1: Escrever a migração**

```sql
-- Campanhas de oferta para o hotsite de tráfego Instagram (apps/distribuidora-instagram).
-- Referenciam produtos existentes do Hub Catálogo; preço de tabela nunca é salvo aqui —
-- é sempre resolvido ao vivo a partir do preço real do produto no canal.

create table public.offer_campaigns (
  id uuid primary key default gen_random_uuid(),
  channel public.channel_kind not null,
  slug text not null,
  title text,
  subtitle text,
  badge text,
  coupon_code text,
  coupon_description text,
  coupon_discount_pct numeric check (coupon_discount_pct is null or (coupon_discount_pct >= 0 and coupon_discount_pct <= 100)),
  coupon_valid_until timestamptz,
  freight_message text,
  primary_cta_label text,
  secondary_cta_label text,
  hero_priority int not null default 0,
  flash_offer boolean not null default false,
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, slug)
);
create index offer_campaigns_channel_active_idx on public.offer_campaigns (channel, active);

create table public.offer_campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.offer_campaigns(id) on delete cascade,
  product_id uuid not null references public.products(id),
  promotional_price numeric not null check (promotional_price > 0),
  min_quantity int not null default 1 check (min_quantity >= 1),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (campaign_id, product_id)
);
create index offer_campaign_items_campaign_idx on public.offer_campaign_items (campaign_id, sort_order);

-- RLS
alter table public.offer_campaigns enable row level security;
alter table public.offer_campaign_items enable row level security;

-- Leitura pública (sem filtro de data — a vigência é resolvida em packages/core,
-- igual ao Balcão de Negócios); escrita só admin.
create policy "anon reads offer campaigns" on public.offer_campaigns
  for select to anon using (true);
create policy "anon reads offer campaign items" on public.offer_campaign_items
  for select to anon using (true);
create policy "admins manage offer campaigns" on public.offer_campaigns
  for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
create policy "admins manage offer campaign items" on public.offer_campaign_items
  for all to authenticated
  using (auth.uid() in (select id from public.admin_users))
  with check (auth.uid() in (select id from public.admin_users));
```

- [ ] **Step 2: Aplicar a migração no ambiente Supabase configurado**

Run: `pnpm exec supabase db push`
Expected: as duas tabelas, os índices e as políticas de RLS são criados sem alterar nenhuma tabela existente.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260913120000_offer_campaigns.sql
git commit -m "feat(hub): adiciona offer_campaigns e offer_campaign_items"
```

---

### Task 3: `CartItem` — campos opcionais de campanha

**Files:**
- Modify: `packages/core/src/cart.ts`
- Modify: `packages/core/src/cart.test.ts`

**Interfaces:**
- Produces: `CartItem` com os campos opcionais `campaignId?: string`, `campaignSlug?: string`, `unitPrice?: number`, `listPrice?: number`.
- Consumes: nenhuma (módulo puro, sem dependências externas).

- [ ] **Step 1: Escrever o teste que falha**

Adicione ao final de `packages/core/src/cart.test.ts` (leia o arquivo antes para manter o estilo dos testes existentes):

```ts
it("preserva os campos opcionais de campanha ao adicionar um item", () => {
  const cart = addItem(
    EMPTY_CART,
    {
      id: "p1",
      name: "Kit 11 vestidos",
      sku: "SKU-1",
      brand: null,
      img: "/img.jpg",
      campaignId: "camp-1",
      campaignSlug: "kit-11-vestidos",
      unitPrice: 199,
      listPrice: 299,
    },
    2,
  );
  expect(cart.items[0]).toMatchObject({
    campaignId: "camp-1",
    campaignSlug: "kit-11-vestidos",
    unitPrice: 199,
    listPrice: 299,
    qty: 2,
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `pnpm --filter @mypet/core test -- cart.test.ts`
Expected: FAIL — erro de tipo/propriedade `campaignId` não existe em `CartItem`.

- [ ] **Step 3: Estender o tipo `CartItem`**

Em `packages/core/src/cart.ts`, altere apenas o tipo (a lógica de `addItem`/`removeItem`/`updateQty`/`totalItems` já é genérica e não precisa mudar):

```ts
export type CartItem = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  qty: number;
  campaignId?: string;
  campaignSlug?: string;
  unitPrice?: number;
  listPrice?: number;
};
```

- [ ] **Step 4: Rodar os testes e confirmar sucesso**

Run: `pnpm --filter @mypet/core test -- cart.test.ts`
Expected: PASS, incluindo os testes já existentes (a mudança é aditiva).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/cart.ts packages/core/src/cart.test.ts
git commit -m "feat(core): CartItem aceita campos opcionais de campanha"
```

---

### Task 4: `offers-calc.ts` — tipos e regras puras

**Files:**
- Create: `packages/core/src/offers-calc.ts`
- Create: `packages/core/src/offers-calc.test.ts`
- Modify: `packages/core/package.json` (novo export)

**Interfaces:**
- Produces: `OfferCampaignStatus`, `OfferItem`, `OfferCampaign` (tipos).
- Produces: `resolveCampaignStatus(row, now?)`, `isCampaignLiveAt(row, now?)`, `calculateDiscountPct(listPrice, promotionalPrice)`, `applyCouponDiscount(price, couponDiscountPct)`.
- Produces: `ResolvedProductInfo`, `RawOfferCampaignRow`, `RawOfferItemRow`, `buildOfferItem(row, productById, realPriceByProductId)`, `buildOfferCampaign(row, productById, realPriceByProductId, now?)`.
- Consumes: nenhuma (módulo puro, sem `next/cache` nem Supabase).

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, it, expect } from "vitest";
import {
  resolveCampaignStatus,
  isCampaignLiveAt,
  calculateDiscountPct,
  applyCouponDiscount,
  buildOfferItem,
  buildOfferCampaign,
  type RawOfferCampaignRow,
  type RawOfferItemRow,
  type ResolvedProductInfo,
} from "./offers-calc";

describe("resolveCampaignStatus", () => {
  const now = new Date("2026-09-13T12:00:00Z");

  it("é draft quando active é false", () => {
    expect(resolveCampaignStatus({ active: false, starts_at: null, ends_at: null }, now)).toBe("draft");
  });

  it("é scheduled quando starts_at é futuro", () => {
    expect(
      resolveCampaignStatus({ active: true, starts_at: "2026-09-20T00:00:00Z", ends_at: null }, now),
    ).toBe("scheduled");
  });

  it("é expired quando ends_at já passou", () => {
    expect(
      resolveCampaignStatus({ active: true, starts_at: null, ends_at: "2026-09-01T00:00:00Z" }, now),
    ).toBe("expired");
  });

  it("é active dentro da janela de vigência", () => {
    expect(
      resolveCampaignStatus(
        { active: true, starts_at: "2026-09-01T00:00:00Z", ends_at: "2026-09-30T00:00:00Z" },
        now,
      ),
    ).toBe("active");
  });
});

describe("isCampaignLiveAt", () => {
  it("só é true quando o status é active", () => {
    const now = new Date("2026-09-13T12:00:00Z");
    expect(isCampaignLiveAt({ active: true, starts_at: null, ends_at: null }, now)).toBe(true);
    expect(isCampaignLiveAt({ active: false, starts_at: null, ends_at: null }, now)).toBe(false);
  });
});

describe("calculateDiscountPct", () => {
  it("calcula o percentual de desconto arredondado", () => {
    expect(calculateDiscountPct(299, 199)).toBe(33);
  });

  it("nunca retorna negativo quando o preço promocional é maior que o de tabela", () => {
    expect(calculateDiscountPct(100, 150)).toBe(0);
  });

  it("retorna 0 quando o preço de tabela é inválido", () => {
    expect(calculateDiscountPct(0, 50)).toBe(0);
  });
});

describe("applyCouponDiscount", () => {
  it("aplica o percentual do cupom sobre o preço", () => {
    expect(applyCouponDiscount(100, 10)).toBe(90);
  });

  it("devolve o preço original quando não há cupom", () => {
    expect(applyCouponDiscount(100, null)).toBe(100);
    expect(applyCouponDiscount(100, undefined)).toBe(100);
    expect(applyCouponDiscount(100, 0)).toBe(100);
  });
});

const product: ResolvedProductInfo = {
  id: "prod-1",
  name: "Kit 11 vestidos",
  reference: "SKU-1",
  description: "Kit com 11 vestidos sortidos para revenda.",
  img: "https://imagedelivery.net/kit.jpg",
};

const itemRow: RawOfferItemRow = {
  id: "item-1",
  product_id: "prod-1",
  promotional_price: "199.00",
  min_quantity: 1,
  sort_order: 0,
};

describe("buildOfferItem", () => {
  it("monta o item com desconto calculado a partir do preço real", () => {
    const item = buildOfferItem(itemRow, new Map([["prod-1", product]]), new Map([["prod-1", 299]]));
    expect(item).toMatchObject({
      productId: "prod-1",
      cpro: "SKU-1",
      name: "Kit 11 vestidos",
      listPrice: 299,
      promotionalPrice: 199,
      discountPercentage: 33,
    });
  });

  it("retorna null quando o produto não tem preço real válido", () => {
    const item = buildOfferItem(itemRow, new Map([["prod-1", product]]), new Map());
    expect(item).toBeNull();
  });

  it("retorna null quando o produto não é encontrado", () => {
    const item = buildOfferItem(itemRow, new Map(), new Map([["prod-1", 299]]));
    expect(item).toBeNull();
  });

  it("retorna null quando o preço promocional cadastrado é inválido", () => {
    const invalid: RawOfferItemRow = { ...itemRow, promotional_price: "0" };
    const item = buildOfferItem(invalid, new Map([["prod-1", product]]), new Map([["prod-1", 299]]));
    expect(item).toBeNull();
  });
});

const campaignRow: RawOfferCampaignRow = {
  id: "camp-1",
  channel: "ffa_fabrica",
  slug: "kit-11-vestidos",
  title: "Kit 11 vestidos",
  subtitle: "Reposição para o verão",
  badge: "Oferta para lojistas",
  coupon_code: "PRIMEIRACOMPRA",
  coupon_description: "10% de desconto na primeira compra",
  coupon_discount_pct: 10,
  coupon_valid_until: null,
  freight_message: "Frete grátis acima de R$ 500",
  primary_cta_label: "Aproveitar oferta",
  secondary_cta_label: "Falar com atendimento",
  hero_priority: 5,
  flash_offer: false,
  active: true,
  starts_at: null,
  ends_at: null,
  offer_campaign_items: [itemRow],
};

describe("buildOfferCampaign", () => {
  const now = new Date("2026-09-13T12:00:00Z");
  const productById = new Map([["prod-1", product]]);
  const realPriceByProductId = new Map([["prod-1", 299]]);

  it("monta a campanha com status active e cupom", () => {
    const campaign = buildOfferCampaign(campaignRow, productById, realPriceByProductId, now);
    expect(campaign).toMatchObject({
      slug: "kit-11-vestidos",
      status: "active",
      coupon: { code: "PRIMEIRACOMPRA", discountPct: 10 },
      items: [{ productId: "prod-1", discountPercentage: 33 }],
    });
  });

  it("retorna null quando nenhum item tem preço real válido", () => {
    const campaign = buildOfferCampaign(campaignRow, productById, new Map(), now);
    expect(campaign).toBeNull();
  });

  it("marca status expired sem descartar a campanha, desde que tenha item válido", () => {
    const expiredRow: RawOfferCampaignRow = { ...campaignRow, ends_at: "2026-09-01T00:00:00Z" };
    const campaign = buildOfferCampaign(expiredRow, productById, realPriceByProductId, now);
    expect(campaign?.status).toBe("expired");
  });

  it("não inclui cupom quando não há coupon_code", () => {
    const noCoupon: RawOfferCampaignRow = { ...campaignRow, coupon_code: null };
    const campaign = buildOfferCampaign(noCoupon, productById, realPriceByProductId, now);
    expect(campaign?.coupon).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

Run: `pnpm --filter @mypet/core test -- offers-calc.test.ts`
Expected: FAIL — `./offers-calc` ainda não existe.

- [ ] **Step 3: Implementar `offers-calc.ts`**

```ts
export type OfferCampaignStatus = "draft" | "scheduled" | "active" | "expired";

export type OfferItem = {
  id: string;
  productId: string;
  cpro: string;
  name: string;
  shortDescription: string | null;
  img: string;
  listPrice: number;
  promotionalPrice: number;
  discountPercentage: number;
  minQuantity: number;
  sortOrder: number;
};

export type OfferCoupon = {
  code: string;
  description: string | null;
  discountPct: number | null;
  validUntil: string | null;
};

export type OfferCampaign = {
  id: string;
  channel: string;
  slug: string;
  status: OfferCampaignStatus;
  title: string | null;
  subtitle: string | null;
  badge: string | null;
  coupon: OfferCoupon | null;
  freightMessage: string | null;
  primaryCtaLabel: string | null;
  secondaryCtaLabel: string | null;
  heroPriority: number;
  flashOffer: boolean;
  startsAt: string | null;
  endsAt: string | null;
  items: OfferItem[];
};

export function resolveCampaignStatus(
  row: { active: boolean; starts_at: string | null; ends_at: string | null },
  now: Date = new Date(),
): OfferCampaignStatus {
  if (!row.active) return "draft";
  if (row.starts_at && new Date(row.starts_at) > now) return "scheduled";
  if (row.ends_at && new Date(row.ends_at) < now) return "expired";
  return "active";
}

export function isCampaignLiveAt(
  row: { active: boolean; starts_at: string | null; ends_at: string | null },
  now: Date = new Date(),
): boolean {
  return resolveCampaignStatus(row, now) === "active";
}

export function calculateDiscountPct(listPrice: number, promotionalPrice: number): number {
  if (!Number.isFinite(listPrice) || listPrice <= 0) return 0;
  const pct = ((listPrice - promotionalPrice) / listPrice) * 100;
  return Math.max(0, Math.round(pct));
}

export function applyCouponDiscount(price: number, couponDiscountPct: number | null | undefined): number {
  if (!couponDiscountPct || couponDiscountPct <= 0) return price;
  return Math.round(price * (1 - couponDiscountPct / 100) * 100) / 100;
}

export type ResolvedProductInfo = {
  id: string;
  name: string;
  reference: string | null;
  description: string | null;
  img: string;
};

export type RawOfferItemRow = {
  id: string;
  product_id: string;
  promotional_price: number | string;
  min_quantity: number;
  sort_order: number;
};

export type RawOfferCampaignRow = {
  id: string;
  channel: string;
  slug: string;
  title: string | null;
  subtitle: string | null;
  badge: string | null;
  coupon_code: string | null;
  coupon_description: string | null;
  coupon_discount_pct: number | string | null;
  coupon_valid_until: string | null;
  freight_message: string | null;
  primary_cta_label: string | null;
  secondary_cta_label: string | null;
  hero_priority: number;
  flash_offer: boolean;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  offer_campaign_items: RawOfferItemRow[] | null;
};

export function buildOfferItem(
  row: RawOfferItemRow,
  productById: Map<string, ResolvedProductInfo>,
  realPriceByProductId: Map<string, number>,
): OfferItem | null {
  const product = productById.get(row.product_id);
  if (!product) return null;

  const listPrice = realPriceByProductId.get(row.product_id);
  if (listPrice == null || !Number.isFinite(listPrice) || listPrice <= 0) return null;

  const promotionalPrice = Number(row.promotional_price);
  if (!Number.isFinite(promotionalPrice) || promotionalPrice <= 0) return null;

  return {
    id: row.id,
    productId: row.product_id,
    cpro: product.reference ?? "",
    name: product.name,
    shortDescription: product.description,
    img: product.img,
    listPrice,
    promotionalPrice,
    discountPercentage: calculateDiscountPct(listPrice, promotionalPrice),
    minQuantity: row.min_quantity,
    sortOrder: row.sort_order,
  };
}

export function buildOfferCampaign(
  row: RawOfferCampaignRow,
  productById: Map<string, ResolvedProductInfo>,
  realPriceByProductId: Map<string, number>,
  now: Date = new Date(),
): OfferCampaign | null {
  const items = (row.offer_campaign_items ?? [])
    .map((item) => buildOfferItem(item, productById, realPriceByProductId))
    .filter((item): item is OfferItem => item !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (items.length === 0) return null;

  const couponDiscountPct = row.coupon_discount_pct == null ? null : Number(row.coupon_discount_pct);

  return {
    id: row.id,
    channel: row.channel,
    slug: row.slug,
    status: resolveCampaignStatus(row, now),
    title: row.title,
    subtitle: row.subtitle,
    badge: row.badge,
    coupon: row.coupon_code
      ? {
          code: row.coupon_code,
          description: row.coupon_description,
          discountPct: couponDiscountPct,
          validUntil: row.coupon_valid_until,
        }
      : null,
    freightMessage: row.freight_message,
    primaryCtaLabel: row.primary_cta_label,
    secondaryCtaLabel: row.secondary_cta_label,
    heroPriority: row.hero_priority,
    flashOffer: row.flash_offer,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    items,
  };
}
```

Este módulo é puro (sem `next/cache` nem Supabase) — não precisa importar nada de `./catalog-utils`.

- [ ] **Step 4: Rodar os testes e confirmar sucesso**

Run: `pnpm --filter @mypet/core test -- offers-calc.test.ts`
Expected: PASS (todos os `it` acima).

- [ ] **Step 5: Registrar o novo export do pacote**

Em `packages/core/package.json`, dentro de `"exports"`, adicione (mantendo o padrão de um export por arquivo):

```json
"./offers-calc": "./src/offers-calc.ts",
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/offers-calc.ts packages/core/src/offers-calc.test.ts packages/core/package.json
git commit -m "feat(core): offers-calc — tipos e regras puras de campanha/oferta"
```

---

### Task 5: `offers.ts` — consultas cacheadas ao Hub Catálogo

**Files:**
- Create: `packages/core/src/offers.ts`
- Modify: `packages/core/package.json` (novo export)

**Interfaces:**
- Consumes: `buildOfferCampaign`, `RawOfferCampaignRow`, `ResolvedProductInfo`, `OfferCampaign` de `./offers-calc` (Task 4); `getHubClient` de `./supabase`; `channelUsesErpPrice`, `mainImage` de `./catalog-utils`.
- Produces: `getActiveCampaigns(channel: string): Promise<OfferCampaign[]>`, `getCampaignBySlug(channel: string, slug: string): Promise<OfferCampaign | null>`.

Este módulo importa `next/cache` e o cliente Supabase — segue o mesmo aviso de `balcao.ts`: **não pode ser importado por um Client Component**. Não tem teste unitário próprio (mesma convenção de `balcao.ts`/`catalog.ts`: a lógica testável fica isolada em `offers-calc.ts`, já coberta na Task 4).

- [ ] **Step 1: Implementar `offers.ts`**

```ts
/**
 * Ofertas — fetches cacheados de campanhas do hotsite de Instagram.
 *
 * Os tipos e o cálculo de desconto/vigência vivem em `./offers-calc`
 * (client-safe, sem `next/cache`) e são reexportados aqui para preservar a
 * API pública `@mypet/core/offers`. Este módulo importa `next/cache` e o
 * cliente Supabase, então NÃO pode ser importado por um Client Component —
 * use `@mypet/core/offers-calc` nesses casos.
 */

import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import { channelUsesErpPrice, mainImage } from "./catalog-utils";
import {
  buildOfferCampaign,
  type OfferCampaign,
  type RawOfferCampaignRow,
  type ResolvedProductInfo,
} from "./offers-calc";

export * from "./offers-calc";

const OFFER_CAMPAIGN_SELECT =
  "id, channel, slug, title, subtitle, badge, coupon_code, coupon_description, coupon_discount_pct, coupon_valid_until, freight_message, primary_cta_label, secondary_cta_label, hero_priority, flash_offer, active, starts_at, ends_at, offer_campaign_items(id, product_id, promotional_price, min_quantity, sort_order)";

async function resolveProducts(channel: string, productIds: string[]): Promise<Map<string, ResolvedProductInfo>> {
  const map = new Map<string, ResolvedProductInfo>();
  if (productIds.length === 0) return map;

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("v_produtos_resolvidos")
    .select("id, name, reference, description, product_assets(url, type), product_channel_links!inner(channel)")
    .in("id", productIds)
    .eq("status", "active")
    .eq("product_channel_links.channel", channel);

  if (error) {
    console.error("[offers] erro ao resolver produtos:", error.message);
    return map;
  }

  for (const row of (data as {
    id: string;
    name: string;
    reference: string | null;
    description: string | null;
    product_assets: { url: string; type: string }[] | null;
  }[]) ?? []) {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      reference: row.reference,
      description: row.description,
      img: mainImage(row.product_assets),
    });
  }
  return map;
}

async function resolveRealPrices(
  channel: string,
  productIds: string[],
  productById: Map<string, ResolvedProductInfo>,
): Promise<Map<string, number>> {
  const priceByProductId = new Map<string, number>();
  if (productIds.length === 0) return priceByProductId;

  const supabase = getHubClient();

  if (channelUsesErpPrice(channel)) {
    const refByProductId = new Map<string, string>();
    for (const id of productIds) {
      const ref = productById.get(id)?.reference;
      if (ref) refByProductId.set(id, ref);
    }
    const refs = [...new Set(refByProductId.values())];
    if (refs.length === 0) return priceByProductId;

    const { data, error } = await supabase.from("v_precos_erp").select("reference, preco").in("reference", refs);
    if (error) {
      console.error("[offers] erro ao consultar preços do ERP:", error.message);
      return priceByProductId;
    }
    const priceByRef = new Map<string, number>();
    for (const p of (data as { reference: string | null; preco: number | string | null }[]) ?? []) {
      if (!p.reference || p.preco == null) continue;
      const v = Number(p.preco);
      if (Number.isFinite(v)) priceByRef.set(p.reference, v);
    }
    for (const [productId, ref] of refByProductId) {
      const v = priceByRef.get(ref);
      if (v != null) priceByProductId.set(productId, v);
    }
    return priceByProductId;
  }

  const { data, error } = await supabase
    .from("product_channel_prices")
    .select("product_id, sale_price")
    .eq("channel", channel)
    .in("product_id", productIds);
  if (error) {
    console.error("[offers] erro ao consultar preços do canal:", error.message);
    return priceByProductId;
  }
  for (const row of (data as { product_id: string; sale_price: number | string | null }[]) ?? []) {
    if (row.sale_price == null) continue;
    const v = Number(row.sale_price);
    if (Number.isFinite(v)) priceByProductId.set(row.product_id, v);
  }
  return priceByProductId;
}

async function queryCampaigns(
  channel: string,
  filter: (query: ReturnType<ReturnType<typeof getHubClient>["from"]>["select"]) => unknown,
): Promise<OfferCampaign[]> {
  const supabase = getHubClient();
  const base = supabase.from("offer_campaigns").select(OFFER_CAMPAIGN_SELECT).eq("channel", channel);
  const { data, error } = await (filter(base as never) as unknown as ReturnType<typeof base>);

  if (error) {
    console.error("[offers] erro ao consultar campanhas:", error.message);
    return [];
  }

  const rows = (data as unknown as RawOfferCampaignRow[]) ?? [];
  const productIds = [...new Set(rows.flatMap((r) => (r.offer_campaign_items ?? []).map((i) => i.product_id)))];
  const productById = await resolveProducts(channel, productIds);
  const realPriceByProductId = await resolveRealPrices(channel, productIds, productById);

  const now = new Date();
  return rows
    .map((row) => buildOfferCampaign(row, productById, realPriceByProductId, now))
    .filter((c): c is OfferCampaign => c !== null);
}

export async function getActiveCampaigns(channel: string): Promise<OfferCampaign[]> {
  "use cache";
  // "hours": transições de starts_at/ends_at chegam ao site em até 1h, igual ao Balcão.
  cacheLife("hours");
  cacheTag("offers");

  const campaigns = await queryCampaigns(channel, (q) => q.eq("active", true));
  return campaigns.filter((c) => c.status === "active").sort((a, b) => b.heroPriority - a.heroPriority);
}

export async function getCampaignBySlug(channel: string, slug: string): Promise<OfferCampaign | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("offers");

  const campaigns = await queryCampaigns(channel, (q) => q.eq("slug", slug));
  return campaigns[0] ?? null;
}
```

> Nota de implementação: o tipo do parâmetro `filter` em `queryCampaigns` usa `as never`/`as unknown as` para contornar a inferência genérica do builder do `@supabase/supabase-js` (o mesmo problema não aparece em `balcao.ts`/`catalog.ts` porque lá os filtros são escritos inline). Se o TypeScript reclamar na Task de build, simplifique substituindo a função `filter` por dois blocos quase idênticos (`getActiveCampaigns` e `getCampaignBySlug` cada um construindo sua própria query inline, chamando uma função privada `finishQuery(channel, rows)` que faz a parte comum a partir de `resolveProducts`/`resolveRealPrices`/`buildOfferCampaign` em diante) — isso é mais verboso mas elimina o genérico problemático.

- [ ] **Step 2: Registrar o novo export do pacote**

Em `packages/core/package.json`, dentro de `"exports"`:

```json
"./offers": "./src/offers.ts",
```

- [ ] **Step 3: Verificar a tipagem do pacote**

Run: `pnpm --filter @mypet/core exec tsc --noEmit`
Expected: sem erros. Se houver erro de inferência genérica em `queryCampaigns`, aplique a simplificação descrita na nota do Step 1.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/offers.ts packages/core/package.json
git commit -m "feat(core): offers — consultas cacheadas de campanhas ao Hub Catálogo"
```

---

### Task 6: Admin — listagem e criação de campanhas

**Files:**
- Create: `apps/admin/app/(dashboard)/marketing/ofertas/actions.ts`
- Create: `apps/admin/app/(dashboard)/marketing/ofertas/page.tsx`
- Create: `apps/admin/app/(dashboard)/marketing/ofertas/ofertas-client.tsx`
- Modify: `apps/admin/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `requireAdminSession` de `@/lib/auth` (já existente).
- Produces: Server Actions `createCampaign`, `deleteCampaign`, `toggleCampaignActive` (padrão idêntico a `marketing/banners/actions.ts`).

- [ ] **Step 1: Escrever as Server Actions**

`apps/admin/app/(dashboard)/marketing/ofertas/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { requireAdminSession } from "@/lib/auth";

const CampaignSchema = z.object({
  channel: z.enum(["ffa_fabrica"]),
  slug: z
    .string()
    .trim()
    .min(1, "Informe o slug da campanha.")
    .regex(/^[a-z0-9-]+$/, "O slug só pode ter letras minúsculas, números e hífen."),
  title: z.string().trim().nullable(),
  subtitle: z.string().trim().nullable(),
  badge: z.string().trim().nullable(),
  couponCode: z.string().trim().nullable(),
  couponDescription: z.string().trim().nullable(),
  couponDiscountPct: z.coerce.number().min(0).max(100).nullable(),
  freightMessage: z.string().trim().nullable(),
  primaryCtaLabel: z.string().trim().nullable(),
  secondaryCtaLabel: z.string().trim().nullable(),
  heroPriority: z.coerce.number().int().default(0),
  flashOffer: z.boolean().default(false),
  active: z.boolean().default(false),
  startsAt: z.string().trim().nullable(),
  endsAt: z.string().trim().nullable(),
});

const DeleteCampaignSchema = z.object({ id: z.string().uuid() });
const ToggleCampaignActiveSchema = z.object({
  id: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

export type CampaignFormState = { error?: string } | undefined;

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = value ? String(value).trim() : "";
  return s.length > 0 ? s : null;
}

export async function createCampaign(_state: CampaignFormState, formData: FormData): Promise<CampaignFormState> {
  const { supabase } = await requireAdminSession();

  const parsed = CampaignSchema.safeParse({
    channel: formData.get("channel"),
    slug: formData.get("slug"),
    title: emptyToNull(formData.get("title")),
    subtitle: emptyToNull(formData.get("subtitle")),
    badge: emptyToNull(formData.get("badge")),
    couponCode: emptyToNull(formData.get("couponCode")),
    couponDescription: emptyToNull(formData.get("couponDescription")),
    couponDiscountPct: formData.get("couponDiscountPct") ? formData.get("couponDiscountPct") : null,
    freightMessage: emptyToNull(formData.get("freightMessage")),
    primaryCtaLabel: emptyToNull(formData.get("primaryCtaLabel")),
    secondaryCtaLabel: emptyToNull(formData.get("secondaryCtaLabel")),
    heroPriority: formData.get("heroPriority") ?? 0,
    flashOffer: formData.get("flashOffer") === "on",
    active: formData.get("active") === "on",
    startsAt: emptyToNull(formData.get("startsAt")),
    endsAt: emptyToNull(formData.get("endsAt")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase.from("offer_campaigns").insert({
    channel: parsed.data.channel,
    slug: parsed.data.slug,
    title: parsed.data.title,
    subtitle: parsed.data.subtitle,
    badge: parsed.data.badge,
    coupon_code: parsed.data.couponCode,
    coupon_description: parsed.data.couponDescription,
    coupon_discount_pct: parsed.data.couponDiscountPct,
    freight_message: parsed.data.freightMessage,
    primary_cta_label: parsed.data.primaryCtaLabel,
    secondary_cta_label: parsed.data.secondaryCtaLabel,
    hero_priority: parsed.data.heroPriority,
    flash_offer: parsed.data.flashOffer,
    active: parsed.data.active,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
  });

  if (error) {
    console.error("[admin/ofertas] erro ao criar campanha:", error.message);
    if (error.code === "23505") return { error: "Já existe uma campanha com esse slug nesse canal." };
    return { error: "Não foi possível salvar a campanha." };
  }

  updateTag("offers");
  return undefined;
}

export async function deleteCampaign(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = DeleteCampaignSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const { error } = await supabase.from("offer_campaigns").delete().eq("id", parsed.data.id);
  if (error) {
    console.error("[admin/ofertas] erro ao excluir campanha:", error.message);
    return;
  }
  updateTag("offers");
}

export async function toggleCampaignActive(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = ToggleCampaignActiveSchema.safeParse({
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success) return;

  const active = parsed.data.active === "true";
  const { error } = await supabase
    .from("offer_campaigns")
    .update({ active: !active, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("[admin/ofertas] erro ao alternar campanha:", error.message);
    return;
  }
  updateTag("offers");
}
```

- [ ] **Step 2: Página de listagem (Server Component)**

`apps/admin/app/(dashboard)/marketing/ofertas/page.tsx`:

```tsx
import { requireAdminSession } from "@/lib/auth";
import OfertasPageClient from "./ofertas-client";

export default async function OfertasPageData() {
  const { supabase } = await requireAdminSession();
  const { data } = await supabase
    .from("offer_campaigns")
    .select("id, channel, slug, title, active, starts_at, ends_at, hero_priority, flash_offer")
    .order("created_at", { ascending: false });

  return <OfertasPageClient campaigns={data ?? []} />;
}
```

- [ ] **Step 3: Componente de cliente (formulário + lista)**

`apps/admin/app/(dashboard)/marketing/ofertas/ofertas-client.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createCampaign, deleteCampaign, toggleCampaignActive, type CampaignFormState } from "./actions";

type CampaignRow = {
  id: string;
  channel: string;
  slug: string;
  title: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  hero_priority: number;
  flash_offer: boolean;
};

export default function OfertasPageClient({ campaigns }: { campaigns: CampaignRow[] }) {
  const [state, formAction, pending] = useActionState<CampaignFormState, FormData>(createCampaign, undefined);

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Marketing → Ofertas</h1>

      <form action={formAction} className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Canal</label>
            <select name="channel" defaultValue="ffa_fabrica" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="ffa_fabrica">FFA Fábrica (Distribuidora)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Slug (URL da campanha)</label>
            <input name="slug" placeholder="kit-11-vestidos" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Prioridade no hero</label>
            <input name="heroPriority" type="number" defaultValue={0} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Título</label>
            <input name="title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Subtítulo</label>
            <input name="subtitle" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Selo</label>
            <input name="badge" placeholder="Oferta para lojistas" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cupom (código)</label>
            <input name="couponCode" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Descrição do cupom</label>
            <input name="couponDescription" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Desconto do cupom (%)</label>
            <input name="couponDiscountPct" type="number" min={0} max={100} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Mensagem de frete</label>
          <input name="freightMessage" placeholder="Frete grátis acima de R$ 500" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">CTA principal</label>
            <input name="primaryCtaLabel" placeholder="Aproveitar oferta" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">CTA secundário</label>
            <input name="secondaryCtaLabel" placeholder="Falar com atendimento" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Início da vigência</label>
            <input name="startsAt" type="datetime-local" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Fim da vigência</label>
            <input name="endsAt" type="datetime-local" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <input id="flashOffer" name="flashOffer" type="checkbox" />
            <label htmlFor="flashOffer" className="text-sm text-slate-600">Oferta relâmpago</label>
          </div>
          <div className="flex items-end gap-2">
            <input id="active" name="active" type="checkbox" />
            <label htmlFor="active" className="text-sm text-slate-600">Ativa</label>
          </div>
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button type="submit" disabled={pending} className="w-fit rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Enviando…" : "Criar campanha"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {campaigns.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">{c.title ?? c.slug}</p>
              <p className="text-xs text-slate-500">
                /{c.slug} · {c.channel} · prioridade {c.hero_priority} {c.flash_offer ? "· relâmpago" : ""} {c.active ? "· ativa" : "· inativa"}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/marketing/ofertas/${c.id}`}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Itens
              </Link>
              <form action={toggleCampaignActive}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={String(c.active)} />
                <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  {c.active ? "Desativar" : "Ativar"}
                </button>
              </form>
              <form action={deleteCampaign}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                  Excluir
                </button>
              </form>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && <p className="text-sm text-slate-400">Nenhuma campanha cadastrada.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Adicionar o link no menu do admin**

Em `apps/admin/app/(dashboard)/layout.tsx`, dentro do bloco "Marketing" (logo depois do `<Link href="/marketing/banners">`):

```tsx
<Link
  href="/marketing/ofertas"
  className="rounded-lg px-3 py-2 pl-6 text-sm font-medium text-slate-600 hover:bg-slate-100"
>
  Ofertas
</Link>
```

- [ ] **Step 5: Rodar o build do admin**

Run: `pnpm --filter admin build`
Expected: build concluído sem erros de tipo (a rota `/marketing/ofertas/[id]` referenciada pelo link "Itens" é criada na Task 7 — até lá o link aponta para uma página inexistente, o que não quebra o build).

- [ ] **Step 6: Commit**

```bash
git add "apps/admin/app/(dashboard)/marketing/ofertas" "apps/admin/app/(dashboard)/layout.tsx"
git commit -m "feat(admin): CRUD de campanhas em Marketing -> Ofertas"
```

---

### Task 7: Admin — detalhe da campanha e gestão de itens

**Files:**
- Modify: `apps/admin/app/(dashboard)/marketing/ofertas/actions.ts`
- Create: `apps/admin/app/(dashboard)/marketing/ofertas/[id]/page.tsx`
- Create: `apps/admin/app/(dashboard)/marketing/ofertas/[id]/itens-client.tsx`

**Interfaces:**
- Consumes: `requireAdminSession` de `@/lib/auth`.
- Produces: Server Actions `addCampaignItem`, `removeCampaignItem` em `actions.ts`.

- [ ] **Step 1: Adicionar as Server Actions de item em `actions.ts`**

Ao final de `apps/admin/app/(dashboard)/marketing/ofertas/actions.ts`, adicione:

```ts
const AddItemSchema = z.object({
  campaignId: z.string().uuid(),
  productReference: z.string().trim().min(1, "Informe a referência (CPRO/SKU) do produto."),
  promotionalPrice: z.coerce.number().positive("O preço promocional precisa ser maior que zero."),
  minQuantity: z.coerce.number().int().min(1).default(1),
  sortOrder: z.coerce.number().int().default(0),
});

const RemoveItemSchema = z.object({ id: z.string().uuid() });

export type AddItemFormState = { error?: string } | undefined;

export async function addCampaignItem(_state: AddItemFormState, formData: FormData): Promise<AddItemFormState> {
  const { supabase } = await requireAdminSession();

  const parsed = AddItemSchema.safeParse({
    campaignId: formData.get("campaignId"),
    productReference: formData.get("productReference"),
    promotionalPrice: formData.get("promotionalPrice"),
    minQuantity: formData.get("minQuantity") || 1,
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data: campaign } = await supabase
    .from("offer_campaigns")
    .select("channel")
    .eq("id", parsed.data.campaignId)
    .single();
  if (!campaign) return { error: "Campanha não encontrada." };

  const { data: product } = await supabase
    .from("products")
    .select("id, product_channel_links!inner(channel)")
    .eq("reference", parsed.data.productReference)
    .eq("product_channel_links.channel", campaign.channel)
    .maybeSingle();
  if (!product) return { error: "Produto não encontrado nesse canal (confira a referência/CPRO)." };

  const { error } = await supabase.from("offer_campaign_items").insert({
    campaign_id: parsed.data.campaignId,
    product_id: product.id,
    promotional_price: parsed.data.promotionalPrice,
    min_quantity: parsed.data.minQuantity,
    sort_order: parsed.data.sortOrder,
  });

  if (error) {
    console.error("[admin/ofertas] erro ao adicionar item:", error.message);
    if (error.code === "23505") return { error: "Esse produto já está nessa campanha." };
    return { error: "Não foi possível adicionar o item." };
  }

  updateTag("offers");
  return undefined;
}

export async function removeCampaignItem(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = RemoveItemSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const { error } = await supabase.from("offer_campaign_items").delete().eq("id", parsed.data.id);
  if (error) {
    console.error("[admin/ofertas] erro ao remover item:", error.message);
    return;
  }
  updateTag("offers");
}
```

- [ ] **Step 2: Página de detalhe (Server Component)**

`apps/admin/app/(dashboard)/marketing/ofertas/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import ItensPageClient from "./itens-client";

export default async function OfertaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdminSession();

  const { data: campaign } = await supabase
    .from("offer_campaigns")
    .select("id, slug, title, channel")
    .eq("id", id)
    .single();
  if (!campaign) notFound();

  const { data: items } = await supabase
    .from("offer_campaign_items")
    .select("id, product_id, promotional_price, min_quantity, sort_order, products(name, reference)")
    .eq("campaign_id", id)
    .order("sort_order", { ascending: true });

  return <ItensPageClient campaign={campaign} items={items ?? []} />;
}
```

- [ ] **Step 3: Componente de cliente (formulário de item + lista)**

`apps/admin/app/(dashboard)/marketing/ofertas/[id]/itens-client.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addCampaignItem, removeCampaignItem, type AddItemFormState } from "../actions";

type ItemRow = {
  id: string;
  product_id: string;
  promotional_price: number;
  min_quantity: number;
  sort_order: number;
  products: { name: string; reference: string | null } | null;
};

export default function ItensPageClient({
  campaign,
  items,
}: {
  campaign: { id: string; slug: string; title: string | null; channel: string };
  items: ItemRow[];
}) {
  const [state, formAction, pending] = useActionState<AddItemFormState, FormData>(addCampaignItem, undefined);

  return (
    <div>
      <Link href="/marketing/ofertas" className="mb-4 inline-block text-sm text-slate-500 hover:underline">
        ← Voltar para campanhas
      </Link>
      <h1 className="mb-1 text-xl font-bold text-slate-800">{campaign.title ?? campaign.slug}</h1>
      <p className="mb-6 text-sm text-slate-500">/ofertas-para-lojistas/{campaign.slug} · {campaign.channel}</p>

      <form action={formAction} className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-6">
        <input type="hidden" name="campaignId" value={campaign.id} />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Referência (CPRO/SKU)</label>
          <input name="productReference" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Preço promocional</label>
          <input name="promotionalPrice" type="number" step="0.01" min="0.01" required className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Qtd. mínima</label>
          <input name="minQuantity" type="number" min={1} defaultValue={1} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
          <input name="sortOrder" type="number" defaultValue={0} className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={pending} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Adicionando…" : "Adicionar item"}
        </button>
        {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      </form>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">{item.products?.name ?? item.product_id}</p>
              <p className="text-xs text-slate-500">
                Ref: {item.products?.reference ?? "—"} · Promo: R$ {Number(item.promotional_price).toFixed(2)} · Mín: {item.min_quantity} · Ordem: {item.sort_order}
              </p>
            </div>
            <form action={removeCampaignItem}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                Remover
              </button>
            </form>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">Nenhum produto nessa campanha ainda.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar o build do admin**

Run: `pnpm --filter admin build`
Expected: build concluído sem erros (a rota dinâmica `[id]` agora existe, resolvendo o link "Itens" da Task 6).

- [ ] **Step 5: Commit**

```bash
git add "apps/admin/app/(dashboard)/marketing/ofertas"
git commit -m "feat(admin): gestao de itens da campanha (adicionar/remover produto)"
```

---

### Task 8: Componentes de UI da oferta (`packages/core/components`)

**Files:**
- Create: `packages/core/src/components/offer-price.tsx`
- Create: `packages/core/src/components/offer-price.test.tsx`
- Create: `packages/core/src/components/offer-card.tsx`
- Create: `packages/core/src/components/offer-card.test.tsx`
- Create: `packages/core/src/components/coupon-card.tsx`
- Create: `packages/core/src/components/campaign-countdown.tsx`
- Create: `packages/core/src/components/campaign-countdown.test.tsx`
- Create: `packages/core/src/components/offers-error-state.tsx`
- Modify: `packages/core/package.json` (novos exports em `./components/*`, já cobertos pelo glob existente)

**Interfaces:**
- Consumes: `OfferItem`, `OfferCoupon` de `../offers-calc`; `useClientConfig` de `../theme`; `AddToCartControl` de `./add-to-cart-control` (já existente).
- Produces: `OfferPrice`, `OfferCard`, `CouponCard`, `CampaignCountdown`, `OffersErrorState`.

O glob `"./components/*": "./src/components/*.tsx"` já existente em `packages/core/package.json` cobre esses arquivos — não é necessário nenhuma alteração no `package.json` além de conferir que o glob já existe (ele já existe, ver Task 1 do relatório de investigação).

- [ ] **Step 1: `OfferPrice` — testes que falham**

`packages/core/src/components/offer-price.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientConfigProvider } from "../theme";
import { OfferPrice } from "./offer-price";
import { testClientConfig } from "../test-utils/client-config";

describe("OfferPrice", () => {
  it("exibe preço de tabela riscado, preço promocional e percentual de desconto", () => {
    render(
      <ClientConfigProvider config={testClientConfig}>
        <OfferPrice listPrice={299} promotionalPrice={199} discountPercentage={33} />
      </ClientConfigProvider>,
    );
    expect(screen.getByText("R$ 299,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 199,00")).toBeInTheDocument();
    expect(screen.getByText("-33%")).toBeInTheDocument();
  });

  it("não exibe o preço riscado quando é igual ao promocional", () => {
    render(
      <ClientConfigProvider config={testClientConfig}>
        <OfferPrice listPrice={199} promotionalPrice={199} discountPercentage={0} />
      </ClientConfigProvider>,
    );
    expect(screen.queryByText("-0%")).not.toBeInTheDocument();
  });
});
```

Crie o fixture compartilhado `packages/core/src/test-utils/client-config.ts` (evita repetir um `ClientConfig` completo em cada teste de componente):

```ts
import type { ClientConfig } from "../theme";

export const testClientConfig: ClientConfig = {
  name: "Distribuidora Pet Shop",
  tagline: "O atacado pet de todo dia",
  domain: "ofertas.test",
  catalogChannel: "ffa_fabrica",
  palette: {
    pink: "#F52D45",
    pinkDark: "#C81F34",
    pinkLight: "#FDE4E7",
    cyan: "#F5B51B",
    cyanDark: "#C68E0E",
    cyanLight: "#FDF1D6",
    navy: "#061C5C",
    navyDark: "#04123E",
    navyLight: "#E7EAF5",
    orange: "#B45309",
    green: "#16794F",
    white: "#FFFFFF",
    gray50: "#F7F5F2",
    gray100: "#EFEDEA",
    gray200: "#E2DFDB",
    gray400: "#A8A29B",
    gray600: "#5C5850",
    gray800: "#222222",
  },
  logo: { emoji: "🐾" },
  features: { commerce: "cart" },
};
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

Run: `pnpm --filter @mypet/core test -- offer-price.test.tsx`
Expected: FAIL — `./offer-price` ainda não existe.

- [ ] **Step 3: Implementar `OfferPrice`**

`packages/core/src/components/offer-price.tsx`:

```tsx
"use client";

import { useClientConfig } from "../theme";
import { formatPrice } from "../catalog-utils";

export function OfferPrice({
  listPrice,
  promotionalPrice,
  discountPercentage,
}: {
  listPrice: number;
  promotionalPrice: number;
  discountPercentage: number;
}) {
  const { palette } = useClientConfig();
  const showsDiscount = discountPercentage > 0 && listPrice > promotionalPrice;

  return (
    <div>
      {showsDiscount && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, color: palette.gray400, textDecoration: "line-through" }}>
            {formatPrice(listPrice)}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: palette.white,
              background: palette.pink,
              padding: "2px 8px",
              borderRadius: 6,
            }}
          >
            -{discountPercentage}%
          </span>
        </div>
      )}
      <div style={{ fontSize: 28, fontWeight: 900, color: palette.navy, lineHeight: 1.1 }}>
        {formatPrice(promotionalPrice)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar sucesso**

Run: `pnpm --filter @mypet/core test -- offer-price.test.tsx`
Expected: PASS.

- [ ] **Step 5: `OfferCard` — teste que falha**

`packages/core/src/components/offer-card.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientConfigProvider } from "../theme";
import { CartProvider } from "./cart-provider";
import { OfferCard } from "./offer-card";
import { testClientConfig } from "../test-utils/client-config";
import type { OfferItem } from "../offers-calc";

const item: OfferItem = {
  id: "item-1",
  productId: "prod-1",
  cpro: "SKU-1",
  name: "Kit 11 vestidos",
  shortDescription: "Kit com 11 vestidos sortidos.",
  img: "/kit.jpg",
  listPrice: 299,
  promotionalPrice: 199,
  discountPercentage: 33,
  minQuantity: 1,
  sortOrder: 0,
};

function renderCard(campaignSlug = "kit-11-vestidos") {
  return render(
    <ClientConfigProvider config={testClientConfig}>
      <CartProvider>
        <OfferCard item={item} campaignId="camp-1" campaignSlug={campaignSlug} />
      </CartProvider>
    </ClientConfigProvider>,
  );
}

describe("OfferCard", () => {
  it("exibe nome, preço promocional e link para a landing da campanha", () => {
    renderCard();
    expect(screen.getByText("Kit 11 vestidos")).toBeInTheDocument();
    expect(screen.getByText("R$ 199,00")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Kit 11 vestidos/i });
    expect(link).toHaveAttribute("href", "/ofertas-para-lojistas/kit-11-vestidos");
  });
});
```

- [ ] **Step 6: Rodar o teste e confirmar falha**

Run: `pnpm --filter @mypet/core test -- offer-card.test.tsx`
Expected: FAIL — `./offer-card` ainda não existe.

- [ ] **Step 7: Implementar `OfferCard`**

`packages/core/src/components/offer-card.tsx`:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useClientConfig } from "../theme";
import { OfferPrice } from "./offer-price";
import { AddToCartControl } from "./add-to-cart-control";
import type { OfferItem } from "../offers-calc";

export function OfferCard({
  item,
  campaignId,
  campaignSlug,
}: {
  item: OfferItem;
  campaignId: string;
  campaignSlug: string;
}) {
  const { palette } = useClientConfig();
  const href = `/ofertas-para-lojistas/${campaignSlug}`;

  return (
    <div
      style={{
        background: palette.white,
        border: `1px solid ${palette.gray200}`,
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 2px 10px rgba(6,28,92,0.06)",
      }}
    >
      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        <div style={{ position: "relative", aspectRatio: "1 / 1", width: "100%", background: palette.gray50 }}>
          <Image src={item.img} alt={item.name} fill sizes="(max-width: 640px) 50vw, 280px" style={{ objectFit: "contain" }} />
        </div>
        <div style={{ padding: "12px 14px 0" }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: palette.navy, lineHeight: 1.3, marginBottom: 8 }}>
            {item.name}
          </h3>
        </div>
      </Link>
      <div style={{ padding: "0 14px 14px" }}>
        <OfferPrice listPrice={item.listPrice} promotionalPrice={item.promotionalPrice} discountPercentage={item.discountPercentage} />
        <AddToCartControl
          product={{
            id: item.productId,
            name: item.name,
            sku: item.cpro,
            brand: null,
            img: item.img,
            campaignId,
            campaignSlug,
            unitPrice: item.promotionalPrice,
            listPrice: item.listPrice,
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Rodar o teste e confirmar sucesso**

Run: `pnpm --filter @mypet/core test -- offer-card.test.tsx`
Expected: PASS.

- [ ] **Step 9: `CampaignCountdown` — teste que falha**

`packages/core/src/components/campaign-countdown.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientConfigProvider } from "../theme";
import { CampaignCountdown } from "./campaign-countdown";
import { testClientConfig } from "../test-utils/client-config";

describe("CampaignCountdown", () => {
  it("não renderiza nada quando não há endsAt", () => {
    const { container } = render(
      <ClientConfigProvider config={testClientConfig}>
        <CampaignCountdown endsAt={null} />
      </ClientConfigProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada quando endsAt já passou", () => {
    const { container } = render(
      <ClientConfigProvider config={testClientConfig}>
        <CampaignCountdown endsAt="2020-01-01T00:00:00Z" />
      </ClientConfigProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza a contagem quando há uma data futura", () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    render(
      <ClientConfigProvider config={testClientConfig}>
        <CampaignCountdown endsAt={future} />
      </ClientConfigProvider>,
    );
    expect(screen.getByTestId("campaign-countdown")).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Rodar o teste e confirmar falha**

Run: `pnpm --filter @mypet/core test -- campaign-countdown.test.tsx`
Expected: FAIL — `./campaign-countdown` ainda não existe.

- [ ] **Step 11: Implementar `CampaignCountdown`**

`packages/core/src/components/campaign-countdown.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useClientConfig } from "../theme";

function msToParts(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function CampaignCountdown({ endsAt }: { endsAt: string | null }) {
  const { palette } = useClientConfig();
  const endsAtMs = endsAt ? new Date(endsAt).getTime() : null;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAtMs) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAtMs]);

  if (!endsAtMs || now === null || endsAtMs <= now) return null;

  const { hours, minutes, seconds } = msToParts(endsAtMs - now);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      data-testid="campaign-countdown"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: palette.navy,
        color: palette.white,
        borderRadius: 100,
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      ⚡ Termina em {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </div>
  );
}
```

- [ ] **Step 12: Rodar o teste e confirmar sucesso**

Run: `pnpm --filter @mypet/core test -- campaign-countdown.test.tsx`
Expected: PASS.

- [ ] **Step 13: Implementar `CouponCard` (sem teste dedicado — cópia para clipboard depende de API do navegador não disponível em jsdom por padrão; cobertura vem do teste de integração da landing na Task 10)**

`packages/core/src/components/coupon-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useClientConfig } from "../theme";
import type { OfferCoupon } from "../offers-calc";

export function CouponCard({ coupon }: { coupon: OfferCoupon }) {
  const { palette } = useClientConfig();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível (ex: contexto não seguro) — sem ação além de manter o código visível.
    }
  };

  return (
    <div
      style={{
        border: `1.5px dashed ${palette.pink}`,
        borderRadius: 12,
        padding: "14px 16px",
        background: palette.pinkLight,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>
        <p style={{ fontSize: 12, color: palette.gray600, marginBottom: 2 }}>
          {coupon.description ?? "Cupom desta oferta"}
        </p>
        <p style={{ fontSize: 18, fontWeight: 900, color: palette.pink, letterSpacing: "0.04em" }}>{coupon.code}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        style={{
          background: copied ? palette.green : palette.pink,
          color: palette.white,
          border: "none",
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "Copiado!" : "Copiar cupom"}
      </button>
    </div>
  );
}
```

- [ ] **Step 14: Implementar `OffersErrorState` (estado de erro elegante para falha do Hub)**

`packages/core/src/components/offers-error-state.tsx`:

```tsx
"use client";

import { useClientConfig } from "../theme";

export function OffersErrorState({ message = "Não foi possível carregar as ofertas agora." }: { message?: string }) {
  const { palette } = useClientConfig();
  return (
    <div
      style={{
        maxWidth: 480,
        margin: "60px auto",
        textAlign: "center",
        padding: "32px 24px",
        background: palette.white,
        border: `1px solid ${palette.gray200}`,
        borderRadius: 16,
      }}
    >
      <p style={{ fontSize: 32, marginBottom: 12 }}>⚠️</p>
      <p style={{ fontSize: 15, color: palette.gray800, fontWeight: 700, marginBottom: 8 }}>{message}</p>
      <p style={{ fontSize: 13, color: palette.gray600, marginBottom: 20 }}>
        Isso costuma ser temporário. Tente novamente em instantes.
      </p>
      <a
        href="."
        style={{
          display: "inline-block",
          background: palette.navy,
          color: palette.white,
          borderRadius: 100,
          padding: "10px 24px",
          fontSize: 14,
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        Tentar novamente
      </a>
    </div>
  );
}
```

- [ ] **Step 15: Commit**

```bash
git add packages/core/src/components/offer-price.tsx packages/core/src/components/offer-price.test.tsx \
  packages/core/src/components/offer-card.tsx packages/core/src/components/offer-card.test.tsx \
  packages/core/src/components/campaign-countdown.tsx packages/core/src/components/campaign-countdown.test.tsx \
  packages/core/src/components/coupon-card.tsx packages/core/src/components/offers-error-state.tsx \
  packages/core/src/test-utils/client-config.ts
git commit -m "feat(core): componentes de UI de oferta (OfferPrice, OfferCard, CouponCard, CampaignCountdown, OffersErrorState)"
```

---

### Task 9: Página `/ofertas-para-lojistas` (home)

**Files:**
- Create: `apps/distribuidora-instagram/app/ofertas-para-lojistas/page.tsx`
- Create: `apps/distribuidora-instagram/app/ofertas-para-lojistas/home-content.test.mjs`

**Interfaces:**
- Consumes: `getActiveCampaigns` de `@mypet/core/offers`; `OfferCard`, `CampaignCountdown`, `OffersErrorState` de `@mypet/core/components/*`; `clientConfig` de `@/client.config`.

- [ ] **Step 1: Escrever o teste de regressão de conteúdo (mesmo padrão de `apps/distribuidora/app/home-content.test.mjs`)**

`apps/distribuidora-instagram/app/ofertas-para-lojistas/home-content.test.mjs`:

```mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("home de ofertas trata falha do Hub com estado de erro, sem preço em cache exibido como atual", async () => {
  const src = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(src, /catch/);
  assert.match(src, /OffersErrorState/);
});

test("home de ofertas separa a seção de ofertas relâmpago das demais", async () => {
  const src = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(src, /flashOffer/);
  assert.match(src, /CampaignCountdown/);
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `pnpm --filter distribuidora-instagram test -- home-content.test.mjs`
Expected: FAIL — `page.tsx` ainda não existe.

- [ ] **Step 3: Implementar a página**

`apps/distribuidora-instagram/app/ofertas-para-lojistas/page.tsx`:

```tsx
import Link from "next/link";
import { getActiveCampaigns } from "@mypet/core/offers";
import { OfferCard } from "@mypet/core/components/offer-card";
import { CampaignCountdown } from "@mypet/core/components/campaign-countdown";
import { OffersErrorState } from "@mypet/core/components/offers-error-state";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

export const metadata = {
  title: `Ofertas para lojistas — ${clientConfig.name}`,
  description: clientConfig.tagline,
};

export default async function OfertasParaLojistasPage() {
  let campaigns;
  try {
    campaigns = await getActiveCampaigns(clientConfig.catalogChannel);
  } catch (err) {
    console.error("[ofertas-para-lojistas] erro ao carregar campanhas:", err);
    return (
      <div style={{ background: PALETTE.gray50, minHeight: "100vh" }}>
        <OffersErrorState message="Não foi possível carregar as ofertas agora." />
      </div>
    );
  }

  const flashCampaigns = campaigns.filter((c) => c.flashOffer && c.endsAt);
  const regularCampaigns = campaigns.filter((c) => !c.flashOffer || !c.endsAt);

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      {/* BARRA DE CAMPANHA */}
      <div style={{ background: PALETTE.navy, color: PALETTE.white, textAlign: "center", padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>
        Ofertas reais para lojistas — preço e vigência sempre atualizados
      </div>

      {/* HERO */}
      <section style={{ background: `linear-gradient(135deg, ${PALETTE.navy} 0%, ${PALETTE.navyDark} 100%)`, padding: "48px 24px", textAlign: "center" }}>
        <span style={{ fontSize: 32 }}>{clientConfig.logo.emoji}</span>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: PALETTE.white, margin: "12px 0 6px", letterSpacing: "0.01em" }}>
          OFERTAS PARA LOJISTAS
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", marginBottom: 20 }}>{clientConfig.tagline}</p>
        {campaigns[0] && (
          <a
            href={`#${campaigns[0].slug}`}
            style={{
              display: "inline-block",
              background: PALETTE.pink,
              color: PALETTE.white,
              borderRadius: 100,
              padding: "14px 32px",
              fontSize: 15,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            Ver ofertas
          </a>
        )}
      </section>

      {campaigns.length === 0 ? (
        <div style={{ padding: "60px 24px", textAlign: "center" }}>
          <p style={{ color: PALETTE.gray600 }}>Nenhuma oferta ativa no momento. Volte em breve.</p>
        </div>
      ) : (
        <>
          {flashCampaigns.length > 0 && (
            <section style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 0" }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: PALETTE.navy, marginBottom: 16 }}>⚡ Ofertas relâmpago</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                {flashCampaigns.map((campaign) => (
                  <div key={campaign.id} id={campaign.slug}>
                    <div style={{ marginBottom: 8 }}>
                      <CampaignCountdown endsAt={campaign.endsAt} />
                    </div>
                    {campaign.items[0] && (
                      <OfferCard item={campaign.items[0]} campaignId={campaign.id} campaignSlug={campaign.slug} />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 80px" }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: PALETTE.navy, marginBottom: 16 }}>Ofertas em destaque</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {regularCampaigns.map((campaign) =>
                campaign.items[0] ? (
                  <div key={campaign.id} id={campaign.slug}>
                    <OfferCard item={campaign.items[0]} campaignId={campaign.id} campaignSlug={campaign.slug} />
                  </div>
                ) : null,
              )}
            </div>
          </section>
        </>
      )}

      <footer style={{ background: PALETTE.navyDark, padding: 24, textAlign: "center" }}>
        <Link href="/ofertas-para-lojistas" style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textDecoration: "none" }}>
          {clientConfig.name} — {clientConfig.tagline}
        </Link>
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar sucesso**

Run: `pnpm --filter distribuidora-instagram test -- home-content.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/distribuidora-instagram/app/ofertas-para-lojistas/page.tsx apps/distribuidora-instagram/app/ofertas-para-lojistas/home-content.test.mjs
git commit -m "feat(distribuidora-instagram): home de ofertas para lojistas"
```

---

### Task 10: Página `/ofertas-para-lojistas/[slug]` (landing) e `/carrinho` (resumo)

**Files:**
- Create: `apps/distribuidora-instagram/app/ofertas-para-lojistas/[slug]/page.tsx`
- Create: `apps/distribuidora-instagram/app/ofertas-para-lojistas/[slug]/landing-content.test.mjs`
- Create: `apps/distribuidora-instagram/app/carrinho/page.tsx`
- Create: `apps/distribuidora-instagram/app/carrinho/carrinho-content.tsx`
- Create: `apps/distribuidora-instagram/app/carrinho/carrinho-content.test.tsx`

**Interfaces:**
- Consumes: `getCampaignBySlug` de `@mypet/core/offers`; `OfferPrice`, `CouponCard`, `CampaignCountdown`, `OffersErrorState` de `@mypet/core/components/*`; `AddToCartControl` de `@mypet/core/components/add-to-cart-control`; `useCart` de `@mypet/core/components/cart-provider`.

- [ ] **Step 1: Escrever o teste de regressão de conteúdo da landing**

`apps/distribuidora-instagram/app/ofertas-para-lojistas/[slug]/landing-content.test.mjs`:

```mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("landing de campanha nunca exibe preço quando a campanha não é encontrada", async () => {
  const src = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(src, /notFound\(\)|campaign === null/);
});

test("landing de campanha trata status expired sem permitir compra", async () => {
  const src = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(src, /expired/);
  assert.match(src, /oferta encerrada/i);
});

test("landing de campanha trata falha do Hub com estado de erro", async () => {
  const src = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(src, /catch/);
  assert.match(src, /OffersErrorState/);
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `pnpm --filter distribuidora-instagram test -- landing-content.test.mjs`
Expected: FAIL — `page.tsx` ainda não existe.

- [ ] **Step 3: Implementar a landing**

`apps/distribuidora-instagram/app/ofertas-para-lojistas/[slug]/page.tsx`:

```tsx
import Link from "next/link";
import { getCampaignBySlug } from "@mypet/core/offers";
import { OfferPrice } from "@mypet/core/components/offer-price";
import { CouponCard } from "@mypet/core/components/coupon-card";
import { CampaignCountdown } from "@mypet/core/components/campaign-countdown";
import { OffersErrorState } from "@mypet/core/components/offers-error-state";
import { AddToCartControl } from "@mypet/core/components/add-to-cart-control";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${slug} — ${clientConfig.name}` };
}

export default async function CampanhaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let campaign;
  try {
    campaign = await getCampaignBySlug(clientConfig.catalogChannel, slug);
  } catch (err) {
    console.error("[ofertas-para-lojistas/slug] erro ao carregar campanha:", err);
    return (
      <div style={{ background: PALETTE.gray50, minHeight: "100vh" }}>
        <OffersErrorState message="Não foi possível carregar esta oferta agora." />
      </div>
    );
  }

  if (campaign === null) {
    return (
      <div style={{ background: PALETTE.gray50, minHeight: "100vh", textAlign: "center", padding: "80px 24px" }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 12 }}>Oferta indisponível</p>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 24 }}>
          Essa oferta não existe mais ou não tem produtos disponíveis no momento.
        </p>
        <Link href="/ofertas-para-lojistas" style={{ color: PALETTE.pink, fontWeight: 700, textDecoration: "none" }}>
          Ver ofertas ativas →
        </Link>
      </div>
    );
  }

  const isPurchasable = campaign.status === "active";

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800, paddingBottom: 96 }}>
      {campaign.status === "expired" && (
        <div style={{ background: PALETTE.orange, color: PALETTE.white, textAlign: "center", padding: "10px 16px", fontSize: 13, fontWeight: 700 }}>
          Esta oferta encerrada. <Link href="/ofertas-para-lojistas" style={{ color: PALETTE.white, textDecoration: "underline" }}>Ver ofertas ativas</Link>
        </div>
      )}
      {campaign.status === "scheduled" && (
        <div style={{ background: PALETTE.cyanDark, color: PALETTE.white, textAlign: "center", padding: "10px 16px", fontSize: 13, fontWeight: 700 }}>
          Esta oferta ainda não começou.
        </div>
      )}

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px" }}>
        {campaign.badge && (
          <span
            style={{
              display: "inline-block",
              background: PALETTE.cyanLight,
              color: PALETTE.cyanDark,
              fontSize: 12,
              fontWeight: 800,
              padding: "4px 12px",
              borderRadius: 100,
              marginBottom: 12,
            }}
          >
            {campaign.badge}
          </span>
        )}

        <h1 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 4 }}>
          {campaign.title ?? campaign.items[0]?.name}
        </h1>
        {campaign.subtitle && <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 16 }}>{campaign.subtitle}</p>}

        {campaign.flashOffer && campaign.endsAt && (
          <div style={{ marginBottom: 16 }}>
            <CampaignCountdown endsAt={campaign.endsAt} />
          </div>
        )}

        {campaign.items.map((item) => (
          <div key={item.id} style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", marginBottom: 16, background: PALETTE.gray50, borderRadius: 12, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.img} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>{item.name}</h2>
            {item.shortDescription && <p style={{ fontSize: 13, color: PALETTE.gray600, marginBottom: 12 }}>{item.shortDescription}</p>}
            <OfferPrice listPrice={item.listPrice} promotionalPrice={item.promotionalPrice} discountPercentage={item.discountPercentage} />
            {campaign.freightMessage && (
              <p style={{ fontSize: 12, color: PALETTE.green, fontWeight: 700, margin: "8px 0" }}>{campaign.freightMessage}</p>
            )}
            {isPurchasable ? (
              <AddToCartControl
                product={{
                  id: item.productId,
                  name: item.name,
                  sku: item.cpro,
                  brand: null,
                  img: item.img,
                  campaignId: campaign.id,
                  campaignSlug: campaign.slug,
                  unitPrice: item.promotionalPrice,
                  listPrice: item.listPrice,
                }}
              />
            ) : (
              <p style={{ fontSize: 13, color: PALETTE.gray400, marginTop: 8 }}>Compra indisponível para esta oferta.</p>
            )}
          </div>
        ))}

        {campaign.coupon && <CouponCard coupon={campaign.coupon} />}

        {campaign.secondaryCtaLabel && (
          <p style={{ textAlign: "center", marginTop: 20 }}>
            <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""}`} style={{ fontSize: 13, color: PALETTE.gray600, textDecoration: "underline" }}>
              {campaign.secondaryCtaLabel}
            </a>
          </p>
        )}
      </main>

      {isPurchasable && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: PALETTE.white,
            borderTop: `1px solid ${PALETTE.gray200}`,
            padding: "12px 20px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Link
            href="/carrinho"
            style={{
              display: "block",
              width: "100%",
              maxWidth: 400,
              textAlign: "center",
              background: PALETTE.pink,
              color: PALETTE.white,
              borderRadius: 100,
              padding: "14px 0",
              fontWeight: 800,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            {campaign.primaryCtaLabel ?? "Ver carrinho"}
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar sucesso**

Run: `pnpm --filter distribuidora-instagram test -- landing-content.test.mjs`
Expected: PASS.

- [ ] **Step 5: Escrever o teste do carrinho resumido**

`apps/distribuidora-instagram/app/carrinho/carrinho-content.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientConfigProvider } from "@mypet/core/theme";
import { testClientConfig } from "@mypet/core/test-utils/client-config";
import CarrinhoContent from "./carrinho-content";

const mockUseCart = vi.hoisted(() => vi.fn());
vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: mockUseCart,
}));

describe("CarrinhoContent", () => {
  beforeEach(() => {
    mockUseCart.mockReset();
  });

  it("mostra mensagem de carrinho vazio quando não há itens", () => {
    mockUseCart.mockReturnValue({ cart: { items: [] }, removeItem: vi.fn(), updateQty: vi.fn(), totalItems: 0 });
    render(
      <ClientConfigProvider config={testClientConfig}>
        <CarrinhoContent />
      </ClientConfigProvider>,
    );
    expect(screen.getByText(/carrinho está vazio/i)).toBeInTheDocument();
  });

  it("lista os itens com preço promocional e total somado", () => {
    mockUseCart.mockReturnValue({
      cart: {
        items: [
          { id: "p1", name: "Kit 11 vestidos", sku: "SKU-1", brand: null, img: "/kit.jpg", qty: 2, unitPrice: 199, listPrice: 299, campaignSlug: "kit-11-vestidos" },
        ],
      },
      removeItem: vi.fn(),
      updateQty: vi.fn(),
      totalItems: 2,
    });
    render(
      <ClientConfigProvider config={testClientConfig}>
        <CarrinhoContent />
      </ClientConfigProvider>,
    );
    expect(screen.getByText("Kit 11 vestidos")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 398,00/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Rodar o teste e confirmar falha**

Run: `pnpm --filter distribuidora-instagram test -- carrinho-content.test.tsx`
Expected: FAIL — `./carrinho-content` ainda não existe.

- [ ] **Step 7: Implementar o carrinho resumido**

`apps/distribuidora-instagram/app/carrinho/carrinho-content.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useClientConfig } from "@mypet/core/theme";
import { useCart } from "@mypet/core/components/cart-provider";
import { formatPrice } from "@mypet/core/catalog-utils";

export default function CarrinhoContent() {
  const { palette } = useClientConfig();
  const { cart, removeItem, updateQty } = useCart();

  if (cart.items.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center", padding: "0 20px" }}>
        <p style={{ fontSize: 15, color: palette.gray600, marginBottom: 16 }}>Seu carrinho está vazio.</p>
        <Link href="/ofertas-para-lojistas" style={{ color: palette.pink, fontWeight: 700, textDecoration: "none" }}>
          Ver ofertas →
        </Link>
      </div>
    );
  }

  const total = cart.items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.qty, 0);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 120px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: palette.navy, marginBottom: 20 }}>Seu carrinho</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cart.items.map((item) => (
          <div key={item.id} style={{ background: palette.white, border: `1px solid ${palette.gray200}`, borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: palette.navy }}>{item.name}</p>
              <p style={{ fontSize: 13, color: palette.gray600 }}>
                {item.unitPrice != null ? formatPrice(item.unitPrice) : "Preço sob consulta"} × {item.qty}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => updateQty(item.id, item.qty - 1)} style={{ border: `1px solid ${palette.gray200}`, borderRadius: 6, background: "transparent", cursor: "pointer" }}>−</button>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{item.qty}</span>
                <button type="button" onClick={() => updateQty(item.id, item.qty + 1)} style={{ border: `1px solid ${palette.gray200}`, borderRadius: 6, background: "transparent", cursor: "pointer" }}>+</button>
                <button type="button" onClick={() => removeItem(item.id)} style={{ marginLeft: 12, border: "none", background: "transparent", color: palette.orange, cursor: "pointer", fontSize: 13 }}>Remover</button>
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: palette.navy, whiteSpace: "nowrap" }}>
              {item.unitPrice != null ? formatPrice(item.unitPrice * item.qty) : "—"}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 16, fontWeight: 900, color: palette.navy }}>
        <span>Total</span>
        <span>{formatPrice(total)}</span>
      </div>

      <p style={{ marginTop: 20, fontSize: 13, color: palette.gray600, textAlign: "center" }}>
        A finalização do pedido chega em uma próxima etapa. Por enquanto, seu carrinho fica salvo neste navegador.
      </p>
    </main>
  );
}
```

- [ ] **Step 8: Página que monta o carrinho**

`apps/distribuidora-instagram/app/carrinho/page.tsx`:

```tsx
import CarrinhoContent from "./carrinho-content";

export const metadata = { title: "Seu carrinho" };

export default function CarrinhoPage() {
  return <CarrinhoContent />;
}
```

- [ ] **Step 9: Rodar os testes e confirmar sucesso**

Run: `pnpm --filter distribuidora-instagram test`
Expected: PASS em todos os arquivos de teste do app (`next.config.test.ts`, `home-content.test.mjs`, `landing-content.test.mjs`, `carrinho-content.test.tsx`).

- [ ] **Step 10: Commit**

```bash
git add apps/distribuidora-instagram/app/ofertas-para-lojistas/[slug] apps/distribuidora-instagram/app/carrinho
git commit -m "feat(distribuidora-instagram): landing de campanha e carrinho resumido"
```

---

### Task 11: SEO (manifest/robots/sitemap) e verificação final

**Files:**
- Create: `apps/distribuidora-instagram/app/robots.ts`
- Create: `apps/distribuidora-instagram/app/sitemap.ts`

**Interfaces:**
- Consumes: `getActiveCampaigns` de `@mypet/core/offers`; `clientConfig` de `@/client.config`.

- [ ] **Step 1: `robots.ts`**

```ts
import type { MetadataRoute } from "next";
import { clientConfig } from "@/client.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/carrinho"] },
    sitemap: `https://${clientConfig.domain}/sitemap.xml`,
  };
}
```

- [ ] **Step 2: `sitemap.ts`**

```ts
import type { MetadataRoute } from "next";
import { getActiveCampaigns } from "@mypet/core/offers";
import { clientConfig } from "@/client.config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const campaigns = await getActiveCampaigns(clientConfig.catalogChannel);
  const base = `https://${clientConfig.domain}`;

  return [
    { url: `${base}/ofertas-para-lojistas`, changeFrequency: "hourly", priority: 1 },
    ...campaigns.map((c) => ({
      url: `${base}/ofertas-para-lojistas/${c.slug}`,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
  ];
}
```

- [ ] **Step 3: Rodar a suíte completa e o build de todos os apps tocados**

Run: `pnpm --filter @mypet/core test`
Expected: PASS (`cart.test.ts`, `offers-calc.test.ts`, `offer-price.test.tsx`, `offer-card.test.tsx`, `campaign-countdown.test.tsx`, testes já existentes).

Run: `pnpm --filter distribuidora-instagram test`
Expected: PASS.

Run: `pnpm --filter distribuidora-instagram build`
Expected: build concluído sem erros — todas as rotas referenciadas (`/ofertas-para-lojistas`, `/ofertas-para-lojistas/[slug]`, `/carrinho`) agora existem.

Run: `pnpm --filter admin build`
Expected: build concluído sem erros.

Run: `pnpm --filter @mypet/core exec tsc --noEmit`
Expected: sem erros de tipo.

Run: `pnpm lint`
Expected: sem erros novos introduzidos por este plano (avisos pré-existentes em outros apps não fazem parte deste escopo).

- [ ] **Step 4: Commit**

```bash
git add apps/distribuidora-instagram/app/robots.ts apps/distribuidora-instagram/app/sitemap.ts
git commit -m "feat(distribuidora-instagram): robots e sitemap das ofertas"
```

---

## Depois deste plano

- **Plano 2** (carrinho/checkout mínimo real): autenticação (magic link + `buyers`), `proxy.ts`, `/entrar`, `/completar-cadastro`, extensão de `createOrder` com `campaignId`/`couponCode`/snapshots de preço, cupom aplicando desconto real no total do carrinho, substituindo o aviso "chega em uma próxima etapa" em `carrinho-content.tsx` por um "Finalizar pedido" funcional.
- **Plano 3** (UTM + GA4 + Meta Pixel): captura/preservação de UTM via `proxy.ts`, módulo `analytics.tsx` com os dois providers e os 8 eventos do briefing.
