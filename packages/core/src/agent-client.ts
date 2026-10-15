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

// crypto.randomUUID só existe em contexto seguro (HTTPS/localhost); em HTTP puro
// (ex.: celular na rede local) cai para getRandomValues, que existe sempre.
function randomUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newConversation(): StoredConversation {
  return { id: randomUuid(), messages: [] };
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

  const clearNotice = useCallback(() => setNotice(null), []);

  return { conversation, reset, notice, clearNotice };
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

  // Não grava durante o streaming: evita mensagem parcial e uma escrita por token.
  const streaming = chat.status === "submitted" || chat.status === "streaming";
  useEffect(() => {
    if (streaming) return;
    saveStoredConversation(safeSessionStorage(), { id: conversation.id, messages: chat.messages });
  }, [conversation.id, chat.messages, streaming]);

  const error = chat.error ? parseAgentError(chat.error) : null;
  const errorCode = error?.code ?? null;
  useEffect(() => {
    if (errorCode && RESET_CODES.has(errorCode)) onConversationReset(RESET_NOTICE);
  }, [errorCode, onConversationReset]);

  const busy = streaming;
  // Espelho síncrono de busy: duas chamadas no mesmo tick não passam as duas.
  const sendingRef = useRef(false);
  useEffect(() => {
    sendingRef.current = busy;
  }, [busy]);
  const { sendMessage } = chat;
  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || sendingRef.current) return false;
      sendingRef.current = true;
      void sendMessage({ text: trimmed });
      return true;
    },
    [busy, sendMessage],
  );

  return { messages: chat.messages, sendText, busy, error };
}
