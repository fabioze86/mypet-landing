# Avaliações de produtos (reviews) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que lojistas com pedido `entregue` avaliem (nota 1-5 + comentário + foto opcional) cada produto comprado via link por e-mail, com moderação no admin antes de aparecer na PDP.

**Architecture:** Quando o admin muda o status de um pedido para `entregue`, gera-se um token de acesso (`review_invite_tokens`) e dispara-se um e-mail via Resend (API HTTP direta) com link `/avaliar/{token}`. Essa rota pública (sem exigir sessão, em `mypet` e `distribuidora`) valida o token e lista os itens do pedido pendentes de avaliação; ao enviar, grava `product_reviews` com `status: "pendente"`. O admin modera (aprova/rejeita) numa nova seção `/avaliacoes`. A PDP mostra nota média + comentários das reviews `aprovado` do produto. Toda a lógica de dados fica em `packages/core` (padrão `*-server.ts` sem `"use server"`), consumida por server actions finas em cada app — mesmo padrão de `orders-server.ts`/`buyers-server.ts`.

**Tech Stack:** Next.js 16 (App Router), React 19, `@supabase/supabase-js`, Resend (API HTTP via `fetch`, sem SDK novo — mesmo estilo de `cloudflare-images.ts`), Cloudflare Images (upload de foto), Vitest, Zod.

## Global Constraints

- Sem WhatsApp Business API — convite sai por e-mail (Resend), nunca por WhatsApp automático.
- `azpetshop` fica fora de escopo (sem fluxo de pedido/carrinho).
- 1 avaliação por item de pedido (`order_item_id` único em `product_reviews`) — sem reenvio.
- Toda avaliação nasce `status: "pendente"` — nunca aparece na PDP sem aprovação manual no admin.
- No máximo 1 foto por avaliação, upload via Cloudflare Images, campo opcional.
- Nunca prefixar credenciais secretas (`RESEND_API_KEY`, `CLOUDFLARE_API_TOKEN`) com `NEXT_PUBLIC_`.
- Todo texto de UI em português, seguindo o tom dos formulários existentes (`complete-signup-form.tsx`, `cotacao-content.tsx`).
- Lógica de dados testável fica em `packages/core`/`apps/admin/lib` (funções puras, sem `"use server"`); a cola em `actions.ts`/`page.tsx` (Next.js server actions e componentes de servidor) não tem teste unitário dedicado — mesmo padrão já usado em `pedidos/actions.ts`, verificada manualmente.

---

## Task 1: Schema no Supabase (`product_reviews`, `review_invite_tokens`)

Schema do `hub_catalogo` é gerenciado fora deste repositório (SQL Editor do painel Supabase) — não há pasta de migrations no repo, mesmo padrão da spec de identidade/pedidos.

**Files:**
- Nenhum arquivo de código neste repositório é criado nesta tarefa.

**Interfaces:**
- Produces: tabelas `product_reviews(id, order_id, order_item_id, product_id, buyer_id, rating, comment, photo_url, status, created_at, moderated_at)` e `review_invite_tokens(id, order_id, token, expires_at, created_at)`, consumidas por todas as tarefas seguintes.

- [ ] **Step 1: Executar o script SQL abaixo no SQL Editor do Supabase (projeto `hub_catalogo`)**

```sql
create table review_invite_tokens (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  token         text not null unique,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index review_invite_tokens_order_id_idx on review_invite_tokens(order_id);

create table product_reviews (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  order_item_id   uuid not null unique references order_items(id) on delete cascade,
  product_id      uuid not null references products(id),
  buyer_id        uuid not null references buyers(id) on delete cascade,
  rating          smallint not null check (rating between 1 and 5),
  comment         text,
  photo_url       text,
  status          text not null default 'pendente'
                    check (status in ('pendente', 'aprovado', 'rejeitado')),
  created_at      timestamptz not null default now(),
  moderated_at    timestamptz
);

create index product_reviews_product_id_idx on product_reviews(product_id);
create index product_reviews_status_idx on product_reviews(status);

alter table review_invite_tokens enable row level security;
alter table product_reviews enable row level security;

-- O token é o segredo (UUID não-adivinhável), então liberar select público
-- por token/order_id é o mesmo modelo de segurança do magic link.
create policy "review_invite_tokens_select_public" on review_invite_tokens
  for select using (expires_at > now());

-- Leitura pública dos itens/pedido associados a um token válido e não
-- expirado, pra montar a tela de avaliação sem exigir sessão.
create policy "orders_select_by_valid_token" on orders
  for select using (
    exists (
      select 1 from review_invite_tokens t
      where t.order_id = orders.id and t.expires_at > now()
    )
  );
create policy "order_items_select_by_valid_token" on order_items
  for select using (
    exists (
      select 1 from review_invite_tokens t
      where t.order_id = order_items.order_id and t.expires_at > now()
    )
  );

-- Avaliações aprovadas são públicas (PDP); inserir exige um token válido
-- apontando pro mesmo pedido do item avaliado.
create policy "product_reviews_select_approved" on product_reviews
  for select using (status = 'aprovado');
create policy "product_reviews_insert_by_valid_token" on product_reviews
  for insert with check (
    exists (
      select 1 from review_invite_tokens t
      where t.order_id = product_reviews.order_id and t.expires_at > now()
    )
  );

-- Admin (apps/admin, admin_users) enxerga e modera tudo — mesmo padrão já
-- usado em orders_admin_all/order_items_admin_all.
create policy "product_reviews_admin_all" on product_reviews
  for all using (exists (select 1 from admin_users where admin_users.id = auth.uid()));
create policy "review_invite_tokens_admin_all" on review_invite_tokens
  for all using (exists (select 1 from admin_users where admin_users.id = auth.uid()));
```

- [ ] **Step 2: Verificar que as tabelas existem**

No SQL Editor, rodar:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('product_reviews', 'review_invite_tokens');
```

Esperado: as duas linhas retornam.

---

## Task 2: Mover upload de imagem pro Cloudflare Images para `packages/core`

Hoje `uploadImageToCloudflare` só existe em `apps/admin/lib/cloudflare-images.ts` (usado pelos banners de marketing). O formulário de avaliação (Task 10) roda em `mypet`/`distribuidora`, que não importam nada de `apps/admin` — a função precisa ficar em `packages/core` pra ser reaproveitada nos três apps.

**Files:**
- Create: `packages/core/src/cloudflare-images.ts`
- Create: `packages/core/src/cloudflare-images.test.ts`
- Modify: `packages/core/package.json` (adicionar entrada no `exports`)
- Modify: `apps/admin/app/(dashboard)/marketing/banners/actions.ts` (import atualizado)
- Delete: `apps/admin/lib/cloudflare-images.ts`
- Delete: `apps/admin/lib/cloudflare-images.test.ts`

**Interfaces:**
- Produces: `uploadImageToCloudflare(file: File): Promise<{ url: string } | { error: string }>`, exportado como `@mypet/core/cloudflare-images`. Consumido pela Task 10.

- [ ] **Step 1: Criar o arquivo movido em `packages/core/src/cloudflare-images.ts`**

```typescript
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

- [ ] **Step 2: Criar o teste movido em `packages/core/src/cloudflare-images.test.ts`**

