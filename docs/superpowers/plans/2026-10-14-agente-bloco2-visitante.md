# Agente My Pet — Bloco 2 (tela /agente e modo visitante) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar o agente na frente das pessoas: página `/agente` (painel do agente + painel de acesso completo com cadastro inline, versão celular), home como porta de entrada, pós-login indo para `/agente`, e remoção do assistente antigo de dúvidas.

**Architecture:** Um hook no core (`agent-client.ts`) embrulha o `useChat` do `@ai-sdk/react` 4.0.20 (casado com `ai` 7.0.19), mantém a conversa no `sessionStorage` (para sobreviver ao cadastro no meio da conversa) e manda ao servidor só `{ id, message, cart }`. A página `/agente` decide o modo no servidor (`requireBuyer`) e renderiza um shell cliente com o chat e, para visitante, o painel de acesso. O servidor ganha duas proteções pedidas na revisão do bloco 1: id de mensagem repetido → 409 e histórico do visitante só com mensagens do modo visitante.

**Tech Stack:** Next 16.2 (App Router, `cacheComponents: true`), React 19.2, `@ai-sdk/react@4.0.20` (novo, no core), `ai@7.0.19`, Vitest 4 + Testing Library (jsdom no app), pnpm.

**Spec:** `docs/superpowers/specs/2026-10-14-agente-plataforma-design.md` (seções 1.1, 1.3, 3.4 e bloco 2 da seção 6). Bloco 1 já implementado: `POST /api/agente` (`packages/core/src/agent-server.ts`).

## Global Constraints

- Copy em português; nunca "atacado", "cotação", nem chamar o hotsite de "loja"; nunca prometer desconto/condição/preço melhor; **nada leva o visitante ao WhatsApp do time** (o único WhatsApp citado é o do cadastro: "CNPJ e WhatsApp").
- Visitante nunca vê preço: cartão de produto mostra "Cadastre-se para ver o preço" (o servidor já manda `unitPrice/priceLabel: null`).
- Modo decidido só no servidor (`requireBuyer` na página e no `/api/agente`). O navegador manda só `{ id, message, cart }`; cada envio usa um id de mensagem novo (o `useChat` já gera).
- Erros do `/api/agente`: corpo `{ ok:false, error:{ code, message } }` (handler/cota) ou `{ error: "..." }` (`rejectForeignRequest`, 403/415). `CONVERSATION_FORBIDDEN` (403) e `MESSAGE_DUPLICATE` (409) → o navegador começa conversa nova.
- Conversa no `sessionStorage` na chave `mypet-agente-conversa` (`{ id, messages }`, no máximo 40 mensagens), sempre com try/catch (pode não existir).
- Pergunta máx. 500 caracteres (igual ao servidor).
- Breakpoint do layout: 900px (acima: duas colunas; abaixo: agente em tela cheia + faixa "Liberar acesso completo" que abre o painel de baixo para cima).
- Commits só com os arquivos da task (há alterações não relacionadas no working tree — nunca `git add -A`/`git add .`). Direto na `main`. Toda mensagem de commit termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Testes: core `pnpm --filter @mypet/core exec vitest run <arquivo>`; app `pnpm --filter mypet exec vitest run <arquivo>`.
- Next 16 tem mudanças em relação ao que você conhece: siga os padrões das páginas existentes (`apps/mypet/app/pedido-rapido/page.tsx`: corpo async dentro de `<Suspense>`, `searchParams` como `Promise`).
- Fora deste bloco (bloco 3): carrinho ao lado do chat, `alterar_pedido`, reposição, status de pedidos, envio pelo WhatsApp a partir do `/agente`, `agent_conversation_id` em `orders`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `packages/core/src/agent-server.ts` / `agent-conversations.ts` (modificar) | 409 para id repetido; histórico do visitante só `mode = 'visitante'` |
| `packages/core/src/agent-client.ts` (novo) | Helpers puros (erro, storage, produtos, texto) + hooks `useAgentConversation` / `useAgentChat` |
| `packages/core/package.json` (modificar) | Dependência `@ai-sdk/react@4.0.20`; exports `./agent-client`; remove exports do assistente antigo (Task 6) |
| `apps/mypet/app/agente/styles.ts` (novo) | `AGENT_STYLES` |
| `apps/mypet/app/agente/agent-chat.tsx` (novo) | Painel do agente: boas-vindas, cartões de intenção, mensagens, campo |
| `apps/mypet/app/agente/product-cards.tsx` (novo) | Cartões de produto por modo |
| `apps/mypet/app/agente/access-panel.tsx` (novo) | Painel "Acesso completo ao agente" com o `AccessForm` |
| `apps/mypet/app/agente/agent-shell.tsx` (novo) | Layout, cabeçalho, faixa do celular, rodapé |
| `apps/mypet/app/agente/agent-params.ts` (novo) | `initialQuestionFrom` |
| `apps/mypet/app/agente/page.tsx` (novo) | Página: modo pelo `requireBuyer`, `?pergunta=` |
| `apps/mypet/app/_components/pre-access/access-form.tsx` (modificar) | Prop `redirectTo` (padrão `/agente`) |
| `apps/mypet/app/_components/pre-access/agent-entry.tsx` (novo) | Campo da home que leva ao `/agente` |
| `apps/mypet/app/_components/pre-access/commercial-faq.tsx`, `hero.tsx`, `styles.ts`, `apps/mypet/app/page.tsx` (modificar) | Home como porta de entrada |
| `packages/core/src/components/site-nav.tsx` (modificar) | Prop opcional `agenteHref` |
| `apps/mypet/app/pedido-rapido/page.tsx`, `cotacao/page.tsx`, `pedidos/page.tsx` (modificar) | Menu do cliente com "Agente"; marca leva a `/agente` |
| Remover (Task 6) | `apps/mypet/app/api/duvidas/route.ts`, `apps/mypet/app/_components/pre-access/faq-assistant.tsx` (+test), `packages/core/src/support-assistant-client.ts` (+test), `packages/core/src/support-assistant-server.ts` (+test) |

---

### Task 1: Servidor — id repetido e histórico do visitante

**Files:**
- Modify: `packages/core/src/agent-conversations.ts` (`loadHistory`)
- Modify: `packages/core/src/agent-server.ts` (trecho que carrega o histórico)
- Test: `packages/core/src/agent-conversations.test.ts`, `packages/core/src/agent-server.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function loadHistory(
    supabase: SupabaseClient, conversationId: string, options?: { onlyMode?: AgentMode },
  ): Promise<UIMessage[]>;
  // /api/agente: 409 { ok:false, error:{ code:"MESSAGE_DUPLICATE", message } } quando message.id já está no histórico
  ```

- [ ] **Step 1: Write the failing tests**

Em `packages/core/src/agent-conversations.test.ts`, dentro do `describe("loadHistory", ...)`, adicionar:

```ts
  it("com onlyMode filtra pelo modo da mensagem", async () => {
    const { client, calls } = fakeSupabase({ agent_messages: [{ data: [] }] });
    await loadHistory(client, "conv-1", { onlyMode: "visitante" });
    expect(calls).toContainEqual({ table: "agent_messages", method: "eq", args: ["mode", "visitante"] });
  });

  it("sem onlyMode não filtra por modo", async () => {
    const { client, calls } = fakeSupabase({ agent_messages: [{ data: [] }] });
    await loadHistory(client, "conv-1");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "mode")).toBe(false);
  });
```

Em `packages/core/src/agent-server.test.ts`, dentro do `describe("POST /api/agente", ...)`, adicionar (a constante `userMessage` tem id `"m1"`):

```ts
  it("409 quando o id da pergunta já está no histórico, sem chamar a IA", async () => {
    const model = textModel("Oi.");
    useModels(model);
    (loadHistory as Mock).mockResolvedValueOnce([
      { id: "m1", role: "user", parts: [{ type: "text", text: "Tem shampoo?" }] },
    ]);
    const res = await handler()(makeRequest(validBody));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("MESSAGE_DUPLICATE");
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("visitante carrega só o histórico do modo visitante; cliente carrega tudo", async () => {
    useModels(textModel("Oi."));
    await (await handler()(makeRequest(validBody))).text();
    expect(loadHistory).toHaveBeenLastCalledWith(expect.anything(), conversationId, { onlyMode: "visitante" });
    useModels(textModel("Oi."));
    await (await handler({ id: "b1", empresa: null })(makeRequest(validBody))).text();
    expect(loadHistory).toHaveBeenLastCalledWith(expect.anything(), conversationId, {});
  });
```

