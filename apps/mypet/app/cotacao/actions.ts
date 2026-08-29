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

export async function finalizeQuote(items: CartItem[]): Promise<FinalizeQuoteResult> {
  const buyer = await requireBuyer();

  if (!buyer) {
    return {
      ok: false,
      error: "Você precisa criar um acesso para finalizar a cotação.",
      needsAuth: true,
    };
  }

  const { error } = await createOrder(getHubServiceClient(), {
    buyerId: buyer.id,
    channel: clientConfig.catalogChannel as Channel,
    items,
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
