# AZ Pet Shop — loja B2C — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `apps/azpetshop`, um app Next.js no monorepo que serve uma loja de consumidor final consumindo o mesmo Supabase `hub_catalogo` sob um canal novo `azpetshop`, com preço visível e fechamento por cotação no WhatsApp — sem contas, sem trava de preço, sem pagamento.

**Architecture:** App irmão de `apps/distribuidora`, reaproveitando `packages/core` (catálogo, carrinho, SiteNav, ProductVariantPanel). O core ganha um modo comercial `cart` (preço direto + carrinho) ao lado do `quote` (B2B, com LeadGate) já existente — mudança aditiva, default inalterado. A cotação vira um server action sem auth que só grava um lead leve; a mensagem de WhatsApp é montada no client. Preço de varejo vem de `product_channel_prices` (canal `azpetshop`), alimentado por um script de importação de CSV.

**Tech Stack:** Next.js 16.2.6 (App Router, React Server Components, `cacheComponents`), React 19.2.4, TypeScript strict, Tailwind CSS 4 via PostCSS, pnpm workspaces, Supabase JS, Vitest, `tsx` para scripts.

## Global Constraints

- **Next.js modificado:** este Next tem breaking changes vs. treino. Antes de escrever qualquer código Next novo (rotas, `metadata`, `sitemap`, server actions, `next/*`), ler o guia correspondente em `node_modules/next/dist/docs/`. Respeitar avisos de deprecação.
- **Versões travadas:** `next` `16.2.6`, `react` `19.2.4`, `react-dom` `19.2.4` (mesmos números exatos dos outros apps).
- **Canal:** a string do canal é exatamente `"azpetshop"` em todo lugar (Supabase, `client.config.ts`, `channels.ts`).
- **Porta de dev:** `4105`.
- **Segredos:** nunca prefixar com `NEXT_PUBLIC_` nada além de `NEXT_PUBLIC_WHATSAPP_NUMBER`. `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY` são server-only.
- **Copy em pt-BR** com acentuação correta (não trocar "não" por "nao").
- **Testes do core:** `packages/core/vitest.config.ts` roda em `environment: "node"` e só pega `src/**/*.test.ts` — sem JSX, sem jsdom. Não escrever teste de componente React no core; testar funções puras em `.ts`.
- **Commits frequentes:** um commit por task concluída, mensagem no padrão do repo (`feat(azpetshop): …`, `feat(core): …`).
- **Validação por task:** `pnpm --filter @mypet/core test` para mudanças no core; `pnpm --filter azpetshop build` para mudanças no app; `pnpm lint` antes do commit final de cada task que toca `.ts`/`.tsx`.
- **Design adiado:** paleta e layout do app são PROVISÓRIOS (cópia neutra). Não investir em estética agora.

---

## Task 1: Core — registrar o canal `azpetshop`

**Files:**
- Modify: `packages/core/src/channels.ts`
- Modify: `packages/core/src/channels.test.ts`
- Modify: `packages/core/src/features.ts`
- Modify: `packages/core/src/features.test.ts`

**Interfaces:**
- Produces: `Channel` passa a incluir `"azpetshop"`; `SiteId` passa a incluir `"azpetshop"`; `SITES.azpetshop = { name: "AZ Pet Shop", features: { commerce: "cart" } }`; `CHANNEL_LABELS.azpetshop = "AZ Pet Shop"`.

- [ ] **Step 1: Atualizar os testes de `channels` para o novo canal**

Em `packages/core/src/channels.test.ts`, substituir as três asserções que fixam a lista antiga:

```ts
  it("contém todos os canais de site", () => {
    expect(CHANNELS).toEqual(["mypetbrasil", "distribuidora", "ffa_fabrica", "azpetshop"]);
  });

  it("mantém todos os tipos de canal", () => {
    expect(ALL_CHANNEL_KINDS).toEqual(["mypetbrasil", "distribuidora", "ffa_fabrica", "azpetshop"]);
  });
```

E adicionar, dentro de `describe("isChannel")` no teste "aceita os canais válidos":

```ts
    expect(isChannel("azpetshop")).toBe(true);
```

E em `describe("CHANNEL_LABELS")`:

```ts
  it("expõe o label da AZ Pet Shop", () => {
    expect(CHANNEL_LABELS.azpetshop).toBe("AZ Pet Shop");
  });
```

- [ ] **Step 2: Atualizar os testes de `features` para o novo site**

Em `packages/core/src/features.test.ts`:

```ts
  it("declara os 4 sites esperados", () => {
    const ids = Object.keys(SITES).sort();
    expect(ids).toEqual(["azpetshop", "distribuidora", "madpet", "mypet"]);
  });
```

E no teste "todos os sites começam em modo cotação", trocar o título e deixar explícito o azpetshop como exceção:

```ts
  it("apps B2B em cotação; azpetshop em carrinho", () => {
    expect(SITES.mypet.features.commerce).toBe("quote");
    expect(SITES.distribuidora.features.commerce).toBe("quote");
    expect(SITES.madpet.features.commerce).toBe("quote");
    expect(SITES.azpetshop.features.commerce).toBe("cart");
  });
```

- [ ] **Step 3: Rodar os testes e ver falhar**

Run: `pnpm --filter @mypet/core test -- channels features`
Expected: FAIL — `CHANNELS` ainda tem 3 itens, `SITES` não tem `azpetshop`.

- [ ] **Step 4: Implementar em `channels.ts`**

```ts
export const ALL_CHANNEL_KINDS = ["mypetbrasil", "distribuidora", "ffa_fabrica", "azpetshop"] as const;

export const CHANNELS = ALL_CHANNEL_KINDS;

export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  mypetbrasil: "My Pet Brasil",
  distribuidora: "Distribuidora",
  ffa_fabrica: "FFA Fábrica",
  azpetshop: "AZ Pet Shop",
};
```

(`isChannel` não muda — já deriva de `CHANNELS`.)

- [ ] **Step 5: Implementar em `features.ts`**

Trocar o tipo `SiteId` e o mapa `SITES`:

```ts
export type SiteId = "mypet" | "distribuidora" | "madpet" | "azpetshop";

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
};
```

No `FEATURE_REGISTRY`, tirar o "(não implementado ainda)" da opção `cart`:

```ts
      { value: "cart", label: "Preço + carrinho (loja de consumidor)" },
```

- [ ] **Step 6: Rodar os testes e ver passar**

