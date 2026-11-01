import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidWebhookToken, parseAsaasCheckoutEvent, type AsaasConfig } from "./asaas";
import { statusAfterCheckoutEvent } from "./retail-order-status";

export type WebhookResult = { status: number; body: string };
type Deps = { supabase: SupabaseClient; asaas: AsaasConfig; onPaid: (orderId: string) => Promise<void> };

const PAYMENT_STATUS: Record<string, string> = {
  CHECKOUT_PAID: "PAID",
  CHECKOUT_CANCELED: "CANCELED",
  CHECKOUT_EXPIRED: "EXPIRED",
};

export async function handleAsaasWebhook(deps: Deps, req: { token: string | null; body: unknown }): Promise<WebhookResult> {
  if (!isValidWebhookToken(deps.asaas, req.token)) return { status: 401, body: "token inválido" };
  const event = parseAsaasCheckoutEvent(req.body);
  if (!event || !PAYMENT_STATUS[event.event]) return { status: 200, body: "ignorado" };
  const { supabase } = deps;

  const { error: dupError } = await supabase
    .from("payment_webhook_events")
    .insert({ id: event.id, event: event.event, payload: req.body });
  if (dupError) {
    if (dupError.code === "23505") return { status: 200, body: "duplicado" };
    console.error("[asaas-webhook] evento não gravado:", dupError.message);
    return { status: 500, body: "erro" };
  }
  const releaseEvent = async () => {
    const { error } = await supabase.from("payment_webhook_events").delete().eq("id", event.id);
    if (error) console.error(`[asaas-webhook] evento ${event.id} NÃO liberado para reenvio:`, error.message);
  };
  const fail = async (msg: string, detail?: string) => {
    console.error(`[asaas-webhook] ${msg}`, detail ?? "");
    await releaseEvent();
    return { status: 500, body: "erro" };
  };

  try {
    const { data: payment, error: lookupError } = await supabase
      .from("order_payments")
      .select("order_id, orders(id, status)")
      .eq("asaas_checkout_id", event.checkoutId)
      .maybeSingle();
    if (lookupError) return fail("consulta do pagamento falhou:", lookupError.message);
    const order = (payment as { order_id: string; orders: { id: string; status: string } | null } | null)?.orders;
    if (!order) {
      if (event.event === "CHECKOUT_PAID") return fail("pagamento recebido sem pedido; Asaas deve reenviar:", event.checkoutId);
      console.error("[asaas-webhook] pedido não encontrado para o checkout", event.checkoutId);
      return { status: 200, body: "pedido não encontrado" };
    }

    const now = new Date().toISOString();
    let becamePaid = false;
    if (event.event === "CHECKOUT_PAID") {
      const { data, error } = await supabase.rpc("mark_order_paid", { p_order_id: order.id });
      if (error) return fail("pedido não marcado como pago:", error.message);
      becamePaid = data === true;
    } else {
      const next = statusAfterCheckoutEvent(order.status, event.event);
      if (next) {
        const { error } = await supabase
          .from("orders")
          .update({ status: next, updated_at: now })
          .eq("id", order.id)
          .eq("status", "aguardando_pagamento");
        if (error) return fail("pedido não atualizado:", error.message);
      }
    }

    const { error: payError } = await supabase
      .from("order_payments")
      .update({ status: PAYMENT_STATUS[event.event], last_event_id: event.id, last_event_payload: req.body, updated_at: now })
      .eq("asaas_checkout_id", event.checkoutId);
    if (payError) console.error("[asaas-webhook] pagamento não atualizado:", payError.message);

    if (becamePaid) {
      try {
        await deps.onPaid(order.id);
      } catch (err) {
        console.error("[asaas-webhook] aviso de pedido pago falhou:", (err as Error).message);
      }
    }
  return { status: 200, body: "ok" };
  } catch (err) {
    console.error("[asaas-webhook] exceção ao processar:", (err as Error).message);
    await releaseEvent();
    return { status: 500, body: "erro" };
  }
}
