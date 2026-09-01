"use server";

import { getHubServiceClient } from "@mypet/core/supabase";
import {
  getBalcaoEligibleProducts,
  buildEstimate,
  type BalcaoLogistics,
} from "@mypet/core/balcao";
import { createBalcaoRequest } from "@mypet/core/balcao-server";
import { requireBuyer } from "@/lib/require-buyer";
import { clientConfig } from "@/client.config";
import type { Channel } from "@mypet/core/channels";

export type SubmitBalcaoInput = {
  selections: { productId: string; qty: number }[];
  logistics: BalcaoLogistics;
  note: string;
};

export type SubmitBalcaoResult =
  | { ok: true }
  | { ok: false; error: string; needsAuth?: boolean };

const VALID_LOGISTICS: BalcaoLogistics[] = ["retirada", "frete_proprio"];

export async function submitBalcaoRequest(
  input: SubmitBalcaoInput,
): Promise<SubmitBalcaoResult> {
  const buyer = await requireBuyer();
  if (!buyer) {
    return {
      ok: false,
      error: "Você precisa criar um acesso para enviar a solicitação.",
      needsAuth: true,
    };
  }

  if (!VALID_LOGISTICS.includes(input.logistics)) {
    return { ok: false, error: "Escolha retirada ou frete por conta própria." };
  }

  const channel = clientConfig.catalogChannel as Channel;
  const products = await getBalcaoEligibleProducts(channel);

  // Fonte da verdade: recalcula no servidor, ignora números vindos do cliente.
  const cleanSelections = input.selections
    .map((s) => ({ productId: String(s.productId), qty: Math.floor(Number(s.qty)) }))
    .filter((s) => s.qty >= 1);

  const { lines, totalEstimated, qualifies } = buildEstimate({
    products,
    selections: cleanSelections,
    logistics: input.logistics,
  });

  if (lines.length === 0) {
    return { ok: false, error: "Nenhum item elegível na solicitação." };
  }
  if (!qualifies) {
    return {
      ok: false,
      error: "Aumente a quantidade de ao menos um item até a menor faixa para enviar.",
    };
  }

  const { error } = await createBalcaoRequest(getHubServiceClient(), {
    buyerId: buyer.id,
    channel,
    logistics: input.logistics,
    note: input.note.trim() ? input.note.trim().slice(0, 2000) : null,
    buyerSnapshot: {
      nome: buyer.nome,
      empresa: buyer.empresa,
      whatsapp: buyer.whatsapp,
      cnpj: buyer.cnpj,
    },
    items: lines.map((l) => ({
      productId: l.product.id,
      productReference: l.product.sku,
      productName: l.product.name,
      qty: l.qty,
      basePrice: l.product.basePrice,
      tierMinQty: l.tier?.minQty ?? null,
      volumeDiscountPct: l.volumePct,
      logisticsDiscountPct: l.logisticsPct,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    totalEstimated,
  });

  if (error) return { ok: false, error };
  return { ok: true };
}
