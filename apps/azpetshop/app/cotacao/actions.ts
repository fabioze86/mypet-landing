"use server";

import { createRetailLead } from "@mypet/core/leads-server";
import { clientConfig } from "@/client.config";
import type { Channel } from "@mypet/core/channels";

export type FinalizeQuoteResult = { ok: true } | { ok: false; error: string };

export async function finalizeQuote(input: {
  nome: string;
  whatsapp: string;
}): Promise<FinalizeQuoteResult> {
  const nome = input.nome?.trim();
  const whatsapp = input.whatsapp?.trim();
  if (!nome || !whatsapp) {
    return { ok: false, error: "Informe seu nome e WhatsApp." };
  }

  // Best-effort: histórico de quem pediu cotação. Falha aqui não impede o pedido.
  const lead = await createRetailLead({
    channel: clientConfig.catalogChannel as Channel,
    nome,
    whatsapp,
  });
  if (!lead.ok) {
    console.error("[azpetshop] lead não gravado:", lead.error);
  }

  return { ok: true };
}
