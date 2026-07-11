# Assistente de Busca com IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um bloco de destaque na home dos dois apps (`mypet` e `distribuidora`) com uma caixa conversacional que busca produtos reais do catálogo, infere se o visitante é pet shop ou banho-e-tosa, e recomenda produtos — usando um Route Handler server-side que chama um modelo de IA trocável por variável de ambiente (Vercel AI SDK).

**Architecture:** Um novo `packages/core/src/assistant-server.ts` (mesmo padrão do `leads-server.ts` já existente) expõe `POST`, reexportado por `apps/{app}/app/api/assistant/route.ts`. Ele chama `generateText` da Vercel AI SDK com duas ferramentas (`buscar_produtos`, `registrar_perfil`) que tocam funções reais de `packages/core/src/catalog.ts` — a IA nunca inventa produto, só escolhe entre o que a busca real retorna. O provedor/modelo de IA é resolvido por `packages/core/src/ai-provider.ts` a partir de variáveis de ambiente. Um componente client `AssistantSearch` (novo) chama um helper `assistant-client.ts` (mesmo padrão do `leads.ts`) via `fetch`.

**Tech Stack:** Next.js 16.2.6 (App Router, Route Handlers), React 19.2.4, TypeScript 5, pnpm workspaces, Supabase (`@supabase/supabase-js`), Vercel AI SDK (`ai` v7 + `@ai-sdk/google`/`@ai-sdk/openai`/`@ai-sdk/anthropic`), Zod, Vitest.

## Global Constraints

- Monorepo pnpm: `apps/mypet`, `apps/distribuidora` consomem `@mypet/core` via `workspace:*`. Nunca duplicar lógica entre apps — tudo compartilhável vive em `packages/core`.
- `packages/core` nunca importa um `client.config.ts` específico de app (decisão registrada em `ARCHITECTURE.md`/spec do monorepo).
- Segredos e chamadas a serviços externos (Supabase, provedor de IA) só rodam no servidor — nunca prefixar variáveis de ambiente sensíveis com `NEXT_PUBLIC_`.
- Padrão de arquivo já estabelecido: lógica server-side fica em um arquivo plano `packages/core/src/<nome>-server.ts` que exporta `POST`, reexportado por `apps/<app>/app/api/<rota>/route.ts` com uma única linha (`export { POST } from "@mypet/core/<nome>-server";`). Lógica client-side de fetch fica em `packages/core/src/<nome>.ts` (sem `-server`), nunca importando do arquivo `-server`.
- Testes: apenas arquivos `src/**/*.test.ts` rodam (`packages/core/vitest.config.ts`) — não há testes de componentes React (`.test.tsx`) neste repositório; componentes são verificados manualmente via `/run`.
- Mensagens de erro e toda a UI em português.
- A IA nunca deve citar/recomendar um produto que não tenha vindo de uma busca real no catálogo.
- Reaproveitar componentes existentes (`ProductCard`, `AddToCartControl`) para os produtos recomendados — nenhum checkout novo.

---

### Task 1: Expor categoria no mapeamento de produtos (`catalog-utils.ts`)

**Files:**
- Modify: `packages/core/src/catalog-utils.ts`
- Test: `packages/core/src/catalog-utils.test.ts`

**Interfaces:**
- Produces: `RawCategory = { id: string; name: string; slug: string }`; `RawProductRow` ganha `category_id: string | null` e `categories: RawCategory | null`; `CatalogProduct` ganha `category: RawCategory | null`; `mapProduct(row, now?)` passa a incluir `category` no retorno.

- [ ] **Step 1: Escrever o teste que falha**

Editar `packages/core/src/catalog-utils.test.ts`, atualizando o bloco `describe("mapProduct", ...)` (linhas 72-100) para:

```ts
describe("mapProduct", () => {
  it("mapeia campos do Hub para a forma da UI", () => {
    const row: RawProductRow = {
      id: "abc",
      name: "RAÇÃO PREMIUM 15KG",
      reference: "15675",
      brand: "PLAST PET",
      category_id: "cat-1",
      categories: { id: "cat-1", name: "Cães", slug: "caes" },
      product_assets: [{ url: "https://img/x", type: "main_image" }],
      product_badges: [{ code: "novidade", label: "Novidade", kind: "manual", priority: 1, starts_at: null, ends_at: null }],
    };
    expect(mapProduct(row)).toEqual({
      id: "abc",
      name: "RAÇÃO PREMIUM 15KG",
      sku: "15675",
      brand: "PLAST PET",
      img: "https://img/x",
      badge: { code: "novidade", label: "Novidade" },
      category: { id: "cat-1", name: "Cães", slug: "caes" },
    });
  });
  it("usa placeholder, sku vazio e categoria nula quando faltam dados", () => {
    const row: RawProductRow = {
      id: "z", name: "CAMA", reference: null, brand: null, category_id: null, categories: null,
      product_assets: null, product_badges: null,
    };
    const p = mapProduct(row);
    expect(p.img).toBe(PLACEHOLDER_IMAGE);
    expect(p.sku).toBe("");
    expect(p.badge).toBeNull();
    expect(p.category).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @mypet/core test`
Expected: FAIL — `Property 'category_id' is missing` (erro de tipo) ou `category` indefinido nas asserções.

- [ ] **Step 3: Implementar a mudança mínima**

Em `packages/core/src/catalog-utils.ts`, substituir o bloco de tipos (linhas 6-31) por:

```ts
export type Badge = { code: string; label: string };

export type RawBadge = {
  code: string;
  label: string;
  kind: string;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type RawCategory = { id: string; name: string; slug: string };

export type RawProductRow = {
  id: string;
  name: string;
  reference: string | null;
  brand: string | null;
  category_id: string | null;
  categories: RawCategory | null;
  product_assets: { url: string; type: string }[] | null;
  product_badges: RawBadge[] | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  badge: Badge | null;
  category: RawCategory | null;
};
```

