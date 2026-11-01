# AZ Pet Shop — Fase 2: Checkout e pedidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a loja `apps/azpetshop` venda de verdade: carrinho → dados do comprador → CEP e frete (Melhor Envio) → pagamento no checkout hospedado do Asaas (Pix e cartão) → pedido confirmado por webhook, com avisos por e-mail e operação no admin — mantendo a finalização pelo WhatsApp como opção por site.

**Architecture:** Lógica pura e clientes HTTP ficam em `packages/core` (validação, pacote de envio, Melhor Envio, Asaas, transições de status, orquestração do checkout e do webhook), todos com dependências injetadas para teste. O app `apps/azpetshop` só liga as peças: páginas `/checkout` e `/pedido/[id]`, server actions, rota de webhook e e-mails (nodemailer). Pedidos usam as tabelas `orders`/`order_items` existentes, mais `order_shipping`, `order_payments` e `payment_webhook_events`. A forma de finalizar vira a feature `checkout` (`whatsapp` | `online` | `ambos`) por site.

**Tech Stack:** Next.js 16.3 (App Router, server actions, route handlers), React 19, TypeScript, Supabase (`hub_catalogo`, Postgres 17), vitest + Testing Library, nodemailer, APIs Asaas v3 e Melhor Envio v2, ViaCEP.

**Spec:** `docs/superpowers/specs/2026-11-01-azpetshop-google-shopping-design.md` (seção "Fase 2" e "Pendências em aberto").

## Global Constraints

- `AGENTS.md`: esta versão do Next.js tem breaking changes; consultar `node_modules/next/dist/docs/` antes de usar API de rota, server action, `cookies`/`headers`, `redirect` ou cache que não esteja já em uso no app.
- Trabalhar direto na `main`, sem worktree (preferência do usuário). Não fazer push sem o usuário pedir.
- **Checkout é escolha por site:** feature `checkout` = `whatsapp` | `online` | `ambos`. azpetshop = `ambos`; todos os outros sites = `whatsapp` (comportamento atual, sem nenhuma mudança visível). A cotação pelo WhatsApp (`/cotacao`) nunca é removida.
- **Preço e frete nunca vêm do navegador.** O servidor relê `product_channel_prices` (canal `azpetshop`) e recota o frete antes de criar a cobrança.
- Preço vendável = `hasSellablePrice` e estoque = `inStockFromQty` de `@mypet/core/retail` (mesma regra da fase 1). Item sem preço vendável ou sem estoque bloqueia o checkout.
- **Compra como convidado:** sem contas de cliente.
- Dados de cartão nunca passam pelo nosso servidor (checkout hospedado do Asaas).
- Webhook do Asaas: autenticado pelo header `asaas-access-token` e idempotente pelo `id` do evento (entrega "at least once").
- Status do varejo: `aguardando_pagamento → pago → enviado → entregue`, ou `cancelado` / `expirado`. Status existentes (`pendente`, `confirmado`, `entregue`, `cancelado`) continuam valendo para os outros canais.
- Estoque baixa **só** quando o pedido vira `pago`.
- Pacote de envio é **provisório** nesta fase (constantes); a fase 4 troca por medidas reais.
- Avisos: e-mail para a equipe e para o cliente. **Aviso por WhatsApp para a equipe fica fora** (não há API de WhatsApp no projeto); registrado como pendência.
- Credenciais só em env vars do servidor; sandbox em dev/preview, produção só no deploy de produção.
- A trava `DADOS_DE_EXEMPLO` da fase 1 continua; esta fase não a remove.
- Copy em português com acentuação correta; nada de promessa que o fluxo não cumpra.
- Testes: `pnpm --filter @mypet/core test`, `pnpm --filter azpetshop test`, `pnpm --filter admin test`; build: `pnpm --filter azpetshop build`, `pnpm --filter admin build`.
- Commits terminam com uma linha em branco e `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Pré-requisitos externos (usuário)

Não bloqueiam as Tasks 1–9 (testes usam `fetch` falso). Bloqueiam o teste ponta a ponta da Task 13:
1. Conta **sandbox do Asaas** (api-sandbox.asaas.com): chave de API e token de webhook configurado apontando para a URL de preview `/api/webhooks/asaas`, com os eventos `CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED`.
2. Conta **sandbox do Melhor Envio** (sandbox.melhorenvio.com.br): token com escopo `shipping-calculate`.
3. **SMTP** para envio de e-mails (mesmo provedor do app zemann serve) e e-mail da equipe que recebe os pedidos.
4. **Aplicar a migration** da Task 3 no `hub_catalogo` (o executor prepara e pede confirmação antes de aplicar).

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `packages/core/src/features.ts` (mod) | Feature `checkout` + `checkoutOptions()` |
| `packages/core/src/br-validation.ts` (mod) | `isValidCpf`, `formatCpf`, `formatCep` |
| `packages/core/src/retail-checkout.ts` (novo) | Tipos e validação da entrada do checkout |
| `packages/core/src/shipping-package.ts` (novo) | Pacote de envio provisório |
| `packages/core/src/melhor-envio.ts` (novo) | Cotação de frete |
| `packages/core/src/asaas.ts` (novo) | Criação do checkout hospedado + verificação do webhook |
| `packages/core/src/retail-order-status.ts` (novo) | Transições de status por evento |
| `packages/core/src/retail-checkout-server.ts` (novo) | Precificação no servidor, cotação, criação do pedido e cobrança |
| `packages/core/src/retail-webhook-server.ts` (novo) | Processamento idempotente do webhook |
| `packages/core/src/retail-orders-server.ts` (novo) | Leitura do pedido pelo token (página do pedido) |
| `packages/core/src/test-utils/fake-supabase.ts` (mod) | Suporte a `in`, `neq`, `delete`, `single`, `rpc` |
| `supabase/migrations/20261101120000_retail_checkout.sql` (novo) | Colunas e tabelas do varejo |
| `apps/azpetshop/lib/pedido-emails.ts` (novo) | E-mails de pedido (equipe e cliente) |
| `apps/azpetshop/lib/checkout-env.ts` (novo) | Leitura das env vars do checkout |
| `apps/azpetshop/app/checkout/*` (novo) | Página e server actions do checkout |
| `apps/azpetshop/app/pedido/[id]/page.tsx` (novo) | Página do pedido |
| `apps/azpetshop/app/api/webhooks/asaas/route.ts` (novo) | Rota do webhook |
| `apps/azpetshop/app/cotacao/cotacao-content.tsx` (mod) | Botões conforme a feature `checkout` |
| `apps/admin/lib/orders.ts`, `apps/admin/app/(dashboard)/pedidos/*` (mod) | Varejo no admin: status, canal, entrega, pagamento, rastreio |

---

### Task 1: Feature `checkout` por site

**Files:**
- Modify: `packages/core/src/features.ts`
- Test: `packages/core/src/features.test.ts`
- Modify: `packages/core/src/test-utils/client-config.ts` (nada se não quebrar; ver Step 4)

**Interfaces:**
- Produces:
  - `type CheckoutMode = "whatsapp" | "online" | "ambos"`
  - `Features.checkout?: CheckoutMode` (ausente = `"whatsapp"`)
  - `checkoutOptions(features: Features): { online: boolean; whatsapp: boolean }`
  - `SITES.azpetshop.features.checkout === "ambos"`; demais sites `"whatsapp"`

- [ ] **Step 1: Write the failing test** — acrescente ao fim de `packages/core/src/features.test.ts` (adicione `checkoutOptions` ao import existente de `./features`):

```ts
describe("checkoutOptions", () => {
  it("whatsapp (ou ausente) só oferece o WhatsApp", () => {
    expect(checkoutOptions({ commerce: "cart" })).toEqual({ online: false, whatsapp: true });
    expect(checkoutOptions({ commerce: "cart", checkout: "whatsapp" })).toEqual({ online: false, whatsapp: true });
  });

  it("online só oferece o pagamento", () => {
    expect(checkoutOptions({ commerce: "cart", checkout: "online" })).toEqual({ online: true, whatsapp: false });
  });

  it("ambos oferece os dois", () => {
    expect(checkoutOptions({ commerce: "cart", checkout: "ambos" })).toEqual({ online: true, whatsapp: true });
  });

  it("azpetshop usa ambos e os demais sites seguem no WhatsApp", () => {
    expect(SITES.azpetshop.features.checkout).toBe("ambos");
    for (const id of ["mypet", "distribuidora", "madpet", "distribuidoraInstagram"] as const) {
      expect(SITES[id].features.checkout).toBe("whatsapp");
    }
  });

  it("registra a feature checkout com as três opções", () => {
    const def = FEATURE_REGISTRY.find((f) => f.id === "checkout");
    expect(def?.options.map((o) => o.value)).toEqual(["whatsapp", "online", "ambos"]);
  });
});
```

Se `SITES` ou `FEATURE_REGISTRY` ainda não estiverem importados no teste, inclua-os no import.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/features.test.ts`
Expected: FAIL — `checkoutOptions is not a function` (ou erro de import).

- [ ] **Step 3: Implementar** — em `packages/core/src/features.ts`:

```ts
export type CommerceMode = "quote" | "cart";

/** Como o carrinho é finalizado: cotação no WhatsApp, pagamento online, ou os dois. */
export type CheckoutMode = "whatsapp" | "online" | "ambos";

export type Features = {
  commerce: CommerceMode;
  /** Ausente = "whatsapp" (comportamento anterior a esta feature). */
  checkout?: CheckoutMode;
};
```

Logo após `showsListPrice`:

```ts
export function checkoutOptions(features: Features): { online: boolean; whatsapp: boolean } {
  const mode = features.checkout ?? "whatsapp";
  return { online: mode !== "whatsapp", whatsapp: mode !== "online" };
}
```

Em `FEATURE_REGISTRY`, acrescente após o item `commerce`:

```ts
  {
    id: "checkout",
    label: "Finalização do pedido",
    description: "Como o cliente fecha o carrinho: cotação no WhatsApp, pagamento online, ou os dois.",
    options: [
      { value: "whatsapp", label: "WhatsApp (cotação)" },
      { value: "online", label: "Pagamento online (Asaas)" },
      { value: "ambos", label: "Os dois" },
    ],
  },
```

Em `SITES`, adicione `checkout: "whatsapp"` às features de `mypet`, `distribuidora`, `madpet`, `distribuidoraInstagram`, e `checkout: "ambos"` a `azpetshop`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @mypet/core test && pnpm --filter admin test`
Expected: PASS. (A página `admin/funcionalidades` lê `SITES[siteId].features[feature.id]` e passa a mostrar a nova linha; se algum teste do admin fixa o número de linhas, atualize só esse número.)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features.ts packages/core/src/features.test.ts
git commit -m "feat(core): feature checkout por site (whatsapp, online, ambos)"
```

---

### Task 2: Validação da entrada do checkout (CPF, endereço, itens)

**Files:**
- Modify: `packages/core/src/br-validation.ts`
- Test: `packages/core/src/br-validation.test.ts`
- Create: `packages/core/src/retail-checkout.ts`
- Create: `packages/core/src/retail-checkout.test.ts`
- Modify: `packages/core/package.json` (exports)

**Interfaces:**
- Consumes: `onlyDigits`, `normalizeWhatsapp` (`br-validation.ts`; `normalizeWhatsapp` devolve `55`+DDD+número ou `null`).
- Produces:
  - `isValidCpf(cpf: string): boolean` (11 dígitos), `formatCpf(value: string): string` → `"123.456.789-09"`, `formatCep(value: string): string` → `"01001-000"`
  - `type CheckoutLine = { id: string; qty: number }`
  - `type CheckoutCustomer = { nome: string; cpf: string; email: string; whatsapp: string }` (cpf só dígitos; whatsapp normalizado `55…`)
  - `type CheckoutAddress = { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string }` (cep só dígitos; uf maiúscula)
  - `type CheckoutInput = { items: CheckoutLine[]; customer: CheckoutCustomer; address: CheckoutAddress; shippingServiceId: number }`
  - `type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }`
  - `parseCheckoutLines(raw: unknown): ParseResult<CheckoutLine[]>` (soma quantidades de ids repetidos)
  - `parseCep(raw: unknown): ParseResult<string>`
  - `parseCheckoutInput(body: unknown): ParseResult<CheckoutInput>`
  - export `@mypet/core/retail-checkout`

- [ ] **Step 1: Testes de CPF** — acrescente a `packages/core/src/br-validation.test.ts` (inclua `isValidCpf, formatCpf, formatCep` no import):

```ts
describe("isValidCpf", () => {
  it("aceita CPF válido só com dígitos", () => {
    expect(isValidCpf("52998224725")).toBe(true);
  });
  it("rejeita dígito verificador errado, repetidos e tamanho errado", () => {
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("529.982.247-25")).toBe(false);
  });
});

describe("formatCpf / formatCep", () => {
  it("formata", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCep("01001000")).toBe("01001-000");
  });
});
```

- [ ] **Step 2: Testes do parse** — `packages/core/src/retail-checkout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCep, parseCheckoutInput, parseCheckoutLines } from "./retail-checkout";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

const valid = {
  items: [{ id: ID_A, qty: 2 }],
  customer: { nome: "Maria Souza", cpf: "529.982.247-25", email: "maria@exemplo.com", whatsapp: "(11) 98888-7777" },
  address: { cep: "01001-000", logradouro: "Praça da Sé", numero: "100", complemento: "", bairro: "Sé", cidade: "São Paulo", uf: "sp" },
  shippingServiceId: 1,
};

describe("parseCheckoutLines", () => {
  it("soma quantidades do mesmo produto", () => {
    expect(parseCheckoutLines([{ id: ID_A, qty: 1 }, { id: ID_B, qty: 1 }, { id: ID_A, qty: 2 }])).toEqual({
      ok: true,
      value: [{ id: ID_A, qty: 3 }, { id: ID_B, qty: 1 }],
    });
  });
  it("rejeita vazio, id inválido e quantidade inválida", () => {
    expect(parseCheckoutLines([]).ok).toBe(false);
    expect(parseCheckoutLines([{ id: "x", qty: 1 }]).ok).toBe(false);
    expect(parseCheckoutLines([{ id: ID_A, qty: 0 }]).ok).toBe(false);
    expect(parseCheckoutLines([{ id: ID_A, qty: 1.5 }]).ok).toBe(false);
    expect(parseCheckoutLines("nada").ok).toBe(false);
  });
});

describe("parseCep", () => {
  it("aceita com ou sem traço e devolve só dígitos", () => {
    expect(parseCep("01001-000")).toEqual({ ok: true, value: "01001000" });
  });
  it("rejeita CEP incompleto", () => {
    expect(parseCep("0100").ok).toBe(false);
  });
});