```typescript
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { uploadImageToCloudflare } from "./cloudflare-images";

const file = new File(["conteudo"], "avaliacao.jpg", { type: "image/jpeg" });

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

- [ ] **Step 3: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @mypet/core test`
Expected: PASS (inclui os 3 testes de `cloudflare-images.test.ts`)

- [ ] **Step 4: Adicionar a entrada no `exports` de `packages/core/package.json`**

Em `packages/core/package.json`, dentro do bloco `"exports"`, adicionar (ordem alfabética, entre `"./channels"` e `"./components/*"`):

```json
    "./cloudflare-images": "./src/cloudflare-images.ts",
```

- [ ] **Step 5: Atualizar o import em `apps/admin/app/(dashboard)/marketing/banners/actions.ts`**

Trocar:

```typescript
import { uploadImageToCloudflare } from "@/lib/cloudflare-images";
```

Por:

```typescript
import { uploadImageToCloudflare } from "@mypet/core/cloudflare-images";
```

- [ ] **Step 6: Remover os arquivos antigos**

```bash
rm apps/admin/lib/cloudflare-images.ts apps/admin/lib/cloudflare-images.test.ts
```

- [ ] **Step 7: Rodar os testes do admin e confirmar que passam**

Run: `pnpm --filter admin test`
Expected: PASS (sem erros de import quebrado; nenhum teste de `cloudflare-images` sobra no admin)

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/cloudflare-images.ts packages/core/src/cloudflare-images.test.ts packages/core/package.json apps/admin/app/\(dashboard\)/marketing/banners/actions.ts apps/admin/lib/cloudflare-images.ts apps/admin/lib/cloudflare-images.test.ts
git commit -m "refactor(core): move upload do Cloudflare Images pra packages/core"
```

---

## Task 3: `channelDomain()` em `packages/core/src/channels.ts`

O e-mail de convite (Task 5) precisa montar o link `https://{domínio do canal}/avaliar/{token}`. Os domínios já existem em cada `client.config.ts` (`apps/mypet/client.config.ts`: `mypetbrasil.com.br`; `apps/distribuidora/client.config.ts`: `www.distribuidorapetshop.com.br`), mas a função que dispara o convite roda em `apps/admin`, que não importa `client.config.ts` de outros apps — precisa de um mapa próprio em `packages/core`.

**Files:**
- Modify: `packages/core/src/channels.ts`
- Modify: `packages/core/src/channels.test.ts`

**Interfaces:**
- Consumes: `Channel` (já existente em `channels.ts`).
- Produces: `channelDomain(channel: Channel): string`. Consumido pela Task 7.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `packages/core/src/channels.test.ts`:

```typescript
import { channelDomain } from "./channels";

describe("channelDomain", () => {
  it("retorna o domínio de cada canal com fluxo de pedidos", () => {
    expect(channelDomain("mypetbrasil")).toBe("mypetbrasil.com.br");
    expect(channelDomain("distribuidora")).toBe("www.distribuidorapetshop.com.br");
  });

  it("lança erro para um canal sem domínio mapeado", () => {
    expect(() => channelDomain("azpetshop")).toThrow("Canal sem domínio mapeado: azpetshop");
  });
});
```

Atualizar o import do topo do arquivo de `import { CHANNELS, isChannel } from "./channels";` para `import { CHANNELS, isChannel, channelDomain } from "./channels";`.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @mypet/core test -- channels`
Expected: FAIL com "channelDomain is not a function" ou erro de import

- [ ] **Step 3: Implementar `channelDomain` em `packages/core/src/channels.ts`**

Adicionar ao final do arquivo:

```typescript
const CHANNEL_DOMAINS: Partial<Record<Channel, string>> = {
  mypetbrasil: "mypetbrasil.com.br",
  distribuidora: "www.distribuidorapetshop.com.br",
};

export function channelDomain(channel: Channel): string {
  const domain = CHANNEL_DOMAINS[channel];
  if (!domain) {
    throw new Error(`Canal sem domínio mapeado: ${channel}`);
  }
  return domain;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @mypet/core test -- channels`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/channels.ts packages/core/src/channels.test.ts
git commit -m "feat(core): adiciona channelDomain pra montar links de convite de avaliação"
```

---

## Task 4: `createReviewInviteToken` em `packages/core/src/review-invites-server.ts`

**Files:**
- Create: `packages/core/src/review-invites-server.ts`
- Create: `packages/core/src/review-invites-server.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient` (`@supabase/supabase-js`).
- Produces: `createReviewInviteToken(supabase: SupabaseClient, orderId: string): Promise<{ token: string | null; error: string | null }>`. Consumido pela Task 7.

- [ ] **Step 1: Escrever o teste que falha**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createReviewInviteToken } from "./review-invites-server";

describe("createReviewInviteToken", () => {
  it("gera um token, grava com expiração de 30 dias e retorna o token", async () => {
    const insert = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const single = vi.fn().mockResolvedValue({ data: { token: "abc123" }, error: null });

    const supabase = {
      from: vi.fn(() => ({ insert, select, single })),
    } as unknown as SupabaseClient;

    const result = await createReviewInviteToken(supabase, "order-1");

    expect(supabase.from).toHaveBeenCalledWith("review_invite_tokens");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: "order-1",
        token: expect.any(String),
        expires_at: expect.any(String),
      }),
    );
    expect(result).toEqual({ token: "abc123", error: null });
  });

  it("retorna erro genérico quando a gravação falha", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "conexão recusada" } }),
      })),
    } as unknown as SupabaseClient;

    const result = await createReviewInviteToken(supabase, "order-1");
    expect(result).toEqual({ token: null, error: "Não foi possível gerar o convite de avaliação." });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @mypet/core test -- review-invites-server`
Expected: FAIL com "Cannot find module './review-invites-server'"

- [ ] **Step 3: Implementar `createReviewInviteToken`**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function createReviewInviteToken(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ token: string | null; error: string | null }> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();

  const { data, error } = await supabase
    .from("review_invite_tokens")
    .insert({ order_id: orderId, token, expires_at: expiresAt })
    .select("token")
    .single();

  if (error || !data) {
    console.error("[review-invites] erro ao gerar token de convite:", error?.message);
    return { token: null, error: "Não foi possível gerar o convite de avaliação." };
  }

  return { token: data.token as string, error: null };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @mypet/core test -- review-invites-server`
Expected: PASS

- [ ] **Step 5: Adicionar a entrada no `exports` de `packages/core/package.json`**

Entre `"./querystring"` e `"./seo"`:

```json
    "./review-invites-server": "./src/review-invites-server.ts",
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/review-invites-server.ts packages/core/src/review-invites-server.test.ts packages/core/package.json
git commit -m "feat(core): adiciona createReviewInviteToken"
```

---

## Task 5: `sendReviewInviteEmail` em `packages/core/src/review-invites-server.ts`

**Files:**
- Modify: `packages/core/src/review-invites-server.ts`
- Modify: `packages/core/src/review-invites-server.test.ts`

**Interfaces:**
- Consumes: nenhuma dependência de tasks anteriores além do arquivo já criado na Task 4.
- Produces: `sendReviewInviteEmail(input: { to: string; token: string; domain: string }): Promise<{ error: string | null }>`. Consumido pela Task 7.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `packages/core/src/review-invites-server.test.ts`:

