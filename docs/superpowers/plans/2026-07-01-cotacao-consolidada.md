# Carrinho de Cotação Consolidada — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o lojista adicione múltiplos produtos com quantidade a uma cotação, revise tudo em `/cotacao`, e finalize salvando o lead (como hoje) e abrindo o WhatsApp com a lista de itens.

**Architecture:** `CartProvider` client (Context + `useSyncExternalStore` sobre `localStorage`) no `app/layout.tsx` raiz, para o carrinho persistir entre `/` e `/produtos/[id]`. Funções puras de carrinho (`lib/cart.ts`) e de montagem da mensagem do WhatsApp (`lib/whatsapp.ts`) são testadas isoladamente. Um `SiteNav` compartilhado substitui o `<nav>` duplicado nas duas páginas existentes e ganha um `CartBadge`. A página `/cotacao` é 100% client (depende de `useCart()`), reaproveita o endpoint `/api/leads` já existente e usa `window.open` para o link do WhatsApp.

**Tech Stack:** Next.js 16.2.6 (App Router, Cache Components), React 19, TypeScript, Vitest.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-07-01-cotacao-consolidada-design.md`.
- Destino da cotação consolidada: link do WhatsApp (`wa.me`) montado no cliente — **não** é uma nova tabela/API de persistência de pedidos.
- Fonte: mantém Nunito + Nunito Sans; **não** adiciona Plus Jakarta Sans.
- O fluxo de cotação rápida existente (`UnlockButton` → modal do `LeadGateProvider`, 1 produto) **não é removido nem alterado** — o carrinho é um fluxo adicional.
- `POST /api/leads` **não muda de formato**: recebe apenas `{ nome, empresa, whatsapp, cnpj }`. A lista de itens do carrinho não é gravada na planilha, só entra na mensagem do WhatsApp.
- Revisão do carrinho acontece na página dedicada `/cotacao` (não painel lateral).
- Quantidade é escolhida por um stepper `[ - ] qty [ + ]` no próprio card do produto (mínimo 1) antes de "Adicionar à cotação".
- `NEXT_PUBLIC_WHATSAPP_NUMBER`: variável de ambiente client-side (não é segredo) com valor placeholder em `.env.local`; configurar o número real de produção fica fora deste plano.
- Next.js 16.2.6 com `cacheComponents: true` (`next.config.ts`): `params`/`searchParams` de rota dinâmica são API de runtime e **precisam** ficar dentro de `<Suspense>` (lição aprendida ao corrigir `app/produtos/[id]/page.tsx` nesta mesma branch — não repetir o erro).
- Evitar `setState` síncrono dentro do corpo de um `useEffect` (regra de lint `react-hooks/set-state-in-effect`, já corrigida uma vez em `components/lead-gate.tsx`); para hidratar estado do `localStorage`, usar `useSyncExternalStore`.
- Textos visíveis em português, com acentuação correta.
- Sem preço real: a UI nunca mostra valor monetário, apenas "Preço sob consulta".
- Path alias `@/*` aponta para a raiz do projeto.

---

## File Structure

- `lib/cart.ts` (criar) — tipos `CartItem`/`Cart` + funções puras `addItem`, `removeItem`, `updateQty`, `totalItems`. **Testado.**
- `lib/cart.test.ts` (criar).
- `lib/whatsapp.ts` (criar) — `buildQuoteMessage`, `buildWhatsAppLink`. **Testado.**
- `lib/whatsapp.test.ts` (criar).
- `components/cart-provider.tsx` (criar) — `'use client'`: `CartProvider`, `useCart`.
- `components/cart-badge.tsx` (criar) — `'use client'`: ícone + contagem, link para `/cotacao`.
- `components/site-nav.tsx` (criar) — server component: nav compartilhado (logo, `UnlockButton`, `CartBadge`).
- `components/add-to-cart-control.tsx` (criar) — `'use client'`: stepper de quantidade + botão "Adicionar à cotação".
- `app/cotacao/page.tsx` (criar) — `'use client'`: lista de itens, formulário de lead, envio (salva lead + abre WhatsApp).
- `app/layout.tsx` (modificar) — envolve `children` com `CartProvider`; corrige `lang="en"` → `lang="pt-BR"` e `metadata` genérica.
- `app/page.tsx` (modificar) — troca o `<nav>` inline por `<SiteNav />`.
- `app/produtos/[id]/page.tsx` (modificar) — troca o `<nav>` inline por `<SiteNav />`; adiciona `AddToCartControl` no card de preço/cotação.
- `components/product-card.tsx` (modificar) — adiciona `AddToCartControl` abaixo do `UnlockButton`.
- `.env.local` (modificar, não versionado) — adiciona `NEXT_PUBLIC_WHATSAPP_NUMBER`.
- `README.md` (modificar) — documenta a nova variável de ambiente.

---

## Task 1: `lib/cart.ts` — funções puras do carrinho (TDD)

**Files:**
- Create: `lib/cart.ts`
- Test: `lib/cart.test.ts`

**Interfaces:**
- Produces: tipos `CartItem`, `Cart`; `addItem(cart, product, qty)`, `removeItem(cart, id)`, `updateQty(cart, id, qty)`, `totalItems(cart)`.
- Consumes: nada (módulo puro).

- [ ] **Step 1: Escrever os testes (falhando)** em `lib/cart.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { addItem, removeItem, updateQty, totalItems, type Cart } from "./cart";

const emptyCart: Cart = { items: [] };
const product = { id: "p1", name: "RAÇÃO X", sku: "100", brand: "NAPI", img: "/img.jpg" };

describe("addItem", () => {
  it("adiciona um item novo com a quantidade informada", () => {
    const cart = addItem(emptyCart, product, 2);
    expect(cart.items).toEqual([{ ...product, qty: 2 }]);
  });

  it("soma a quantidade quando o item já existe", () => {
    const cart = addItem({ items: [{ ...product, qty: 2 }] }, product, 3);
    expect(cart.items).toEqual([{ ...product, qty: 5 }]);
  });
});

describe("removeItem", () => {
  it("remove o item pelo id", () => {
    const cart = removeItem({ items: [{ ...product, qty: 2 }] }, "p1");
    expect(cart.items).toEqual([]);
  });

  it("não faz nada se o id não existe", () => {
    const cart = removeItem({ items: [{ ...product, qty: 2 }] }, "outro");
    expect(cart.items).toEqual([{ ...product, qty: 2 }]);
  });
});

describe("updateQty", () => {
  it("atualiza a quantidade do item", () => {
    const cart = updateQty({ items: [{ ...product, qty: 2 }] }, "p1", 5);
    expect(cart.items).toEqual([{ ...product, qty: 5 }]);
  });

  it("remove o item quando qty <= 0", () => {
    const cart = updateQty({ items: [{ ...product, qty: 2 }] }, "p1", 0);
    expect(cart.items).toEqual([]);
  });
});

describe("totalItems", () => {
  it("soma as quantidades de todos os itens", () => {
    const cart: Cart = {
      items: [
        { ...product, qty: 2 },
        { ...product, id: "p2", qty: 3 },
      ],
    };
    expect(totalItems(cart)).toBe(5);
  });

  it("retorna 0 para carrinho vazio", () => {
    expect(totalItems(emptyCart)).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test`
Expected: FAIL — `cart` não existe / exports indefinidos.

- [ ] **Step 3: Implementar `lib/cart.ts`**

```ts
export type CartItem = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  qty: number;
};

export type Cart = { items: CartItem[] };

export const EMPTY_CART: Cart = { items: [] };

export function addItem(cart: Cart, product: Omit<CartItem, "qty">, qty: number): Cart {
  const existing = cart.items.find((item) => item.id === product.id);
  if (existing) {
    return {
      items: cart.items.map((item) =>
        item.id === product.id ? { ...item, qty: item.qty + qty } : item
      ),
    };
  }
  return { items: [...cart.items, { ...product, qty }] };
}

export function removeItem(cart: Cart, id: string): Cart {
  return { items: cart.items.filter((item) => item.id !== id) };
}

export function updateQty(cart: Cart, id: string, qty: number): Cart {
  if (qty <= 0) return removeItem(cart, id);
  return {
    items: cart.items.map((item) => (item.id === id ? { ...item, qty } : item)),
  };
}

export function totalItems(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.qty, 0);
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: PASS — todos os testes de `cart`.

- [ ] **Step 5: Commit**

```bash
git add lib/cart.ts lib/cart.test.ts
git commit -m "feat: funções puras do carrinho de cotação"
```

---

## Task 2: `lib/whatsapp.ts` — mensagem e link do WhatsApp (TDD)

**Files:**
- Create: `lib/whatsapp.ts`
- Test: `lib/whatsapp.test.ts`

**Interfaces:**
- Consumes: `CartItem` (Task 1).
- Produces: tipo `QuoteCustomer`; `buildQuoteMessage(items: CartItem[], customer: QuoteCustomer): string`; `buildWhatsAppLink(phoneNumber: string, message: string): string`.

- [ ] **Step 1: Escrever os testes (falhando)** em `lib/whatsapp.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildQuoteMessage, buildWhatsAppLink } from "./whatsapp";
import type { CartItem } from "./cart";

const customer = { nome: "João", empresa: "Pet Shop X", whatsapp: "11999999999" };

describe("buildQuoteMessage", () => {
  it("monta a mensagem com um item e sem cnpj", () => {
    const items: CartItem[] = [
      { id: "p1", name: "RAÇÃO PREMIUM 15KG", sku: "15675", brand: "NAPI", img: "/img.jpg", qty: 2 },
    ];
    const message = buildQuoteMessage(items, customer);
    expect(message).toBe(
      [
        "Olá! Gostaria de uma cotação de atacado:",
        "",
        "- RAÇÃO PREMIUM 15KG (SKU 15675) — Qtd: 2",
        "",
        "Meus dados:",
        "Nome: João",
        "Empresa: Pet Shop X",
        "WhatsApp: 11999999999",
      ].join("\n")
    );
  });

  it("inclui o cnpj quando informado", () => {
    const items: CartItem[] = [
      { id: "p1", name: "AREIA HIGIÊNICA 4KG", sku: "", brand: null, img: "/img.jpg", qty: 1 },
    ];
    const message = buildQuoteMessage(items, { ...customer, cnpj: "12.345.678/0001-99" });
    expect(message).toContain("CNPJ: 12.345.678/0001-99");
    expect(message).toContain("- AREIA HIGIÊNICA 4KG — Qtd: 1");
  });

  it("junta múltiplos itens em linhas separadas", () => {
    const items: CartItem[] = [
      { id: "p1", name: "RAÇÃO X", sku: "1", brand: "A", img: "/1.jpg", qty: 2 },
      { id: "p2", name: "AREIA Y", sku: "2", brand: "B", img: "/2.jpg", qty: 3 },
    ];
    const message = buildQuoteMessage(items, customer);
    expect(message).toContain("- RAÇÃO X (SKU 1) — Qtd: 2");
    expect(message).toContain("- AREIA Y (SKU 2) — Qtd: 3");
  });
});

describe("buildWhatsAppLink", () => {
  it("monta a URL codificando a mensagem", () => {
    const link = buildWhatsAppLink("5511999999999", "Olá! Teste com acento é ção");
    expect(link).toBe(
      "https://wa.me/5511999999999?text=Ol%C3%A1!%20Teste%20com%20acento%20%C3%A9%20%C3%A7%C3%A3o"
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test`
Expected: FAIL — `whatsapp` não existe.

- [ ] **Step 3: Implementar `lib/whatsapp.ts`**

```ts
import type { CartItem } from "./cart";

export type QuoteCustomer = {
  nome: string;
  empresa: string;
  whatsapp: string;
  cnpj?: string;
};

export function buildQuoteMessage(items: CartItem[], customer: QuoteCustomer): string {
  const itemLines = items
    .map((item) => {
      const skuPart = item.sku ? ` (SKU ${item.sku})` : "";
      return `- ${item.name}${skuPart} — Qtd: ${item.qty}`;
    })
    .join("\n");

  const customerLines = [
    `Nome: ${customer.nome}`,
    `Empresa: ${customer.empresa}`,
    `WhatsApp: ${customer.whatsapp}`,
  ];
  if (customer.cnpj) customerLines.push(`CNPJ: ${customer.cnpj}`);

  return [
    "Olá! Gostaria de uma cotação de atacado:",
    "",
    itemLines,
    "",
    "Meus dados:",
    ...customerLines,
  ].join("\n");
}

export function buildWhatsAppLink(phoneNumber: string, message: string): string {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/whatsapp.ts lib/whatsapp.test.ts
git commit -m "feat: montagem da mensagem e do link do WhatsApp"
```

---

## Task 3: `components/cart-provider.tsx` — estado do carrinho (client)

Usa `useSyncExternalStore` sobre `localStorage` (não `useEffect` + `setState`) para evitar o erro de lint `react-hooks/set-state-in-effect` já visto neste branch, e para não causar diferença de hidratação entre servidor e cliente.

**Files:**
- Create: `components/cart-provider.tsx`

**Interfaces:**
- Consumes: `addItem`, `removeItem`, `updateQty`, `totalItems`, `Cart`, `CartItem` (Task 1).
- Produces: `CartProvider({ children })`; `useCart(): { cart: Cart; addItem(product, qty): void; removeItem(id): void; updateQty(id, qty): void; totalItems: number; clear(): void }`.

- [ ] **Step 1: Implementar `components/cart-provider.tsx`**

```tsx
"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import {
  addItem as addItemPure,
  removeItem as removeItemPure,
  totalItems as totalItemsPure,
  updateQty as updateQtyPure,
  type Cart,
  type CartItem,
} from "@/lib/cart";

const STORAGE_KEY = "mypet_cart";
const CART_EVENT = "mypet_cart_updated";
const EMPTY_CART: Cart = { items: [] };

let cachedRaw: string | null = null;
let cachedSnapshot: Cart = EMPTY_CART;

function readCart(): Cart {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
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
}

function writeCart(cart: Cart) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event(CART_EVENT));
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

type CartContextValue = {
  cart: Cart;
  addItem: (product: Omit<CartItem, "qty">, qty: number) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  totalItems: number;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de CartProvider");
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const cart = useSyncExternalStore(subscribe, readCart, getServerSnapshot);

  const addItemFn = useCallback((product: Omit<CartItem, "qty">, qty: number) => {
    writeCart(addItemPure(readCart(), product, qty));
  }, []);

  const removeItemFn = useCallback((id: string) => {
    writeCart(removeItemPure(readCart(), id));
  }, []);

  const updateQtyFn = useCallback((id: string, qty: number) => {
    writeCart(updateQtyPure(readCart(), id, qty));
  }, []);

  const clearFn = useCallback(() => {
    writeCart(EMPTY_CART);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem: addItemFn,
        removeItem: removeItemFn,
        updateQty: updateQtyFn,
        totalItems: totalItemsPure(cart),
        clear: clearFn,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
```

- [ ] **Step 2: Rodar lint e build**

Run:
```bash
npm run lint
npm run build
```
Expected: sem erros novos (o componente ainda não é usado em nenhuma página, então não altera a árvore renderizada).

- [ ] **Step 3: Commit**

```bash
git add components/cart-provider.tsx
git commit -m "feat: CartProvider com estado sincronizado via localStorage"
```

---

## Task 4: `components/cart-badge.tsx` — ícone do carrinho no nav

**Files:**
- Create: `components/cart-badge.tsx`

**Interfaces:**
- Consumes: `useCart` (Task 3); `PALETTE` (`@/lib/theme`).
- Produces: `CartBadge()`.

- [ ] **Step 1: Implementar `components/cart-badge.tsx`**

```tsx
"use client";

import Link from "next/link";
import { PALETTE } from "@/lib/theme";
import { useCart } from "@/components/cart-provider";

export function CartBadge() {
  const { totalItems } = useCart();

  return (
    <Link
      href="/cotacao"
      aria-label={
        totalItems > 0
          ? `Carrinho de cotação com ${totalItems} ${totalItems === 1 ? "item" : "itens"}`
          : "Carrinho de cotação vazio"
      }
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: PALETTE.gray100,
        textDecoration: "none",
        fontSize: 18,
      }}
    >
      🛒
      {totalItems > 0 && (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: "0 4px",
            borderRadius: 100,
            background: PALETTE.pink,
            color: PALETTE.white,
            fontSize: 11,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {totalItems}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cart-badge.tsx
git commit -m "feat: badge do carrinho de cotação"
```

---

## Task 5: `components/site-nav.tsx` + `app/layout.tsx` — nav compartilhado e CartProvider raiz

**Files:**
- Create: `components/site-nav.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `UnlockButton` (`@/components/lead-gate`), `CartBadge` (Task 4), `CartProvider` (Task 3), `PALETTE` (`@/lib/theme`).
- Produces: `SiteNav()` (server component).

- [ ] **Step 1: Implementar `components/site-nav.tsx`**

```tsx
import Link from "next/link";
import { PALETTE } from "@/lib/theme";
import { UnlockButton } from "@/components/lead-gate";
import { CartBadge } from "@/components/cart-badge";

export function SiteNav() {
  return (
    <nav style={{ background: PALETTE.white, borderBottom: `1px solid ${PALETTE.gray200}`, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 34, height: 34, background: PALETTE.pink, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 18 }}>🐾</span>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: PALETTE.navy, lineHeight: 1 }}>My Pet Brasil</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: PALETTE.pink, letterSpacing: "0.12em", textTransform: "uppercase" }}>Atacado B2B</div>
          </div>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: PALETTE.gray600, fontWeight: 600 }}>Exclusivo para lojistas</span>
          <CartBadge />
          <UnlockButton className="cta-primary" style={{ padding: "10px 22px", fontSize: 14 }}>
            Solicitar cotação
          </UnlockButton>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Modificar `app/layout.tsx`**

Conteúdo atual completo do arquivo:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

Substituir pelo conteúdo completo:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Pet Brasil — Atacado B2B",
  description:
    "Catálogo de atacado para pet shops e distribuidores. Cadastro gratuito, cotações sob consulta.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Rodar lint e build**

Run:
```bash
npm run lint
npm run build
```
Expected: sem erros (as páginas ainda usam o `<nav>` inline antigo, não `SiteNav`, então nada quebra; `CartProvider` agora envolve toda a árvore sem efeito visível ainda).

- [ ] **Step 4: Commit**

```bash
git add components/site-nav.tsx app/layout.tsx
git commit -m "feat: nav compartilhado, CartProvider no layout raiz e correção de lang/metadata"
```

---

## Task 6: `components/add-to-cart-control.tsx` — stepper e botão de adicionar

**Files:**
- Create: `components/add-to-cart-control.tsx`

**Interfaces:**
- Consumes: `useCart` (Task 3); `CartItem` (Task 1); `PALETTE` (`@/lib/theme`).
- Produces: `AddToCartControl({ product }: { product: Omit<CartItem, "qty"> })`.

- [ ] **Step 1: Implementar `components/add-to-cart-control.tsx`**

```tsx
"use client";

import { useState } from "react";
import { PALETTE } from "@/lib/theme";
import { useCart } from "@/components/cart-provider";
import type { CartItem } from "@/lib/cart";

export function AddToCartControl({ product }: { product: Omit<CartItem, "qty"> }) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem(product, qty);
    setQty(1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 8 }}>
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          aria-label="Diminuir quantidade"
          style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
        >
          −
        </button>
        <span style={{ minWidth: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: PALETTE.navy }}>{qty}</span>
        <button
          type="button"
          onClick={() => setQty((q) => q + 1)}
          aria-label="Aumentar quantidade"
          style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        style={{
          flex: 1,
          padding: "8px 0",
          background: added ? PALETTE.green : PALETTE.gray100,
          color: added ? PALETTE.white : PALETTE.navy,
          border: "none",
          borderRadius: 8,
          fontFamily: "Nunito, sans-serif",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          transition: "background 0.2s, color 0.2s",
        }}
      >
        {added ? "Adicionado ✓" : "+ Adicionar à cotação"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/add-to-cart-control.tsx
git commit -m "feat: controle de quantidade e adicionar ao carrinho"
```

---

## Task 7: Integrar `SiteNav` e `AddToCartControl` nas páginas existentes

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/produtos/[id]/page.tsx`
- Modify: `components/product-card.tsx`

**Interfaces:**
- Consumes: `SiteNav` (Task 5), `AddToCartControl` (Task 6).

- [ ] **Step 1: `app/page.tsx` — trocar o import e o `<nav>` inline**

No topo do arquivo, adicionar o import (junto aos demais imports de `@/components`):
```tsx
import { SiteNav } from "@/components/site-nav";
```

Substituir o bloco (dentro de `<LeadGateProvider>`):
```tsx
        {/* NAV */}
        <nav style={{ background: PALETTE.white, borderBottom: `1px solid ${PALETTE.gray200}`, position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, background: PALETTE.pink, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 18 }}>🐾</span>
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, color: PALETTE.navy, lineHeight: 1 }}>My Pet Brasil</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: PALETTE.pink, letterSpacing: "0.12em", textTransform: "uppercase" }}>Atacado B2B</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: PALETTE.gray600, fontWeight: 600 }}>Exclusivo para lojistas</span>
              <UnlockButton className="cta-primary" style={{ padding: "10px 22px", fontSize: 14 }}>
                Solicitar cotação
              </UnlockButton>
            </div>
          </div>
        </nav>
