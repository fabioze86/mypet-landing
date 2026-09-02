import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createBalcaoRequest,
  getBalcaoRequests,
  getBalcaoRequestById,
  updateBalcaoRequestStatus,
  type CreateBalcaoRequestInput,
} from "./balcao-server";

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

  it("grava o cabeçalho com o payload snake_case esperado", async () => {
    const reqInsert = vi.fn().mockReturnThis();
    const reqChain = {
      insert: reqInsert,
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "req1" }, error: null }),
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "balcao_requests") return reqChain;
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }),
    } as unknown as SupabaseClient;

    await createBalcaoRequest(supabase, baseInput);

    expect(reqInsert).toHaveBeenCalledWith({
      buyer_id: "b1",
      channel: "mypetbrasil",
      logistics: "retirada",
      note: "sem pressa",
      status: "enviada",
      buyer_snapshot: { nome: "Fulano", empresa: "Pet X", whatsapp: "11999", cnpj: "123" },
      total_estimated: 1026,
    });
  });

  it("não falha a solicitação quando o insert de evento falha", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "balcao_requests") {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: "req1" }, error: null }),
          };
        }
        if (table === "balcao_request_items") return { insert: vi.fn().mockResolvedValue({ error: null }) };
        return { insert: vi.fn().mockResolvedValue({ error: { message: "boom" } }) };
      }),
    } as unknown as SupabaseClient;

    const r = await createBalcaoRequest(supabase, baseInput);

    expect(r).toEqual({ requestId: "req1", error: null });
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

describe("getBalcaoRequestById", () => {
  it("coage numéricos, mapeia itens snake→camel e ordena eventos por createdAt asc", async () => {
    const row = {
      id: "req9",
      buyer_snapshot: { nome: "Ciclana", empresa: "Pet Z", whatsapp: "1188", cnpj: null },
      logistics: "frete_proprio",
      status: "em_analise",
      total_estimated: "1500.50",
      note: "urgente",
      created_at: "2026-08-30T12:00:00Z",
      balcao_request_items: [
        {
          product_id: "pz",
          product_reference: "SKU-Z",
          product_name_snapshot: "Ração Z",
          qty: 5,
          base_price_snapshot: "200.00",
          tier_min_qty_snapshot: 4,
          volume_discount_pct_snapshot: "12.5",
          logistics_discount_pct_snapshot: "5",
          unit_price_estimated: "166.25",
          line_total_estimated: "831.25",
        },
      ],
      balcao_request_events: [
        {
          actor: "admin-2",
          action: "em_analise",
          payload: { nota: "checando" },
          created_at: "2026-08-30T13:00:00Z",
        },
        { actor: null, action: "criada", payload: null, created_at: "2026-08-30T12:00:00Z" },
      ],
    };
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const supabase = { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;

    const detail = await getBalcaoRequestById(supabase, "req9");

    expect(eq).toHaveBeenCalledWith("id", "req9");
    expect(detail).toEqual({
      id: "req9",
      buyer: { nome: "Ciclana", empresa: "Pet Z", whatsapp: "1188", cnpj: null },
      logistics: "frete_proprio",
      status: "em_analise",
      totalEstimated: 1500.5,
      createdAt: "2026-08-30T12:00:00Z",
      note: "urgente",
      items: [
        {
          productId: "pz",
          productReference: "SKU-Z",
          productName: "Ração Z",
          qty: 5,
          basePrice: 200,
          tierMinQty: 4,
          volumeDiscountPct: 12.5,
          logisticsDiscountPct: 5,
          unitPrice: 166.25,
          lineTotal: 831.25,
        },
      ],
      events: [
        { actor: null, action: "criada", payload: null, createdAt: "2026-08-30T12:00:00Z" },
        {
          actor: "admin-2",
          action: "em_analise",
          payload: { nota: "checando" },
          createdAt: "2026-08-30T13:00:00Z",
        },
      ],
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
