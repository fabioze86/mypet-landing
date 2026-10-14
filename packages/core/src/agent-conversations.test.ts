import { describe, it, expect, vi } from "vitest";
import type { UIMessage } from "ai";
import { fakeSupabase, type FakeCall } from "./test-utils/fake-supabase";
import { ensureConversation, loadHistory, messageText, saveTurn } from "./agent-conversations";

// Chamadas registradas depois da primeira chamada de `method` (ex.: o .eq que escopa um update).
function callsAfter(calls: FakeCall[], method: string) {
  const index = calls.findIndex((c) => c.method === method);
  return index === -1 ? [] : calls.slice(index + 1);
}

const base = { id: "conv-1", channel: "mypetbrasil", ipHash: "h", mode: "visitante" as const };

// Linha de agent_conversations como o select devolve.
const row = (buyer_id: string | null, extra: Record<string, unknown> = {}) => ({
  data: { id: "conv-1", buyer_id, channel: "mypetbrasil", started_as: "visitante", ...extra },
});
// Resultado do update condicional: com .select("id"), as linhas atualizadas.
const claimed = { data: [{ id: "conv-1" }] };
const notClaimed = { data: [] };

vi.spyOn(console, "error").mockImplementation(() => {});

describe("ensureConversation", () => {
  it("cria a conversa quando não existe", async () => {
    const { client, calls } = fakeSupabase({ agent_conversations: [{ data: null }, {}] });
    expect(await ensureConversation(client, { ...base, buyerId: null })).toBe("ok");
    expect(calls).toContainEqual({ table: "agent_conversations", method: "eq", args: ["id", "conv-1"] });
    expect(calls).toContainEqual({
      table: "agent_conversations",
      method: "insert",
      args: [{ id: "conv-1", channel: "mypetbrasil", buyer_id: null, ip_hash: "h", started_as: "visitante" }],
    });
  });

  it("liga a conversa ao comprador quando o visitante se cadastra", async () => {
    const { client, calls } = fakeSupabase({ agent_conversations: [row(null), claimed] });
    expect(await ensureConversation(client, { ...base, buyerId: "b1", mode: "cliente" })).toBe("ok");
    expect(calls).toContainEqual({ table: "agent_conversations", method: "update", args: [{ buyer_id: "b1" }] });
    const afterUpdate = callsAfter(calls, "update");
    expect(afterUpdate).toContainEqual({ table: "agent_conversations", method: "eq", args: ["id", "conv-1"] });
    expect(afterUpdate).toContainEqual({ table: "agent_conversations", method: "is", args: ["buyer_id", null] });
    expect(afterUpdate).toContainEqual({ table: "agent_conversations", method: "select", args: ["id"] });
  });

  it("seleciona canal e started_as junto com o dono", async () => {
    const { client, calls } = fakeSupabase({ agent_conversations: [row("b1")] });
    await ensureConversation(client, { ...base, buyerId: "b1", mode: "cliente" });
    expect(calls).toContainEqual({
      table: "agent_conversations",
      method: "select",
      args: ["id, buyer_id, channel, started_as"],
    });
  });

  it("recusa conversa de outro canal", async () => {
    const visitante = fakeSupabase({ agent_conversations: [row(null, { channel: "azpetshop" })] });
    expect(await ensureConversation(visitante.client, { ...base, buyerId: null })).toBe("forbidden");
    const cliente = fakeSupabase({ agent_conversations: [row(null, { channel: "azpetshop" })] });
    expect(await ensureConversation(cliente.client, { ...base, buyerId: "b1", mode: "cliente" })).toBe("forbidden");
    expect(cliente.calls.some((c) => c.method === "update")).toBe(false);
    const dono = fakeSupabase({ agent_conversations: [row("b1", { channel: "azpetshop" })] });
    expect(await ensureConversation(dono.client, { ...base, buyerId: "b1", mode: "cliente" })).toBe("forbidden");
  });

  it("recusa visitante em conversa de cliente cujo comprador foi apagado", async () => {
    const { client } = fakeSupabase({ agent_conversations: [row(null, { started_as: "cliente" })] });
    expect(await ensureConversation(client, { ...base, buyerId: null })).toBe("forbidden");
  });

  it("recusa visitante em conversa sem dono que já teve mensagem no modo cliente", async () => {
    const { client, calls } = fakeSupabase({
      agent_conversations: [row(null)],
      agent_messages: [{ data: [{ id: "msg-1" }] }],
    });
    expect(await ensureConversation(client, { ...base, buyerId: null })).toBe("forbidden");
    const messageCalls = calls.filter((c) => c.table === "agent_messages");
    expect(messageCalls).toContainEqual({ table: "agent_messages", method: "select", args: ["id"] });
    expect(messageCalls).toContainEqual({ table: "agent_messages", method: "eq", args: ["conversation_id", "conv-1"] });
    expect(messageCalls).toContainEqual({ table: "agent_messages", method: "eq", args: ["mode", "cliente"] });
    expect(messageCalls).toContainEqual({ table: "agent_messages", method: "limit", args: [1] });
  });

  it("aceita visitante em conversa sem dono e sem mensagem no modo cliente", async () => {
    const { client, calls } = fakeSupabase({ agent_conversations: [row(null)], agent_messages: [{ data: [] }] });
    expect(await ensureConversation(client, { ...base, buyerId: null })).toBe("ok");
    expect(calls).toContainEqual({ table: "agent_messages", method: "eq", args: ["mode", "cliente"] });
  });

  it("erro ao procurar mensagens do modo cliente vira unavailable", async () => {
    const { client } = fakeSupabase({ agent_conversations: [row(null)], agent_messages: [{ error: { message: "down" } }] });
    expect(await ensureConversation(client, { ...base, buyerId: null })).toBe("unavailable");
  });

  it("só procura mensagens do modo cliente no caso visitante em conversa sem dono", async () => {
    const dono = fakeSupabase({ agent_conversations: [row("b1")] });
    await ensureConversation(dono.client, { ...base, buyerId: "b1", mode: "cliente" });
    const claim = fakeSupabase({ agent_conversations: [row(null), claimed] });
    await ensureConversation(claim.client, { ...base, buyerId: "b1", mode: "cliente" });
    const orfa = fakeSupabase({ agent_conversations: [row(null, { started_as: "cliente" })] });
    await ensureConversation(orfa.client, { ...base, buyerId: null });
    for (const { calls } of [dono, claim, orfa]) {
      expect(calls.some((c) => c.table === "agent_messages")).toBe(false);
    }
  });

  it("corrida no claim: outro comprador ligou a conversa antes → relê e recusa", async () => {
    const { client, calls } = fakeSupabase({ agent_conversations: [row(null), notClaimed, row("b2")] });
    expect(await ensureConversation(client, { ...base, buyerId: "b1", mode: "cliente" })).toBe("forbidden");
    expect(calls.filter((c) => c.method === "update")).toHaveLength(1);
    expect(calls.filter((c) => c.method === "maybeSingle")).toHaveLength(2);
  });

  it("corrida no claim: o mesmo comprador ligou a conversa antes → relê e aceita", async () => {
    const { client } = fakeSupabase({ agent_conversations: [row(null), notClaimed, row("b1")] });
    expect(await ensureConversation(client, { ...base, buyerId: "b1", mode: "cliente" })).toBe("ok");
  });

  it("corrida no claim: relê só uma vez; se ainda não conseguir, fica indisponível", async () => {
    const { client, calls } = fakeSupabase({ agent_conversations: [row(null), notClaimed, row(null), notClaimed] });
    expect(await ensureConversation(client, { ...base, buyerId: "b1", mode: "cliente" })).toBe("unavailable");
    expect(calls.filter((c) => c.method === "update")).toHaveLength(2);
    expect(calls.filter((c) => c.method === "maybeSingle")).toHaveLength(2);
  });

  it("aceita o mesmo comprador sem atualizar", async () => {
    const { client, calls } = fakeSupabase({ agent_conversations: [row("b1")] });
    expect(await ensureConversation(client, { ...base, buyerId: "b1", mode: "cliente" })).toBe("ok");
    expect(calls.some((c) => c.method === "update" || c.method === "insert")).toBe(false);
  });

  it("recusa conversa de outro comprador", async () => {
    const { client } = fakeSupabase({ agent_conversations: [row("b1")] });
    expect(await ensureConversation(client, { ...base, buyerId: "b2", mode: "cliente" })).toBe("forbidden");
  });

  it("recusa visitante numa conversa que já pertence a um comprador", async () => {
    const { client } = fakeSupabase({ agent_conversations: [row("b1")] });
    expect(await ensureConversation(client, { ...base, buyerId: null })).toBe("forbidden");
  });

  it("erro do banco vira unavailable", async () => {
    const { client } = fakeSupabase({ agent_conversations: [{ error: { message: "down" } }] });
    expect(await ensureConversation(client, { ...base, buyerId: null })).toBe("unavailable");
  });

  it("conflito no primeiro insert (23505): relê e aceita visitante em conversa sem dono", async () => {
    const { client } = fakeSupabase({
      agent_conversations: [{ data: null }, { error: { message: "dup", code: "23505" } }, row(null)],
    });
    expect(await ensureConversation(client, { ...base, buyerId: null })).toBe("ok");
  });

  it("conflito no primeiro insert (23505): recusa se a conversa é de outro comprador", async () => {
    const { client } = fakeSupabase({
      agent_conversations: [{ data: null }, { error: { message: "dup", code: "23505" } }, row("b1")],
    });
    expect(await ensureConversation(client, { ...base, buyerId: "b2", mode: "cliente" })).toBe("forbidden");
  });

  it("conflito no primeiro insert (23505): liga a conversa ao comprador, escopando o update", async () => {
    const { client, calls } = fakeSupabase({
      agent_conversations: [{ data: null }, { error: { message: "dup", code: "23505" } }, row(null), claimed],
    });
    expect(await ensureConversation(client, { ...base, buyerId: "b1", mode: "cliente" })).toBe("ok");
    expect(calls).toContainEqual({ table: "agent_conversations", method: "update", args: [{ buyer_id: "b1" }] });
    expect(callsAfter(calls, "update")).toContainEqual({ table: "agent_conversations", method: "eq", args: ["id", "conv-1"] });
    expect(callsAfter(calls, "update")).toContainEqual({ table: "agent_conversations", method: "is", args: ["buyer_id", null] });
  });

  it("outro erro no insert vira unavailable", async () => {
    const { client } = fakeSupabase({ agent_conversations: [{ data: null }, { error: { message: "down" } }] });
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
    expect(calls).toContainEqual({ table: "agent_messages", method: "eq", args: ["conversation_id", "conv-1"] });
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

    const rows = calls
      .filter((c) => c.method === "upsert")
      .flatMap((c) => c.args[0] as Record<string, unknown>[]);
    expect(rows.map((r) => [r.message_id, r.role, r.content, r.mode])).toEqual([
      ["m1", "user", "Tem shampoo?", "cliente"],
      ["m2", "assistant", "Encontrei estas opções.", "cliente"],
    ]);
    expect(Date.parse(rows[1].created_at as string)).toBeGreaterThan(Date.parse(rows[0].created_at as string));
    expect(calls.some((c) => c.table === "agent_conversations" && c.method === "update")).toBe(true);
    expect(calls).toContainEqual({ table: "agent_conversations", method: "eq", args: ["id", "conv-1"] });
  });

  it("pergunta do usuário não sobrescreve linha existente; resposta do assistente usa upsert normal", async () => {
    const { client, calls } = fakeSupabase({ agent_messages: [{}, {}], agent_conversations: [{}] });
    await saveTurn(client, { conversationId: "conv-1", mode: "cliente", messages: [user, reply] });

    const upserts = calls.filter((c) => c.method === "upsert");
    expect(upserts).toHaveLength(2);
    const [userRows, userOptions] = upserts[0].args as [Record<string, unknown>[], unknown];
    const [replyRows, replyOptions] = upserts[1].args as [Record<string, unknown>[], unknown];
    expect(userRows.map((r) => [r.message_id, r.role])).toEqual([["m1", "user"]]);
    expect(userOptions).toEqual({ onConflict: "conversation_id,message_id", ignoreDuplicates: true });
    expect(replyRows.map((r) => [r.message_id, r.role])).toEqual([["m2", "assistant"]]);
    expect(replyOptions).toEqual({ onConflict: "conversation_id,message_id" });
  });

  it("sem mensagens para gravar, não chama o Supabase", async () => {
    const { client, calls } = fakeSupabase({});
    await saveTurn(client, { conversationId: "conv-1", mode: "visitante", messages: [] });
    expect(calls).toEqual([]);
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
