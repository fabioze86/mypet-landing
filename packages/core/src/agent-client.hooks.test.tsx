// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { AGENT_STORAGE_KEY, useAgentChat, type AgentCartItem } from "./agent-client";

const conversation = { id: "3f1c2a7e-8b4d-4c1a-9f2e-1a2b3c4d5e6f", messages: [] };
const cart = [{ productId: "p1", quantity: 2 }] as unknown as AgentCartItem[];

function streamResponse(text = "Olá!") {
  const chunks: UIMessageChunk[] = [
    { type: "start" },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish" },
  ];
  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return createUIMessageStreamResponse({ stream });
}

function errorResponse(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(onConversationReset = vi.fn()) {
  const getCart = vi.fn(() => cart);
  const hook = renderHook(() => useAgentChat({ conversation, getCart, onConversationReset }));
  return { ...hook, onConversationReset, getCart };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.sessionStorage.clear();
  fetchMock = vi.fn(async () => streamResponse());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAgentChat", () => {
  it("envia { id, message, cart } para /api/agente", async () => {
    const { result } = setup();
    let sent = false;
    act(() => {
      sent = result.current.sendText("Oi");
    });
    expect(sent).toBe(true);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/agente");
    const body = JSON.parse(init.body as string);
    expect(body.id).toBe(conversation.id);
    expect(body.cart).toEqual(cart);
    expect(body.message.role).toBe("user");
    expect(body.message.parts).toEqual([{ type: "text", text: "Oi" }]);
    expect(body.messages).toBeUndefined();
    await waitFor(() => expect(result.current.busy).toBe(false));
  });

  it("recusa texto vazio e envio enquanto ocupado", async () => {
    let release!: () => void;
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (release = () => resolve(streamResponse()))),
    );
    const { result } = setup();
    expect(result.current.sendText("")).toBe(false);
    expect(result.current.sendText("   ")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      result.current.sendText("Oi");
    });
    await waitFor(() => expect(result.current.busy).toBe(true));
    expect(result.current.sendText("De novo")).toBe(false);
    release();
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("duas chamadas no mesmo tick geram um só envio", async () => {
    const { result } = setup();
    const results: boolean[] = [];
    act(() => {
      results.push(result.current.sendText("Um"));
      results.push(result.current.sendText("Dois"));
    });
    expect(results).toEqual([true, false]);
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("409 MESSAGE_DUPLICATE reinicia a conversa com aviso", async () => {
    fetchMock.mockResolvedValue(errorResponse(409, "MESSAGE_DUPLICATE", "x"));
    const { result, onConversationReset } = setup();
    act(() => {
      result.current.sendText("Oi");
    });
    await waitFor(() => expect(onConversationReset).toHaveBeenCalledTimes(1));
    expect(onConversationReset).toHaveBeenCalledWith("Começamos uma nova conversa. Envie sua pergunta de novo.");
  });

  it("429 RATE_LIMITED expõe a mensagem e não reinicia", async () => {
    fetchMock.mockResolvedValue(errorResponse(429, "RATE_LIMITED", "Aguarde um instante."));
    const { result, onConversationReset } = setup();
    act(() => {
      result.current.sendText("Oi");
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toEqual({ code: "RATE_LIMITED", message: "Aguarde um instante." });
    expect(onConversationReset).not.toHaveBeenCalled();
  });

  it("grava no sessionStorage depois do streaming, com a resposta completa", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { result } = setup();
    act(() => {
      result.current.sendText("Oi");
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    await waitFor(() => {
      const saved = JSON.parse(window.sessionStorage.getItem(AGENT_STORAGE_KEY) ?? "null");
      expect(saved?.messages).toHaveLength(2);
      expect(saved.messages[1].parts.some((p: { text?: string }) => p.text === "Olá!")).toBe(true);
    });
    // nenhuma gravação com mensagem do assistente incompleta (estado de streaming)
    for (const call of setItem.mock.calls) {
      const saved = JSON.parse(call[1] as string);
      for (const message of saved.messages) {
        if (message.role === "assistant") {
          expect(message.parts.some((p: { state?: string }) => p.state === "streaming")).toBe(false);
        }
      }
    }
    setItem.mockRestore();
  });
});
