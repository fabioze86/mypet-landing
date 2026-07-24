import { NextRequest } from "next/server";
import { getHubClient } from "./supabase";
import type { Channel } from "./channels";

export function createLeadsPostHandler(channel: Channel) {
  return async function POST(req: NextRequest): Promise<Response> {
    const { nome, empresa, whatsapp, cnpj } = await req.json();

    if (!nome || !empresa || !whatsapp) {
      return Response.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const supabase = getHubClient();
    const { error } = await supabase.from("leads").insert({
      nome,
      empresa,
      whatsapp,
      cnpj: cnpj || null,
      channel,
    });

    if (error) {
      console.error("[leads] erro ao gravar lead:", error.message);
      return Response.json(
        { error: "Não foi possível salvar seu cadastro. Tente novamente em instantes." },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  };
}