E substituir `mapProduct` (linhas 75-84) por:

```ts
export function mapProduct(row: RawProductRow, now: Date = new Date()): CatalogProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.reference ?? "",
    brand: row.brand,
    img: mainImage(row.product_assets),
    badge: pickActiveBadge(row.product_badges, now),
    category: row.categories ?? null,
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @mypet/core test`
Expected: PASS (todos os testes de `catalog-utils.test.ts`, incluindo os dois casos de `mapProduct`).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog-utils.ts packages/core/src/catalog-utils.test.ts
git commit -m "feat: expor categoria do produto no mapeamento do catálogo"
```

---

### Task 2: Filtro por categoria e árvore de categorias (`catalog.ts`)

**Files:**
- Modify: `packages/core/src/catalog.ts`
- Test: `packages/core/src/catalog.test.ts`

**Interfaces:**
- Consumes: `RawProductRow`, `CatalogProduct`, `mapProduct` de `./catalog-utils` (Task 1).
- Produces: `queryCatalog(params: { q?, brand?, categoryId?, page, channel })`; `getCatalog(params: { q?, brand?, categoryId?, page, channel })`; `CategoryNode = { id: string; parentId: string | null; slug: string; name: string; level: number | null }`; `getCategories(): Promise<CategoryNode[]>`.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/core/src/catalog.test.ts`, atualizar o import (linha 52) para incluir `getCategories`:

```ts
import { queryCatalog, getCategories } from "./catalog";
```

Atualizar o tipo `QueryBuilder` (linhas 5-12) para incluir `then`:

```ts
type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  ilike: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  not: (...args: unknown[]) => QueryBuilder;
  range: (...args: unknown[]) => Promise<{ data: unknown[]; count: number; error: null }>;
  then: (resolve: (value: { data: unknown[]; error: null }) => void) => void;
};
```

Atualizar o mock `vi.mock("./supabase", ...)` (linhas 14-50): adicionar `category_id`/`categories` ao produto mockado e um `builder.then` para simular a query de categorias (que não usa `.range()`):

```ts
vi.mock("./supabase", () => {
  return {
    getHubClient: () => {
      const builder = {} as QueryBuilder;
      const chain = (name: string) => (...args: unknown[]) => {
        calls[name] = args;
        return builder;
      };
      builder.select = chain("select");
      builder.eq = (...args: unknown[]) => {
        calls["eq"] = [...((calls["eq"] as unknown[][] | undefined) ?? []), args];
        return builder;
      };
      builder.ilike = chain("ilike");
      builder.order = chain("order");
      builder.not = chain("not");
      builder.range = (...args: unknown[]) => {
        calls["range"] = args;
        return Promise.resolve({
          data: [
            {
              id: "p1",
              name: "RAÇÃO X",
              reference: "100",
              brand: "NAPI",
              category_id: "cat-1",
              categories: { id: "cat-1", name: "Banho & Tosa", slug: "banho-tosa" },
              product_assets: [{ url: "https://img/1", type: "main_image" }],
              product_badges: null,
            },
          ],
          count: 50,
          error: null,
        });
      };
      builder.then = (resolve) => {
        resolve({
          data: [
            { id: "cat-1", parent_id: null, slug: "caes", name: "Cães", level: 1 },
            { id: "cat-2", parent_id: "cat-1", slug: "caes-racao", name: "Ração", level: 2 },
          ],
          error: null,
        });
      };
      return { from: chain("from") };
    },
  };
});
```

Atualizar o teste existente `"aplica busca, marca, canal, paginação e mapeia os itens"` (linha 69) para também checar a categoria mapeada:

```ts
    expect(result.items[0]).toMatchObject({
      id: "p1",
      sku: "100",
      img: "https://img/1",
      category: { id: "cat-1", name: "Banho & Tosa", slug: "banho-tosa" },
    });
```

Adicionar, ao final do arquivo, dois novos `describe`:

```ts
describe("queryCatalog com filtro de categoria", () => {
  it("filtra por categoryId quando informado", async () => {
    await queryCatalog({ page: 1, channel: "mypetbrasil", categoryId: "cat-9" });
    expect(calls["eq"]).toContainEqual(["category_id", "cat-9"]);
  });
});

describe("getCategories", () => {
  it("consulta a tabela categories e mapeia parent_id para parentId", async () => {
    const categories = await getCategories();
    expect(calls["from"]).toEqual(["categories"]);
    expect(categories).toEqual([
      { id: "cat-1", parentId: null, slug: "caes", name: "Cães", level: 1 },
      { id: "cat-2", parentId: "cat-1", slug: "caes-racao", name: "Ração", level: 2 },
    ]);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `pnpm --filter @mypet/core test`
Expected: FAIL — `getCategories` não existe; `categoryId` não é um parâmetro válido de `queryCatalog`; `category` ausente no item mapeado.

- [ ] **Step 3: Implementar a mudança mínima**

Em `packages/core/src/catalog.ts`, trocar `CATALOG_SELECT` (linhas 13-14):

```ts
export const CATALOG_SELECT =
  "id, name, reference, brand, category_id, categories(id, name, slug), product_assets(url, type), product_badges(code, label, kind, priority, starts_at, ends_at)";
