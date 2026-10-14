# Agente My Pet — Etapa 1 (catálogo do Hub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O assistente de dúvidas (`/api/duvidas`) passa a consultar produtos do catálogo do Hub: visitante vê nome/marca/variação; comprador cadastrado vê também preço e link para a tabela.

**Architecture:** Nova ferramenta `buscar_produtos` (arquivo próprio no core) sobre `getCatalogLineItems`, registrada no handler de suporte só quando o app passa `catalog.resolveIsBuyer`. Para visitante, o preço nunca entra no resultado da ferramenta. O handler devolve `products` estruturados + `showPrices`; a UI renderiza uma mini-lista sob a resposta. `/pedido-rapido` passa a aceitar `?q=`.

**Tech Stack:** Next 16.2 (App Router, `cacheComponents: true`), AI SDK `ai@7` (`generateText`, `tool`, `stepCountIs`), `zod@4`, Vitest 4 + Testing Library, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-14-agente-etapa1-catalogo-design.md`

## Global Constraints

- Preço só para comprador cadastrado; para visitante o preço **não** aparece no resultado da ferramenta nem na resposta (`priceLabel: null`, `showPrices: false`).
- Falha em `resolveIsBuyer` → tratar como visitante.
- Nenhum texto voltado ao visitante cita WhatsApp do time; saída é sempre `/cadastro` ou `/central-de-ajuda`.
- Copy: nunca "atacado", "cotação", nem chamar o hotsite de "loja"; nunca prometer desconto, condição especial ou preço melhor (preços iguais ao mypetbrasil.com).
- Até 8 produtos para o modelo; até 5 na resposta; `stopWhen: stepCountIs(3)`; `maxOutputTokens: 500`; cota inalterada (1 unidade/pergunta, escopo `duvidas`).
- Commits só com os arquivos da task (o working tree pode ter alterações de outras frentes — nunca `git add -A`). Trabalho direto na `main`, sem worktree. Toda mensagem de commit termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Rodar testes do core: `pnpm --filter @mypet/core exec vitest run <arquivo>`; do app: `pnpm --filter mypet exec vitest run <arquivo>`.

---

### Task 1: Mensagem de limite diário sem WhatsApp

**Files:**
- Modify: `packages/core/src/ai-usage-limits.ts:53`
- Test: `packages/core/src/ai-usage-limits.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada novo (só texto).

- [ ] **Step 1: Write the failing test**

Adicionar ao fim do `describe` que contém `it.each(["ip_burst", "ip_daily", "global_daily"])` em `packages/core/src/ai-usage-limits.test.ts`:

```ts
  it("mensagem de limite diário orienta para a central de ajuda, sem WhatsApp", async () => {
    rpc.mockResolvedValue({ data: "ip_daily", error: null });
    const res = await consumeAiQuota("duvidas", "mypetbrasil", headers());
    const body = await res?.json();
    expect(body.error.message).toContain("central de ajuda");
    expect(body.error.message).not.toMatch(/whatsapp/i);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/ai-usage-limits.test.ts`
Expected: FAIL — mensagem atual contém "WhatsApp".

- [ ] **Step 3: Write minimal implementation**

Em `packages/core/src/ai-usage-limits.ts`, trocar a linha `ip_daily` de `LIMIT_MESSAGES` por:

```ts
  ip_daily: "Você atingiu o limite de perguntas de hoje. Volte amanhã ou consulte a nossa central de ajuda.",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mypet/core exec vitest run src/ai-usage-limits.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ai-usage-limits.ts packages/core/src/ai-usage-limits.test.ts
git commit -m "fix(ai): limite diário orienta para a central de ajuda em vez do WhatsApp"
```

---

### Task 2: Ferramenta de catálogo do assistente de dúvidas

**Files:**
- Create: `packages/core/src/support-catalog-tool.ts`
- Test: `packages/core/src/support-catalog-tool.test.ts`

**Interfaces:**
- Consumes: `getBrands(channel: string): Promise<string[]>` de `./catalog`; `getCatalogLineItems(params: { q?: string; brand?: string; page: number; channel: string }): Promise<CatalogLineItemsResult>` e `type CatalogLineItem` de `./catalog-line-items`.
- Produces:
  ```ts
  export type SupportProduct = {
    id: string; name: string; sku: string; brand: string | null;
    variantLabel: string | null; priceLabel: string | null;
  };
  export type SupportCatalogState = { lastProducts: SupportProduct[] };
  export const MAX_REPLY_PRODUCTS = 5;
  export function resolveBrand(raw: string | undefined, channel: string): Promise<string | undefined>;
  export function buildSupportCatalogTools(opts: { channel: string; showPrices: boolean; state: SupportCatalogState }):
    { buscar_produtos: Tool };
  ```

- [ ] **Step 1: Write the failing test**

