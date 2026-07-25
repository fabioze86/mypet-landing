# AZ Pet Shop (MAD PET) Landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new Next.js app, `apps/azpetshop`, a single-page landing for the MAD PET
sub-brand (bandanas/laços/peitorais/coleiras), reading real product data from the shared Hub
Catálogo (channel `"azpetshop"`) with WhatsApp as the only purchase CTA.

**Architecture:** New app in the existing pnpm monorepo, reusing `@mypet/core`'s catalog-fetch
and WhatsApp-link helpers, but with its own isolated palette/theme and its own presentational
components (no B2B cart/lead-gate/quote flow, which don't apply here). Product carousels are
Server Components that fetch data, delegating the interactive scroll buttons to a small Client
Component.

**Tech Stack:** Next.js 16.2.6 (App Router, Cache Components), React 19.2.4, Tailwind CSS v4
(minimal use — layout is mostly inline styles, matching the existing apps), Supabase (via
`@mypet/core/catalog`), Vitest for the two pure-function additions to `@mypet/core`.

## Global Constraints

- App name, folder, and Supabase channel are all `azpetshop` (not `madpet`). "MAD PET" is the
  brand name shown in UI copy only.
- No cart, no lead-gate/price-lock, no quote flow — every "buy" CTA is a `wa.me` link with a
  pre-filled message.
- Product data comes from the real Hub Catálogo (`products` + `product_channel_links` +
  `categories`), filtered by `channel: "azpetshop"`, `brand: "MAD PET"`, and one of 4 known
  `categoryId`s (table below) — never a local mock array.
- Category IDs (confirmed to already exist in `hub_catalogo`, project `hsguyfiyqpuligijcjlw`):
  - Bandanas → `6044f664-4c8b-58d6-9de3-a9114ea50819`
  - Laços → `af0d7456-9a3b-52e0-a406-a9b3c3e268fd`
  - Peitorais → `cb601178-eeb2-53ff-8361-d9f673259e8d`
  - Coleiras → `595fe241-fa35-5da6-8592-e49569d82a11`
- No products exist for this channel yet — every product-fetching section must render a
  graceful "em breve" empty state instead of an empty grid.
- Palette (approximate, pending brand manual): green `#7AC142`, purple `#6B2D8C`, white
  `#FFFFFF`.
- Product photos come from Cloudflare Images at `imagedelivery.net` — `next/image` needs this
  hostname allow-listed in `next.config.ts`.
- WhatsApp number via `NEXT_PUBLIC_WHATSAPP_NUMBER` env var (same convention as other apps),
  defaulting to the distribuidora's number (`5511982053694`) until MAD PET has its own.

---

### Task 1: Add `"azpetshop"` to the shared `CHANNELS` union

**Files:**
- Modify: `packages/core/src/channels.ts`
- Test: `packages/core/src/channels.test.ts`

**Interfaces:**
- Produces: `CHANNELS: readonly ["mypetbrasil", "distribuidora", "azpetshop"]`, `isChannel(value: unknown): value is Channel` (unchanged signature, now accepts `"azpetshop"`).

- [ ] **Step 1: Update the failing test**

Edit `packages/core/src/channels.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CHANNELS, isChannel } from "./channels";

describe("CHANNELS", () => {
  it("contém exatamente os três canais de site", () => {
    expect(CHANNELS).toEqual(["mypetbrasil", "distribuidora", "azpetshop"]);
  });
});

describe("isChannel", () => {
  it("aceita os canais válidos", () => {
    expect(isChannel("mypetbrasil")).toBe(true);
    expect(isChannel("distribuidora")).toBe(true);
    expect(isChannel("azpetshop")).toBe(true);
  });

  it("rejeita valores inválidos", () => {
    expect(isChannel("amazon")).toBe(false);
    expect(isChannel("")).toBe(false);
    expect(isChannel(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mypet/core test -- channels`
Expected: FAIL — `CHANNELS` still equals `["mypetbrasil", "distribuidora"]`.

- [ ] **Step 3: Update the implementation**

Edit `packages/core/src/channels.ts`:

```ts
export const CHANNELS = ["mypetbrasil", "distribuidora", "azpetshop"] as const;

export type Channel = (typeof CHANNELS)[number];

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (CHANNELS as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @mypet/core test -- channels`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/channels.ts packages/core/src/channels.test.ts
git commit -m "feat(core): adiciona canal azpetshop"
```

---

### Task 2: Add `buildProductInterestMessage` to `@mypet/core/whatsapp`

**Files:**
- Modify: `packages/core/src/whatsapp.ts`
- Test: `packages/core/src/whatsapp.test.ts`

**Interfaces:**
- Consumes: none (pure function, no dependency on other tasks).
- Produces: `buildProductInterestMessage(productName: string): string` — used by Task 9's `ProductCard` and Task 15's `page.tsx`.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/whatsapp.test.ts` (append after the `buildWhatsAppLink` describe block):

```ts
describe("buildProductInterestMessage", () => {
  it("monta a mensagem de interesse com o nome do produto", () => {
    const message = buildProductInterestMessage("Bandana Xadrez Verde");
    expect(message).toBe("Olá! Tenho interesse no produto: Bandana Xadrez Verde");
  });
});
```

And update the import line at the top of the file:

```ts
import { buildQuoteMessage, buildWhatsAppLink, buildProductInterestMessage } from "./whatsapp";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mypet/core test -- whatsapp`
Expected: FAIL — `buildProductInterestMessage` is not exported.

- [ ] **Step 3: Implement**

Append to `packages/core/src/whatsapp.ts`:

```ts
export function buildProductInterestMessage(productName: string): string {
  return `Olá! Tenho interesse no produto: ${productName}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @mypet/core test -- whatsapp`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/whatsapp.ts packages/core/src/whatsapp.test.ts
git commit -m "feat(core): adiciona buildProductInterestMessage para CTA de produto unico"
```

---

### Task 3: Scaffold the `apps/azpetshop` Next.js app

**Files:**
- Create: `apps/azpetshop/package.json`
- Create: `apps/azpetshop/tsconfig.json`
- Create: `apps/azpetshop/next.config.ts`
- Create: `apps/azpetshop/postcss.config.mjs`
- Create: `apps/azpetshop/next-env.d.ts`
- Create: `apps/azpetshop/app/globals.css`
- Create: `apps/azpetshop/app/layout.tsx`
- Create: `apps/azpetshop/app/page.tsx` (temporary placeholder, replaced in Task 15)
- Create: `apps/azpetshop/client-theme.ts`
- Create: `apps/azpetshop/client.config.ts`
- Create: `apps/azpetshop/lib/product-lines.ts`
- Create: `apps/azpetshop/public/placeholder-produto.svg`
- Modify: `package.json` (root — add `dev:azpetshop` script)

**Interfaces:**
- Produces:
  - `madPetPalette: MadPetPalette` from `@/client-theme`, fields: `green, greenDark, greenLight, purple, purpleDark, purpleLight, white, gray600, gray800` (all `string` hex).
  - `clientConfig` from `@/client.config`, fields: `name, tagline, catalogChannel, brand, whatsappNumber, mainSiteUrl, distribuidoraUrl, marketplaceUrl` (all `string`).
  - `PRODUCT_LINES: ProductLine[]` from `@/lib/product-lines`, where `ProductLine = { slug: string; label: string; categoryId: string; bannerTitle: string; bannerCopy: string }`.

- [ ] **Step 1: Create `apps/azpetshop/package.json`**

```json
{
  "name": "azpetshop",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@mypet/core": "workspace:*",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `apps/azpetshop/tsconfig.json`**

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

- [ ] **Step 3: Create `apps/azpetshop/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@mypet/core"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "imagedelivery.net" }],
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create `apps/azpetshop/postcss.config.mjs`**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 5: Create `apps/azpetshop/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 6: Create `apps/azpetshop/app/globals.css`**

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #2a2a33;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
}

.carousel-arrow {
  display: flex;
}

@media (max-width: 640px) {
  .carousel-arrow {
    display: none;
  }
}
```

- [ ] **Step 7: Create `apps/azpetshop/client-theme.ts`**

```ts
export type MadPetPalette = {
  green: string;
  greenDark: string;
  greenLight: string;
  purple: string;
  purpleDark: string;
  purpleLight: string;
  white: string;
  gray600: string;
  gray800: string;
};

export const madPetPalette: MadPetPalette = {
  green: "#7AC142",
  greenDark: "#5C9531",
  greenLight: "#EAF6DD",
  purple: "#6B2D8C",
  purpleDark: "#4F2168",
  purpleLight: "#F1E6F7",
  white: "#FFFFFF",
  gray600: "#5A5A66",
  gray800: "#2A2A33",
};
```

- [ ] **Step 8: Create `apps/azpetshop/client.config.ts`**

```ts
export const clientConfig = {
  name: "MAD PET",
  tagline: "Acessórios de fabricação própria para cães e gatos",
  catalogChannel: "azpetshop",
  brand: "MAD PET",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5511982053694",
  mainSiteUrl: "https://www.mypetbrasil.com.br",
  distribuidoraUrl: "https://www.distribuidorapetshop.com.br",
  marketplaceUrl: "",
};
```

- [ ] **Step 9: Create `apps/azpetshop/lib/product-lines.ts`**

```ts
export type ProductLine = {
  slug: string;
  label: string;
  categoryId: string;
  bannerTitle: string;
  bannerCopy: string;
};

export const PRODUCT_LINES: ProductLine[] = [
  {
    slug: "bandanas",
    label: "Bandanas",
    categoryId: "6044f664-4c8b-58d6-9de3-a9114ea50819",
    bannerTitle: "Bandanas MAD PET",
    bannerCopy: "Estampas divertidas pra deixar qualquer pet com aquele toque doidão.",
  },
  {
    slug: "lacos",
    label: "Laços",
    categoryId: "af0d7456-9a3b-52e0-a406-a9b3c3e268fd",
    bannerTitle: "Laços MAD PET",
    bannerCopy: "Pra ocasiões especiais — ou pra todo dia, sem julgamento.",
  },
  {
    slug: "peitorais",
    label: "Peitorais",
    categoryId: "cb601178-eeb2-53ff-8361-d9f673259e8d",
    bannerTitle: "Peitorais MAD PET",
    bannerCopy: "Conforto e resistência pros passeios mais doidos.",
  },
  {
    slug: "coleiras",
    label: "Coleiras",
    categoryId: "595fe241-fa35-5da6-8592-e49569d82a11",
    bannerTitle: "Coleiras MAD PET",
    bannerCopy: "Cores vibrantes que combinam com a personalidade mad do seu pet.",
  },
];
```

- [ ] **Step 10: Create `apps/azpetshop/public/placeholder-produto.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#EAF6DD"/>
  <text x="50%" y="48%" font-family="sans-serif" font-size="64" fill="#6B2D8C" text-anchor="middle">🐾</text>
  <text x="50%" y="62%" font-family="sans-serif" font-size="18" fill="#6B2D8C" text-anchor="middle">Sem imagem</text>
</svg>
```

- [ ] **Step 11: Create a temporary `apps/azpetshop/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAD PET",
  description: "MAD PET — acessórios de fabricação própria para cães e gatos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
```

(This is replaced with fonts + final metadata in Task 15.)

- [ ] **Step 12: Create a temporary `apps/azpetshop/app/page.tsx`**

```tsx
export default function Home() {
  return <p style={{ padding: 24 }}>MAD PET — em construção.</p>;
}
```

(This is fully replaced in Task 15.)

- [ ] **Step 13: Add the dev script to the root `package.json`**

Edit `package.json` at the repo root, in `scripts`:

```json
    "dev:distribuidora": "pnpm --filter distribuidora dev",
    "dev:azpetshop": "pnpm --filter azpetshop dev",
```

- [ ] **Step 14: Install dependencies and verify the app boots**

Run: `pnpm install`
Expected: lockfile updates, no errors.

Run: `pnpm --filter azpetshop dev` (start it, then stop it once confirmed)
Expected: dev server starts on an available port (e.g. `http://localhost:3000` or next free
port) and `/` renders "MAD PET — em construção." with no console errors.

- [ ] **Step 15: Commit**

```bash
git add apps/azpetshop package.json pnpm-lock.yaml
git commit -m "feat(azpetshop): scaffold do novo app no monorepo"
```

---

### Task 4: Decorative SVG components (wave divider + mascot)

**Files:**
- Create: `apps/azpetshop/components/wave-divider.tsx`
- Create: `apps/azpetshop/components/mascot-cat.tsx`

**Interfaces:**
- Produces:
  - `WaveDivider({ color: string; flip?: boolean }): JSX.Element` — used by Task 7 (`Hero`) and Task 10 (`LineSection`).
  - `MascotCat({ color?: string; width?: number; style?: React.CSSProperties }): JSX.Element` — used by Task 7 (`Hero`).

- [ ] **Step 1: Create `apps/azpetshop/components/wave-divider.tsx`**

```tsx
export function WaveDivider({ color, flip = false }: { color: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        display: "block",
        width: "100%",
        height: 80,
        transform: flip ? "scaleY(-1)" : undefined,
      }}
    >
      <path
        fill={color}
        d="M0,64 C240,120 480,0 720,32 C960,64 1200,120 1440,64 L1440,120 L0,120 Z"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Create `apps/azpetshop/components/mascot-cat.tsx`**

```tsx
export function MascotCat({
  color = "#FFFFFF",
  width = 160,
  style,
}: {
  color?: string;
  width?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 200 200" width={width} aria-hidden="true" style={{ display: "block", ...style }}>
      <g fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 70 L45 30 L75 55 Z" />
        <path d="M140 70 L155 30 L125 55 Z" />
        <ellipse cx="100" cy="110" rx="55" ry="48" />
        <circle cx="80" cy="100" r="4" fill={color} stroke="none" />
        <circle cx="120" cy="100" r="4" fill={color} stroke="none" />
        <path d="M92 115 Q100 122 108 115" />
        <path d="M60 120 Q30 110 20 130" />
        <path d="M60 128 Q28 130 18 148" />
        <path d="M140 120 Q170 110 180 130" />
        <path d="M140 128 Q172 130 182 148" />
        <path d="M150 140 Q175 150 170 175" />
      </g>
    </svg>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `pnpm --filter azpetshop exec tsc --noEmit`
Expected: no errors related to the two new files.

- [ ] **Step 4: Commit**

```bash
git add apps/azpetshop/components/wave-divider.tsx apps/azpetshop/components/mascot-cat.tsx
git commit -m "feat(azpetshop): componentes decorativos (onda + mascote)"
```

---

### Task 5: Header/nav component

**Files:**
- Create: `apps/azpetshop/components/header-nav.tsx`

**Interfaces:**
- Consumes: `madPetPalette` from `@/client-theme`.
- Produces: `HeaderNav({ whatsappLink: string; mainSiteUrl: string }): JSX.Element` — used by Task 15 (`page.tsx`).

- [ ] **Step 1: Create `apps/azpetshop/components/header-nav.tsx`**

```tsx
import { madPetPalette as palette } from "@/client-theme";

const NAV_LINKS = [
  { href: "#bandanas", label: "Bandanas" },
  { href: "#lacos", label: "Laços" },
  { href: "#peitorais", label: "Peitorais" },
  { href: "#coleiras", label: "Coleiras" },
  { href: "#onde-comprar", label: "Onde Comprar" },
];

export function HeaderNav({
  whatsappLink,
  mainSiteUrl,
}: {
  whatsappLink: string;
  mainSiteUrl: string;
}) {
  return (
    <header
      style={{
        background: palette.white,
        borderBottom: `2px solid ${palette.purpleLight}`,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <a
          href="#topo"
          style={{
            fontFamily: "var(--font-fredoka)",
            fontWeight: 700,
            fontSize: 24,
            color: palette.purple,
            textDecoration: "none",
            transform: "rotate(-3deg)",
            display: "inline-block",
          }}
        >
          MAD PET
        </a>
        <nav aria-label="Seções da página" style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              style={{ color: palette.gray800, fontWeight: 700, fontSize: 14, textDecoration: "none" }}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: palette.green, fontWeight: 800, fontSize: 14, textDecoration: "none" }}
          >
            💬 WhatsApp
          </a>
          <a href={mainSiteUrl} style={{ color: palette.gray600, fontSize: 12, textDecoration: "underline" }}>
            Voltar pro site principal
          </a>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm --filter azpetshop exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/azpetshop/components/header-nav.tsx
git commit -m "feat(azpetshop): header com navegacao por ancoras"
```

---

### Task 6: WhatsApp floating button

**Files:**
- Create: `apps/azpetshop/components/whatsapp-float-button.tsx`

**Interfaces:**
- Produces: `WhatsAppFloatButton({ link: string }): JSX.Element` — used by Task 15 (`page.tsx`).

- [ ] **Step 1: Create `apps/azpetshop/components/whatsapp-float-button.tsx`**

```tsx
export function WhatsAppFloatButton({ link }: { link: string }) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "#25D366",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        zIndex: 60,
        textDecoration: "none",
        fontSize: 28,
      }}
    >
      💬
    </a>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm --filter azpetshop exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/azpetshop/components/whatsapp-float-button.tsx
git commit -m "feat(azpetshop): botao flutuante de whatsapp"
```

---

### Task 7: Hero section

**Files:**
- Create: `apps/azpetshop/components/hero.tsx`

**Interfaces:**
- Consumes: `madPetPalette` from `@/client-theme`; `MascotCat` and `WaveDivider` from Task 4.
- Produces: `Hero({ whatsappLink: string }): JSX.Element` — used by Task 15 (`page.tsx`).

- [ ] **Step 1: Create `apps/azpetshop/components/hero.tsx`**

```tsx
import { madPetPalette as palette } from "@/client-theme";
import { MascotCat } from "./mascot-cat";
import { WaveDivider } from "./wave-divider";

export function Hero({ whatsappLink }: { whatsappLink: string }) {
  return (
    <section
      id="topo"
      style={{
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(120deg, ${palette.green} 0%, ${palette.green} 45%, ${palette.purple} 45%, ${palette.purple} 100%)`,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "72px 24px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <h1
            style={{
              fontFamily: "var(--font-fredoka)",
              fontSize: 44,
              fontWeight: 700,
              color: palette.white,
              lineHeight: 1.1,
              marginBottom: 16,
              transform: "rotate(-1deg)",
            }}
          >
            Acessórios com aquele toque mad.
          </h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.9)", marginBottom: 28, lineHeight: 1.6 }}>
            Bandanas, laços, peitorais e coleiras de fabricação própria — cores vibrantes,
            materiais resistentes, preço-benefício sem enrolação.
          </p>
          <a
            href="#onde-comprar"
            style={{
              display: "inline-block",
              background: palette.white,
              color: palette.purple,
              fontWeight: 800,
              fontSize: 16,
              padding: "14px 32px",
              borderRadius: 100,
              textDecoration: "none",
            }}
          >
            Onde encontrar
          </a>
        </div>
        <MascotCat width={220} color={palette.white} style={{ flexShrink: 0 }} />
      </div>
      <WaveDivider color={palette.white} />
    </section>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm --filter azpetshop exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/azpetshop/components/hero.tsx
git commit -m "feat(azpetshop): secao hero com divisor de onda e mascote"
```

---

### Task 8: Brand block section

**Files:**
- Create: `apps/azpetshop/components/brand-block.tsx`

**Interfaces:**
- Produces: `BrandBlock(): JSX.Element` — used by Task 15 (`page.tsx`).

- [ ] **Step 1: Create `apps/azpetshop/components/brand-block.tsx`**

```tsx
import { madPetPalette as palette } from "@/client-theme";

export function BrandBlock() {
  return (
    <section style={{ maxWidth: 780, margin: "0 auto", padding: "48px 24px", textAlign: "center" }}>
      <p style={{ fontSize: 18, color: palette.gray800, lineHeight: 1.7, fontWeight: 600 }}>
        A MAD PET nasceu de uma pergunta simples: por que acessório pet tem que ser sem graça?
        Fabricamos nossas próprias bandanas, laços, peitorais e coleiras com cores que ninguém
        esquece e um preço que cabe no bolso — sem abrir mão da qualidade que seu pet merece.
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm --filter azpetshop exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/azpetshop/components/brand-block.tsx
git commit -m "feat(azpetshop): bloco de marca"
```

---

### Task 9: Product card component

**Files:**
- Create: `apps/azpetshop/components/product-card.tsx`

**Interfaces:**
- Consumes: `CatalogProduct` type from `@mypet/core/catalog-utils` (fields used: `id`, `name`, `img`); `buildWhatsAppLink`, `buildProductInterestMessage` from `@mypet/core/whatsapp` (Task 2); `madPetPalette` from `@/client-theme`.
- Produces: `ProductCard({ product: CatalogProduct; whatsappNumber: string }): JSX.Element` — used by Task 10 (`ProductCarousel`).

- [ ] **Step 1: Create `apps/azpetshop/components/product-card.tsx`**

```tsx
import Image from "next/image";
import type { CatalogProduct } from "@mypet/core/catalog-utils";
import { buildWhatsAppLink, buildProductInterestMessage } from "@mypet/core/whatsapp";
import { madPetPalette as palette } from "@/client-theme";

export function ProductCard({
  product,
  whatsappNumber,
}: {
  product: CatalogProduct;
  whatsappNumber: string;
}) {
  const link = buildWhatsAppLink(whatsappNumber, buildProductInterestMessage(product.name));

  return (
    <div
      style={{
        background: palette.white,
        borderRadius: 20,
        border: `2px solid ${palette.purpleLight}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        width: 240,
        scrollSnapAlign: "start",
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: palette.greenLight }}>
        <Image src={product.img} alt={product.name} fill sizes="240px" style={{ objectFit: "contain" }} />
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: palette.gray800,
            lineHeight: 1.3,
            marginBottom: 14,
            minHeight: 40,
          }}
        >
          {product.name}
        </h3>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: "auto",
            textAlign: "center",
            background: palette.green,
            color: palette.white,
            fontWeight: 800,
            fontSize: 14,
            padding: "10px 0",
            borderRadius: 100,
            textDecoration: "none",
          }}
        >
          Quero esse
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm --filter azpetshop exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/azpetshop/components/product-card.tsx
git commit -m "feat(azpetshop): product card proprio com cta de whatsapp"
```

---

### Task 10: Product carousel (client) + line section (server, data fetch)

**Files:**
- Create: `apps/azpetshop/components/product-carousel.tsx`
- Create: `apps/azpetshop/components/line-section.tsx`

**Interfaces:**
- Consumes: `getCatalog` from `@mypet/core/catalog` (signature: `getCatalog(params: { q?: string; brand?: string; categoryId?: string | string[]; page: number; channel: string }): Promise<CatalogResult>`, `CatalogResult = { items: CatalogProduct[]; total: number; page: number; totalPages: number }`); `ProductCard` from Task 9; `WaveDivider` from Task 4; `ProductLine` type from Task 3 (`@/lib/product-lines`).
- Produces:
  - `ProductCarousel({ products: CatalogProduct[]; whatsappNumber: string }): JSX.Element` (Client Component) — used by `LineSection`.
  - `LineSection({ line: ProductLine; channel: string; brand: string; whatsappNumber: string; background: "green" | "purple" }): Promise<JSX.Element>` (async Server Component) — used by Task 15 (`page.tsx`).

- [ ] **Step 1: Create `apps/azpetshop/components/product-carousel.tsx`**

```tsx
"use client";

import { useRef } from "react";
import type { CatalogProduct } from "@mypet/core/catalog-utils";
import { ProductCard } from "./product-card";
import { madPetPalette as palette } from "@/client-theme";

const arrowBaseStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: "none",
  background: palette.purple,
  color: palette.white,
  fontSize: 22,
  cursor: "pointer",
  alignItems: "center",
  justifyContent: "center",
};

export function ProductCarousel({
  products,
  whatsappNumber,
}: {
  products: CatalogProduct[];
  whatsappNumber: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * 260, behavior: "smooth" });
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={trackRef}
        style={{
          display: "flex",
          gap: 16,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          paddingBottom: 8,
        }}
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} whatsappNumber={whatsappNumber} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => scrollByCard(-1)}
        aria-label="Ver produtos anteriores"
        className="carousel-arrow"
        style={{ ...arrowBaseStyle, left: -8 }}
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => scrollByCard(1)}
        aria-label="Ver próximos produtos"
        className="carousel-arrow"
        style={{ ...arrowBaseStyle, right: -8 }}
      >
        ›
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/azpetshop/components/line-section.tsx`**

```tsx
import { getCatalog } from "@mypet/core/catalog";
import { ProductCarousel } from "./product-carousel";
import { WaveDivider } from "./wave-divider";
import { madPetPalette as palette } from "@/client-theme";
import type { ProductLine } from "@/lib/product-lines";

export async function LineSection({
  line,
  channel,
  brand,
  whatsappNumber,
  background,
}: {
  line: ProductLine;
  channel: string;
  brand: string;
  whatsappNumber: string;
  background: "green" | "purple";
}) {
  const catalog = await getCatalog({ categoryId: line.categoryId, brand, page: 1, channel });
  const bg = background === "green" ? palette.green : palette.purple;

  return (
    <section id={line.slug} style={{ position: "relative", background: bg, padding: "64px 0 72px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <h2
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: 32,
            fontWeight: 700,
            color: palette.white,
            marginBottom: 10,
          }}
        >
          {line.bannerTitle}
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.88)", marginBottom: 32, maxWidth: 560 }}>
          {line.bannerCopy}
        </p>
        {catalog.items.length === 0 ? (
          <p
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.85)",
              background: "rgba(255,255,255,0.12)",
              padding: "20px 24px",
              borderRadius: 16,
              maxWidth: 420,
            }}
          >
            Essa linha chega em breve por aqui. Fala com a gente no WhatsApp pra saber mais!
          </p>
        ) : (
          <ProductCarousel products={catalog.items} whatsappNumber={whatsappNumber} />
        )}
      </div>
      <WaveDivider color={palette.white} flip />
    </section>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `pnpm --filter azpetshop exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/azpetshop/components/product-carousel.tsx apps/azpetshop/components/line-section.tsx
git commit -m "feat(azpetshop): vitrine por linha de produto com carrossel"
```

---

### Task 11: Where-to-buy section

**Files:**
- Create: `apps/azpetshop/components/where-to-buy.tsx`

**Interfaces:**
- Produces: `WhereToBuy({ whatsappLink: string; marketplaceUrl: string; distribuidoraUrl: string }): JSX.Element` — used by Task 15 (`page.tsx`). Cards with an empty `href` (e.g. `marketplaceUrl === ""`) are omitted rather than rendered as dead links.

- [ ] **Step 1: Create `apps/azpetshop/components/where-to-buy.tsx`**

```tsx
import { madPetPalette as palette } from "@/client-theme";

export function WhereToBuy({
  whatsappLink,
  marketplaceUrl,
  distribuidoraUrl,
}: {
  whatsappLink: string;
  marketplaceUrl: string;
  distribuidoraUrl: string;
}) {
  const channels = [
    {
      title: "WhatsApp direto",
      desc: "Manda mensagem e a gente te ajuda a escolher.",
      href: whatsappLink,
      cta: "Chamar no WhatsApp",
    },
    {
      title: "Marketplace",
      desc: "Compre com a comodidade do seu marketplace favorito.",
      href: marketplaceUrl,
      cta: "Ver no marketplace",
    },
    {
      title: "Distribuidora",
      desc: "Revenda ou compra em maior volume.",
      href: distribuidoraUrl,
      cta: "Falar com a Distribuidora",
    },
  ].filter((c) => c.href !== "");

  return (
    <section id="onde-comprar" style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 24px" }}>
      <h2
        style={{
          fontFamily: "var(--font-fredoka)",
          fontSize: 30,
          fontWeight: 700,
          color: palette.purple,
          marginBottom: 32,
          textAlign: "center",
        }}
      >
        Onde encontrar a MAD PET
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
        {channels.map((c) => (
          <div
            key={c.title}
            style={{ border: `2px solid ${palette.greenLight}`, borderRadius: 20, padding: 28, textAlign: "center" }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, color: palette.gray800, marginBottom: 8 }}>{c.title}</h3>
            <p style={{ fontSize: 14, color: palette.gray600, marginBottom: 20, lineHeight: 1.6 }}>{c.desc}</p>
            <a
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                background: palette.purple,
                color: palette.white,
                fontWeight: 800,
                fontSize: 14,
                padding: "10px 24px",
                borderRadius: 100,
                textDecoration: "none",
              }}
            >
              {c.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm --filter azpetshop exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/azpetshop/components/where-to-buy.tsx
git commit -m "feat(azpetshop): secao onde encontrar / como comprar"
```

---

### Task 12: SEO block section

**Files:**
- Create: `apps/azpetshop/components/seo-block.tsx`

**Interfaces:**
- Consumes: `PRODUCT_LINES` from `@/lib/product-lines` (Task 3).
- Produces: `SeoBlock(): JSX.Element` — used by Task 15 (`page.tsx`). Renders the page's only `<h1>`.

- [ ] **Step 1: Create `apps/azpetshop/components/seo-block.tsx`**

```tsx
import { madPetPalette as palette } from "@/client-theme";
import { PRODUCT_LINES } from "@/lib/product-lines";

const SEO_CONTENT: Record<string, { p1: string; p2: string }> = {
  bandanas: {
    p1: "As bandanas MAD PET são feitas em tecido resistente e de fácil lavagem, pensadas pra aguentar o dia a dia de cães e gatos de todos os portes. Disponíveis em estampas exclusivas, elas se ajustam com um simples nó no pescoço, sem fivela e sem risco de aperto.",
    p2: "É a escolha certa pra quem quer dar um upgrade no visual do pet sem gastar muito: usa no passeio, na festa, no dia a dia — e troca quando quiser, porque tem estampa nova sempre.",
  },
  lacos: {
    p1: "Os laços MAD PET são pequenos, leves e prendem fácil na coleira ou direto no pelo, sem machucar. Ideais pra cães e gatos de pequeno a grande porte que gostam de andar com estilo.",
    p2: "Perfeitos pra ocasiões especiais — aniversário, ensaio de foto, passeio no shopping — mas resistentes o bastante pro uso diário também.",
  },
  peitorais: {
    p1: "Os peitorais MAD PET distribuem a força da guiada pelo peito e não pelo pescoço, com ajuste em velcro ou fivela e reforço nas costuras. Disponíveis em vários tamanhos, do mini ao extra grande.",
    p2: "Indicados pra cães que puxam na guia ou têm o pescoço sensível (como raças braquicefálicas), unindo conforto no passeio com o colorido que é a cara da marca.",
  },
  coleiras: {
    p1: "As coleiras MAD PET vêm em cores vibrantes e materiais resistentes à água e ao desgaste do dia a dia, com fivela de encaixe rápido e argola reforçada pra guia e identificação.",
    p2: "Tamanhos ajustáveis pra cães e gatos de qualquer porte, com o mesmo padrão de qualidade e preço-benefício de fabricação própria que é a cara da MAD PET.",
  },
};

export function SeoBlock() {
  return (
    <section style={{ maxWidth: 860, margin: "0 auto", padding: "64px 24px" }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, color: palette.purple, marginBottom: 16 }}>
        MAD PET: acessórios de fabricação própria para cachorros e gatos
      </h1>
      <p style={{ fontSize: 16, color: palette.gray800, lineHeight: 1.7, marginBottom: 40 }}>
        A MAD PET é a linha própria de acessórios do Grupo AZ, fabricada com foco em cor,
        conforto e preço-benefício. Bandanas, laços, peitorais e coleiras pensados pra cães e
        gatos de todos os tamanhos, com materiais resistentes e visual que ninguém passa
        despercebido.
      </p>
      {PRODUCT_LINES.map((line) => (
        <div key={line.slug} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: palette.gray800, marginBottom: 10 }}>
            <a href={`#${line.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
              {line.label}
            </a>
          </h2>
          <p style={{ fontSize: 15, color: palette.gray600, lineHeight: 1.7, marginBottom: 10 }}>
            {SEO_CONTENT[line.slug].p1}
          </p>
          <p style={{ fontSize: 15, color: palette.gray600, lineHeight: 1.7 }}>{SEO_CONTENT[line.slug].p2}</p>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm --filter azpetshop exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/azpetshop/components/seo-block.tsx
git commit -m "feat(azpetshop): bloco de seo com h1 e h2 por linha de produto"
```

---

### Task 13: FAQ section with JSON-LD

**Files:**
- Create: `apps/azpetshop/components/faq.tsx`

**Interfaces:**
- Produces: `Faq(): JSX.Element` — used by Task 15 (`page.tsx`). Emits a `<script type="application/ld+json">` with schema.org `FAQPage`.

- [ ] **Step 1: Create `apps/azpetshop/components/faq.tsx`**

```tsx
import { madPetPalette as palette } from "@/client-theme";

const FAQ_ITEMS = [
  {
    q: "Quais tamanhos estão disponíveis?",
    a: "Bandanas e laços vêm em tamanho único ajustável. Peitorais e coleiras têm de P a GG, com tabela de medidas descrita em cada produto.",
  },
  {
    q: "Quais materiais são usados?",
    a: "Tecidos resistentes e de fácil lavagem nas bandanas e laços; nylon reforçado com costuras duplas em peitorais e coleiras.",
  },
  {
    q: "Como lavar e cuidar dos produtos?",
    a: "Lavar à mão com água fria e sabão neutro, secar à sombra. Evitar máquina de lavar e secadora pra preservar a cor e o tecido.",
  },
  {
    q: "Vocês vendem para revenda ou atacado?",
    a: "Sim! Pet shops e lojistas podem comprar em volume pela Distribuidora My Pet Brasil — fale com a gente pelo WhatsApp ou acesse o link na seção 'Onde encontrar'.",
  },
  {
    q: "Qual o prazo de entrega?",
    a: "O prazo varia por região e canal de compra (loja própria, WhatsApp ou marketplace) — a gente confirma certinho assim que você fala com a gente.",
  },
];

export function Faq() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section style={{ maxWidth: 780, margin: "0 auto", padding: "64px 24px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2
        style={{
          fontFamily: "var(--font-fredoka)",
          fontSize: 28,
          fontWeight: 700,
          color: palette.purple,
          marginBottom: 28,
          textAlign: "center",
        }}
      >
        Perguntas frequentes
      </h2>
      {FAQ_ITEMS.map((item) => (
        <div key={item.q} style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: palette.gray800, marginBottom: 6 }}>{item.q}</h3>
          <p style={{ fontSize: 15, color: palette.gray600, lineHeight: 1.6 }}>{item.a}</p>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm --filter azpetshop exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/azpetshop/components/faq.tsx
git commit -m "feat(azpetshop): faq com schema jsonld"
```

---

### Task 14: Footer

**Files:**
- Create: `apps/azpetshop/components/footer.tsx`

**Interfaces:**
- Produces: `Footer({ mainSiteUrl: string; distribuidoraUrl: string; whatsappLink: string }): JSX.Element` — used by Task 15 (`page.tsx`).

- [ ] **Step 1: Create `apps/azpetshop/components/footer.tsx`**

```tsx
import { madPetPalette as palette } from "@/client-theme";

export function Footer({
  mainSiteUrl,
  distribuidoraUrl,
  whatsappLink,
}: {
  mainSiteUrl: string;
  distribuidoraUrl: string;
  whatsappLink: string;
}) {
  return (
    <footer style={{ background: palette.purpleDark, padding: "40px 24px" }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div>
          <p style={{ fontFamily: "var(--font-fredoka)", fontSize: 20, color: palette.white, fontWeight: 700, marginBottom: 8 }}>
            MAD PET
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Uma marca do Grupo AZ (My Pet Brasil)</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, textDecoration: "none" }}>
            Fale no WhatsApp
          </a>
          <a href={mainSiteUrl} style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, textDecoration: "none" }}>
            My Pet Brasil
          </a>
          <a href={distribuidoraUrl} style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, textDecoration: "none" }}>
            Distribuidora Petshop
          </a>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", maxWidth: 320 }}>
          © 2026 MAD PET — Grupo AZ. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm --filter azpetshop exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/azpetshop/components/footer.tsx
git commit -m "feat(azpetshop): footer"
```

---

### Task 15: Final assembly — fonts, metadata, and `page.tsx`

**Files:**
- Modify: `apps/azpetshop/app/layout.tsx`
- Modify: `apps/azpetshop/app/page.tsx`

**Interfaces:**
- Consumes: every component/util from Tasks 1–14 (`HeaderNav`, `Hero`, `BrandBlock`, `LineSection`, `WhereToBuy`, `SeoBlock`, `Faq`, `Footer`, `WhatsAppFloatButton`, `buildWhatsAppLink`, `clientConfig`, `PRODUCT_LINES`).
- Produces: the finished `/` route.

- [ ] **Step 1: Replace `apps/azpetshop/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "MAD PET — acessórios de fabricação própria para cães e gatos",
  description:
    "Bandanas, laços, peitorais e coleiras MAD PET: cores vibrantes, materiais resistentes e preço-benefício. Fale no WhatsApp e descubra onde comprar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${fredoka.variable} ${nunito.variable}`}>
      <body style={{ margin: 0, fontFamily: "var(--font-nunito), sans-serif" }}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `apps/azpetshop/app/page.tsx`**

```tsx
import { HeaderNav } from "@/components/header-nav";
import { Hero } from "@/components/hero";
import { BrandBlock } from "@/components/brand-block";
import { LineSection } from "@/components/line-section";
import { WhereToBuy } from "@/components/where-to-buy";
import { SeoBlock } from "@/components/seo-block";
import { Faq } from "@/components/faq";
import { Footer } from "@/components/footer";
import { WhatsAppFloatButton } from "@/components/whatsapp-float-button";
import { buildWhatsAppLink } from "@mypet/core/whatsapp";
import { clientConfig } from "@/client.config";
import { PRODUCT_LINES } from "@/lib/product-lines";

export default function Home() {
  const genericWhatsappLink = buildWhatsAppLink(
    clientConfig.whatsappNumber,
    "Olá! Quero saber mais sobre a linha MAD PET."
  );

  return (
    <div>
      <HeaderNav whatsappLink={genericWhatsappLink} mainSiteUrl={clientConfig.mainSiteUrl} />
      <Hero whatsappLink={genericWhatsappLink} />
      <BrandBlock />
      {PRODUCT_LINES.map((line, i) => (
        <LineSection
          key={line.slug}
          line={line}
          channel={clientConfig.catalogChannel}
          brand={clientConfig.brand}
          whatsappNumber={clientConfig.whatsappNumber}
          background={i % 2 === 0 ? "green" : "purple"}
        />
      ))}
      <WhereToBuy
        whatsappLink={genericWhatsappLink}
        marketplaceUrl={clientConfig.marketplaceUrl}
        distribuidoraUrl={clientConfig.distribuidoraUrl}
      />
      <SeoBlock />
      <Faq />
      <Footer
        mainSiteUrl={clientConfig.mainSiteUrl}
        distribuidoraUrl={clientConfig.distribuidoraUrl}
        whatsappLink={genericWhatsappLink}
      />
      <WhatsAppFloatButton link={genericWhatsappLink} />
    </div>
  );
}
```

- [ ] **Step 3: Run the full verification suite**

Run: `pnpm --filter @mypet/core test`
Expected: all tests pass (including the new ones from Tasks 1–2).

Run: `pnpm --filter azpetshop exec tsc --noEmit`
Expected: no type errors.

Run: `pnpm --filter azpetshop build`
Expected: build succeeds. Since the `azpetshop` channel currently has zero products, each
`LineSection` render should hit the empty-state branch — check the build/dev output for no
runtime errors on `/`.

Run: `pnpm --filter azpetshop dev` (start it, open `/` in a browser, then stop it)
Expected: page renders header, hero (green/purple diagonal + mascot), brand block, 4
alternating green/purple line sections each showing the "em breve" message, onde-comprar
section, SEO block with the page's only `<h1>`, FAQ, footer, and a floating WhatsApp button.
Every WhatsApp link/button opens `https://wa.me/5511982053694?text=...` with a readable
pre-filled message.

- [ ] **Step 4: Commit**

```bash
git add apps/azpetshop/app/layout.tsx apps/azpetshop/app/page.tsx
git commit -m "feat(azpetshop): monta a landing page completa da MAD PET"
```

---

## Spec Coverage Check

- Header w/ anchors + WhatsApp + back-link → Task 5.
- Hero w/ wave divider + mascot → Tasks 4, 7.
- Brand block → Task 8.
- 4x banner+vitrine, alternating colors, empty-state handling → Task 10, wired in Task 15.
- Product card: photo, name, price-if-applicable (omitted — Hub Catálogo's shared product
  schema has no public price field; see Task 9), "Quero esse" WhatsApp CTA → Task 9.
- Onde encontrar / como comprar → Task 11.
- SEO block (H1 + per-line H2s + anchors) → Task 12.
- FAQ + JSON-LD → Task 13.
- Footer → Task 14.
- WhatsApp floating button → Task 6.
- `next/image` for product photos, remote pattern for `imagedelivery.net` → Tasks 3, 9.
- Mobile-first, carousel scroll-snap as Client Component → Task 10.
- `azpetshop` channel + category IDs wired into real catalog queries, no local mock → Tasks 1, 10, 15.