```

Trocar a assinatura e corpo de `queryCatalog` (linhas 16-46):

```ts
export async function queryCatalog(params: {
  q?: string;
  brand?: string;
  categoryId?: string;
  page: number;
  channel: string;
}): Promise<CatalogResult> {
  const { q, brand, categoryId, page, channel } = params;
  const supabase = getHubClient();
  const { from, to } = pageRange(page);

  let query = supabase
    .from("products")
    .select(`${CATALOG_SELECT}, product_channel_links!inner(channel)`, { count: "exact" })
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
    .order("name", { ascending: true });

  if (q) query = query.ilike("name", `%${q}%`);
  if (brand) query = query.eq("brand", brand);
  if (categoryId) query = query.eq("category_id", categoryId);

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error("[catalog] erro ao consultar produtos:", error.message);
    return { items: [], total: 0, page, totalPages: 1 };
  }

  const items = ((data as RawProductRow[]) ?? []).map((row) => mapProduct(row));
  const total = count ?? 0;
  return { items, total, page, totalPages: totalPages(total) };
}
```

Trocar a assinatura de `getCatalog` (linhas 48-58):

```ts
export async function getCatalog(params: {
  q?: string;
  brand?: string;
  categoryId?: string;
  page: number;
  channel: string;
}): Promise<CatalogResult> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  return queryCatalog(params);
}
```

Adicionar ao final do arquivo (após `getProductById`, que permanece inalterado):

```ts
export type CategoryNode = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  level: number | null;
};

export async function getCategories(): Promise<CategoryNode[]> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, slug, name, level")
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[catalog] erro ao consultar categorias:", error.message);
    return [];
  }

  return (
    (data as { id: string; parent_id: string | null; slug: string; name: string; level: number | null }[]) ?? []
  ).map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    slug: row.slug,
    name: row.name,
    level: row.level,
  }));
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @mypet/core test`
Expected: PASS (todos os testes de `catalog.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog.ts packages/core/src/catalog.test.ts
git commit -m "feat: filtro por categoria e arvore de categorias no catalogo"
```

---

### Task 3: Dependências de IA e fábrica de modelo trocável (`ai-provider.ts`)

**Files:**
- Modify: `packages/core/package.json`
- Create: `packages/core/src/ai-provider.ts`
- Test: `packages/core/src/ai-provider.test.ts`

**Interfaces:**
- Produces: `AssistantProvider = "google" | "openai" | "anthropic"`; `getAssistantModel(): LanguageModel` (lê `process.env.AI_PROVIDER`/`AI_MODEL`).

- [ ] **Step 1: Adicionar as dependências**

Editar `packages/core/package.json`, trocando o bloco `"dependencies"`:

```json
  "dependencies": {
    "@supabase/supabase-js": "^2.108.2",
    "googleapis": "^173.0.0",
    "ai": "^7.0.21",
    "@ai-sdk/google": "^4.0.12",
    "@ai-sdk/openai": "^4.0.11",
    "@ai-sdk/anthropic": "^4.0.12",
    "zod": "^4.4.3"
  },
```

Rodar `pnpm install` na raiz do repositório para atualizar o lockfile.

- [ ] **Step 2: Escrever o teste que falha**

Criar `packages/core/src/ai-provider.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn((modelId: string) => ({ provider: "google", modelId })),
}));
vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn((modelId: string) => ({ provider: "openai", modelId })),
}));
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn((modelId: string) => ({ provider: "anthropic", modelId })),
}));

