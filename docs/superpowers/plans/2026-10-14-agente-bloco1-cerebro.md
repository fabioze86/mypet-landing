# Agente My Pet — Bloco 1 (cérebro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a API `POST /api/agente` do mypet: agente com streaming, dois modos (visitante sem preço / cliente com preço), busca no catálogo do Hub, conversas guardadas no Supabase e cotas por IP (visitante) ou por comprador (cliente).

**Architecture:** Handler no core (`agent-server.ts`) montado por peças pequenas e testáveis: parse do corpo (`agent-request.ts`), prompt (`agent-prompt.ts`), ferramenta de catálogo (`agent-catalog-tool.ts`), persistência (`agent-conversations.ts`) e abertura do stream com troca de provedor antes do primeiro conteúdo (`agent-stream.ts`). O navegador manda só a última pergunta; o histórico vem do banco. A rota do app só injeta canal, FAQ e a identificação do comprador.

**Tech Stack:** Next 16.2 (route handlers), AI SDK `ai@7.0.19` (`streamText`, `toUIMessageStream`, `createUIMessageStreamResponse`, `convertToModelMessages`, `validateUIMessages`, `isStepCount`, `tool`), `zod@4`, Supabase JS (service role), Vitest 4, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-14-agente-plataforma-design.md` (seções 2, 3.1, 3.2 e o bloco 1 da seção 6).

## Global Constraints

- **AI SDK v7 — nomes novos:** usar `instructions` (não `system`), `isStepCount` (não `stepCountIs`), `onEnd` (não `onFinish`), `result.stream` (não `fullStream`), e os helpers sem estado `toUIMessageStream({ stream })` + `createUIMessageStreamResponse({ stream })` (os métodos `result.toUIMessageStreamResponse()` estão depreciados). Documentação local: `node_modules/.pnpm/ai@7.0.19_zod@4.4.3/node_modules/ai/docs/` (`04-ai-sdk-ui/02-chatbot.mdx`, `04-ai-sdk-ui/03-chatbot-message-persistence.mdx`, `08-migration-guides/23-migration-guide-7-0.mdx`, `03-ai-sdk-core/55-testing.mdx`).
- **Modo** decidido só no servidor pelo cookie (`requireBuyer`); falha ao identificar → visitante. Nada do corpo muda modo ou comprador.
- **Visitante:** preço nunca entra na saída da ferramenta (`unitPrice: null`, `priceLabel: null`), logo nunca chega ao modelo nem à UI.
- **Histórico vem do banco** (últimas 12 mensagens); o navegador manda só `{ id, message, cart }`. Mensagem do usuário: só partes de texto, até 500 caracteres.
- Limites: `isStepCount(5)`, `maxOutputTokens: 600`, `maxRetries: 1`, timeout 45s por chamada (ajuste em relação aos 25s da spec: com até 5 passos de ferramenta, 25s cortaria respostas válidas).
- Cotas: visitante = escopo `duvidas` por IP (como hoje); cliente = escopo `agente_cliente` por comprador (20 / 10 min, 80 / dia, teto global 3000 / dia; envs `AI_LIMIT_AGENTE_CLIENTE_*`). Mensagem `ip_daily` sem WhatsApp.
- Copy do prompt: nunca "atacado", "cotação", nem chamar a My Pet Brasil de "loja"; nunca prometer desconto/condição/preço melhor; nada manda o visitante ao WhatsApp do time.
- Desvio consciente da spec 2.3: a ferramenta devolve a mesma saída para modelo e UI (`{ total, produtos: AgentProduct[] }`), em vez de um recorte só para o modelo. Para visitante os preços já vêm `null`, então não há vazamento; o custo é alguns tokens a mais.
- Commits só com os arquivos da task (há alterações de outras frentes no working tree — nunca `git add -A`). Trabalho direto na `main`, sem worktree. Toda mensagem de commit termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comandos: testes do core `pnpm --filter @mypet/core exec vitest run <arquivo>`; do app `pnpm --filter mypet exec vitest run <arquivo>`.
- **Aplicar a migration no Supabase de produção exige confirmação explícita do usuário** (Task 10).
- Fora deste bloco: telas (`/agente`, home, cadeados — bloco 2), `alterar_pedido`/`sugerir_reposicao`/`status_pedidos`/carrinho/`agent_conversation_id` em `orders` (bloco 3), dependência `@ai-sdk/react` (bloco 2). `/api/duvidas` continua funcionando até o bloco 2.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `packages/core/src/ai-usage-limits.ts` (modificar) | Escopo `agente_cliente`, chave de cota por comprador, mensagem `ip_daily` |
| `supabase/migrations/20261014120000_agent_conversations.sql` (novo) | Tabelas `agent_conversations` e `agent_messages` |
| `packages/core/src/agent-catalog-tool.ts` (novo) | Ferramenta `buscar_produtos` |
| `packages/core/src/agent-prompt.ts` (novo) | Tipos `AgentMode`/`AgentFaqItem`/`AgentCartItem`, base de conhecimento e instruções por modo |
| `packages/core/src/support-assistant-server.ts` (modificar) | Passa a importar `formatKnowledge` de `agent-prompt` |
| `packages/core/src/agent-request.ts` (novo) | Validação do corpo `{ id, message, cart }` |
| `packages/core/src/test-utils/fake-supabase.ts` (novo) | Fake mínimo do cliente Supabase para testes |
| `packages/core/src/agent-conversations.ts` (novo) | Abrir/verificar posse da conversa, carregar histórico, gravar turno |
| `packages/core/src/agent-stream.ts` (novo) | Abrir stream com troca de provedor antes do primeiro conteúdo |
| `packages/core/src/agent-server.ts` (novo) | `createAgentHandler` — orquestra tudo |
| `packages/core/package.json` (modificar) | Export `./agent-server` |
| `apps/mypet/app/api/agente/route.ts` (novo) | Liga o handler ao mypet |

---

### Task 1: Cotas — escopo do cliente, chave por comprador e mensagem sem WhatsApp

**Files:**
- Modify: `packages/core/src/ai-usage-limits.ts`
- Test: `packages/core/src/ai-usage-limits.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AiScope = "assistant" | "duvidas" | "agente_cliente";
  export function consumeAiQuota(scope: AiScope, channel: string, headers: Headers, subjectKey?: string): Promise<Response | null>;
  export function hashClientIp(headers: Headers): string; // inalterada
  ```

- [ ] **Step 1: Write the failing tests**

Adicionar ao fim de `packages/core/src/ai-usage-limits.test.ts`:

```ts
describe("escopo agente_cliente", () => {
  it("tem limites próprios, ajustáveis por env", () => {
    expect(getAiLimits("agente_cliente")).toEqual({
      ipBurstMax: 20,
      ipBurstWindowSeconds: 600,
      ipDailyMax: 80,
      globalDailyMax: 3000,
    });
    vi.stubEnv("AI_LIMIT_AGENTE_CLIENTE_IP_DAILY", "120");
    expect(getAiLimits("agente_cliente").ipDailyMax).toBe(120);
  });

  it("conta por comprador quando recebe subjectKey, não pelo IP", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });
    await consumeAiQuota("agente_cliente", "mypetbrasil", headers(), "buyer-1");
    await consumeAiQuota("agente_cliente", "mypetbrasil", headers({ "x-forwarded-for": "9.9.9.9" }), "buyer-1");
    const [first, second] = rpc.mock.calls.map((c) => c[1].p_ip_hash);
    expect(first).toBe(second);
    expect(first).not.toBe(hashClientIp(headers()));
    expect(first).toHaveLength(32);
  });
});

