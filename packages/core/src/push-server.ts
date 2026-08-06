import { NextRequest } from "next/server";
import webpush from "web-push";
import { getHubClient, getHubServiceClient } from "./supabase";
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

type PushPayload = { title: string; body: string; url?: string };

function getVapidDetails() {
  const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.PUSH_VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY e PUSH_VAPID_SUBJECT precisam estar definidos no ambiente.",
    );
  }
  return { publicKey, privateKey, subject };
}

export async function sendPushBroadcast(
  channel: Channel,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  const { publicKey, privateKey, subject } = getVapidDetails();
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = getHubServiceClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("channel", channel);

  if (error) {
    throw new Error(`Não foi possível buscar as inscrições: ${error.message}`);
  }

  let sent = 0;
  let removed = 0;

  for (const row of data ?? []) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", row.id);
        removed++;
      } else {
        console.error("[push] erro ao enviar notificação:", err);
      }
    }
  }

  return { sent, removed };
}
