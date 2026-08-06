import { NextRequest } from "next/server";
import { getHubClient } from "./supabase";
import type { Channel } from "./channels";

const MAX_ENDPOINT_LENGTH = 512;
const MAX_KEY_LENGTH = 200;

const ALLOWED_PUSH_HOSTS = [
  /\.googleapis\.com$/,
  /\.push\.services\.mozilla\.com$/,
  /\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
];

function isValidEndpoint(endpoint: unknown): endpoint is string {
  if (
    typeof endpoint !== "string" ||
    endpoint.length === 0 ||
    endpoint.length > MAX_ENDPOINT_LENGTH
  ) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return ALLOWED_PUSH_HOSTS.some((pattern) => pattern.test(url.hostname));
}

function isValidKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_KEY_LENGTH;
}

export function createPushSubscribePostHandler(channel: Channel) {
  return async function POST(req: NextRequest): Promise<Response> {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Corpo da requisição inválido" }, { status: 400 });
    }

    const endpoint = (body as { endpoint?: unknown })?.endpoint;
    const keys = (body as { keys?: { p256dh?: unknown; auth?: unknown } })?.keys;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    if (!isValidEndpoint(endpoint) || !isValidKey(p256dh) || !isValidKey(auth)) {
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