```
por:
```tsx
        {/* NAV */}
        <SiteNav />
```

- [ ] **Step 2: `app/produtos/[id]/page.tsx` — trocar o import, o `<nav>` inline e adicionar `AddToCartControl`**

No topo do arquivo, adicionar os imports:
```tsx
import { SiteNav } from "@/components/site-nav";
import { AddToCartControl } from "@/components/add-to-cart-control";
```

Substituir o bloco (dentro de `<LeadGateProvider>`):
```tsx
        {/* NAV */}
        <nav style={{ background: PALETTE.white, borderBottom: `1px solid ${PALETTE.gray200}`, position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <div style={{ width: 34, height: 34, background: PALETTE.pink, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 18 }}>🐾</span>
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, color: PALETTE.navy, lineHeight: 1 }}>My Pet Brasil</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: PALETTE.pink, letterSpacing: "0.12em", textTransform: "uppercase" }}>Atacado B2B</div>
              </div>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: PALETTE.gray600, fontWeight: 600 }}>Exclusivo para lojistas</span>
              <UnlockButton className="cta-primary">
                Solicitar cotação
              </UnlockButton>
            </div>
          </div>
        </nav>
```
por:
```tsx
        {/* NAV */}
        <SiteNav />
```

Dentro da função `ProductDetail`, no bloco "CARD DE PREÇO / COTAÇÃO", substituir:
```tsx
                <UnlockButton className="unlock-btn">
                  <span>💬</span> Solicitar cotação deste produto
                </UnlockButton>
              </div>