describe("parseCheckoutInput", () => {
  it("normaliza CPF, WhatsApp, CEP e UF", () => {
    const r = parseCheckoutInput(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.customer).toEqual({ nome: "Maria Souza", cpf: "52998224725", email: "maria@exemplo.com", whatsapp: "5511988887777" });
    expect(r.value.address.cep).toBe("01001000");
    expect(r.value.address.uf).toBe("SP");
    expect(r.value.shippingServiceId).toBe(1);
  });

  it.each([
    ["CPF inválido", { customer: { ...valid.customer, cpf: "111.111.111-11" } }, "CPF"],
    ["e-mail inválido", { customer: { ...valid.customer, email: "maria" } }, "e-mail"],
    ["WhatsApp inválido", { customer: { ...valid.customer, whatsapp: "123" } }, "WhatsApp"],
    ["nome curto", { customer: { ...valid.customer, nome: "M" } }, "nome"],
    ["número ausente", { address: { ...valid.address, numero: "" } }, "endereço"],
    ["UF inválida", { address: { ...valid.address, uf: "XX1" } }, "endereço"],
    ["frete não escolhido", { shippingServiceId: undefined }, "frete"],
  ])("rejeita %s", (_label, patch, palavra) => {
    const r = parseCheckoutInput({ ...valid, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain(palavra.toLowerCase());
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @mypet/core exec vitest run src/br-validation.test.ts src/retail-checkout.test.ts`
Expected: FAIL — `isValidCpf` não exportado e `./retail-checkout` não resolve.

- [ ] **Step 4: Implementar CPF** — em `packages/core/src/br-validation.ts`, após `isValidCnpj`:

```ts
export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split("")
      .reduce((total, char, index) => total + Number(char) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export function formatCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}
```

- [ ] **Step 5: Implementar o parse** — `packages/core/src/retail-checkout.ts`:

```ts
import { isValidCpf, normalizeWhatsapp, onlyDigits } from "./br-validation";

export type CheckoutLine = { id: string; qty: number };
export type CheckoutCustomer = { nome: string; cpf: string; email: string; whatsapp: string };
export type CheckoutAddress = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};
export type CheckoutInput = {
  items: CheckoutLine[];
  customer: CheckoutCustomer;
  address: CheckoutAddress;
  shippingServiceId: number;
};
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_LINES = 100;
const MAX_QTY = 999;
const MAX_TEXT = 120;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCheckoutLines(raw: unknown): ParseResult<CheckoutLine[]> {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "O carrinho está vazio." };
  if (raw.length > MAX_LINES) return { ok: false, error: "O carrinho tem itens demais." };
  const qtyById = new Map<string, number>();
  for (const line of raw) {
    const id = text((line as { id?: unknown })?.id);
    const qty = (line as { qty?: unknown })?.qty;
    if (!UUID_RE.test(id) || typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return { ok: false, error: "Algum item do carrinho é inválido." };
    }
    qtyById.set(id, (qtyById.get(id) ?? 0) + qty);
  }
  return { ok: true, value: [...qtyById].map(([id, qty]) => ({ id, qty })) };
}

export function parseCep(raw: unknown): ParseResult<string> {
  const cep = onlyDigits(text(raw));
  return /^\d{8}$/.test(cep) ? { ok: true, value: cep } : { ok: false, error: "Informe um CEP válido." };
}

export function parseCheckoutInput(body: unknown): ParseResult<CheckoutInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Pedido inválido." };
  const b = body as Record<string, unknown>;
  const c = (b.customer ?? {}) as Record<string, unknown>;
  const a = (b.address ?? {}) as Record<string, unknown>;

  const items = parseCheckoutLines(b.items);
  if (!items.ok) return items;

  const nome = text(c.nome);
  if (nome.length < 2 || nome.length > MAX_TEXT) return { ok: false, error: "Informe seu nome completo." };
  const cpf = onlyDigits(text(c.cpf));
  if (!isValidCpf(cpf)) return { ok: false, error: "Informe um CPF válido." };
  const email = text(c.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > MAX_TEXT) return { ok: false, error: "Informe um e-mail válido." };
  const whatsapp = normalizeWhatsapp(text(c.whatsapp));
  if (!whatsapp) return { ok: false, error: "Informe um WhatsApp válido com DDD." };

  const cep = parseCep(a.cep);
  if (!cep.ok) return cep;
  const address = {
    cep: cep.value,
    logradouro: text(a.logradouro),
    numero: text(a.numero),
    complemento: text(a.complemento),
    bairro: text(a.bairro),
    cidade: text(a.cidade),
    uf: text(a.uf).toUpperCase(),
  };
  const required = [address.logradouro, address.numero, address.bairro, address.cidade];
  if (required.some((v) => !v || v.length > MAX_TEXT) || address.complemento.length > MAX_TEXT || !/^[A-Z]{2}$/.test(address.uf)) {
    return { ok: false, error: "Confira o endereço de entrega." };
  }

  const shippingServiceId = b.shippingServiceId;
  if (typeof shippingServiceId !== "number" || !Number.isInteger(shippingServiceId) || shippingServiceId < 1) {
    return { ok: false, error: "Escolha uma opção de frete." };
  }

  return { ok: true, value: { items: items.value, customer: { nome, cpf, email, whatsapp }, address, shippingServiceId } };
}
```

Em `packages/core/package.json` → `exports`, após `"./retail"`: `"./retail-checkout": "./src/retail-checkout.ts",`.

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @mypet/core exec vitest run src/br-validation.test.ts src/retail-checkout.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/br-validation.ts packages/core/src/br-validation.test.ts packages/core/src/retail-checkout.ts packages/core/src/retail-checkout.test.ts packages/core/package.json
git commit -m "feat(core): validação de CPF e da entrada do checkout de varejo"
```

---

### Task 3: Migration do checkout de varejo

**Files:**
- Create: `supabase/migrations/20261101120000_retail_checkout.sql`

**Interfaces:**
- Produces (banco `hub_catalogo`):
  - `orders`: canal `azpetshop` permitido; status `aguardando_pagamento`, `pago`, `enviado`, `expirado` permitidos; colunas `customer_cpf text`, `customer_email text`, `subtotal numeric(12,2)`, `shipping_price numeric(12,2)`, `total numeric(12,2)`, `access_token text` (único quando não nulo)
  - `order_shipping(order_id pk → orders, cep, logradouro, numero, complemento, bairro, cidade, uf, service_id int, service_name, price numeric, delivery_days int, tracking_code, shipped_at, created_at)`
  - `order_payments(id pk, order_id unique → orders, provider, asaas_checkout_id unique, checkout_url, amount numeric, status, last_event_id, last_event_payload jsonb, created_at, updated_at)`
  - `payment_webhook_events(id text pk, event text, received_at, payload jsonb)`
  - função `decrement_order_stock(p_order_id uuid) returns void` (só service role)

- [ ] **Step 1: Escrever a migration** — `supabase/migrations/20261101120000_retail_checkout.sql`:

```sql
-- Checkout de varejo (azpetshop): pedido pago online, com entrega e pagamento.

alter table public.orders drop constraint orders_channel_check;
alter table public.orders add constraint orders_channel_check
  check (channel in ('mypetbrasil', 'distribuidora', 'azpetshop'));

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pendente', 'confirmado', 'entregue', 'cancelado',
                    'aguardando_pagamento', 'pago', 'enviado', 'expirado'));

alter table public.orders
  add column customer_cpf text,
  add column customer_email text,
  add column subtotal numeric(12,2),
  add column shipping_price numeric(12,2),
  add column total numeric(12,2),
  add column access_token text;

create unique index orders_access_token_key on public.orders (access_token) where access_token is not null;

create table public.order_shipping (
  order_id uuid primary key references public.orders (id) on delete cascade,
  cep text not null,
  logradouro text not null,
  numero text not null,
  complemento text,
  bairro text not null,
  cidade text not null,
  uf text not null,
  service_id integer not null,
  service_name text not null,
  price numeric(12,2) not null,
  delivery_days integer,
  tracking_code text,
  shipped_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  provider text not null default 'asaas',
  asaas_checkout_id text unique,
  checkout_url text,
  amount numeric(12,2) not null,
  status text not null default 'ACTIVE',
  last_event_id text,
  last_event_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotência do webhook: cada evento do Asaas é gravado uma única vez.
create table public.payment_webhook_events (
  id text primary key,
  event text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.order_shipping enable row level security;
alter table public.order_payments enable row level security;
alter table public.payment_webhook_events enable row level security;

create policy order_shipping_admin_all on public.order_shipping
  for all using (exists (select 1 from public.admin_users where admin_users.id = auth.uid()));
create policy order_payments_admin_all on public.order_payments
  for all using (exists (select 1 from public.admin_users where admin_users.id = auth.uid()));
-- payment_webhook_events: sem política (só service role).

-- Baixa o estoque dos itens de um pedido pago (chamada só pelo servidor).
create function public.decrement_order_stock(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products p
     set stock_qty = greatest(coalesce(p.stock_qty, 0) - oi.qty, 0)
    from public.order_items oi
   where oi.order_id = p_order_id
     and oi.product_id = p.id;
$$;

revoke all on function public.decrement_order_stock(uuid) from public, anon, authenticated;
```

- [ ] **Step 2: Conferir antes de aplicar** — rode no `hub_catalogo` (MCP Supabase `execute_sql`, só leitura) e confirme que os nomes de constraint batem:

```sql
select conname from pg_constraint
 where conrelid = 'public.orders'::regclass and conname in ('orders_channel_check', 'orders_status_check');
```

Expected: 2 linhas.

- [ ] **Step 3: Aplicar** — **peça confirmação ao usuário** antes; com o ok, aplique via MCP Supabase `apply_migration` (name `retail_checkout`, conteúdo do arquivo). Sem ok, pare aqui, faça o commit e registre "migration NÃO aplicada" no relatório.

- [ ] **Step 4: Verificar**

```sql
select table_name from information_schema.tables
 where table_schema = 'public' and table_name in ('order_shipping', 'order_payments', 'payment_webhook_events');
select proname from pg_proc where proname = 'decrement_order_stock';
```

Expected: 3 tabelas e 1 função.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261101120000_retail_checkout.sql
git commit -m "feat(db): tabelas de entrega, pagamento e eventos do checkout de varejo"
```

---

### Task 4: Pacote provisório e cotação no Melhor Envio

**Files:**
- Create: `packages/core/src/shipping-package.ts`, `packages/core/src/shipping-package.test.ts`
- Create: `packages/core/src/melhor-envio.ts`, `packages/core/src/melhor-envio.test.ts`
- Modify: `packages/core/package.json` (exports)

**Interfaces:**
- Produces:
  - `type ShippingPackage = { widthCm: number; heightCm: number; lengthCm: number; weightKg: number }`
  - `shippingPackageFor(lines: { qty: number }[]): ShippingPackage`
  - `type MelhorEnvioConfig = { baseUrl: string; token: string; userAgent: string; fromCep: string }`
  - `type ShippingOption = { serviceId: number; name: string; company: string; price: number; deliveryDays: number | null }`
  - `quoteShipping(cfg: MelhorEnvioConfig, input: { toCep: string; pkg: ShippingPackage; insuranceValue: number }, fetchFn?: typeof fetch): Promise<{ ok: true; options: ShippingOption[] } | { ok: false; error: string }>`
  - exports `@mypet/core/shipping-package`, `@mypet/core/melhor-envio`

- [ ] **Step 1: Testes** — `packages/core/src/shipping-package.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shippingPackageFor } from "./shipping-package";

describe("shippingPackageFor (pacote provisório)", () => {
  it("usa a caixa padrão e 0,5 kg por unidade", () => {
    expect(shippingPackageFor([{ qty: 2 }, { qty: 1 }])).toEqual({ widthCm: 20, heightCm: 15, lengthCm: 30, weightKg: 1.5 });
  });
  it("respeita o peso mínimo e o máximo", () => {
    expect(shippingPackageFor([]).weightKg).toBe(0.3);
    expect(shippingPackageFor([{ qty: 500 }]).weightKg).toBe(30);
  });
});
```

`packages/core/src/melhor-envio.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { quoteShipping } from "./melhor-envio";

const cfg = { baseUrl: "https://sandbox.melhorenvio.com.br", token: "tk", userAgent: "AZ Pet Shop (contato@x.com)", fromCep: "01001000" };
const pkg = { widthCm: 20, heightCm: 15, lengthCm: 30, weightKg: 1 };

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("quoteShipping", () => {
  it("chama a API com token, origem, destino e pacote, e devolve só opções sem erro, mais baratas primeiro", async () => {
    const fetchFn = fakeFetch(200, [
      { id: 2, name: "SEDEX", price: "32.10", custom_price: "30.00", delivery_time: 2, custom_delivery_time: 3, company: { name: "Correios" } },
      { id: 1, name: "PAC", price: "20.00", custom_price: "18.50", delivery_time: 6, custom_delivery_time: 7, company: { name: "Correios" } },
      { id: 3, name: "Jadlog", error: "Serviço indisponível", company: { name: "Jadlog" } },
    ]);
    const r = await quoteShipping(cfg, { toCep: "20040002", pkg, insuranceValue: 99.9 }, fetchFn);
    expect(r).toEqual({
      ok: true,
      options: [
        { serviceId: 1, name: "PAC", company: "Correios", price: 18.5, deliveryDays: 7 },
        { serviceId: 2, name: "SEDEX", company: "Correios", price: 30, deliveryDays: 3 },
      ],
    });
    const [url, init] = (fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tk");
    expect(JSON.parse(init.body as string)).toEqual({
      from: { postal_code: "01001000" },
      to: { postal_code: "20040002" },
      package: { width: 20, height: 15, length: 30, weight: 1 },
      options: { insurance_value: 99.9, receipt: false, own_hand: false },
    });
  });

  it("erro HTTP vira erro amigável", async () => {
    const r = await quoteShipping(cfg, { toCep: "20040002", pkg, insuranceValue: 10 }, fakeFetch(500, { message: "x" }));
    expect(r).toEqual({ ok: false, error: "Não conseguimos calcular o frete agora. Tente novamente." });
  });

  it("nenhuma opção disponível vira erro", async () => {
    const r = await quoteShipping(cfg, { toCep: "20040002", pkg, insuranceValue: 10 }, fakeFetch(200, [{ id: 1, error: "x", company: { name: "C" } }]));
    expect(r).toEqual({ ok: false, error: "Não há opção de entrega para este CEP." });
  });

  it("falha de rede vira erro amigável", async () => {
    const fetchFn = vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const r = await quoteShipping(cfg, { toCep: "20040002", pkg, insuranceValue: 10 }, fetchFn);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mypet/core exec vitest run src/shipping-package.test.ts src/melhor-envio.test.ts`
Expected: FAIL — imports não resolvem.

- [ ] **Step 3: Implementar** — `packages/core/src/shipping-package.ts`:

```ts
export type ShippingPackage = { widthCm: number; heightCm: number; lengthCm: number; weightKg: number };

// Pacote PROVISÓRIO (fase 2): caixa única e peso estimado por unidade.
// A fase 4 troca por medidas do produto / padrão da categoria.
const CAIXA = { widthCm: 20, heightCm: 15, lengthCm: 30 };
const PESO_POR_UNIDADE_KG = 0.5;
const PESO_MINIMO_KG = 0.3;
const PESO_MAXIMO_KG = 30;

export function shippingPackageFor(lines: { qty: number }[]): ShippingPackage {
  const units = lines.reduce((total, line) => total + line.qty, 0);
  const weight = Math.min(PESO_MAXIMO_KG, Math.max(PESO_MINIMO_KG, units * PESO_POR_UNIDADE_KG));
  return { ...CAIXA, weightKg: Math.round(weight * 100) / 100 };
}
```

`packages/core/src/melhor-envio.ts`:

```ts
import type { ShippingPackage } from "./shipping-package";

export type MelhorEnvioConfig = { baseUrl: string; token: string; userAgent: string; fromCep: string };
export type ShippingOption = { serviceId: number; name: string; company: string; price: number; deliveryDays: number | null };

type RawOption = {
  id: number;
  name?: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  company?: { name?: string };
  error?: string;
};

const ERRO_COTACAO = "Não conseguimos calcular o frete agora. Tente novamente.";

export async function quoteShipping(
  cfg: MelhorEnvioConfig,
  input: { toCep: string; pkg: ShippingPackage; insuranceValue: number },
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: true; options: ShippingOption[] } | { ok: false; error: string }> {
  let raw: RawOption[];
  try {
    const res = await fetchFn(`${cfg.baseUrl}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
        "User-Agent": cfg.userAgent,
      },
      body: JSON.stringify({
        from: { postal_code: cfg.fromCep },
        to: { postal_code: input.toCep },
        package: { width: input.pkg.widthCm, height: input.pkg.heightCm, length: input.pkg.lengthCm, weight: input.pkg.weightKg },
        options: { insurance_value: input.insuranceValue, receipt: false, own_hand: false },
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[melhor-envio] HTTP", res.status);
      return { ok: false, error: ERRO_COTACAO };
    }
    raw = (await res.json()) as RawOption[];
  } catch (err) {
    console.error("[melhor-envio] falha:", (err as Error).message);
    return { ok: false, error: ERRO_COTACAO };
  }

  const options = (Array.isArray(raw) ? raw : [])
    .filter((o) => !o.error && (o.custom_price ?? o.price) != null)
    .map((o) => ({
      serviceId: o.id,
      name: o.name ?? "Entrega",
      company: o.company?.name ?? "",
      price: Number(o.custom_price ?? o.price),
      deliveryDays: o.custom_delivery_time ?? o.delivery_time ?? null,
    }))
    .filter((o) => Number.isFinite(o.price) && o.price >= 0)
    .sort((a, b) => a.price - b.price);

  if (options.length === 0) return { ok: false, error: "Não há opção de entrega para este CEP." };
  return { ok: true, options };
}
```

Em `packages/core/package.json` → `exports`: `"./shipping-package": "./src/shipping-package.ts",` e `"./melhor-envio": "./src/melhor-envio.ts",`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @mypet/core exec vitest run src/shipping-package.test.ts src/melhor-envio.test.ts`
Expected: PASS. Se o teste de falha de rede imprimir `console.error`, silencie com `vi.spyOn(console, "error").mockImplementation(() => {})` dentro do teste (saída deve ficar limpa).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shipping-package.ts packages/core/src/shipping-package.test.ts packages/core/src/melhor-envio.ts packages/core/src/melhor-envio.test.ts packages/core/package.json
git commit -m "feat(core): pacote provisório e cotação de frete no Melhor Envio"
```

---

### Task 5: Cliente do Asaas (checkout hospedado e webhook)

Referência conferida em 2026-11-01: `POST /v3/checkouts` (header `access_token`); campos obrigatórios `billingTypes`, `chargeTypes`, `callback` (`successUrl`, `cancelUrl`, `expiredUrl`), `items` (`name` ≤ 30, `quantity`, `value`, `imageBase64` exigido pelo schema); `minutesToExpire` 10–1440; `installment.maxInstallmentCount` 1–21 (obrigatório com `INSTALLMENT`); `customerData` (`name`, `cpfCnpj`, `email`, `phone`, …). Resposta: `id`, `link`, `status` (`ACTIVE`/`CANCELED`/`EXPIRED`/`PAID`). Webhook: `{ id, event, dateCreated, checkout: { id, status, … } }`, eventos `CHECKOUT_PAID`/`CHECKOUT_CANCELED`/`CHECKOUT_EXPIRED`; token no header `asaas-access-token`. Sandbox `https://api-sandbox.asaas.com`, produção `https://api.asaas.com`.

**Files:**
- Create: `packages/core/src/asaas.ts`, `packages/core/src/asaas.test.ts`
- Modify: `packages/core/package.json` (exports)

**Interfaces:**
- Produces:
  - `type AsaasConfig = { baseUrl: string; apiKey: string; webhookToken: string }`
  - `type CreateCheckoutInput = { orderNumber: number; total: number; maxInstallments: number; customer: { nome: string; cpf: string; email: string; whatsapp: string }; successUrl: string; cancelUrl: string; expiredUrl: string; minutesToExpire: number }`
  - `createAsaasCheckout(cfg, input, fetchFn?): Promise<{ ok: true; checkoutId: string; link: string } | { ok: false; error: string }>`
  - `isValidWebhookToken(cfg: AsaasConfig, header: string | null): boolean` (comparação em tempo constante)
  - `type AsaasCheckoutEvent = { id: string; event: string; checkoutId: string }`
  - `parseAsaasCheckoutEvent(body: unknown): AsaasCheckoutEvent | null`
  - export `@mypet/core/asaas`

- [ ] **Step 1: Testes** — `packages/core/src/asaas.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createAsaasCheckout, isValidWebhookToken, parseAsaasCheckoutEvent } from "./asaas";

const cfg = { baseUrl: "https://api-sandbox.asaas.com", apiKey: "key", webhookToken: "segredo-do-webhook" };
const input = {
  orderNumber: 1042,
  total: 129.9,
  maxInstallments: 4,
  customer: { nome: "Maria Souza", cpf: "52998224725", email: "maria@exemplo.com", whatsapp: "5511988887777" },
  successUrl: "https://www.azpetshop.com.br/pedido/o1?t=tok",
  cancelUrl: "https://www.azpetshop.com.br/checkout",
  expiredUrl: "https://www.azpetshop.com.br/pedido/o1?t=tok",
  minutesToExpire: 60,
};

describe("createAsaasCheckout", () => {
  it("envia Pix e cartão, item único com o total, parcelamento e dados do cliente", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ id: "chk_1", link: "https://asaas.com/c/chk_1", status: "ACTIVE" }), { status: 200 })) as unknown as typeof fetch;
    const r = await createAsaasCheckout(cfg, input, fetchFn);
    expect(r).toEqual({ ok: true, checkoutId: "chk_1", link: "https://asaas.com/c/chk_1" });

    const [url, init] = (fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/checkouts");
    expect((init.headers as Record<string, string>).access_token).toBe("key");
    const body = JSON.parse(init.body as string);
    expect(body.billingTypes).toEqual(["PIX", "CREDIT_CARD"]);
    expect(body.chargeTypes).toEqual(["DETACHED", "INSTALLMENT"]);
    expect(body.installment).toEqual({ maxInstallmentCount: 4 });
    expect(body.minutesToExpire).toBe(60);
    expect(body.externalReference).toBe("1042");
    expect(body.callback).toEqual({ successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.expiredUrl });
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ name: "Pedido 1042", quantity: 1, value: 129.9 });
    expect(body.items[0].name.length).toBeLessThanOrEqual(30);
    expect(typeof body.items[0].imageBase64).toBe("string");
    expect(body.customerData).toEqual({ name: "Maria Souza", cpfCnpj: "52998224725", email: "maria@exemplo.com", phone: "11988887777" });
  });

  it("sem parcelamento (1x) manda só DETACHED", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ id: "c", link: "l" }), { status: 200 })) as unknown as typeof fetch;
    await createAsaasCheckout(cfg, { ...input, maxInstallments: 1 }, fetchFn);
    const body = JSON.parse((fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1].body as string);
    expect(body.chargeTypes).toEqual(["DETACHED"]);
    expect(body.installment).toBeUndefined();
  });

  it("erro HTTP ou resposta sem link vira erro amigável", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = vi.fn(async () => new Response("{}", { status: 400 })) as unknown as typeof fetch;
    expect(await createAsaasCheckout(cfg, input, bad)).toEqual({ ok: false, error: "Não foi possível iniciar o pagamento. Tente novamente." });
    const noLink = vi.fn(async () => new Response(JSON.stringify({ id: "c" }), { status: 200 })) as unknown as typeof fetch;
    expect((await createAsaasCheckout(cfg, input, noLink)).ok).toBe(false);
  });
});

describe("isValidWebhookToken", () => {
  it("aceita só o token configurado", () => {
    expect(isValidWebhookToken(cfg, "segredo-do-webhook")).toBe(true);
    expect(isValidWebhookToken(cfg, "outro")).toBe(false);
    expect(isValidWebhookToken(cfg, null)).toBe(false);
    expect(isValidWebhookToken({ ...cfg, webhookToken: "" }, "")).toBe(false);
  });
});

describe("parseAsaasCheckoutEvent", () => {
  it("extrai id, evento e checkout", () => {
    expect(parseAsaasCheckoutEvent({ id: "evt_1", event: "CHECKOUT_PAID", checkout: { id: "chk_1" } })).toEqual({
      id: "evt_1",
      event: "CHECKOUT_PAID",
      checkoutId: "chk_1",
    });
  });
  it("devolve null para payload sem checkout", () => {
    expect(parseAsaasCheckoutEvent({ id: "evt_1", event: "PAYMENT_RECEIVED", payment: {} })).toBeNull();
    expect(parseAsaasCheckoutEvent(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/asaas.test.ts`
Expected: FAIL — import não resolve.

- [ ] **Step 3: Implementar** — `packages/core/src/asaas.ts`:

```ts
import { timingSafeEqual } from "node:crypto";

export type AsaasConfig = { baseUrl: string; apiKey: string; webhookToken: string };
export type CreateCheckoutInput = {
  orderNumber: number;
  total: number;
  maxInstallments: number;
  customer: { nome: string; cpf: string; email: string; whatsapp: string };
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
  minutesToExpire: number;
};
export type AsaasCheckoutEvent = { id: string; event: string; checkoutId: string };

// PNG 1x1 transparente: o schema do Asaas exige imageBase64 em cada item.
const ITEM_IMAGE =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const ERRO_PAGAMENTO = "Não foi possível iniciar o pagamento. Tente novamente.";

export async function createAsaasCheckout(
  cfg: AsaasConfig,
  input: CreateCheckoutInput,
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: true; checkoutId: string; link: string } | { ok: false; error: string }> {
  const parcelado = input.maxInstallments >= 2;
  const body = {
    billingTypes: ["PIX", "CREDIT_CARD"],
    chargeTypes: parcelado ? ["DETACHED", "INSTALLMENT"] : ["DETACHED"],
    ...(parcelado ? { installment: { maxInstallmentCount: Math.min(21, input.maxInstallments) } } : {}),
    minutesToExpire: input.minutesToExpire,
    externalReference: String(input.orderNumber),
    callback: { successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.expiredUrl },
    items: [{ name: `Pedido ${input.orderNumber}`, quantity: 1, value: input.total, imageBase64: ITEM_IMAGE }],
    customerData: {
      name: input.customer.nome,
      cpfCnpj: input.customer.cpf,
      email: input.customer.email,
      phone: input.customer.whatsapp.replace(/^55/, ""),
    },
  };

  try {
    const res = await fetchFn(`${cfg.baseUrl}/v3/checkouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", access_token: cfg.apiKey },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; link?: string };
    if (!res.ok || !data.id || !data.link) {
      console.error("[asaas] checkout não criado:", res.status, JSON.stringify(data).slice(0, 500));
      return { ok: false, error: ERRO_PAGAMENTO };
    }
    return { ok: true, checkoutId: data.id, link: data.link };
  } catch (err) {
    console.error("[asaas] falha:", (err as Error).message);
    return { ok: false, error: ERRO_PAGAMENTO };
  }
}

export function isValidWebhookToken(cfg: AsaasConfig, header: string | null): boolean {
  if (!cfg.webhookToken || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(cfg.webhookToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseAsaasCheckoutEvent(body: unknown): AsaasCheckoutEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { id?: unknown; event?: unknown; checkout?: { id?: unknown } };
  if (typeof b.id !== "string" || typeof b.event !== "string" || typeof b.checkout?.id !== "string") return null;
  return { id: b.id, event: b.event, checkoutId: b.checkout.id };
}
```

Em `packages/core/package.json` → `exports`: `"./asaas": "./src/asaas.ts",`.

- [ ] **Step 4: Run test**

Run: `pnpm --filter @mypet/core exec vitest run src/asaas.test.ts`
Expected: PASS, saída limpa.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/asaas.ts packages/core/src/asaas.test.ts packages/core/package.json
git commit -m "feat(core): cliente do checkout hospedado do Asaas e verificação do webhook"
```

---

### Task 6: Transições de status do pedido de varejo

**Files:**
- Create: `packages/core/src/retail-order-status.ts`, `packages/core/src/retail-order-status.test.ts`
- Modify: `packages/core/package.json` (exports)

**Interfaces:**
- Produces:
  - `type RetailOrderStatus = "aguardando_pagamento" | "pago" | "enviado" | "entregue" | "cancelado" | "expirado"`
  - `RETAIL_ORDER_STATUSES: readonly RetailOrderStatus[]`
  - `RETAIL_STATUS_LABEL: Record<RetailOrderStatus, string>`
  - `statusAfterCheckoutEvent(current: string, event: string): RetailOrderStatus | null` (null = não muda)
  - export `@mypet/core/retail-order-status`

- [ ] **Step 1: Teste** — `packages/core/src/retail-order-status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RETAIL_STATUS_LABEL, statusAfterCheckoutEvent } from "./retail-order-status";

describe("statusAfterCheckoutEvent", () => {
  it("aguardando pagamento vira pago, cancelado ou expirado", () => {
    expect(statusAfterCheckoutEvent("aguardando_pagamento", "CHECKOUT_PAID")).toBe("pago");
    expect(statusAfterCheckoutEvent("aguardando_pagamento", "CHECKOUT_CANCELED")).toBe("cancelado");
    expect(statusAfterCheckoutEvent("aguardando_pagamento", "CHECKOUT_EXPIRED")).toBe("expirado");
  });

  it("nunca rebaixa um pedido já pago, enviado ou entregue", () => {
    for (const s of ["pago", "enviado", "entregue"]) {
      expect(statusAfterCheckoutEvent(s, "CHECKOUT_EXPIRED")).toBeNull();
      expect(statusAfterCheckoutEvent(s, "CHECKOUT_CANCELED")).toBeNull();
      expect(statusAfterCheckoutEvent(s, "CHECKOUT_PAID")).toBeNull();
    }
  });

  it("pagamento que chega depois de expirar/cancelar ainda conta como pago", () => {
    expect(statusAfterCheckoutEvent("expirado", "CHECKOUT_PAID")).toBe("pago");
    expect(statusAfterCheckoutEvent("cancelado", "CHECKOUT_PAID")).toBe("pago");
  });

  it("evento desconhecido não muda nada", () => {
    expect(statusAfterCheckoutEvent("aguardando_pagamento", "CHECKOUT_CREATED")).toBeNull();
  });

  it("tem rótulo em português para todo status", () => {
    expect(RETAIL_STATUS_LABEL.aguardando_pagamento).toBe("Aguardando pagamento");
    expect(Object.keys(RETAIL_STATUS_LABEL)).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/retail-order-status.test.ts`
Expected: FAIL — import não resolve.

- [ ] **Step 3: Implementar** — `packages/core/src/retail-order-status.ts`:

```ts
export const RETAIL_ORDER_STATUSES = [
  "aguardando_pagamento",
  "pago",
  "enviado",
  "entregue",
  "cancelado",
  "expirado",
] as const;
export type RetailOrderStatus = (typeof RETAIL_ORDER_STATUSES)[number];

export const RETAIL_STATUS_LABEL: Record<RetailOrderStatus, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pagamento confirmado",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
  expirado: "Pagamento expirado",
};

const PAGO_OU_DEPOIS = new Set(["pago", "enviado", "entregue"]);

/** Novo status após um evento de checkout do Asaas; null quando o status não deve mudar. */
export function statusAfterCheckoutEvent(current: string, event: string): RetailOrderStatus | null {
  if (PAGO_OU_DEPOIS.has(current)) return null;
  if (event === "CHECKOUT_PAID") return "pago";
  if (current !== "aguardando_pagamento") return null;
  if (event === "CHECKOUT_CANCELED") return "cancelado";
  if (event === "CHECKOUT_EXPIRED") return "expirado";
  return null;
}
```

`exports`: `"./retail-order-status": "./src/retail-order-status.ts",`.

- [ ] **Step 4: Run test** — mesmo comando. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/retail-order-status.ts packages/core/src/retail-order-status.test.ts packages/core/package.json
git commit -m "feat(core): status do pedido de varejo e transições por evento do Asaas"
```

---

### Task 7: Orquestração do checkout no servidor (core)

**Files:**
- Modify: `packages/core/src/test-utils/fake-supabase.ts`
- Create: `packages/core/src/retail-checkout-server.ts`, `packages/core/src/retail-checkout-server.test.ts`
- Modify: `packages/core/package.json` (exports)

**Interfaces:**
- Consumes: `CheckoutLine`, `CheckoutInput` (Task 2); `shippingPackageFor` (Task 4); `quoteShipping`, `MelhorEnvioConfig`, `ShippingOption` (Task 4); `createAsaasCheckout`, `AsaasConfig` (Task 5); `hasSellablePrice`, `inStockFromQty`, `installmentPlan`, `RetailConfig` (`./retail`); `salePriceFromChannelPrices` (`./catalog-utils`).
- Produces:
  - `type PricedLine = { id: string; name: string; qty: number; unitPrice: number }`
  - `priceCart(supabase, channel: string, lines: CheckoutLine[]): Promise<{ ok: true; lines: PricedLine[]; subtotal: number } | { ok: false; error: string }>`
  - `type CheckoutDeps = { supabase: SupabaseClient; channel: string; melhorEnvio: MelhorEnvioConfig; asaas: AsaasConfig; installments: RetailConfig["installments"]; siteUrl: string; fetchFn?: typeof fetch; newToken?: () => string }`
  - `quoteCheckout(deps, input: { items: CheckoutLine[]; cep: string }): Promise<{ ok: true; subtotal: number; options: ShippingOption[] } | { ok: false; error: string }>`
  - `startCheckout(deps, input: CheckoutInput): Promise<{ ok: true; orderId: string; paymentUrl: string } | { ok: false; error: string }>`
  - export `@mypet/core/retail-checkout-server`

- [ ] **Step 1: Ampliar o fake** — em `packages/core/src/test-utils/fake-supabase.ts`, troque `CHAIN_METHODS` por:

```ts
const CHAIN_METHODS = ["select", "eq", "neq", "in", "is", "gte", "order", "limit", "insert", "update", "upsert", "delete"] as const;
```

e, após `builder.maybeSingle = …`, acrescente:

```ts
      builder.single = () => {
        calls.push({ table, method: "single", args: [] });
        return next();
      };
```

e, no objeto `client`, ao lado de `from`, acrescente `rpc` usando a fila `rpc:<nome>`:

```ts
    rpc(fn: string, args: unknown) {
      calls.push({ table: `rpc:${fn}`, method: "rpc", args: [args] });
      return Promise.resolve({ data: null, error: null, ...(queues[`rpc:${fn}`]?.shift() ?? {}) });
    },
```

Rode `pnpm --filter @mypet/core test` — tudo deve continuar passando.

- [ ] **Step 2: Testes** — `packages/core/src/retail-checkout-server.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fakeSupabase } from "./test-utils/fake-supabase";
import { priceCart, quoteCheckout, startCheckout, type CheckoutDeps } from "./retail-checkout-server";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

const productRow = (id: string, name: string, price: number | null, stock: number | null) => ({
  id,
  name,
  stock_qty: stock,
  product_channel_prices: price === null ? [] : [{ channel: "azpetshop", sale_price: price, sale_updated_at: "2026-10-01" }],
});

function shippingFetch() {
  return vi.fn(async () =>
    new Response(JSON.stringify([{ id: 1, name: "PAC", custom_price: "20.00", custom_delivery_time: 7, company: { name: "Correios" } }]), { status: 200 }),
  ) as unknown as typeof fetch;
}

function deps(supabase: CheckoutDeps["supabase"], fetchFn: typeof fetch): CheckoutDeps {
  return {
    supabase,
    channel: "azpetshop",
    melhorEnvio: { baseUrl: "https://me.test", token: "t", userAgent: "ua", fromCep: "01001000" },
    asaas: { baseUrl: "https://asaas.test", apiKey: "k", webhookToken: "w" },
    installments: { max: 6, minInstallment: 30 },
    siteUrl: "https://www.azpetshop.com.br",
    fetchFn,
    newToken: () => "tok123",
  };
}

const input = {
  items: [{ id: ID_A, qty: 2 }],
  customer: { nome: "Maria Souza", cpf: "52998224725", email: "maria@exemplo.com", whatsapp: "5511988887777" },
  address: { cep: "20040002", logradouro: "Rua A", numero: "10", complemento: "", bairro: "Centro", cidade: "Rio de Janeiro", uf: "RJ" },
  shippingServiceId: 1,
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("priceCart", () => {
  it("usa o preço do servidor e soma o subtotal", async () => {
    const { client } = fakeSupabase({ products: [{ data: [productRow(ID_A, "Shampoo", 25, 5), productRow(ID_B, "Coleira", 10.5, 3)] }] });
    const r = await priceCart(client, "azpetshop", [{ id: ID_A, qty: 2 }, { id: ID_B, qty: 1 }]);
    expect(r).toEqual({
      ok: true,
      lines: [
        { id: ID_A, name: "Shampoo", qty: 2, unitPrice: 25 },
        { id: ID_B, name: "Coleira", qty: 1, unitPrice: 10.5 },
      ],
      subtotal: 60.5,
    });
  });

  it("bloqueia produto ausente, sem preço vendável ou sem estoque", async () => {
    for (const row of [productRow(ID_A, "X", null, 5), productRow(ID_A, "X", 0, 5), productRow(ID_A, "X", 25, 0), productRow(ID_A, "X", 25, null)]) {
      const { client } = fakeSupabase({ products: [{ data: [row] }] });
      const r = await priceCart(client, "azpetshop", [{ id: ID_A, qty: 1 }]);
      expect(r.ok).toBe(false);
    }
    const { client } = fakeSupabase({ products: [{ data: [] }] });
    expect((await priceCart(client, "azpetshop", [{ id: ID_A, qty: 1 }])).ok).toBe(false);
  });

  it("bloqueia quantidade acima do estoque", async () => {
    const { client } = fakeSupabase({ products: [{ data: [productRow(ID_A, "Shampoo", 25, 1)] }] });
    const r = await priceCart(client, "azpetshop", [{ id: ID_A, qty: 2 }]);
    expect(r).toEqual({ ok: false, error: "Só temos 1 unidade(s) de Shampoo em estoque." });
  });
});

describe("quoteCheckout", () => {
  it("devolve subtotal e opções de frete", async () => {
    const { client } = fakeSupabase({ products: [{ data: [productRow(ID_A, "Shampoo", 25, 5)] }] });
    const r = await quoteCheckout(deps(client, shippingFetch()), { items: [{ id: ID_A, qty: 2 }], cep: "20040002" });
    expect(r).toEqual({ ok: true, subtotal: 50, options: [{ serviceId: 1, name: "PAC", company: "Correios", price: 20, deliveryDays: 7 }] });
  });
});

describe("startCheckout", () => {
  it("grava pedido, itens, entrega e pagamento e devolve o link do Asaas", async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes("/v3/checkouts")
        ? new Response(JSON.stringify({ id: "chk_1", link: "https://asaas.test/c/chk_1" }), { status: 200 })
        : new Response(JSON.stringify([{ id: 1, name: "PAC", custom_price: "20.00", custom_delivery_time: 7, company: { name: "Correios" } }]), { status: 200 }),
    ) as unknown as typeof fetch;
    const { client, calls } = fakeSupabase({
      products: [{ data: [productRow(ID_A, "Shampoo", 25, 5)] }],
      orders: [{ data: { id: "o1", number: 1042 } }],
      order_items: [{}],
      order_shipping: [{}],
      order_payments: [{}],
    });

    const r = await startCheckout(deps(client, fetchFn), input);
    expect(r).toEqual({ ok: true, orderId: "o1", paymentUrl: "https://asaas.test/c/chk_1" });

    const orderInsert = calls.find((c) => c.table === "orders" && c.method === "insert")?.args[0];
    expect(orderInsert).toMatchObject({
      channel: "azpetshop",
      status: "aguardando_pagamento",
      customer_name: "Maria Souza",
      customer_cpf: "52998224725",
      customer_email: "maria@exemplo.com",
      customer_whatsapp: "5511988887777",
      subtotal: 50,
      shipping_price: 20,
      total: 70,
      access_token: "tok123",
    });
    expect(calls.find((c) => c.table === "order_items" && c.method === "insert")?.args[0]).toEqual([
      { order_id: "o1", product_id: ID_A, product_name_snapshot: "Shampoo", qty: 2, unit_price: 25 },
    ]);
    expect(calls.find((c) => c.table === "order_shipping" && c.method === "insert")?.args[0]).toMatchObject({
      order_id: "o1", cep: "20040002", service_id: 1, service_name: "Correios PAC", price: 20, delivery_days: 7,
    });
    expect(calls.find((c) => c.table === "order_payments" && c.method === "insert")?.args[0]).toMatchObject({
      order_id: "o1", asaas_checkout_id: "chk_1", checkout_url: "https://asaas.test/c/chk_1", amount: 70,
    });

    const asaasBody = JSON.parse((fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.find(([u]) => u.includes("/v3/checkouts"))![1].body as string);
    expect(asaasBody.callback.successUrl).toBe("https://www.azpetshop.com.br/pedido/o1?t=tok123");
    expect(asaasBody.items[0].value).toBe(70);
    expect(asaasBody.installment).toEqual({ maxInstallmentCount: 2 });
  });

  it("frete escolhido que não existe mais na recotação bloqueia", async () => {
    const { client, calls } = fakeSupabase({ products: [{ data: [productRow(ID_A, "Shampoo", 25, 5)] }] });
    const r = await startCheckout(deps(client, shippingFetch()), { ...input, shippingServiceId: 99 });
    expect(r).toEqual({ ok: false, error: "A opção de frete escolhida não está mais disponível. Escolha de novo." });
    expect(calls.some((c) => c.table === "orders")).toBe(false);
  });

  it("falha do Asaas deixa o pedido aguardando e devolve erro", async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes("/v3/checkouts")
        ? new Response("{}", { status: 500 })
        : new Response(JSON.stringify([{ id: 1, name: "PAC", custom_price: "20.00", company: { name: "Correios" } }]), { status: 200 }),
    ) as unknown as typeof fetch;
    const { client, calls } = fakeSupabase({
      products: [{ data: [productRow(ID_A, "Shampoo", 25, 5)] }],
      orders: [{ data: { id: "o1", number: 1042 } }],
      order_items: [{}],
      order_shipping: [{}],
    });
    const r = await startCheckout(deps(client, fetchFn), input);
    expect(r).toEqual({ ok: false, error: "Não foi possível iniciar o pagamento. Tente novamente." });
    expect(calls.some((c) => c.table === "order_payments")).toBe(false);
  });

  it("falha ao gravar os itens apaga o pedido", async () => {
    const { client, calls } = fakeSupabase({
      products: [{ data: [productRow(ID_A, "Shampoo", 25, 5)] }],
      orders: [{ data: { id: "o1", number: 1042 } }, {}],
      order_items: [{ error: { message: "x" } }],
    });
    const r = await startCheckout(deps(client, shippingFetch()), input);
    expect(r.ok).toBe(false);
    expect(calls.some((c) => c.table === "orders" && c.method === "delete")).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/retail-checkout-server.test.ts`
Expected: FAIL — import não resolve.

- [ ] **Step 4: Implementar** — `packages/core/src/retail-checkout-server.ts`:

```ts
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAsaasCheckout, type AsaasConfig } from "./asaas";
import { salePriceFromChannelPrices, type RawChannelPrice } from "./catalog-utils";
import { quoteShipping, type MelhorEnvioConfig, type ShippingOption } from "./melhor-envio";
import { hasSellablePrice, inStockFromQty, installmentPlan, type RetailConfig } from "./retail";
import type { CheckoutInput, CheckoutLine } from "./retail-checkout";
import { shippingPackageFor } from "./shipping-package";

export type PricedLine = { id: string; name: string; qty: number; unitPrice: number };
export type CheckoutDeps = {
  supabase: SupabaseClient;
  channel: string;
  melhorEnvio: MelhorEnvioConfig;
  asaas: AsaasConfig;
  installments: RetailConfig["installments"];
  siteUrl: string;
  fetchFn?: typeof fetch;
  newToken?: () => string;
};

type RawRow = { id: string; name: string; stock_qty: number | null; product_channel_prices: RawChannelPrice[] | null };

const ERRO_PEDIDO = "Não foi possível registrar seu pedido. Tente novamente em instantes.";
// Validade da página de pagamento (o Pix gerado vale dentro dela).
const MINUTOS_PARA_PAGAR = 60;

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function priceCart(
  supabase: SupabaseClient,
  channel: string,
  lines: CheckoutLine[],
): Promise<{ ok: true; lines: PricedLine[]; subtotal: number } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, stock_qty, product_channel_prices(channel, sale_price, sale_updated_at), product_channel_links!inner(channel)")
    .in("id", lines.map((l) => l.id))
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel);
  if (error || !data) {
    console.error("[retail-checkout] erro ao buscar preços:", error?.message);
    return { ok: false, error: ERRO_PEDIDO };
  }
  const byId = new Map((data as unknown as RawRow[]).map((row) => [row.id, row]));

  const priced: PricedLine[] = [];
  for (const line of lines) {
    const row = byId.get(line.id);
    const price = row ? salePriceFromChannelPrices(row.product_channel_prices) : null;
    if (!row || !hasSellablePrice(price)) {
      return { ok: false, error: "Algum item do carrinho não está mais à venda. Revise o carrinho." };
    }
    if (inStockFromQty(row.stock_qty) === false) {
      return { ok: false, error: `${row.name} está esgotado. Remova do carrinho para continuar.` };
    }
    if (row.stock_qty !== null && line.qty > row.stock_qty) {
      return { ok: false, error: `Só temos ${row.stock_qty} unidade(s) de ${row.name} em estoque.` };
    }
    priced.push({ id: line.id, name: row.name, qty: line.qty, unitPrice: price });
  }
  return { ok: true, lines: priced, subtotal: round2(priced.reduce((t, l) => t + l.unitPrice * l.qty, 0)) };
}

async function priceAndQuote(
  deps: CheckoutDeps,
  input: { items: CheckoutLine[]; cep: string },
): Promise<{ ok: true; lines: PricedLine[]; subtotal: number; options: ShippingOption[] } | { ok: false; error: string }> {
  const cart = await priceCart(deps.supabase, deps.channel, input.items);
  if (!cart.ok) return cart;
  const quote = await quoteShipping(
    deps.melhorEnvio,
    { toCep: input.cep, pkg: shippingPackageFor(cart.lines), insuranceValue: cart.subtotal },
    deps.fetchFn,
  );
  if (!quote.ok) return quote;
  return { ok: true, lines: cart.lines, subtotal: cart.subtotal, options: quote.options };
}

export async function quoteCheckout(
  deps: CheckoutDeps,
  input: { items: CheckoutLine[]; cep: string },
): Promise<{ ok: true; subtotal: number; options: ShippingOption[] } | { ok: false; error: string }> {
  const r = await priceAndQuote(deps, input);
  return r.ok ? { ok: true, subtotal: r.subtotal, options: r.options } : r;
}

export async function startCheckout(
  deps: CheckoutDeps,
  input: CheckoutInput,
): Promise<{ ok: true; orderId: string; paymentUrl: string } | { ok: false; error: string }> {
  // Preço e frete são sempre recalculados aqui: nada do navegador é confiável.
  const cart = await priceAndQuote(deps, { items: input.items, cep: input.address.cep });
  if (!cart.ok) return cart;
  const shipping = cart.options.find((o) => o.serviceId === input.shippingServiceId);
  if (!shipping) return { ok: false, error: "A opção de frete escolhida não está mais disponível. Escolha de novo." };

  const total = round2(cart.subtotal + shipping.price);
  const token = (deps.newToken ?? (() => randomBytes(24).toString("hex")))();
  const { supabase } = deps;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      channel: deps.channel,
      status: "aguardando_pagamento",
      customer_name: input.customer.nome,
      customer_cpf: input.customer.cpf,
      customer_email: input.customer.email,
      customer_whatsapp: input.customer.whatsapp,
      subtotal: cart.subtotal,
      shipping_price: shipping.price,
      total,
      access_token: token,
    })
    .select("id, number")
    .single();
  if (orderError || !order) {
    console.error("[retail-checkout] pedido não gravado:", orderError?.message);
    return { ok: false, error: ERRO_PEDIDO };
  }
  const { id: orderId, number } = order as { id: string; number: number };

  const rollback = async () => {
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) console.error("[retail-checkout] rollback falhou:", error.message);
  };

  const { error: itemsError } = await supabase.from("order_items").insert(
    cart.lines.map((l) => ({ order_id: orderId, product_id: l.id, product_name_snapshot: l.name, qty: l.qty, unit_price: l.unitPrice })),
  );
  if (itemsError) {
    console.error("[retail-checkout] itens não gravados:", itemsError.message);
    await rollback();
    return { ok: false, error: ERRO_PEDIDO };
  }

  const { error: shippingError } = await supabase.from("order_shipping").insert({
    order_id: orderId,
    ...input.address,
    service_id: shipping.serviceId,
    service_name: `${shipping.company} ${shipping.name}`.trim(),
    price: shipping.price,
    delivery_days: shipping.deliveryDays,
  });
  if (shippingError) {
    console.error("[retail-checkout] entrega não gravada:", shippingError.message);
    await rollback();
    return { ok: false, error: ERRO_PEDIDO };
  }

  const orderUrl = `${deps.siteUrl}/pedido/${orderId}?t=${token}`;
  const checkout = await createAsaasCheckout(
    deps.asaas,
    {
      orderNumber: number,
      total,
      maxInstallments: installmentPlan(total, deps.installments)?.count ?? 1,
      customer: input.customer,
      successUrl: orderUrl,
      cancelUrl: `${deps.siteUrl}/checkout`,
      expiredUrl: orderUrl,
      minutesToExpire: MINUTOS_PARA_PAGAR,
    },
    deps.fetchFn,
  );
  if (!checkout.ok) return checkout; // pedido fica "aguardando_pagamento" sem cobrança; expira sem efeito

  const { error: paymentError } = await supabase.from("order_payments").insert({
    order_id: orderId,
    asaas_checkout_id: checkout.checkoutId,
    checkout_url: checkout.link,
    amount: total,
  });
  if (paymentError) {
    // Sem esse registro o webhook não acha o pedido: não manda o cliente pagar.
    console.error("[retail-checkout] pagamento não gravado:", paymentError.message);
    return { ok: false, error: ERRO_PEDIDO };
  }

  return { ok: true, orderId, paymentUrl: checkout.link };
}
```

`exports`: `"./retail-checkout-server": "./src/retail-checkout-server.ts",`.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @mypet/core exec vitest run src/retail-checkout-server.test.ts`
Expected: PASS, saída limpa.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/test-utils/fake-supabase.ts packages/core/src/retail-checkout-server.ts packages/core/src/retail-checkout-server.test.ts packages/core/package.json
git commit -m "feat(core): checkout de varejo no servidor (preço, frete, pedido e cobrança Asaas)"
```

---

### Task 8: E-mails de pedido (azpetshop)

**Files:**
- Modify: `apps/azpetshop/package.json` (deps `nodemailer`, devDeps `@types/nodemailer` — mesmas versões de `apps/zemann/package.json`: `^10.1.2` e `^8.0.2`)
- Create: `apps/azpetshop/lib/pedido-emails.ts`, `apps/azpetshop/lib/pedido-emails.test.ts`

**Interfaces:**
- Consumes: `EMPRESA` (`@/lib/empresa`), `formatBRL` (`@mypet/core/catalog-utils`), `formatCep` (`@mypet/core/br-validation`).
- Produces:
  - `type PedidoParaEmail = { id: string; number: number; customerName: string; customerEmail: string; customerWhatsapp: string; total: number; shippingPrice: number; items: { name: string; qty: number; unitPrice: number }[]; address: { cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string }; serviceName: string; trackingCode?: string | null; orderUrl: string }`
  - `type Mailer = (msg: { to: string; subject: string; text: string }) => Promise<void>`
  - `smtpMailer(): Mailer` (lê `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
  - `emailPedidoPagoEquipe(p: PedidoParaEmail): { subject: string; text: string }`
  - `emailPedidoPagoCliente(p: PedidoParaEmail): { subject: string; text: string }`
  - `emailPedidoEnviadoCliente(p: PedidoParaEmail): { subject: string; text: string }`
  - `avisarPedidoPago(p: PedidoParaEmail, mailer: Mailer, equipeEmail: string): Promise<void>` (envia os dois; falha de um não impede o outro; nunca lança)

- [ ] **Step 1: Teste** — `apps/azpetshop/lib/pedido-emails.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { avisarPedidoPago, emailPedidoEnviadoCliente, emailPedidoPagoCliente, emailPedidoPagoEquipe, type PedidoParaEmail } from "./pedido-emails";

const pedido: PedidoParaEmail = {
  id: "o1",
  number: 1042,
  customerName: "Maria Souza",
  customerEmail: "maria@exemplo.com",
  customerWhatsapp: "5511988887777",
  total: 70,
  shippingPrice: 20,
  items: [{ name: "Shampoo", qty: 2, unitPrice: 25 }],
  address: { cep: "20040002", logradouro: "Rua A", numero: "10", complemento: null, bairro: "Centro", cidade: "Rio de Janeiro", uf: "RJ" },
  serviceName: "Correios PAC",
  orderUrl: "https://www.azpetshop.com.br/pedido/o1?t=tok",
};

describe("e-mails de pedido", () => {
  it("equipe recebe número, itens, total, cliente e endereço", () => {
    const { subject, text } = emailPedidoPagoEquipe(pedido);
    expect(subject).toBe("Pedido 1042 pago — AZ Pet Shop");
    for (const trecho of ["2x Shampoo", "Maria Souza", "(11) 98888-7777", "Rua A, 10", "20040-002", "Correios PAC"]) {
      expect(text).toContain(trecho);
    }
  });

  it("cliente recebe confirmação com o link do pedido", () => {
    const { subject, text } = emailPedidoPagoCliente(pedido);
    expect(subject).toBe("Recebemos seu pagamento — pedido 1042");
    expect(text).toContain(pedido.orderUrl);
  });

  it("aviso de envio leva o código de rastreio", () => {
    const { text } = emailPedidoEnviadoCliente({ ...pedido, trackingCode: "BR123" });
    expect(text).toContain("BR123");
  });

  it("avisarPedidoPago manda para equipe e cliente e não lança se um falhar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const mailer = vi.fn().mockRejectedValueOnce(new Error("smtp")).mockResolvedValueOnce(undefined);
    await expect(avisarPedidoPago(pedido, mailer, "pedidos@azpetshop.com.br")).resolves.toBeUndefined();
    expect(mailer).toHaveBeenCalledTimes(2);
    expect(mailer.mock.calls.map((c) => c[0].to)).toEqual(["pedidos@azpetshop.com.br", "maria@exemplo.com"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter azpetshop exec vitest run lib/pedido-emails.test.ts`
Expected: FAIL — import não resolve.

- [ ] **Step 3: Instalar dependência**

Run: `pnpm --filter azpetshop add nodemailer@^10.1.2 && pnpm --filter azpetshop add -D @types/nodemailer@^8.0.2`

- [ ] **Step 4: Implementar** — `apps/azpetshop/lib/pedido-emails.ts`:

```ts
import nodemailer from "nodemailer";
import { formatBRL } from "@mypet/core/catalog-utils";
import { formatCep, formatWhatsapp } from "@mypet/core/br-validation";
import { EMPRESA } from "@/lib/empresa";

export type PedidoParaEmail = {
  id: string;
  number: number;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  total: number;
  shippingPrice: number;
  items: { name: string; qty: number; unitPrice: number }[];
  address: { cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string };
  serviceName: string;
  trackingCode?: string | null;
  orderUrl: string;
};
export type Mailer = (msg: { to: string; subject: string; text: string }) => Promise<void>;

export function smtpMailer(): Mailer {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error("SMTP não configurado (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  const port = Number(process.env.SMTP_PORT) || 465;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    connectionTimeout: 10_000,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return async ({ to, subject, text }) => {
    await transport.sendMail({ from: `"${EMPRESA.nomeFantasia}" <${SMTP_USER}>`, to, subject, text });
  };
}

function itensEmTexto(p: PedidoParaEmail): string {
  return p.items.map((i) => `- ${i.qty}x ${i.name} — ${formatBRL(i.unitPrice * i.qty)}`).join("\n");
}

function enderecoEmTexto(p: PedidoParaEmail): string {
  const a = p.address;
  const rua = [a.logradouro, a.numero, a.complemento].filter(Boolean).join(", ");
  return `${rua} — ${a.bairro}, ${a.cidade}/${a.uf} — CEP ${formatCep(a.cep)}`;
}

export function emailPedidoPagoEquipe(p: PedidoParaEmail) {
  return {
    subject: `Pedido ${p.number} pago — ${EMPRESA.nomeFantasia}`,
    text: [
      `Pedido ${p.number} com pagamento confirmado.`,
      "",
      itensEmTexto(p),
      `Frete (${p.serviceName}): ${formatBRL(p.shippingPrice)}`,
      `Total: ${formatBRL(p.total)}`,
      "",
      `Cliente: ${p.customerName} — ${p.customerEmail} — WhatsApp ${formatWhatsapp(p.customerWhatsapp)}`,
      `Entrega: ${enderecoEmTexto(p)}`,
      "",
      "Emita a NF-e, gere a etiqueta no Melhor Envio e marque como enviado no admin.",
    ].join("\n"),
  };
}

export function emailPedidoPagoCliente(p: PedidoParaEmail) {
  return {
    subject: `Recebemos seu pagamento — pedido ${p.number}`,
    text: [
      `Olá, ${p.customerName}!`,
      "",
      `Confirmamos o pagamento do seu pedido ${p.number} na ${EMPRESA.nomeFantasia}.`,
      "",
      itensEmTexto(p),
      `Frete (${p.serviceName}): ${formatBRL(p.shippingPrice)}`,
      `Total: ${formatBRL(p.total)}`,
      "",
      `Entrega em: ${enderecoEmTexto(p)}`,
      `Acompanhe seu pedido: ${p.orderUrl}`,
      "",
      `Dúvidas? Responda este e-mail ou fale pelo WhatsApp ${formatWhatsapp(EMPRESA.whatsapp)}.`,
    ].join("\n"),
  };
}

export function emailPedidoEnviadoCliente(p: PedidoParaEmail) {
  return {
    subject: `Seu pedido ${p.number} foi enviado`,
    text: [
      `Olá, ${p.customerName}!`,
      "",
      `Seu pedido ${p.number} foi despachado por ${p.serviceName}.`,
      `Código de rastreio: ${p.trackingCode ?? "—"}`,
      `Acompanhe: ${p.orderUrl}`,
    ].join("\n"),
  };
}

/** Avisa equipe e cliente; falhas são registradas e nunca derrubam o webhook. */
export async function avisarPedidoPago(p: PedidoParaEmail, mailer: Mailer, equipeEmail: string): Promise<void> {
  const envios = [
    { to: equipeEmail, ...emailPedidoPagoEquipe(p) },
    { to: p.customerEmail, ...emailPedidoPagoCliente(p) },
  ];
  for (const msg of envios) {
    try {
      await mailer(msg);
    } catch (err) {
      console.error(`[pedido-emails] falha ao enviar para ${msg.to}:`, (err as Error).message);
    }
  }
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter azpetshop exec vitest run lib/pedido-emails.test.ts`
Expected: PASS. Se `formatWhatsapp("5511988887777")` não der `(11) 98888-7777`, confira `packages/core/src/br-validation.ts` (ela remove o 55) e ajuste o teste ao formato real.

- [ ] **Step 6: Commit**

```bash
git add apps/azpetshop/package.json pnpm-lock.yaml apps/azpetshop/lib/pedido-emails.ts apps/azpetshop/lib/pedido-emails.test.ts
git commit -m "feat(azpetshop): e-mails de pedido pago e enviado"
```

---

### Task 9: Webhook do Asaas (core + rota no app)

**Files:**
- Create: `packages/core/src/retail-webhook-server.ts`, `packages/core/src/retail-webhook-server.test.ts`
- Create: `packages/core/src/retail-orders-server.ts`, `packages/core/src/retail-orders-server.test.ts`
- Create: `apps/azpetshop/lib/checkout-env.ts`
- Create: `apps/azpetshop/app/api/webhooks/asaas/route.ts`
- Modify: `packages/core/package.json` (exports), `apps/azpetshop/.env.example`

**Interfaces:**
- Consumes: `isValidWebhookToken`, `parseAsaasCheckoutEvent`, `AsaasConfig` (Task 5); `statusAfterCheckoutEvent` (Task 6); `PedidoParaEmail`, `avisarPedidoPago`, `smtpMailer` (Task 8); `getHubServiceClient` (`@mypet/core/supabase`).
- Produces:
  - `type RetailOrderView = { id: string; number: number; status: string; createdAt: string; customerName: string; customerEmail: string; customerWhatsapp: string; subtotal: number; shippingPrice: number; total: number; items: { name: string; qty: number; unitPrice: number }[]; shipping: { cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string; serviceName: string; deliveryDays: number | null; trackingCode: string | null } | null; paymentUrl: string | null }`
  - `getRetailOrder(supabase, id: string, token?: string): Promise<RetailOrderView | null>` (com `token`: só devolve se bater com `access_token`)
  - `type WebhookResult = { status: number; body: string }`
  - `handleAsaasWebhook(deps: { supabase: SupabaseClient; asaas: AsaasConfig; onPaid: (orderId: string) => Promise<void> }, req: { token: string | null; body: unknown }): Promise<WebhookResult>`
  - `checkoutEnv(): { asaas: AsaasConfig; melhorEnvio: MelhorEnvioConfig; siteUrl: string; equipeEmail: string }` (lança com mensagem clara se faltar env)
  - `pedidoParaEmail(order: RetailOrderView, siteUrl: string, token: string): PedidoParaEmail` (em `apps/azpetshop/lib/pedido-emails.ts`)

Regras de `handleAsaasWebhook`:
1. Token inválido → `401`.
2. Payload não é evento de checkout → `200 "ignorado"` (o Asaas pausa a fila quando recebe erro).
3. `insert` em `payment_webhook_events` (`id`, `event`, `payload`); erro com `code === "23505"` (já processado) → `200 "duplicado"`; outro erro → `500` (o Asaas reenvia).
4. Busca `order_payments` por `asaas_checkout_id` → `orders(id, status)`; não achou → `200 "pedido não encontrado"` (registrar `console.error`).
5. `statusAfterCheckoutEvent(status, event)`; null → atualiza só `order_payments.status/last_event_*` e `200`.
6. Atualiza `orders.status` (e `updated_at`) e `order_payments` (`status` = `PAID`/`CANCELED`/`EXPIRED`, `last_event_id`, `last_event_payload`, `updated_at`).
7. Se virou `pago`: `rpc("decrement_order_stock", { p_order_id })` (erro só loga) e `await onPaid(orderId)` (erro só loga).
8. Se o evento for apagado de `payment_webhook_events` quando os passos 6 falharem (para permitir reenvio): em erro do passo 6, `delete` do evento e `500`.

- [ ] **Step 1: Testes do webhook** — `packages/core/src/retail-webhook-server.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fakeSupabase } from "./test-utils/fake-supabase";
import { handleAsaasWebhook } from "./retail-webhook-server";

const asaas = { baseUrl: "https://asaas.test", apiKey: "k", webhookToken: "w" };
const paid = { id: "evt_1", event: "CHECKOUT_PAID", checkout: { id: "chk_1" } };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function setup(results: Parameters<typeof fakeSupabase>[0]) {
  const { client, calls } = fakeSupabase(results);
  const onPaid = vi.fn(async () => {});
  return { deps: { supabase: client, asaas, onPaid }, calls, onPaid };
}

describe("handleAsaasWebhook", () => {
  it("recusa token inválido", async () => {
    const { deps, calls } = setup({});
    expect(await handleAsaasWebhook(deps, { token: "x", body: paid })).toEqual({ status: 401, body: "token inválido" });
    expect(calls).toHaveLength(0);
  });

  it("ignora eventos que não são de checkout", async () => {
    const { deps } = setup({});
    expect((await handleAsaasWebhook(deps, { token: "w", body: { id: "e", event: "PAYMENT_RECEIVED" } })).status).toBe(200);
  });

  it("evento repetido não processa de novo", async () => {
    const { deps, onPaid } = setup({ payment_webhook_events: [{ error: { message: "dup", code: "23505" } }] });
    expect(await handleAsaasWebhook(deps, { token: "w", body: paid })).toEqual({ status: 200, body: "duplicado" });
    expect(onPaid).not.toHaveBeenCalled();
  });

  it("pagamento confirmado: marca pago, baixa estoque e avisa", async () => {
    const { deps, calls, onPaid } = setup({
      payment_webhook_events: [{}],
      order_payments: [{ data: { order_id: "o1", orders: { id: "o1", status: "aguardando_pagamento" } } }, {}],
      orders: [{}],
    });
    expect(await handleAsaasWebhook(deps, { token: "w", body: paid })).toEqual({ status: 200, body: "ok" });
    expect(calls.find((c) => c.table === "orders" && c.method === "update")?.args[0]).toMatchObject({ status: "pago" });
    expect(calls.find((c) => c.table === "order_payments" && c.method === "update")?.args[0]).toMatchObject({ status: "PAID", last_event_id: "evt_1" });
    expect(calls.find((c) => c.table === "rpc:decrement_order_stock")?.args[0]).toEqual({ p_order_id: "o1" });
    expect(onPaid).toHaveBeenCalledWith("o1");
  });

  it("expiração de pedido já pago não rebaixa nem avisa", async () => {
    const { deps, calls, onPaid } = setup({
      payment_webhook_events: [{}],
      order_payments: [{ data: { order_id: "o1", orders: { id: "o1", status: "pago" } } }, {}],
    });
    const r = await handleAsaasWebhook(deps, { token: "w", body: { ...paid, id: "evt_2", event: "CHECKOUT_EXPIRED" } });
    expect(r.status).toBe(200);
    expect(calls.some((c) => c.table === "orders" && c.method === "update")).toBe(false);
    expect(onPaid).not.toHaveBeenCalled();
  });

  it("falha ao atualizar o pedido libera o evento para reenvio", async () => {
    const { deps, calls } = setup({
      payment_webhook_events: [{}, {}],
      order_payments: [{ data: { order_id: "o1", orders: { id: "o1", status: "aguardando_pagamento" } } }],
      orders: [{ error: { message: "x" } }],
    });
    expect((await handleAsaasWebhook(deps, { token: "w", body: paid })).status).toBe(500);
    expect(calls.some((c) => c.table === "payment_webhook_events" && c.method === "delete")).toBe(true);
  });

  it("falha do aviso não derruba o webhook", async () => {
    const { deps, onPaid } = setup({
      payment_webhook_events: [{}],
      order_payments: [{ data: { order_id: "o1", orders: { id: "o1", status: "aguardando_pagamento" } } }, {}],
      orders: [{}],
    });
    onPaid.mockRejectedValueOnce(new Error("smtp"));
    expect((await handleAsaasWebhook(deps, { token: "w", body: paid })).status).toBe(200);
  });
});
```

- [ ] **Step 2: Testes da leitura do pedido** — `packages/core/src/retail-orders-server.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fakeSupabase } from "./test-utils/fake-supabase";
import { getRetailOrder } from "./retail-orders-server";

const ID = "33333333-3333-4333-8333-333333333333";
const row = {
  id: ID, number: 1042, status: "pago", created_at: "2026-11-01T12:00:00Z", access_token: "tok",
  customer_name: "Maria", customer_email: "m@x.com", customer_whatsapp: "5511988887777",
  subtotal: "50.00", shipping_price: "20.00", total: "70.00",
  order_items: [{ product_name_snapshot: "Shampoo", qty: 2, unit_price: "25.00" }],
  order_shipping: { cep: "20040002", logradouro: "Rua A", numero: "10", complemento: null, bairro: "Centro", cidade: "Rio", uf: "RJ", service_name: "Correios PAC", delivery_days: 7, tracking_code: null },
  order_payments: { checkout_url: "https://asaas.test/c/1" },
};

describe("getRetailOrder", () => {
  it("converte números e monta a visão do pedido quando o token bate", async () => {
    const { client } = fakeSupabase({ orders: [{ data: row }] });
    const order = await getRetailOrder(client, ID, "tok");
    expect(order).toMatchObject({ id: ID, number: 1042, total: 70, shippingPrice: 20, items: [{ name: "Shampoo", qty: 2, unitPrice: 25 }], paymentUrl: "https://asaas.test/c/1" });
    expect(order?.shipping?.serviceName).toBe("Correios PAC");
  });

  it("token errado ou ausente quando exigido devolve null", async () => {
    const { client } = fakeSupabase({ orders: [{ data: row }, { data: row }] });
    expect(await getRetailOrder(client, ID, "outro")).toBeNull();
    expect(await getRetailOrder(client, ID, "")).toBeNull();
  });

  it("id que não é uuid nem consulta", async () => {
    const { client, calls } = fakeSupabase({});
    expect(await getRetailOrder(client, "abc", "tok")).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @mypet/core exec vitest run src/retail-webhook-server.test.ts src/retail-orders-server.test.ts`
Expected: FAIL — imports não resolvem.

- [ ] **Step 4: Implementar o webhook** — `packages/core/src/retail-webhook-server.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidWebhookToken, parseAsaasCheckoutEvent, type AsaasConfig } from "./asaas";
import { statusAfterCheckoutEvent } from "./retail-order-status";

export type WebhookResult = { status: number; body: string };
type Deps = { supabase: SupabaseClient; asaas: AsaasConfig; onPaid: (orderId: string) => Promise<void> };

const PAYMENT_STATUS: Record<string, string> = {
  CHECKOUT_PAID: "PAID",
  CHECKOUT_CANCELED: "CANCELED",
  CHECKOUT_EXPIRED: "EXPIRED",
};

export async function handleAsaasWebhook(deps: Deps, req: { token: string | null; body: unknown }): Promise<WebhookResult> {
  if (!isValidWebhookToken(deps.asaas, req.token)) return { status: 401, body: "token inválido" };
  const event = parseAsaasCheckoutEvent(req.body);
  if (!event || !PAYMENT_STATUS[event.event]) return { status: 200, body: "ignorado" };
  const { supabase } = deps;

  const { error: dupError } = await supabase
    .from("payment_webhook_events")
    .insert({ id: event.id, event: event.event, payload: req.body });
  if (dupError) {
    if (dupError.code === "23505") return { status: 200, body: "duplicado" };
    console.error("[asaas-webhook] evento não gravado:", dupError.message);
    return { status: 500, body: "erro" };
  }
  const releaseEvent = async () => {
    await supabase.from("payment_webhook_events").delete().eq("id", event.id);
  };

  const { data: payment } = await supabase
    .from("order_payments")
    .select("order_id, orders(id, status)")
    .eq("asaas_checkout_id", event.checkoutId)
    .maybeSingle();
  const order = (payment as { order_id: string; orders: { id: string; status: string } | null } | null)?.orders;
  if (!order) {
    console.error("[asaas-webhook] pedido não encontrado para o checkout", event.checkoutId);
    return { status: 200, body: "pedido não encontrado" };
  }

  const now = new Date().toISOString();
  const next = statusAfterCheckoutEvent(order.status, event.event);
  if (next) {
    const { error } = await supabase.from("orders").update({ status: next, updated_at: now }).eq("id", order.id);
    if (error) {
      console.error("[asaas-webhook] pedido não atualizado:", error.message);
      await releaseEvent();
      return { status: 500, body: "erro" };
    }
  }

  const { error: payError } = await supabase
    .from("order_payments")
    .update({ status: PAYMENT_STATUS[event.event], last_event_id: event.id, last_event_payload: req.body, updated_at: now })
    .eq("asaas_checkout_id", event.checkoutId);
  if (payError) console.error("[asaas-webhook] pagamento não atualizado:", payError.message);

  if (next === "pago") {
    const { error: stockError } = await supabase.rpc("decrement_order_stock", { p_order_id: order.id });
    if (stockError) console.error("[asaas-webhook] estoque não baixado:", stockError.message);
    try {
      await deps.onPaid(order.id);
    } catch (err) {
      console.error("[asaas-webhook] aviso de pedido pago falhou:", (err as Error).message);
    }
  }
  return { status: 200, body: "ok" };
}
```

O teste "expiração de pedido já pago" espera **um** resultado de `order_payments` para o select e outro para o update — a fila já tem dois.

- [ ] **Step 5: Implementar a leitura** — `packages/core/src/retail-orders-server.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RetailOrderView = {
  id: string;
  number: number;
  status: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  subtotal: number;
  shippingPrice: number;
  total: number;
  items: { name: string; qty: number; unitPrice: number }[];
  shipping: {
    cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string;
    serviceName: string; deliveryDays: number | null; trackingCode: string | null;
  } | null;
  paymentUrl: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SELECT =
  "id, number, status, created_at, access_token, customer_name, customer_email, customer_whatsapp, subtotal, shipping_price, total, " +
  "order_items(product_name_snapshot, qty, unit_price), " +
  "order_shipping(cep, logradouro, numero, complemento, bairro, cidade, uf, service_name, delivery_days, tracking_code), " +
  "order_payments(checkout_url)";

const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Com `token` (página pública do pedido) só devolve o pedido se o token bater; sem token, uso interno. */
export async function getRetailOrder(supabase: SupabaseClient, id: string, token?: string): Promise<RetailOrderView | null> {
  if (!UUID_RE.test(id)) return null;
  if (token !== undefined && !token) return null;
  const { data, error } = await supabase.from("orders").select(SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const r = data as unknown as Record<string, unknown> & { access_token: string | null };
  if (token !== undefined && (!r.access_token || !sameToken(r.access_token, token))) return null;

  const s = one(r.order_shipping as Record<string, unknown> | Record<string, unknown>[] | null);
  const p = one(r.order_payments as { checkout_url: string | null } | { checkout_url: string | null }[] | null);
  return {
    id: r.id as string,
    number: num(r.number),
    status: r.status as string,
    createdAt: r.created_at as string,
    customerName: (r.customer_name as string) ?? "",
    customerEmail: (r.customer_email as string) ?? "",
    customerWhatsapp: (r.customer_whatsapp as string) ?? "",
    subtotal: num(r.subtotal),
    shippingPrice: num(r.shipping_price),
    total: num(r.total),
    items: ((r.order_items as { product_name_snapshot: string; qty: number; unit_price: unknown }[]) ?? []).map((i) => ({
      name: i.product_name_snapshot,
      qty: i.qty,
      unitPrice: num(i.unit_price),
    })),
    shipping: s
      ? {
          cep: s.cep as string, logradouro: s.logradouro as string, numero: s.numero as string,
          complemento: (s.complemento as string | null) ?? null, bairro: s.bairro as string, cidade: s.cidade as string,
          uf: s.uf as string, serviceName: s.service_name as string,
          deliveryDays: (s.delivery_days as number | null) ?? null, trackingCode: (s.tracking_code as string | null) ?? null,
        }
      : null,
    paymentUrl: p?.checkout_url ?? null,
  };
}
```

`exports`: `"./retail-webhook-server": "./src/retail-webhook-server.ts",` e `"./retail-orders-server": "./src/retail-orders-server.ts",`.

- [ ] **Step 6: Run core tests**

Run: `pnpm --filter @mypet/core exec vitest run src/retail-webhook-server.test.ts src/retail-orders-server.test.ts`
Expected: PASS.

- [ ] **Step 7: Env do app** — `apps/azpetshop/lib/checkout-env.ts`:

```ts
import type { AsaasConfig } from "@mypet/core/asaas";
import type { MelhorEnvioConfig } from "@mypet/core/melhor-envio";
import { clientConfig } from "@/client.config";
import { EMPRESA } from "@/lib/empresa";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

export function checkoutEnv(): { asaas: AsaasConfig; melhorEnvio: MelhorEnvioConfig; siteUrl: string; equipeEmail: string } {
  return {
    asaas: {
      baseUrl: process.env.ASAAS_BASE_URL ?? "https://api-sandbox.asaas.com",
      apiKey: required("ASAAS_API_KEY"),
      webhookToken: required("ASAAS_WEBHOOK_TOKEN"),
    },
    melhorEnvio: {
      baseUrl: process.env.MELHOR_ENVIO_BASE_URL ?? "https://sandbox.melhorenvio.com.br",
      token: required("MELHOR_ENVIO_TOKEN"),
      userAgent: `${EMPRESA.nomeFantasia} (${EMPRESA.email})`,
      fromCep: required("LOJA_CEP_ORIGEM"),
    },
    siteUrl: process.env.SITE_URL ?? `https://${clientConfig.domain}`,
    equipeEmail: required("PEDIDOS_EMAIL_EQUIPE"),
  };
}
```

Acrescente ao fim de `apps/azpetshop/.env.example`:

```
# Checkout (fase 2). Sandbox em dev/preview; produção só no deploy de produção.
ASAAS_BASE_URL=https://api-sandbox.asaas.com
ASAAS_API_KEY=your-asaas-api-key
ASAAS_WEBHOOK_TOKEN=use-a-long-random-secret
MELHOR_ENVIO_BASE_URL=https://sandbox.melhorenvio.com.br
MELHOR_ENVIO_TOKEN=your-melhor-envio-token
LOJA_CEP_ORIGEM=01001000
# URL pública usada nos links de retorno do pagamento (preview: URL do deploy).
SITE_URL=http://localhost:4105
PEDIDOS_EMAIL_EQUIPE=pedidos@azpetshop.com.br
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=no-reply@example.com
SMTP_PASS=your-smtp-password
```

- [ ] **Step 8: `pedidoParaEmail`** — acrescente a `apps/azpetshop/lib/pedido-emails.ts` (e um teste em `pedido-emails.test.ts` que converte um `RetailOrderView` e confere `orderUrl` = `${siteUrl}/pedido/${id}?t=${token}` e `serviceName`):

```ts
import type { RetailOrderView } from "@mypet/core/retail-orders-server";

export function pedidoParaEmail(order: RetailOrderView, siteUrl: string, token: string): PedidoParaEmail {
  return {
    id: order.id,
    number: order.number,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerWhatsapp: order.customerWhatsapp,
    total: order.total,
    shippingPrice: order.shippingPrice,
    items: order.items,
    address: order.shipping
      ? { cep: order.shipping.cep, logradouro: order.shipping.logradouro, numero: order.shipping.numero, complemento: order.shipping.complemento, bairro: order.shipping.bairro, cidade: order.shipping.cidade, uf: order.shipping.uf }
      : { cep: "", logradouro: "", numero: "", complemento: null, bairro: "", cidade: "", uf: "" },
    serviceName: order.shipping?.serviceName ?? "",
    trackingCode: order.shipping?.trackingCode ?? null,
    orderUrl: `${siteUrl}/pedido/${order.id}?t=${token}`,
  };
}
```

O token não está em `RetailOrderView`; o webhook lê o token com uma consulta própria (Step 9).

- [ ] **Step 9: Rota** — antes, confira em `node_modules/next/dist/docs/` como ler headers e corpo num Route Handler nesta versão. `apps/azpetshop/app/api/webhooks/asaas/route.ts`:

```ts
import { getHubServiceClient } from "@mypet/core/supabase";
import { handleAsaasWebhook } from "@mypet/core/retail-webhook-server";
import { getRetailOrder } from "@mypet/core/retail-orders-server";
import { checkoutEnv } from "@/lib/checkout-env";
import { avisarPedidoPago, pedidoParaEmail, smtpMailer } from "@/lib/pedido-emails";

export async function POST(request: Request) {
  const env = checkoutEnv();
  const supabase = getHubServiceClient();
  const body = await request.json().catch(() => null);

  const result = await handleAsaasWebhook(
    {
      supabase,
      asaas: env.asaas,
      onPaid: async (orderId) => {
        const order = await getRetailOrder(supabase, orderId);
        const { data } = await supabase.from("orders").select("access_token").eq("id", orderId).maybeSingle();
        if (!order || !data?.access_token) return;
        await avisarPedidoPago(pedidoParaEmail(order, env.siteUrl, data.access_token as string), smtpMailer(), env.equipeEmail);
      },
    },
    { token: request.headers.get("asaas-access-token"), body },
  );
  return new Response(result.body, { status: result.status });
}
```

- [ ] **Step 10: Run tests and build**

Run: `pnpm --filter @mypet/core test && pnpm --filter azpetshop test && pnpm --filter azpetshop build`
Expected: PASS e build ok (a rota aparece como `ƒ /api/webhooks/asaas`).

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/retail-webhook-server.ts packages/core/src/retail-webhook-server.test.ts packages/core/src/retail-orders-server.ts packages/core/src/retail-orders-server.test.ts packages/core/package.json apps/azpetshop/lib/checkout-env.ts apps/azpetshop/lib/pedido-emails.ts apps/azpetshop/lib/pedido-emails.test.ts apps/azpetshop/app/api/webhooks/asaas/route.ts apps/azpetshop/.env.example
git commit -m "feat(azpetshop): webhook do Asaas confirma pagamento, baixa estoque e avisa por e-mail"
```

---

### Task 10: Página `/checkout` e server actions

**Files:**
- Create: `apps/azpetshop/app/checkout/actions.ts`, `apps/azpetshop/app/checkout/actions.test.ts`
- Create: `apps/azpetshop/app/checkout/page.tsx`, `apps/azpetshop/app/checkout/checkout-form.tsx`, `apps/azpetshop/app/checkout/checkout-form.test.tsx`

**Interfaces:**
- Consumes: `parseCheckoutInput`, `parseCheckoutLines`, `parseCep` (Task 2); `quoteCheckout`, `startCheckout` (Task 7); `checkoutEnv` (Task 9); `RETAIL` (`@/lib/empresa`); `checkoutOptions` (Task 1); `useCart` (`@mypet/core/components/cart-provider`); `formatBRL`; `formatCep`, `formatCpf`, `formatWhatsapp`.
- Produces:
  - `cotarFrete(input: { items: unknown; cep: unknown }): Promise<{ ok: true; subtotal: number; options: ShippingOption[] } | { ok: false; error: string }>`
  - `iniciarPagamento(input: unknown): Promise<{ ok: true; paymentUrl: string } | { ok: false; error: string }>`

- [ ] **Step 1: Testes das actions** — `apps/azpetshop/app/checkout/actions.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const quoteCheckout = vi.fn();
const startCheckout = vi.fn();
vi.mock("@mypet/core/retail-checkout-server", () => ({
  quoteCheckout: (...a: unknown[]) => quoteCheckout(...a),
  startCheckout: (...a: unknown[]) => startCheckout(...a),
}));
vi.mock("@mypet/core/supabase", () => ({ getHubServiceClient: () => ({}) }));
vi.mock("@/lib/checkout-env", () => ({
  checkoutEnv: () => ({ asaas: {}, melhorEnvio: {}, siteUrl: "https://loja.test", equipeEmail: "e@x.com" }),
}));

import { cotarFrete, iniciarPagamento } from "./actions";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  quoteCheckout.mockReset();
  startCheckout.mockReset();
});

describe("cotarFrete", () => {
  it("valida antes de chamar o servidor", async () => {
    expect(await cotarFrete({ items: [], cep: "01001000" })).toEqual({ ok: false, error: "O carrinho está vazio." });
    expect(await cotarFrete({ items: [{ id: ID, qty: 1 }], cep: "123" })).toEqual({ ok: false, error: "Informe um CEP válido." });
    expect(quoteCheckout).not.toHaveBeenCalled();
  });

  it("repassa itens e CEP normalizados", async () => {
    quoteCheckout.mockResolvedValue({ ok: true, subtotal: 10, options: [] });
    await cotarFrete({ items: [{ id: ID, qty: 1 }], cep: "01001-000" });
    expect(quoteCheckout.mock.calls[0][1]).toEqual({ items: [{ id: ID, qty: 1 }], cep: "01001000" });
    expect(quoteCheckout.mock.calls[0][0]).toMatchObject({ channel: "azpetshop", siteUrl: "https://loja.test" });
  });
});

describe("iniciarPagamento", () => {
  it("devolve o erro de validação sem criar pedido", async () => {
    expect((await iniciarPagamento({})).ok).toBe(false);
    expect(startCheckout).not.toHaveBeenCalled();
  });

  it("devolve só a URL de pagamento", async () => {
    startCheckout.mockResolvedValue({ ok: true, orderId: "o1", paymentUrl: "https://asaas.test/c/1" });
    const r = await iniciarPagamento({
      items: [{ id: ID, qty: 1 }],
      customer: { nome: "Maria Souza", cpf: "52998224725", email: "m@x.com", whatsapp: "11988887777" },
      address: { cep: "01001000", logradouro: "Rua A", numero: "1", complemento: "", bairro: "Sé", cidade: "São Paulo", uf: "SP" },
      shippingServiceId: 1,
    });
    expect(r).toEqual({ ok: true, paymentUrl: "https://asaas.test/c/1" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter azpetshop exec vitest run app/checkout/actions.test.ts`
Expected: FAIL — import não resolve.

- [ ] **Step 3: Implementar as actions** — `apps/azpetshop/app/checkout/actions.ts`:

```ts
"use server";

import { getHubServiceClient } from "@mypet/core/supabase";
import { parseCep, parseCheckoutInput, parseCheckoutLines } from "@mypet/core/retail-checkout";
import { quoteCheckout, startCheckout, type CheckoutDeps } from "@mypet/core/retail-checkout-server";
import type { ShippingOption } from "@mypet/core/melhor-envio";
import { clientConfig } from "@/client.config";
import { checkoutEnv } from "@/lib/checkout-env";
import { RETAIL } from "@/lib/empresa";

function deps(): CheckoutDeps {
  const env = checkoutEnv();
  return {
    supabase: getHubServiceClient(),
    channel: clientConfig.catalogChannel,
    melhorEnvio: env.melhorEnvio,
    asaas: env.asaas,
    installments: RETAIL.installments,
    siteUrl: env.siteUrl,
  };
}

export async function cotarFrete(input: {
  items: unknown;
  cep: unknown;
}): Promise<{ ok: true; subtotal: number; options: ShippingOption[] } | { ok: false; error: string }> {
  const items = parseCheckoutLines(input.items);
  if (!items.ok) return items;
  const cep = parseCep(input.cep);
  if (!cep.ok) return cep;
  return quoteCheckout(deps(), { items: items.value, cep: cep.value });
}

export async function iniciarPagamento(input: unknown): Promise<{ ok: true; paymentUrl: string } | { ok: false; error: string }> {
  const parsed = parseCheckoutInput(input);
  if (!parsed.ok) return parsed;
  const result = await startCheckout(deps(), parsed.value);
  return result.ok ? { ok: true, paymentUrl: result.paymentUrl } : result;
}
```

- [ ] **Step 4: Run test** — mesmo comando. Expected: PASS.

- [ ] **Step 5: Teste do formulário** — `apps/azpetshop/app/checkout/checkout-form.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const cotarFrete = vi.fn();
const iniciarPagamento = vi.fn();
vi.mock("./actions", () => ({
  cotarFrete: (...a: unknown[]) => cotarFrete(...a),
  iniciarPagamento: (...a: unknown[]) => iniciarPagamento(...a),
}));
const cart = { items: [{ id: "11111111-1111-4111-8111-111111111111", name: "Shampoo", sku: "S", brand: null, img: "/s.jpg", qty: 2, unitPrice: 25 }] };
vi.mock("@mypet/core/components/cart-provider", () => ({ useCart: () => ({ cart, clear: vi.fn() }) }));

import { CheckoutForm } from "./checkout-form";

beforeEach(() => {
  cotarFrete.mockReset();
  iniciarPagamento.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP" }))));
});

describe("CheckoutForm", () => {
  it("busca o endereço pelo CEP, cota o frete e mostra as opções com o total", async () => {
    cotarFrete.mockResolvedValue({ ok: true, subtotal: 50, options: [{ serviceId: 1, name: "PAC", company: "Correios", price: 20, deliveryDays: 7 }] });
    render(<CheckoutForm />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001-000" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular frete" }));
    await waitFor(() => expect(screen.getByLabelText(/Correios PAC/)).toBeInTheDocument());
    expect((screen.getByLabelText("Rua") as HTMLInputElement).value).toBe("Praça da Sé");
    fireEvent.click(screen.getByLabelText(/Correios PAC/));
    expect(screen.getByText(/Total/).parentElement).toHaveTextContent("70,00");
  });

  it("mostra o erro do servidor ao pagar", async () => {
    cotarFrete.mockResolvedValue({ ok: true, subtotal: 50, options: [{ serviceId: 1, name: "PAC", company: "Correios", price: 20, deliveryDays: 7 }] });
    iniciarPagamento.mockResolvedValue({ ok: false, error: "Informe um CPF válido." });
    render(<CheckoutForm />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001000" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular frete" }));
    await waitFor(() => screen.getByLabelText(/Correios PAC/));
    fireEvent.click(screen.getByLabelText(/Correios PAC/));
    fireEvent.click(screen.getByRole("button", { name: "Ir para o pagamento" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Informe um CPF válido."));
  });
});
```

- [ ] **Step 6: Implementar o formulário** — `apps/azpetshop/app/checkout/checkout-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useCart } from "@mypet/core/components/cart-provider";
import { formatBRL } from "@mypet/core/catalog-utils";
import { formatCep, formatCpf, formatWhatsapp, onlyDigits } from "@mypet/core/br-validation";
import type { ShippingOption } from "@mypet/core/melhor-envio";
import { clientConfig } from "@/client.config";
import { cotarFrete, iniciarPagamento } from "./actions";

const { palette: P } = clientConfig;
const field = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13, fontWeight: 700, color: P.navy };
const input = { padding: "10px 12px", border: `1.5px solid ${P.gray200}`, borderRadius: 10, fontSize: 15, fontWeight: 400 };

export function CheckoutForm() {
  const { cart } = useCart();
  const items = cart.items.map((i) => ({ id: i.id, qty: i.qty }));
  const [customer, setCustomer] = useState({ nome: "", cpf: "", email: "", whatsapp: "" });
  const [address, setAddress] = useState({ cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });
  const [subtotal, setSubtotal] = useState<number | null>(null);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const shipping = options.find((o) => o.serviceId === serviceId) ?? null;
  const total = subtotal !== null && shipping ? Math.round((subtotal + shipping.price) * 100) / 100 : null;

  async function calcularFrete() {
    setError("");
    setBusy(true);
    setOptions([]);
    setServiceId(null);
    const cep = onlyDigits(address.cep);
    try {
      const via = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) => r.json());
      if (via && !via.erro) {
        setAddress((a) => ({ ...a, logradouro: via.logradouro || a.logradouro, bairro: via.bairro || a.bairro, cidade: via.localidade || a.cidade, uf: via.uf || a.uf }));
      }
    } catch {
      // Sem ViaCEP o cliente preenche o endereço à mão.
    }
    const r = await cotarFrete({ items, cep });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSubtotal(r.subtotal);
    setOptions(r.options);
  }

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await iniciarPagamento({ items, customer, address, shippingServiceId: serviceId });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    window.location.assign(r.paymentUrl);
  }

  if (cart.items.length === 0) return <p>Seu carrinho está vazio.</p>;

  return (
    <form onSubmit={pagar} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <fieldset style={{ border: "none", display: "grid", gap: 12 }}>
        <legend style={{ fontWeight: 900, fontSize: 18, color: P.navy, marginBottom: 8 }}>Seus dados</legend>
        <label style={field}>Nome completo<input style={input} value={customer.nome} onChange={(e) => setCustomer({ ...customer, nome: e.target.value })} autoComplete="name" required /></label>
        <label style={field}>CPF<input style={input} value={customer.cpf} onChange={(e) => setCustomer({ ...customer, cpf: formatCpf(e.target.value) || e.target.value })} inputMode="numeric" required /></label>
        <label style={field}>E-mail<input style={input} type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} autoComplete="email" required /></label>
        <label style={field}>WhatsApp<input style={input} value={customer.whatsapp} onChange={(e) => setCustomer({ ...customer, whatsapp: formatWhatsapp(e.target.value) })} inputMode="tel" autoComplete="tel" required /></label>
      </fieldset>

      <fieldset style={{ border: "none", display: "grid", gap: 12 }}>
        <legend style={{ fontWeight: 900, fontSize: 18, color: P.navy, marginBottom: 8 }}>Entrega</legend>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <label style={{ ...field, flex: 1 }}>CEP<input style={input} value={address.cep} onChange={(e) => setAddress({ ...address, cep: formatCep(e.target.value) || e.target.value })} inputMode="numeric" autoComplete="postal-code" required /></label>
          <button type="button" onClick={calcularFrete} disabled={busy} className="cta-primary">Calcular frete</button>
        </div>
        <label style={field}>Rua<input style={input} value={address.logradouro} onChange={(e) => setAddress({ ...address, logradouro: e.target.value })} required /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <label style={field}>Número<input style={input} value={address.numero} onChange={(e) => setAddress({ ...address, numero: e.target.value })} required /></label>
          <label style={field}>Complemento<input style={input} value={address.complemento} onChange={(e) => setAddress({ ...address, complemento: e.target.value })} /></label>
        </div>
        <label style={field}>Bairro<input style={input} value={address.bairro} onChange={(e) => setAddress({ ...address, bairro: e.target.value })} required /></label>
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 8 }}>
          <label style={field}>Cidade<input style={input} value={address.cidade} onChange={(e) => setAddress({ ...address, cidade: e.target.value })} required /></label>
          <label style={field}>UF<input style={input} value={address.uf} maxLength={2} onChange={(e) => setAddress({ ...address, uf: e.target.value.toUpperCase() })} required /></label>
        </div>

        {options.length > 0 && (
          <div role="radiogroup" aria-label="Opções de frete" style={{ display: "grid", gap: 8 }}>
            {options.map((o) => (
              <label key={o.serviceId} style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, border: `1.5px solid ${serviceId === o.serviceId ? P.pink : P.gray200}`, borderRadius: 10 }}>
                <input type="radio" name="frete" checked={serviceId === o.serviceId} onChange={() => setServiceId(o.serviceId)} />
                <span style={{ flex: 1 }}>{`${o.company} ${o.name}`.trim()}{o.deliveryDays ? ` — até ${o.deliveryDays} dias úteis` : ""}</span>
                <b>{formatBRL(o.price)}</b>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {subtotal !== null && (
        <div style={{ background: P.white, border: `1px solid ${P.gray200}`, borderRadius: 12, padding: 16, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Produtos</span><span>{formatBRL(subtotal)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Frete</span><span>{shipping ? formatBRL(shipping.price) : "—"}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18 }}><span>Total</span><span>{total !== null ? formatBRL(total) : "—"}</span></div>
          <p style={{ fontSize: 12, color: P.gray600 }}>Os valores são conferidos de novo antes do pagamento.</p>
        </div>
      )}

      {error && <p role="alert" style={{ color: P.pinkDark, fontWeight: 700 }}>{error}</p>}

      <button type="submit" className="cta-primary" disabled={busy || !shipping} style={{ padding: "14px 22px", fontSize: 16 }}>
        {busy ? "Aguarde…" : "Ir para o pagamento"}
      </button>
      <p style={{ fontSize: 12, color: P.gray600 }}>Você será levado à página segura do Asaas para pagar com Pix ou cartão.</p>
    </form>
  );
}
```

Ajuste do teste: `screen.getByText(/Total/)` acha o `<span>Total</span>`; o `parentElement` é a linha com o valor. Se `formatCpf`/`formatCep` devolverem string vazia para entrada parcial, o `|| e.target.value` preserva o que foi digitado.

- [ ] **Step 7: Página** — `apps/azpetshop/app/checkout/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCategories } from "@mypet/core/catalog";
import { SiteNav } from "@mypet/core/components/site-nav";
import { checkoutOptions } from "@mypet/core/features";
import { clientConfig } from "@/client.config";
import { CheckoutForm } from "./checkout-form";

const { palette: PALETTE } = clientConfig;

export const metadata = { title: `Finalizar compra — ${clientConfig.name}`, robots: { index: false } };

export default async function CheckoutPage() {
  if (!checkoutOptions(clientConfig.features).online) redirect("/cotacao");
  const categories = await getCategories();
  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        .cta-primary { background: ${PALETTE.pink}; color: #fff; border: none; border-radius: 100px; padding: 10px 22px; font-size: 14px; font-weight: 800; cursor: pointer; }
        .cta-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
      <SiteNav categories={categories} audienceLabel={null} />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        <Link href="/cotacao" style={{ color: PALETTE.gray600, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>← Voltar ao carrinho</Link>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, margin: "16px 0 20px" }}>Finalizar compra</h1>
        <CheckoutForm />
      </main>
    </div>
  );
}
```

Confira em `node_modules/next/dist/docs/` se `redirect` em server component segue igual nesta versão.

- [ ] **Step 8: Run tests and build**

Run: `pnpm --filter azpetshop test && pnpm --filter azpetshop build`
Expected: PASS e build ok.

- [ ] **Step 9: Commit**

```bash
git add apps/azpetshop/app/checkout
git commit -m "feat(azpetshop): página de checkout com CEP, frete e ida ao pagamento"
```

---

### Task 11: Botões do carrinho por modo e página do pedido

**Files:**
- Modify: `apps/azpetshop/app/cotacao/cotacao-content.tsx`
- Create: `apps/azpetshop/app/cotacao/cotacao-content.test.tsx`
- Create: `apps/azpetshop/app/pedido/[id]/page.tsx`

**Interfaces:**
- Consumes: `checkoutOptions` (Task 1); `getRetailOrder`, `RetailOrderView` (Task 9); `RETAIL_STATUS_LABEL` (Task 6); `getHubServiceClient`.
- Produces: `CotacaoContent` aceita prop `checkout: { online: boolean; whatsapp: boolean }`.

- [ ] **Step 1: Teste** — `apps/azpetshop/app/cotacao/cotacao-content.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ finalizeQuote: vi.fn() }));
vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({
    cart: { items: [{ id: "a", name: "Shampoo", sku: "S", brand: null, img: "/s.jpg", qty: 1, unitPrice: 25 }] },
    removeItem: vi.fn(), updateQty: vi.fn(), clear: vi.fn(),
  }),
}));

import { CotacaoContent } from "./cotacao-content";
import { clientConfig } from "@/client.config";

describe("CotacaoContent — modos de finalização", () => {
  it("ambos: mostra Pagar agora e o formulário do WhatsApp", () => {
    render(<CotacaoContent palette={clientConfig.palette} checkout={{ online: true, whatsapp: true }} />);
    expect(screen.getByRole("link", { name: "Pagar agora" })).toHaveAttribute("href", "/checkout");
    expect(screen.getByRole("button", { name: /WhatsApp/ })).toBeInTheDocument();
  });

  it("whatsapp: sem Pagar agora", () => {
    render(<CotacaoContent palette={clientConfig.palette} checkout={{ online: false, whatsapp: true }} />);
    expect(screen.queryByRole("link", { name: "Pagar agora" })).toBeNull();
  });

  it("online: sem formulário do WhatsApp", () => {
    render(<CotacaoContent palette={clientConfig.palette} checkout={{ online: true, whatsapp: false }} />);
    expect(screen.getByRole("link", { name: "Pagar agora" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /WhatsApp/ })).toBeNull();
  });
});
```

Antes de rodar, leia `cotacao-content.tsx` inteiro e confirme o texto do botão de envio do formulário WhatsApp; se não contiver "WhatsApp", troque o regex do teste pelo texto real (não mude a copy existente).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter azpetshop exec vitest run app/cotacao/cotacao-content.test.tsx`
Expected: FAIL — "Pagar agora" ausente.

- [ ] **Step 3: Implementar** — em `cotacao-content.tsx`:
  - Assinatura: `export function CotacaoContent({ palette: PALETTE, checkout }: { palette: Palette; checkout: { online: boolean; whatsapp: boolean } })`.
  - Logo após a lista de itens do carrinho (antes do formulário de nome/WhatsApp), quando `checkout.online`:

```tsx
      {checkout.online && (
        <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 20, marginBottom: 24, display: "grid", gap: 8 }}>
          <Link href="/checkout" className="cta-primary" style={{ textDecoration: "none", textAlign: "center", padding: "14px 22px", fontSize: 16 }}>
            Pagar agora
          </Link>
          <p style={{ fontSize: 13, color: PALETTE.gray600, textAlign: "center" }}>Pix ou cartão, com frete calculado pelo CEP.</p>
        </div>
      )}
```

  - Envolva o formulário de nome/WhatsApp existente em `{checkout.whatsapp && ( … )}`; quando `checkout.online && checkout.whatsapp`, mostre antes dele um título curto `<p style={{ fontSize: 14, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>Prefere finalizar pelo WhatsApp?</p>`.
  - Em `apps/azpetshop/app/cotacao/page.tsx`, importe `checkoutOptions` de `@mypet/core/features` e passe `checkout={checkoutOptions(clientConfig.features)}`.

- [ ] **Step 4: Página do pedido** — `apps/azpetshop/app/pedido/[id]/page.tsx` (siga o padrão de `params: Promise<…>` de `app/produtos/[id]/page.tsx`; `searchParams` também é `Promise` — confira em `node_modules/next/dist/docs/`):

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories } from "@mypet/core/catalog";
import { SiteNav } from "@mypet/core/components/site-nav";
import { formatBRL } from "@mypet/core/catalog-utils";
import { formatCep } from "@mypet/core/br-validation";
import { getHubServiceClient } from "@mypet/core/supabase";
import { getRetailOrder } from "@mypet/core/retail-orders-server";
import { RETAIL_STATUS_LABEL, type RetailOrderStatus } from "@mypet/core/retail-order-status";
import { clientConfig } from "@/client.config";

const { palette: P } = clientConfig;

export const metadata = { title: `Seu pedido — ${clientConfig.name}`, robots: { index: false } };

export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  const token = Array.isArray(t) ? t[0] : t;
  const order = await getRetailOrder(getHubServiceClient(), id, token ?? "");
  if (!order) notFound();
  const categories = await getCategories();
  const label = RETAIL_STATUS_LABEL[order.status as RetailOrderStatus] ?? order.status;

  return (
    <div style={{ background: P.gray50, minHeight: "100vh", color: P.gray800 }}>
      <SiteNav categories={categories} audienceLabel={null} />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 24, display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: P.navy }}>Pedido {order.number}</h1>
        <p style={{ fontSize: 16, fontWeight: 800 }}>{label}</p>
        {order.status === "aguardando_pagamento" && order.paymentUrl && (
          <p>
            Ainda não recebemos a confirmação do pagamento. Se você já pagou, ela chega em instantes.{" "}
            <a href={order.paymentUrl}>Voltar ao pagamento</a>
          </p>
        )}
        {order.status === "expirado" && <p>O prazo para pagar terminou e nada foi cobrado. <Link href="/cotacao">Fazer o pedido de novo</Link></p>}
        <section style={{ background: P.white, border: `1px solid ${P.gray200}`, borderRadius: 12, padding: 16, display: "grid", gap: 6 }}>
          {order.items.map((i) => (
            <div key={i.name} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{i.qty}x {i.name}</span><span>{formatBRL(i.unitPrice * i.qty)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Frete</span><span>{formatBRL(order.shippingPrice)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900 }}><span>Total</span><span>{formatBRL(order.total)}</span></div>
        </section>
        {order.shipping && (
          <section style={{ fontSize: 14, lineHeight: 1.6 }}>
            <b>Entrega:</b> {[order.shipping.logradouro, order.shipping.numero, order.shipping.complemento].filter(Boolean).join(", ")} — {order.shipping.bairro}, {order.shipping.cidade}/{order.shipping.uf} — CEP {formatCep(order.shipping.cep)}
            <br />
            {order.shipping.serviceName}{order.shipping.deliveryDays ? `, até ${order.shipping.deliveryDays} dias úteis após a confirmação do pagamento` : ""}
            {order.shipping.trackingCode && (<><br /><b>Rastreio:</b> {order.shipping.trackingCode}</>)}
          </section>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Run tests and build**

Run: `pnpm --filter azpetshop test && pnpm --filter azpetshop build`
Expected: PASS e build ok (`/pedido/[id]` e `/checkout` dinâmicos).

- [ ] **Step 6: Commit**

```bash
git add apps/azpetshop/app/cotacao apps/azpetshop/app/pedido
git commit -m "feat(azpetshop): carrinho com Pagar agora e WhatsApp, e página do pedido"
```

---

### Task 12: Varejo no admin (status, canal, entrega, pagamento, rastreio)

**Files:**
- Modify: `apps/admin/lib/orders.ts`, `apps/admin/lib/orders.test.ts`
- Modify: `apps/admin/app/(dashboard)/pedidos/page.tsx`, `apps/admin/app/(dashboard)/pedidos/actions.ts`
- Create: `apps/admin/app/(dashboard)/pedidos/shipping-form.tsx`

**Interfaces:**
- Consumes: `RETAIL_ORDER_STATUSES`, `RETAIL_STATUS_LABEL` (Task 6).
- Produces:
  - `ORDER_STATUSES` passa a incluir `aguardando_pagamento`, `pago`, `enviado`, `expirado` (ordem: `pendente`, `confirmado`, `aguardando_pagamento`, `pago`, `enviado`, `entregue`, `cancelado`, `expirado`)
  - `ORDERS_SELECT` inclui `customer_email, customer_cpf, total, shipping_price, order_shipping(cep, logradouro, numero, complemento, bairro, cidade, uf, service_name, price, tracking_code, shipped_at), order_payments(status, checkout_url)`
  - `OrderRow` ganha esses campos (opcionais/nulos)
  - `orderTotal(order)` usa `order.total` quando não nulo
  - server action `markOrderShipped(formData)` (campos `orderId`, `trackingCode`): grava `order_shipping.tracking_code`/`shipped_at`, `orders.status = 'enviado'`

- [ ] **Step 1: Teste** — acrescente a `apps/admin/lib/orders.test.ts`:

```ts
describe("pedidos de varejo", () => {
  it("ORDER_STATUSES inclui os status do varejo", () => {
    expect(ORDER_STATUSES).toEqual(["pendente", "confirmado", "aguardando_pagamento", "pago", "enviado", "entregue", "cancelado", "expirado"]);
  });

  it("orderTotal usa o total gravado (com frete) quando existe", () => {
    const order = { order_items: [{ product_id: "p", product_name_snapshot: "x", qty: 2, unit_price: "25.00" }], total: "70.00" } as unknown as OrderRow;
    expect(orderTotal(order)).toBe(70);
  });
});
```

(Inclua `ORDER_STATUSES`, `orderTotal`, `OrderRow` no import se faltar.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter admin exec vitest run lib/orders.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `lib/orders.ts`** — troque `ORDER_STATUSES` pela lista acima; amplie `ORDERS_SELECT`:

```ts
export const ORDERS_SELECT =
  "id, number, channel, status, created_at, customer_name, customer_company, customer_whatsapp, customer_cnpj, " +
  "customer_email, customer_cpf, total, shipping_price, " +
  "buyers(nome, empresa, whatsapp, cnpj), order_items(product_id, product_name_snapshot, qty, unit_price), " +
  "order_shipping(cep, logradouro, numero, complemento, bairro, cidade, uf, service_name, price, tracking_code, shipped_at), " +
  "order_payments(status, checkout_url)";
```

Em `OrderRow`, acrescente:

```ts
  customer_email?: string | null;
  customer_cpf?: string | null;
  total?: number | string | null;
  shipping_price?: number | string | null;
  order_shipping?: {
    cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string;
    service_name: string; price: number | string; tracking_code: string | null; shipped_at: string | null;
  } | null;
  order_payments?: { status: string; checkout_url: string | null } | null;
```

No início de `orderTotal`:

```ts
  if (order.total !== null && order.total !== undefined && order.total !== "") {
    const gravado = Number(order.total);
    if (Number.isFinite(gravado)) return gravado;
  }
```

Run: `pnpm --filter admin exec vitest run lib/orders.test.ts` → PASS.

- [ ] **Step 4: Action de envio** — em `apps/admin/app/(dashboard)/pedidos/actions.ts`, siga o padrão de `updateOrderStatus` (mesma sessão `requireAdminSession`, mesmo `revalidatePath` que ela usa) e acrescente:

```ts
const shippedSchema = z.object({ orderId: z.string().uuid(), trackingCode: z.string().trim().min(4).max(60) });

export async function markOrderShipped(formData: FormData) {
  const parsed = shippedSchema.safeParse({ orderId: formData.get("orderId"), trackingCode: formData.get("trackingCode") });
  if (!parsed.success) return;
  const { supabase } = await requireAdminSession();
  const now = new Date().toISOString();
  const { error: shipError } = await supabase
    .from("order_shipping")
    .update({ tracking_code: parsed.data.trackingCode, shipped_at: now })
    .eq("order_id", parsed.data.orderId);
  if (shipError) {
    console.error("[admin/pedidos] erro ao gravar rastreio:", shipError.message);
    return;
  }
  const { error } = await supabase.from("orders").update({ status: "enviado", updated_at: now }).eq("id", parsed.data.orderId);
  if (error) console.error("[admin/pedidos] erro ao marcar enviado:", error.message);
  revalidatePath("/pedidos");
}
```

O e-mail de "pedido enviado" ao cliente **não** sai do admin nesta fase (o admin não tem SMTP nem o token do pedido); registre como pendência no relatório. O cliente vê o rastreio na página do pedido.

- [ ] **Step 5: Formulário de rastreio** — `apps/admin/app/(dashboard)/pedidos/shipping-form.tsx`:

```tsx
export function ShippingForm({ orderId, action }: { orderId: string; action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="mt-2 flex gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input name="trackingCode" placeholder="Código de rastreio" className="rounded border border-slate-300 px-2 py-1 text-xs" required minLength={4} />
      <button type="submit" className="rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white">Marcar enviado</button>
    </form>
  );
}
```

- [ ] **Step 6: Página** — em `apps/admin/app/(dashboard)/pedidos/page.tsx`:
  - `CHANNEL_LABEL` ganha `azpetshop: "AZ Pet Shop"`, e o `<select name="channel">` ganha `<option value="azpetshop">AZ Pet Shop</option>`.
  - As opções do filtro de status mostram `RETAIL_STATUS_LABEL[s as RetailOrderStatus] ?? s` (import de `@mypet/core/retail-order-status`).
  - Na linha do pedido, quando `order.order_shipping` existir, mostre abaixo do cliente: endereço em uma linha, `service_name` e preço do frete, `customer_email` e o status do pagamento (`order_payments?.status`); se `order.status === "pago"`, renderize `<ShippingForm orderId={order.id} action={markOrderShipped} />`; se houver `tracking_code`, mostre-o.
  - Leia a página inteira antes de editar e mantenha o estilo de tabela existente.

- [ ] **Step 7: Run tests and build**

Run: `pnpm --filter admin test && pnpm --filter admin build`
Expected: PASS e build ok.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/lib/orders.ts apps/admin/lib/orders.test.ts "apps/admin/app/(dashboard)/pedidos"
git commit -m "feat(admin): pedidos de varejo com entrega, pagamento e rastreio"
```

---

### Task 13: Verificação final e teste ponta a ponta em sandbox

**Files:**
- Modify: `docs/superpowers/specs/2026-11-01-azpetshop-google-shopping-design.md` (seção "Pendências em aberto")

- [ ] **Step 1: Suítes e builds**

Run: `pnpm test && pnpm --filter admin test && pnpm --filter azpetshop build && pnpm --filter admin build`
Expected: tudo PASS; builds ok.

- [ ] **Step 2: Regressão dos outros sites** — confirme que `SITES` dos outros 4 sites está em `checkout: "whatsapp"` e que `apps/mypet`, `apps/distribuidora`, `apps/madpet`, `apps/distribuidora-instagram` não importam nada novo: `grep -rn "checkout\|retail-checkout" apps/mypet apps/distribuidora apps/madpet apps/distribuidora-instagram --include=*.ts --include=*.tsx | grep -v node_modules` (esperado: nenhuma ocorrência nova além das já existentes antes desta fase; compare com `git stash`-free `git diff --stat main@{1}` se precisar).

- [ ] **Step 3: Ponta a ponta em sandbox** (precisa dos pré-requisitos externos 1–4; sem eles, pule e registre):
  1. `.env.local` da azpetshop com as chaves sandbox; `pnpm --filter azpetshop dev`.
  2. Para o webhook chegar no ambiente local, use um deploy de preview (ou túnel) e cadastre a URL `/api/webhooks/asaas` no Asaas sandbox com o token.
  3. Adicione 1 produto com preço e estoque → `/cotacao` mostra "Pagar agora" e o formulário do WhatsApp → `/checkout` → CEP → frete → "Ir para o pagamento" → página do Asaas → pague com Pix sandbox.
  4. Confira: pedido `pago` no admin, `stock_qty` baixou, e-mails da equipe e do cliente chegaram, `/pedido/[id]?t=…` mostra "Pagamento confirmado".
  5. Repita deixando expirar (ou cancele) → status `expirado`/`cancelado`, estoque intacto.
  6. Reenvie o mesmo evento pelo painel do Asaas → resposta "duplicado", nada muda.
  7. Marque enviado no admin com um código → `/pedido/[id]` mostra o rastreio.
  8. Confira no painel do Asaas se o parcelamento está configurado **sem juros** para o cliente (política de pagamento promete isso).

- [ ] **Step 4: Atualizar pendências** — na seção "Pendências em aberto" da spec, marque `[x]` o item da Fase 2 e acrescente:

```markdown
- [ ] **Aviso de pedido por WhatsApp para a equipe** (fase 2 entregou só e-mail; falta API de WhatsApp).
- [ ] **E-mail "pedido enviado" ao cliente** a partir do admin (hoje o rastreio aparece só na página do pedido).
- [ ] **Teste ponta a ponta em sandbox** (Task 13 da fase 2), se não foi feito.
- [ ] **Credenciais de produção** do Asaas e Melhor Envio, webhook de produção e `SITE_URL` no projeto Vercel.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-11-01-azpetshop-google-shopping-design.md
git commit -m "docs: pendências após a fase 2 do checkout azpetshop"
```