Se já existir um teste que espera que um id repetido seja **filtrado** do histórico (comportamento antigo, "histórico sem a pergunta repetida"), substituí-lo por este de 409.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-conversations.test.ts src/agent-server.test.ts`
Expected: FAIL nos novos testes.

- [ ] **Step 3: Write the implementation**

Em `agent-conversations.ts`, trocar a assinatura e a consulta de `loadHistory`:

```ts
export async function loadHistory(
  supabase: SupabaseClient,
  conversationId: string,
  options: { onlyMode?: AgentMode } = {},
): Promise<UIMessage[]> {
  try {
    let query = supabase
      .from("agent_messages")
      .select("message_id, role, parts")
      .eq("conversation_id", conversationId);
    // Visitante nunca recebe no contexto mensagens do modo cliente (têm preço),
    // mesmo que a regra de posse falhe por corrida.
    if (options.onlyMode) query = query.eq("mode", options.onlyMode);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(HISTORY_LIMIT);
    if (error) throw new Error(error.message);
    return ((data as StoredMessageRow[] | null) ?? [])
      .reverse()
      .map((row) => ({ id: row.message_id, role: row.role, parts: row.parts }));
  } catch (error) {
    console.error("[agent-conversations] falha ao carregar histórico:", error);
    return [];
  }
}
```

(Se a ordem `eq` → `order` → `limit` do fake exigir, ajuste só a ordem das chamadas; a consulta real do supabase-js aceita filtros antes de `order`.)

Em `agent-server.ts`, trocar o trecho

```ts
    // O id da pergunta vem do navegador: se já estiver no histórico (reenvio,
    // ou id de uma resposta), a versão do banco sai para não duplicar.
    const history = (store ? await loadHistory(store, id) : []).filter((item) => item.id !== message.id);
```

por

```ts
    const history = store
      ? await loadHistory(store, id, mode === "visitante" ? { onlyMode: "visitante" } : {})
      : [];
    // Cada envio do navegador usa um id novo; id repetido (reenvio ou id de uma
    // resposta) deixaria o histórico inconsistente.
    if (history.some((item) => item.id === message.id)) {
      return errorResponse(409, "MESSAGE_DUPLICATE", "Esta mensagem já foi enviada. Comece uma nova conversa.");
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-`
Expected: PASS (todos os arquivos `agent-*`).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-conversations.ts packages/core/src/agent-conversations.test.ts packages/core/src/agent-server.ts packages/core/src/agent-server.test.ts
git commit -m "fix(agente): 409 para id de mensagem repetido e histórico do visitante só do modo visitante

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Cliente do agente no core (`agent-client.ts`)

**Files:**
- Modify: `packages/core/package.json` (dependência + export)
- Create: `packages/core/src/agent-client.ts`
- Test: `packages/core/src/agent-client.test.ts`

**Interfaces:**
- Consumes: `type AgentProduct` (`./agent-catalog-tool`, só `import type`), `type AgentCartItem` (`./agent-prompt`, só `import type`); `useChat` (`@ai-sdk/react`), `DefaultChatTransport`, `type UIMessage` (`ai`).
- Produces:
  ```ts
  export type AgentMessage = UIMessage;
  export type { AgentProduct, AgentCartItem };
  export type StoredConversation = { id: string; messages: AgentMessage[] };
  export type AgentError = { code: string | null; message: string };
  export const AGENT_STORAGE_KEY = "mypet-agente-conversa";
  export function parseAgentError(error: Error): AgentError;
  export function loadStoredConversation(storage: Storage | null): StoredConversation | null;
  export function saveStoredConversation(storage: Storage | null, conversation: StoredConversation): void;
  export function newConversation(): StoredConversation;
  export function messageText(message: AgentMessage): string;
  export function productsFromMessage(message: AgentMessage): AgentProduct[]; // até 5
  export function useAgentConversation(): {
    conversation: StoredConversation | null; reset: (notice?: string) => void; notice: string | null;
  };
  export function useAgentChat(input: {
    conversation: StoredConversation;
    getCart?: () => AgentCartItem[];
    onConversationReset: (notice: string) => void;
  }): { messages: AgentMessage[]; sendText: (text: string) => boolean; busy: boolean; error: AgentError | null };
  ```

- [ ] **Step 1: Instalar a dependência**

Run: `pnpm --filter @mypet/core add @ai-sdk/react@4.0.20`
Depois conferir em `packages/core/package.json` que ficou `"@ai-sdk/react": "4.0.20"` (versão exata, sem `^` — é a que depende de `ai@7.0.19`, a mesma do projeto). Se o pnpm gravar com `^`, editar para a versão exata e rodar `pnpm install`.
Run: `pnpm --filter @mypet/core exec node -e "console.log(require('@ai-sdk/react/package.json').dependencies.ai)"` → Expected: `7.0.19`.

No bloco `"exports"` de `packages/core/package.json`, adicionar antes de `"./agent-server"`:

```json
    "./agent-client": "./src/agent-client.ts",
```

- [ ] **Step 2: Write the failing test**

Criar `packages/core/src/agent-client.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  AGENT_STORAGE_KEY,
  loadStoredConversation,
  messageText,
  newConversation,
  parseAgentError,
  productsFromMessage,
  saveStoredConversation,
  type AgentMessage,
} from "./agent-client";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

const uuid = "3f1c2a7e-8b4d-4c1a-9f2e-1a2b3c4d5e6f";
const userMsg: AgentMessage = { id: "m1", role: "user", parts: [{ type: "text", text: "Tem shampoo?" }] };

const product = (i: number) => ({
  id: `p${i}`,
  name: `Shampoo ${i}`,
  sku: `S${i}`,
  brand: "Pet Clean",
  variantLabel: null,
  img: "/x.jpg",
  unitPrice: null,
  priceLabel: null,
});

describe("parseAgentError", () => {
  it("lê o formato { ok:false, error:{ code, message } }", () => {
    const error = new Error(JSON.stringify({ ok: false, error: { code: "RATE_LIMITED", message: "Aguarde." } }));
    expect(parseAgentError(error)).toEqual({ code: "RATE_LIMITED", message: "Aguarde." });
  });

  it("lê o formato { error: '...' } do rejectForeignRequest", () => {
    expect(parseAgentError(new Error(JSON.stringify({ error: "Origem não permitida." })))).toEqual({
      code: null,
      message: "Origem não permitida.",
    });
  });

  it("texto que não é JSON vira mensagem genérica", () => {
    expect(parseAgentError(new Error("Failed to fetch"))).toEqual({
      code: null,
      message: "Não foi possível responder agora. Tente novamente em instantes.",
    });
  });
});

