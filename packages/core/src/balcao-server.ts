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

export type BalcaoRequestStatus =
  | "enviada"
  | "em_analise"
  | "aprovada"
  | "ajustada"
  | "recusada"
  | "expirada";

export type BalcaoRequestListRow = {
  id: string;
  buyer: BalcaoBuyerSnapshot;
  logistics: BalcaoLogistics;
  status: BalcaoRequestStatus;
  totalEstimated: number;
  createdAt: string;
};

export type BalcaoRequestItemRow = {
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

export type BalcaoRequestEventRow = {
  actor: string | null;
  action: string;
  payload: unknown;
  createdAt: string;
};

export type BalcaoRequestDetail = BalcaoRequestListRow & {
  note: string | null;
  items: BalcaoRequestItemRow[];
  events: BalcaoRequestEventRow[];
};

export async function getBalcaoRequests(
  supabase: SupabaseClient,
  filter: { status?: BalcaoRequestStatus },
): Promise<BalcaoRequestListRow[]> {
  let query = supabase
    .from("balcao_requests")
    .select("id, buyer_snapshot, logistics, status, total_estimated, created_at");
  if (filter.status) query = query.eq("status", filter.status);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("[balcao] erro ao listar solicitações:", error.message);
    return [];
  }

  return (
    (data as {
      id: string;
      buyer_snapshot: BalcaoBuyerSnapshot;
      logistics: BalcaoLogistics;
      status: BalcaoRequestStatus;
      total_estimated: number | string;
      created_at: string;
    }[]) ?? []
  ).map((row) => ({
    id: row.id,
    buyer: row.buyer_snapshot,
    logistics: row.logistics,
    status: row.status,
    totalEstimated: Number(row.total_estimated),
    createdAt: row.created_at,
  }));
}

export async function getBalcaoRequestById(
  supabase: SupabaseClient,
  id: string,
): Promise<BalcaoRequestDetail | null> {
  const { data, error } = await supabase
    .from("balcao_requests")
    .select(
      "id, buyer_snapshot, logistics, status, total_estimated, note, created_at, " +
        "balcao_request_items(product_id, product_reference, product_name_snapshot, qty, base_price_snapshot, tier_min_qty_snapshot, volume_discount_pct_snapshot, logistics_discount_pct_snapshot, unit_price_estimated, line_total_estimated), " +
        "balcao_request_events(actor, action, payload, created_at)",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[balcao] erro ao buscar solicitação:", error?.message);
    return null;
  }

  const row = data as unknown as Record<string, unknown> & {
    balcao_request_items: Record<string, unknown>[] | null;
    balcao_request_events: Record<string, unknown>[] | null;
  };

  return {
    id: row.id as string,
    buyer: row.buyer_snapshot as BalcaoBuyerSnapshot,
    logistics: row.logistics as BalcaoLogistics,
    status: row.status as BalcaoRequestStatus,
    totalEstimated: Number(row.total_estimated),
    createdAt: row.created_at as string,
    note: (row.note as string | null) ?? null,
    items: (row.balcao_request_items ?? []).map((it) => ({
      productId: it.product_id as string,
      productReference: it.product_reference as string,
      productName: it.product_name_snapshot as string,
      qty: it.qty as number,
      basePrice: Number(it.base_price_snapshot),
      tierMinQty: (it.tier_min_qty_snapshot as number | null) ?? null,
      volumeDiscountPct: Number(it.volume_discount_pct_snapshot),
      logisticsDiscountPct: Number(it.logistics_discount_pct_snapshot),
      unitPrice: Number(it.unit_price_estimated),
      lineTotal: Number(it.line_total_estimated),
    })),
    events: (row.balcao_request_events ?? [])
      .map((ev) => ({
        actor: (ev.actor as string | null) ?? null,
        action: ev.action as string,
        payload: ev.payload ?? null,
        createdAt: ev.created_at as string,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export async function updateBalcaoRequestStatus(
  supabase: SupabaseClient,
  input: {
    id: string;
    actorId: string;
    action: Exclude<BalcaoRequestStatus, "enviada"> | "em_analise";
    payload?: unknown;
  },
): Promise<{ error: string | null }> {
  const { error: updError } = await supabase
    .from("balcao_requests")
    .update({ status: input.action, updated_at: new Date().toISOString() })
    .eq("id", input.id);

  if (updError) {
    console.error("[balcao] erro ao atualizar status:", updError.message);
    return { error: "Não foi possível atualizar a solicitação." };
  }

  const { error: evError } = await supabase.from("balcao_request_events").insert({
    request_id: input.id,
    actor: input.actorId,
    action: input.action,
    payload: input.payload ?? null,
  });
  if (evError) {
    console.error("[balcao] erro ao gravar evento de status:", evError.message);
    return { error: "Status atualizado, mas o histórico não foi gravado." };
  }

  return { error: null };
}
