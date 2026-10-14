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
const MAX_PARTS = 20;

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
  if (parts.length > MAX_PARTS) return fail("Mensagem inválida.");

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
