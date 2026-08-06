# Push Notifications (broadcast via PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que quem instalou o PWA de `apps/distribuidora` receba notificações push de campanha (broadcast), disparadas por um script de linha de comando, sem exigir login.

**Architecture:** Lógica reutilizável (`push.ts` client + `push-server.ts` server) entra em `packages/core`, seguindo o mesmo padrão de `leads.ts`/`leads-server.ts` (tabela única no Supabase hub, diferenciada por `channel`). `apps/distribuidora` liga essa lógica a uma rota de API, ao `service worker` existente, e ao banner de instalação já existente. Um script Node na raiz do monorepo dispara o broadcast.

**Tech Stack:** Next.js 16 / React 19 (apps), TypeScript, Vitest (`environment: "node"`), Supabase (`@supabase/supabase-js`), `web-push`, `tsx` + `dotenv` (script de CLI).

## Global Constraints

- Sem login/conta de usuário: subscriptions são anônimas, identificadas só pelo `endpoint` do navegador.
- Esta entrega cobre **apenas broadcast** (mandar pra todo mundo do canal) — notificação direcionada a uma pessoa fica fora de escopo.
- Um único par de chaves VAPID serve todo o hub (todos os sites do monorepo), não uma chave por site.
- Toda falha do lado do navegador (`push.ts`, `install-prompt.tsx`) é silenciosa — nunca lança exceção nem bloqueia a navegação normal do site.
- Sem segmentação de público: todo broadcast vai para todas as subscriptions daquele `channel`.
- Sem UI de administração para disparar campanha — só via script de terminal (`pnpm push:send`).
- Segue o padrão já existente em `@mypet/core`: `Channel`/`isChannel` de `./channels`, `getHubClient()` de `./supabase`, handler de API no formato `create*PostHandler(channel)`.
- `packages/core` roda testes com `environment: "node"` (`packages/core/vitest.config.ts`) — sem `jsdom`. Globals de browser (`navigator`, `Notification`, `PushManager`, `fetch`) são simulados via `vi.stubGlobal`, mesmo padrão já usado em `packages/core/src/leads.test.ts`. Módulos são mockados via `vi.mock` com closures sobre `vi.fn()`, mesmo padrão de `packages/core/src/leads-server.test.ts`.
- `apps/distribuidora` não tem infraestrutura de teste automatizado hoje (sem Vitest configurado no app) — mudanças nesse app são verificadas manualmente, não por teste automatizado, mesmo critério já usado na entrega anterior de PWA.
- Segredos (chaves VAPID, credenciais Supabase) nunca são commitados — só em arquivos `.env`/`.env.local` locais (já ignorados via `.gitignore` na raiz). Arquivos `.env.example` documentam os nomes das variáveis, sem valores reais.

---

### Task 1: Tabela `push_subscriptions` no Supabase hub

**Files:** nenhum arquivo do repositório — mudança é só no banco (mesmo processo manual já usado para a tabela `leads`, não há pasta de migrations versionada no repo).

**Interfaces:**
- Produces: tabela `push_subscriptions(id uuid, channel text, endpoint text unique, p256dh text, auth text, created_at timestamptz)`, consumida pelas Tasks 3 e 4 via `getHubClient()`.

- [ ] **Step 1: Rodar o SQL de criação da tabela**

No SQL editor do projeto Supabase hub (mesmo projeto onde já existe a tabela `leads`):

```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_channel_idx on push_subscriptions (channel);
```

- [ ] **Step 2: Verificar que a tabela foi criada**

Rodar no mesmo SQL editor:

```sql
select column_name, data_type from information_schema.columns where table_name = 'push_subscriptions';
```

Esperado: 6 linhas (`id`, `channel`, `endpoint`, `p256dh`, `auth`, `created_at`).

Sem commit — esta tarefa não altera nenhum arquivo do repositório.

---

### Task 2: Gerar chaves VAPID

**Files:** nenhum arquivo do repositório (segredos não são commitados; `.env.example` com os nomes das variáveis é criado nas Tasks 8 e 9).

**Interfaces:**
- Produces: valores de `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, consumidos manualmente pelo operador ao configurar `.env`/`.env.local` nas Tasks 8, 9 e 10.

- [ ] **Step 1: Gerar o par de chaves**

```bash
npx web-push generate-vapid-keys
```

Saída esperada (exemplo de formato, os valores reais variam):

```
=======================================

