"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { updateBalcaoRequestStatus } from "@mypet/core/balcao-server";

const AdvanceSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["em_analise", "aprovada", "recusada", "expirada"]),
  motivo: z.string().nullable(),
});

export async function advanceStatus(formData: FormData): Promise<void> {
  const { supabase, userId } = await requireAdminSession();
  const parsed = AdvanceSchema.safeParse({
    id: formData.get("id"),
    action: formData.get("action"),
    motivo: formData.get("motivo") ? String(formData.get("motivo")) : null,
  });
  if (!parsed.success) return;

  if (parsed.data.action === "recusada" && !parsed.data.motivo?.trim()) {
    redirect(`/balcao/solicitacoes/${parsed.data.id}?error=motivo_obrigatorio`);
  }

  const { error } = await updateBalcaoRequestStatus(supabase, {
    id: parsed.data.id,
    actorId: userId,
    action: parsed.data.action,
    payload: parsed.data.motivo?.trim() ? { motivo: parsed.data.motivo.trim() } : undefined,
  });
  if (error) {
    redirect(`/balcao/solicitacoes/${parsed.data.id}?error=falha`);
  }
  redirect(`/balcao/solicitacoes/${parsed.data.id}`);
}

const AdjustSchema = z.object({
  id: z.string().uuid(),
  justificativa: z.string().min(1),
  ajustes: z.string().min(1),
});

export async function adjustRequest(formData: FormData): Promise<void> {
  const { supabase, userId } = await requireAdminSession();
  const parsed = AdjustSchema.safeParse({
    id: formData.get("id"),
    justificativa: String(formData.get("justificativa") ?? "").trim(),
    ajustes: String(formData.get("ajustes") ?? "").trim(),
  });
  if (!parsed.success) {
    redirect(`/balcao/solicitacoes/${formData.get("id")}?error=justificativa_obrigatoria`);
  }

  const { error } = await updateBalcaoRequestStatus(supabase, {
    id: parsed.data.id,
    actorId: userId,
    action: "ajustada",
    payload: { justificativa: parsed.data.justificativa, ajustes: parsed.data.ajustes },
  });
  if (error) {
    redirect(`/balcao/solicitacoes/${parsed.data.id}?error=falha`);
  }
  redirect(`/balcao/solicitacoes/${parsed.data.id}`);
}