```typescript
import { sendReviewInviteEmail } from "./review-invites-server";

describe("sendReviewInviteEmail", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_123";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
  });

  it("chama a API do Resend com o link de avaliação correto", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "email-1" }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendReviewInviteEmail({ to: "lojista@example.com", token: "tok-1", domain: "mypetbrasil.com.br" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer re_test_123" }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.to).toEqual(["lojista@example.com"]);
    expect(body.html).toContain("https://mypetbrasil.com.br/avaliar/tok-1");
    expect(result).toEqual({ error: null });
  });

  it("retorna erro quando falta RESEND_API_KEY", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendReviewInviteEmail({ to: "lojista@example.com", token: "tok-1", domain: "mypetbrasil.com.br" });
    expect(result).toEqual({ error: expect.stringContaining("RESEND_API_KEY") });
  });

  it("retorna erro genérico quando a API do Resend falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "invalid" }) }));
    const result = await sendReviewInviteEmail({ to: "lojista@example.com", token: "tok-1", domain: "mypetbrasil.com.br" });
    expect(result).toEqual({ error: "Não foi possível enviar o convite de avaliação." });
  });
});
```

Atualizar o import do topo do teste para incluir `beforeEach, afterEach` em `from "vitest"` (já usados no arquivo movido na Task 2 como referência de estilo; aqui é a primeira vez neste arquivo, então adicionar ao import existente `import { describe, it, expect, vi } from "vitest";` → `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";`).

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @mypet/core test -- review-invites-server`
Expected: FAIL com "sendReviewInviteEmail is not a function"

- [ ] **Step 3: Implementar `sendReviewInviteEmail`**

Adicionar ao final de `packages/core/src/review-invites-server.ts`:

```typescript
export async function sendReviewInviteEmail(input: {
  to: string;
  token: string;
  domain: string;
}): Promise<{ error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "Envio de e-mail não está configurado (RESEND_API_KEY)." };
  }

  const link = `https://${input.domain}/avaliar/${input.token}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Avaliações <avaliacoes@${input.domain}>`,
      to: [input.to],
      subject: "Como foi sua compra? Avalie os produtos",
      html: `<p>Seu pedido foi entregue! Conte pra gente como foram os produtos:</p><p><a href="${link}">${link}</a></p>`,
    }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    console.error("[review-invites] erro ao enviar e-mail:", JSON.stringify(json));
    return { error: "Não foi possível enviar o convite de avaliação." };
  }

  return { error: null };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @mypet/core test -- review-invites-server`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/review-invites-server.ts packages/core/src/review-invites-server.test.ts
git commit -m "feat(core): adiciona sendReviewInviteEmail via API do Resend"
```

---

## Task 6: `shouldSendReviewInvite` em `apps/admin/lib/orders.ts`

Regra pura que decide se uma mudança de status deve disparar convite: só quando o novo status é `entregue` e o status anterior não era `entregue`. Extraída como função isolada pra ser testável (a wiring em `actions.ts`, Task 7, não tem teste dedicado).

**Files:**
- Modify: `apps/admin/lib/orders.ts`
- Modify: `apps/admin/lib/orders.test.ts`

**Interfaces:**
- Consumes: `OrderStatus` (já existente em `orders.ts`).
- Produces: `shouldSendReviewInvite(previousStatus: OrderStatus, newStatus: OrderStatus): boolean`. Consumido pela Task 7.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `apps/admin/lib/orders.test.ts`:

```typescript
import { shouldSendReviewInvite } from "./orders";

describe("shouldSendReviewInvite", () => {
  it("dispara convite quando o status muda para entregue", () => {
    expect(shouldSendReviewInvite("confirmado", "entregue")).toBe(true);
  });

  it("não dispara se já estava entregue", () => {
    expect(shouldSendReviewInvite("entregue", "entregue")).toBe(false);
  });

  it("não dispara para outras transições", () => {
    expect(shouldSendReviewInvite("pendente", "confirmado")).toBe(false);
    expect(shouldSendReviewInvite("entregue", "cancelado")).toBe(false);
  });
});
```

Atualizar o import do topo do arquivo para incluir `shouldSendReviewInvite`.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter admin test -- orders`
Expected: FAIL com "shouldSendReviewInvite is not a function"

- [ ] **Step 3: Implementar `shouldSendReviewInvite` em `apps/admin/lib/orders.ts`**

Adicionar ao final do arquivo:

```typescript
export function shouldSendReviewInvite(previousStatus: OrderStatus, newStatus: OrderStatus): boolean {
  return newStatus === "entregue" && previousStatus !== "entregue";
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter admin test -- orders`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/orders.ts apps/admin/lib/orders.test.ts
git commit -m "feat(admin): adiciona shouldSendReviewInvite"
```

---

## Task 7: Disparar convite de avaliação em `updateOrderStatus`

Tarefa de wiring (glue code) — sem teste unitário dedicado, mesmo padrão já usado no resto de `actions.ts` no admin. Verificação é manual (Step 4).

**Files:**
- Modify: `apps/admin/app/(dashboard)/pedidos/actions.ts`

**Interfaces:**
- Consumes: `shouldSendReviewInvite` (Task 6), `createReviewInviteToken`, `sendReviewInviteEmail` (Tasks 4-5), `channelDomain` (Task 3), `isChannel` (já existente em `@mypet/core/channels`).
- Produces: nenhuma interface nova consumida por outras tasks — é o ponto final do fluxo de convite.

- [ ] **Step 1: Reescrever `apps/admin/app/(dashboard)/pedidos/actions.ts`**

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { ORDER_STATUSES, shouldSendReviewInvite } from "@/lib/orders";
import { createReviewInviteToken, sendReviewInviteEmail } from "@mypet/core/review-invites-server";
import { channelDomain, isChannel } from "@mypet/core/channels";

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
});