```
por:
```tsx
                <UnlockButton className="unlock-btn">
                  <span>💬</span> Solicitar cotação deste produto
                </UnlockButton>
                <AddToCartControl
                  product={{ id: product.id, name: product.name, sku: product.sku, brand: product.brand, img: product.img }}
                />
              </div>
```

- [ ] **Step 3: `components/product-card.tsx` — adicionar `AddToCartControl`**

Adicionar o import:
```tsx
import { AddToCartControl } from "@/components/add-to-cart-control";
```

Substituir:
```tsx
      <div style={{ padding: "0 14px 16px" }}>
        <PriceLockSlot />
        <UnlockButton className="unlock-btn">
          <><span>💬</span> Solicitar cotação</>
        </UnlockButton>
      </div>
```
por:
```tsx
      <div style={{ padding: "0 14px 16px" }}>
        <PriceLockSlot />
        <UnlockButton className="unlock-btn">
          <><span>💬</span> Solicitar cotação</>
        </UnlockButton>
        <AddToCartControl
          product={{ id: product.id, name: product.name, sku: product.sku, brand: product.brand, img: product.img }}
        />
      </div>
```

- [ ] **Step 4: Rodar lint e build**

Run:
```bash
npm run lint
npm run build
```
Expected: sem erros. Confirmar no output do build que `/` e `/produtos/[id]` continuam gerando normalmente (mesmo formato de rotas já visto nesta branch).

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/produtos/[id]/page.tsx components/product-card.tsx
git commit -m "feat: integra SiteNav e AddToCartControl nas páginas existentes"
```