Criar `packages/core/src/support-catalog-tool.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("./catalog", () => ({ getBrands: vi.fn() }));
vi.mock("./catalog-line-items", () => ({ getCatalogLineItems: vi.fn() }));

import { getBrands } from "./catalog";
import { getCatalogLineItems } from "./catalog-line-items";
import { buildSupportCatalogTools, resolveBrand, type SupportCatalogState } from "./support-catalog-tool";

const item = (i: number) => ({
  id: `p${i}`,
  name: `Shampoo Neutro ${i}`,
  sku: `SKU${i}`,
  brand: "Pet Clean",
  img: "/x.jpg",
  unitPrice: 10 + i,
  priceLabel: `R$ ${10 + i},00`,
  variantLabel: i % 2 ? "5L" : null,
});

const toolOptions = { toolCallId: "t1", messages: [] };

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

function run(showPrices: boolean, input: { query: string; marca?: string }) {
  const state: SupportCatalogState = { lastProducts: [] };
  const tools = buildSupportCatalogTools({ channel: "mypetbrasil", showPrices, state });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const execute = tools.buscar_produtos.execute as (input: any, options: any) => Promise<any>;
  return { state, result: execute(input, toolOptions) };
}

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
  it("visitante: resultado para o modelo e produtos guardados não têm preço", async () => {
    const { state, result } = run(false, { query: "shampoo neutro" });
    const out = await result;
    expect(out.total).toBe(10);
    expect(out.produtos).toHaveLength(8);
    expect(JSON.stringify(out)).not.toContain("R$");
    for (const p of out.produtos) expect(p).not.toHaveProperty("preco");
    expect(state.lastProducts).toHaveLength(5);
    expect(state.lastProducts.every((p) => p.priceLabel === null)).toBe(true);
  });

  it("cadastrado: preço vai para o modelo e para os produtos guardados", async () => {
    const { state, result } = run(true, { query: "shampoo neutro" });
    const out = await result;
    expect(out.produtos[0]).toEqual({
      id: "p1",
      nome: "Shampoo Neutro 1",
      variacao: "5L",
      marca: "Pet Clean",
      preco: "R$ 11,00",
    });
    expect(state.lastProducts[0]).toEqual({
      id: "p1",
      name: "Shampoo Neutro 1",
      sku: "SKU1",
      brand: "Pet Clean",
      variantLabel: "5L",
      priceLabel: "R$ 11,00",
    });
  });

  it("busca a primeira página no canal com a marca resolvida", async () => {
    await run(false, { query: "shampoo", marca: "pet clean" }).result;
    expect(getCatalogLineItems).toHaveBeenCalledWith({
      q: "shampoo",
      brand: "Pet Clean",
      page: 1,
      channel: "mypetbrasil",
    });
  });

  it("marca desconhecida: busca sem filtro de marca", async () => {
    await run(false, { query: "shampoo", marca: "Marca X" }).result;
    expect(getCatalogLineItems).toHaveBeenCalledWith({
      q: "shampoo",
      brand: undefined,
      page: 1,
      channel: "mypetbrasil",
    });
  });

  it("nova busca substitui os produtos guardados", async () => {
    const state: SupportCatalogState = { lastProducts: [] };
    const tools = buildSupportCatalogTools({ channel: "mypetbrasil", showPrices: false, state });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const execute = tools.buscar_produtos.execute as (input: any, options: any) => Promise<any>;
    await execute({ query: "shampoo" }, toolOptions);
    (getCatalogLineItems as Mock).mockResolvedValueOnce({ items: [item(42)], total: 1, page: 1, totalPages: 1 });
    await execute({ query: "coleira" }, toolOptions);
    expect(state.lastProducts.map((p) => p.id)).toEqual(["p42"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mypet/core exec vitest run src/support-catalog-tool.test.ts`
Expected: FAIL — `Failed to resolve import "./support-catalog-tool"`.

- [ ] **Step 3: Write minimal implementation**

Criar `packages/core/src/support-catalog-tool.ts`:

```ts
import { tool } from "ai";
import { z } from "zod";
import { getBrands } from "./catalog";
import { getCatalogLineItems, type CatalogLineItem } from "./catalog-line-items";

// Ferramenta do assistente de dúvidas para consultar o catálogo do Hub. Para
// visitante sem cadastro o preço não entra no resultado: o modelo nunca o vê,
// então não há como vazar por engenharia de prompt.

export type SupportProduct = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  variantLabel: string | null;
  priceLabel: string | null;
};

export type SupportCatalogState = { lastProducts: SupportProduct[] };

const MAX_TOOL_ITEMS = 8;
export const MAX_REPLY_PRODUCTS = 5;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

// O filtro de marca do catálogo é igualdade exata; o modelo escreve a marca do
// jeito que o visitante digitou.
export async function resolveBrand(raw: string | undefined, channel: string): Promise<string | undefined> {
  if (!raw?.trim()) return undefined;
  const target = normalize(raw);
  const brands = await getBrands(channel);
  return brands.find((brand) => normalize(brand) === target);
}

function toSupportProduct(item: CatalogLineItem, showPrices: boolean): SupportProduct {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    brand: item.brand,
    variantLabel: item.variantLabel,
    priceLabel: showPrices ? item.priceLabel : null,
  };
}

export function buildSupportCatalogTools({
  channel,
  showPrices,
  state,
}: {
  channel: string;
  showPrices: boolean;
  state: SupportCatalogState;
}) {
  return {
    buscar_produtos: tool({
      description:
        "Busca produtos da tabela por tipo ou nome de produto. Use para qualquer pergunta sobre produtos, marcas ou disponibilidade.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Tipo ou nome do produto, ex.: 'shampoo neutro', 'ração filhote'"),
        marca: z.string().optional().describe("Marca do produto, se o visitante citou uma"),
      }),
      execute: async ({ query, marca }) => {
        const brand = await resolveBrand(marca, channel);
        const result = await getCatalogLineItems({ q: query, brand, page: 1, channel });
        const products = result.items.slice(0, MAX_TOOL_ITEMS).map((item) => toSupportProduct(item, showPrices));
        state.lastProducts = products.slice(0, MAX_REPLY_PRODUCTS);
        return {
          total: result.total,
          produtos: products.map((p) => ({
            id: p.id,
            nome: p.name,
            variacao: p.variantLabel,
            marca: p.brand,
            ...(showPrices ? { preco: p.priceLabel } : {}),
          })),
        };
      },
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mypet/core exec vitest run src/support-catalog-tool.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/support-catalog-tool.ts packages/core/src/support-catalog-tool.test.ts
git commit -m "feat(ai): ferramenta buscar_produtos do assistente de dúvidas, sem preço para visitante"
```

---

### Task 3: Handler e prompt do assistente de dúvidas com catálogo

**Files:**
- Modify: `packages/core/src/support-assistant-server.ts` (arquivo inteiro reescrito abaixo)
- Test: `packages/core/src/support-assistant-server.test.ts`

**Interfaces:**
- Consumes: `buildSupportCatalogTools`, `type SupportCatalogState`, `type SupportProduct` de `./support-catalog-tool` (Task 2).
- Produces:
  ```ts
  export type SupportAssistantConfig = {
    channel: string; siteName: string; faq: readonly SupportFaqItem[];
    catalog?: { resolveIsBuyer: (req: NextRequest) => Promise<boolean> };
  };
  export type SupportPromptOptions = { hasCatalog: boolean; isBuyer: boolean };
  export function buildSupportSystemPrompt(siteName, faq, artigos, options?: SupportPromptOptions): string;
  // Resposta 200 com catalog: { ok: true, reply: string, products: SupportProduct[], showPrices: boolean }
  // Resposta 200 sem catalog: { ok: true, reply: string } (inalterada)
  ```

- [ ] **Step 1: Write the failing tests**

Em `packages/core/src/support-assistant-server.test.ts`:

1. Logo após o `vi.mock("./help-center", ...)`, adicionar:

```ts
vi.mock("./catalog-line-items", () => ({ getCatalogLineItems: vi.fn() }));
```