Run: `pnpm --filter @mypet/core test`
Expected: PASS (suite inteira).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/channels.ts packages/core/src/channels.test.ts packages/core/src/features.ts packages/core/src/features.test.ts
git commit -m "feat(core): registra canal e site azpetshop (commerce: cart)"
```

---

## Task 2: Core — `buildRetailQuoteMessage`

**Files:**
- Modify: `packages/core/src/whatsapp.ts`
- Modify: `packages/core/src/whatsapp.test.ts`

**Interfaces:**
- Consumes: `CartItem` de `./cart`.
- Produces: `buildRetailQuoteMessage(items: CartItem[], customer: { nome: string; whatsapp: string }): string`. `buildQuoteMessage` e `buildWhatsAppLink` permanecem com a assinatura atual.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `packages/core/src/whatsapp.test.ts`:

```ts
import { buildRetailQuoteMessage } from "./whatsapp";

describe("buildRetailQuoteMessage", () => {
  const items = [
    { id: "1", name: "Ração Golden 15kg", sku: "GOLD15", brand: "Golden", img: "", qty: 2 },
    { id: "2", name: "Coleira antipulgas", sku: "", brand: null, img: "", qty: 1 },
  ];

  it("lista itens e dados do cliente sem empresa/CNPJ", () => {
    const msg = buildRetailQuoteMessage(items, { nome: "Maria", whatsapp: "11988887777" });
    expect(msg).toContain("Gostaria de finalizar este pedido:");
    expect(msg).toContain("- Ração Golden 15kg (SKU GOLD15) — Qtd: 2");
    expect(msg).toContain("- Coleira antipulgas — Qtd: 1");
    expect(msg).toContain("Nome: Maria");
    expect(msg).toContain("WhatsApp: 11988887777");
    expect(msg).not.toContain("Empresa:");
    expect(msg).not.toContain("CNPJ:");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- whatsapp`
Expected: FAIL — `buildRetailQuoteMessage` não existe.

- [ ] **Step 3: Implementar**

Adicionar ao fim de `packages/core/src/whatsapp.ts`:

```ts
export function buildRetailQuoteMessage(
  items: CartItem[],
  customer: { nome: string; whatsapp: string },
): string {
  const itemLines = items
    .map((item) => {
      const skuPart = item.sku ? ` (SKU ${item.sku})` : "";
      return `- ${item.name}${skuPart} — Qtd: ${item.qty}`;
    })
    .join("\n");

  return [
    "Olá! Gostaria de finalizar este pedido:",
    "",
    itemLines,
    "",
    "Meus dados:",
    `Nome: ${customer.nome}`,
    `WhatsApp: ${customer.whatsapp}`,
  ].join("\n");
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- whatsapp`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/whatsapp.ts packages/core/src/whatsapp.test.ts
git commit -m "feat(core): buildRetailQuoteMessage para cotação B2C"
```

---

## Task 3: Core — `createRetailLead`

**Files:**
- Modify: `packages/core/src/leads-server.ts`
- Modify: `packages/core/src/leads-server.test.ts`

**Interfaces:**
- Consumes: `Channel` de `./channels`; `getHubClient` de `./supabase`.
- Produces: `createRetailLead(input: { channel: Channel; nome: string; whatsapp: string }): Promise<{ ok: true } | { ok: false; error: string }>`. Grava em `leads` com `empresa: null`, `cnpj: null`.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `packages/core/src/leads-server.test.ts` (o arquivo já mocka `./supabase` com `getHubClient` → `{ from: () => ({ insert: insertMock }) }`):

```ts
import { createRetailLead } from "./leads-server";

describe("createRetailLead", () => {
  it("insere lead de varejo com empresa e cnpj nulos", async () => {
    insertMock.mockResolvedValue({ error: null });

    const res = await createRetailLead({ channel: "azpetshop", nome: "Maria", whatsapp: "11988887777" });

    expect(calls["from"]).toBe("leads");
    expect(insertMock).toHaveBeenCalledWith({
      nome: "Maria",
      empresa: null,
      whatsapp: "11988887777",
      cnpj: null,
      channel: "azpetshop",
    });
    expect(res).toEqual({ ok: true });
  });

  it("retorna erro quando o Supabase falha", async () => {
    insertMock.mockResolvedValue({ error: { message: "boom" } });
    const res = await createRetailLead({ channel: "azpetshop", nome: "Maria", whatsapp: "11988887777" });
    expect(res).toEqual({ ok: false, error: "boom" });
  });

  it("retorna erro de validação quando falta nome ou whatsapp", async () => {
    const res = await createRetailLead({ channel: "azpetshop", nome: "", whatsapp: "" });
    expect(res).toEqual({ ok: false, error: "Nome e WhatsApp são obrigatórios." });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- leads-server`
Expected: FAIL — `createRetailLead` não existe.

- [ ] **Step 3: Implementar**

Adicionar em `packages/core/src/leads-server.ts` (mantém `createLeadsPostHandler` como está):

```ts
export async function createRetailLead(input: {
  channel: Channel;
  nome: string;
  whatsapp: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const nome = input.nome?.trim();
  const whatsapp = input.whatsapp?.trim();
  if (!nome || !whatsapp) {
    return { ok: false, error: "Nome e WhatsApp são obrigatórios." };
  }

  const supabase = getHubClient();
  const { error } = await supabase.from("leads").insert({
    nome,
    empresa: null,
    whatsapp,
    cnpj: null,
    channel: input.channel,
  });

  if (error) {
    console.error("[leads] erro ao gravar lead de varejo:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- leads-server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/leads-server.ts packages/core/src/leads-server.test.ts
git commit -m "feat(core): createRetailLead (lead sem empresa/CNPJ)"
```

---

## Task 4: Core — `product-card` com preço direto no modo `cart`

**Files:**
- Modify: `packages/core/src/features.ts`
- Modify: `packages/core/src/features.test.ts`
- Modify: `packages/core/src/components/product-card.tsx`

**Interfaces:**
- Consumes: `Features` de `./features`.
- Produces: `showsListPrice(features: Features): boolean` — `true` quando `features.commerce === "cart"`. `ProductCard` usa `showsListPrice` para escolher entre preço direto e `PriceLockSlot`.

- [ ] **Step 1: Escrever o teste que falha (função pura)**

Adicionar em `packages/core/src/features.test.ts`:

```ts
import { showsListPrice } from "./features";

describe("showsListPrice", () => {
  it("true no modo carrinho", () => {
    expect(showsListPrice({ commerce: "cart" })).toBe(true);
  });
  it("false no modo cotação", () => {
    expect(showsListPrice({ commerce: "quote" })).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core test -- features`
Expected: FAIL — `showsListPrice` não existe.

- [ ] **Step 3: Implementar `showsListPrice`**

Adicionar em `packages/core/src/features.ts` (depois do type `Features`):

```ts
/** No modo "cart" o preço aparece direto no card; no "quote" ele passa pelo PriceLockSlot (B2B). */
export function showsListPrice(features: Features): boolean {
  return features.commerce === "cart";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core test -- features`
Expected: PASS.

- [ ] **Step 5: Ligar no `product-card.tsx`**

Em `packages/core/src/components/product-card.tsx`:

1. Trocar o import de theme e adicionar features:

```tsx
import { badgeStyle, useClientConfig } from "../theme";
import { showsListPrice } from "../features";
import { PriceLockSlot } from "./lead-gate";
```

2. No corpo do componente, ler `features`:

```tsx
  const { palette, features } = useClientConfig();
```

3. Trocar a linha `<PriceLockSlot priceLabel={product.priceLabel} />` por:

```tsx
        {showsListPrice(features) ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: palette.navy }}>
              {product.priceLabel ?? "Preço indisponível"}
            </div>
          </div>
        ) : (
          <PriceLockSlot priceLabel={product.priceLabel} />
        )}
```

- [ ] **Step 6: Verificar tipos e testes do core**

Run: `pnpm --filter @mypet/core test`
Expected: PASS.

Run: `pnpm lint`
Expected: sem erros novos.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/features.ts packages/core/src/features.test.ts packages/core/src/components/product-card.tsx
git commit -m "feat(core): product-card mostra preço direto no modo cart"
```

---

## Task 5: Core — `SiteNav` com `audienceLabel` configurável

**Files:**
- Modify: `packages/core/src/components/site-nav.tsx`

**Interfaces:**
- Produces: `SiteNav` aceita `audienceLabel?: string | null`. `undefined` → mantém `"Exclusivo para lojistas"`; `null` → não renderiza o texto; string → usa a string. `categories` e `balcaoHref` inalterados.

- [ ] **Step 1: Implementar a prop**

Em `packages/core/src/components/site-nav.tsx`:

1. Assinatura:

```tsx
export function SiteNav({
  categories,
  balcaoHref,
  audienceLabel,
}: {
  categories: CategoryNode[];
  balcaoHref?: string;
  audienceLabel?: string | null;
}) {
```

2. Trocar o `<span className="site-nav-audience">…</span>` fixo por:

```tsx
          {audienceLabel !== null && (
            <span className="site-nav-audience" style={{ fontSize: 13, color: palette.gray600, fontWeight: 600 }}>
              {audienceLabel ?? "Exclusivo para lojistas"}
            </span>
          )}
```

- [ ] **Step 2: Verificar core**

Run: `pnpm --filter @mypet/core test`
Expected: PASS (sem testes de componente; garante que nada quebrou nos `.ts`).

Run: `pnpm --filter distribuidora build`
Expected: build OK — `SiteNav` sem `audienceLabel` continua mostrando o texto padrão.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/site-nav.tsx
git commit -m "feat(core): SiteNav aceita audienceLabel (null esconde o texto B2B)"
```

---

## Task 6: App — scaffold de `apps/azpetshop`

**Files:**
- Create: `apps/azpetshop/package.json`
- Create: `apps/azpetshop/next.config.ts`
- Create: `apps/azpetshop/tsconfig.json`
- Create: `apps/azpetshop/postcss.config.mjs`
- Create: `apps/azpetshop/vercel.json`
- Create: `apps/azpetshop/.env.example`
- Create: `apps/azpetshop/.gitignore`
- Create: `apps/azpetshop/client.config.ts`
- Create: `apps/azpetshop/app/globals.css`
- Create: `apps/azpetshop/app/layout.tsx`
- Create: `apps/azpetshop/app/page.tsx` (placeholder mínimo, substituído na Task 7)

**Interfaces:**
- Produces: workspace `azpetshop` instalável e buildável; `clientConfig` exportado de `@/client.config` com `catalogChannel: "azpetshop"`, `features: SITES.azpetshop.features`.

- [ ] **Step 1: Ler o guia do Next antes de mexer em config**

Ler `node_modules/next/dist/docs/` — em especial o que houver sobre `next.config`, `app/layout`, `metadata` e `cacheComponents`. Conferir se `cacheComponents: true` (usado na distribuidora) continua válido nesta versão.

- [ ] **Step 2: `package.json`**

`apps/azpetshop/package.json`:

```json
{
  "name": "azpetshop",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 4105",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "@mypet/core": "workspace:*",
    "@supabase/ssr": "^0.8.0",
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

- [ ] **Step 3: Configs espelhando a distribuidora**

`apps/azpetshop/next.config.ts`:

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

`apps/azpetshop/tsconfig.json` — copiar `apps/distribuidora/tsconfig.json` verbatim.

`apps/azpetshop/postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

`apps/azpetshop/vercel.json`:

```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "outputDirectory": ".next"
}
```

`apps/azpetshop/.env.example`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_WHATSAPP_NUMBER=5511999999999
```

`apps/azpetshop/.gitignore` — copiar `apps/distribuidora/.gitignore` se existir; senão:

```
/.next/
/node_modules
*.tsbuildinfo
.env*.local
```

- [ ] **Step 4: `client.config.ts` com paleta PROVISÓRIA**

`apps/azpetshop/client.config.ts` (paleta = cópia da `apps/mypet/client.config.ts`, só para renderizar; será trocada no passe de design):

```ts
import type { ClientConfig } from "@mypet/core/theme";
import { SITES } from "@mypet/core/features";

// PROVISÓRIO — paleta placeholder até o passe de identidade visual do azpetshop.
export const clientConfig: ClientConfig = {
  name: "AZ Pet Shop",
  tagline: "Loja online",
  domain: "loja.azpetshop.com.br",
  catalogChannel: "azpetshop",
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
  features: SITES.azpetshop.features,
};
```

- [ ] **Step 5: `globals.css`**

Copiar `apps/distribuidora/app/globals.css` verbatim para `apps/azpetshop/app/globals.css`.

- [ ] **Step 6: `layout.tsx` (sem PWA)**

`apps/azpetshop/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
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
  description:
    "Loja online de produtos para cães, gatos e outros pets. Preços à vista e pedido pelo WhatsApp.",
};

export const viewport: Viewport = {
  themeColor: clientConfig.palette.navy,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${nunito.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd(clientConfig)) }}
        />
        <ClientConfigProvider config={clientConfig}>
          <CartProvider>{children}</CartProvider>
        </ClientConfigProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: `page.tsx` placeholder**

`apps/azpetshop/app/page.tsx`:

```tsx
export default function Home() {
  return <main style={{ padding: 40 }}>AZ Pet Shop — loja (scaffold)</main>;
}
```

- [ ] **Step 8: Instalar e buildar**

Run: `pnpm install`
Expected: workspace `azpetshop` reconhecido, sem erro.

Run: `pnpm --filter azpetshop build`
Expected: build OK.

- [ ] **Step 9: Commit**

```bash
git add apps/azpetshop pnpm-lock.yaml
git commit -m "feat(azpetshop): scaffold do app (config, layout, client.config provisório)"
```

---

## Task 7: App — home com catálogo (sem LeadGate)

**Files:**
- Modify: `apps/azpetshop/app/page.tsx`
- Create: `apps/azpetshop/app/robots.ts`
- Create: `apps/azpetshop/app/sitemap.ts`

**Interfaces:**
- Consumes: `getCategories`, `getProductCount` de `@mypet/core/catalog`; `CatalogSection`, `SiteNav` de `@mypet/core/components/*`; `clientConfig` de `@/client.config`.
- Produces: rota `/` com nav + catálogo do canal `azpetshop`.

- [ ] **Step 1: Ler o guia de `metadata` / `sitemap` / `robots` do Next**

Ler o que houver em `node_modules/next/dist/docs/` sobre `sitemap.ts`, `robots.ts` e `generateMetadata` nesta versão.

- [ ] **Step 2: `page.tsx`**

`apps/azpetshop/app/page.tsx` — versão enxuta, sem `LeadGateProvider`, sem CSS B2B de "unlock":

```tsx
import { Suspense } from "react";
import type { Palette } from "@mypet/core/theme";
import { CatalogSection } from "@mypet/core/components/catalog-section";
import { SiteNav } from "@mypet/core/components/site-nav";
import { getCategories } from "@mypet/core/catalog";
import { clientConfig } from "@/client.config";
import { canonicalUrl } from "@mypet/core/seo";

const { palette: PALETTE } = clientConfig;

export async function generateMetadata() {
  return {
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/") },
  };
}

async function Catalog({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  const sp = await searchParams;
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 80px" }}>
      <h2 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 16 }}>
        Catálogo
      </h2>
      <CatalogSection
        q={sp.q}
        brand={sp.brand}
        page={sp.page}
        channel={clientConfig.catalogChannel}
        palette={clientConfig.palette}
      />
    </section>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  const categories = await getCategories();
  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        .cta-primary {
          background: ${PALETTE.pink}; color: ${PALETTE.white}; border: none;
          border-radius: 100px; padding: 10px 20px;
          font-family: var(--font-nunito), sans-serif; font-size: 14px; font-weight: 800;
          cursor: pointer; transition: background 0.2s;
        }
        .cta-primary:hover { background: ${PALETTE.pinkDark}; }
        .cat-btn {
          padding: 8px 18px; border-radius: 100px; border: 1.5px solid ${PALETTE.gray200};
          background: ${PALETTE.white}; color: ${PALETTE.gray600};
          font-family: var(--font-nunito), sans-serif; font-size: 14px; font-weight: 600;
          cursor: pointer; text-decoration: none;
        }
        .product-card {
          background: ${PALETTE.white}; border-radius: 16px; border: 1px solid ${PALETTE.gray200};
          overflow: hidden; display: flex; flex-direction: column; cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .product-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.10); }
        @media (max-width: 640px) {
          .products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
        }
      `}</style>

      <SiteNav categories={categories} audienceLabel={null} />

      <Suspense fallback={<p style={{ padding: 24, color: PALETTE.gray600 }}>Carregando catálogo…</p>}>
        <Catalog searchParams={searchParams} />
      </Suspense>

      <footer style={{ background: PALETTE.navyDark, padding: "24px" }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          © 2026 {clientConfig.name}. Todos os direitos reservados.
        </span>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: `robots.ts`**

`apps/azpetshop/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";
import { clientConfig } from "@/client.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cotacao", "/api/"],
    },
    sitemap: `https://${clientConfig.domain}/sitemap.xml`,
  };
}
```

- [ ] **Step 4: `sitemap.ts`**

`apps/azpetshop/app/sitemap.ts` (igual ao da distribuidora, sem rotas B2B):

```ts
import type { MetadataRoute } from "next";
import { getSitemapProducts, getCategories } from "@mypet/core/catalog";
import { clientConfig } from "@/client.config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    getSitemapProducts(clientConfig.catalogChannel),
    getCategories(),
  ]);

  const base = `https://${clientConfig.domain}`;

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...categories.map((c) => ({
      url: `${base}/categoria/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${base}/produtos/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
```

- [ ] **Step 5: Build + smoke test local**

Run: `pnpm --filter azpetshop build`
Expected: build OK.

Run: `pnpm --filter azpetshop dev` e abrir `http://localhost:4105`
Expected: nav com "AZ Pet Shop" e sem "Exclusivo para lojistas"; seção "Catálogo" mostra "0 produtos" (canal ainda não populado no Supabase) sem erro de runtime; nenhum modal de desbloqueio.

- [ ] **Step 6: Commit**

```bash
git add apps/azpetshop/app/page.tsx apps/azpetshop/app/robots.ts apps/azpetshop/app/sitemap.ts
git commit -m "feat(azpetshop): home com catálogo do canal azpetshop, sem trava de preço"
```

---

## Task 8: App — rotas de categoria e produto

**Files:**
- Create: `apps/azpetshop/app/categoria/[slug]/page.tsx`
- Create: `apps/azpetshop/app/produtos/[id]/page.tsx`
- Create: `apps/azpetshop/app/opengraph-image.tsx`

**Interfaces:**
- Consumes: `CategoryListing` de `@mypet/core/components/category-listing`; `ProductVariantPanel` de `@mypet/core/components/product-variant-panel`; `getCategories`, `getProductById` de `@mypet/core/catalog`; `getCategoryPath` de `@mypet/core/catalog-utils`; SEO helpers de `@mypet/core/seo`.
- Produces: rotas `/categoria/[slug]` e `/produtos/[id]`.

- [ ] **Step 1: `categoria/[slug]/page.tsx`**

Baseado em `apps/distribuidora/app/categoria/[slug]/page.tsx`, **sem** `LeadGateProvider` e sem o CSS de `unlock-btn`. Estrutura:

```tsx
import { Suspense } from "react";
import { getCategories } from "@mypet/core/catalog";
import { CategoryListing } from "@mypet/core/components/category-listing";
import { SiteNav } from "@mypet/core/components/site-nav";
import { clientConfig } from "@/client.config";
import { canonicalUrl } from "@mypet/core/seo";

const { palette: PALETTE } = clientConfig;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categories = await getCategories();
  const node = categories.find((c) => c.slug === slug);
  if (!node) return { title: `Categoria não encontrada — ${clientConfig.name}` };
  return {
    title: `${node.name} — ${clientConfig.name}`,
    description: `Produtos de ${node.name} na ${clientConfig.name}. Preços à vista, pedido pelo WhatsApp.`,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/categoria/${slug}`) },
    openGraph: { title: node.name, description: `Produtos de ${node.name} na ${clientConfig.name}.` },
  };
}

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page } = await searchParams;
  const categories = await getCategories();

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        .cat-btn {
          padding: 8px 18px; border-radius: 100px; border: 1.5px solid ${PALETTE.gray200};
          background: ${PALETTE.white}; color: ${PALETTE.gray600};
          font-family: var(--font-nunito), sans-serif; font-size: 14px; font-weight: 600;
          cursor: pointer; text-decoration: none;
        }
        .product-card {
          background: ${PALETTE.white}; border-radius: 16px; border: 1px solid ${PALETTE.gray200};
          overflow: hidden; display: flex; flex-direction: column; cursor: pointer;
        }
        @media (max-width: 640px) {
          .products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
        }
      `}</style>
      <SiteNav categories={categories} audienceLabel={null} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando…</p>}>
          <CategoryListing
            slug={slug}
            page={page}
            channel={clientConfig.catalogChannel}
            palette={clientConfig.palette}
            domain={clientConfig.domain}
          />
        </Suspense>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `produtos/[id]/page.tsx`**

Baseado em `apps/distribuidora/app/produtos/[id]/page.tsx`, **sem** `LeadGateProvider` e sem CSS de `unlock-btn`/`modal`. `ProductVariantPanel` já mostra preço (`priceLabel`) e `AddToCartControl` — nenhuma trava. Estrutura:

```tsx
import { getProductById, getCategories } from "@mypet/core/catalog";
import { getCategoryPath } from "@mypet/core/catalog-utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { ProductVariantPanel } from "@mypet/core/components/product-variant-panel";
import {
  productGroupJsonLd,
  productJsonLd,
  breadcrumbJsonLd,
  canonicalUrl,
  jsonLdScript,
} from "@mypet/core/seo";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id, clientConfig.catalogChannel);
  if (!product) return { title: `Produto não encontrado — ${clientConfig.name}` };
  return {
    title: `${product.name} — ${clientConfig.name}`,
    description: `${product.name} na ${clientConfig.name}. Preço à vista e pedido pelo WhatsApp.`,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/produtos/${id}`) },
    openGraph: {
      title: product.name,
      description: `${product.name} na ${clientConfig.name}.`,
      images: [product.img],
    },
    twitter: { card: "summary_large_image", images: [product.img] },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProductById(id, clientConfig.catalogChannel),
    getCategories(),
  ]);
  if (!product) notFound();

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        .back-link {
          display: inline-flex; align-items: center; gap: 6px; color: ${PALETTE.gray600};
          font-size: 14px; font-weight: 700; text-decoration: none; margin-bottom: 24px;
        }
      `}</style>
      <SiteNav categories={categories} audienceLabel={null} />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px" }}>
        <Link href="/" className="back-link">← Voltar</Link>
        <ProductVariantPanel product={product} palette={clientConfig.palette} />
      </div>
    </div>
  );
}
```

Se ao inspecionar `product-variant-panel.tsx` a assinatura de props diferir (ex.: não receber `palette`), ajustar a chamada ao que o componente realmente exporta — conferir o arquivo antes de finalizar.

- [ ] **Step 3: `opengraph-image.tsx`**

Copiar `apps/distribuidora/app/opengraph-image.tsx` e trocar textos B2B ("Atacado", "lojistas") por copy B2C ("Loja online"). Manter dimensões e runtime.

- [ ] **Step 4: Build**

Run: `pnpm --filter azpetshop build`
Expected: build OK, rotas `/categoria/[slug]` e `/produtos/[id]` compiladas.

- [ ] **Step 5: Commit**

```bash
git add apps/azpetshop/app/categoria apps/azpetshop/app/produtos apps/azpetshop/app/opengraph-image.tsx
git commit -m "feat(azpetshop): rotas de categoria e produto"
```

---

## Task 9: App — fluxo de cotação sem conta

**Files:**
- Create: `apps/azpetshop/app/cotacao/page.tsx`
- Create: `apps/azpetshop/app/cotacao/cotacao-content.tsx`
- Create: `apps/azpetshop/app/cotacao/actions.ts`
- Create: `apps/azpetshop/app/cotacao/actions.test.ts`
- Create: `apps/azpetshop/vitest.config.ts`
- Create: `apps/azpetshop/vitest.setup.ts`

**Interfaces:**
- Consumes: `useCart` de `@mypet/core/components/cart-provider`; `buildRetailQuoteMessage`, `buildWhatsAppLink` de `@mypet/core/whatsapp` (Task 2); `createRetailLead` de `@mypet/core/leads-server` (Task 3).
- Produces: `finalizeQuote(input: { nome: string; whatsapp: string }): Promise<{ ok: true } | { ok: false; error: string }>` em `actions.ts`. Rota `/cotacao`.

- [ ] **Step 1: `vitest.config.ts` e `vitest.setup.ts`**

Copiar `apps/mypet/vitest.config.ts` e `apps/mypet/vitest.setup.ts` verbatim para `apps/azpetshop/`.

- [ ] **Step 2: Escrever o teste de `finalizeQuote` (falha)**

`apps/azpetshop/app/cotacao/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createRetailLead = vi.fn();
vi.mock("@mypet/core/leads-server", () => ({
  createRetailLead: (input: unknown) => createRetailLead(input),
}));