---

## Task 8: `app/cotacao/page.tsx` — revisão do carrinho e envio

**Files:**
- Create: `app/cotacao/page.tsx`

**Interfaces:**
- Consumes: `useCart` (Task 3); `buildQuoteMessage`, `buildWhatsAppLink` (Task 2); `SiteNav` (Task 5); `LeadGateProvider` (`@/components/lead-gate`); `PALETTE` (`@/lib/theme`); endpoint `POST /api/leads` (já existe).
- Produces: página `/cotacao`.

- [ ] **Step 1: Implementar `app/cotacao/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { PALETTE } from "@/lib/theme";
import { useCart } from "@/components/cart-provider";
import { LeadGateProvider } from "@/components/lead-gate";
import { SiteNav } from "@/components/site-nav";
import { buildQuoteMessage, buildWhatsAppLink } from "@/lib/whatsapp";

export default function CotacaoPage() {
  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { margin: 0; }

        .cta-primary {
          background: ${PALETTE.pink};
          color: ${PALETTE.white};
          border: none;
          border-radius: 100px;
          padding: 10px 22px;
          font-family: 'Nunito', sans-serif;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s;
        }
        .cta-primary:hover { background: ${PALETTE.pinkDark}; }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: ${PALETTE.gray600};
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          margin-bottom: 24px;
          transition: color 0.2s;
        }
        .back-link:hover { color: ${PALETTE.pink}; }

        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(15,31,69,0.6);
          display: flex; align-items: center; justify-content: center;
          z-index: 999;
          padding: 16px;
        }
        .modal {
          background: ${PALETTE.white};
          border-radius: 20px;
          padding: 40px 36px;
          width: 100%;
          max-width: 440px;
        }
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid ${PALETTE.gray200};
          border-radius: 10px;
          font-family: 'Nunito Sans', sans-serif;
          font-size: 15px;
          color: ${PALETTE.gray800};
          outline: none;
          transition: border-color 0.2s;
          margin-bottom: 12px;
        }
        .form-input:focus { border-color: ${PALETTE.pink}; }
        .form-submit {
          width: 100%;
          padding: 14px;
          background: ${PALETTE.pink};
          color: white;
          border: none;
          border-radius: 10px;
          font-family: 'Nunito', sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          margin-top: 4px;
          transition: background 0.2s;
        }
        .form-submit:hover { background: ${PALETTE.pinkDark}; }
        .form-submit:disabled { opacity: 0.6; cursor: default; }
      `}</style>

      <LeadGateProvider>
        <SiteNav />

        <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
          <Link href="/" className="back-link">
            ← Voltar ao catálogo
          </Link>

          <h1 style={{ fontSize: 28, fontWeight: 900, color: PALETTE.navy, marginBottom: 24 }}>
            Sua cotação
          </h1>

          <CotacaoContent />
        </main>
      </LeadGateProvider>
    </div>
  );
}