2. Trocar o mock de `./catalog` para incluir `getBrands` (lista vazia: sem marca, a ferramenta busca sem filtro):

```ts
vi.mock("./catalog", () => ({ getCatalog: vi.fn(), getCategories: vi.fn(), getBrands: vi.fn(async () => []) }));
```

3. Junto aos outros imports, adicionar:

```ts
import { getCatalogLineItems } from "./catalog-line-items";
```

4. No fim do arquivo, adicionar:

```ts
describe("buildSupportSystemPrompt — regras", () => {
  it("não manda o visitante para o WhatsApp e proíbe prometer desconto", () => {
    for (const options of [
      { hasCatalog: false, isBuyer: false },
      { hasCatalog: true, isBuyer: false },
      { hasCatalog: true, isBuyer: true },
    ]) {
      const prompt = buildSupportSystemPrompt("My Pet Brasil", faq, [], options);
      expect(prompt).not.toMatch(/whatsapp pelo|falar com o time pelo whatsapp/i);
      expect(prompt).toContain("Nunca prometa desconto");
      expect(prompt).toContain("/central-de-ajuda");
    }
  });

  it("com catálogo, instrui a usar buscar_produtos e não escrever preço no texto", () => {
    const prompt = buildSupportSystemPrompt("My Pet Brasil", faq, [], { hasCatalog: true, isBuyer: false });
    expect(prompt).toContain('"buscar_produtos"');
    expect(prompt).toContain("Não escreva preços no texto");
  });

  it("visitante é convidado ao cadastro para ver preço; cadastrado é levado ao /pedido-rapido", () => {
    const visitante = buildSupportSystemPrompt("My Pet Brasil", faq, [], { hasCatalog: true, isBuyer: false });
    expect(visitante).toContain("/cadastro");
    expect(visitante).not.toContain("/pedido-rapido");
    const cliente = buildSupportSystemPrompt("My Pet Brasil", faq, [], { hasCatalog: true, isBuyer: true });
    expect(cliente).toContain("/pedido-rapido");
  });
});

describe("POST /api/duvidas com catálogo", () => {
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

  function handlerFor(resolveIsBuyer: () => Promise<boolean>) {
    return createSupportAssistantHandler({
      channel: "mypetbrasil",
      siteName: "My Pet Brasil",
      faq,
      catalog: { resolveIsBuyer },
    });
  }

  // Simula o modelo chamando buscar_produtos uma vez e respondendo.
  function modelSearchesThenReplies(text: string) {
    (generateText as Mock).mockImplementation(async (call) => {
      await call.tools.buscar_produtos.execute({ query: "shampoo" }, { toolCallId: "t1", messages: [] });
      return { text };
    });
  }

  beforeEach(() => {
    (getCatalogLineItems as Mock).mockResolvedValue({ items: [lineItem], total: 1, page: 1, totalPages: 1 });
  });

  it("visitante: produtos sem preço e showPrices false", async () => {
    modelSearchesThenReplies("Encontrei estas opções.");
    const res = await handlerFor(async () => false)(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      reply: "Encontrei estas opções.",
      showPrices: false,
      products: [
        { id: "p1", name: "Shampoo Neutro", sku: "SKU1", brand: "Pet Clean", variantLabel: "5L", priceLabel: null },
      ],
    });
  });

  it("cadastrado: produtos com preço e showPrices true", async () => {
    modelSearchesThenReplies("Encontrei estas opções.");
    const body = await (await handlerFor(async () => true)(makeRequest(validBody))).json();
    expect(body.showPrices).toBe(true);
    expect(body.products[0].priceLabel).toBe("R$ 89,90");
  });

  it("registra a ferramenta e limita a 3 passos", async () => {
    (generateText as Mock).mockResolvedValue({ text: "Oi." });
    await handlerFor(async () => false)(makeRequest(validBody));
    const call = (generateText as Mock).mock.calls[0][0];
    expect(Object.keys(call.tools)).toEqual(["buscar_produtos"]);
    expect(call.stopWhen).toBeDefined();
    expect(call.system).toContain('"buscar_produtos"');
  });

  it("sem busca, devolve lista vazia", async () => {
    (generateText as Mock).mockResolvedValue({ text: "O mínimo é R$ 250." });
    const body = await (await handlerFor(async () => true)(makeRequest(validBody))).json();
    expect(body).toEqual({ ok: true, reply: "O mínimo é R$ 250.", products: [], showPrices: true });
  });

  it("falha ao identificar o comprador trata como visitante", async () => {
    modelSearchesThenReplies("Encontrei.");
    const body = await (
      await handlerFor(async () => {
        throw new Error("cookie quebrado");
      })(makeRequest(validBody))
    ).json();
    expect(body.showPrices).toBe(false);
    expect(body.products[0].priceLabel).toBeNull();
  });

  it("texto vazio após buscar: resposta padrão curta", async () => {
    modelSearchesThenReplies("   ");
    const body = await (await handlerFor(async () => false)(makeRequest(validBody))).json();
    expect(body.reply).toBe("Encontrei estas opções na tabela:");
  });

  it("produtos de um provedor que falhou não vazam para a resposta do próximo", async () => {
    (generateText as Mock)
      .mockImplementationOnce(async (call) => {
        await call.tools.buscar_produtos.execute({ query: "shampoo" }, { toolCallId: "t1", messages: [] });
        throw new Error("boom");
      })
      .mockResolvedValueOnce({ text: "Pedido mínimo de R$ 250." });
    const body = await (await handlerFor(async () => false)(makeRequest(validBody))).json();
    expect(body.products).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mypet/core exec vitest run src/support-assistant-server.test.ts`
Expected: FAIL nos novos testes (prompt sem "Nunca prometa desconto", handler sem `tools`); os testes antigos continuam passando.

- [ ] **Step 3: Write the implementation**

Substituir o conteúdo de `packages/core/src/support-assistant-server.ts` por:

