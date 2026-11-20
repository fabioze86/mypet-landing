import type { SupabaseClient } from "@supabase/supabase-js";
import { consultarCnpj } from "./receitaws";

export type LocalizacaoStatus = "localizado" | "nao_localizado" | null;

export type Buyer = {
  id: string;
  email: string | null;
  nome: string | null;
  empresa: string | null;
  whatsapp: string;
  cnpj: string | null;
  uf: string | null;
  municipio: string | null;
  cep: string | null;
  localizacao_status: LocalizacaoStatus;
};

const BUYER_COLUMNS = "id, email, nome, empresa, whatsapp, cnpj, uf, municipio, cep, localizacao_status";

export async function getBuyerById(supabase: SupabaseClient, userId: string): Promise<Buyer | null> {
  const { data, error } = await supabase.from("buyers").select(BUYER_COLUMNS).eq("id", userId).single();
  if (error || !data) return null;
  return data as Buyer;
}

// Consulta a ReceitaWS e grava a localização do comprador. Nunca lança:
// indisponível (429, queda, timeout) não grava nada e fica para o próximo acesso.
export async function localizarComprador(
  supabase: SupabaseClient,
  buyer: Pick<Buyer, "id" | "cnpj" | "localizacao_status">,
  fetchImpl?: typeof fetch,
): Promise<void> {
  if (buyer.localizacao_status) return;
  try {
    const consulta = buyer.cnpj ? await consultarCnpj(buyer.cnpj, fetchImpl) : ({ kind: "nao_localizado" } as const);
    if (consulta.kind === "indisponivel") return;
    const agora = new Date().toISOString();
    const row =
      consulta.kind === "localizado"
        ? { uf: consulta.uf, municipio: consulta.municipio, cep: consulta.cep, localizacao_status: "localizado", localizado_em: agora }
        : { localizacao_status: "nao_localizado", localizado_em: agora };
    const { error } = await supabase.from("buyers").update(row).eq("id", buyer.id);
    if (error) console.error("[buyers] falha ao gravar localização:", error.message);
  } catch (error) {
    console.error("[buyers] falha ao localizar comprador:", error);
  }
}

export type CreateBuyerInput = {
  id: string;
  email?: string | null;
  nome?: string | null;
  empresa?: string | null;
  whatsapp: string;
  cnpj?: string | null;
};

export async function createBuyer(
  supabase: SupabaseClient,
  input: CreateBuyerInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("buyers").insert({
    id: input.id,
    email: input.email ?? null,
    nome: input.nome ?? null,
    empresa: input.empresa ?? null,
    whatsapp: input.whatsapp,
    cnpj: input.cnpj ?? null,
  });

  if (error) {
    console.error("[buyers] erro ao criar comprador:", error.message);
    return { error: "Não foi possível concluir seu cadastro. Tente novamente em instantes." };
  }

  return { error: null };
}