function CotacaoContent() {
  const { cart, removeItem, updateQty, clear } = useCart();
  const [form, setForm] = useState({ nome: "", empresa: "", whatsapp: "", cnpj: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: PALETTE.navy, marginBottom: 8 }}>
          Cotação enviada!
        </h2>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Abrimos o WhatsApp com os itens da sua cotação. Nossa equipe vai te responder por lá.
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
        <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>
          Sua cotação está vazia
        </h2>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Adicione produtos do catálogo para montar sua cotação.
        </p>
        <Link href="/" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Ver catálogo
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Erro ao salvar");

      const message = buildQuoteMessage(cart.items, form);
      const phoneNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
      window.open(buildWhatsAppLink(phoneNumber, message), "_blank");

      clear();
      setSubmitted(true);
    } catch {
      setSubmitError("Não foi possível enviar sua cotação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, marginBottom: 24, overflow: "hidden" }}>
        {cart.items.map((item, index) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: 16,
              borderBottom: index < cart.items.length - 1 ? `1px solid ${PALETTE.gray100}` : "none",
            }}
          >
            <img src={item.img} alt={item.name} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {item.brand && (
                <p style={{ fontSize: 10, color: PALETTE.pink, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                  {item.brand}
                </p>
              )}
              <p style={{ fontSize: 14, fontWeight: 700, color: PALETTE.navy, lineHeight: 1.3 }}>{item.name}</p>
              {item.sku && <p style={{ fontSize: 11, color: PALETTE.gray400 }}>SKU: {item.sku}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty - 1)}
                aria-label="Diminuir quantidade"
                style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
              >
                −
              </button>
              <span style={{ minWidth: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: PALETTE.navy }}>{item.qty}</span>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty + 1)}
                aria-label="Aumentar quantidade"
                style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label={`Remover ${item.name} da cotação`}
              style={{ border: "none", background: "transparent", color: PALETTE.gray400, cursor: "pointer", fontSize: 13, fontWeight: 700 }}
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: PALETTE.navy, marginBottom: 16 }}>
          Seus dados para a cotação
        </h2>
        <form onSubmit={handleSubmit}>
          <input className="form-input" placeholder="Seu nome" required value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
          <input className="form-input" placeholder="Nome do pet shop / empresa" required value={form.empresa} onChange={(e) => setForm((prev) => ({ ...prev, empresa: e.target.value }))} />
          <input className="form-input" placeholder="WhatsApp com DDD" required value={form.whatsapp} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))} />
          <input className="form-input" placeholder="CNPJ (opcional)" value={form.cnpj} onChange={(e) => setForm((prev) => ({ ...prev, cnpj: e.target.value }))} />
          {submitError && (
            <p style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{submitError}</p>
          )}
          <button type="submit" className="form-submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Finalizar cotação →"}
          </button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Rodar lint e build**

