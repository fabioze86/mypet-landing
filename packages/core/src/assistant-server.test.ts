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
