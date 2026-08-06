import { NextRequest } from "next/server";
import { getHubClient } from "./supabase";
import type { Channel } from "./channels";

export function createPushSubscribePostHandler(channel: Channel) {
  return async function POST(req: NextRequest): Promise<Response> {
    const body = await req.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return Response.json({ error: "Inscrição inválida" }, { status: 400 });
    }

    const supabase = getHubClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({ channel, endpoint, p256dh, auth }, { onConflict: "endpoint" });

    if (error) {
      console.error("[push] erro ao gravar subscription:", error.message);
      return Response.json(
        { error: "Não foi possível registrar a inscrição." },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  };
}