describe("conversa no storage", () => {
  it("salva e recarrega", () => {
    const storage = memoryStorage();
    saveStoredConversation(storage, { id: uuid, messages: [userMsg] });
    expect(loadStoredConversation(storage)).toEqual({ id: uuid, messages: [userMsg] });
  });

  it("guarda no máximo as 40 últimas mensagens", () => {
    const storage = memoryStorage();
    const messages = Array.from({ length: 45 }, (_, i) => ({ ...userMsg, id: `m${i}` }));
    saveStoredConversation(storage, { id: uuid, messages });
    const loaded = loadStoredConversation(storage);
    expect(loaded?.messages).toHaveLength(40);
    expect(loaded?.messages[0].id).toBe("m5");
  });

  it("conteúdo inválido ou ausente devolve null", () => {
    expect(loadStoredConversation(null)).toBeNull();
    expect(loadStoredConversation(memoryStorage())).toBeNull();
    expect(loadStoredConversation(memoryStorage({ [AGENT_STORAGE_KEY]: "{" }))).toBeNull();
    expect(
      loadStoredConversation(memoryStorage({ [AGENT_STORAGE_KEY]: JSON.stringify({ id: "x", messages: [] }) })),
    ).toBeNull();
    expect(
      loadStoredConversation(
        memoryStorage({ [AGENT_STORAGE_KEY]: JSON.stringify({ id: uuid, messages: [{ id: 1 }] }) }),
      ),
    ).toBeNull();
  });

  it("storage que lança não quebra", () => {
    const broken = memoryStorage();
    broken.setItem = () => {
      throw new Error("quota");
    };
    broken.getItem = () => {
      throw new Error("bloqueado");
    };
    expect(() => saveStoredConversation(broken, { id: uuid, messages: [] })).not.toThrow();
    expect(loadStoredConversation(broken)).toBeNull();
  });

  it("newConversation gera uuid e começa vazia", () => {
    const conversation = newConversation();
    expect(conversation.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(conversation.messages).toEqual([]);
  });
});

describe("mensagens", () => {
  it("messageText junta só as partes de texto", () => {
    const message = {
      id: "a1",
      role: "assistant",
      parts: [{ type: "step-start" }, { type: "text", text: "Encontrei " }, { type: "text", text: "estas." }],
    } as AgentMessage;
    expect(messageText(message)).toBe("Encontrei estas.");
  });

  it("productsFromMessage usa a última busca concluída e limita a 5", () => {
    const message = {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "tool-buscar_produtos", toolCallId: "c1", state: "output-available", input: {}, output: { total: 1, produtos: [product(99)] } },
        { type: "tool-buscar_produtos", toolCallId: "c2", state: "input-available", input: {} },
        {
          type: "tool-buscar_produtos",
          toolCallId: "c3",
          state: "output-available",
          input: {},
          output: { total: 7, produtos: Array.from({ length: 7 }, (_, i) => product(i)) },
        },
      ],
    } as unknown as AgentMessage;
    const products = productsFromMessage(message);
    expect(products.map((p) => p.id)).toEqual(["p0", "p1", "p2", "p3", "p4"]);
  });

  it("productsFromMessage descarta itens malformados", () => {
    const message = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-buscar_produtos",
          toolCallId: "c1",
          state: "output-available",
          input: {},
          output: { total: 2, produtos: [product(1), { id: 2 }] },
        },
      ],
    } as unknown as AgentMessage;
    expect(productsFromMessage(message).map((p) => p.id)).toEqual(["p1"]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-client.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-client"`.

- [ ] **Step 4: Write the implementation**

Criar `packages/core/src/agent-client.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { AgentProduct } from "./agent-catalog-tool";
import type { AgentCartItem } from "./agent-prompt";

// Lado do navegador do agente /agente. A conversa fica no sessionStorage para
// sobreviver ao recarregamento depois do cadastro feito no meio da conversa.
// Ao servidor vão só { id, message, cart }: o histórico ele lê do banco.

export type AgentMessage = UIMessage;
export type { AgentProduct, AgentCartItem };
export type StoredConversation = { id: string; messages: AgentMessage[] };
export type AgentError = { code: string | null; message: string };

export const AGENT_API = "/api/agente";
export const AGENT_STORAGE_KEY = "mypet-agente-conversa";
const MAX_STORED_MESSAGES = 40;
const MAX_CARD_PRODUCTS = 5;
const GENERIC_ERROR = "Não foi possível responder agora. Tente novamente em instantes.";
const RESET_NOTICE = "Começamos uma nova conversa. Envie sua pergunta de novo.";
const RESET_CODES = new Set(["CONVERSATION_FORBIDDEN", "MESSAGE_DUPLICATE"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAgentError(error: Error): AgentError {
  try {
    const data = JSON.parse(error.message) as { error?: unknown };
    if (data.error && typeof data.error === "object") {
      const { code, message } = data.error as { code?: unknown; message?: unknown };
      if (typeof message === "string") return { code: typeof code === "string" ? code : null, message };
    }
    if (typeof data.error === "string") return { code: null, message: data.error };
  } catch {
    // não é JSON: erro de rede ou erro no meio do stream
  }
  return { code: null, message: GENERIC_ERROR };
}

function isStoredMessage(value: unknown): value is AgentMessage {
  if (!value || typeof value !== "object") return false;
  const { id, role, parts } = value as Record<string, unknown>;
  return typeof id === "string" && (role === "user" || role === "assistant") && Array.isArray(parts);
}

export function loadStoredConversation(storage: Storage | null): StoredConversation | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(AGENT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { id?: unknown; messages?: unknown };
    if (typeof data.id !== "string" || !UUID_PATTERN.test(data.id)) return null;
    if (!Array.isArray(data.messages) || !data.messages.every(isStoredMessage)) return null;
    return { id: data.id, messages: data.messages.slice(-MAX_STORED_MESSAGES) };
  } catch {
    return null;
  }
}

export function saveStoredConversation(storage: Storage | null, conversation: StoredConversation): void {
  if (!storage) return;
  try {
    storage.setItem(
      AGENT_STORAGE_KEY,
      JSON.stringify({ id: conversation.id, messages: conversation.messages.slice(-MAX_STORED_MESSAGES) }),
    );
  } catch {
    // storage cheio ou bloqueado: a conversa segue só em memória
  }
}

export function newConversation(): StoredConversation {
  return { id: crypto.randomUUID(), messages: [] };
}

function safeSessionStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function messageText(message: AgentMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function isAgentProduct(value: unknown): value is AgentProduct {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  const nullableString = (v: unknown) => v === null || typeof v === "string";
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.sku === "string" &&
    typeof p.img === "string" &&
    nullableString(p.brand) &&
    nullableString(p.variantLabel) &&
    nullableString(p.priceLabel) &&
    (p.unitPrice === null || typeof p.unitPrice === "number")
  );
}

export function productsFromMessage(message: AgentMessage): AgentProduct[] {
  let products: AgentProduct[] = [];
  for (const part of message.parts) {
    const toolPart = part as { type: string; state?: string; output?: { produtos?: unknown } };
    if (toolPart.type !== "tool-buscar_produtos" || toolPart.state !== "output-available") continue;
    const list = toolPart.output?.produtos;
    if (Array.isArray(list)) products = list.filter(isAgentProduct);
  }
  return products.slice(0, MAX_CARD_PRODUCTS);
}

// Carrega a conversa só depois de montar (sessionStorage não existe no servidor
// e o HTML inicial precisa ser igual no servidor e no navegador).
export function useAgentConversation() {
  const [conversation, setConversation] = useState<StoredConversation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setConversation(loadStoredConversation(safeSessionStorage()) ?? newConversation());
  }, []);

  const reset = useCallback((message?: string) => {
    const fresh = newConversation();
    saveStoredConversation(safeSessionStorage(), fresh);
    setNotice(message ?? null);
    setConversation(fresh);
  }, []);

  return { conversation, reset, notice };
}

export function useAgentChat({
  conversation,
  getCart,
  onConversationReset,
}: {
  conversation: StoredConversation;
  getCart?: () => AgentCartItem[];
  onConversationReset: (notice: string) => void;
}) {
  const getCartRef = useRef(getCart);
  getCartRef.current = getCart;

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AgentMessage>({
        api: AGENT_API,
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { id, message: messages[messages.length - 1], cart: getCartRef.current?.() ?? [] },
        }),
      }),
    [],
  );

  const chat = useChat<AgentMessage>({ id: conversation.id, messages: conversation.messages, transport });

  useEffect(() => {
    saveStoredConversation(safeSessionStorage(), { id: conversation.id, messages: chat.messages });
  }, [conversation.id, chat.messages]);

  const error = chat.error ? parseAgentError(chat.error) : null;
  const errorCode = error?.code ?? null;
  useEffect(() => {
    if (errorCode && RESET_CODES.has(errorCode)) onConversationReset(RESET_NOTICE);
  }, [errorCode, onConversationReset]);

  const busy = chat.status === "submitted" || chat.status === "streaming";
  const { sendMessage } = chat;
  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return false;
      void sendMessage({ text: trimmed });
      return true;
    },
    [busy, sendMessage],
  );

  return { messages: chat.messages, sendText, busy, error };
}
```

Conferir os tipos em `node_modules/.pnpm/@ai-sdk+react@4.0.20*/node_modules/@ai-sdk/react/dist/index.d.ts` (`useChat` aceita `id`, `messages`, `transport`; devolve `messages`, `sendMessage`, `status`, `error`). Se algum nome divergir, ajustar sem mudar o comportamento e registrar no relatório.

- [ ] **Step 5: Run tests and type check**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-client.test.ts` → Expected: PASS (13 testes).
Run: `pnpm --filter @mypet/core exec tsc --noEmit 2>&1 | grep -E "agent-client"` → Expected: nada.

- [ ] **Step 6: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml packages/core/src/agent-client.ts packages/core/src/agent-client.test.ts
git commit -m "feat(agente): cliente do agente no navegador (useChat, conversa no sessionStorage, erros)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Painel do agente (chat, intenções e cartões de produto)

**Files:**
- Create: `apps/mypet/app/agente/styles.ts`
- Create: `apps/mypet/app/agente/product-cards.tsx`
- Create: `apps/mypet/app/agente/agent-chat.tsx`
- Test: `apps/mypet/app/agente/agent-chat.test.tsx`

**Interfaces:**
- Consumes: `useAgentConversation`, `useAgentChat`, `messageText`, `productsFromMessage`, `type AgentMessage`, `type AgentProduct` (`@mypet/core/agent-client`); `useCart` (`@mypet/core/components/cart-provider`).
- Produces:
  ```ts
  export type AgentPageMode = "visitante" | "cliente";
  export function AgentChat(props: {
    mode: AgentPageMode;
    initialQuestion: string | null;
    onInitialQuestionUsed: () => void;
    onLockedIntent: (reason: string) => void;
  }): JSX.Element;
  export const AGENT_STYLES: string;
  ```

- [ ] **Step 1: Write the failing test**

Criar `apps/mypet/app/agente/agent-chat.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AgentMessage } from "@mypet/core/agent-client";

