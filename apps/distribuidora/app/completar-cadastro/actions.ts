"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@mypet/core/supabase-server";
import { createBuyer } from "@mypet/core/buyers-server";

export async function completeSignup(next: string, formData: FormData): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: "Sessão expirada. Peça um novo link de acesso." };
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const empresa = String(formData.get("empresa") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").trim();

  if (!nome || !empresa || !whatsapp) {
    return { error: "Preencha nome, empresa e WhatsApp." };
  }

  const { error } = await createBuyer(supabase, {
    id: user.id,
    email: user.email,
    nome,
    empresa,
    whatsapp,
    cnpj: cnpj || undefined,
  });

  if (error) return { error };

  redirect(next);
}
