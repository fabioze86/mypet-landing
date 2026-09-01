import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBalcaoRequest, getBalcaoRequests, updateBalcaoRequestStatus, type CreateBalcaoRequestInput } from "./balcao-server";

const baseInput: CreateBalcaoRequestInput = {
  buyerId: "b1",
  channel: "mypetbrasil",
  logistics: "retirada",
  note: "sem pressa",
  buyerSnapshot: { nome: "Fulano", empresa: "Pet X", whatsapp: "11999", cnpj: "123" },
  items: [
    {
      productId: "pa",
      productReference: "SKU-A",
      productName: "Ração A",
      qty: 12,
      basePrice: 100,
      tierMinQty: 10,
      volumeDiscountPct: 10,
      logisticsDiscountPct: 5,
      unitPrice: 85.5,
      lineTotal: 1026,
    },
  ],
  totalEstimated: 1026,
};

describe("createBalcaoRequest", () => {
  it("rejeita quando não há itens", async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;
    const r = await createBalcaoRequest(supabase, { ...baseInput, items: [] });
    expect(r).toEqual({ requestId: null, error: "A solicitação está vazia." });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("grava cabeçalho, itens (snapshot) e evento criada", async () => {
    const reqSingle = vi.fn().mockResolvedValue({ data: { id: "req1" }, error: null });
    const itemsInsert = vi.fn().mockResolvedValue({ error: null });
    const eventsInsert = vi.fn().mockResolvedValue({ error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "balcao_requests") {
          return { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: reqSingle };
        }
        if (table === "balcao_request_items") return { insert: itemsInsert };
        return { insert: eventsInsert };
      }),
    } as unknown as SupabaseClient;

    const r = await createBalcaoRequest(supabase, baseInput);

    expect(r).toEqual({ requestId: "req1", error: null });
    expect(itemsInsert).toHaveBeenCalledWith([
      {
        request_id: "req1",
        product_id: "pa",
        product_reference: "SKU-A",
        product_name_snapshot: "Ração A",
        qty: 12,
        base_price_snapshot: 100,
        tier_min_qty_snapshot: 10,
        volume_discount_pct_snapshot: 10,
        logistics_discount_pct_snapshot: 5,
        unit_price_estimated: 85.5,
        line_total_estimated: 1026,
      },
    ]);
    expect(eventsInsert).toHaveBeenCalledWith({
      request_id: "req1",
      actor: null,
      action: "criada",
      payload: null,
    });
  });

  it("devolve erro genérico quando o cabeçalho falha", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
      })),
    } as unknown as SupabaseClient;
    const r = await createBalcaoRequest(supabase, baseInput);
    expect(r.requestId).toBeNull();
    expect(r.error).toBe("Não foi possível registrar sua solicitação. Tente novamente em instantes.");
  });
});

describe("getBalcaoRequests", () => {
  it("mapeia linhas e aplica filtro de status", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "req1",
          buyer_snapshot: { nome: "F", empresa: "X", whatsapp: "11", cnpj: null },
          logistics: "retirada",
          status: "enviada",
          total_estimated: "1026.00",
          created_at: "2026-08-30T10:00:00Z",
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq, order });
    const supabase = { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;

    const rows = await getBalcaoRequests(supabase, { status: "enviada" });
    expect(eq).toHaveBeenCalledWith("status", "enviada");
    expect(rows[0]).toEqual({
      id: "req1",
      buyer: { nome: "F", empresa: "X", whatsapp: "11", cnpj: null },
      logistics: "retirada",
      status: "enviada",
      totalEstimated: 1026,
      createdAt: "2026-08-30T10:00:00Z",
    });
  });
});

describe("updateBalcaoRequestStatus", () => {
  it("atualiza status e grava evento com actor e payload", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const eventInsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "balcao_requests") {
          return { update: vi.fn().mockReturnValue({ eq: updateEq }) };
        }
        return { insert: eventInsert };
      }),
    } as unknown as SupabaseClient;

    const r = await updateBalcaoRequestStatus(supabase, {
      id: "req1",
      actorId: "admin-1",
      action: "aprovada",
      payload: { nota: "ok" },
    });
    expect(r).toEqual({ error: null });
    expect(eventInsert).toHaveBeenCalledWith({
      request_id: "req1",
      actor: "admin-1",
      action: "aprovada",
      payload: { nota: "ok" },
    });
  });
});