const chat = vi.hoisted(() => ({
  state: {
    messages: [] as AgentMessage[],
    busy: false,
    error: null as { code: string | null; message: string } | null,
  },
  sendText: vi.fn(() => true),
}));

vi.mock("@mypet/core/agent-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mypet/core/agent-client")>();
  return {
    ...actual,
    useAgentConversation: () => ({
      conversation: { id: "3f1c2a7e-8b4d-4c1a-9f2e-1a2b3c4d5e6f", messages: [] },
      reset: vi.fn(),
      notice: null,
    }),
    useAgentChat: () => ({ ...chat.state, sendText: chat.sendText }),
  };
});
vi.mock("@mypet/core/components/cart-provider", () => ({ useCart: () => ({ cart: { items: [] } }) }));

import { AgentChat } from "./agent-chat";

const product = {
  id: "p1",
  name: "Shampoo Neutro",
  sku: "S1",
  brand: "Pet Clean",
  variantLabel: "5L",
  img: "/x.jpg",
  unitPrice: 89.9,
  priceLabel: "R$ 89,90",
};

function assistantWithProducts(priced: boolean): AgentMessage {
  return {
    id: "a1",
    role: "assistant",
    parts: [
      {
        type: "tool-buscar_produtos",
        toolCallId: "c1",
        state: "output-available",
        input: { query: "shampoo" },
        output: { total: 1, produtos: [priced ? product : { ...product, unitPrice: null, priceLabel: null }] },
      },
      { type: "text", text: "Encontrei estas opções. Veja também /central-de-ajuda/a/frete." },
    ],
  } as unknown as AgentMessage;
}

function renderChat(mode: "visitante" | "cliente", extra: Partial<Parameters<typeof AgentChat>[0]> = {}) {
  const props = {
    mode,
    initialQuestion: null,
    onInitialQuestionUsed: vi.fn(),
    onLockedIntent: vi.fn(),
    ...extra,
  };
  render(<AgentChat {...props} />);
  return props;
}

beforeEach(() => {
  chat.state = { messages: [], busy: false, error: null };
  chat.sendText.mockClear();
});

