import webpush from "web-push";
import { getHubServiceClient } from "./supabase";
import type { Channel } from "./channels";

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
