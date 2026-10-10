import type { NextRequest } from "next/server";
import { getHubClient } from "./supabase";
import { rejectForeignRequest } from "./request-guards";
import { validateIdentity } from "./br-validation";
import type { Channel } from "./channels";

// Lead do pop-up de identificação da distribuidora: nome + WhatsApp, CNPJ opcional, sem empresa.
// O createLeadsPostHandler (pop-up "Fale com", mypet) continua separado e inalterado.
export function createIdentityLeadHandler(channel: Channel) {
  return async function POST(req: NextRequest): Promise<Response> {
    const rejected = rejectForeignRequest(req);
    if (rejected) return rejected;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const parsed = validateIdentity((body ?? {}) as Record<string, unknown>);
    if (!parsed.ok) return Response.json({ error: parsed.error, field: parsed.field }, { status: 400 });

    const { nome, whatsapp, cnpj } = parsed.value;
    const { error } = await getHubClient().from("leads").insert({ nome, empresa: null, whatsapp, cnpj, channel });
    if (error) {
      console.error("[identity-leads] erro ao gravar lead:", error.message);
      return Response.json({ error: "Não foi possível salvar seus dados agora." }, { status: 500 });
    }
    return Response.json({ ok: true });
  };
}