Public Key:
BN4...umas_dezenas_de_caracteres...

Private Key:
sN2...umas_dezenas_de_caracteres...

=======================================
```

- [ ] **Step 2: Guardar as chaves localmente**

Anotar a Public Key e a Private Key geradas — elas serão usadas para preencher os arquivos `.env`/`.env.local` locais nas Tasks 8, 9 e 10 (nunca commitadas). Definir também o valor de `PUSH_VAPID_SUBJECT` como `mailto:` de um contato válido da empresa (ex: `mailto:contato@distribuidorapetshop.com.br`).

Sem commit — segredos não entram no repositório.

---

### Task 3: `push-server.ts` — handler de subscribe

**Files:**
- Create: `packages/core/src/push-server.ts`
- Create: `packages/core/src/push-server.test.ts`
- Modify: `packages/core/package.json` (adiciona `"./push-server": "./src/push-server.ts"` ao mapa `exports`)

**Interfaces:**
- Consumes: `getHubClient()` de `./supabase` (já existe), `Channel` de `./channels` (já existe).
- Produces: `createPushSubscribePostHandler(channel: Channel): (req: NextRequest) => Promise<Response>`, consumido pela Task 6 (`apps/distribuidora/app/api/push/subscribe/route.ts`).

- [ ] **Step 1: Escrever os testes que falham**

Criar `packages/core/src/push-server.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const upsertMock = vi.fn();
const fromCalls: string[] = [];

vi.mock("./supabase", () => ({
  getHubClient: () => ({
    from: (table: string) => {
      fromCalls.push(table);
      return { upsert: upsertMock };
    },
  }),
}));

import { createPushSubscribePostHandler } from "./push-server";

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  upsertMock.mockReset();
  fromCalls.length = 0;
});