Run:
```bash
npm run lint
npm run build
```
Expected: sem erros. Confirmar no output do build que `/cotacao` aparece como rota nova (client component — deve aparecer marcada como estática/`○` ou `◐`, não deve dar erro de Cache Components porque não lê `params`/`searchParams`).

- [ ] **Step 3: Commit**

```bash
git add app/cotacao/page.tsx
git commit -m "feat: página de revisão e envio da cotação consolidada"
```

---

## Task 9: Variável de ambiente do WhatsApp e documentação

**Files:**
- Modify: `.env.local` (não versionado)
- Modify: `README.md`

**Interfaces:**
- Produces: `process.env.NEXT_PUBLIC_WHATSAPP_NUMBER`, consumido pela Task 8.

- [ ] **Step 1: Adicionar a variável em `.env.local`**

Adicionar, ao final do arquivo (sem alterar as linhas existentes de `GOOGLE_CREDENTIALS`, `GOOGLE_SHEET_ID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`):
```bash
NEXT_PUBLIC_WHATSAPP_NUMBER=5511999999999
```
Esse é um número de placeholder (formato DDI+DDD+número, só dígitos). Substituir pelo número comercial real da My Pet Brasil antes de publicar em produção.

- [ ] **Step 2: Documentar no `README.md`**

