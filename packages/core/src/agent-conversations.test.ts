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
