"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminSession, type AdminSession } from "@/lib/auth";
import { sendListmonkTx } from "@mypet/core/listmonk";
import { ORDER_STATUSES, listmonkEnv } from "@/lib/orders";

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
});

export async function updateOrderStatus(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = UpdateStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) return;

  const { error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("[admin/pedidos] erro ao atualizar status:", error.message);
    return;
  }

  revalidatePath("/pedidos");
}

const shippedSchema = z.object({ orderId: z.string().uuid(), trackingCode: z.string().trim().min(4).max(60) });

/**
 * E-mail "pedido enviado" pelo Listmonk. Chaves do template (`{{ .Tx.Data.<chave> }}`):
 * numero, nome, rastreio, transportadora, link_pedido.
 * Falha ou Listmonk não configurado só registram log; nunca desfazem o envio.
 */
async function notifyOrderShipped(supabase: AdminSession["supabase"], orderId: string, trackingCode: string) {
  const env = listmonkEnv();
  if (!env) return console.error("[admin/pedidos] Listmonk não configurado; e-mail de envio não enviado.");
  const { data } = await supabase
    .from("orders")
    .select("number, customer_name, customer_email, access_token, order_shipping(service_name)")
    .eq("id", orderId)
    .maybeSingle();
  const o = data as unknown as { number: number; customer_name: string; customer_email: string | null; access_token: string | null; order_shipping: { service_name: string } | null } | null;
  if (!o?.customer_email || !o.access_token) return;
  await sendListmonkTx(env, {
    templateId: env.templateId,
    email: o.customer_email,
    data: {
      numero: o.number,
      nome: o.customer_name,
      rastreio: trackingCode,
      transportadora: o.order_shipping?.service_name ?? "",
      link_pedido: `${env.siteUrl}/pedido/${orderId}?t=${o.access_token}`,
    },
  });
}

export async function markOrderShipped(formData: FormData): Promise<void> {
  const parsed = shippedSchema.safeParse({ orderId: formData.get("orderId"), trackingCode: formData.get("trackingCode") });
  if (!parsed.success) return;
  const { supabase } = await requireAdminSession();
  const now = new Date().toISOString();
  const { error: shipError } = await supabase
    .from("order_shipping")
    .update({ tracking_code: parsed.data.trackingCode, shipped_at: now })
    .eq("order_id", parsed.data.orderId);
  if (shipError) {
    console.error("[admin/pedidos] erro ao gravar rastreio:", shipError.message);
    return;
  }
  const { error } = await supabase.from("orders").update({ status: "enviado", updated_at: now }).eq("id", parsed.data.orderId);
  if (error) {
    console.error("[admin/pedidos] erro ao marcar enviado:", error.message);
  } else {
    try {
      await notifyOrderShipped(supabase, parsed.data.orderId, parsed.data.trackingCode);
    } catch (err) {
      console.error("[admin/pedidos] erro ao avisar envio:", (err as Error).message);
    }
  }
  revalidatePath("/pedidos");
}