Localizar a seção "Configuração" (ou equivalente, onde `GOOGLE_CREDENTIALS`/`GOOGLE_SHEET_ID`/`SUPABASE_URL`/`SUPABASE_ANON_KEY` já são documentadas) e adicionar ao bloco de variáveis de ambiente:
```dotenv
NEXT_PUBLIC_WHATSAPP_NUMBER=5511999999999
```
Com uma linha explicando: "Número de WhatsApp (DDI+DDD+número, só dígitos) para onde o link da cotação consolidada é enviado. Variável pública (client-side) porque compõe o link `wa.me` no navegador."

- [ ] **Step 3: Rodar o build**

Run: `npm run build`
Expected: build conclui sem erros (a variável já estava sendo referenciada no código desde a Task 8; isso só documenta e garante o valor local).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: variável de ambiente do número de WhatsApp da cotação"
```

Nota: `.env.local` não é versionado (`.gitignore`), então não entra neste commit.

---

## Task 10: Verificação manual (via `/run`)

**Files:** nenhum (validação).

- [ ] **Step 1: Subir o app**

Run: `npm run dev` e abrir `http://localhost:3000`.

- [ ] **Step 2: Adicionar itens ao carrinho**

- No catálogo, ajustar o stepper de um produto para 2 e clicar em "Adicionar à cotação"; o botão deve mostrar "Adicionado ✓" por 1,5s.
- O ícone 🛒 do nav deve mostrar a contagem "2".
- Adicionar outro produto diferente com quantidade 1; a contagem do nav deve ir para "3".
- Adicionar novamente o primeiro produto (quantidade 1); a contagem deve ir para "4" (soma na mesma linha, não duplica).

