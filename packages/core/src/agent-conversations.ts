import type { SupabaseClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";
import type { AgentMode } from "./agent-prompt";

// Conversas do agente no Supabase (service role). Falhas do banco nunca
// derrubam a resposta: o agente segue sem histórico e sem gravar.

export type ConversationAccess = "ok" | "forbidden" | "unavailable";

const HISTORY_LIMIT = 12;

type StoredMessageRow = { message_id: string; role: "user" | "assistant"; parts: UIMessage["parts"] };

export function messageText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

type ConversationRow = { buyer_id: string | null; channel: string; started_as: AgentMode };

type EnsureInput = { id: string; channel: string; buyerId: string | null; ipHash: string; mode: AgentMode };

// Dono da conversa x comprador da requisição. Visitante que se cadastrou no
// meio da conversa passa a ser o dono. A ligação só vale se a conversa ainda
// estiver sem dono no momento do update; se outra requisição ganhou a corrida,
// relê e aplica a regra de novo (uma vez só).
async function claimConversation(
  supabase: SupabaseClient,
  input: EnsureInput,
  row: ConversationRow,
  reread: (() => Promise<ConversationRow>) | null,
): Promise<ConversationAccess> {
  if (row.channel !== input.channel) return "forbidden";
  if (row.buyer_id) return row.buyer_id === input.buyerId ? "ok" : "forbidden";
  // Conversa de cliente cujo comprador foi apagado (on delete set null): o
  // histórico tem preços, então visitante não entra.
  if (!input.buyerId) return row.started_as === "cliente" ? "forbidden" : "ok";

  const { data, error } = await supabase
    .from("agent_conversations")
    .update({ buyer_id: input.buyerId })
    .eq("id", input.id)
    .is("buyer_id", null)
    .select("id");
  if (error) throw new Error(error.message);
  if (Array.isArray(data) && data.length > 0) return "ok";

  if (!reread) throw new Error("conversa mudou de dono durante a ligação ao comprador");
  return claimConversation(supabase, input, await reread(), null);
}

export async function ensureConversation(
  supabase: SupabaseClient,
  input: EnsureInput,
): Promise<ConversationAccess> {
  const selectRow = () =>
    supabase.from("agent_conversations").select("id, buyer_id, channel, started_as").eq("id", input.id).maybeSingle();
  const rereadRow = async (): Promise<ConversationRow> => {
    const { data, error } = await selectRow();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("conversa sumiu durante a ligação ao comprador");
    return data as ConversationRow;
  };

  try {
    const { data, error } = await selectRow();
    if (error) throw new Error(error.message);
    if (data) return await claimConversation(supabase, input, data as ConversationRow, rereadRow);

    const { error: insertError } = await supabase.from("agent_conversations").insert({
      id: input.id,
      channel: input.channel,
      buyer_id: input.buyerId,
      ip_hash: input.ipHash,
      started_as: input.mode,
    });
    if (!insertError) return "ok";
    if (insertError.code !== "23505") throw new Error(insertError.message);

    // Outra requisição criou a conversa entre o select e o insert.
    const { data: existing, error: rereadError } = await selectRow();
    if (rereadError) throw new Error(rereadError.message);
    if (!existing) throw new Error(insertError.message);
    return await claimConversation(supabase, input, existing as ConversationRow, rereadRow);
  } catch (error) {
    console.error("[agent-conversations] falha ao abrir conversa:", error);
    return "unavailable";
  }
}

export async function loadHistory(supabase: SupabaseClient, conversationId: string): Promise<UIMessage[]> {
  try {
    const { data, error } = await supabase
      .from("agent_messages")
      .select("message_id, role, parts")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    if (error) throw new Error(error.message);
    return ((data as StoredMessageRow[] | null) ?? [])
      .reverse()
      .map((row) => ({ id: row.message_id, role: row.role, parts: row.parts }));
  } catch (error) {
    console.error("[agent-conversations] falha ao carregar histórico:", error);
    return [];
  }
}

export async function saveTurn(
  supabase: SupabaseClient,
  input: { conversationId: string; mode: AgentMode; messages: UIMessage[] },
): Promise<void> {
  const base = Date.now();
  // Horários explícitos e crescentes: no mesmo insert o default now() empataria
  // e a ordem do histórico ficaria ambígua.
  const rows = input.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message, index) => ({
      conversation_id: input.conversationId,
      message_id: message.id,
      role: message.role,
      content: messageText(message),
      parts: message.parts,
      mode: input.mode,
      created_at: new Date(base + index).toISOString(),
    }));

  if (rows.length === 0) return;

  // O id da pergunta vem do navegador: nunca sobrescreve uma linha já gravada
  // (reenvio, ou id igual ao de uma resposta). Os ids das respostas são gerados
  // no servidor, então o upsert normal é seguro.
  const userRows = rows.filter((row) => row.role === "user");
  const assistantRows = rows.filter((row) => row.role === "assistant");

  try {
    if (userRows.length > 0) {
      const { error } = await supabase
        .from("agent_messages")
        .upsert(userRows, { onConflict: "conversation_id,message_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    if (assistantRows.length > 0) {
      const { error } = await supabase
        .from("agent_messages")
        .upsert(assistantRows, { onConflict: "conversation_id,message_id" });
      if (error) throw new Error(error.message);
    }

    const { error: touchError } = await supabase
      .from("agent_conversations")
      .update({ updated_at: new Date(base).toISOString() })
      .eq("id", input.conversationId);
    if (touchError) throw new Error(touchError.message);
  } catch (error) {
    console.error("[agent-conversations] falha ao gravar mensagens:", error);
  }
}
