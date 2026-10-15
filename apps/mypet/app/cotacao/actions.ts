"use server";

import { getHubServiceClient } from "@mypet/core/supabase";
import { createOrder } from "@mypet/core/orders-server";
import { requireBuyer } from "@/lib/require-buyer";
import { clientConfig } from "@/client.config";
import type { CartItem } from "@mypet/core/cart";
import type { Channel } from "@mypet/core/channels";

export type FinalizeQuoteResult =
  | { ok: true; buyer: { nome: string; empresa: string; whatsapp: string; cnpj: string | null } }
  | { ok: false; error: string; needsAuth?: boolean };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Só liga o pedido à conversa se ela for do próprio comprador.
async function ownedConversationId(
  supabase: ReturnType<typeof getHubServiceClient>,
  buyerId: string,
  id: string | undefined,
): Promise<string | null> {
  if (!id || !UUID_PATTERN.test(id)) return null;
  try {
    const { data, error } = await supabase
      .from("agent_conversations")
      .select("id")
      .eq("id", id)
      .eq("buyer_id", buyerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? id : null;
  } catch (error) {
    console.error("[cotacao] falha ao conferir a conversa do agente:", error);
    return null;
  }
}

export async function finalizeQuote(
  items: CartItem[],
  options: { agentConversationId?: string } = {},
): Promise<FinalizeQuoteResult> {
  const buyer = await requireBuyer();

  if (!buyer) {
    return {
      ok: false,
      error: "Faça seu cadastro para enviar o pedido.",
      needsAuth: true,
    };
  }

  // Server action: os argumentos chegam do cliente sem garantia de tipo.
  const opts: { agentConversationId?: unknown } = options && typeof options === "object" ? options : {};
  const requestedConversationId = typeof opts.agentConversationId === "string" ? opts.agentConversationId : undefined;

  const supabase = getHubServiceClient();
  const agentConversationId = await ownedConversationId(supabase, buyer.id, requestedConversationId);

  const { error } = await createOrder(supabase, {
    buyerId: buyer.id,
    channel: clientConfig.catalogChannel as Channel,
    items,
    agentConversationId,
  });

  if (error) {
    return { ok: false, error };
  }

  return {
    ok: true,
    buyer: {
      nome: buyer.nome ?? "",
      empresa: buyer.empresa ?? "",
      whatsapp: buyer.whatsapp,
      cnpj: buyer.cnpj,
    },
  };
}