- [ ] **Step 3: Conferir persistência entre páginas**

- Abrir a página de um produto (`/produtos/[id]`), confirmar que o nav mostra a mesma contagem do carrinho.
- Adicionar o produto da página de detalhe ao carrinho; a contagem deve aumentar.
- Recarregar a página (F5); a contagem deve se manter (persistida em `localStorage`).

- [ ] **Step 4: Conferir a página `/cotacao`**

- Clicar no ícone do carrinho; deve navegar para `/cotacao` listando todos os itens com imagem, nome, SKU, marca e quantidade.
- Ajustar a quantidade de um item pelo stepper da linha; a contagem do nav deve refletir a mudança.
- Remover um item; ele deve sumir da lista e da contagem do nav.
- Esvaziar o carrinho totalmente; a página deve mostrar o estado vazio ("Sua cotação está vazia") com link para o catálogo.

- [ ] **Step 5: Conferir o envio**

- Adicionar 2-3 produtos novamente, ir para `/cotacao`, preencher nome/empresa/whatsapp (CNPJ opcional) e clicar em "Finalizar cotação →".
- Confirmar que uma nova aba do WhatsApp Web/app abre com a mensagem contendo todos os itens, quantidades e os dados preenchidos.
- Confirmar que a página `/cotacao` mostra a confirmação "Cotação enviada!" e que o carrinho foi esvaziado (nav sem contagem).
- Verificar na planilha do Google Sheets que o lead foi gravado (mesma aba/colunas de sempre).

- [ ] **Step 6: Conferir que o fluxo de cotação rápida continua intacto**

- Clicar em "Solicitar cotação" no nav (não no carrinho) deve continuar abrindo o modal de 1 produto como hoje, sem relação com o carrinho.

- [ ] **Step 7: Registrar o resultado**

Se tudo passar, a entrega está concluída. Caso contrário, abrir a skill `superpowers:systematic-debugging` antes de corrigir.

---

## Self-Review (preenchido)

**Cobertura do spec:**
- Modelo de dados do carrinho (`lib/cart.ts`) → Task 1. ✅
- `CartProvider` no layout raiz, persistência em `localStorage` → Task 3, 5. ✅
- `SiteNav` compartilhado com `CartBadge` → Task 4, 5, 7. ✅
- `AddToCartControl` com stepper no card → Task 6, 7. ✅
- Página dedicada `/cotacao` (não painel lateral) → Task 8. ✅
- Fluxo de cotação rápida existente preservado → Global Constraints + Task 10 Step 6. ✅
- Envio: salva lead via `/api/leads` (endpoint inalterado) e abre WhatsApp → Task 8. ✅
- Formato da mensagem do WhatsApp → Task 2. ✅
- `NEXT_PUBLIC_WHATSAPP_NUMBER` como placeholder → Task 9. ✅
- Fonte mantém Nunito/Nunito Sans (nenhuma task adiciona Plus Jakarta Sans). ✅
- Melhoria pontual do `lang`/metadata em `app/layout.tsx` → Task 5. ✅
- Fora de escopo do spec (persistência server-side, itens na planilha, número real de produção, nova fonte, preço/estoque) → nenhuma task implementa. ✅

**Placeholders:** nenhum "TODO/TBD"; todos os steps de código têm código completo. O valor `5511999999999` em `.env.local`/README é intencionalmente um placeholder documentado como tal (decisão da spec), não um "TBD" esquecido.

**Consistência de tipos:** `CartItem`/`Cart` definidos na Task 1 e usados identicamente nas Tasks 2, 3, 4, 6, 7, 8. `useCart()` com a mesma assinatura entre Task 3 (definição) e Tasks 4, 6, 8 (consumo). `buildQuoteMessage`/`buildWhatsAppLink` com assinatura idêntica entre Task 2 e o uso na Task 8. `AddToCartControl({ product })` com o mesmo formato de `product` (`{ id, name, sku, brand, img }`) nas Tasks 6, 7.