import { getAssistantModel } from "./ai-provider";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("getAssistantModel", () => {
  it("usa Google Gemini 2.5 Flash por padrão", () => {
    expect(getAssistantModel()).toEqual({ provider: "google", modelId: "gemini-2.5-flash" });
  });

  it("usa o provedor e o modelo definidos por variável de ambiente", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_MODEL", "gpt-4o");
    expect(getAssistantModel()).toEqual({ provider: "openai", modelId: "gpt-4o" });
  });

  it("usa o modelo padrão do provedor quando AI_MODEL não é definido", () => {
    vi.stubEnv("AI_PROVIDER", "anthropic");
    expect(getAssistantModel()).toEqual({ provider: "anthropic", modelId: "claude-haiku-4-5" });
  });

  it("lança erro para um provedor desconhecido", () => {
    vi.stubEnv("AI_PROVIDER", "cohere");
    expect(() => getAssistantModel()).toThrow(
      'AI_PROVIDER desconhecido: "cohere". Use "google", "openai" ou "anthropic".',
    );
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @mypet/core test -- ai-provider`
Expected: FAIL — `Cannot find module './ai-provider'`.

- [ ] **Step 4: Implementar a mudança mínima**

Criar `packages/core/src/ai-provider.ts`:

```ts
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export type AssistantProvider = "google" | "openai" | "anthropic";

const DEFAULT_PROVIDER: AssistantProvider = "google";

const DEFAULT_MODEL_BY_PROVIDER: Record<AssistantProvider, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
};

function isAssistantProvider(value: string): value is AssistantProvider {
  return value === "google" || value === "openai" || value === "anthropic";
}

export function getAssistantModel(): LanguageModel {
  const providerEnv = process.env.AI_PROVIDER ?? DEFAULT_PROVIDER;

  if (!isAssistantProvider(providerEnv)) {
    throw new Error(
      `AI_PROVIDER desconhecido: "${providerEnv}". Use "google", "openai" ou "anthropic".`,
    );
  }

  const modelId = process.env.AI_MODEL ?? DEFAULT_MODEL_BY_PROVIDER[providerEnv];

  switch (providerEnv) {
    case "google":
      return google(modelId);
    case "openai":
      return openai(modelId);
    case "anthropic":
      return anthropic(modelId);
  }
}
```

Adicionar a entrada de export em `packages/core/package.json` (bloco `"exports"`):

```json
    "./ai-provider": "./src/ai-provider.ts",
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @mypet/core test -- ai-provider`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml packages/core/src/ai-provider.ts packages/core/src/ai-provider.test.ts
git commit -m "feat: fabrica de modelo de IA trocavel por variavel de ambiente"
```

---

### Task 4: Route Handler do assistente com ferramentas de busca (`assistant-server.ts`)

**Files:**
- Create: `packages/core/src/assistant-server.ts`
- Test: `packages/core/src/assistant-server.test.ts`

**Interfaces:**
- Consumes: `getCatalog`, `getCategories`, `CategoryNode` de `./catalog` (Task 2); `CatalogProduct` de `./catalog-utils` (Task 1); `getAssistantModel` de `./ai-provider` (Task 3).
- Produces: `AssistantMessage = { role: "user" | "assistant"; content: string }`; `parseAssistantRequest(body: unknown)`; `buildAssistantTools(options)`; `POST(req: NextRequest)` — resposta JSON `{ ok: true, reply, products, profileGuess?, profileOptions? }` ou `{ ok: false, error: { code, message } }`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `packages/core/src/assistant-server.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: vi.fn() };
});

vi.mock("./catalog", () => ({
  getCatalog: vi.fn(),
  getCategories: vi.fn(),
}));

vi.mock("./ai-provider", () => ({
  getAssistantModel: vi.fn(() => ({ modelId: "fake-model" })),
}));

import { generateText } from "ai";
import { getCatalog, getCategories } from "./catalog";
import { POST, parseAssistantRequest, buildAssistantTools } from "./assistant-server";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/assistant", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseAssistantRequest", () => {
  it("aceita um pedido válido", () => {
    const result = parseAssistantRequest({
      channel: "mypetbrasil",
      messages: [{ role: "user", content: "oi" }],
    });
    expect(result).toEqual({
      ok: true,
      value: { channel: "mypetbrasil", messages: [{ role: "user", content: "oi" }] },
    });
  });

  it("rejeita corpo sem canal", () => {
    const result = parseAssistantRequest({ messages: [{ role: "user", content: "oi" }] });
    expect(result).toEqual({ ok: false, message: "Canal não informado." });
  });

  it("rejeita lista de mensagens vazia", () => {
    const result = parseAssistantRequest({ channel: "mypetbrasil", messages: [] });
    expect(result).toEqual({ ok: false, message: "Nenhuma mensagem informada." });
  });

  it("rejeita mensagem com conteúdo vazio", () => {
    const result = parseAssistantRequest({
      channel: "mypetbrasil",
      messages: [{ role: "user", content: "   " }],
    });
    expect(result).toEqual({ ok: false, message: "Mensagem vazia." });
  });

  it("rejeita papel de mensagem desconhecido", () => {
    const result = parseAssistantRequest({
      channel: "mypetbrasil",
      messages: [{ role: "system", content: "oi" }],
    });
    expect(result).toEqual({ ok: false, message: "Papel de mensagem inválido." });
  });
});

describe("buildAssistantTools", () => {
  it("buscar_produtos resolve categorySlug para categoryId e acumula produtos encontrados", async () => {
    (getCatalog as Mock).mockResolvedValue({
      items: [
        {
          id: "p1",
          name: "Shampoo PRO",
          sku: "1",
          brand: "X",
          img: "https://img/1",
          badge: null,
          category: { id: "cat-1", name: "Banho & Tosa", slug: "banho-tosa" },
        },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    });

    const foundProducts = new Map();
    const profileState = { guess: null };
    const tools = buildAssistantTools({
      channel: "mypetbrasil",
      categories: [{ id: "cat-1", parentId: null, slug: "banho-tosa", name: "Banho & Tosa", level: 1 }],
      foundProducts,
      profileState,
    });

    const output = await tools.buscar_produtos.execute(
      { query: "shampoo", categorySlug: "banho-tosa" },
      { toolCallId: "t1", messages: [] } as never,
    );

    expect(getCatalog).toHaveBeenCalledWith({
      q: "shampoo",
      brand: undefined,
      categoryId: "cat-1",
      page: 1,
      channel: "mypetbrasil",
    });
    expect(output).toEqual({
      total: 1,
      produtos: [{ id: "p1", nome: "Shampoo PRO", marca: "X", categoria: "Banho & Tosa" }],
    });
    expect(foundProducts.get("p1")?.name).toBe("Shampoo PRO");
  });

  it("registrar_perfil guarda a conclusão no profileState", async () => {
    const profileState: { guess: unknown } = { guess: null };
    const tools = buildAssistantTools({
      channel: "mypetbrasil",
      categories: [],
      foundProducts: new Map(),
      profileState: profileState as never,
    });

    await tools.registrar_perfil.execute(
      { perfil: "banho_tosa", confianca: "alta" },
      { toolCallId: "t2", messages: [] } as never,
    );

    expect(profileState.guess).toEqual({ perfil: "banho_tosa", confianca: "alta" });
  });
});

describe("POST /api/assistant", () => {
  it("retorna 400 quando o corpo é inválido", async () => {
    const res = await POST(makeRequest({ channel: "mypetbrasil", messages: [] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Nenhuma mensagem informada." },
    });
  });

  it("retorna 502 quando o provedor de IA falha", async () => {
    (getCategories as Mock).mockResolvedValue([]);
    (generateText as Mock).mockRejectedValue(new Error("boom"));

    const res = await POST(
      makeRequest({ channel: "mypetbrasil", messages: [{ role: "user", content: "oi" }] }),
    );

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("AI_PROVIDER_ERROR");
  });

  it("agrega produtos encontrados e o perfil registrado pelas tools chamadas durante generateText", async () => {
    (getCategories as Mock).mockResolvedValue([
      { id: "cat-1", parentId: null, slug: "banho-tosa", name: "Banho & Tosa", level: 1 },
    ]);
    (getCatalog as Mock).mockResolvedValue({
      items: [
        {
          id: "p1",
          name: "Shampoo PRO",
          sku: "1",
          brand: "X",
          img: "https://img/1",
          badge: null,
          category: { id: "cat-1", name: "Banho & Tosa", slug: "banho-tosa" },
        },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    });

    (generateText as Mock).mockImplementation(async ({ tools }) => {
      await tools.buscar_produtos.execute(
        { query: "shampoo" },
        { toolCallId: "t1", messages: [] } as never,
      );
      await tools.registrar_perfil.execute(
        { perfil: "banho_tosa", confianca: "alta" },
        { toolCallId: "t2", messages: [] } as never,
      );
      return { text: "Encontrei um shampoo profissional pra você." };
    });

    const res = await POST(
      makeRequest({ channel: "mypetbrasil", messages: [{ role: "user", content: "shampoo pra tosa" }] }),
    );

    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      reply: "Encontrei um shampoo profissional pra você.",
      products: [
        {
          id: "p1",
          name: "Shampoo PRO",
          sku: "1",
          brand: "X",
          img: "https://img/1",
          badge: null,
          category: { id: "cat-1", name: "Banho & Tosa", slug: "banho-tosa" },
        },
      ],
      profileGuess: { label: "banho_tosa", confidence: "alta" },
    });
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `pnpm --filter @mypet/core test -- assistant-server`
Expected: FAIL — `Cannot find module './assistant-server'`.

- [ ] **Step 3: Implementar a mudança mínima**

Criar `packages/core/src/assistant-server.ts`:

```ts
import { NextRequest } from "next/server";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { getCatalog, getCategories, type CategoryNode } from "./catalog";
import { getAssistantModel } from "./ai-provider";
import type { CatalogProduct } from "./catalog-utils";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

type ProfileGuess = {
  perfil: "pet_shop" | "banho_tosa" | "outro";
  confianca: "alta" | "baixa";
  opcoes?: string[];
};

type ParsedAssistantRequest = { channel: string; messages: AssistantMessage[] };

export function parseAssistantRequest(
  body: unknown,
): { ok: true; value: ParsedAssistantRequest } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Corpo da requisição inválido." };
  }
  const { channel, messages } = body as Record<string, unknown>;

  if (typeof channel !== "string" || !channel.trim()) {
    return { ok: false, message: "Canal não informado." };
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, message: "Nenhuma mensagem informada." };
  }

  const parsedMessages: AssistantMessage[] = [];
  for (const raw of messages) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, message: "Mensagem inválida." };
    }
    const { role, content } = raw as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") {
      return { ok: false, message: "Papel de mensagem inválido." };
    }
    if (typeof content !== "string" || !content.trim()) {
      return { ok: false, message: "Mensagem vazia." };
    }
    parsedMessages.push({ role, content });
  }

  return { ok: true, value: { channel, messages: parsedMessages } };
}

