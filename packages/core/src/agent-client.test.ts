import { describe, it, expect } from "vitest";
import {
  AGENT_STORAGE_KEY,
  cartChangesFromMessage,
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

  it("cartChangesFromMessage junta os aplicados de todas as chamadas concluídas de alterar_pedido", () => {
    const change = (id: string, qty: number) => ({ id, name: `P ${id}`, sku: id, brand: null, img: "", unitPrice: 10, qty });
    const message = {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "tool-alterar_pedido", toolCallId: "c1", state: "output-available", input: {}, output: { aplicados: [change("a", 2)], recusados: [] } },
        { type: "tool-alterar_pedido", toolCallId: "c2", state: "output-error", input: {}, errorText: "x" },
        { type: "tool-alterar_pedido", toolCallId: "c3", state: "output-available", input: {}, output: { aplicados: [change("b", 0), { id: 1 }], recusados: [] } },
      ],
    } as unknown as AgentMessage;
    expect(cartChangesFromMessage(message)).toEqual([change("a", 2), change("b", 0)]);
  });

  it("cartChangesFromMessage ignora preço negativo ou não finito", () => {
    const bad = (unitPrice: number) => ({ id: "a", name: "P", sku: "a", brand: null, img: "", unitPrice, qty: 1 });
    const message = {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "tool-alterar_pedido", toolCallId: "c1", state: "output-available", input: {}, output: { aplicados: [bad(-1), bad(NaN), bad(Infinity), bad(0)], recusados: [] } },
      ],
    } as unknown as AgentMessage;
    expect(cartChangesFromMessage(message)).toEqual([bad(0)]);
  });

  it("productsFromMessage ignora partes com tipo herdado do Object", () => {
    const message = {
      id: "a1",
      role: "assistant",
      parts: [{ type: "constructor", state: "output-available", output: {} }],
    } as unknown as AgentMessage;
    expect(productsFromMessage(message)).toEqual([]);
  });

  it("productsFromMessage também lê os itens de sugerir_reposicao", () => {
    const message = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-sugerir_reposicao",
          toolCallId: "c1",
          state: "output-available",
          input: {},
          output: { tipo: "reposicao", itens: [{ ...product(1), unitPrice: 10, priceLabel: "R$ 10,00", ultimaCompraDias: 30, intervaloMedioDias: 30, qtdUltimaCompra: 2 }] },
        },
      ],
    } as unknown as AgentMessage;
    expect(productsFromMessage(message).map((p) => p.id)).toEqual(["p1"]);
  });
});
