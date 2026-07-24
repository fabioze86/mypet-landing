"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { LEAD_STATUSES } from "@/lib/leads";

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(LEAD_STATUSES),
});

export async function updateLeadStatus(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = UpdateStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) return;

  const { error } = await supabase
    .from("leads")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("[admin/clientes] erro ao atualizar status:", error.message);
    return;
  }

  revalidatePath("/clientes");
}