function formatCategories(categories: CategoryNode[]): string {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const pathFor = (c: CategoryNode): string => {
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    return parent ? `${pathFor(parent)} > ${c.name}` : c.name;
  };
  return categories.map((c) => `${c.slug}: ${pathFor(c)}`).join("\n");
}

function buildSystemPrompt(categories: CategoryNode[]): string {
  return `Você é o assistente de compras de um atacado B2B para pet shops. Seu trabalho é entender o que o visitante precisa, identificar se ele é (a) um pet shop querendo montar ou repor estoque para revenda, ou (b) um banho-e-tosa/estética animal que consome os produtos no próprio negócio, e recomendar produtos reais do catálogo.

Regras obrigatórias:
1. Nunca cite ou recomende um produto que não tenha vindo de uma chamada à ferramenta "buscar_produtos" nesta conversa. Se ainda não buscou nada relevante para a pergunta atual, use a ferramenta antes de responder.
2. Assim que tiver uma opinião sobre o perfil do visitante (mesmo que tentativa), chame a ferramenta "registrar_perfil" com sua conclusão.
3. Se não tiver confiança suficiente sobre o perfil, registre confianca "baixa" e inclua de 2 a 3 opções curtas em "opcoes" para o visitante escolher (ex.: "Sou pet shop", "Sou banho e tosa", "Só estou pesquisando").
4. Categorias com "(PRO)" no nome são de uso profissional em banho e tosa. A categoria "Montagem de Loja" costuma indicar pet shop novo.
5. Responda sempre em português, em 1 a 3 frases, direto ao ponto.

Árvore de categorias do catálogo (formato "slug: caminho completo"):
${formatCategories(categories)}`;
}

type BuildToolsOptions = {
  channel: string;
  categories: CategoryNode[];
  foundProducts: Map<string, CatalogProduct>;
  profileState: { guess: ProfileGuess | null };
};