export async function updateOrderStatus(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = UpdateStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) return;

  const { data: current } = await supabase
    .from("orders")
    .select("status, channel, buyers(email)")
    .eq("id", parsed.data.id)
    .single();

  const { error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("[admin/pedidos] erro ao atualizar status:", error.message);
    return;
  }

  if (current && shouldSendReviewInvite(current.status, parsed.data.status) && isChannel(current.channel)) {
    const buyerEmail = (current.buyers as { email: string } | null)?.email;
    if (buyerEmail) {
      const { token, error: tokenError } = await createReviewInviteToken(supabase, parsed.data.id);
      if (tokenError) {
        console.error("[admin/pedidos] erro ao gerar convite de avaliação:", tokenError);
      } else if (token) {
        const { error: emailError } = await sendReviewInviteEmail({
          to: buyerEmail,
          token,
          domain: channelDomain(current.channel),
        });
        if (emailError) {
          console.error("[admin/pedidos] erro ao enviar convite de avaliação:", emailError);
        }
      }
    }
  }

  revalidatePath("/pedidos");
}
```

- [ ] **Step 2: Rodar os testes do admin e confirmar que nada quebrou**

Run: `pnpm --filter admin test`
Expected: PASS

- [ ] **Step 3: Rodar o build do admin e confirmar que compila**

Run: `pnpm --filter admin build`
Expected: build concluído sem erros de tipo

- [ ] **Step 4: Verificação manual**

Com `RESEND_API_KEY` configurado em `apps/admin/.env.local`: em `/pedidos`, mudar o status de um pedido de teste (com comprador com e-mail válido) para "entregue" e confirmar no dashboard do Resend que o e-mail foi enviado, com link `/avaliar/{token}` válido.

- [ ] **Step 5: Adicionar `RESEND_API_KEY` ao `apps/admin/.env.local.example`**

Em `apps/admin/.env.local.example`, adicionar:

```
RESEND_API_KEY=
```

- [ ] **Step 6: Commit**

```bash
git add "apps/admin/app/(dashboard)/pedidos/actions.ts" apps/admin/.env.local.example
git commit -m "feat(admin): dispara convite de avaliação por e-mail ao marcar pedido como entregue"
```

---

## Task 8: `getReviewInviteToken` e `getOrderItemsForReview` em `packages/core/src/reviews-server.ts`

**Files:**
- Create: `packages/core/src/reviews-server.ts`
- Create: `packages/core/src/reviews-server.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient`.
- Produces:
  - `getReviewInviteToken(supabase: SupabaseClient, token: string): Promise<{ orderId: string } | null>`
  - `type OrderItemForReview = { orderItemId: string; productId: string; name: string; alreadyReviewed: boolean }`
  - `getOrderItemsForReview(supabase: SupabaseClient, orderId: string): Promise<OrderItemForReview[]>`

  Ambas consumidas pelas Tasks 11-12.

- [ ] **Step 1: Escrever o teste que falha**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getReviewInviteToken, getOrderItemsForReview } from "./reviews-server";

describe("getReviewInviteToken", () => {
  it("retorna o order_id quando o token existe e não expirou", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { order_id: "order-1" }, error: null }),
      })),
    } as unknown as SupabaseClient;

    const result = await getReviewInviteToken(supabase, "tok-1");

    expect(supabase.from).toHaveBeenCalledWith("review_invite_tokens");
    expect(result).toEqual({ orderId: "order-1" });
  });

  it("retorna null quando o token não existe ou expirou", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    } as unknown as SupabaseClient;

    const result = await getReviewInviteToken(supabase, "tok-invalido");
    expect(result).toBeNull();
  });
});

describe("getOrderItemsForReview", () => {
  it("mapeia itens do pedido marcando os já avaliados", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "order_items") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: (v: unknown) => void) =>
              resolve({
                data: [
                  { id: "item-1", product_id: "p1", product_name_snapshot: "Ração Premium 15kg" },
                  { id: "item-2", product_id: "p2", product_name_snapshot: "Areia Higiênica" },
                ],
                error: null,
              }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => void) => resolve({ data: [{ order_item_id: "item-1" }], error: null }),
        };
      }),
    } as unknown as SupabaseClient;

    const items = await getOrderItemsForReview(supabase, "order-1");

    expect(items).toEqual([
      { orderItemId: "item-1", productId: "p1", name: "Ração Premium 15kg", alreadyReviewed: true },
      { orderItemId: "item-2", productId: "p2", name: "Areia Higiênica", alreadyReviewed: false },
    ]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @mypet/core test -- reviews-server`
Expected: FAIL com "Cannot find module './reviews-server'"