describe("mensagens de limite", () => {
  it("limite diário orienta para a central de ajuda, sem WhatsApp", async () => {
    rpc.mockResolvedValue({ data: "ip_daily", error: null });
    const res = await consumeAiQuota("duvidas", "mypetbrasil", headers());
    const body = await res?.json();
    expect(body.error.message).toContain("central de ajuda");
    expect(body.error.message).not.toMatch(/whatsapp/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mypet/core exec vitest run src/ai-usage-limits.test.ts`
Expected: FAIL — `getAiLimits("agente_cliente")` sem limites definidos; mensagem com "WhatsApp".

- [ ] **Step 3: Write the implementation**

Em `packages/core/src/ai-usage-limits.ts`:

1. Trocar o tipo e os limites padrão:

```ts
export type AiScope = "assistant" | "duvidas" | "agente_cliente";
```

e, dentro de `DEFAULT_LIMITS`, depois da linha `duvidas: {...},`, adicionar:

```ts
  // Agente /agente com cliente cadastrado: contado por comprador, não por IP.
  agente_cliente: { ipBurstMax: 20, ipBurstWindowSeconds: 600, ipDailyMax: 80, globalDailyMax: 3000 },
```

2. Trocar `hashClientIp` por:

```ts
function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function hashClientIp(headers: Headers): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
  return shortHash(ip);
}
```

3. Trocar a mensagem `ip_daily` de `LIMIT_MESSAGES` por:

```ts
  ip_daily: "Você atingiu o limite de perguntas de hoje. Volte amanhã ou consulte a nossa central de ajuda.",
```

4. Trocar a assinatura e o `p_ip_hash` de `consumeAiQuota`:

```ts
/**
 * Consome uma unidade da cota. Devolve null se pode seguir, ou a Response de
 * erro pronta (429 limite, 503 desligado/indisponível). Falha fechada: sem
 * conseguir contar, não chama a IA. Com `subjectKey` (id do comprador), a cota
 * individual é por comprador em vez de por IP.
 */
export async function consumeAiQuota(
  scope: AiScope,
  channel: string,
  headers: Headers,
  subjectKey?: string,
): Promise<Response | null> {
```

e, na chamada `rpc`, trocar `p_ip_hash: hashClientIp(headers),` por:

```ts
      p_ip_hash: subjectKey ? shortHash(`buyer:${subjectKey}`) : hashClientIp(headers),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mypet/core exec vitest run src/ai-usage-limits.test.ts`
Expected: PASS (todos, incluindo os antigos).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ai-usage-limits.ts packages/core/src/ai-usage-limits.test.ts
git commit -m "feat(ai): cota do agente por comprador e limite diário sem WhatsApp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Migration das conversas do agente

**Files:**
- Create: `supabase/migrations/20261014120000_agent_conversations.sql`

**Interfaces:**
- Produces: tabelas `public.agent_conversations` (`id uuid pk`, `channel`, `buyer_id uuid null → buyers`, `ip_hash`, `started_as`, `created_at`, `updated_at`) e `public.agent_messages` (`id`, `conversation_id → agent_conversations`, `message_id text`, `role`, `content`, `parts jsonb`, `mode`, `created_at`, `unique (conversation_id, message_id)`), usadas pela Task 6.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/20261014120000_agent_conversations.sql`:

```sql
-- Conversas do agente /agente (apps/mypet).
--
-- Cada conversa tem id gerado no navegador (useChat). buyer_id fica nulo
-- enquanto a pessoa é visitante e é preenchido quando ela se cadastra no meio
-- da conversa (mede a conversão de leads pelo agente). agent_messages guarda as
-- UI messages completas (parts) para recarregar o histórico no servidor — o
-- navegador nunca manda o histórico, só a pergunta nova.
-- Acesso só pelo service role (server-side); anon/authenticated não leem nada.

create table if not exists public.agent_conversations (
  id uuid primary key,
  channel text not null,
  buyer_id uuid null references public.buyers(id) on delete set null,
  ip_hash text not null,
  started_as text not null check (started_as in ('visitante', 'cliente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_conversations_buyer
  on public.agent_conversations (buyer_id, updated_at desc);
create index if not exists agent_conversations_channel_updated
  on public.agent_conversations (channel, updated_at desc);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  message_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  parts jsonb not null,
  mode text not null check (mode in ('visitante', 'cliente')),
  created_at timestamptz not null default now(),
  unique (conversation_id, message_id)
);

create index if not exists agent_messages_conversation
  on public.agent_messages (conversation_id, created_at desc);

alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
revoke all on table public.agent_conversations from anon, authenticated;
revoke all on table public.agent_messages from anon, authenticated;
```

- [ ] **Step 2: Conferir o tipo de `buyers.id`**

Run: `grep -rn "create table.*buyers" -A4 supabase/migrations/ | head -20`
Expected: `id uuid`. Se a tabela `buyers` não estiver nas migrations do repositório (foi criada fora delas), conferir no Supabase com a ferramenta MCP `list_tables` (somente leitura) que `public.buyers.id` é `uuid`. Se for outro tipo, ajustar a coluna `buyer_id` para o mesmo tipo.

- [ ] **Step 3: Commit** (a aplicação no banco é na Task 10, com confirmação)

```bash
git add supabase/migrations/20261014120000_agent_conversations.sql
git commit -m "feat(db): tabelas de conversas e mensagens do agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Ferramenta `buscar_produtos`

**Files:**
- Create: `packages/core/src/agent-catalog-tool.ts`
- Test: `packages/core/src/agent-catalog-tool.test.ts`

**Interfaces:**
- Consumes: `getBrands(channel: string): Promise<string[]>` (`./catalog`); `getCatalogLineItems({ q?, brand?, page, channel }): Promise<CatalogLineItemsResult>` e `type CatalogLineItem` (`./catalog-line-items`).
- Produces:
  ```ts
  export type AgentProduct = {
    id: string; name: string; sku: string; brand: string | null; variantLabel: string | null;
    img: string; unitPrice: number | null; priceLabel: string | null;
  };
  export function resolveBrand(raw: string | undefined, channel: string): Promise<string | undefined>;
  export function buildCatalogTool(opts: { channel: string; showPrices: boolean }): Tool; // execute → { total: number; produtos: AgentProduct[] }
  ```

- [ ] **Step 1: Write the failing test**

Criar `packages/core/src/agent-catalog-tool.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("./catalog", () => ({ getBrands: vi.fn() }));
vi.mock("./catalog-line-items", () => ({ getCatalogLineItems: vi.fn() }));

import { getBrands } from "./catalog";
import { getCatalogLineItems } from "./catalog-line-items";
import { buildCatalogTool, resolveBrand } from "./agent-catalog-tool";

const item = (i: number) => ({
  id: `p${i}`,
  name: `Shampoo Neutro ${i}`,
  sku: `SKU${i}`,
  brand: "Pet Clean",
  img: `/img${i}.jpg`,
  unitPrice: 10 + i,
  priceLabel: `R$ ${10 + i},00`,
  variantLabel: i % 2 ? "5L" : null,
});

const toolOptions = { toolCallId: "t1", messages: [] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Execute = (input: any, options: any) => Promise<any>;

function run(showPrices: boolean, input: { query: string; marca?: string }) {
  const tool = buildCatalogTool({ channel: "mypetbrasil", showPrices });
  return (tool.execute as Execute)(input, toolOptions);
}

beforeEach(() => {
  vi.clearAllMocks();
  (getBrands as Mock).mockResolvedValue(["Pet Clean", "Pet Society"]);
  (getCatalogLineItems as Mock).mockResolvedValue({
    items: Array.from({ length: 10 }, (_, i) => item(i + 1)),
    total: 10,
    page: 1,
    totalPages: 1,
  });
});

describe("resolveBrand", () => {
  it("casa marca sem diferenciar maiúsculas e acentos", async () => {
    expect(await resolveBrand("pet clean", "mypetbrasil")).toBe("Pet Clean");
    expect(await resolveBrand("  PÉT CLEAN ", "mypetbrasil")).toBe("Pet Clean");
  });

  it("devolve undefined para marca vazia ou desconhecida", async () => {
    expect(await resolveBrand(undefined, "mypetbrasil")).toBeUndefined();
    expect(await resolveBrand("  ", "mypetbrasil")).toBeUndefined();
    expect(await resolveBrand("Marca X", "mypetbrasil")).toBeUndefined();
  });
});

describe("buscar_produtos", () => {
  it("visitante: nenhum preço na saída", async () => {
    const out = await run(false, { query: "shampoo neutro" });
    expect(out.total).toBe(10);
    expect(out.produtos).toHaveLength(8);
    expect(JSON.stringify(out)).not.toContain("R$");
    expect(out.produtos.every((p: { unitPrice: unknown; priceLabel: unknown }) => p.unitPrice === null && p.priceLabel === null)).toBe(true);
  });

  it("cliente: saída com preço e dados para o cartão", async () => {
    const out = await run(true, { query: "shampoo neutro" });
    expect(out.produtos[0]).toEqual({
      id: "p1",
      name: "Shampoo Neutro 1",
      sku: "SKU1",
      brand: "Pet Clean",
      variantLabel: "5L",
      img: "/img1.jpg",
      unitPrice: 11,
      priceLabel: "R$ 11,00",
    });
  });

  it("busca a primeira página do canal com a marca resolvida", async () => {
    await run(false, { query: "shampoo", marca: "pet clean" });
    expect(getCatalogLineItems).toHaveBeenCalledWith({ q: "shampoo", brand: "Pet Clean", page: 1, channel: "mypetbrasil" });
  });

  it("marca desconhecida: busca sem filtro de marca", async () => {
    await run(false, { query: "shampoo", marca: "Marca X" });
    expect(getCatalogLineItems).toHaveBeenCalledWith({ q: "shampoo", brand: undefined, page: 1, channel: "mypetbrasil" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-catalog-tool.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-catalog-tool"`.

- [ ] **Step 3: Write minimal implementation**

Criar `packages/core/src/agent-catalog-tool.ts`:

```ts
import { tool } from "ai";
import { z } from "zod";
import { getBrands } from "./catalog";
import { getCatalogLineItems, type CatalogLineItem } from "./catalog-line-items";

// Ferramenta do agente para consultar o catálogo do Hub. Para visitante o
// preço sai nulo: nunca chega ao modelo nem à tela.

export type AgentProduct = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  variantLabel: string | null;
  img: string;
  unitPrice: number | null;
  priceLabel: string | null;
};

const MAX_TOOL_ITEMS = 8;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

// O filtro de marca do catálogo é igualdade exata; o modelo escreve a marca do
// jeito que a pessoa digitou.
export async function resolveBrand(raw: string | undefined, channel: string): Promise<string | undefined> {
  if (!raw?.trim()) return undefined;
  const target = normalize(raw);
  const brands = await getBrands(channel);
  return brands.find((brand) => normalize(brand) === target);
}

function toAgentProduct(item: CatalogLineItem, showPrices: boolean): AgentProduct {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    brand: item.brand,
    variantLabel: item.variantLabel,
    img: item.img,
    unitPrice: showPrices ? item.unitPrice : null,
    priceLabel: showPrices ? item.priceLabel : null,
  };
}

export function buildCatalogTool({ channel, showPrices }: { channel: string; showPrices: boolean }) {
  return tool({
    description:
      "Busca produtos da tabela por tipo ou nome de produto. Use para qualquer pergunta sobre produtos, marcas ou disponibilidade.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Tipo ou nome do produto, ex.: 'shampoo neutro', 'ração filhote'"),
      marca: z.string().optional().describe("Marca do produto, se a pessoa citou uma"),
    }),
    execute: async ({ query, marca }) => {
      const brand = await resolveBrand(marca, channel);
      const result = await getCatalogLineItems({ q: query, brand, page: 1, channel });
      return {
        total: result.total,
        produtos: result.items.slice(0, MAX_TOOL_ITEMS).map((item) => toAgentProduct(item, showPrices)),
      };
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-catalog-tool.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-catalog-tool.ts packages/core/src/agent-catalog-tool.test.ts
git commit -m "feat(agente): ferramenta buscar_produtos, sem preço para visitante

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Instruções do agente por modo

**Files:**
- Create: `packages/core/src/agent-prompt.ts`
- Test: `packages/core/src/agent-prompt.test.ts`

**Interfaces:**
- Consumes: `type ArtigoAjuda` (`./help-center`).
- Produces:
  ```ts
  export type AgentMode = "visitante" | "cliente";
  export type AgentFaqItem = { readonly q: string; readonly a: string };
  export type AgentCartItem = { id: string; name: string; qty: number; unitPrice: number | null };
  export function formatKnowledge(faq: readonly AgentFaqItem[], artigos: ArtigoAjuda[]): string;
  export function buildAgentInstructions(input: {
    siteName: string; mode: AgentMode; empresa: string | null; cart: AgentCartItem[];
    faq: readonly AgentFaqItem[]; artigos: ArtigoAjuda[];
  }): string;
  ```

> `formatKnowledge` passa a morar aqui. Em `packages/core/src/support-assistant-server.ts` (que será apagado no bloco 2), **remover** a função local `formatKnowledge` e as constantes `MAX_ARTICLE_CHARS`/`MAX_KNOWLEDGE_CHARS`, e importar `formatKnowledge` de `./agent-prompt` (o tipo `SupportFaqItem` é compatível com `AgentFaqItem`). Rodar também `src/support-assistant-server.test.ts` no Step 4 e incluir o arquivo no commit.

- [ ] **Step 1: Write the failing test**

Criar `packages/core/src/agent-prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildAgentInstructions, formatKnowledge } from "./agent-prompt";

const faq = [{ q: "Qual é o pedido mínimo?", a: "R$ 250,00 na capital de SP." }];
const artigo = {
  id: "a1",
  categoriaId: "c1",
  slug: "prazo-entrega",
  titulo: "Prazo de entrega",
  resumo: "r",
  ordem: 0,
  corpoMarkdown: "Sul e Sudeste: 3 a 7 dias úteis.",
};

const base = { siteName: "My Pet Brasil", faq, artigos: [artigo], empresa: null, cart: [] };

describe("formatKnowledge", () => {
  it("inclui FAQ e artigos com o caminho", () => {
    const text = formatKnowledge(faq, [artigo]);
    expect(text).toContain("Qual é o pedido mínimo?");
    expect(text).toContain("/central-de-ajuda/a/prazo-entrega");
  });

  it("limita o tamanho total", () => {
    const muitos = Array.from({ length: 50 }, (_, i) => ({ ...artigo, slug: `a${i}`, corpoMarkdown: "x".repeat(5000) }));
    expect(formatKnowledge(faq, muitos).length).toBeLessThanOrEqual(60000);
  });
});

describe("buildAgentInstructions", () => {
  const visitante = buildAgentInstructions({ ...base, mode: "visitante" });
  const cliente = buildAgentInstructions({
    ...base,
    mode: "cliente",
    empresa: "Pet Shop Bichos",
    cart: [{ id: "p1", name: "Shampoo Neutro 5L", qty: 10, unitPrice: 89.9 }],
  });

  it("regras comuns nos dois modos", () => {
    for (const prompt of [visitante, cliente]) {
      expect(prompt).toContain("Nunca prometa desconto");
      expect(prompt).toContain('"buscar_produtos"');
      expect(prompt).toContain("Não escreva preços no texto");
      expect(prompt).toContain("/central-de-ajuda");
      expect(prompt).toContain('"atacado"');
      expect(prompt).not.toMatch(/fal(e|ar) com o (nosso )?time/i);
      expect(prompt).toContain("R$ 250,00 na capital de SP.");
    }
  });

  it("visitante: convite ao cadastro e sem pedido atual", () => {
    expect(visitante).toContain("Você atende visitantes que ainda não fizeram cadastro.");
    expect(visitante).toContain("se cadastra com CNPJ e WhatsApp");
    expect(visitante).not.toContain("PEDIDO ATUAL");
  });

  it("cliente: nome da empresa e pedido atual", () => {
    expect(cliente).toContain("Pet Shop Bichos");
    expect(cliente).toContain("PEDIDO ATUAL DO CLIENTE:");
    expect(cliente).toContain("- 10 x Shampoo Neutro 5L (id p1)");
    expect(cliente).toContain('"Enviar pedido pelo WhatsApp"');
  });

  it("cliente com pedido vazio", () => {
    const vazio = buildAgentInstructions({ ...base, mode: "cliente" });
    expect(vazio).toContain("O pedido atual está vazio.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-prompt.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-prompt"`.

- [ ] **Step 3: Write minimal implementation**

Criar `packages/core/src/agent-prompt.ts`:

```ts
import type { ArtigoAjuda } from "./help-center";

export type AgentMode = "visitante" | "cliente";
export type AgentFaqItem = { readonly q: string; readonly a: string };
export type AgentCartItem = { id: string; name: string; qty: number; unitPrice: number | null };

const MAX_ARTICLE_CHARS = 4000;
const MAX_KNOWLEDGE_CHARS = 60000;

export function formatKnowledge(faq: readonly AgentFaqItem[], artigos: ArtigoAjuda[]): string {
  const parts = faq.map((item) => `### ${item.q}\n${item.a}`);
  for (const artigo of artigos) {
    const corpo = artigo.corpoMarkdown.slice(0, MAX_ARTICLE_CHARS);
    parts.push(`### ${artigo.titulo} (artigo: /central-de-ajuda/a/${artigo.slug})\n${corpo}`);
  }

  let total = 0;
  const kept: string[] = [];
  for (const part of parts) {
    if (total + part.length > MAX_KNOWLEDGE_CHARS) break;
    kept.push(part);
    total += part.length;
  }
  return kept.join("\n\n");
}

function formatCart(cart: AgentCartItem[]): string {
  if (cart.length === 0) return "O pedido atual está vazio.";
  return cart.map((item) => `- ${item.qty} x ${item.name} (id ${item.id})`).join("\n");
}

export function buildAgentInstructions({
  siteName,
  mode,
  empresa,
  cart,
  faq,
  artigos,
}: {
  siteName: string;
  mode: AgentMode;
  empresa: string | null;
  cart: AgentCartItem[];
  faq: readonly AgentFaqItem[];
  artigos: ArtigoAjuda[];
}): string {
  const isCliente = mode === "cliente";
  const audience = isCliente
    ? `Você atende um cliente cadastrado${empresa ? `: ${empresa}` : ""}.`
    : "Você atende visitantes que ainda não fizeram cadastro.";
  const fallback = isCliente
    ? "indique /central-de-ajuda"
    : "indique /central-de-ajuda e convide o visitante a se cadastrar";
  const modeRules = isCliente
    ? `8. Você ajuda o cliente a montar o pedido com rapidez. Para fechar, indique o botão "Enviar pedido pelo WhatsApp" ao lado da conversa.

PEDIDO ATUAL DO CLIENTE:
${formatCart(cart)}`
    : `8. Se perguntarem preço, explique que os preços aparecem para quem se cadastra com CNPJ e WhatsApp, no painel ao lado da conversa. Montar pedido, sugestões de reposição e acompanhamento de pedidos também são exclusivos para quem tem cadastro.`;

  return `Você é o agente da ${siteName}, a tabela de preços para lojistas (pet shops, banho e tosa, clínicas veterinárias, agropecuárias e distribuidores). ${audience}

Regras obrigatórias:
1. Sobre regras comerciais, cadastro, pedidos, pagamento e entrega, responda somente com base na BASE DE CONHECIMENTO abaixo. Se a resposta não estiver nela, diga que não tem essa informação e ${fallback}.
2. Nunca invente regras comerciais, valores, prazos, preços de produtos ou disponibilidade de estoque. Nunca prometa desconto, condição especial ou preço melhor: os preços da tabela são os mesmos do site mypetbrasil.com.
3. Quando a resposta vier de um artigo, cite o caminho dele (ex.: /central-de-ajuda/a/slug-do-artigo) no fim da resposta.
4. Responda sempre em português, em texto simples (sem markdown), de 1 a 4 frases, direto ao ponto.
5. Não use as palavras "atacado" nem "cotação", e não chame a ${siteName} de "loja".
6. Se a pergunta não tiver relação com a ${siteName}, cadastro, pedidos, pagamento, entrega ou produtos pet, diga educadamente que só ajuda com dúvidas sobre a ${siteName}.
7. Para qualquer pergunta sobre produtos, marcas ou disponibilidade, use a ferramenta "buscar_produtos" antes de responder. Busque pelo tipo ou nome do produto (ex.: "shampoo neutro"), não pela frase inteira. Nunca cite um produto que não tenha vindo dessa ferramenta nesta conversa. Não escreva preços no texto: os produtos encontrados aparecem em cartões logo abaixo da sua resposta. Se a busca não trouxer nada, diga que não encontrou e sugira outro termo.
${modeRules}

BASE DE CONHECIMENTO:
${formatKnowledge(faq, artigos)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-prompt.test.ts src/support-assistant-server.test.ts`
Expected: PASS (6 testes novos + os do assistente antigo, inalterados).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-prompt.ts packages/core/src/agent-prompt.test.ts packages/core/src/support-assistant-server.ts
git commit -m "feat(agente): instruções do agente por modo (visitante/cliente)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Validação do corpo da requisição

**Files:**
- Create: `packages/core/src/agent-request.ts`
- Test: `packages/core/src/agent-request.test.ts`

**Interfaces:**
- Consumes: `type AgentCartItem` (`./agent-prompt`, Task 4); `type UIMessage` (`ai`).
- Produces:
  ```ts
  export type ParsedAgentRequest = { id: string; message: UIMessage; cart: AgentCartItem[] };
  export function parseAgentRequest(body: unknown):
    { ok: true; value: ParsedAgentRequest } | { ok: false; message: string };
  ```

- [ ] **Step 1: Write the failing test**

Criar `packages/core/src/agent-request.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseAgentRequest } from "./agent-request";

const id = "3f1c2a7e-8b4d-4c1a-9f2e-1a2b3c4d5e6f";
const message = { id: "m1", role: "user", parts: [{ type: "text", text: "  Tem shampoo?  " }] };

describe("parseAgentRequest", () => {
  it("aceita pedido válido e normaliza a mensagem", () => {
    const result = parseAgentRequest({ id, message, cart: [] });
    expect(result).toEqual({
      ok: true,
      value: { id, message: { id: "m1", role: "user", parts: [{ type: "text", text: "Tem shampoo?" }] }, cart: [] },
    });
  });

  it("junta várias partes de texto", () => {
    const result = parseAgentRequest({
      id,
      message: { ...message, parts: [{ type: "text", text: "Tem " }, { type: "text", text: "shampoo?" }] },
    });
    expect(result.ok && result.value.message.parts).toEqual([{ type: "text", text: "Tem shampoo?" }]);
  });

  it.each([
    ["corpo ausente", null],
    ["id que não é uuid", { id: "abc", message }],
    ["mensagem ausente", { id }],
    ["papel assistant", { id, message: { ...message, role: "assistant" } }],
    ["parte que não é texto", { id, message: { ...message, parts: [{ type: "tool-x", output: {} }] } }],
    ["texto vazio", { id, message: { ...message, parts: [{ type: "text", text: "   " }] } }],
    ["texto acima de 500", { id, message: { ...message, parts: [{ type: "text", text: "a".repeat(501) }] } }],
    ["id de mensagem vazio", { id, message: { ...message, id: "" } }],
  ])("recusa %s", (_label, body) => {
    expect(parseAgentRequest(body).ok).toBe(false);
  });

  it("carrinho: mantém itens válidos, descarta inválidos e achata quebras de linha no nome", () => {
    const result = parseAgentRequest({
      id,
      message,
      cart: [
        { id: "p1", name: "Shampoo\n5L", qty: 2, unitPrice: 89.9 },
        { id: "p2", name: "Sem preço", qty: 1, unitPrice: null },
        { id: "p3", name: "Qtd zero", qty: 0, unitPrice: 1 },
        { id: "p4", name: "Qtd fracionada", qty: 1.5, unitPrice: 1 },
        { id: "p5", name: "Preço negativo", qty: 1, unitPrice: -1 },
        "lixo",
      ],
    });
    expect(result.ok && result.value.cart).toEqual([
      { id: "p1", name: "Shampoo 5L", qty: 2, unitPrice: 89.9 },
      { id: "p2", name: "Sem preço", qty: 1, unitPrice: null },
    ]);
  });

  it("carrinho: no máximo 50 itens; ausente vira lista vazia", () => {
    const cart = Array.from({ length: 60 }, (_, i) => ({ id: `p${i}`, name: "x", qty: 1, unitPrice: 1 }));
    const cheio = parseAgentRequest({ id, message, cart });
    expect(cheio.ok && cheio.value.cart).toHaveLength(50);
    const semCarrinho = parseAgentRequest({ id, message });
    expect(semCarrinho.ok && semCarrinho.value.cart).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-request.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-request"`.

- [ ] **Step 3: Write minimal implementation**

Criar `packages/core/src/agent-request.ts`:

```ts
import type { UIMessage } from "ai";
import type { AgentCartItem } from "./agent-prompt";

// O navegador manda só a pergunta nova e o carrinho; o histórico vem do banco.
// Nada aqui decide modo nem comprador.

export type ParsedAgentRequest = { id: string; message: UIMessage; cart: AgentCartItem[] };

type ParseResult = { ok: true; value: ParsedAgentRequest } | { ok: false; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_MESSAGE_LENGTH = 500;
const MAX_CART_ITEMS = 50;
const MAX_QTY = 9999;
const MAX_ID_LENGTH = 100;
const MAX_NAME_LENGTH = 200;

function fail(message: string): ParseResult {
  return { ok: false, message };
}

function oneLine(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function parseCartItem(raw: unknown): AgentCartItem | null {
  if (!raw || typeof raw !== "object") return null;
  const { id, name, qty, unitPrice } = raw as Record<string, unknown>;
  if (typeof id !== "string" || !id || id.length > MAX_ID_LENGTH) return null;
  if (typeof name !== "string" || !name.trim()) return null;
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return null;
  if (unitPrice !== null && (typeof unitPrice !== "number" || !Number.isFinite(unitPrice) || unitPrice < 0)) {
    return null;
  }
  return { id, name: oneLine(name, MAX_NAME_LENGTH), qty, unitPrice };
}

export function parseAgentRequest(body: unknown): ParseResult {
  if (!body || typeof body !== "object") return fail("Corpo da requisição inválido.");
  const { id, message, cart } = body as Record<string, unknown>;

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) return fail("Conversa inválida.");
  if (!message || typeof message !== "object") return fail("Mensagem inválida.");

  const { id: messageId, role, parts } = message as Record<string, unknown>;
  if (typeof messageId !== "string" || !messageId || messageId.length > MAX_ID_LENGTH) {
    return fail("Mensagem inválida.");
  }
  if (role !== "user") return fail("A mensagem precisa ser sua.");
  if (!Array.isArray(parts) || parts.length === 0) return fail("Mensagem vazia.");

  let text = "";
  for (const part of parts) {
    const { type, text: partText } = (part ?? {}) as Record<string, unknown>;
    if (type !== "text" || typeof partText !== "string") return fail("Mensagem inválida.");
    text += partText;
  }
  text = text.trim();
  if (!text) return fail("Mensagem vazia.");
  if (text.length > MAX_MESSAGE_LENGTH) return fail("Mensagem muito longa. Tente ser mais direto.");

  const cartItems = Array.isArray(cart)
    ? cart
        .slice(0, MAX_CART_ITEMS)
        .map(parseCartItem)
        .filter((item): item is AgentCartItem => item !== null)
    : [];

  return {
    ok: true,
    value: {
      id,
      message: { id: messageId, role: "user", parts: [{ type: "text", text }] },
      cart: cartItems,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-request.test.ts`
Expected: PASS (12 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-request.ts packages/core/src/agent-request.test.ts
git commit -m "feat(agente): validação do corpo da requisição do agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Persistência das conversas

**Files:**
- Create: `packages/core/src/test-utils/fake-supabase.ts`
- Create: `packages/core/src/agent-conversations.ts`
- Test: `packages/core/src/agent-conversations.test.ts`

**Interfaces:**
- Consumes: tabelas da Task 2; `type AgentMode` (Task 4); `type UIMessage` (`ai`); `type SupabaseClient` (`@supabase/supabase-js`).
- Produces:
  ```ts
  export type ConversationAccess = "ok" | "forbidden" | "unavailable";
  export function messageText(message: UIMessage): string;
  export function ensureConversation(supabase: SupabaseClient, input: {
    id: string; channel: string; buyerId: string | null; ipHash: string; mode: AgentMode;
  }): Promise<ConversationAccess>;
  export function loadHistory(supabase: SupabaseClient, conversationId: string): Promise<UIMessage[]>;
  export function saveTurn(supabase: SupabaseClient, input: {
    conversationId: string; mode: AgentMode; messages: UIMessage[];
  }): Promise<void>;
  // test-utils
  export function fakeSupabase(results: Record<string, FakeResult[]>): { client: SupabaseClient; calls: FakeCall[] };
  ```

- [ ] **Step 1: Criar o fake do Supabase (utilitário de teste)**

Criar `packages/core/src/test-utils/fake-supabase.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

// Fake mínimo do query builder do Supabase para testes. Cada `from(tabela)`
// consome, na ordem, um resultado da fila daquela tabela quando a consulta é
// aguardada (await) ou finalizada com maybeSingle(). Todas as chamadas ficam
// registradas em `calls` para asserções.

export type FakeResult = { data?: unknown; error?: { message: string } | null };
export type FakeCall = { table: string; method: string; args: unknown[] };

const CHAIN_METHODS = ["select", "eq", "order", "limit", "insert", "update", "upsert"] as const;

export function fakeSupabase(results: Record<string, FakeResult[]>) {
  const calls: FakeCall[] = [];
  const queues: Record<string, FakeResult[]> = Object.fromEntries(
    Object.entries(results).map(([table, list]) => [table, [...list]]),
  );

  const client = {
    from(table: string) {
      const next = () =>
        Promise.resolve({ data: null, error: null, ...(queues[table]?.shift() ?? {}) });
      const builder: Record<string, unknown> = {};
      for (const method of CHAIN_METHODS) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.maybeSingle = () => {
        calls.push({ table, method: "maybeSingle", args: [] });
        return next();
      };
      builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        next().then(resolve, reject);
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}
```

- [ ] **Step 2: Write the failing test**

Criar `packages/core/src/agent-conversations.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { UIMessage } from "ai";
import { fakeSupabase } from "./test-utils/fake-supabase";
import { ensureConversation, loadHistory, messageText, saveTurn } from "./agent-conversations";

const base = { id: "conv-1", channel: "mypetbrasil", ipHash: "h", mode: "visitante" as const };

vi.spyOn(console, "error").mockImplementation(() => {});

describe("ensureConversation", () => {
  it("cria a conversa quando não existe", async () => {
    const { client, calls } = fakeSupabase({ agent_conversations: [{ data: null }, {}] });
    expect(await ensureConversation(client, { ...base, buyerId: null })).toBe("ok");
    expect(calls).toContainEqual({
      table: "agent_conversations",
      method: "insert",
      args: [{ id: "conv-1", channel: "mypetbrasil", buyer_id: null, ip_hash: "h", started_as: "visitante" }],
    });
  });

  it("liga a conversa ao comprador quando o visitante se cadastra", async () => {
    const { client, calls } = fakeSupabase({ agent_conversations: [{ data: { id: "conv-1", buyer_id: null } }, {}] });
    expect(await ensureConversation(client, { ...base, buyerId: "b1", mode: "cliente" })).toBe("ok");
    expect(calls).toContainEqual({ table: "agent_conversations", method: "update", args: [{ buyer_id: "b1" }] });
  });

  it("aceita o mesmo comprador sem atualizar", async () => {
    const { client, calls } = fakeSupabase({ agent_conversations: [{ data: { id: "conv-1", buyer_id: "b1" } }] });
    expect(await ensureConversation(client, { ...base, buyerId: "b1", mode: "cliente" })).toBe("ok");
    expect(calls.some((c) => c.method === "update" || c.method === "insert")).toBe(false);
  });

  it("recusa conversa de outro comprador", async () => {
    const { client } = fakeSupabase({ agent_conversations: [{ data: { id: "conv-1", buyer_id: "b1" } }] });
    expect(await ensureConversation(client, { ...base, buyerId: "b2", mode: "cliente" })).toBe("forbidden");
  });

  it("recusa visitante numa conversa que já pertence a um comprador", async () => {
    const { client } = fakeSupabase({ agent_conversations: [{ data: { id: "conv-1", buyer_id: "b1" } }] });
    expect(await ensureConversation(client, { ...base, buyerId: null })).toBe("forbidden");
  });

  it("erro do banco vira unavailable", async () => {
    const { client } = fakeSupabase({ agent_conversations: [{ error: { message: "down" } }] });
    expect(await ensureConversation(client, { ...base, buyerId: null })).toBe("unavailable");
  });
});

describe("loadHistory", () => {
  it("devolve as últimas 12 mensagens em ordem cronológica", async () => {
    const { client, calls } = fakeSupabase({
      agent_messages: [
        {
          data: [
            { message_id: "m2", role: "assistant", parts: [{ type: "text", text: "Oi!" }] },
            { message_id: "m1", role: "user", parts: [{ type: "text", text: "Olá" }] },
          ],
        },
      ],
    });
    expect(await loadHistory(client, "conv-1")).toEqual([
      { id: "m1", role: "user", parts: [{ type: "text", text: "Olá" }] },
      { id: "m2", role: "assistant", parts: [{ type: "text", text: "Oi!" }] },
    ]);
    expect(calls).toContainEqual({ table: "agent_messages", method: "limit", args: [12] });
    expect(calls).toContainEqual({ table: "agent_messages", method: "order", args: ["created_at", { ascending: false }] });
  });

  it("erro do banco devolve histórico vazio", async () => {
    const { client } = fakeSupabase({ agent_messages: [{ error: { message: "down" } }] });
    expect(await loadHistory(client, "conv-1")).toEqual([]);
  });
});

describe("saveTurn", () => {
  const user: UIMessage = { id: "m1", role: "user", parts: [{ type: "text", text: "Tem shampoo?" }] };
  const reply: UIMessage = {
    id: "m2",
    role: "assistant",
    parts: [
      { type: "text", text: "Encontrei " },
      { type: "text", text: "estas opções." },
    ],
  };

  it("grava as duas mensagens com horários crescentes e atualiza a conversa", async () => {
    const { client, calls } = fakeSupabase({ agent_messages: [{}], agent_conversations: [{}] });
    await saveTurn(client, { conversationId: "conv-1", mode: "cliente", messages: [user, reply] });

    const upsert = calls.find((c) => c.method === "upsert");
    const [rows, options] = upsert!.args as [Record<string, unknown>[], unknown];
    expect(options).toEqual({ onConflict: "conversation_id,message_id" });
    expect(rows.map((r) => [r.message_id, r.role, r.content, r.mode])).toEqual([
      ["m1", "user", "Tem shampoo?", "cliente"],
      ["m2", "assistant", "Encontrei estas opções.", "cliente"],
    ]);
    expect(Date.parse(rows[1].created_at as string)).toBeGreaterThan(Date.parse(rows[0].created_at as string));
    expect(calls.some((c) => c.table === "agent_conversations" && c.method === "update")).toBe(true);
  });

  it("erro do banco não lança", async () => {
    const { client } = fakeSupabase({ agent_messages: [{ error: { message: "down" } }] });
    await expect(saveTurn(client, { conversationId: "conv-1", mode: "visitante", messages: [user] })).resolves.toBeUndefined();
  });
});

describe("messageText", () => {
  it("junta só as partes de texto", () => {
    expect(
      messageText({
        id: "x",
        role: "assistant",
        parts: [
          { type: "text", text: "A" },
          { type: "step-start" },
          { type: "text", text: "B" },
        ],
      } as UIMessage),
    ).toBe("AB");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-conversations.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-conversations"`.

- [ ] **Step 4: Write minimal implementation**

Criar `packages/core/src/agent-conversations.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";
import type { AgentMode } from "./agent-prompt";

// Conversas do agente no Supabase (service role). Falhas do banco nunca
// derrubam a resposta: o agente segue sem histórico e sem gravar.

export type ConversationAccess = "ok" | "forbidden" | "unavailable";

const HISTORY_LIMIT = 12;

type StoredMessageRow = { message_id: string; role: "user" | "assistant"; parts: UIMessage["parts"] };

export function messageText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export async function ensureConversation(
  supabase: SupabaseClient,
  input: { id: string; channel: string; buyerId: string | null; ipHash: string; mode: AgentMode },
): Promise<ConversationAccess> {
  try {
    const { data, error } = await supabase
      .from("agent_conversations")
      .select("id, buyer_id")
      .eq("id", input.id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!data) {
      const { error: insertError } = await supabase.from("agent_conversations").insert({
        id: input.id,
        channel: input.channel,
        buyer_id: input.buyerId,
        ip_hash: input.ipHash,
        started_as: input.mode,
      });
      if (insertError) throw new Error(insertError.message);
      return "ok";
    }

    const owner = (data as { buyer_id: string | null }).buyer_id;
    if (owner && owner !== input.buyerId) return "forbidden";
    if (!owner && input.buyerId) {
      // Visitante que se cadastrou no meio da conversa.
      const { error: updateError } = await supabase
        .from("agent_conversations")
        .update({ buyer_id: input.buyerId })
        .eq("id", input.id);
      if (updateError) throw new Error(updateError.message);
    }
    return "ok";
  } catch (error) {
    console.error("[agent-conversations] falha ao abrir conversa:", error);
    return "unavailable";
  }
}

export async function loadHistory(supabase: SupabaseClient, conversationId: string): Promise<UIMessage[]> {
  try {
    const { data, error } = await supabase
      .from("agent_messages")
      .select("message_id, role, parts")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    if (error) throw new Error(error.message);
    return ((data as StoredMessageRow[] | null) ?? [])
      .reverse()
      .map((row) => ({ id: row.message_id, role: row.role, parts: row.parts }));
  } catch (error) {
    console.error("[agent-conversations] falha ao carregar histórico:", error);
    return [];
  }
}

export async function saveTurn(
  supabase: SupabaseClient,
  input: { conversationId: string; mode: AgentMode; messages: UIMessage[] },
): Promise<void> {
  const base = Date.now();
  // Horários explícitos e crescentes: no mesmo insert o default now() empataria
  // e a ordem do histórico ficaria ambígua.
  const rows = input.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message, index) => ({
      conversation_id: input.conversationId,
      message_id: message.id,
      role: message.role,
      content: messageText(message),
      parts: message.parts,
      mode: input.mode,
      created_at: new Date(base + index).toISOString(),
    }));

  try {
    const { error } = await supabase
      .from("agent_messages")
      .upsert(rows, { onConflict: "conversation_id,message_id" });
    if (error) throw new Error(error.message);

    const { error: touchError } = await supabase
      .from("agent_conversations")
      .update({ updated_at: new Date(base).toISOString() })
      .eq("id", input.conversationId);
    if (touchError) throw new Error(touchError.message);
  } catch (error) {
    console.error("[agent-conversations] falha ao gravar mensagens:", error);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-conversations.test.ts`
Expected: PASS (11 testes).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/test-utils/fake-supabase.ts packages/core/src/agent-conversations.ts packages/core/src/agent-conversations.test.ts
git commit -m "feat(agente): conversas do agente no Supabase com posse por comprador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Stream com troca de provedor antes do primeiro conteúdo

**Files:**
- Create: `packages/core/src/agent-stream.ts`
- Test: `packages/core/src/agent-stream.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type StreamCandidate<T> = { provider: string; open: () => ReadableStream<T> };
  export function openStreamWithFallback<T extends { type: string }>(
    candidates: StreamCandidate<T>[],
  ): Promise<ReadableStream<T> | null>;
  ```
  Partes `start` e `start-step` são "preâmbulo": ficam guardadas até chegar a primeira parte de conteúdo. Se antes disso vier `{ type: "error" }` (ou o stream lançar), tenta o próximo provedor. Depois do primeiro conteúdo, tudo passa adiante (inclusive erros). Todos falhando → `null`.

- [ ] **Step 1: Write the failing test**

Criar `packages/core/src/agent-stream.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { openStreamWithFallback } from "./agent-stream";

type Part = { type: string; value?: string; error?: unknown };

function streamOf(parts: Part[]): ReadableStream<Part> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

async function readAll<T>(stream: ReadableStream<T>): Promise<T[]> {
  const out: T[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return out;
    out.push(value);
  }
}

vi.spyOn(console, "error").mockImplementation(() => {});

const ok = [{ type: "start" }, { type: "start-step" }, { type: "text-delta", value: "Oi" }, { type: "finish" }];

describe("openStreamWithFallback", () => {
  it("usa o primeiro provedor quando ele responde", async () => {
    const second = vi.fn(() => streamOf(ok));
    const stream = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf(ok) },
      { provider: "google", open: second },
    ]);
    expect(await readAll(stream!)).toEqual(ok);
    expect(second).not.toHaveBeenCalled();
  });

  it("troca de provedor quando o erro vem antes do primeiro conteúdo", async () => {
    const stream = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf([{ type: "start" }, { type: "start-step" }, { type: "error", error: "429" }]) },
      { provider: "google", open: () => streamOf(ok) },
    ]);
    expect(await readAll(stream!)).toEqual(ok);
  });

  it("troca de provedor quando abrir o stream lança", async () => {
    const stream = await openStreamWithFallback([
      {
        provider: "openai",
        open: () => {
          throw new Error("sem chave");
        },
      },
      { provider: "google", open: () => streamOf(ok) },
    ]);
    expect(await readAll(stream!)).toEqual(ok);
  });

  it("depois do primeiro conteúdo, erros passam adiante sem trocar de provedor", async () => {
    const parts = [{ type: "start" }, { type: "text-delta", value: "Oi" }, { type: "error", error: "caiu" }];
    const second = vi.fn(() => streamOf(ok));
    const stream = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf(parts) },
      { provider: "google", open: second },
    ]);
    expect(await readAll(stream!)).toEqual(parts);
    expect(second).not.toHaveBeenCalled();
  });

  it("devolve null quando todos falham", async () => {
    const stream = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf([{ type: "error", error: "x" }]) },
      { provider: "google", open: () => streamOf([{ type: "start" }, { type: "error", error: "y" }]) },
    ]);
    expect(stream).toBeNull();
  });

  it("stream sem conteúdo (só preâmbulo) não é falha", async () => {
    const parts = [{ type: "start" }, { type: "start-step" }];
    const stream = await openStreamWithFallback([{ provider: "openai", open: () => streamOf(parts) }]);
    expect(await readAll(stream!)).toEqual(parts);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-stream.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-stream"`.

- [ ] **Step 3: Write minimal implementation**

Criar `packages/core/src/agent-stream.ts`:

```ts
// Com streaming, só dá para trocar de provedor enquanto nada foi enviado ao
// navegador. Este helper lê o começo do stream: se o provedor falhar antes da
// primeira parte de conteúdo, tenta o próximo; depois disso, segue com ele.

export type StreamCandidate<T> = { provider: string; open: () => ReadableStream<T> };

const PRELUDE_TYPES = new Set(["start", "start-step"]);

export async function openStreamWithFallback<T extends { type: string }>(
  candidates: StreamCandidate<T>[],
): Promise<ReadableStream<T> | null> {
  for (const candidate of candidates) {
    let reader: ReadableStreamDefaultReader<T>;
    try {
      reader = candidate.open().getReader();
    } catch (error) {
      console.error(`[agent-stream] provedor "${candidate.provider}" falhou ao abrir:`, error);
      continue;
    }

    const buffered: T[] = [];
    let failed = false;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value.type === "error") {
          console.error(
            `[agent-stream] provedor "${candidate.provider}" falhou antes de responder:`,
            (value as { error?: unknown }).error,
          );
          failed = true;
          break;
        }
        buffered.push(value);
        if (!PRELUDE_TYPES.has(value.type)) break;
      }
    } catch (error) {
      console.error(`[agent-stream] provedor "${candidate.provider}" falhou antes de responder:`, error);
      failed = true;
    }

    if (failed) {
      reader.cancel().catch(() => {});
      continue;
    }

    return new ReadableStream<T>({
      start(controller) {
        for (const part of buffered) controller.enqueue(part);
      },
      async pull(controller) {
        try {
          const { value, done } = await reader.read();
          if (done) controller.close();
          else controller.enqueue(value);
        } catch (error) {
          controller.error(error);
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-stream.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-stream.ts packages/core/src/agent-stream.test.ts
git commit -m "feat(agente): stream com troca de provedor antes do primeiro conteúdo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Handler do agente (`createAgentHandler`)

**Files:**
- Create: `packages/core/src/agent-server.ts`
- Modify: `packages/core/package.json` (export `./agent-server`)
- Test: `packages/core/src/agent-server.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4, 5, 6, 7; `getAssistantModelChain()` (`./ai-provider`); `getArtigosAjudaPublicados()` (`./help-center`); `rejectForeignRequest(req)` (`./request-guards`); `getHubServiceClient()` (`./supabase`).
- Produces:
  ```ts
  export type AgentBuyer = { id: string; empresa: string | null };
  export type AgentConfig = {
    channel: string; siteName: string; faq: readonly AgentFaqItem[];
    resolveBuyer: (req: NextRequest) => Promise<AgentBuyer | null>;
  };
  export function createAgentHandler(config: AgentConfig): (req: NextRequest) => Promise<Response>;
  ```
  Respostas: stream de UI messages (200) | 400 `INVALID_INPUT` | 403 `CONVERSATION_FORBIDDEN` | 403/415 do `rejectForeignRequest` | 429/503 da cota | 502 `AI_PROVIDER_ERROR`.

- [ ] **Step 1: Write the failing test**

Criar `packages/core/src/agent-server.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

vi.mock("./ai-provider", () => ({ getAssistantModelChain: vi.fn() }));
vi.mock("./ai-usage-limits", () => ({ consumeAiQuota: vi.fn(async () => null), hashClientIp: () => "iphash" }));
vi.mock("./help-center", () => ({ getArtigosAjudaPublicados: vi.fn(async () => []) }));
vi.mock("./catalog", () => ({ getBrands: vi.fn(async () => []) }));
vi.mock("./catalog-line-items", () => ({ getCatalogLineItems: vi.fn() }));
vi.mock("./supabase", () => ({ getHubServiceClient: () => ({}) }));
vi.mock("./agent-conversations", () => ({
  ensureConversation: vi.fn(async () => "ok"),
  loadHistory: vi.fn(async () => []),
  saveTurn: vi.fn(async () => {}),
}));

import { getAssistantModelChain } from "./ai-provider";
import { consumeAiQuota } from "./ai-usage-limits";
import { getCatalogLineItems } from "./catalog-line-items";
import { ensureConversation, loadHistory, saveTurn } from "./agent-conversations";
import { createAgentHandler, type AgentBuyer } from "./agent-server";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};
const finish = (unified: "stop" | "tool-calls") => ({
  type: "finish" as const,
  finishReason: { unified, raw: undefined },
  logprobs: undefined,
  usage,
});
const textChunks = (text: string) => [
  { type: "text-start" as const, id: "t1" },
  { type: "text-delta" as const, id: "t1", delta: text },
  { type: "text-end" as const, id: "t1" },
  finish("stop"),
];

function textModel(text: string) {
  return new MockLanguageModelV4({
    doStream: async () => ({ stream: simulateReadableStream({ chunks: textChunks(text) }) }),
  });
}

// Primeiro passo: chama buscar_produtos; segundo passo: responde em texto.
function searchThenTextModel(text: string) {
  let call = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      call += 1;
      if (call === 1) {
        return {
          stream: simulateReadableStream({
            chunks: [
              {
                type: "tool-call" as const,
                toolCallId: "c1",
                toolName: "buscar_produtos",
                input: JSON.stringify({ query: "shampoo" }),
              },
              finish("tool-calls"),
            ],
          }),
        };
      }
      return { stream: simulateReadableStream({ chunks: textChunks(text) }) };
    },
  });
}

function failingModel() {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw new Error("provedor fora do ar");
    },
  });
}

const lineItem = {
  id: "p1",
  name: "Shampoo Neutro",
  sku: "SKU1",
  brand: "Pet Clean",
  img: "/x.jpg",
  unitPrice: 89.9,
  priceLabel: "R$ 89,90",
  variantLabel: "5L",
};

const conversationId = "3f1c2a7e-8b4d-4c1a-9f2e-1a2b3c4d5e6f";
const userMessage = { id: "m1", role: "user", parts: [{ type: "text", text: "Tem shampoo?" }] };

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/agente", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function handler(buyer: AgentBuyer | null | Error = null) {
  return createAgentHandler({
    channel: "mypetbrasil",
    siteName: "My Pet Brasil",
    faq: [{ q: "Qual é o pedido mínimo?", a: "R$ 250,00." }],
    resolveBuyer: async () => {
      if (buyer instanceof Error) throw buyer;
      return buyer;
    },
  });
}

const validBody = { id: conversationId, message: userMessage, cart: [] };

vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  (getCatalogLineItems as Mock).mockResolvedValue({ items: [lineItem], total: 1, page: 1, totalPages: 1 });
});

function useModels(...models: MockLanguageModelV4[]) {
  (getAssistantModelChain as Mock).mockReturnValue(
    models.map((model, i) => ({ provider: i === 0 ? "openai" : "google", model })),
  );
}

describe("POST /api/agente", () => {
  it("responde em stream com o texto do modelo", async () => {
    useModels(textModel("Olá! Como posso ajudar?"));
    const res = await handler()(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Olá! Como posso ajudar?");
  });

  it("visitante: produtos sem preço no stream", async () => {
    useModels(searchThenTextModel("Encontrei estas opções."));
    const body = await (await handler()(makeRequest(validBody))).text();
    expect(body).toContain("Shampoo Neutro");
    expect(body).toContain('"unitPrice":null');
    expect(body).not.toContain("89,9");
    expect(body).not.toContain("89.9");
    expect(body).toContain("Encontrei estas opções.");
  });

  it("cliente: produtos com preço no stream", async () => {
    useModels(searchThenTextModel("Encontrei."));
    const body = await (await handler({ id: "b1", empresa: "Pet Shop X" })(makeRequest(validBody))).text();
    expect(body).toContain("R$ 89,90");
  });

  it("instruções do modo e empresa chegam ao modelo", async () => {
    const model = textModel("Oi.");
    useModels(model);
    await (await handler({ id: "b1", empresa: "Pet Shop X" })(makeRequest(validBody))).text();
    const prompt = JSON.stringify(model.doStreamCalls[0].prompt);
    expect(prompt).toContain("Você atende um cliente cadastrado: Pet Shop X.");
  });

  it("falha ao identificar comprador trata como visitante", async () => {
    useModels(searchThenTextModel("Encontrei."));
    const body = await (await handler(new Error("cookie"))(makeRequest(validBody))).text();
    expect(body).toContain('"unitPrice":null');
    expect(consumeAiQuota).toHaveBeenCalledWith("duvidas", "mypetbrasil", expect.any(Headers));
  });

  it("cota: visitante por IP, cliente por comprador", async () => {
    useModels(textModel("Oi."));
    await (await handler()(makeRequest(validBody))).text();
    expect(consumeAiQuota).toHaveBeenLastCalledWith("duvidas", "mypetbrasil", expect.any(Headers));
    await (await handler({ id: "b1", empresa: null })(makeRequest(validBody))).text();
    expect(consumeAiQuota).toHaveBeenLastCalledWith("agente_cliente", "mypetbrasil", expect.any(Headers), "b1");
  });

  it("cota estourada: não chama a IA", async () => {
    useModels(textModel("Oi."));
    (consumeAiQuota as Mock).mockResolvedValueOnce(
      Response.json({ ok: false, error: { code: "RATE_LIMITED", message: "Aguarde." } }, { status: 429 }),
    );
    const res = await handler()(makeRequest(validBody));
    expect(res.status).toBe(429);
    expect(ensureConversation).not.toHaveBeenCalled();
  });

  it("troca para o próximo provedor quando o primeiro falha antes de responder", async () => {
    useModels(failingModel(), textModel("Resposta do Gemini."));
    const res = await handler()(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Resposta do Gemini.");
  });

  it("502 quando todos os provedores falham", async () => {
    useModels(failingModel(), failingModel());
    const res = await handler()(makeRequest(validBody));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("AI_PROVIDER_ERROR");
  });

  it("carrega o histórico do banco e grava a pergunta e a resposta", async () => {
    const model = textModel("Pode ser de 2L também.");
    useModels(model);
    (loadHistory as Mock).mockResolvedValueOnce([
      { id: "m0", role: "user", parts: [{ type: "text", text: "Tem shampoo neutro?" }] },
    ]);
    await (await handler()(makeRequest(validBody))).text();

    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain("Tem shampoo neutro?");
    await vi.waitFor(() => expect(saveTurn).toHaveBeenCalled());
    const [, saved] = (saveTurn as Mock).mock.calls[0];
    expect(saved.conversationId).toBe(conversationId);
    expect(saved.mode).toBe("visitante");
    expect(saved.messages[0]).toEqual({ id: "m1", role: "user", parts: [{ type: "text", text: "Tem shampoo?" }] });
    expect(saved.messages[1].role).toBe("assistant");
  });

  it("403 quando a conversa pertence a outro comprador", async () => {
    useModels(textModel("Oi."));
    (ensureConversation as Mock).mockResolvedValueOnce("forbidden");
    const res = await handler({ id: "b2", empresa: null })(makeRequest(validBody));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("CONVERSATION_FORBIDDEN");
  });

  it("banco indisponível: responde sem histórico e sem gravar", async () => {
    useModels(textModel("Oi."));
    (ensureConversation as Mock).mockResolvedValueOnce("unavailable");
    const res = await handler()(makeRequest(validBody));
    expect(await res.text()).toContain("Oi.");
    expect(loadHistory).not.toHaveBeenCalled();
    expect(saveTurn).not.toHaveBeenCalled();
  });

  it("400 para corpo inválido, sem consumir cota", async () => {
    const res = await handler()(makeRequest({ id: "x", message: userMessage }));
    expect(res.status).toBe(400);
    expect(consumeAiQuota).not.toHaveBeenCalled();
  });

  it("rejeita requisição de outra origem", async () => {
    const res = await handler()(makeRequest(validBody, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });
});
```

> Se `doStreamCalls` não existir no `MockLanguageModelV4` desta versão, conferir o nome da propriedade em `node_modules/.pnpm/ai@7.0.19_zod@4.4.3/node_modules/ai/dist/test/index.d.ts` (classe `MockLanguageModelV4`) e ajustar as duas asserções. Se o formato do chunk `tool-call` for diferente, conferir `LanguageModelV4StreamPart` em `@ai-sdk/provider`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-server.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-server"`.

- [ ] **Step 3: Write the implementation**

Criar `packages/core/src/agent-server.ts`:

```ts
import type { NextRequest } from "next/server";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type ToolSet,
  type UIMessage,
} from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAssistantModelChain } from "./ai-provider";
import { consumeAiQuota, hashClientIp } from "./ai-usage-limits";
import { buildCatalogTool } from "./agent-catalog-tool";
import { ensureConversation, loadHistory, saveTurn, type ConversationAccess } from "./agent-conversations";
import { buildAgentInstructions, type AgentFaqItem, type AgentMode } from "./agent-prompt";
import { parseAgentRequest } from "./agent-request";
import { openStreamWithFallback } from "./agent-stream";
import { getArtigosAjudaPublicados } from "./help-center";
import { rejectForeignRequest } from "./request-guards";
import { getHubServiceClient } from "./supabase";

// Agente /agente: um agente com dois modos. O modo vem só do cookie (via
// resolveBuyer); o histórico vem do banco; o navegador manda só a pergunta nova.

export type AgentBuyer = { id: string; empresa: string | null };

export type AgentConfig = {
  channel: string;
  siteName: string;
  faq: readonly AgentFaqItem[];
  resolveBuyer: (req: NextRequest) => Promise<AgentBuyer | null>;
};

const AGENT_TIMEOUT_MS = 45_000;
const MAX_STEPS = 5;
const MAX_REPLY_TOKENS = 600;
const UNAVAILABLE_MESSAGE = "Não foi possível responder agora. Tente novamente em instantes.";

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

async function safeResolveBuyer(config: AgentConfig, req: NextRequest): Promise<AgentBuyer | null> {
  try {
    return await config.resolveBuyer(req);
  } catch (error) {
    console.error("[agent] falha ao identificar comprador:", error);
    return null;
  }
}

async function validateHistory(messages: UIMessage[], tools: ToolSet): Promise<UIMessage[]> {
  try {
    return await validateUIMessages({ messages, tools });
  } catch (error) {
    console.error("[agent] histórico inválido, seguindo só com a pergunta atual:", error);
    return messages.slice(-1);
  }
}

export function createAgentHandler(config: AgentConfig) {
  return async function POST(req: NextRequest): Promise<Response> {
    const foreign = rejectForeignRequest(req);
    if (foreign) return foreign;

    const parsed = parseAgentRequest(await req.json().catch(() => null));
    if (!parsed.ok) return errorResponse(400, "INVALID_INPUT", parsed.message);
    const { id, message, cart } = parsed.value;

    const buyer = await safeResolveBuyer(config, req);
    const mode: AgentMode = buyer ? "cliente" : "visitante";

    const limited = buyer
      ? await consumeAiQuota("agente_cliente", config.channel, req.headers, buyer.id)
      : await consumeAiQuota("duvidas", config.channel, req.headers);
    if (limited) return limited;

    let supabase: SupabaseClient | null = null;
    let access: ConversationAccess = "unavailable";
    try {
      supabase = getHubServiceClient();
      access = await ensureConversation(supabase, {
        id,
        channel: config.channel,
        buyerId: buyer?.id ?? null,
        ipHash: hashClientIp(req.headers),
        mode,
      });
    } catch (error) {
      console.error("[agent] Supabase indisponível:", error);
    }
    if (access === "forbidden") {
      return errorResponse(403, "CONVERSATION_FORBIDDEN", "Esta conversa não está disponível. Comece uma nova.");
    }
    const store = access === "ok" ? supabase : null;

    const tools = { buscar_produtos: buildCatalogTool({ channel: config.channel, showPrices: mode === "cliente" }) };
    const history = store ? await loadHistory(store, id) : [];
    const messages = await validateHistory([...history, message], tools);
    const artigos = await getArtigosAjudaPublicados();
    const instructions = buildAgentInstructions({
      siteName: config.siteName,
      mode,
      empresa: buyer?.empresa ?? null,
      cart: mode === "cliente" ? cart : [],
      faq: config.faq,
      artigos,
    });
    const modelMessages = await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true });

    const stream = await openStreamWithFallback(
      getAssistantModelChain().map((candidate) => ({
        provider: candidate.provider,
        open: () =>
          streamText({
            model: candidate.model,
            instructions,
            messages: modelMessages,
            tools,
            stopWhen: isStepCount(MAX_STEPS),
            maxOutputTokens: MAX_REPLY_TOKENS,
            maxRetries: 1,
            abortSignal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
            onError: ({ error }) => console.error(`[agent] erro no provedor "${candidate.provider}":`, error),
          }).stream,
      })),
    );
    if (!stream) return errorResponse(502, "AI_PROVIDER_ERROR", UNAVAILABLE_MESSAGE);

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream,
        tools,
        originalMessages: messages,
        generateMessageId: () => crypto.randomUUID(),
        onError: () => UNAVAILABLE_MESSAGE,
        onEnd: async ({ responseMessage }) => {
          if (!store) return;
          await saveTurn(store, { conversationId: id, mode, messages: [message, responseMessage] });
        },
      }),
    });
  };
}
```

Em `packages/core/package.json`, no bloco `"exports"`, adicionar antes da linha `"./ai-provider": "./src/ai-provider.ts",`:

```json
    "./agent-server": "./src/agent-server.ts",
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-server.test.ts`
Expected: PASS (14 testes). Se algum tipo do AI SDK não bater (ex.: `onError` de `streamText` ou `generateMessageId`), conferir a assinatura em `node_modules/.pnpm/ai@7.0.19_zod@4.4.3/node_modules/ai/dist/index.d.ts` (busque `declare function streamText` e `declare function toUIMessageStream`) e ajustar sem mudar o comportamento testado.

- [ ] **Step 5: Rodar todos os testes do agente juntos**

Run: `pnpm --filter @mypet/core exec vitest run src/agent- src/ai-usage-limits.test.ts`
Expected: PASS em todos os arquivos `agent-*` e `ai-usage-limits`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/agent-server.ts packages/core/src/agent-server.test.ts packages/core/package.json
git commit -m "feat(agente): handler do agente com streaming, dois modos e histórico no banco

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Rota `/api/agente` no mypet

**Files:**
- Create: `apps/mypet/app/api/agente/route.ts`
- Test: `apps/mypet/app/api/agente/route.test.ts`

**Interfaces:**
- Consumes: `createAgentHandler`, `type AgentConfig` (`@mypet/core/agent-server`, Task 8); `requireBuyer(): Promise<Buyer | null>` (`@/lib/require-buyer`); `commercialFaq` (`../../pre-access-content`); `clientConfig` (`@/client.config`).

- [ ] **Step 1: Write the failing test**

Criar `apps/mypet/app/api/agente/route.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { AgentConfig } from "@mypet/core/agent-server";

// vi.hoisted: o mock roda no import de "./route", antes das declarações do arquivo.
const { captured, requireBuyer } = vi.hoisted(() => ({
  captured: {} as { config?: AgentConfig },
  requireBuyer: vi.fn(),
}));

vi.mock("@mypet/core/agent-server", () => ({
  createAgentHandler: (config: AgentConfig) => {
    captured.config = config;
    return async () => new Response(null);
  },
}));
vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));

import "./route";

describe("/api/agente", () => {
  it("usa o canal, o nome e o FAQ do site", () => {
    expect(captured.config?.channel).toBe("mypetbrasil");
    expect(captured.config?.siteName).toBe("My Pet Brasil");
    expect(captured.config?.faq.length).toBeGreaterThan(0);
  });

  it("identifica o comprador pelo cookie (requireBuyer)", async () => {
    const resolveBuyer = captured.config!.resolveBuyer;

    requireBuyer.mockResolvedValueOnce({
      id: "b1",
      empresa: "Pet Shop X",
      email: null,
      nome: null,
      whatsapp: "5511999990000",
      cnpj: "00000000000100",
    });
    expect(await resolveBuyer({} as never)).toEqual({ id: "b1", empresa: "Pet Shop X" });

    requireBuyer.mockResolvedValueOnce(null);
    expect(await resolveBuyer({} as never)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter mypet exec vitest run app/api/agente/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Write minimal implementation**

Criar `apps/mypet/app/api/agente/route.ts`:

```ts
import { createAgentHandler } from "@mypet/core/agent-server";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { commercialFaq } from "../../pre-access-content";

export const POST = createAgentHandler({
  channel: clientConfig.catalogChannel,
  siteName: clientConfig.name,
  faq: commercialFaq,
  resolveBuyer: async () => {
    const buyer = await requireBuyer();
    return buyer ? { id: buyer.id, empresa: buyer.empresa } : null;
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter mypet exec vitest run app/api/agente/route.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/api/agente/route.ts apps/mypet/app/api/agente/route.test.ts
git commit -m "feat(mypet): rota /api/agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verificação final, migration e teste ponta a ponta

**Files:** nenhum novo.

- [ ] **Step 1: Suítes completas**

Run: `pnpm --filter @mypet/core test` e `pnpm --filter mypet test`
Expected: PASS em ambos. Falha fora dos arquivos deste bloco → conferir `git status`/`git stash list` antes de mexer (pode ser alteração de outra frente no working tree) e reportar.

- [ ] **Step 2: Tipos**

Run: `pnpm --filter @mypet/core exec tsc --noEmit` e `pnpm --filter mypet exec tsc --noEmit`
Expected: nenhum erro nos arquivos `agent-*`, `ai-usage-limits.ts`, `test-utils/fake-supabase.ts` e `app/api/agente/*`. Erros que já existiam em outros arquivos não bloqueiam este bloco — listar quais são no relato final.

- [ ] **Step 3: Build**

Run: `pnpm --filter mypet build`
Expected: build ok, `/api/agente` listada como rota dinâmica.

- [ ] **Step 4: Aplicar a migration — PEDIR CONFIRMAÇÃO AO USUÁRIO ANTES**

Perguntar ao usuário se pode aplicar `supabase/migrations/20261014120000_agent_conversations.sql` no projeto Supabase de produção. Só com o "sim":
- aplicar com a ferramenta MCP `apply_migration` (nome `agent_conversations`, conteúdo do arquivo) **ou** pelo fluxo que o usuário indicar;
- conferir com `list_tables` que `agent_conversations` e `agent_messages` existem com RLS ligado;
- rodar `get_advisors` (security) e confirmar que não surgiu alerta novo para essas tabelas.

- [ ] **Step 5: Teste ponta a ponta com a API**

Com `pnpm --filter mypet dev` (porta 4100) e as chaves de IA no `.env.local`:

```bash
curl -N -s http://localhost:4100/api/agente \
  -H "content-type: application/json" \
  -d '{"id":"3f1c2a7e-8b4d-4c1a-9f2e-1a2b3c4d5e6f","message":{"id":"m1","role":"user","parts":[{"type":"text","text":"vocês têm shampoo neutro?"}]}}'
```

Expected: linhas `data: {...}` chegando aos poucos; uma `tool-output-available` com produtos e `"unitPrice":null`; texto curto em português sem preço e sem WhatsApp do time. Repetir com outra pergunta no mesmo `id` ("e de 2 litros?") e conferir que o agente entende o contexto (histórico carregado do banco). No Supabase, conferir as linhas em `agent_conversations` e `agent_messages`.

Para o modo cliente: entrar no site (`/entrar`) no navegador, copiar o cookie `mypet_acesso` e repetir o `curl` com `-H "cookie: mypet_acesso=<valor>"` e um `id` novo → produtos com preço; `buyer_id` preenchido na conversa. Repetir com o mesmo `id` sem o cookie → 403 `CONVERSATION_FORBIDDEN`.

- [ ] **Step 6: Relatar**

Resumir ao usuário: testes, tipos, build, migration (aplicada ou não), resultado do `curl` nos dois modos e qualquer desvio do plano.
