"use server";

import { createServerSupabaseClient } from "@mypet/core/supabase-server";
import { getBuyerById } from "@mypet/core/buyers-server";
import { createOrder } from "@mypet/core/orders-server";
import { clientConfig } from "@/client.config";
import type { CartItem } from "@mypet/core/cart";
import type { Channel } from "@mypet/core/channels";

export type FinalizeQuoteResult =
  | { ok: true; buyer: { nome: string; empresa: string; whatsapp: string; cnpj: string | null } }
  | { ok: false; error: string; needsAuth?: boolean };

export async function finalizeQuote(items: CartItem[]): Promise<FinalizeQuoteResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Você precisa entrar para finalizar a cotação.", needsAuth: true };
  }

  const buyer = await getBuyerById(supabase, user.id);
  if (!buyer) {
    return { ok: false, error: "Cadastro incompleto. Complete seu cadastro para continuar.", needsAuth: true };
  }

  const { error } = await createOrder(supabase, {
    buyerId: user.id,
    channel: clientConfig.catalogChannel as Channel,
    items,
  });

  if (error) {
    return { ok: false, error };
  }

  return { ok: true, buyer: { nome: buyer.nome, empresa: buyer.empresa, whatsapp: buyer.whatsapp, cnpj: buyer.cnpj } };
}