- [ ] **Step 3: Implementar `packages/core/src/reviews-server.ts`**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getReviewInviteToken(
  supabase: SupabaseClient,
  token: string
): Promise<{ orderId: string } | null> {
  const { data, error } = await supabase
    .from("review_invite_tokens")
    .select("order_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return { orderId: data.order_id as string };
}

export type OrderItemForReview = {
  orderItemId: string;
  productId: string;
  name: string;
  alreadyReviewed: boolean;
};

type RawOrderItemRow = {
  id: string;
  product_id: string;
  product_name_snapshot: string;
};

export async function getOrderItemsForReview(
  supabase: SupabaseClient,
  orderId: string
): Promise<OrderItemForReview[]> {
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, product_id, product_name_snapshot")
    .eq("order_id", orderId);

  if (itemsError || !items) {
    console.error("[reviews] erro ao buscar itens do pedido:", itemsError?.message);
    return [];
  }

  const { data: reviewed, error: reviewedError } = await supabase
    .from("product_reviews")
    .select("order_item_id")
    .eq("order_id", orderId);

  if (reviewedError) {
    console.error("[reviews] erro ao buscar avaliações existentes:", reviewedError.message);
  }

  const reviewedIds = new Set(((reviewed ?? []) as { order_item_id: string }[]).map((r) => r.order_item_id));

  return (items as RawOrderItemRow[]).map((item) => ({
    orderItemId: item.id,
    productId: item.product_id,
    name: item.product_name_snapshot,
    alreadyReviewed: reviewedIds.has(item.id),
  }));
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @mypet/core test -- reviews-server`
Expected: PASS

- [ ] **Step 5: Adicionar a entrada no `exports` de `packages/core/package.json`**

Entre `"./review-invites-server"` e `"./seo"`:

```json
    "./reviews-server": "./src/reviews-server.ts",
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reviews-server.ts packages/core/src/reviews-server.test.ts packages/core/package.json
git commit -m "feat(core): adiciona getReviewInviteToken e getOrderItemsForReview"
```

---

## Task 9: `createProductReview` em `packages/core/src/reviews-server.ts`

**Files:**
- Modify: `packages/core/src/reviews-server.ts`
- Modify: `packages/core/src/reviews-server.test.ts`

**Interfaces:**
- Consumes: nenhuma dependência nova além do arquivo da Task 8.
- Produces: `createProductReview(supabase: SupabaseClient, input: { orderId: string; orderItemId: string; productId: string; buyerId: string; rating: number; comment: string | null; photoUrl: string | null }): Promise<{ error: string | null }>`. Consumido pela Task 11-12.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `packages/core/src/reviews-server.test.ts`:

```typescript
import { createProductReview } from "./reviews-server";

describe("createProductReview", () => {
  const input = {
    orderId: "order-1",
    orderItemId: "item-1",
    productId: "p1",
    buyerId: "buyer-1",
    rating: 5,
    comment: "Ótimo produto",
    photoUrl: null,
  };

  it("grava a avaliação com status pendente", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient;

    const result = await createProductReview(supabase, input);

    expect(supabase.from).toHaveBeenCalledWith("product_reviews");
    expect(insert).toHaveBeenCalledWith({
      order_id: "order-1",
      order_item_id: "item-1",
      product_id: "p1",
      buyer_id: "buyer-1",
      rating: 5,
      comment: "Ótimo produto",
      photo_url: null,
      status: "pendente",
    });
    expect(result).toEqual({ error: null });
  });

  it("retorna erro amigável quando o item já foi avaliado (constraint única)", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: { message: "duplicate key value violates unique constraint" } }),
      })),
    } as unknown as SupabaseClient;

    const result = await createProductReview(supabase, input);
    expect(result).toEqual({ error: "Este item já foi avaliado." });
  });

  it("retorna erro genérico pra outras falhas", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: { message: "conexão recusada" } }),
      })),
    } as unknown as SupabaseClient;

    const result = await createProductReview(supabase, input);
    expect(result).toEqual({ error: "Não foi possível registrar sua avaliação. Tente novamente em instantes." });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @mypet/core test -- reviews-server`
Expected: FAIL com "createProductReview is not a function"

- [ ] **Step 3: Implementar `createProductReview`**

Adicionar ao final de `packages/core/src/reviews-server.ts`:

```typescript
export async function createProductReview(
  supabase: SupabaseClient,
  input: {
    orderId: string;
    orderItemId: string;
    productId: string;
    buyerId: string;
    rating: number;
    comment: string | null;
    photoUrl: string | null;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("product_reviews").insert({
    order_id: input.orderId,
    order_item_id: input.orderItemId,
    product_id: input.productId,
    buyer_id: input.buyerId,
    rating: input.rating,
    comment: input.comment,
    photo_url: input.photoUrl,
    status: "pendente",
  });

  if (error) {
    if (error.message.includes("duplicate key")) {
      return { error: "Este item já foi avaliado." };
    }
    console.error("[reviews] erro ao gravar avaliação:", error.message);
    return { error: "Não foi possível registrar sua avaliação. Tente novamente em instantes." };
  }

  return { error: null };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @mypet/core test -- reviews-server`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/reviews-server.ts packages/core/src/reviews-server.test.ts
git commit -m "feat(core): adiciona createProductReview"
```

---

## Task 10: Componente compartilhado `ReviewForm`

Componente cliente reaproveitado por `mypet` e `distribuidora` (mesmo padrão de `complete-signup-form.tsx`): lista os itens do pedido, mostra os já avaliados como somente leitura, e um formulário (estrelas 1-5, comentário, upload de 1 foto opcional) por item pendente.

**Files:**
- Create: `packages/core/src/components/review-form.tsx`
- Modify: `packages/core/package.json` (adicionar entrada no `exports`, se ainda não coberta pelo padrão `./components/*` já existente)

**Interfaces:**
- Consumes: `OrderItemForReview` (Task 8), `useClientConfig` (já existente em `../theme`), `uploadImageToCloudflare` (Task 2).
- Produces: componente `ReviewForm`, consumido pelas Tasks 11-12.

- [ ] **Step 1: Verificar que `./components/*` já cobre o novo arquivo**

`packages/core/package.json` já tem `"./components/*": "./src/components/*.tsx"` no `exports` — nenhuma mudança de `package.json` necessária nesta task (import final será `@mypet/core/components/review-form`).

- [ ] **Step 2: Criar `packages/core/src/components/review-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useClientConfig } from "../theme";
import { uploadImageToCloudflare } from "../cloudflare-images";
import type { OrderItemForReview } from "../reviews-server";

type SubmitResult = { error: string | null };

export function ReviewForm({
  items,
  submitReview,
}: {
  items: OrderItemForReview[];
  submitReview: (input: {
    orderItemId: string;
    productId: string;
    rating: number;
    comment: string;
    photoUrl: string | null;
  }) => Promise<SubmitResult>;
}) {
  const { palette } = useClientConfig();
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  const pending = items.filter((item) => !item.alreadyReviewed && !submittedIds.has(item.orderItemId));
  const done = items.filter((item) => item.alreadyReviewed || submittedIds.has(item.orderItemId));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {pending.map((item) => (
        <ReviewItemForm
          key={item.orderItemId}
          item={item}
          submitReview={submitReview}
          onSubmitted={() => setSubmittedIds((prev) => new Set(prev).add(item.orderItemId))}
        />
      ))}
      {done.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: palette.navy, marginBottom: 8 }}>Já avaliados</h2>
          <ul style={{ listStyle: "none" }}>
            {done.map((item) => (
              <li key={item.orderItemId} style={{ fontSize: 14, color: palette.gray600, marginBottom: 4 }}>
                {item.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {pending.length === 0 && done.length === 0 && (
        <p style={{ fontSize: 14, color: palette.gray600 }}>Este pedido não tem itens para avaliar.</p>
      )}
    </div>
  );
}

function ReviewItemForm({
  item,
  submitReview,
  onSubmitted,
}: {
  item: OrderItemForReview;
  submitReview: (input: {
    orderItemId: string;
    productId: string;
    rating: number;
    comment: string;
    photoUrl: string | null;
  }) => Promise<SubmitResult>;
  onSubmitted: () => void;
}) {
  const { palette } = useClientConfig();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Selecione uma nota de 1 a 5.");
      return;
    }
    setSubmitting(true);
    setError("");

    let photoUrl: string | null = null;
    if (photo) {
      const uploadResult = await uploadImageToCloudflare(photo);
      if ("error" in uploadResult) {
        setError(uploadResult.error);
        setSubmitting(false);
        return;
      }
      photoUrl = uploadResult.url;
    }

    const result = await submitReview({
      orderItemId: item.orderItemId,
      productId: item.productId,
      rating,
      comment,
      photoUrl,
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    onSubmitted();
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ border: `1px solid ${palette.gray200}`, borderRadius: 16, padding: 20 }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 800, color: palette.navy, marginBottom: 12 }}>{item.name}</h3>

      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 24,
              color: n <= rating ? palette.pink : palette.gray200,
            }}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Conte como foi sua experiência com este produto (opcional)"
        rows={3}
        style={{
          width: "100%",
          padding: 12,
          border: `1.5px solid ${palette.gray200}`,
          borderRadius: 10,
          fontSize: 14,
          marginBottom: 12,
          fontFamily: "inherit",
        }}
      />

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        style={{ marginBottom: 12, fontSize: 13 }}
      />

      {error && <p style={{ color: palette.orange, fontSize: 13, marginBottom: 8 }}>{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        style={{
          background: palette.pink,
          color: palette.white,
          border: "none",
          borderRadius: 10,
          padding: "10px 20px",
          fontWeight: 800,
          fontSize: 14,
          cursor: submitting ? "default" : "pointer",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "Enviando..." : "Enviar avaliação"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Rodar o build do core e confirmar que compila sem erros de tipo**

Run: `pnpm --filter @mypet/core test`
Expected: PASS (sem testes novos nesta task — componente de UI é coberto pela verificação manual das Tasks 11-12)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/components/review-form.tsx
git commit -m "feat(core): adiciona componente compartilhado ReviewForm"
```

---

## Task 11: Rota `/avaliar/[token]` em `mypet`

**Files:**
- Create: `apps/mypet/app/avaliar/[token]/page.tsx`
- Create: `apps/mypet/app/avaliar/[token]/actions.ts`

**Interfaces:**
- Consumes: `getReviewInviteToken`, `getOrderItemsForReview`, `createProductReview` (Tasks 8-9), `ReviewForm` (Task 10), `getHubClient` padrão via `getOrdersByBuyer`-like acesso — aqui usa-se `createServerSupabaseClient`? Não: como a rota é pública (sem sessão), usa `getHubClient()` (mesmo cliente anônimo de `catalog.ts`/`leads-server.ts`).
- Produces: nenhuma interface nova consumida por outras tasks.

- [ ] **Step 1: Criar `apps/mypet/app/avaliar/[token]/actions.ts`**

```typescript
"use server";

import { getHubClient } from "@mypet/core/supabase";
import { getReviewInviteToken, createProductReview } from "@mypet/core/reviews-server";

export async function submitReview(
  token: string,
  input: { orderItemId: string; productId: string; rating: number; comment: string; photoUrl: string | null }
): Promise<{ error: string | null }> {
  const supabase = getHubClient();

  const invite = await getReviewInviteToken(supabase, token);
  if (!invite) {
    return { error: "Link de avaliação inválido ou expirado." };
  }

  const { data: order } = await supabase.from("orders").select("buyer_id").eq("id", invite.orderId).single();
  if (!order) {
    return { error: "Link de avaliação inválido ou expirado." };
  }

  return createProductReview(supabase, {
    orderId: invite.orderId,
    orderItemId: input.orderItemId,
    productId: input.productId,
    buyerId: order.buyer_id as string,
    rating: input.rating,
    comment: input.comment || null,
    photoUrl: input.photoUrl,
  });
}
```

- [ ] **Step 2: Criar `apps/mypet/app/avaliar/[token]/page.tsx`**

```tsx
import { Suspense } from "react";
import { getHubClient } from "@mypet/core/supabase";
import { getReviewInviteToken, getOrderItemsForReview } from "@mypet/core/reviews-server";
import { getCategories } from "@mypet/core/catalog";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { SiteNav } from "@mypet/core/components/site-nav";
import { ReviewForm } from "@mypet/core/components/review-form";
import { clientConfig } from "@/client.config";
import { submitReview } from "./actions";

const { palette: PALETTE } = clientConfig;

async function ReviewInviteContent({ token }: { token: string }) {
  const supabase = getHubClient();
  const invite = await getReviewInviteToken(supabase, token);

  if (!invite) {
    return (
      <main style={{ maxWidth: 520, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: PALETTE.navy, marginBottom: 12 }}>
          Link inválido ou expirado
        </h1>
        <p style={{ fontSize: 14, color: PALETTE.gray600 }}>
          Este link de avaliação não é mais válido. Se você recebeu um convite recente por e-mail, tente
          abrir o link diretamente dele.
        </p>
      </main>
    );
  }

  const items = await getOrderItemsForReview(supabase, invite.orderId);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: PALETTE.navy, marginBottom: 8 }}>
        Avalie sua compra
      </h1>
      <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 24 }}>
        Sua opinião ajuda outros lojistas a escolher os melhores produtos.
      </p>
      <ReviewForm items={items} submitReview={(input) => submitReview(token, input)} />
    </main>
  );
}

export default async function AvaliarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const categories = await getCategories();

  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <LeadGateProvider>
        <SiteNav categories={categories} />
        <Suspense fallback={null}>
          <ReviewInviteContent token={token} />
        </Suspense>
      </LeadGateProvider>
    </div>
  );
}
```

- [ ] **Step 3: Rodar o build do mypet e confirmar que compila**

Run: `pnpm --filter mypet build`
Expected: build concluído sem erros de tipo

- [ ] **Step 4: Verificação manual**

Com um token válido gerado manualmente (`insert into review_invite_tokens ...` no SQL Editor, apontando pra um pedido de teste `entregue`), acessar `/avaliar/{token}` em `http://localhost:3000` (mypet dev server) e confirmar que a lista de itens aparece, o envio funciona e um segundo envio do mesmo item mostra "já avaliado".

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/avaliar
git commit -m "feat(mypet): adiciona rota /avaliar/[token] pra avaliação de pedidos entregues"
```

---

## Task 12: Rota `/avaliar/[token]` em `distribuidora`

Réplica exata da Task 11, adaptada ao app `distribuidora` — mesmo padrão de duplicação de página fina já usado em `/pedidos` e `/entrar` entre os dois apps.

**Files:**
- Create: `apps/distribuidora/app/avaliar/[token]/page.tsx`
- Create: `apps/distribuidora/app/avaliar/[token]/actions.ts`

**Interfaces:**
- Consumes: as mesmas da Task 11.
- Produces: nenhuma interface nova.

- [ ] **Step 1: Criar `apps/distribuidora/app/avaliar/[token]/actions.ts`**

```typescript
"use server";

import { getHubClient } from "@mypet/core/supabase";
import { getReviewInviteToken, createProductReview } from "@mypet/core/reviews-server";

export async function submitReview(
  token: string,
  input: { orderItemId: string; productId: string; rating: number; comment: string; photoUrl: string | null }
): Promise<{ error: string | null }> {
  const supabase = getHubClient();

  const invite = await getReviewInviteToken(supabase, token);
  if (!invite) {
    return { error: "Link de avaliação inválido ou expirado." };
  }

  const { data: order } = await supabase.from("orders").select("buyer_id").eq("id", invite.orderId).single();
  if (!order) {
    return { error: "Link de avaliação inválido ou expirado." };
  }

  return createProductReview(supabase, {
    orderId: invite.orderId,
    orderItemId: input.orderItemId,
    productId: input.productId,
    buyerId: order.buyer_id as string,
    rating: input.rating,
    comment: input.comment || null,
    photoUrl: input.photoUrl,
  });
}
```

- [ ] **Step 2: Criar `apps/distribuidora/app/avaliar/[token]/page.tsx`**

```tsx
import { Suspense } from "react";
import { getHubClient } from "@mypet/core/supabase";
import { getReviewInviteToken, getOrderItemsForReview } from "@mypet/core/reviews-server";
import { getCategories } from "@mypet/core/catalog";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { SiteNav } from "@mypet/core/components/site-nav";
import { ReviewForm } from "@mypet/core/components/review-form";
import { clientConfig } from "@/client.config";
import { submitReview } from "./actions";

const { palette: PALETTE } = clientConfig;

async function ReviewInviteContent({ token }: { token: string }) {
  const supabase = getHubClient();
  const invite = await getReviewInviteToken(supabase, token);

  if (!invite) {
    return (
      <main style={{ maxWidth: 520, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: PALETTE.navy, marginBottom: 12 }}>
          Link inválido ou expirado
        </h1>
        <p style={{ fontSize: 14, color: PALETTE.gray600 }}>
          Este link de avaliação não é mais válido. Se você recebeu um convite recente por e-mail, tente
          abrir o link diretamente dele.
        </p>
      </main>
    );
  }

  const items = await getOrderItemsForReview(supabase, invite.orderId);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: PALETTE.navy, marginBottom: 8 }}>
        Avalie sua compra
      </h1>
      <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 24 }}>
        Sua opinião ajuda outros lojistas a escolher os melhores produtos.
      </p>
      <ReviewForm items={items} submitReview={(input) => submitReview(token, input)} />
    </main>
  );
}