import { finalizeQuote } from "./actions";

beforeEach(() => {
  createRetailLead.mockReset();
});

describe("finalizeQuote", () => {
  it("grava o lead de varejo no canal azpetshop e retorna ok", async () => {
    createRetailLead.mockResolvedValue({ ok: true });

    const result = await finalizeQuote({ nome: "Maria", whatsapp: "11988887777" });

    expect(createRetailLead).toHaveBeenCalledWith({
      channel: "azpetshop",
      nome: "Maria",
      whatsapp: "11988887777",
    });
    expect(result).toEqual({ ok: true });
  });

  it("retorna erro de validação sem chamar o core quando falta nome", async () => {
    const result = await finalizeQuote({ nome: "  ", whatsapp: "11988887777" });
    expect(result).toEqual({ ok: false, error: "Informe seu nome e WhatsApp." });
    expect(createRetailLead).not.toHaveBeenCalled();
  });

  it("segue mesmo se a gravação do lead falhar (não bloqueia a cotação)", async () => {
    createRetailLead.mockResolvedValue({ ok: false, error: "boom" });
    const result = await finalizeQuote({ nome: "Maria", whatsapp: "11988887777" });
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter azpetshop test`
Expected: FAIL — `./actions` não existe.

- [ ] **Step 4: Implementar `actions.ts`**

`apps/azpetshop/app/cotacao/actions.ts`:

```ts
"use server";

import { createRetailLead } from "@mypet/core/leads-server";
import { clientConfig } from "@/client.config";
import type { Channel } from "@mypet/core/channels";

export type FinalizeQuoteResult = { ok: true } | { ok: false; error: string };

export async function finalizeQuote(input: {
  nome: string;
  whatsapp: string;
}): Promise<FinalizeQuoteResult> {
  const nome = input.nome?.trim();
  const whatsapp = input.whatsapp?.trim();
  if (!nome || !whatsapp) {
    return { ok: false, error: "Informe seu nome e WhatsApp." };
  }

  // Best-effort: histórico de quem pediu cotação. Falha aqui não impede o pedido.
  const lead = await createRetailLead({
    channel: clientConfig.catalogChannel as Channel,
    nome,
    whatsapp,
  });
  if (!lead.ok) {
    console.error("[azpetshop] lead não gravado:", lead.error);
  }

  return { ok: true };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter azpetshop test`
Expected: PASS.

- [ ] **Step 6: `cotacao-content.tsx` (client)**

`apps/azpetshop/app/cotacao/cotacao-content.tsx` — baseado em `apps/mypet/app/cotacao/cotacao-content.tsx`, com estas diferenças: (a) formulário coleta **nome + WhatsApp**; (b) usa `buildRetailQuoteMessage`; (c) sem link para `/pedidos`; (d) `finalizeQuote` recebe `{ nome, whatsapp }` e nunca retorna `needsAuth`.

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@mypet/core/components/cart-provider";
import { buildRetailQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
import type { Palette } from "@mypet/core/theme";
import { finalizeQuote } from "./actions";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export function CotacaoContent({ palette: PALETTE }: { palette: Palette }) {
  const { cart, removeItem, updateQty, clear } = useCart();
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: PALETTE.navy, marginBottom: 8 }}>Pedido enviado!</h2>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Abrimos o WhatsApp com os itens do seu pedido. Nossa equipe vai te responder por lá.
        </p>
        <Link href="/" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>Seu carrinho está vazio</h2>
        <Link href="/" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>Ver catálogo</Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!WHATSAPP_NUMBER) {
      setSubmitError("Não foi possível abrir o WhatsApp agora. Tente novamente mais tarde.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");

    const result = await finalizeQuote({ nome, whatsapp });
    if (!result.ok) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    const message = buildRetailQuoteMessage(cart.items, { nome, whatsapp });
    window.open(buildWhatsAppLink(WHATSAPP_NUMBER, message), "_blank");

    clear();
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <>
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, marginBottom: 24, overflow: "hidden" }}>
        {cart.items.map((item, index) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, borderBottom: index < cart.items.length - 1 ? `1px solid ${PALETTE.gray100}` : "none" }}>
            <img src={item.img} alt={item.name} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: PALETTE.navy, lineHeight: 1.3 }}>{item.name}</p>
              {item.sku && <p style={{ fontSize: 11, color: PALETTE.gray400 }}>SKU: {item.sku}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 8 }}>
              <button type="button" onClick={() => updateQty(item.id, item.qty - 1)} aria-label="Diminuir quantidade" style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}>−</button>
              <span style={{ minWidth: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: PALETTE.navy }}>{item.qty}</span>
              <button type="button" onClick={() => updateQty(item.id, item.qty + 1)} aria-label="Aumentar quantidade" style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}>+</button>
            </div>
            <button type="button" onClick={() => removeItem(item.id)} aria-label={`Remover ${item.name}`} style={{ border: "none", background: "transparent", color: PALETTE.gray400, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Remover</button>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 24 }}>
        <input
          className="form-input"
          placeholder="Seu nome"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 10, fontSize: 15, marginBottom: 12 }}
        />
        <input
          className="form-input"
          placeholder="WhatsApp com DDD"
          required
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 10, fontSize: 15, marginBottom: 12 }}
        />
        {submitError && <p style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 12, textAlign: "center" }}>{submitError}</p>}
        <button type="submit" className="form-submit" disabled={submitting} style={{ width: "100%", padding: 14, background: PALETTE.pink, color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
          {submitting ? "Enviando..." : "Enviar pedido pelo WhatsApp →"}
        </button>
      </form>
    </>
  );
}
```

- [ ] **Step 7: `cotacao/page.tsx`**

`apps/azpetshop/app/cotacao/page.tsx` — server component, sem `requireBuyer`, sem redirect:

```tsx
import Link from "next/link";
import { getCategories } from "@mypet/core/catalog";
import { SiteNav } from "@mypet/core/components/site-nav";
import { clientConfig } from "@/client.config";
import { CotacaoContent } from "./cotacao-content";

const { palette: PALETTE } = clientConfig;

export const metadata = { robots: { index: false } };

export default async function CotacaoPage() {
  const categories = await getCategories();
  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        .cta-primary {
          background: ${PALETTE.pink}; color: #fff; border: none; border-radius: 100px;
          padding: 10px 22px; font-size: 14px; font-weight: 800; cursor: pointer;
        }
      `}</style>
      <SiteNav categories={categories} audienceLabel={null} />
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px" }}>
        <Link href="/" style={{ color: PALETTE.gray600, fontSize: 14, fontWeight: 700, textDecoration: "none", display: "inline-block", marginBottom: 24 }}>← Continuar comprando</Link>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 20 }}>Seu pedido</h1>
        <CotacaoContent palette={clientConfig.palette} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Rodar testes e build**

Run: `pnpm --filter azpetshop test`
Expected: PASS.

Run: `pnpm --filter azpetshop build`
Expected: build OK.

- [ ] **Step 9: Commit**

```bash
git add apps/azpetshop/app/cotacao apps/azpetshop/vitest.config.ts apps/azpetshop/vitest.setup.ts
git commit -m "feat(azpetshop): cotação por WhatsApp sem conta (nome + whatsapp)"
```

---

## Task 10: Wiring — scripts da raiz e card no hub

**Files:**
- Modify: `package.json` (raiz)
- Modify: `apps/hub/app/page.tsx`

**Interfaces:**
- Produces: `pnpm dev:azpetshop`; `azpetshop` incluído em `pnpm dev:all`; card do azpetshop no hub (porta 4105).

- [ ] **Step 1: Scripts da raiz**

Em `package.json` (raiz), no bloco `scripts`, adicionar `dev:azpetshop` e incluir no `dev:all`:

```json
    "dev:azpetshop": "pnpm --filter azpetshop dev",
    "dev:all": "concurrently -n mypet,distribuidora,madpet,admin,hub,azpetshop -c blue,green,yellow,magenta,cyan,red \"pnpm --filter mypet dev\" \"pnpm --filter distribuidora dev\" \"pnpm --filter madpet dev\" \"pnpm --filter admin dev\" \"pnpm --filter hub dev\" \"pnpm --filter azpetshop dev\"",
```

(`build` = `pnpm -r build` e `lint` = `eslint` já cobrem o novo app automaticamente.)

- [ ] **Step 2: Card no hub**

Em `apps/hub/app/page.tsx`, adicionar ao array `SITES`:

```ts
  {
    name: "AZ Pet Shop",
    description: "Loja de consumidor final — cotação por WhatsApp",
    port: 4105,
  },
```

- [ ] **Step 3: Verificar**

Run: `pnpm dev:azpetshop`
Expected: sobe na porta 4105.

Run: `pnpm --filter hub build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add package.json apps/hub/app/page.tsx
git commit -m "chore(azpetshop): dev:azpetshop, dev:all e card no hub"
```

---

## Task 11: Script de importação de preços de varejo

**Files:**
- Create: `scripts/azpetshop-import-precos.ts`
- Create: `scripts/azpetshop-import-precos.test.ts`
- Create: `scripts/azpetshop-precos.exemplo.csv`
- Modify: `package.json` (raiz) — script `azpetshop:import-precos`

**Interfaces:**
- Produces: função pura `parsePrecosCsv(text: string): { reference: string; price: number }[]` (testável) e um `main()` que resolve `reference → products.id` e faz `upsert` em `product_channel_prices` (`channel = "azpetshop"`).

- [ ] **Step 1: Confirmar o schema de `product_channel_prices`**

Antes de escrever o `upsert`, confirmar as colunas reais da tabela (nome da FK e da coluna de preço) via MCP Supabase (`list_tables`, schema do `hub_catalogo`) ou `execute_sql` com `select * from product_channel_prices limit 1`. O `select` do core usa `product_channel_prices(channel, sale_price, sale_updated_at)`; assumir `product_id` como FK e `onConflict: "product_id,channel"`. Ajustar os nomes no código deste task ao que a tabela realmente tiver.

- [ ] **Step 2: Escrever o teste do parser (falha)**

`scripts/azpetshop-import-precos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parsePrecosCsv } from "./azpetshop-import-precos";

describe("parsePrecosCsv", () => {
  it("lê cabeçalho reference,price e ignora linhas vazias", () => {
    const csv = "reference,price\nGOLD15,199.90\nCOLEIRA-M,49.9\n\n";
    expect(parsePrecosCsv(csv)).toEqual([
      { reference: "GOLD15", price: 199.9 },
      { reference: "COLEIRA-M", price: 49.9 },
    ]);
  });

  it("aceita separador ; e vírgula decimal", () => {
    const csv = "reference;price\nGOLD15;199,90\n";
    expect(parsePrecosCsv(csv)).toEqual([{ reference: "GOLD15", price: 199.9 }]);
  });

  it("ignora linha sem referência ou com preço inválido", () => {
    const csv = "reference,price\n,10\nX,abc\nY,12.5\n";
    expect(parsePrecosCsv(csv)).toEqual([{ reference: "Y", price: 12.5 }]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run ../../scripts/azpetshop-import-precos.test.ts` — se o runner da raiz não pegar, rodar `npx vitest run scripts/azpetshop-import-precos.test.ts` a partir da raiz.
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar o script**

`scripts/azpetshop-import-precos.ts`:

```ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const CHANNEL = "azpetshop";

export function parsePrecosCsv(text: string): { reference: string; price: number }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const out: { reference: string; price: number }[] = [];
  for (const line of lines.slice(1)) {
    const [rawRef, rawPrice] = line.split(sep);
    const reference = (rawRef ?? "").trim();
    const price = Number((rawPrice ?? "").trim().replace(/\./g, sep === ";" ? "" : ".").replace(",", "."));
    if (!reference || !Number.isFinite(price)) continue;
    out.push({ reference, price });
  }
  return out;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("uso: pnpm azpetshop:import-precos <caminho-do-csv>");
    process.exit(1);
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");

  const rows = parsePrecosCsv(readFileSync(csvPath, "utf8"));
  console.log(`${rows.length} linhas lidas de ${csvPath}`);

  const supabase = createClient(url, key);
  let ok = 0;
  let semProduto = 0;

  for (const row of rows) {
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("reference", row.reference)
      .maybeSingle();

    if (!product) {
      semProduto++;
      console.warn(`- referência sem produto: ${row.reference}`);
      continue;
    }

    const { error } = await supabase.from("product_channel_prices").upsert(
      {
        product_id: product.id,
        channel: CHANNEL,
        sale_price: row.price,
        sale_updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id,channel" },
    );
    if (error) {
      console.error(`- erro em ${row.reference}: ${error.message}`);
      continue;
    }
    ok++;
  }

  console.log(`concluído: ${ok} preços gravados, ${semProduto} referências sem produto.`);
}

if (process.argv[1]?.endsWith("azpetshop-import-precos.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

`scripts/azpetshop-precos.exemplo.csv`:

```
reference,price
EXEMPLO-001,49.90
EXEMPLO-002,129.90
```

- [ ] **Step 5: Script no `package.json` da raiz**

```json
    "azpetshop:import-precos": "tsx scripts/azpetshop-import-precos.ts",
```

- [ ] **Step 6: Rodar o teste e ver passar**

Run (da raiz): `npx vitest run scripts/azpetshop-import-precos.test.ts`
Expected: PASS.

- [ ] **Step 7: Teste manual do caminho feliz (opcional, exige `.env` com service key)**

Run: `pnpm azpetshop:import-precos scripts/azpetshop-precos.exemplo.csv`
Expected: loga "2 linhas lidas" e, para referências inexistentes, "referência sem produto" — sem crash. Rodar duas vezes: a segunda não cria linhas novas (upsert).

- [ ] **Step 8: Commit**

```bash
git add scripts/azpetshop-import-precos.ts scripts/azpetshop-import-precos.test.ts scripts/azpetshop-precos.exemplo.csv package.json
git commit -m "feat(azpetshop): script de importação de preços de varejo (CSV → product_channel_prices)"
```

---

## Task 12: Link "Loja" no blog Astro

**Files (repositório `C:\Projetos\azpetshop`, fora deste monorepo):**
- Modify: `C:\Projetos\azpetshop\src\components\Header.astro`
- Modify: `C:\Projetos\azpetshop\src\components\Footer.astro`

**Interfaces:**
- Produces: link visível `Loja` → `https://loja.azpetshop.com.br` no header e no footer do blog.

- [ ] **Step 1: Inspecionar os dois componentes**

Ler `Header.astro` e `Footer.astro` para achar a lista de navegação existente e seguir o mesmo padrão de marcação/classe dos links atuais.

- [ ] **Step 2: Adicionar o link no Header**

No mesmo bloco `<nav>` dos demais links, seguindo a classe usada pelos vizinhos:

```astro
<a href="https://loja.azpetshop.com.br" class="<mesma-classe-dos-outros-links>">Loja</a>
```

- [ ] **Step 3: Adicionar o link no Footer**

Mesmo tratamento, na coluna/lista de links institucionais do rodapé.

- [ ] **Step 4: Build do blog**

Run (em `C:\Projetos\azpetshop`): `npm run build`
Expected: build OK, `dist/` gerado sem erro.

- [ ] **Step 5: Commit (no repo do blog)**

```bash
cd /c/Projetos/azpetshop
git add src/components/Header.astro src/components/Footer.astro
git commit -m "feat: link para a loja (loja.azpetshop.com.br) no header e footer"
```

---

## Dados no Supabase (fora do código — pré-requisito de validação)

Para o catálogo aparecer, alguém precisa popular no `hub_catalogo`:

- linhas em `product_channel_links` com `channel = 'azpetshop'` para cada produto que a loja vende;
- linhas em `product_channel_prices` com `channel = 'azpetshop'` e `sale_price` (via Task 11 ou manualmente).

Sem essas linhas o app sobe e funciona, mas mostra "0 produtos". Registrar isso no PR para quem cuida do catálogo.

---

## Deploy (fora do código)

- Novo projeto Vercel apontando para `apps/azpetshop` (root directory), `buildCommand`/`installCommand` do `vercel.json`.
- Variáveis de ambiente no projeto Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `SUPABASE_SERVICE_ROLE_KEY` (se o script rodar em CI).
- DNS: `loja.azpetshop.com.br` → Vercel. O apex `azpetshop.com.br` continua no Cloudflare (blog).

---

## Self-Review (feito pelo autor do plano)

**Cobertura do spec:**

| Item do spec | Task |
| --- | --- |
| App `apps/azpetshop` Next.js, porta 4105 | 6 |
| Consome `packages/core` + Supabase `hub_catalogo` | 6, 7, 8 |
| Canal novo `azpetshop` (`channels.ts`, `features.ts`) | 1 |
| `commerce: "cart"` como 1ª implementação do modo | 1, 4 |
| Preço visível, sem LeadGate/PriceLockSlot | 4, 7, 8 |
| Sem contas (`entrar`/`pedidos`/`completar-cadastro`/`buyers`) | 8, 9 (rotas simplesmente não criadas) |
| `buildRetailQuoteMessage` | 2 |
| `createRetailLead` | 3 |
| `SiteNav` `audienceLabel` | 5 |
| Fluxo de cotação sem conta (nome + WhatsApp → `wa.me`) | 9 |
| Preço de varejo em `product_channel_prices` via CSV | 11 |
| Scripts da raiz + card no hub | 10 |
| Link "Loja" no blog Astro | 12 |
| Deploy subdomínio / dados Supabase | seções finais (fora do código) |
| Design adiado (paleta provisória) | 6 |
| `ERP_PRICE_CHANNELS` inalterado | (nenhuma task toca — correto) |

**Placeholder scan:** sem "TBD"/"TODO". Os únicos pontos de "confirmar no código real" são explícitos e acionáveis: assinatura de props de `ProductVariantPanel` (Task 8 Step 2) e colunas de `product_channel_prices` (Task 11 Step 1).

**Consistência de tipos:**
- `finalizeQuote({ nome, whatsapp })` → `{ ok: true } | { ok: false; error: string }` — mesma forma no teste (Task 9 Step 2) e na implementação (Step 4).
- `createRetailLead({ channel, nome, whatsapp })` → `{ ok: true } | { ok: false; error: string }` — consistente entre Task 3 (core) e Task 9 (consumo).
- `buildRetailQuoteMessage(items, { nome, whatsapp })` — mesma assinatura em Task 2 e Task 9.
- `showsListPrice(features)` — definido em Task 4, usado só em Task 4.
- `SiteNav` `audienceLabel?: string | null` — definido em Task 5, usado em Tasks 7/8/9 sempre como `null`.
- `parsePrecosCsv(text) → { reference, price }[]` — mesma forma em teste e implementação (Task 11).
