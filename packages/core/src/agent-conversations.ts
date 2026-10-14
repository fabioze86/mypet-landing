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

export async function ensureConversation(
  supabase: SupabaseClient,
  input: { id: string; channel: string; buyerId: string | null; ipHash: string; mode: AgentMode },
): Promise<ConversationAccess> {
  try {
    const { data, error } = await supabase
      .from("agent_conversations")
      .select("id, buyer_id")
      .eq("id", input.id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!data) {
      const { error: insertError } = await supabase.from("agent_conversations").insert({
        id: input.id,
        channel: input.channel,
        buyer_id: input.buyerId,
        ip_hash: input.ipHash,
        started_as: input.mode,
      });
      if (insertError) throw new Error(insertError.message);
      return "ok";
    }

    const owner = (data as { buyer_id: string | null }).buyer_id;
    if (owner && owner !== input.buyerId) return "forbidden";
    if (!owner && input.buyerId) {
      // Visitante que se cadastrou no meio da conversa.
      const { error: updateError } = await supabase
        .from("agent_conversations")
        .update({ buyer_id: input.buyerId })
        .eq("id", input.id);
      if (updateError) throw new Error(updateError.message);
    }
    return "ok";
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

  try {
    const { error } = await supabase
      .from("agent_messages")
      .upsert(rows, { onConflict: "conversation_id,message_id" });
    if (error) throw new Error(error.message);

    const { error: touchError } = await supabase
      .from("agent_conversations")
      .update({ updated_at: new Date(base).toISOString() })
      .eq("id", input.conversationId);
    if (touchError) throw new Error(touchError.message);
  } catch (error) {
    console.error("[agent-conversations] falha ao gravar mensagens:", error);
  }
}