export default async function AvaliarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const categories = await getCategories();

  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <LeadGateProvider>
        <SiteNav categories={categories} />
        <Suspense fallback={null}>
          <ReviewInviteContent token={token} />
        </Suspense>
      </LeadGateProvider>
    </div>
  );
}
```

- [ ] **Step 3: Rodar o build do distribuidora e confirmar que compila**

Run: `pnpm --filter distribuidora build`
Expected: build concluído sem erros de tipo

- [ ] **Step 4: Verificação manual**

Mesmo procedimento do Step 4 da Task 11, com um pedido de teste no canal `distribuidora`.

- [ ] **Step 5: Commit**

```bash
git add apps/distribuidora/app/avaliar
git commit -m "feat(distribuidora): adiciona rota /avaliar/[token] pra avaliação de pedidos entregues"
```

---

## Task 13: `apps/admin/lib/reviews.ts` — tipos e status

**Files:**
- Create: `apps/admin/lib/reviews.ts`
- Create: `apps/admin/lib/reviews.test.ts`

**Interfaces:**
- Produces: `REVIEW_STATUSES = ["pendente", "aprovado", "rejeitado"] as const`, `type ReviewStatus`, `type ReviewRow`. Consumido pela Task 14.

- [ ] **Step 1: Escrever o teste que falha**

```typescript
import { describe, it, expect } from "vitest";
import { REVIEW_STATUSES } from "./reviews";

