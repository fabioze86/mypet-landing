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
