import { after } from "next/server";
import { getHubServiceClient } from "@mypet/core/supabase";
import { localizarComprador, type Buyer } from "@mypet/core/buyers-server";

// Dispara a consulta de CNPJ depois da resposta, sem segurar a página.
export function agendarLocalizacao(buyer: Pick<Buyer, "id" | "cnpj" | "localizacao_status">): void {
  if (buyer.localizacao_status) return;
  after(() => localizarComprador(getHubServiceClient(), buyer));
}