describe("REVIEW_STATUSES", () => {
  it("contém os três status esperados, pendente primeiro", () => {
    expect(REVIEW_STATUSES).toEqual(["pendente", "aprovado", "rejeitado"]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter admin test -- reviews`
Expected: FAIL com "Cannot find module './reviews'"

- [ ] **Step 3: Implementar `apps/admin/lib/reviews.ts`**

```typescript
export const REVIEW_STATUSES = ["pendente", "aprovado", "rejeitado"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  photo_url: string | null;
  status: ReviewStatus;
  created_at: string;
  buyers: { nome: string; empresa: string } | null;
  order_items: { product_name_snapshot: string } | null;
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter admin test -- reviews`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/reviews.ts apps/admin/lib/reviews.test.ts
git commit -m "feat(admin): adiciona tipos e status de avaliações"
```

---

## Task 14: Seção `/avaliacoes` no admin (moderação)

Tarefa de wiring (páginas + server actions), seguindo exatamente o padrão de `/pedidos` (`page.tsx` + `actions.ts` + componente cliente de ação). Sem teste unitário dedicado pras actions — verificação manual no Step 5.

**Files:**
- Create: `apps/admin/app/(dashboard)/avaliacoes/page.tsx`
- Create: `apps/admin/app/(dashboard)/avaliacoes/actions.ts`
- Create: `apps/admin/app/(dashboard)/avaliacoes/review-moderation-buttons.tsx`

**Interfaces:**
- Consumes: `ReviewRow`, `REVIEW_STATUSES` (Task 13), `requireAdminSession` (já existente).
- Produces: nenhuma interface nova consumida por outras tasks.

- [ ] **Step 1: Criar `apps/admin/app/(dashboard)/avaliacoes/actions.ts`**

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";

const ModerateSchema = z.object({
  id: z.string().uuid(),
});

export async function approveReview(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = ModerateSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const { error } = await supabase
    .from("product_reviews")
    .update({ status: "aprovado", moderated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("[admin/avaliacoes] erro ao aprovar avaliação:", error.message);
    return;
  }

  revalidatePath("/avaliacoes");
}

export async function rejectReview(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = ModerateSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const { error } = await supabase
    .from("product_reviews")
    .update({ status: "rejeitado", moderated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("[admin/avaliacoes] erro ao rejeitar avaliação:", error.message);
    return;
  }

  revalidatePath("/avaliacoes");
}
```

- [ ] **Step 2: Criar `apps/admin/app/(dashboard)/avaliacoes/review-moderation-buttons.tsx`**

```tsx
"use client";

export function ReviewModerationButtons({
  reviewId,
  approveAction,
  rejectAction,
}: {
  reviewId: string;
  approveAction: (formData: FormData) => void;
  rejectAction: (formData: FormData) => void;
}) {
  return (
    <div className="flex gap-2">
      <form action={approveAction}>
        <input type="hidden" name="id" value={reviewId} />
        <button type="submit" className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700">
          Aprovar
        </button>
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="id" value={reviewId} />
        <button type="submit" className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700">
          Rejeitar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Criar `apps/admin/app/(dashboard)/avaliacoes/page.tsx`**

```tsx
import { Suspense } from "react";
import { requireAdminSession } from "@/lib/auth";
import type { ReviewRow } from "@/lib/reviews";
import { approveReview, rejectReview } from "./actions";
import { ReviewModerationButtons } from "./review-moderation-buttons";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

async function AvaliacoesContent() {
  const { supabase } = await requireAdminSession();

  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, rating, comment, photo_url, status, created_at, buyers(nome, empresa), order_items(product_name_snapshot)")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  const reviews = (data ?? []) as unknown as ReviewRow[];

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Avaliações</h1>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Comprador</th>
              <th className="px-4 py-3">Nota</th>
              <th className="px-4 py-3">Comentário</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {error && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-red-600">
                  Erro ao carregar avaliações: {error.message}
                </td>
              </tr>
            )}
            {reviews.map((review) => (
              <tr key={review.id}>
                <td className="px-4 py-3">{new Date(review.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3">{review.order_items?.product_name_snapshot}</td>
                <td className="px-4 py-3">
                  {review.buyers?.nome} — {review.buyers?.empresa}
                </td>
                <td className="px-4 py-3">{"★".repeat(review.rating)}</td>
                <td className="px-4 py-3 max-w-xs truncate">{review.comment}</td>
                <td className="px-4 py-3">{STATUS_LABEL[review.status] ?? review.status}</td>
                <td className="px-4 py-3">
                  {review.status === "pendente" && (
                    <ReviewModerationButtons reviewId={review.id} approveAction={approveReview} rejectAction={rejectReview} />
                  )}
                </td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma avaliação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AvaliacoesPage() {
  return (
    <Suspense fallback={null}>
      <AvaliacoesContent />
    </Suspense>
  );
}
```

- [ ] **Step 4: Rodar o build do admin e confirmar que compila**

Run: `pnpm --filter admin build`
Expected: build concluído sem erros de tipo

- [ ] **Step 5: Verificação manual**

Com uma avaliação `pendente` no banco (gerada via Task 11/12), acessar `/avaliacoes` no admin, confirmar que aparece na lista, clicar em "Aprovar" e confirmar que o status muda pra "Aprovado" e os botões somem daquela linha.

- [ ] **Step 6: Commit**

```bash
git add "apps/admin/app/(dashboard)/avaliacoes"
git commit -m "feat(admin): adiciona secao Avaliacoes com moderacao de reviews"
```

---

## Task 15: `getProductReviews` em `packages/core/src/reviews-server.ts`

**Files:**
- Modify: `packages/core/src/reviews-server.ts`
- Modify: `packages/core/src/reviews-server.test.ts`

**Interfaces:**
- Consumes: nenhuma dependência nova.
- Produces:
  - `type ApprovedReview = { id: string; rating: number; comment: string | null; photoUrl: string | null; createdAt: string }`
  - `type ProductReviewsSummary = { averageRating: number; count: number; distribution: Record<1|2|3|4|5, number>; reviews: ApprovedReview[] }`
  - `getProductReviews(productId: string): Promise<ProductReviewsSummary>`

  Consumido pela Task 16.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `packages/core/src/reviews-server.test.ts`:

```typescript
import { getProductReviews } from "./reviews-server";

describe("getProductReviews", () => {
  it("calcula média, distribuição e mapeia as avaliações aprovadas", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: "r1", rating: 5, comment: "Ótimo", photo_url: null, created_at: "2026-08-01T00:00:00Z" },
            { id: "r2", rating: 3, comment: null, photo_url: "https://img/x", created_at: "2026-07-31T00:00:00Z" },
          ],
          error: null,
        }),
      })),
    } as unknown as SupabaseClient;

    const result = await getProductReviews("p1");

    expect(supabase.from).toHaveBeenCalledWith("product_reviews");
    expect(result).toEqual({
      averageRating: 4,
      count: 2,
      distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 },
      reviews: [
        { id: "r1", rating: 5, comment: "Ótimo", photoUrl: null, createdAt: "2026-08-01T00:00:00Z" },
        { id: "r2", rating: 3, comment: null, photoUrl: "https://img/x", createdAt: "2026-07-31T00:00:00Z" },
      ],
    });
  });

  it("retorna resumo vazio quando não há avaliações aprovadas", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    } as unknown as SupabaseClient;

    const result = await getProductReviews("p1");
    expect(result).toEqual({
      averageRating: 0,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      reviews: [],
    });
  });
});
```

Como as demais funções do arquivo usam `SupabaseClient` só como tipo (sem `getHubClient` interno — recebem o client por parâmetro), mas `getProductReviews` é chamado pela PDP sem sessão: ele cria o client internamente com `getHubClient()`, então o mock precisa ser de `./supabase`, não de parâmetro. Ajustar o topo do arquivo de teste adicionando:

```typescript
vi.mock("./supabase", () => ({
  getHubClient: vi.fn(),
}));
```

E, dentro de cada `it` de `getProductReviews`, importar `getHubClient` de `./supabase` e configurar o mock antes de chamar a função:

```typescript
import { getHubClient } from "./supabase";
// ...
vi.mocked(getHubClient).mockReturnValue(supabase);
```

(Adicionar essa linha logo antes de cada `const result = await getProductReviews("p1");` nos dois testes.)

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @mypet/core test -- reviews-server`
Expected: FAIL com "getProductReviews is not a function"

- [ ] **Step 3: Implementar `getProductReviews`**

Adicionar ao topo de `packages/core/src/reviews-server.ts` (junto aos demais imports):

```typescript
import { getHubClient } from "./supabase";
```

E ao final do arquivo:

```typescript
export type ApprovedReview = {
  id: string;
  rating: number;
  comment: string | null;
  photoUrl: string | null;
  createdAt: string;
};

export type ProductReviewsSummary = {
  averageRating: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  reviews: ApprovedReview[];
};

type RawReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  photo_url: string | null;
  created_at: string;
};

export async function getProductReviews(productId: string): Promise<ProductReviewsSummary> {
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, rating, comment, photo_url, created_at")
    .eq("product_id", productId)
    .eq("status", "aprovado")
    .order("created_at", { ascending: false });

  const empty: ProductReviewsSummary = {
    averageRating: 0,
    count: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    reviews: [],
  };

  if (error || !data) {
    if (error) console.error("[reviews] erro ao buscar avaliações do produto:", error.message);
    return empty;
  }

  const rows = data as RawReviewRow[];
  if (rows.length === 0) return empty;

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const row of rows) {
    distribution[row.rating as 1 | 2 | 3 | 4 | 5] += 1;
    sum += row.rating;
  }

  return {
    averageRating: Math.round((sum / rows.length) * 10) / 10,
    count: rows.length,
    distribution,
    reviews: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      photoUrl: row.photo_url,
      createdAt: row.created_at,
    })),
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @mypet/core test -- reviews-server`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/reviews-server.ts packages/core/src/reviews-server.test.ts
git commit -m "feat(core): adiciona getProductReviews com media e distribuicao"
```

---

## Task 16: Componente `ProductReviews` na PDP

**Files:**
- Create: `packages/core/src/components/product-reviews.tsx`
- Modify: `apps/mypet/app/produtos/[id]/page.tsx`
- Modify: `apps/distribuidora/app/produtos/[id]/page.tsx`

**Interfaces:**
- Consumes: `getProductReviews`, `ProductReviewsSummary` (Task 15), `useClientConfig` (já existente).
- Produces: nenhuma interface nova consumida por outras tasks — última task do plano.

- [ ] **Step 1: Criar `packages/core/src/components/product-reviews.tsx`**

```tsx
import { getProductReviews } from "../reviews-server";

export async function ProductReviews({ productId }: { productId: string }) {
  const summary = await getProductReviews(productId);

  if (summary.count === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
        Avaliações ({summary.count})
      </h2>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 28, fontWeight: 900 }}>{summary.averageRating.toFixed(1)}</span>
        <span style={{ fontSize: 18 }}>{"★".repeat(Math.round(summary.averageRating))}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 24 }}>
        {([5, 4, 3, 2, 1] as const).map((n) => {
          const pct = Math.round((summary.distribution[n] / summary.count) * 100);
          return (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ width: 32 }}>{n}★</span>
              <div style={{ flex: 1, background: "#eee", borderRadius: 4, height: 8 }}>
                <div style={{ width: `${pct}%`, background: "#f0c419", borderRadius: 4, height: 8 }} />
              </div>
              <span style={{ width: 36, textAlign: "right", color: "#666" }}>{pct}%</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {summary.reviews.map((review) => (
          <div key={review.id} style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
            <div style={{ fontSize: 14, marginBottom: 4 }}>{"★".repeat(review.rating)}</div>
            {review.comment && <p style={{ fontSize: 14, color: "#333", marginBottom: 8 }}>{review.comment}</p>}
            {review.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={review.photoUrl} alt="Foto do produto enviada na avaliação" style={{ maxWidth: 160, borderRadius: 8 }} />
            )}
            <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
              {new Date(review.createdAt).toLocaleDateString("pt-BR")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar `ProductReviews` na PDP de `mypet`**

Em `apps/mypet/app/produtos/[id]/page.tsx`, adicionar o import:

```typescript
import { ProductReviews } from "@mypet/core/components/product-reviews";
```

E, dentro de `ProductDetail`, logo após o bloco de "ESPECIFICAÇÕES TÉCNICAS" (antes do fechamento `</div>` da coluna direita, linha 276-278 do arquivo atual), adicionar:

```tsx
              <ProductReviews productId={product.id} />
```

- [ ] **Step 3: Adicionar `ProductReviews` na PDP de `distribuidora`**

Repetir o Step 2 em `apps/distribuidora/app/produtos/[id]/page.tsx` (mesma estrutura de arquivo).

- [ ] **Step 4: Rodar os builds e confirmar que compilam**

Run: `pnpm --filter mypet build && pnpm --filter distribuidora build`
Expected: build concluído sem erros de tipo em ambos

- [ ] **Step 5: Verificação manual**

Com pelo menos uma avaliação `status: "aprovado"` no banco pra um produto de teste, acessar a PDP daquele produto em `mypet` e `distribuidora` e confirmar que a seção "Avaliações" aparece com nota média, distribuição e o comentário. Acessar a PDP de um produto sem avaliação aprovada e confirmar que a seção não aparece.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/product-reviews.tsx "apps/mypet/app/produtos/[id]/page.tsx" "apps/distribuidora/app/produtos/[id]/page.tsx"
git commit -m "feat(mypet,distribuidora): exibe avaliacoes aprovadas na PDP"
```