export function buildAssistantTools({ channel, categories, foundProducts, profileState }: BuildToolsOptions) {
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  return {
    buscar_produtos: tool({
      description:
        "Busca produtos reais do catálogo por texto livre e/ou categoria. Use antes de recomendar qualquer produto.",
      inputSchema: z.object({
        query: z.string().optional().describe("Termo de busca livre, ex: 'shampoo', 'ração filhote'"),
        categorySlug: z
          .string()
          .optional()
          .describe("Slug de uma categoria da árvore recebida no início da conversa"),
        brand: z.string().optional().describe("Marca exata do produto, se mencionada"),
      }),
      execute: async ({ query, categorySlug, brand }) => {
        const categoryId = categorySlug ? categoryIdBySlug.get(categorySlug) : undefined;
        const result = await getCatalog({ q: query, brand, categoryId, page: 1, channel });
        for (const item of result.items) {
          foundProducts.set(item.id, item);
        }
        return {
          total: result.total,
          produtos: result.items.map((p) => ({
            id: p.id,
            nome: p.name,
            marca: p.brand,
            categoria: p.category?.name ?? null,
          })),
        };
      },
    }),
    registrar_perfil: tool({
      description:
        "Registra sua conclusão sobre o perfil do visitante (pet_shop, banho_tosa ou outro) e o nível de confiança.",
      inputSchema: z.object({
        perfil: z.enum(["pet_shop", "banho_tosa", "outro"]),
        confianca: z.enum(["alta", "baixa"]),
        opcoes: z
          .array(z.string())
          .max(3)
          .optional()
          .describe('Só quando confianca = "baixa": rótulos curtos para o visitante escolher'),
      }),
      execute: async (input) => {
        profileState.guess = input;
        return { registrado: true };
      },
    }),
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = parseAssistantRequest(body);

  if (!parsed.ok) {
    return Response.json(
      { ok: false, error: { code: "INVALID_INPUT", message: parsed.message } },
      { status: 400 },
    );
  }

  const { channel, messages } = parsed.value;
  const categories = await getCategories();
  const foundProducts = new Map<string, CatalogProduct>();
  const profileState: { guess: ProfileGuess | null } = { guess: null };
  const tools = buildAssistantTools({ channel, categories, foundProducts, profileState });

  let result: { text: string };
  try {
    result = await generateText({
      model: getAssistantModel(),
      system: buildSystemPrompt(categories),
      messages,
      tools,
      stopWhen: stepCountIs(5),
    });
  } catch (error) {
    console.error("[assistant] erro no provedor de IA:", error);
    return Response.json(
      {
        ok: false,
        error: {
          code: "AI_PROVIDER_ERROR",
          message: "Não foi possível processar sua mensagem agora. Tente novamente.",
        },
      },
      { status: 502 },
    );
  }

  const response: {
    ok: true;
    reply: string;
    products: CatalogProduct[];
    profileGuess?: { label: ProfileGuess["perfil"]; confidence: ProfileGuess["confianca"] };
    profileOptions?: { label: string; value: string }[];
  } = {
    ok: true,
    reply: result.text,
    products: [...foundProducts.values()].slice(0, 8),
  };

  if (profileState.guess) {
    response.profileGuess = { label: profileState.guess.perfil, confidence: profileState.guess.confianca };
    if (profileState.guess.confianca === "baixa" && profileState.guess.opcoes?.length) {
      response.profileOptions = profileState.guess.opcoes.map((label) => ({ label, value: label }));
    }
  }

  return Response.json(response);
}
```

Adicionar a entrada de export em `packages/core/package.json`:

```json
    "./assistant-server": "./src/assistant-server.ts",
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @mypet/core test -- assistant-server`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/package.json packages/core/src/assistant-server.ts packages/core/src/assistant-server.test.ts
git commit -m "feat: route handler do assistente com tool use sobre o catalogo real"
```

---

### Task 5: Helper de fetch client-side (`assistant-client.ts`)

**Files:**
- Create: `packages/core/src/assistant-client.ts`
- Test: `packages/core/src/assistant-client.test.ts`

**Interfaces:**
- Consumes: `CatalogProduct` de `./catalog-utils` (Task 1). **Não importa nada de `./assistant-server`** (mesma separação client/server de `leads.ts`/`leads-server.ts`).
- Produces: `AssistantMessage`, `AssistantProfileGuess`, `AssistantProfileOption`, `AssistantResult`, `askAssistant(channel, messages): Promise<AssistantResult>`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `packages/core/src/assistant-client.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { askAssistant } from "./assistant-client";

const messages = [{ role: "user" as const, content: "quero ração para filhotes" }];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("askAssistant", () => {
  it("retorna o resultado quando a resposta é ok", async () => {
    const payload = { ok: true, reply: "Aqui estão algumas opções.", products: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }));
    const result = await askAssistant("mypetbrasil", messages);
    expect(result).toEqual(payload);
  });

  it("retorna a mensagem do servidor em erro 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, error: { code: "INVALID_INPUT", message: "Nenhuma mensagem informada." } }),
      }),
    );
    const result = await askAssistant("mypetbrasil", messages);
    expect(result).toEqual({ ok: false, error: "Nenhuma mensagem informada." });
  });

  it("retorna mensagem genérica em erro 400 sem corpo utilizável", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => {
          throw new Error("bad json");
        },
      }),
    );
    const result = await askAssistant("mypetbrasil", messages);
    expect(result).toEqual({ ok: false, error: "Não entendi sua mensagem. Tente reformular." });
  });

  it("retorna mensagem genérica de servidor em erro 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }));
    const result = await askAssistant("mypetbrasil", messages);
    expect(result).toEqual({
      ok: false,
      error: "Não foi possível processar sua mensagem agora. Tente novamente em instantes.",
    });
  });

  it("retorna mensagem de conexão quando o fetch rejeita", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await askAssistant("mypetbrasil", messages);
    expect(result).toEqual({
      ok: false,
      error: "Não foi possível conectar. Verifique sua internet e tente novamente.",
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @mypet/core test -- assistant-client`
Expected: FAIL — `Cannot find module './assistant-client'`.

- [ ] **Step 3: Implementar a mudança mínima**

Criar `packages/core/src/assistant-client.ts`:

```ts
import type { CatalogProduct } from "./catalog-utils";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

export type AssistantProfileGuess = {
  label: "pet_shop" | "banho_tosa" | "outro";
  confidence: "alta" | "baixa";
};

export type AssistantProfileOption = { label: string; value: string };

export type AssistantResult =
  | {
      ok: true;
      reply: string;
      products: CatalogProduct[];
      profileGuess?: AssistantProfileGuess;
      profileOptions?: AssistantProfileOption[];
    }
  | { ok: false; error: string };

const GENERIC_CLIENT_ERROR = "Não entendi sua mensagem. Tente reformular.";
const GENERIC_SERVER_ERROR = "Não foi possível processar sua mensagem agora. Tente novamente em instantes.";
const NETWORK_ERROR = "Não foi possível conectar. Verifique sua internet e tente novamente.";

export async function askAssistant(
  channel: string,
  messages: AssistantMessage[],
): Promise<AssistantResult> {
  let res: Response;
  try {
    res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, messages }),
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  const data = await res.json().catch(() => null);

  if (res.ok && data?.ok) {
    return data as AssistantResult;
  }

  if (res.status >= 400 && res.status < 500) {
    return {
      ok: false,
      error: typeof data?.error?.message === "string" ? data.error.message : GENERIC_CLIENT_ERROR,
    };
  }

  return { ok: false, error: GENERIC_SERVER_ERROR };
}
```

Adicionar a entrada de export em `packages/core/package.json`:

```json
    "./assistant-client": "./src/assistant-client.ts",
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @mypet/core test -- assistant-client`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/core/package.json packages/core/src/assistant-client.ts packages/core/src/assistant-client.test.ts
git commit -m "feat: helper de fetch client-side para o assistente de busca"
```

---

### Task 6: Componente de UI `AssistantSearch`

**Files:**
- Create: `packages/core/src/components/assistant-search.tsx`

**Interfaces:**
- Consumes: `askAssistant`, `AssistantMessage`, `AssistantProfileOption` de `../assistant-client` (Task 5); `CatalogProduct` de `../catalog-utils` (Task 1); `Palette` de `../theme`; `ProductCard` de `./product-card` (já existente).
- Produces: `AssistantSearch({ channel, palette }: { channel: string; palette: Palette })`.

Este componente não tem teste automatizado (o repositório não testa componentes React — `vitest.config.ts` só roda `*.test.ts`); é validado manualmente na Task 9.

- [ ] **Step 1: Criar o componente**

Criar `packages/core/src/components/assistant-search.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { Palette } from "../theme";
import type { CatalogProduct } from "../catalog-utils";
import { askAssistant, type AssistantMessage, type AssistantProfileOption } from "../assistant-client";
import { ProductCard } from "./product-card";

const SUGESTOES_INICIAIS = [
  "Quero montar um pet shop do zero",
  "Preciso de produtos para banho e tosa",
  "Buscar ração para filhotes",
];

export function AssistantSearch({ channel, palette }: { channel: string; palette: Palette }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [profileOptions, setProfileOptions] = useState<AssistantProfileOption[]>([]);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: AssistantMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setLastUserMessage(trimmed);
    setInput("");
    setError(null);
    setLoading(true);
    setProfileOptions([]);

    const result = await askAssistant(channel, nextMessages);

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setReply(result.reply);
    setProducts(result.products);
    setProfileOptions(result.profileOptions ?? []);
    setMessages([...nextMessages, { role: "assistant", content: result.reply }]);
  }

  return (
    <section
      style={{
        maxWidth: 760,
        margin: "0 auto 56px",
        background: palette.white,
        borderRadius: 24,
        padding: "32px 28px",
        boxShadow: "0 24px 60px rgba(15,31,69,0.18)",
        position: "relative",
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 900, color: palette.navy, marginBottom: 4, textAlign: "center" }}>
        O que você está procurando hoje?
      </h2>
      <p style={{ fontSize: 14, color: palette.gray600, marginBottom: 20, textAlign: "center" }}>
        Descreva o que precisa — a gente entende se você é pet shop ou banho e tosa e recomenda os produtos certos.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite o que procura ou faça uma pergunta"
          aria-label="Mensagem para o assistente de compras"
          style={{
            flex: 1,
            padding: "14px 18px",
            borderRadius: 14,
            border: `1.5px solid ${palette.gray200}`,
            fontSize: 15,
          }}
        />
        <button type="submit" className="cta-primary" disabled={loading} style={{ padding: "0 24px" }}>
          {loading ? "..." : "➤"}
        </button>
      </form>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginBottom: reply ? 24 : 0,
        }}
      >
        {SUGESTOES_INICIAIS.map((s) => (
          <button key={s} type="button" onClick={() => sendMessage(s)} className="cat-btn" disabled={loading}>
            {s}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "#B42318", fontSize: 14, textAlign: "center", marginTop: 16 }}>{error}</p>}

      {reply && (
        <div style={{ marginTop: 8 }}>
          {lastUserMessage && (
            <p style={{ fontSize: 13, color: palette.gray400, marginBottom: 8 }}>Você: {lastUserMessage}</p>
          )}
          <p style={{ fontSize: 15, color: palette.gray800, lineHeight: 1.6, marginBottom: 16 }}>{reply}</p>

          {profileOptions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {profileOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => sendMessage(opt.value)}
                  className="cat-btn"
                  disabled={loading}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {products.length > 0 && (
            <div
              className="products-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}
            >
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `pnpm --filter @mypet/core exec tsc --noEmit`
Expected: sem erros novos relacionados a `assistant-search.tsx`.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/assistant-search.tsx
git commit -m "feat: componente AssistantSearch (caixa conversacional da home)"
```

---

### Task 7: Rotas de API e integração nas duas homes

**Files:**
- Create: `apps/mypet/app/api/assistant/route.ts`
- Create: `apps/distribuidora/app/api/assistant/route.ts`
- Modify: `apps/mypet/app/page.tsx`
- Modify: `apps/distribuidora/app/page.tsx`

**Interfaces:**
- Consumes: `POST` de `@mypet/core/assistant-server` (Task 4); `AssistantSearch` de `@mypet/core/components/assistant-search` (Task 6).

- [ ] **Step 1: Criar as rotas de API**

Criar `apps/mypet/app/api/assistant/route.ts`:

```ts
export { POST } from "@mypet/core/assistant-server";
```

Criar `apps/distribuidora/app/api/assistant/route.ts` com o mesmo conteúdo:

```ts
export { POST } from "@mypet/core/assistant-server";
```

- [ ] **Step 2: Inserir o componente na home da mypet**

Em `apps/mypet/app/page.tsx`, adicionar o import logo após a linha `import { SiteNav } from "@mypet/core/components/site-nav";`:

```ts
import { AssistantSearch } from "@mypet/core/components/assistant-search";
```

Localizar o bloco das pills dentro da seção HERO:

```tsx
            {/* pills */}
            <p className="fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {["✅ Cadastro em 10 segundos", "📦 Estoque em tempo real", "🚚 Entrega em 48h SP", "💬 Sem atendimento necessário", "🏷️ Preços sob consulta"].map((t) => (
                <span key={t} style={{
                  background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 100, padding: "6px 14px", fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 600,
                }}>{t}</span>
              ))}
            </p>
          </div>
        </section>
```

E substituir por (adicionando `<AssistantSearch>` logo após as pills, ainda dentro do `<div>` da hero):

```tsx
            {/* pills */}
            <p className="fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {["✅ Cadastro em 10 segundos", "📦 Estoque em tempo real", "🚚 Entrega em 48h SP", "💬 Sem atendimento necessário", "🏷️ Preços sob consulta"].map((t) => (
                <span key={t} style={{
                  background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 100, padding: "6px 14px", fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 600,
                }}>{t}</span>
              ))}
            </p>
          </div>
        </section>

        {/* ASSISTENTE DE BUSCA COM IA */}
        <div style={{ padding: "0 24px", marginTop: -32, position: "relative", zIndex: 1 }}>
          <AssistantSearch channel={clientConfig.catalogChannel} palette={clientConfig.palette} />
        </div>