```ts
import type { NextRequest } from "next/server";
import { generateText, stepCountIs } from "ai";
import { getAssistantModelChain } from "./ai-provider";
import { AI_REQUEST_TIMEOUT_MS, parseAssistantRequest, type ConversationLimits } from "./assistant-server";
import { consumeAiQuota } from "./ai-usage-limits";
import { getArtigosAjudaPublicados, type ArtigoAjuda } from "./help-center";
import { rejectForeignRequest } from "./request-guards";
import { buildSupportCatalogTools, type SupportCatalogState } from "./support-catalog-tool";

// Assistente de dúvidas da landing pública: responde com base no FAQ comercial
// do site e nos artigos publicados da Central de Ajuda. Com `catalog`, também
// consulta produtos do Hub; preço só para comprador cadastrado.

export type SupportFaqItem = { readonly q: string; readonly a: string };

export type SupportAssistantConfig = {
  channel: string;
  siteName: string;
  faq: readonly SupportFaqItem[];
  catalog?: { resolveIsBuyer: (req: NextRequest) => Promise<boolean> };
};

export type SupportPromptOptions = { hasCatalog: boolean; isBuyer: boolean };

const MAX_ARTICLE_CHARS = 4000;
const MAX_KNOWLEDGE_CHARS = 60000;
const MAX_REPLY_TOKENS = 500;
const MAX_TOOL_STEPS = 3;
const EMPTY_REPLY_WITH_PRODUCTS = "Encontrei estas opções na tabela:";
const EMPTY_REPLY = "Não consegui responder agora. Tente reformular a pergunta.";
// Mesmo limite do campo na UI (faq-assistant.tsx, maxLength=500).
const CONVERSATION_LIMITS: ConversationLimits = {
  maxMessages: 12,
  maxMessageLength: 500,
  maxTotalChars: 6000,
};

function formatKnowledge(faq: readonly SupportFaqItem[], artigos: ArtigoAjuda[]): string {
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

function catalogRules({ hasCatalog, isBuyer }: SupportPromptOptions): string {
  if (!hasCatalog) {
    return `7. Você não consulta produtos. Preço de produto só aparece na tabela, depois do cadastro em /cadastro.`;
  }
  const priceRule = isBuyer
    ? `9. Para montar o pedido com os produtos encontrados, indique /pedido-rapido.`
    : `9. Se perguntarem preço, explique que os preços aparecem para quem se cadastra com CNPJ e WhatsApp em /cadastro.`;
  return `7. Para qualquer pergunta sobre produtos, marcas ou disponibilidade, use a ferramenta "buscar_produtos" antes de responder. Busque pelo tipo ou nome do produto (ex.: "shampoo neutro"), não pela frase inteira. Nunca cite um produto que não tenha vindo dessa ferramenta nesta conversa. Se a busca não trouxer nada, diga que não encontrou e sugira outro termo.
8. Não escreva preços no texto: os produtos encontrados aparecem em uma lista logo abaixo da sua resposta. Seja rápido e prático (ex.: "Encontrei estas opções").
${priceRule}`;
}

export function buildSupportSystemPrompt(
  siteName: string,
  faq: readonly SupportFaqItem[],
  artigos: ArtigoAjuda[],
  options: SupportPromptOptions = { hasCatalog: false, isBuyer: false },
): string {
  const audience = options.isBuyer
    ? "Você atende um cliente que já tem cadastro."
    : "Você atende visitantes que ainda não fizeram cadastro.";
  const fallback = options.isBuyer ? "indique /central-de-ajuda" : "indique /central-de-ajuda e convide o visitante a se cadastrar em /cadastro";

  return `Você é o assistente de dúvidas da ${siteName}, a tabela de preços para lojistas (pet shops, banho e tosa, clínicas veterinárias, agropecuárias e distribuidores). ${audience}

Regras obrigatórias:
1. Sobre regras comerciais, cadastro, pedidos, pagamento e entrega, responda somente com base na BASE DE CONHECIMENTO abaixo. Se a resposta não estiver nela, diga que não tem essa informação e ${fallback}.
2. Nunca invente regras comerciais, valores, prazos, preços de produtos ou disponibilidade de estoque. Nunca prometa desconto, condição especial ou preço melhor: os preços da tabela são os mesmos do site mypetbrasil.com.
3. Quando a resposta vier de um artigo, cite o caminho dele (ex.: /central-de-ajuda/a/slug-do-artigo) no fim da resposta.
4. Responda sempre em português, em texto simples (sem markdown), de 1 a 4 frases, direto ao ponto.
5. Não use as palavras "atacado" nem "cotação", e não chame a ${siteName} de "loja".
6. Se a pergunta não tiver relação com a ${siteName}, cadastro, pedidos, pagamento, entrega ou produtos pet, diga educadamente que só ajuda com dúvidas sobre a ${siteName}.
${catalogRules(options)}

BASE DE CONHECIMENTO:
${formatKnowledge(faq, artigos)}`;
}

async function safeIsBuyer(config: SupportAssistantConfig, req: NextRequest): Promise<boolean> {
  if (!config.catalog) return false;
  try {
    return await config.catalog.resolveIsBuyer(req);
  } catch (error) {
    console.error("[support-assistant] falha ao identificar comprador:", error);
    return false;
  }
}

export function createSupportAssistantHandler(config: SupportAssistantConfig) {
  return async function POST(req: NextRequest) {
    const foreign = rejectForeignRequest(req);
    if (foreign) return foreign;

    const body = await req.json().catch(() => null);
    const parsed = parseAssistantRequest(body, CONVERSATION_LIMITS);

    if (!parsed.ok) {
      return Response.json(
        { ok: false, error: { code: "INVALID_INPUT", message: parsed.message } },
        { status: 400 },
      );
    }

    if (parsed.value.channel !== config.channel) {
      return Response.json(
        { ok: false, error: { code: "CHANNEL_MISMATCH", message: "Canal não corresponde a este site." } },
        { status: 403 },
      );
    }

    const limited = await consumeAiQuota("duvidas", config.channel, req.headers);
    if (limited) return limited;

    const hasCatalog = Boolean(config.catalog);
    const [artigos, isBuyer] = await Promise.all([getArtigosAjudaPublicados(), safeIsBuyer(config, req)]);
    const system = buildSupportSystemPrompt(config.siteName, config.faq, artigos, { hasCatalog, isBuyer });

    const catalogState: SupportCatalogState = { lastProducts: [] };
    const toolOptions = hasCatalog
      ? {
          tools: buildSupportCatalogTools({ channel: config.channel, showPrices: isBuyer, state: catalogState }),
          stopWhen: stepCountIs(MAX_TOOL_STEPS),
        }
      : {};

    for (const candidate of getAssistantModelChain()) {
      // Cada tentativa começa limpa: produtos de um provedor que falhou não contam.
      catalogState.lastProducts = [];
      try {
        const result = await generateText({
          model: candidate.model,
          system,
          messages: parsed.value.messages,
          ...toolOptions,
          maxOutputTokens: MAX_REPLY_TOKENS,
          abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        });
        if (!hasCatalog) return Response.json({ ok: true, reply: result.text });

        const products = catalogState.lastProducts;
        const reply = result.text.trim() || (products.length > 0 ? EMPTY_REPLY_WITH_PRODUCTS : EMPTY_REPLY);
        return Response.json({ ok: true, reply, products, showPrices: isBuyer });
      } catch (error) {
        console.error(`[support-assistant] erro no provedor "${candidate.provider}":`, error);
      }
    }

    return Response.json(
      {
        ok: false,
        error: {
          code: "AI_PROVIDER_ERROR",
          message: "Não foi possível responder agora. Tente novamente em instantes.",
        },
      },
      { status: 502 },
    );
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mypet/core exec vitest run src/support-assistant-server.test.ts src/support-catalog-tool.test.ts`
Expected: PASS (todos, incluindo os antigos: sem `catalog` a resposta continua `{ ok, reply }` e `call.tools` é `undefined`).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/support-assistant-server.ts packages/core/src/support-assistant-server.test.ts
git commit -m "feat(ai): assistente de dúvidas consulta o catálogo do Hub, preço só para cadastrado"
```

---

### Task 4: Rota `/api/duvidas` liga o catálogo

**Files:**
- Modify: `apps/mypet/app/api/duvidas/route.ts`
- Test: `apps/mypet/app/api/duvidas/route.test.ts` (novo)

**Interfaces:**
- Consumes: `SupportAssistantConfig.catalog.resolveIsBuyer` (Task 3); `requireBuyer(): Promise<Buyer | null>` de `@/lib/require-buyer`.
- Produces: nada novo.

- [ ] **Step 1: Write the failing test**

Criar `apps/mypet/app/api/duvidas/route.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { SupportAssistantConfig } from "@mypet/core/support-assistant-server";

