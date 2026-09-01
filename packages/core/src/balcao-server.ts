import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel } from "./channels";
import type { BalcaoLogistics } from "./balcao";

export type BalcaoRequestItemInput = {
  productId: string;
  productReference: string;
  productName: string;
  qty: number;
  basePrice: number;
  tierMinQty: number | null;
  volumeDiscountPct: number;
  logisticsDiscountPct: number;
  unitPrice: number;
  lineTotal: number;
};

export type BalcaoBuyerSnapshot = {
  nome: string | null;
  empresa: string | null;
  whatsapp: string;
  cnpj: string | null;
};

export type CreateBalcaoRequestInput = {
  buyerId: string;
  channel: Channel;
  logistics: BalcaoLogistics;
  note: string | null;
  buyerSnapshot: BalcaoBuyerSnapshot;
  items: BalcaoRequestItemInput[];
  totalEstimated: number;
};

export async function createBalcaoRequest(
  supabase: SupabaseClient,
  input: CreateBalcaoRequestInput,
): Promise<{ requestId: string | null; error: string | null }> {
  if (input.items.length === 0) {
    return { requestId: null, error: "A solicitação está vazia." };
  }

  const { data: req, error: reqError } = await supabase
    .from("balcao_requests")
    .insert({
      buyer_id: input.buyerId,
      channel: input.channel,
      logistics: input.logistics,
      note: input.note,
      status: "enviada",
      buyer_snapshot: input.buyerSnapshot,
      total_estimated: input.totalEstimated,
    })
    .select("id")
    .single();

  if (reqError || !req) {
    console.error("[balcao] erro ao criar solicitação:", reqError?.message);
    return {
      requestId: null,
      error: "Não foi possível registrar sua solicitação. Tente novamente em instantes.",
    };
  }

  const { error: itemsError } = await supabase.from("balcao_request_items").insert(
    input.items.map((it) => ({
      request_id: req.id,
      product_id: it.productId,
      product_reference: it.productReference,
      product_name_snapshot: it.productName,
      qty: it.qty,
      base_price_snapshot: it.basePrice,
      tier_min_qty_snapshot: it.tierMinQty,
      volume_discount_pct_snapshot: it.volumeDiscountPct,
      logistics_discount_pct_snapshot: it.logisticsDiscountPct,
      unit_price_estimated: it.unitPrice,
      line_total_estimated: it.lineTotal,
    })),
  );

  if (itemsError) {
    console.error("[balcao] erro ao gravar itens da solicitação:", itemsError.message);
    return {
      requestId: null,
      error: "Não foi possível registrar os itens da solicitação. Tente novamente em instantes.",
    };
  }

  const { error: eventError } = await supabase.from("balcao_request_events").insert({
    request_id: req.id,
    actor: null,
    action: "criada",
    payload: null,
  });
  if (eventError) {
    console.error("[balcao] erro ao gravar evento inicial:", eventError.message);
  }

  return { requestId: req.id as string, error: null };
}