```

- [ ] **Step 3: Repetir a mesma inserção na home da distribuidora**

Aplicar exatamente as mesmas duas edições do Step 2 em `apps/distribuidora/app/page.tsx` (arquivo hoje idêntico ao da mypet).

- [ ] **Step 4: Verificar o build**

Run: `pnpm --filter mypet build && pnpm --filter distribuidora build`
Expected: build concluído sem erros de tipo (as chamadas de IA vão falhar em runtime sem `.env.local` configurado, mas isso não afeta o build).

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/api/assistant/route.ts apps/distribuidora/app/api/assistant/route.ts apps/mypet/app/page.tsx apps/distribuidora/app/page.tsx
git commit -m "feat: expoe o assistente de busca nas rotas de API e nas duas homes"
```

---

### Task 8: Documentar variáveis de ambiente e o novo fluxo no `ARCHITECTURE.md`

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Atualizar a lista de variáveis de ambiente**

Trocar (linhas 30-32):

```markdown
Variáveis de ambiente por app (`.env.local`, não versionado):
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER`,
`GOOGLE_CREDENTIALS`, `GOOGLE_SHEET_ID`.
```

Por:

```markdown
Variáveis de ambiente por app (`.env.local`, não versionado):
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER`,
`GOOGLE_CREDENTIALS`, `GOOGLE_SHEET_ID`, `AI_PROVIDER`, `AI_MODEL`,
e a chave do provedor de IA escolhido (`GOOGLE_GENERATIVE_AI_API_KEY`,
`OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`).
```