describe("AgentChat", () => {
  it("visitante: boas-vindas com intenções livres e com cadeado", () => {
    const props = renderChat("visitante");
    expect(screen.getByRole("heading", { name: "Como posso te ajudar hoje?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Frete e prazos de entrega/ }));
    expect(chat.sendText).toHaveBeenCalledWith("Como funciona o frete e qual o prazo de entrega?");

    fireEvent.click(screen.getByRole("button", { name: /Ver preços/ }));
    expect(props.onLockedIntent).toHaveBeenCalledWith("Cadastre-se para ver os preços da tabela.");
    expect(chat.sendText).toHaveBeenCalledTimes(1);
  });

  it("cliente: sem intenções com cadeado", () => {
    renderChat("cliente");
    expect(screen.queryByRole("button", { name: /Ver preços/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Encontrar produtos e preços/ })).toBeInTheDocument();
  });

  it("envia a pergunta digitada e limpa o campo", () => {
    renderChat("visitante");
    const input = screen.getByLabelText("Sua pergunta");
    fireEvent.change(input, { target: { value: "Tem shampoo?" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(chat.sendText).toHaveBeenCalledWith("Tem shampoo?");
    expect(input).toHaveValue("");
  });

  it("visitante: produtos sem preço, com convite ao cadastro", () => {
    chat.state.messages = [
      { id: "m1", role: "user", parts: [{ type: "text", text: "Tem shampoo?" }] } as AgentMessage,
      assistantWithProducts(false),
    ];
    const props = renderChat("visitante");
    expect(screen.getByText("Tem shampoo?")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Produtos encontrados" })).toHaveTextContent("Shampoo Neutro — 5L");
    expect(screen.queryByText(/R\$/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cadastre-se para ver o preço" }));
    expect(props.onLockedIntent).toHaveBeenCalledWith("Cadastre-se para ver os preços da tabela.");
    expect(screen.getByRole("link", { name: "/central-de-ajuda/a/frete" })).toHaveAttribute(
      "href",
      "/central-de-ajuda/a/frete",
    );
  });

  it("cliente: produtos com preço e link para a tabela", () => {
    chat.state.messages = [assistantWithProducts(true)];
    renderChat("cliente");
    expect(screen.getByText("R$ 89,90")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver na tabela" })).toHaveAttribute("href", "/pedido-rapido");
  });

  it("mostra o erro", () => {
    chat.state.error = { code: "RATE_LIMITED", message: "Aguarde alguns minutos." };
    renderChat("visitante");
    expect(screen.getByRole("alert")).toHaveTextContent("Aguarde alguns minutos.");
  });

  it("envia a pergunta inicial uma vez e avisa que foi usada", () => {
    const props = renderChat("visitante", { initialQuestion: "Qual o pedido mínimo?" });
    expect(chat.sendText).toHaveBeenCalledWith("Qual o pedido mínimo?");
    expect(props.onInitialQuestionUsed).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter mypet exec vitest run app/agente/agent-chat.test.tsx`
Expected: FAIL — `Failed to resolve import "./agent-chat"`.

- [ ] **Step 3: Write the styles**

Criar `apps/mypet/app/agente/styles.ts` (usa os tokens `--pa-*` do `LANDING_STYLES`, que a página também carrega):

```ts
export const AGENT_STYLES = `
  .ag-page { min-height: 100vh; display: flex; flex-direction: column; background: var(--pa-bg-soft); }
  .ag-header-links { display: flex; align-items: center; gap: 18px; }
  .ag-header-links a { color: var(--pa-muted); text-decoration: none; font-weight: 500; font-size: 14px; }
  .ag-header-links a:hover { color: var(--pa-navy); }

  .ag-main { flex: 1; width: 100%; max-width: 1180px; margin: 0 auto; padding: 24px; display: grid; gap: 24px; align-items: start; }
  .ag-main--split { grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.9fr); }

  .ag-chat { background: #fff; border: 1px solid var(--pa-line); border-radius: var(--pa-r-card); display: flex; flex-direction: column; height: calc(100vh - 68px - 96px); min-height: 520px; overflow: hidden; }
  .ag-chat-head { display: flex; align-items: center; gap: 10px; padding: 16px 20px; border-bottom: 1px solid var(--pa-line); }
  .ag-chat-head h1 { margin: 0; font-family: var(--pa-geist); font-weight: 700; font-size: 17px; color: var(--pa-navy); }
  .ag-spark { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 10px; background: var(--pa-navy); color: #fff; font-size: 16px; }
  .ag-log { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }

  .ag-welcome h2 { margin: 8px 0 6px; font-family: var(--pa-geist); font-weight: 700; font-size: 22px; color: var(--pa-ink); }
  .ag-welcome > p { margin: 0 0 16px; color: var(--pa-muted); font-size: 14px; line-height: 1.5; }
  .ag-intents { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .ag-intent { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; background: #fff; border: 1px solid var(--pa-line); border-radius: 12px; font: inherit; font-size: 15px; color: var(--pa-ink); text-align: left; cursor: pointer; transition: border-color .15s ease, background .15s ease; }
  .ag-intent:hover { border-color: var(--pa-navy); }
  .ag-intent:disabled { opacity: .6; cursor: default; }
  .ag-intent--locked { background: var(--pa-bg-soft); color: var(--pa-muted); }
  .ag-intents-sep { margin: 18px 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--pa-muted); }

  .ag-turn { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .ag-msg { margin: 0; max-width: 85%; padding: 10px 14px; border-radius: 14px; background: var(--pa-bg-soft); color: var(--pa-ink); font-size: 15px; line-height: 1.55; overflow-wrap: anywhere; }
  .ag-msg a { color: var(--pa-green-dark); font-weight: 600; }
  .ag-msg--user { align-self: flex-end; background: var(--pa-navy); color: #fff; }
  .ag-msg--muted { color: var(--pa-muted); }
  .ag-notice { margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--pa-green-soft); color: var(--pa-green-dark); font-size: 14px; }

  .ag-products { list-style: none; margin: 0; padding: 0; align-self: stretch; display: flex; flex-direction: column; gap: 8px; }
  .ag-product { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--pa-line); border-radius: 12px; background: #fff; }
  .ag-product-img { width: 48px; height: 48px; object-fit: contain; border-radius: 8px; background: var(--pa-bg-soft); flex: 0 0 auto; }
  .ag-product-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ag-product-name { font-weight: 600; color: var(--pa-ink); font-size: 14px; overflow-wrap: anywhere; }
  .ag-product-brand { color: var(--pa-muted); font-size: 13px; }
  .ag-product-side { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex: 0 0 auto; }
  .ag-product-price { font-weight: 700; color: var(--pa-navy); font-size: 15px; }
  .ag-product-link { color: var(--pa-green-dark); font-weight: 600; font-size: 13px; text-decoration: none; }
  .ag-product-lock { flex: 0 0 auto; background: none; border: 0; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--pa-green-dark); cursor: pointer; text-align: right; }

  .ag-error { margin: 0 20px 8px; color: #B42318; font-size: 14px; }
  .ag-form { display: flex; gap: 8px; margin: 0 16px; padding: 6px; border: 1.5px solid var(--pa-navy); border-radius: 14px; background: #fff; }
  .ag-form input { flex: 1; min-width: 0; border: 0; padding: 10px; font: inherit; font-size: 15px; color: var(--pa-ink); background: transparent; }
  .ag-form input:focus { outline: none; }
  .ag-form button { width: 40px; height: 40px; border: 0; border-radius: 10px; background: var(--pa-green); color: #fff; font-size: 18px; font-weight: 700; cursor: pointer; }
  .ag-form button:disabled { background: var(--pa-line); color: var(--pa-muted); cursor: default; }
  .ag-disclaimer { margin: 8px 16px 14px; text-align: center; color: var(--pa-muted); font-size: 12px; }

  .ag-access { position: sticky; top: 92px; }
  .ag-access h2 { font-family: var(--pa-geist); font-weight: 700; color: var(--pa-navy); font-size: 22px; margin: 0 0 8px; }
  .ag-access-lead { color: var(--pa-muted); font-size: 14px; line-height: 1.55; margin: 0 0 12px; }
  .ag-access-reason { margin: 0 0 12px; padding: 10px 12px; border-radius: 10px; background: var(--pa-green-soft); color: var(--pa-green-dark); font-weight: 600; font-size: 14px; }
  .ag-benefits { list-style: none; margin: 0 0 6px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ag-benefits li { font-size: 14px; color: var(--pa-ink); }
  .ag-benefits li::before { content: "✓ "; color: var(--pa-green); font-weight: 700; }
  .ag-access-close { display: none; }
  .ag-unlock-bar { display: none; }

  .ag-footer { padding: 16px 24px 24px; text-align: center; color: var(--pa-muted); font-size: 12px; line-height: 1.5; }

  @media (max-width: 900px) {
    .ag-main, .ag-main--split { grid-template-columns: 1fr; padding: 12px 12px 88px; }
    .ag-chat { height: calc(100dvh - 68px - 100px); min-height: 420px; }
    .ag-access { display: none; position: fixed; top: auto; left: 0; right: 0; bottom: 0; z-index: 60; max-height: 88dvh; overflow-y: auto; border-radius: 20px 20px 0 0; box-shadow: 0 -16px 40px rgba(15,31,69,0.25); }
    .ag-access.is-open { display: block; }
    .ag-access-close { display: block; position: absolute; top: 10px; right: 12px; width: 36px; height: 36px; border: 0; border-radius: 50%; background: var(--pa-bg-soft); font-size: 20px; color: var(--pa-navy); cursor: pointer; }
    .ag-unlock-bar { display: block; position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 50; padding: 15px; border: 0; border-radius: var(--pa-r-pill); background: var(--pa-green); color: #fff; font-family: var(--pa-geist); font-weight: 600; font-size: 15px; box-shadow: 0 10px 24px rgba(0,166,81,0.35); cursor: pointer; }
    .ag-msg { max-width: 92%; }
    .ag-header-links a.ag-hide-mobile { display: none; }
  }
`;
```

- [ ] **Step 4: Write the product cards**

Criar `apps/mypet/app/agente/product-cards.tsx`:

```tsx
import type { AgentProduct } from "@mypet/core/agent-client";
import type { AgentPageMode } from "./agent-chat";

export const PRICE_LOCK_REASON = "Cadastre-se para ver os preços da tabela.";

export function ProductCards({
  products,
  mode,
  onLockedIntent,
}: {
  products: AgentProduct[];
  mode: AgentPageMode;
  onLockedIntent: (reason: string) => void;
}) {
  return (
    <ul className="ag-products" aria-label="Produtos encontrados">
      {products.map((p) => (
        <li key={p.id} className="ag-product">
          <img src={p.img} alt="" className="ag-product-img" />
          <div className="ag-product-info">
            <span className="ag-product-name">
              {p.name}
              {p.variantLabel ? ` — ${p.variantLabel}` : ""}
            </span>
            {p.brand && <span className="ag-product-brand">{p.brand}</span>}
          </div>
          {mode === "cliente" ? (
            <div className="ag-product-side">
              <span className="ag-product-price">{p.priceLabel ?? "Sob consulta"}</span>
              <a href="/pedido-rapido" className="ag-product-link">
                Ver na tabela
              </a>
            </div>
          ) : (
            <button type="button" className="ag-product-lock" onClick={() => onLockedIntent(PRICE_LOCK_REASON)}>
              Cadastre-se para ver o preço
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Write the chat**

Criar `apps/mypet/app/agente/agent-chat.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  messageText,
  productsFromMessage,
  useAgentChat,
  useAgentConversation,
  type AgentMessage,
  type StoredConversation,
} from "@mypet/core/agent-client";
import { useCart } from "@mypet/core/components/cart-provider";
import { PRICE_LOCK_REASON, ProductCards } from "./product-cards";

export type AgentPageMode = "visitante" | "cliente";

type AgentChatProps = {
  mode: AgentPageMode;
  initialQuestion: string | null;
  onInitialQuestionUsed: () => void;
  onLockedIntent: (reason: string) => void;
};

type Intent = { label: string; question: string };
type LockedIntent = { label: string; reason: string };

const SHARED_INTENTS: Intent[] = [
  { label: "Frete e prazos de entrega", question: "Como funciona o frete e qual o prazo de entrega?" },
  { label: "Pagamento e pedido mínimo", question: "Quais são as formas de pagamento e o pedido mínimo?" },
];

const VISITOR_INTENTS: Intent[] = [
  { label: "Encontrar produtos", question: "Quais produtos vocês têm para o meu pet shop?" },
  ...SHARED_INTENTS,
];

const CLIENT_INTENTS: Intent[] = [
  { label: "Encontrar produtos e preços", question: "Quero ver produtos e preços." },
  ...SHARED_INTENTS,
];

const LOCKED_INTENTS: LockedIntent[] = [
  { label: "Ver preços", reason: PRICE_LOCK_REASON },
  { label: "Montar meu pedido", reason: "Cadastre-se para montar seu pedido conversando com o agente." },
  { label: "Acompanhar meus pedidos", reason: "Cadastre-se para acompanhar seus pedidos por aqui." },
];

// Caminhos internos citados pelo agente viram links.
const LINK_PATTERN = /(\/(?:central-de-ajuda(?:\/[a-z0-9-]+)*|cadastro|perguntas-frequentes|pedido-rapido|pedidos))/g;

function renderWithLinks(text: string) {
  return text.split(LINK_PATTERN).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part}>
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export function AgentChat(props: AgentChatProps) {
  const { conversation, reset, notice } = useAgentConversation();
  if (!conversation) {
    return (
      <section className="ag-chat" aria-labelledby="ag-chat-title" aria-busy="true">
        <ChatHead />
      </section>
    );
  }
  return <AgentChatSession key={conversation.id} conversation={conversation} onReset={reset} notice={notice} {...props} />;
}

function ChatHead() {
  return (
    <header className="ag-chat-head">
      <span className="ag-spark" aria-hidden>
        ✦
      </span>
      <h1 id="ag-chat-title">Agente My Pet</h1>
    </header>
  );
}

function AgentChatSession({
  conversation,
  onReset,
  notice,
  mode,
  initialQuestion,
  onInitialQuestionUsed,
  onLockedIntent,
}: AgentChatProps & { conversation: StoredConversation; onReset: (notice?: string) => void; notice: string | null }) {
  const { cart } = useCart();
  const { messages, sendText, busy, error } = useAgentChat({
    conversation,
    getCart: () => cart.items.map((item) => ({ id: item.id, name: item.name, qty: item.qty, unitPrice: item.unitPrice })),
    onConversationReset: onReset,
  });
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  // StrictMode roda efeitos duas vezes em desenvolvimento: a ref evita enviar
  // a pergunta inicial em dobro.
  const sentInitial = useRef(false);

  useEffect(() => {
    if (!initialQuestion || sentInitial.current) return;
    sentInitial.current = true;
    onInitialQuestionUsed();
    sendText(initialQuestion);
    // a pergunta já foi enviada: tira o ?pergunta= da URL
    window.history.replaceState(null, "", "/agente");
  }, [initialQuestion, onInitialQuestionUsed, sendText]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy]);

  const intents = mode === "cliente" ? CLIENT_INTENTS : VISITOR_INTENTS;
  const waiting = busy && messages[messages.length - 1]?.role === "user";

  return (
    <section className="ag-chat" aria-labelledby="ag-chat-title">
      <ChatHead />
      <div ref={logRef} className="ag-log" aria-live="polite">
        {notice && (
          <p className="ag-notice" role="status">
            {notice}
          </p>
        )}
        {messages.length === 0 ? (
          <div className="ag-welcome">
            <h2>Como posso te ajudar hoje?</h2>
            <p>
              {mode === "cliente"
                ? "Encontre produtos, confira preços e tire dúvidas sobre pedido, entrega e pagamento."
                : "Tire dúvidas sobre pedido, entrega e pagamento ou encontre produtos da tabela."}
            </p>
            <ul className="ag-intents">
              {intents.map((intent) => (
                <li key={intent.label}>
                  <button type="button" className="ag-intent" disabled={busy} onClick={() => sendText(intent.question)}>
                    <span>{intent.label}</span>
                    <span aria-hidden>›</span>
                  </button>
                </li>
              ))}
            </ul>
            {mode === "visitante" && (
              <>
                <p className="ag-intents-sep">Exclusivo para cadastrados</p>
                <ul className="ag-intents">
                  {LOCKED_INTENTS.map((intent) => (
                    <li key={intent.label}>
                      <button
                        type="button"
                        className="ag-intent ag-intent--locked"
                        onClick={() => onLockedIntent(intent.reason)}
                      >
                        <span>
                          <span aria-hidden>🔒 </span>
                          {intent.label}
                        </span>
                        <span aria-hidden>›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <MessageView key={message.id} message={message} mode={mode} onLockedIntent={onLockedIntent} />
          ))
        )}
        {waiting && <p className="ag-msg ag-msg--muted">Pensando…</p>}
      </div>

      {error && (
        <p className="ag-error" role="alert">
          {error.message}
        </p>
      )}

      <form
        className="ag-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (sendText(input)) setInput("");
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pergunte qualquer coisa sobre a My Pet Brasil…"
          aria-label="Sua pergunta"
          maxLength={500}
        />
        <button type="submit" aria-label="Enviar" disabled={busy || !input.trim()}>
          ↑
        </button>
      </form>
      <p className="ag-disclaimer">Respostas automáticas podem conter erros.</p>
    </section>
  );
}

function MessageView({
  message,
  mode,
  onLockedIntent,
}: {
  message: AgentMessage;
  mode: AgentPageMode;
  onLockedIntent: (reason: string) => void;
}) {
  const text = messageText(message);
  if (message.role === "user") return <p className="ag-msg ag-msg--user">{text}</p>;
  const products = productsFromMessage(message);
  return (
    <div className="ag-turn">
      {text && <p className="ag-msg">{renderWithLinks(text)}</p>}
      {products.length > 0 && <ProductCards products={products} mode={mode} onLockedIntent={onLockedIntent} />}
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter mypet exec vitest run app/agente/agent-chat.test.tsx`
Expected: PASS (7 testes). Se o React avisar sobre `act(...)` ou chaves, corrigir antes de seguir (saída limpa).

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/app/agente/styles.ts apps/mypet/app/agente/product-cards.tsx apps/mypet/app/agente/agent-chat.tsx apps/mypet/app/agente/agent-chat.test.tsx
git commit -m "feat(mypet): painel do agente com intenções, cadeados e cartões de produto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Página `/agente` com painel de acesso e versão celular

**Files:**
- Modify: `apps/mypet/app/_components/pre-access/access-form.tsx` (prop `redirectTo`)
- Create: `apps/mypet/app/agente/access-panel.tsx`
- Create: `apps/mypet/app/agente/agent-shell.tsx`
- Create: `apps/mypet/app/agente/agent-params.ts`
- Create: `apps/mypet/app/agente/page.tsx`
- Test: `apps/mypet/app/_components/pre-access/access-form.test.tsx`, `apps/mypet/app/agente/agent-shell.test.tsx`, `apps/mypet/app/agente/page.test.tsx`

**Interfaces:**
- Consumes: `AgentChat`, `type AgentPageMode` (Task 3); `AGENT_STYLES` (Task 3); `LANDING_STYLES` (`../_components/pre-access/styles`); `requireBuyer` (`@/lib/require-buyer`); `clientConfig`.
- Produces:
  ```ts
  export function AccessForm(props?: { submitLabel?: string; redirectTo?: string }): JSX.Element; // redirectTo padrão "/agente"
  export function initialQuestionFrom(raw: string | string[] | undefined): string | null;
  export function AgentShell(props: { mode: AgentPageMode; initialQuestion: string | null }): JSX.Element;
  export async function AgentePageBody(props?: { searchParams?: Promise<{ pergunta?: string | string[] }> }): Promise<JSX.Element>;
  ```

- [ ] **Step 1: Write the failing tests**

1. Em `apps/mypet/app/_components/pre-access/access-form.test.tsx`, trocar `expect(assign).toHaveBeenCalledWith("/pedido-rapido");` por `expect(assign).toHaveBeenCalledWith("/agente");` e adicionar um teste que renderiza `<AccessForm redirectTo="/agente?x=1" />`, faz o mesmo envio com sucesso do primeiro teste e espera `assign` com `"/agente?x=1"` (copiar o arranjo de `fetch`/`assign`/`userEvent` do primeiro teste do arquivo).

2. Criar `apps/mypet/app/agente/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireBuyer = vi.fn();
vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("./agent-shell", () => ({ AgentShell: () => null }));

import { AgentePageBody } from "./page";
import { AgentShell } from "./agent-shell";
import { initialQuestionFrom } from "./agent-params";

beforeEach(() => requireBuyer.mockReset());

describe("initialQuestionFrom", () => {
  it("normaliza a pergunta da URL", () => {
    expect(initialQuestionFrom("  Qual o mínimo? ")).toBe("Qual o mínimo?");
    expect(initialQuestionFrom(["primeira", "segunda"])).toBe("primeira");
    expect(initialQuestionFrom("   ")).toBeNull();
    expect(initialQuestionFrom(undefined)).toBeNull();
    expect(initialQuestionFrom("a".repeat(600))).toHaveLength(500);
  });
});

describe("AgentePageBody", () => {
  it("visitante quando não há comprador", async () => {
    requireBuyer.mockResolvedValue(null);
    const tree = await AgentePageBody({ searchParams: Promise.resolve({ pergunta: "Tem shampoo?" }) });
    expect(tree.type).toBe(AgentShell);
    expect(tree.props).toEqual({ mode: "visitante", initialQuestion: "Tem shampoo?" });
  });

  it("cliente quando há comprador", async () => {
    requireBuyer.mockResolvedValue({ id: "b1" });
    const tree = await AgentePageBody({ searchParams: Promise.resolve({}) });
    expect(tree.props).toEqual({ mode: "cliente", initialQuestion: null });
  });
});
```

3. Criar `apps/mypet/app/agente/agent-shell.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("./agent-chat", () => ({
  AgentChat: ({ onLockedIntent }: { onLockedIntent: (reason: string) => void }) => (
    <button type="button" onClick={() => onLockedIntent("Cadastre-se para ver os preços da tabela.")}>
      cadeado
    </button>
  ),
}));
vi.mock("../_components/pre-access/access-form", () => ({
  AccessForm: ({ redirectTo }: { redirectTo?: string }) => <form aria-label={`cadastro ${redirectTo}`} />,
}));

import { AgentShell } from "./agent-shell";

describe("AgentShell", () => {
  it("visitante: painel de acesso com cadastro que volta para /agente", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} />);
    expect(screen.getByRole("heading", { name: "Acesso completo ao agente" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "cadastro /agente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liberar acesso completo" })).toBeInTheDocument();
  });

  it("cadeado mostra o motivo e abre o painel", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} />);
    fireEvent.click(screen.getByRole("button", { name: "cadeado" }));
    expect(screen.getByRole("status")).toHaveTextContent("Cadastre-se para ver os preços da tabela.");
    expect(screen.getByRole("complementary")).toHaveClass("is-open");
    expect(screen.queryByRole("button", { name: "Liberar acesso completo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.getByRole("complementary")).not.toHaveClass("is-open");
  });

  it("cliente: sem painel de acesso, com links da tabela e dos pedidos", () => {
    render(<AgentShell mode="cliente" initialQuestion={null} />);
    expect(screen.queryByRole("heading", { name: "Acesso completo ao agente" })).toBeNull();
    expect(screen.getByRole("link", { name: "Tabela de preços" })).toHaveAttribute("href", "/pedido-rapido");
    expect(screen.getByRole("link", { name: "Meus pedidos" })).toHaveAttribute("href", "/pedidos");
  });

  it("rodapé informa que as conversas são guardadas", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} />);
    expect(screen.getByText(/conversas com o agente são guardadas/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter mypet exec vitest run app/agente app/_components/pre-access/access-form.test.tsx`
Expected: FAIL (arquivos inexistentes; redirecionamento ainda `/pedido-rapido`).

- [ ] **Step 3: Write the implementation**

1. `access-form.tsx`: trocar a assinatura e o redirecionamento:

```tsx
export function AccessForm({
  submitLabel = "Consultar preços",
  redirectTo = "/agente",
}: { submitLabel?: string; redirectTo?: string } = {}) {
```

e `window.location.assign("/pedido-rapido");` por `window.location.assign(redirectTo);`.

2. Criar `apps/mypet/app/agente/agent-params.ts`:

```ts
const MAX_INITIAL_QUESTION = 500;

// ?pergunta= vindo da home: primeira ocorrência, sem espaços nas pontas, no
// máximo o tamanho que o agente aceita.
export function initialQuestionFrom(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = (value ?? "").trim().slice(0, MAX_INITIAL_QUESTION);
  return trimmed || null;
}
```

3. Criar `apps/mypet/app/agente/access-panel.tsx`:

```tsx
import { AccessForm } from "../_components/pre-access/access-form";

export function AccessPanel({
  reason,
  open,
  onClose,
}: {
  reason: string | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <aside className={open ? "ag-access pa-panel is-open" : "ag-access pa-panel"} aria-labelledby="ag-access-title">
      <button type="button" className="ag-access-close" onClick={onClose} aria-label="Fechar">
        ×
      </button>
      <p className="pa-eyebrow">Tabela de Preços My Pet Brasil</p>
      <h2 id="ag-access-title">Acesso completo ao agente</h2>
      {reason && (
        <p className="ag-access-reason" role="status">
          {reason}
        </p>
      )}
      <p className="ag-access-lead">
        Informe o CNPJ e o WhatsApp da sua empresa e o agente passa a trabalhar com os preços da tabela.
      </p>
      <ul className="ag-benefits">
        <li>Preços da tabela, os mesmos do mypetbrasil.com</li>
        <li>Monta seu pedido conversando</li>
        <li>Sugere o que repor</li>
        <li>Acompanha seus pedidos</li>
      </ul>
      <AccessForm submitLabel="Liberar acesso completo" redirectTo="/agente" />
    </aside>
  );
}
```

4. Criar `apps/mypet/app/agente/agent-shell.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";
import { clientConfig } from "@/client.config";
import { AgentChat, type AgentPageMode } from "./agent-chat";
import { AccessPanel } from "./access-panel";

const { name: SITE_NAME, logo } = clientConfig;

export function AgentShell({ mode, initialQuestion }: { mode: AgentPageMode; initialQuestion: string | null }) {
  const [question, setQuestion] = useState(initialQuestion);
  const [reason, setReason] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isVisitor = mode === "visitante";

  const handleQuestionUsed = useCallback(() => setQuestion(null), []);
  const handleLocked = useCallback((nextReason: string) => {
    setReason(nextReason);
    setSheetOpen(true);
    // no computador o painel já está visível: leva o foco ao primeiro campo
    requestAnimationFrame(() => document.getElementById("pa-cnpj")?.focus());
  }, []);

  return (
    <div className="ag-page">
      <header className="pa-header">
        <div className="pa-wrap pa-header-row">
          <a href="/" className="pa-brand" style={{ textDecoration: "none" }}>
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </a>
          <nav className="ag-header-links" aria-label="Navegação">
            {isVisitor ? (
              <a href="/" className="ag-hide-mobile">
                Voltar para a home
              </a>
            ) : (
              <>
                <a href="/pedido-rapido">Tabela de preços</a>
                <a href="/pedidos">Meus pedidos</a>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className={isVisitor ? "ag-main ag-main--split" : "ag-main"}>
        <AgentChat
          mode={mode}
          initialQuestion={question}
          onInitialQuestionUsed={handleQuestionUsed}
          onLockedIntent={handleLocked}
        />
        {isVisitor && <AccessPanel reason={reason} open={sheetOpen} onClose={() => setSheetOpen(false)} />}
      </main>

      {isVisitor && !sheetOpen && (
        <button type="button" className="ag-unlock-bar" onClick={() => setSheetOpen(true)}>
          Liberar acesso completo
        </button>
      )}

      <footer className="ag-footer">
        As conversas com o agente são guardadas para melhorar o atendimento. Dados de CNPJ e WhatsApp usados apenas
        para liberar a tabela de preços.
      </footer>
    </div>
  );
}
```

5. Criar `apps/mypet/app/agente/page.tsx`:

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { LANDING_STYLES } from "../_components/pre-access/styles";
import { AGENT_STYLES } from "./styles";
import { AgentShell } from "./agent-shell";
import { initialQuestionFrom } from "./agent-params";

export const metadata: Metadata = {
  title: `Agente My Pet - ${clientConfig.name}`,
  description:
    "Tire dúvidas sobre pedido, entrega e pagamento e encontre produtos da tabela de preços da My Pet Brasil.",
};

type AgentePageSearchParams = Promise<{ pergunta?: string | string[] }>;

export default function AgentePage({ searchParams }: { searchParams: AgentePageSearchParams }) {
  return (
    <>
      <style>{LANDING_STYLES}</style>
      <style>{AGENT_STYLES}</style>
      <Suspense fallback={null}>
        <AgentePageBody searchParams={searchParams} />
      </Suspense>
    </>
  );
}

// exported for tests
export async function AgentePageBody({ searchParams }: { searchParams?: AgentePageSearchParams } = {}) {
  const buyer = await requireBuyer();
  const initialQuestion = initialQuestionFrom((await searchParams)?.pergunta);
  return <AgentShell mode={buyer ? "cliente" : "visitante"} initialQuestion={initialQuestion} />;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter mypet exec vitest run app/agente app/_components/pre-access/access-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Build**

Run: `pnpm --filter mypet build`
Expected: build ok, `/agente` listada (dinâmica).

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/app/_components/pre-access/access-form.tsx apps/mypet/app/_components/pre-access/access-form.test.tsx apps/mypet/app/agente/access-panel.tsx apps/mypet/app/agente/agent-shell.tsx apps/mypet/app/agente/agent-shell.test.tsx apps/mypet/app/agente/agent-params.ts apps/mypet/app/agente/page.tsx apps/mypet/app/agente/page.test.tsx
git commit -m "feat(mypet): página /agente com painel de acesso completo e cadastro que volta para o agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Home como porta de entrada e menu do cliente com "Agente"

**Files:**
- Create: `apps/mypet/app/_components/pre-access/agent-entry.tsx`
- Modify: `apps/mypet/app/_components/pre-access/commercial-faq.tsx`, `hero.tsx`, `styles.ts`
- Modify: `apps/mypet/app/page.tsx` (link no cabeçalho)
- Modify: `packages/core/src/components/site-nav.tsx` (prop `agenteHref`)
- Modify: `apps/mypet/app/pedido-rapido/page.tsx`, `apps/mypet/app/cotacao/page.tsx`, `apps/mypet/app/pedidos/page.tsx`
- Test: `apps/mypet/app/_components/pre-access/agent-entry.test.tsx`, `packages/core/src/components/site-nav.test.tsx`, `apps/mypet/app/_components/pre-access/hero.test.tsx`

**Interfaces:**
- Produces: `AgentEntry()`; `SiteNav` aceita `agenteHref?: string` (link "Agente", primeiro da lista, mesmo estilo de "Consulte preços").

- [ ] **Step 1: Write the failing tests**

1. Criar `apps/mypet/app/_components/pre-access/agent-entry.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentEntry } from "./agent-entry";

const assign = vi.fn();

beforeEach(() => {
  assign.mockReset();
  vi.stubGlobal("location", { ...window.location, assign });
});
afterEach(() => vi.unstubAllGlobals());

describe("AgentEntry", () => {
  it("leva a pergunta para o /agente", () => {
    render(<AgentEntry />);
    fireEvent.change(screen.getByLabelText("Sua pergunta para o agente"), { target: { value: " Tem shampoo neutro? " } });
    fireEvent.click(screen.getByRole("button", { name: "Perguntar" }));
    expect(assign).toHaveBeenCalledWith("/agente?pergunta=Tem%20shampoo%20neutro%3F");
  });

  it("sem pergunta abre o /agente", () => {
    render(<AgentEntry />);
    fireEvent.click(screen.getByRole("button", { name: "Perguntar" }));
    expect(assign).toHaveBeenCalledWith("/agente");
  });
});
```

(Se `vi.stubGlobal("location", ...)` não funcionar no jsdom deste projeto, usar o mesmo mecanismo que `access-form.test.tsx` usa para espiar `window.location.assign`.)

2. Em `packages/core/src/components/site-nav.test.tsx`, adicionar um teste que renderiza `SiteNav` com `agenteHref="/agente"` (mesmo arranjo dos testes existentes do arquivo) e espera um link "Agente" com `href="/agente"`.

3. Em `apps/mypet/app/_components/pre-access/hero.test.tsx`, adicionar asserção: link "Perguntar ao agente" com `href="/agente"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter mypet exec vitest run app/_components/pre-access` e `pnpm --filter @mypet/core exec vitest run src/components/site-nav.test.tsx`
Expected: FAIL nos novos testes.

- [ ] **Step 3: Write the implementation**

1. Criar `apps/mypet/app/_components/pre-access/agent-entry.tsx`:

```tsx
"use client";

import { useState } from "react";

export function AgentEntry() {
  const [text, setText] = useState("");

  return (
    <form
      className="pa-ai"
      aria-labelledby="pa-agent-title"
      onSubmit={(event) => {
        event.preventDefault();
        const question = text.trim();
        window.location.assign(question ? `/agente?pergunta=${encodeURIComponent(question)}` : "/agente");
      }}
    >
      <h3 id="pa-agent-title" className="pa-ai-title">
        Não achou sua dúvida? Pergunte ao agente My Pet
      </h3>
      <p className="pa-ai-lead">Ele responde sobre pedido, entrega e pagamento e mostra os produtos da tabela.</p>
      <div className="pa-ai-form">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ex.: vocês têm shampoo neutro?"
          aria-label="Sua pergunta para o agente"
          maxLength={500}
        />
        <button type="submit" className="pa-btn pa-btn-primary">
          Perguntar
        </button>
      </div>
    </form>
  );
}
```

2. `commercial-faq.tsx`: trocar `import { FaqAssistant } from "./faq-assistant";` por `import { AgentEntry } from "./agent-entry";`, `<FaqAssistant channel={clientConfig.catalogChannel} />` por `<AgentEntry />` e remover o import de `clientConfig` (fica sem uso).

3. `hero.tsx`: dentro de `.pa-hero-actions`, depois do link "Abrir tabela de preços", adicionar:

```tsx
            <a href="/agente" className="pa-btn pa-btn-ghost pa-btn-on-dark">Perguntar ao agente</a>
```

e em `styles.ts` (pre-access), logo após a regra `.pa-btn-ghost:hover`, adicionar:

```css
  .pa-btn-on-dark { color: #fff; border-color: rgba(255,255,255,0.55); }
  .pa-btn-on-dark:hover { border-color: #fff; color: #fff; }
```

4. `apps/mypet/app/page.tsx`: no `<nav className="pa-nav">`, antes de `<a href="/cadastro" className="pa-nav-cta">Abrir tabela</a>`, adicionar `<a href="/agente">Agente My Pet</a>`.

5. `site-nav.tsx`: adicionar `agenteHref` às props (`agenteHref?: string;` no tipo e na desestruturação); no array `links`, como primeiro item: `...(agenteHref ? [{ href: agenteHref, label: "Agente" }] : []),`; e nas ações do desktop, antes do bloco `{balcaoHref && (...)}`:

```tsx
          {agenteHref && (
            <Link
              href={agenteHref}
              className="site-nav-text-link"
              style={{ fontSize: 13, fontWeight: 800, color: palette.pink, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Agente
            </Link>
          )}
```

6. Nas páginas `pedido-rapido/page.tsx`, `cotacao/page.tsx` e `pedidos/page.tsx` do mypet: no `<SiteNav ...>`, trocar `homeHref="/pedido-rapido"` por `homeHref="/agente"` e adicionar `agenteHref="/agente"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter mypet exec vitest run app/_components/pre-access app/pedido-rapido app/cotacao app/pedidos` e `pnpm --filter @mypet/core exec vitest run src/components/site-nav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/_components/pre-access/agent-entry.tsx apps/mypet/app/_components/pre-access/agent-entry.test.tsx apps/mypet/app/_components/pre-access/commercial-faq.tsx apps/mypet/app/_components/pre-access/hero.tsx apps/mypet/app/_components/pre-access/hero.test.tsx apps/mypet/app/_components/pre-access/styles.ts apps/mypet/app/page.tsx packages/core/src/components/site-nav.tsx packages/core/src/components/site-nav.test.tsx apps/mypet/app/pedido-rapido/page.tsx apps/mypet/app/cotacao/page.tsx apps/mypet/app/pedidos/page.tsx
git commit -m "feat(mypet): home como porta de entrada do agente e item Agente no menu do cliente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Remover o assistente antigo de dúvidas

**Files:**
- Delete: `apps/mypet/app/api/duvidas/route.ts`
- Delete: `apps/mypet/app/_components/pre-access/faq-assistant.tsx`, `faq-assistant.test.tsx`
- Delete: `packages/core/src/support-assistant-client.ts`, `support-assistant-client.test.ts`, `support-assistant-server.ts`, `support-assistant-server.test.ts`
- Modify: `packages/core/package.json` (remover exports `./support-assistant-client` e `./support-assistant-server`)
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (remover CSS sem uso do chat antigo)

- [ ] **Step 1: Conferir que nada mais usa**

Run: `grep -rn "support-assistant\|faq-assistant\|FaqAssistant\|api/duvidas\|askSupportAssistant" apps packages --include=*.ts --include=*.tsx --include=*.json | grep -v node_modules`
Expected: só os próprios arquivos a apagar e as duas linhas de export do `package.json`. Se aparecer outro uso, parar e relatar.

- [ ] **Step 2: Apagar e ajustar**

Apagar os arquivos listados (`git rm`). Remover as duas linhas de export do `packages/core/package.json`. Em `pre-access/styles.ts`, remover as regras `.pa-ai-log`, `.pa-ai-msg`, `.pa-ai-msg a`, `.pa-ai-msg--user`, `.pa-ai-msg--muted`, `.pa-ai-chips`, `.pa-ai-chips button`, `.pa-ai-chips button:hover`, `.pa-ai-error` e `.pa-ai-form .pa-btn:disabled` **se** o grep mostrar que nenhum outro arquivo usa essas classes (`grep -rn "pa-ai-log\|pa-ai-msg\|pa-ai-chips\|pa-ai-error" apps/mypet --include=*.tsx`). Manter `.pa-ai`, `.pa-ai-title`, `.pa-ai-lead`, `.pa-ai-form*` (usadas pelo `AgentEntry`).

O escopo de cota `"duvidas"` em `ai-usage-limits.ts` **continua** (o visitante do agente usa).

- [ ] **Step 3: Testes, tipos e build**

Run: `pnpm --filter @mypet/core test` e `pnpm --filter mypet test` → Expected: PASS.
Run: `pnpm --filter mypet build` → Expected: ok, sem `/api/duvidas` na lista.

- [ ] **Step 4: Commit**

```bash
git add -u packages/core/package.json packages/core/src apps/mypet/app/api/duvidas apps/mypet/app/_components/pre-access
git commit -m "chore(mypet): remove o assistente antigo de dúvidas (substituído pelo /agente)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Conferir com `git status` antes do commit que só entraram os arquivos desta task — `git add -u` limitado a esses caminhos não pega as pastas não relacionadas.)

---

### Task 7: Verificação final do bloco 2

- [ ] **Step 1: Suítes completas, tipos e build**

Run: `pnpm --filter @mypet/core test`, `pnpm --filter mypet test`, `pnpm --filter @mypet/core exec tsc --noEmit 2>&1 | grep -E "agent-|site-nav.tsx"`, `pnpm --filter mypet exec tsc --noEmit 2>&1 | grep -E "app/agente|pre-access|api/agente"`, `pnpm --filter mypet build`.
Expected: testes PASS; nenhum erro de tipo nos arquivos do bloco; build ok com `/agente` e `/api/agente`.

- [ ] **Step 2: Conferência visual**

Com `pnpm --filter mypet dev` (porta 4100): abrir `http://localhost:4100/agente` em largura de computador e em 375px.
- Computador: duas colunas (agente à esquerda, "Acesso completo ao agente" à direita); cartões livres e com 🔒; clicar num 🔒 mostra o motivo no painel e foca o CNPJ.
- Celular: agente em tela cheia; faixa verde "Liberar acesso completo" embaixo; tocar abre o painel de baixo para cima com "×" para fechar.
- Home (`/`): botão "Perguntar ao agente" no topo, link "Agente My Pet" no cabeçalho e o campo "Pergunte ao agente My Pet" no FAQ levando a `/agente?pergunta=...`.
Sem chaves de IA no ambiente local, enviar uma pergunta mostra a mensagem de erro amigável — esperado.
