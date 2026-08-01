import type { SupabaseClient } from "@supabase/supabase-js";

export type Buyer = {
  id: string;
  email: string;
  nome: string;
  empresa: string;
  whatsapp: string;
  cnpj: string | null;
};

export async function getBuyerById(supabase: SupabaseClient, userId: string): Promise<Buyer | null> {
  const { data, error } = await supabase
    .from("buyers")
    .select("id, email, nome, empresa, whatsapp, cnpj")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as Buyer;
}

export type CreateBuyerInput = {
  id: string;
  email: string;
  nome: string;
  empresa: string;
  whatsapp: string;
  cnpj?: string;
};

export async function createBuyer(
  supabase: SupabaseClient,
  input: CreateBuyerInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("buyers").insert({
    id: input.id,
    email: input.email,
    nome: input.nome,
    empresa: input.empresa,
    whatsapp: input.whatsapp,
    cnpj: input.cnpj || null,
  });

  if (error) {
    console.error("[buyers] erro ao criar comprador:", error.message);
    return { error: "Não foi possível concluir seu cadastro. Tente novamente em instantes." };
  }

  return { error: null };
}