- [ ] **Step 2: Adicionar uma subseção sobre o assistente de compras**

Localizar a subseção `### Catálogo` (dentro de "## 7. Dados e integrações") e adicionar logo depois dela:

```markdown
### Assistente de compras com IA

O bloco de destaque na home (`AssistantSearch`) chama `POST /api/assistant`
(`packages/core/src/assistant-server.ts`), que usa a Vercel AI SDK com tool
use sobre o catálogo real: a IA só pode citar produtos retornados por uma
busca de verdade em `getCatalog`. O modelo/provedor de IA é resolvido por
`packages/core/src/ai-provider.ts` a partir de `AI_PROVIDER`/`AI_MODEL` —
trocar de provedor (Google, OpenAI ou Anthropic) é uma mudança de variável
de ambiente, não de código. O perfil do visitante (pet shop revendedor vs.
banho-e-tosa) é inferido pela IA a cada conversa e vive apenas em memória
da sessão do navegador; nada é persistido no Supabase nesta fase.
```

- [ ] **Step 3: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: documenta variaveis de ambiente e fluxo do assistente de IA"
```

---

### Task 9: Verificação manual final

**Files:** nenhum (apenas validação)

- [ ] **Step 1: Rodar a suíte completa**

Run: `pnpm --filter @mypet/core test`
Expected: todos os testes passam (catalog-utils, catalog, ai-provider, assistant-server, assistant-client, leads, cart, whatsapp, querystring).

- [ ] **Step 2: Lint e build dos dois apps**

Run: `pnpm lint && pnpm build`
Expected: sem erros.

- [ ] **Step 3: Configurar `.env.local` de teste**

Em `apps/mypet/.env.local` (não versionado), garantir que já existem `SUPABASE_URL`/`SUPABASE_ANON_KEY`, e adicionar:

```
AI_PROVIDER=google
AI_MODEL=gemini-2.5-flash
GOOGLE_GENERATIVE_AI_API_KEY=<chave real de teste>
```

- [ ] **Step 4: Rodar localmente e testar 3 cenários de conversa**

Run: `pnpm dev:mypet`

No navegador, na home, testar na caixa do assistente:
1. "Quero montar um pet shop do zero" → espera-se resposta mencionando produtos de categorias como "Montagem de Loja" e uma pergunta ou confirmação de perfil pet shop.
2. "Preciso de shampoo profissional para tosa" → espera-se produtos da árvore "Banho & Tosa (PRO)" e perfil banho-e-tosa com confiança alta.
3. Uma mensagem ambígua, ex. "quero produtos bons" → espera-se `profileOptions` (chips de confirmação) aparecendo na tela.

Em cada cenário, confirmar que os produtos exibidos são reais (existem no catálogo, têm imagem/link funcionando) e que o botão "+ Adicionar à cotação" do `ProductCard` funciona normalmente.

- [ ] **Step 5: Confirmar o comportamento de erro**

Temporariamente remover/invalidar `GOOGLE_GENERATIVE_AI_API_KEY` no `.env.local`, reiniciar `pnpm dev:mypet`, enviar uma mensagem e confirmar que a UI mostra a mensagem de erro genérica (não uma tela quebrada). Restaurar a chave válida depois do teste.