describe("createPushSubscribePostHandler", () => {
  it("grava a subscription na tabela push_subscriptions com upsert por endpoint", async () => {
    upsertMock.mockResolvedValue({ error: null });
    const POST = createPushSubscribePostHandler("distribuidora");

    const res = await POST(
      fakeRequest({ endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } }),
    );

    expect(fromCalls[0]).toBe("push_subscriptions");
    expect(upsertMock).toHaveBeenCalledWith(
      { channel: "distribuidora", endpoint: "https://push.example/abc", p256dh: "p", auth: "a" },
      { onConflict: "endpoint" },
    );
    expect(res.status).toBe(200);
  });

  it("retorna 400 quando falta endpoint ou keys", async () => {
    const POST = createPushSubscribePostHandler("distribuidora");
    const res = await POST(fakeRequest({ endpoint: "", keys: { p256dh: "p", auth: "a" } }));
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("retorna 500 genérico quando o Supabase falha", async () => {
    upsertMock.mockResolvedValue({ error: { message: "conexão recusada" } });
    const POST = createPushSubscribePostHandler("distribuidora");
    const res = await POST(
      fakeRequest({ endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } }),
    );
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `pnpm --filter @mypet/core test -- push-server`
Expected: FAIL — `push-server.ts` ainda não existe (`Cannot find module './push-server'`).

- [ ] **Step 3: Implementar `push-server.ts`**

Criar `packages/core/src/push-server.ts`:

```ts
import { NextRequest } from "next/server";
import { getHubClient } from "./supabase";
import type { Channel } from "./channels";

export function createPushSubscribePostHandler(channel: Channel) {
  return async function POST(req: NextRequest): Promise<Response> {
    const body = await req.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return Response.json({ error: "Inscrição inválida" }, { status: 400 });
    }

    const supabase = getHubClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({ channel, endpoint, p256dh, auth }, { onConflict: "endpoint" });

    if (error) {
      console.error("[push] erro ao gravar subscription:", error.message);
      return Response.json(
        { error: "Não foi possível registrar a inscrição." },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  };
}
```

- [ ] **Step 4: Adicionar o novo subpath ao `exports` do pacote**

Editar `packages/core/package.json`, dentro do objeto `"exports"`, logo após a linha `"./orders-server": "./src/orders-server.ts",` (ordem alfabética):

```json
    "./orders-server": "./src/orders-server.ts",
    "./push-server": "./src/push-server.ts",
    "./querystring": "./src/querystring.ts",
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @mypet/core test -- push-server`
Expected: PASS — 3 testes.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/push-server.ts packages/core/src/push-server.test.ts packages/core/package.json
git commit -m "feat(core): adiciona handler de subscribe para push notifications"
```

---

### Task 4: `push-server.ts` — `sendPushBroadcast`

**Files:**
- Modify: `packages/core/src/push-server.ts` (adiciona `sendPushBroadcast`)
- Modify: `packages/core/src/push-server.test.ts` (adiciona testes de `sendPushBroadcast`)
- Modify: `packages/core/package.json` (adiciona dependência `web-push` e devDependency `@types/web-push`)

**Interfaces:**
- Consumes: `getHubClient()` de `./supabase`, `Channel` de `./channels`.
- Produces: `sendPushBroadcast(channel: Channel, payload: { title: string; body: string; url?: string }): Promise<{ sent: number; removed: number }>`, consumido pela Task 9 (`scripts/push-send.ts`).

- [ ] **Step 1: Adicionar a dependência `web-push`**

```bash
pnpm --filter @mypet/core add web-push@^3.6.7
pnpm --filter @mypet/core add -D @types/web-push@^3.6.4
```

- [ ] **Step 2: Escrever os testes que falham**

Substituir o conteúdo completo de `packages/core/src/push-server.test.ts` por:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const upsertMock = vi.fn();
const selectEqMock = vi.fn();
const deleteEqMock = vi.fn();
const fromCalls: string[] = [];

vi.mock("./supabase", () => ({
  getHubClient: () => ({
    from: (table: string) => {
      fromCalls.push(table);
      return {
        upsert: upsertMock,
        select: () => ({ eq: selectEqMock }),
        delete: () => ({ eq: deleteEqMock }),
      };
    },
  }),
}));

const sendNotificationMock = vi.fn();
const setVapidDetailsMock = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
    sendNotification: sendNotificationMock,
  },
}));

import { createPushSubscribePostHandler, sendPushBroadcast } from "./push-server";

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  upsertMock.mockReset();
  selectEqMock.mockReset();
  deleteEqMock.mockReset();
  sendNotificationMock.mockReset();
  setVapidDetailsMock.mockReset();
  fromCalls.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createPushSubscribePostHandler", () => {
  it("grava a subscription na tabela push_subscriptions com upsert por endpoint", async () => {
    upsertMock.mockResolvedValue({ error: null });
    const POST = createPushSubscribePostHandler("distribuidora");

    const res = await POST(
      fakeRequest({ endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } }),
    );

    expect(fromCalls[0]).toBe("push_subscriptions");
    expect(upsertMock).toHaveBeenCalledWith(
      { channel: "distribuidora", endpoint: "https://push.example/abc", p256dh: "p", auth: "a" },
      { onConflict: "endpoint" },
    );
    expect(res.status).toBe(200);
  });

  it("retorna 400 quando falta endpoint ou keys", async () => {
    const POST = createPushSubscribePostHandler("distribuidora");
    const res = await POST(fakeRequest({ endpoint: "", keys: { p256dh: "p", auth: "a" } }));
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("retorna 500 genérico quando o Supabase falha", async () => {
    upsertMock.mockResolvedValue({ error: { message: "conexão recusada" } });
    const POST = createPushSubscribePostHandler("distribuidora");
    const res = await POST(
      fakeRequest({ endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } }),
    );
    expect(res.status).toBe(500);
  });
});

describe("sendPushBroadcast", () => {
  it("lança erro quando as chaves VAPID não estão configuradas", async () => {
    await expect(
      sendPushBroadcast("distribuidora", { title: "T", body: "B" }),
    ).rejects.toThrow(/PUSH_VAPID/);
  });

  it("envia para todas as inscrições do canal e conta os enviados", async () => {
    vi.stubEnv("PUSH_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("PUSH_VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("PUSH_VAPID_SUBJECT", "mailto:teste@exemplo.com");
    selectEqMock.mockResolvedValue({
      data: [
        { id: "1", endpoint: "https://push.example/a", p256dh: "p1", auth: "a1" },
        { id: "2", endpoint: "https://push.example/b", p256dh: "p2", auth: "a2" },
      ],
      error: null,
    });
    sendNotificationMock.mockResolvedValue(undefined);

    const result = await sendPushBroadcast("distribuidora", { title: "T", body: "B" });

    expect(setVapidDetailsMock).toHaveBeenCalledWith("mailto:teste@exemplo.com", "pub", "priv");
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ sent: 2, removed: 0 });
  });

  it("remove a inscrição quando o envio falha com 410 (expirada)", async () => {
    vi.stubEnv("PUSH_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("PUSH_VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("PUSH_VAPID_SUBJECT", "mailto:teste@exemplo.com");
    selectEqMock.mockResolvedValue({
      data: [{ id: "1", endpoint: "https://push.example/a", p256dh: "p1", auth: "a1" }],
      error: null,
    });
    deleteEqMock.mockResolvedValue({ error: null });
    sendNotificationMock.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));

    const result = await sendPushBroadcast("distribuidora", { title: "T", body: "B" });

    expect(deleteEqMock).toHaveBeenCalledWith("id", "1");
    expect(result).toEqual({ sent: 0, removed: 1 });
  });

  it("não remove a inscrição em erro que não seja 404/410", async () => {
    vi.stubEnv("PUSH_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("PUSH_VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("PUSH_VAPID_SUBJECT", "mailto:teste@exemplo.com");
    selectEqMock.mockResolvedValue({
      data: [{ id: "1", endpoint: "https://push.example/a", p256dh: "p1", auth: "a1" }],
      error: null,
    });
    sendNotificationMock.mockRejectedValue(
      Object.assign(new Error("erro temporário"), { statusCode: 500 }),
    );

    const result = await sendPushBroadcast("distribuidora", { title: "T", body: "B" });

    expect(deleteEqMock).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, removed: 0 });
  });
});
```

- [ ] **Step 3: Rodar os testes e confirmar que os novos falham**

Run: `pnpm --filter @mypet/core test -- push-server`
Expected: FAIL — `sendPushBroadcast` ainda não é exportado por `./push-server`.

- [ ] **Step 4: Implementar `sendPushBroadcast`**

Substituir o conteúdo completo de `packages/core/src/push-server.ts` por:

```ts
import { NextRequest } from "next/server";
import webpush from "web-push";
import { getHubClient } from "./supabase";
import type { Channel } from "./channels";

export function createPushSubscribePostHandler(channel: Channel) {
  return async function POST(req: NextRequest): Promise<Response> {
    const body = await req.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return Response.json({ error: "Inscrição inválida" }, { status: 400 });
    }

    const supabase = getHubClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({ channel, endpoint, p256dh, auth }, { onConflict: "endpoint" });

    if (error) {
      console.error("[push] erro ao gravar subscription:", error.message);
      return Response.json(
        { error: "Não foi possível registrar a inscrição." },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  };
}

type PushPayload = { title: string; body: string; url?: string };

function getVapidDetails() {
  const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.PUSH_VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY e PUSH_VAPID_SUBJECT precisam estar definidos no ambiente.",
    );
  }
  return { publicKey, privateKey, subject };
}

export async function sendPushBroadcast(
  channel: Channel,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  const { publicKey, privateKey, subject } = getVapidDetails();
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("channel", channel);

  if (error) {
    throw new Error(`Não foi possível buscar as inscrições: ${error.message}`);
  }

  let sent = 0;
  let removed = 0;

  for (const row of data ?? []) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", row.id);
        removed++;
      } else {
        console.error("[push] erro ao enviar notificação:", err);
      }
    }
  }

  return { sent, removed };
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @mypet/core test -- push-server`
Expected: PASS — 7 testes (3 de subscribe + 4 de broadcast).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/push-server.ts packages/core/src/push-server.test.ts packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): adiciona sendPushBroadcast para disparo de campanhas push"
```

---

### Task 5: `push.ts` — helper client-side de subscribe

**Files:**
- Create: `packages/core/src/push.ts`
- Create: `packages/core/src/push.test.ts`
- Modify: `packages/core/package.json` (adiciona `"./push": "./src/push.ts"` ao mapa `exports`)

**Interfaces:**
- Consumes: `Channel` de `./channels`.
- Produces: `subscribeToPush(channel: Channel, vapidPublicKey: string): Promise<void>`, consumido pela Task 8 (`apps/distribuidora/app/components/install-prompt.tsx`).

- [ ] **Step 1: Escrever os testes que falham**

Criar `packages/core/src/push.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { subscribeToPush } from "./push";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("subscribeToPush", () => {
  it("não faz nada quando o navegador não suporta push", async () => {
    vi.stubGlobal("navigator", {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await subscribeToPush("distribuidora", "chave-publica");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("não inscreve quando a permissão é negada", async () => {
    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { requestPermission: vi.fn().mockResolvedValue("denied") });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await subscribeToPush("distribuidora", "chave-publica");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("inscreve e envia a subscription para a API quando a permissão é concedida", async () => {
    const subscribeMock = vi.fn().mockResolvedValue({ endpoint: "https://push.example/abc" });
    vi.stubGlobal("navigator", {
      serviceWorker: {
        ready: Promise.resolve({ pushManager: { subscribe: subscribeMock } }),
      },
    });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { requestPermission: vi.fn().mockResolvedValue("granted") });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await subscribeToPush("distribuidora", "chave-publica");

    expect(subscribeMock).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: "chave-publica",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/push/subscribe",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("nunca lança exceção quando o subscribe falha", async () => {
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: Promise.reject(new Error("sw indisponível")) },
    });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { requestPermission: vi.fn().mockResolvedValue("granted") });
    vi.stubGlobal("fetch", vi.fn());

    await expect(subscribeToPush("distribuidora", "chave-publica")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `pnpm --filter @mypet/core test -- push.test`
Expected: FAIL — `push.ts` ainda não existe.

- [ ] **Step 3: Implementar `push.ts`**

Criar `packages/core/src/push.ts`:

```ts
import type { Channel } from "./channels";

export async function subscribeToPush(channel: Channel, vapidPublicKey: string): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof PushManager === "undefined"
  ) {
    return;
  }

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return;
  }
  if (permission !== "granted") return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey,
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
  } catch {
    // Falha relacionada a push deve ser sempre silenciosa e nunca travar a UI.
  }
}
```

Nota: `channel` não é usado dentro da função — o `channel` já está embutido na URL da API (`/api/push/subscribe`, específica de cada app, ver Task 6). O parâmetro existe para deixar a assinatura explícita sobre qual canal está sendo inscrito, seguindo o mesmo estilo de `createLeadsPostHandler(channel)`.

- [ ] **Step 4: Adicionar o novo subpath ao `exports` do pacote**

Editar `packages/core/package.json`, dentro do objeto `"exports"`, logo antes da linha `"./querystring": "./src/querystring.ts",`:

```json
    "./push": "./src/push.ts",
    "./push-server": "./src/push-server.ts",
    "./querystring": "./src/querystring.ts",
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @mypet/core test -- push.test`
Expected: PASS — 4 testes.

- [ ] **Step 6: Rodar a suíte completa do core**

Run: `pnpm --filter @mypet/core test`
Expected: PASS — todos os testes do pacote, incluindo os das Tasks 3 e 4.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/push.ts packages/core/src/push.test.ts packages/core/package.json
git commit -m "feat(core): adiciona subscribeToPush para inscrição client-side"
```

---

### Task 6: Rota de API `apps/distribuidora/app/api/push/subscribe`

**Files:**
- Create: `apps/distribuidora/app/api/push/subscribe/route.ts`

**Interfaces:**
- Consumes: `createPushSubscribePostHandler` de `@mypet/core/push-server` (Task 3).
- Produces: endpoint `POST /api/push/subscribe`, consumido pelo `fetch` dentro de `subscribeToPush` (Task 5).

- [ ] **Step 1: Criar a rota**

Criar `apps/distribuidora/app/api/push/subscribe/route.ts`:

```ts
import { createPushSubscribePostHandler } from "@mypet/core/push-server";

export const POST = createPushSubscribePostHandler("distribuidora");
```

- [ ] **Step 2: Verificar que o app compila (type-check)**

Run: `pnpm --filter distribuidora build`
Expected: build conclui sem erro de tipo (o Next.js roda `tsc` como parte do build).

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/api/push/subscribe/route.ts
git commit -m "feat(distribuidora): adiciona rota de subscribe de push notifications"
```

---

### Task 7: `public/sw.js` — listeners de push

**Files:**
- Modify: `apps/distribuidora/public/sw.js`

**Interfaces:**
- Consumes: payload JSON `{ title, body, url }` enviado por `sendPushBroadcast` (Task 4).
- Produces: notificação do sistema operacional exibida pelo navegador.

- [ ] **Step 1: Editar o service worker**

Substituir o conteúdo completo de `apps/distribuidora/public/sw.js` por:

```js
// Service worker minimo: existe para satisfazer o criterio de
// instalabilidade do Chrome e tratar push notifications. Nao intercepta
// nem cacheia nenhuma resposta - toda requisicao segue direto para a rede.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intencionalmente vazio: nao intercepta a resposta, so a rede responde.
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Distribuidora Petshop", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

- [ ] **Step 2: Verificar manualmente que o arquivo é JS válido**

Run: `node --check apps/distribuidora/public/sw.js`
Expected: sem saída (exit code 0) — confirma que o arquivo não tem erro de sintaxe.

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/public/sw.js
git commit -m "feat(distribuidora): adiciona listeners de push no service worker"
```

---

### Task 8: Opt-in no `install-prompt.tsx`

**Files:**
- Modify: `apps/distribuidora/app/components/install-prompt.tsx`
- Create: `apps/distribuidora/.env.example`

**Interfaces:**
- Consumes: `subscribeToPush` de `@mypet/core/push` (Task 5); `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

- [ ] **Step 1: Editar o componente**

Substituir o conteúdo completo de `apps/distribuidora/app/components/install-prompt.tsx` por:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useClientConfig } from "@mypet/core/theme";
import { subscribeToPush } from "@mypet/core/push";

const DISMISS_KEY = "mypet_pwa_install_dismissed_at";
const DISMISS_DAYS = 7;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isMobileLike(): boolean {
  return window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isDismissedRecently(): boolean {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DISMISS_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorage indisponivel: banner pode reaparecer, sem problema.
  }
}

function requestPushSubscription() {
  if (!VAPID_PUBLIC_KEY) return;
  void subscribeToPush("distribuidora", VAPID_PUBLIC_KEY);
}

export default function InstallPrompt() {
  const clientConfig = useClientConfig();
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const standalone = isStandalone();

    if (standalone && typeof Notification !== "undefined" && Notification.permission === "default") {
      requestPushSubscription();
    }

    if (standalone || isDismissedRecently()) return;
    if (isMobileLike()) {
      queueMicrotask(() => setIsVisible(true));
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!isVisible && !deferredEvent) return null;

  async function handleInstall() {
    if (!deferredEvent) return;
    try {
      await deferredEvent.prompt();
      const { outcome } = await deferredEvent.userChoice;
      if (outcome === "dismissed") {
        markDismissed();
      } else {
        requestPushSubscription();
      }
    } catch {
      // Falha relacionada a PWA deve ser sempre silenciosa e nunca travar a UI.
    } finally {
      setDeferredEvent(null);
      setIsVisible(false);
    }
  }

  function handleDismiss() {
    markDismissed();
    setDeferredEvent(null);
    setIsVisible(false);
  }

  const hasNativeInstall = Boolean(deferredEvent);
  const message = hasNativeInstall
    ? `Adicione ${clientConfig.name} à tela inicial para acessar mais rápido.`
    : isIos()
      ? `No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".`
      : `Adicione ${clientConfig.name} à tela inicial para acessar mais rápido.`;

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicativo"
      style={{ background: clientConfig.palette.navy }}
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 px-4 py-3 text-white shadow-lg"
    >
      <span className="min-w-0 text-sm leading-snug">{message}</span>
      <div className="flex shrink-0 items-center gap-2">
        {hasNativeInstall && (
          <button
            type="button"
            onClick={handleInstall}
            className="rounded bg-white px-3 py-1.5 text-sm font-medium text-slate-900"
          >
            Instalar
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar"
          className="px-2 py-1.5 text-lg leading-none text-white/80"
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar `.env.example` do app**

Criar `apps/distribuidora/.env.example`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
```

- [ ] **Step 3: Verificar que o app compila (type-check)**

Run: `pnpm --filter distribuidora build`
Expected: build conclui sem erro de tipo.

- [ ] **Step 4: Commit**

```bash
git add apps/distribuidora/app/components/install-prompt.tsx apps/distribuidora/.env.example
git commit -m "feat(distribuidora): pede permissao de push notification junto do prompt de instalacao"
```

---

### Task 9: Script `pnpm push:send`

**Files:**
- Create: `scripts/push-send.ts`
- Modify: `package.json` (raiz — script `push:send`, dependency `@mypet/core`, devDependencies `tsx` e `dotenv`)
- Create: `.env.example` (raiz)

**Interfaces:**
- Consumes: `isChannel` de `@mypet/core/channels`, `sendPushBroadcast` de `@mypet/core/push-server` (Task 4).

- [ ] **Step 1: Adicionar dependências na raiz**

```bash
pnpm add -w -D tsx@^4.23.9 dotenv@^17.4.2
pnpm add -w @mypet/core@workspace:*
```

- [ ] **Step 2: Criar o script**

Criar `scripts/push-send.ts`:

```ts
import "dotenv/config";
import { isChannel } from "@mypet/core/channels";
import { sendPushBroadcast } from "@mypet/core/push-server";

const [channelArg, title, body, url] = process.argv.slice(2);

if (!channelArg || !title || !body) {
  console.error('Uso: pnpm push:send <channel> "<título>" "<mensagem>" [url]');
  process.exit(1);
}

if (!isChannel(channelArg)) {
  console.error(`Canal inválido: ${channelArg}`);
  process.exit(1);
}

sendPushBroadcast(channelArg, { title, body, url })
  .then(({ sent, removed }) => {
    console.log(`Enviado: ${sent}, removidas (expiradas): ${removed}`);
  })
  .catch((error) => {
    console.error("Falha ao enviar broadcast:", error);
    process.exit(1);
  });
```

- [ ] **Step 3: Adicionar o script ao `package.json` da raiz**

Editar `package.json`, dentro do objeto `"scripts"`, adicionando a linha `"push:send"` (após `"test"`):

```json
    "test": "pnpm --filter @mypet/core test",
    "push:send": "tsx scripts/push-send.ts"
```

- [ ] **Step 4: Criar `.env.example` da raiz**

Criar `.env.example`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
PUSH_VAPID_PUBLIC_KEY=your-vapid-public-key
PUSH_VAPID_PRIVATE_KEY=your-vapid-private-key
PUSH_VAPID_SUBJECT=mailto:contato@suaempresa.com.br
```

- [ ] **Step 5: Verificar que o script roda e falha do jeito esperado sem argumentos**

Run: `pnpm push:send`
Expected: imprime `Uso: pnpm push:send <channel> "<título>" "<mensagem>" [url]` e sai com código 1.

- [ ] **Step 6: Commit**

```bash
git add scripts/push-send.ts package.json pnpm-lock.yaml .env.example
git commit -m "feat: adiciona script push:send para disparo de campanhas via CLI"
```

---

### Task 10: Verificação end-to-end manual

**Files:** nenhum (verificação manual, sem alteração de código).

- [ ] **Step 1: Preencher os `.env`/`.env.local` locais**

Preencher `.env.local` na raiz de `apps/distribuidora` (baseado no `.env.example` da Task 8) e `.env.local`/`.env` na raiz do monorepo (baseado no `.env.example` da Task 9) com as credenciais reais do Supabase hub e as chaves VAPID geradas na Task 2.

- [ ] **Step 2: Build e start em modo produção**

```bash
pnpm --filter distribuidora build
pnpm --filter distribuidora start
```

- [ ] **Step 3: Instalar o PWA e conceder permissão**

Em um Android real (ou emulado) com Chrome, acessar o site, tocar em "Instalar" no banner, e conceder a permissão de notificação quando solicitada.

- [ ] **Step 4: Verificar que a subscription foi gravada**

No SQL editor do Supabase hub:

```sql
select channel, endpoint, created_at from push_subscriptions where channel = 'distribuidora';
```

Expected: pelo menos 1 linha.

- [ ] **Step 5: Disparar um broadcast de teste**

```bash
pnpm push:send distribuidora "Teste" "Mensagem de teste do push"
```

Expected: saída `Enviado: 1, removidas (expiradas): 0` (ou mais, se houver mais de uma inscrição).

- [ ] **Step 6: Confirmar o recebimento**

Confirmar que a notificação aparece na barra de notificações do Android mesmo com o app fechado, e que tocar nela abre o site.

- [ ] **Step 7: (Opcional) Verificar em iOS**

Se houver um iPhone com iOS 16.4+ disponível: no Safari, "Adicionar à Tela de Início", abrir o app pela tela de início (não pelo Safari), conceder a permissão quando solicitada (dispara pelo `useEffect` de `isStandalone()`), repetir os Steps 4–6.

Sem commit — esta tarefa é só verificação.