// vi.hoisted: o mock roda no import de "./route", antes das declarações do arquivo.
const { captured, requireBuyer } = vi.hoisted(() => ({
  captured: {} as { config?: SupportAssistantConfig },
  requireBuyer: vi.fn(),
}));

vi.mock("@mypet/core/support-assistant-server", () => ({
  createSupportAssistantHandler: (config: SupportAssistantConfig) => {
    captured.config = config;
    return async () => new Response(null);
  },
}));
vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));

import "./route";

describe("/api/duvidas", () => {
  it("liga o catálogo e identifica o comprador pelo requireBuyer", async () => {
    const resolveIsBuyer = captured.config?.catalog?.resolveIsBuyer;
    expect(resolveIsBuyer).toBeTypeOf("function");

    requireBuyer.mockResolvedValueOnce({ id: "b1" });
    expect(await resolveIsBuyer!({} as never)).toBe(true);

    requireBuyer.mockResolvedValueOnce(null);
    expect(await resolveIsBuyer!({} as never)).toBe(false);
  });

  it("usa o canal do site", () => {
    expect(captured.config?.channel).toBe("mypetbrasil");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter mypet exec vitest run app/api/duvidas/route.test.ts`
Expected: FAIL — `resolveIsBuyer` é `undefined`.

- [ ] **Step 3: Write minimal implementation**

Substituir `apps/mypet/app/api/duvidas/route.ts` por:

```ts
import { createSupportAssistantHandler } from "@mypet/core/support-assistant-server";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { commercialFaq } from "../../pre-access-content";

export const POST = createSupportAssistantHandler({
  channel: clientConfig.catalogChannel,
  siteName: clientConfig.name,
  faq: commercialFaq,
  catalog: { resolveIsBuyer: async () => Boolean(await requireBuyer()) },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter mypet exec vitest run app/api/duvidas/route.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/api/duvidas/route.ts apps/mypet/app/api/duvidas/route.test.ts
git commit -m "feat(mypet): /api/duvidas consulta o catálogo com preço para cadastrado"
```

---

### Task 5: Cliente lê `products` e `showPrices`

**Files:**
- Modify: `packages/core/src/support-assistant-client.ts`
- Test: `packages/core/src/support-assistant-client.test.ts`

**Interfaces:**
- Consumes: `type SupportProduct` de `./support-catalog-tool` (Task 2) — **só `import type`**, o client roda no navegador.
- Produces:
  ```ts
  export type { SupportProduct };
  export type SupportAssistantResult =
    | { ok: true; reply: string; products: SupportProduct[]; showPrices: boolean }
    | { ok: false; error: string };
  ```

- [ ] **Step 1: Write the failing tests**

Em `packages/core/src/support-assistant-client.test.ts`:

1. No primeiro teste, trocar a expectativa `expect(result).toEqual({ ok: true, reply: "R$ 250." });` por:

```ts
    expect(result).toEqual({ ok: true, reply: "R$ 250.", products: [], showPrices: false });
```

2. Adicionar dentro do `describe`:

```ts
  it("devolve produtos válidos e descarta os malformados", async () => {
    const product = {
      id: "p1",
      name: "Shampoo Neutro",
      sku: "SKU1",
      brand: null,
      variantLabel: "5L",
      priceLabel: "R$ 89,90",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          reply: "Encontrei.",
          showPrices: true,
          products: [product, { id: 1 }, null, { ...product, id: "p2", priceLabel: 89.9 }],
        }),
      }),
    );
    expect(await askSupportAssistant("mypetbrasil", messages)).toEqual({
      ok: true,
      reply: "Encontrei.",
      products: [product],
      showPrices: true,
    });
  });

  it("products que não é lista vira lista vazia", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, reply: "Oi.", products: "x", showPrices: "sim" }),
      }),
    );
    expect(await askSupportAssistant("mypetbrasil", messages)).toEqual({
      ok: true,
      reply: "Oi.",
      products: [],
      showPrices: false,
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mypet/core exec vitest run src/support-assistant-client.test.ts`
Expected: FAIL — resultado sem `products`/`showPrices`.

- [ ] **Step 3: Write minimal implementation**

Em `packages/core/src/support-assistant-client.ts`:

1. Trocar o topo (import + tipo) por:

```ts
import type { AssistantMessage } from "./assistant-client";
import type { SupportProduct } from "./support-catalog-tool";

export type { SupportProduct };

export type SupportAssistantResult =
  | { ok: true; reply: string; products: SupportProduct[]; showPrices: boolean }
  | { ok: false; error: string };
```

2. Antes de `export async function askSupportAssistant`, adicionar:

```ts
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isSupportProduct(value: unknown): value is SupportProduct {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.sku === "string" &&
    isNullableString(p.brand) &&
    isNullableString(p.variantLabel) &&
    isNullableString(p.priceLabel)
  );
}

function parseProducts(raw: unknown): SupportProduct[] {
  return Array.isArray(raw) ? raw.filter(isSupportProduct) : [];
}
```

3. Trocar o bloco de sucesso por:

```ts
  if (res.ok && data?.ok && typeof data.reply === "string") {
    return {
      ok: true,
      reply: data.reply,
      products: parseProducts(data.products),
      showPrices: data.showPrices === true,
    };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mypet/core exec vitest run src/support-assistant-client.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/support-assistant-client.ts packages/core/src/support-assistant-client.test.ts
git commit -m "feat(ai): cliente do assistente de dúvidas lê produtos e showPrices"
```

---

### Task 6: Mini-lista de produtos na caixa de dúvidas

**Files:**
- Modify: `apps/mypet/app/_components/pre-access/faq-assistant.tsx`
- Modify: `apps/mypet/app/_components/pre-access/styles.ts:175` (estilos `pa-ai-product*`)
- Test: `apps/mypet/app/_components/pre-access/faq-assistant.test.tsx`

**Interfaces:**
- Consumes: `askSupportAssistant` e `type SupportProduct` de `@mypet/core/support-assistant-client` (Task 5).
- Produces: links `/pedido-rapido?q=<nome>` consumidos pela Task 7.

- [ ] **Step 1: Write the failing tests**

Em `apps/mypet/app/_components/pre-access/faq-assistant.test.tsx`:

1. Nos três `mockResolvedValue({ ok: true, reply: ... })` existentes, acrescentar `products: [], showPrices: false` (ex.: `{ ok: true, reply: "Resposta.", products: [], showPrices: false }`).

2. Adicionar dentro do `describe`:

```ts
  const produto = {
    id: "p1",
    name: "Shampoo Neutro",
    sku: "SKU1",
    brand: "Pet Clean",
    variantLabel: "5L",
    priceLabel: "R$ 89,90",
  };

  async function perguntar(text: string) {
    fireEvent.change(screen.getByLabelText("Sua dúvida"), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Perguntar" }));
  }

  it("cadastrado: lista produtos com preço e link para a tabela", async () => {
    askSupportAssistant.mockResolvedValue({ ok: true, reply: "Encontrei.", products: [produto], showPrices: true });
    render(<FaqAssistant channel="mypetbrasil" />);
    await perguntar("Tem shampoo?");

    const lista = await screen.findByRole("list", { name: "Produtos encontrados" });
    expect(lista).toHaveTextContent("Shampoo Neutro — 5L");
    expect(lista).toHaveTextContent("Pet Clean");
    expect(screen.getByRole("link", { name: /R\$ 89,90/ })).toHaveAttribute(
      "href",
      "/pedido-rapido?q=Shampoo%20Neutro",
    );
  });

  it("visitante: lista produtos sem preço e convida ao cadastro", async () => {
    askSupportAssistant.mockResolvedValue({
      ok: true,
      reply: "Encontrei.",
      products: [{ ...produto, priceLabel: null }],
      showPrices: false,
    });
    render(<FaqAssistant channel="mypetbrasil" />);
    await perguntar("Tem shampoo?");

    await screen.findByRole("list", { name: "Produtos encontrados" });
    expect(screen.getByRole("link", { name: "Cadastre-se para ver o preço" })).toHaveAttribute("href", "/cadastro");
    expect(screen.queryByText(/R\$/)).toBeNull();
  });

  it("manda só role e content para a API no histórico", async () => {
    askSupportAssistant.mockResolvedValue({ ok: true, reply: "Encontrei.", products: [produto], showPrices: true });
    render(<FaqAssistant channel="mypetbrasil" />);
    await perguntar("Tem shampoo?");
    await screen.findByText("Encontrei.");
    await perguntar("E de 2 litros?");

    expect(askSupportAssistant).toHaveBeenLastCalledWith("mypetbrasil", [
      { role: "user", content: "Tem shampoo?" },
      { role: "assistant", content: "Encontrei." },
      { role: "user", content: "E de 2 litros?" },
    ]);
  });

  it("transforma /pedido-rapido citado na resposta em link", async () => {
    askSupportAssistant.mockResolvedValue({
      ok: true,
      reply: "Monte seu pedido em /pedido-rapido.",
      products: [],
      showPrices: true,
    });
    render(<FaqAssistant channel="mypetbrasil" />);
    await perguntar("Como peço?");
    expect(await screen.findByRole("link", { name: "/pedido-rapido" })).toHaveAttribute("href", "/pedido-rapido");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter mypet exec vitest run app/_components/pre-access/faq-assistant.test.tsx`
Expected: FAIL — sem lista "Produtos encontrados", histórico com campos extras não se aplica ainda, `/pedido-rapido` não vira link.

- [ ] **Step 3: Write the implementation**

Substituir `apps/mypet/app/_components/pre-access/faq-assistant.tsx` por:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { AssistantMessage } from "@mypet/core/assistant-client";
import { askSupportAssistant, type SupportProduct } from "@mypet/core/support-assistant-client";

const SUGESTOES = [
  "Qual é o pedido mínimo?",
  "Vocês entregam na minha região?",
  "Vocês têm shampoo neutro?",
];

// Caminhos internos que o assistente pode citar na resposta viram links.
const LINK_PATTERN = /(\/(?:central-de-ajuda(?:\/[a-z0-9-]+)*|cadastro|perguntas-frequentes|pedido-rapido))/g;

type ChatMessage = AssistantMessage & { products?: SupportProduct[]; showPrices?: boolean };

function renderReply(text: string) {
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

function ProductList({ products, showPrices }: { products: SupportProduct[]; showPrices: boolean }) {
  return (
    <ul className="pa-ai-products" aria-label="Produtos encontrados">
      {products.map((p) => (
        <li key={p.id} className="pa-ai-product">
          <div className="pa-ai-product-info">
            <span className="pa-ai-product-name">
              {p.name}
              {p.variantLabel ? ` — ${p.variantLabel}` : ""}
            </span>
            {p.brand && <span className="pa-ai-product-brand">{p.brand}</span>}
          </div>
          {showPrices ? (
            <a className="pa-ai-product-cta" href={`/pedido-rapido?q=${encodeURIComponent(p.name)}`}>
              {p.priceLabel ?? "Ver na tabela"} <span aria-hidden="true">→</span>
            </a>
          ) : (
            <a className="pa-ai-product-cta" href="/cadastro">
              Cadastre-se para ver o preço
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export function FaqAssistant({ channel }: { channel: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);

    const result = await askSupportAssistant(
      channel,
      next.map(({ role, content }) => ({ role, content })),
    );
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessages([
      ...next,
      { role: "assistant", content: result.reply, products: result.products, showPrices: result.showPrices },
    ]);
  }

  return (
    <div className="pa-ai" role="region" aria-labelledby="pa-ai-title">
      <h3 id="pa-ai-title" className="pa-ai-title">Não achou sua dúvida? Pergunte aqui</h3>
      <p className="pa-ai-lead">Respostas automáticas com base na nossa central de ajuda e nos produtos da tabela.</p>

      {messages.length > 0 && (
        <div ref={logRef} className="pa-ai-log" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "pa-ai-turn pa-ai-turn--user" : "pa-ai-turn"}>
              <p className={m.role === "user" ? "pa-ai-msg pa-ai-msg--user" : "pa-ai-msg"}>
                {m.role === "assistant" ? renderReply(m.content) : m.content}
              </p>
              {m.products && m.products.length > 0 && (
                <ProductList products={m.products} showPrices={m.showPrices === true} />
              )}
            </div>
          ))}
          {loading && <p className="pa-ai-msg pa-ai-msg--muted">Digitando…</p>}
        </div>
      )}

      <form
        className="pa-ai-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex.: qual o prazo de entrega para o Nordeste?"
          aria-label="Sua dúvida"
          maxLength={500}
        />
        <button type="submit" className="pa-btn pa-btn-primary" disabled={loading}>
          {loading ? "..." : "Perguntar"}
        </button>
      </form>

      {messages.length === 0 && (
        <div className="pa-ai-chips">
          {SUGESTOES.map((s) => (
            <button key={s} type="button" onClick={() => send(s)} disabled={loading}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="pa-ai-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

Em `apps/mypet/app/_components/pre-access/styles.ts`, logo **após** a linha 175 (`@media (max-width: 460px) { .pa-ai { padding: 18px; } ... }`), adicionar:

```css
  .pa-ai-turn { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .pa-ai-turn--user { align-items: flex-end; }
  .pa-ai-products { list-style: none; margin: 0; padding: 0; align-self: stretch; display: flex; flex-direction: column; gap: 6px; }
  .pa-ai-product { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border: 1px solid var(--pa-line); border-radius: 12px; font-size: 14px; }
  .pa-ai-product-info { display: flex; flex-direction: column; min-width: 0; }
  .pa-ai-product-name { color: var(--pa-ink); font-weight: 600; overflow-wrap: anywhere; }
  .pa-ai-product-brand { color: var(--pa-muted); font-size: 13px; }
  .pa-ai-product-cta { flex-shrink: 0; color: var(--pa-green-dark); font-weight: 600; text-decoration: none; text-align: right; }
  .pa-ai-product-cta:hover { text-decoration: underline; }
  @media (max-width: 460px) { .pa-ai-product { flex-direction: column; align-items: flex-start; } .pa-ai-product-cta { text-align: left; } }
```

(`.pa-ai-msg` usa `align-self`; dentro de `.pa-ai-turn` o alinhamento passa a vir do `align-items` do turno — conferir visualmente no Step 4b.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter mypet exec vitest run app/_components/pre-access/faq-assistant.test.tsx`
Expected: PASS (8 testes).

- [ ] **Step 4b: Conferência visual**

Run: `pnpm --filter mypet dev` e abrir `http://localhost:4100/`. Na caixa "Não achou sua dúvida?", perguntar "vocês têm shampoo neutro?". Conferir: balão do usuário à direita, resposta à esquerda, lista abaixo da resposta com "Cadastre-se para ver o preço" (sem cookie de acesso). Em 375px de largura, o link desce para baixo do nome. Parar o servidor.

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/_components/pre-access/faq-assistant.tsx apps/mypet/app/_components/pre-access/faq-assistant.test.tsx apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(mypet): caixa de dúvidas mostra produtos encontrados, com preço só para cadastrado"
```

---

### Task 7: `/pedido-rapido` aceita `?q=`

**Files:**
- Modify: `apps/mypet/app/pedido-rapido/page.tsx`
- Modify: `apps/mypet/app/pedido-rapido/pedido-rapido-table.tsx` (props e estado inicial `q`)
- Test: `apps/mypet/app/pedido-rapido/page.test.tsx`, `apps/mypet/app/pedido-rapido/pedido-rapido-table.test.tsx`

**Interfaces:**
- Consumes: links `/pedido-rapido?q=<nome>` (Task 6).
- Produces:
  ```ts
  export async function PedidoRapidoPageBody(props?: { searchParams?: Promise<{ q?: string | string[] }> }): Promise<JSX.Element>;
  // PedidoRapidoTable ganha prop opcional initialQuery?: string (default "")
  ```

> Next 16 com `cacheComponents: true`: `searchParams` é `Promise` e deve ser lido dentro do `<Suspense>` (padrão já usado em `apps/mypet/app/categoria/[slug]/page.tsx`). Antes de editar, ler `node_modules/next/dist/docs/01-app/` sobre `page` / `searchParams` (o diretório fica no pacote `next` instalado; se não existir na raiz, procurar em `apps/mypet/node_modules/next/dist/docs/`).

- [ ] **Step 1: Write the failing tests**

1. Em `apps/mypet/app/pedido-rapido/page.test.tsx`, trocar o mock de `@mypet/core/catalog-line-items` por:

```ts
const getCatalogLineItems = vi.fn(async (_params: unknown) => ({ items: [], total: 0, page: 1, totalPages: 1 }));
vi.mock("@mypet/core/catalog-line-items", () => ({
  getCatalogLineItems: (params: unknown) => getCatalogLineItems(params),
}));
```

e, no `beforeEach`, adicionar `getCatalogLineItems.mockClear();`. Junto aos imports do arquivo, adicionar:

```ts
import { PedidoRapidoTable } from "./pedido-rapido-table";

// Procura um elemento React pelo tipo na árvore devolvida pelo componente.
function findElement(node: unknown, type: unknown): { props: Record<string, unknown> } | null {
  if (!node || typeof node !== "object") return null;
  const el = node as { type?: unknown; props?: { children?: unknown } };
  if (el.type === type) return el as { props: Record<string, unknown> };
  const children = el.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findElement(child, type);
    if (found) return found;
  }
  return null;
}
```

Depois, dentro do `describe`, adicionar:

```ts
  it("usa ?q= na busca inicial e repassa à tabela", async () => {
    requireBuyer.mockResolvedValue({ id: "b1" });
    const tree = await PedidoRapidoPageBody({ searchParams: Promise.resolve({ q: "  Shampoo Neutro " }) });
    expect(getCatalogLineItems).toHaveBeenCalledWith(
      expect.objectContaining({ q: "Shampoo Neutro", page: 1, channel: "mypetbrasil" }),
    );
    expect(findElement(tree, PedidoRapidoTable)?.props.initialQuery).toBe("Shampoo Neutro");
  });

  it("sem ?q= busca a primeira página sem filtro", async () => {
    requireBuyer.mockResolvedValue({ id: "b1" });
    await PedidoRapidoPageBody({ searchParams: Promise.resolve({}) });
    expect(getCatalogLineItems).toHaveBeenCalledWith(expect.objectContaining({ q: undefined, page: 1 }));
  });

  it("usa só o primeiro valor quando ?q= vem repetido", async () => {
    requireBuyer.mockResolvedValue({ id: "b1" });
    await PedidoRapidoPageBody({ searchParams: Promise.resolve({ q: ["coleira", "ração"] }) });
    expect(getCatalogLineItems).toHaveBeenCalledWith(expect.objectContaining({ q: "coleira" }));
  });
```

2. Em `apps/mypet/app/pedido-rapido/pedido-rapido-table.test.tsx`, mudar `renderTable` para aceitar a busca inicial:

```ts
function renderTable(result = baseResult, initialQuery?: string) {
```

e incluir `initialQuery` nas props de `createElement(PedidoRapidoTable, { ... })`:

```ts
          initialResult: result,
          initialQuery,
```

Depois, dentro do `describe`, adicionar:

```ts
  it("preenche a busca com initialQuery sem refazer a busca no servidor", async () => {
    renderTable(baseResult, "Shampoo Neutro");
    expect(screen.getByLabelText("Buscar produtos por nome ou SKU")).toHaveValue("Shampoo Neutro");
    await new Promise((r) => setTimeout(r, 400));
    expect(searchLineItems).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter mypet exec vitest run app/pedido-rapido/page.test.tsx app/pedido-rapido/pedido-rapido-table.test.tsx`
Expected: FAIL — `getCatalogLineItems` chamado sem `q`; input vazio.

- [ ] **Step 3: Write the implementation**

Em `apps/mypet/app/pedido-rapido/pedido-rapido-table.tsx`:

1. Na desestruturação de props de `PedidoRapidoTable`, adicionar `initialQuery = ""` depois de `initialResult,`, e no tipo das props adicionar `initialQuery?: string;` depois de `initialResult: CatalogLineItemsResult;`.
2. Trocar `const [q, setQ] = useState("");` por:

```ts
  const [q, setQ] = useState(initialQuery);
```

(O `firstRun` existente já evita refazer a busca na montagem: o servidor manda a primeira página filtrada.)

Em `apps/mypet/app/pedido-rapido/page.tsx`:

1. Trocar o componente padrão e o cabeçalho de `PedidoRapidoPageBody` por:

```tsx
type PedidoRapidoSearchParams = Promise<{ q?: string | string[] }>;

const MAX_QUERY_LENGTH = 100;

function initialQueryFrom(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().slice(0, MAX_QUERY_LENGTH);
}

export default function PedidoRapidoPage({ searchParams }: { searchParams: PedidoRapidoSearchParams }) {
  return (
    <Suspense fallback={null}>
      <PedidoRapidoPageBody searchParams={searchParams} />
    </Suspense>
  );
}

// exported for tests
export async function PedidoRapidoPageBody({ searchParams }: { searchParams?: PedidoRapidoSearchParams } = {}) {
  const buyer = await requireBuyer();
  if (!buyer) redirect("/entrar");

  const initialQuery = initialQueryFrom((await searchParams)?.q);
  const channel = clientConfig.catalogChannel as Channel;
  const [categories, brands, firstPage] = await Promise.all([
    getCategories(),
    getBrands(channel),
    getCatalogLineItems({ q: initialQuery || undefined, page: 1, channel }),
  ]);
```

2. No JSX, passar a prop para a tabela:

```tsx
        <PedidoRapidoTable
          initialResult={firstPage}
          initialQuery={initialQuery}
          brands={brands}
          categories={orderedCategories}
          palette={PALETTE}
        />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter mypet exec vitest run app/pedido-rapido`
Expected: PASS (todos os arquivos de `app/pedido-rapido`, incluindo o redirect para `/entrar` já existente).

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/pedido-rapido/page.tsx apps/mypet/app/pedido-rapido/page.test.tsx apps/mypet/app/pedido-rapido/pedido-rapido-table.tsx apps/mypet/app/pedido-rapido/pedido-rapido-table.test.tsx
git commit -m "feat(mypet): /pedido-rapido aceita ?q= para abrir a tabela já filtrada"
```

---

### Task 8: Verificação final

**Files:** nenhum (só verificação).

- [ ] **Step 1: Suíte completa**

Run: `pnpm --filter @mypet/core test` e `pnpm --filter mypet test`
Expected: PASS em ambos. Se algo fora das tasks quebrar, investigar antes de seguir (pode ser alteração alheia no working tree — conferir com `git status`).

- [ ] **Step 2: Tipos**

Run: `pnpm --filter mypet exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Build**

Run: `pnpm --filter mypet build`
Expected: build ok, com `/pedido-rapido` e `/api/duvidas` listadas.

- [ ] **Step 4: Teste manual ponta a ponta**

Com `pnpm --filter mypet dev` (porta 4100) e as chaves de IA no `.env.local`:
1. Anônimo, na home: "vocês têm shampoo neutro?" → resposta curta + lista sem preço + "Cadastre-se para ver o preço". Perguntar "quanto custa?" → convite a `/cadastro`, sem valores e sem WhatsApp.
2. Entrar (`/entrar`) e voltar à home: mesma pergunta → lista com preços; clicar num item → `/pedido-rapido?q=...` com a busca preenchida e a tabela filtrada.
3. "Me dá um desconto?" → não promete desconto.
