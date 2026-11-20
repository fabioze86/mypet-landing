"use server";

import { getHubServiceClient } from "@mypet/core/supabase";
import { createOrder } from "@mypet/core/orders-server";
import { priceCart } from "@mypet/core/retail-checkout-server";
import { parseCheckoutLines } from "@mypet/core/retail-checkout";
import { calcularFrete, paraCentavos, shippingModeDe, type FreteCalculo, type Modalidade, type Zona } from "@mypet/core/frete";
import { requireBuyer } from "@/lib/require-buyer";
import { clientConfig } from "@/client.config";
import { FRETE_CONFIG } from "@/lib/frete.config";
import { VITRINES, isVitrineId, type VitrineId } from "@/lib/vitrines";
import { zonaDoComprador } from "@/lib/zona";
import type { CartItem } from "@mypet/core/cart";
import type { Channel } from "@mypet/core/channels";

export type OrderBuyer = { nome: string; empresa: string; whatsapp: string; cnpj: string | null };
export type PedidoResumo = { vitrine: VitrineId; items: CartItem[]; subtotal: number; zona: Zona; frete: FreteCalculo };

export type FinalizeQuoteResult =
  | { ok: true; buyer: OrderBuyer; pedido: PedidoResumo }
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
  options: { vitrine?: VitrineId; modalidade?: Modalidade; agentConversationId?: string } = {},
): Promise<FinalizeQuoteResult> {
  const buyer = await requireBuyer();
  if (!buyer) {
    return { ok: false, error: "Faça seu cadastro para enviar o pedido.", needsAuth: true };
  }

  // Server action: os argumentos chegam do cliente sem garantia de tipo.
  const opts = (options && typeof options === "object" ? options : {}) as Record<string, unknown>;
  const vitrine = VITRINES[isVitrineId(opts.vitrine) ? opts.vitrine : "completo"];
  const modalidade: Modalidade = opts.modalidade === "prioritaria" ? "prioritaria" : "normal";
  const requestedConversationId = typeof opts.agentConversationId === "string" ? opts.agentConversationId : undefined;

  const lines = parseCheckoutLines(Array.isArray(items) ? items.map((i) => ({ id: i?.id, qty: i?.qty })) : items);
  if (!lines.ok) return { ok: false, error: lines.error };

  const supabase = getHubServiceClient();
  const channel = clientConfig.catalogChannel as Channel;
  const priced = await priceCart(
    supabase,
    channel,
    lines.value,
    vitrine.alsoInChannel ? { alsoInChannel: vitrine.alsoInChannel, checkStock: false } : { checkStock: false },
  );
  if (!priced.ok) return { ok: false, error: priced.error };

  const zona = zonaDoComprador(buyer);
  const frete = calcularFrete(
    { regra: vitrine.regraFrete, zona, subtotalCentavos: paraCentavos(priced.subtotal), modalidade },
    FRETE_CONFIG,
  );
  const shippingPrice = frete.valorCentavos === null ? null : frete.valorCentavos / 100;
  const total = Math.round((priced.subtotal + (shippingPrice ?? 0)) * 100) / 100;

  // Preço e nome do servidor; imagem, marca e SKU vêm do carrinho (só exibição).
  const byId = new Map(items.map((i) => [i.id, i]));
  const repriced: CartItem[] = priced.lines.map((line) => {
    const original = byId.get(line.id);
    return {
      id: line.id,
      name: line.name,
      qty: line.qty,
      unitPrice: line.unitPrice,
      sku: original?.sku ?? "",
      brand: original?.brand ?? null,
      img: original?.img ?? "",
    };
  });

  const agentConversationId = await ownedConversationId(supabase, buyer.id, requestedConversationId);
  const { error } = await createOrder(supabase, {
    buyerId: buyer.id,
    channel,
    items: repriced,
    agentConversationId,
    vitrine: vitrine.id,
    shipping: { mode: shippingModeDe(frete), subtotal: priced.subtotal, shippingPrice, total },
  });
  if (error) return { ok: false, error };

  return {
    ok: true,
    buyer: { nome: buyer.nome ?? "", empresa: buyer.empresa ?? "", whatsapp: buyer.whatsapp, cnpj: buyer.cnpj },
    pedido: { vitrine: vitrine.id, items: repriced, subtotal: priced.subtotal, zona, frete },
  };
}
