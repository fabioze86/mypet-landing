"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/orders";

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
