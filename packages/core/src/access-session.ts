import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "mypet_acesso";
export const ACCESS_MAX_AGE_MS = 2_592_000_000; // 30 dias
export const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: 2_592_000, // segundos
} as const;

type Payload = { b: string; exp: number };

function secret(): string {
  const value = process.env.ACCESS_SESSION_SECRET;
  if (!value) {
    throw new Error("ACCESS_SESSION_SECRET precisa estar definido no ambiente.");
  }
  return value;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function signAccessToken(buyerId: string, now: number = Date.now()): string {
  const payload: Payload = { b: buyerId, exp: now + ACCESS_MAX_AGE_MS };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyAccessToken(
  token: string | undefined | null,
  now: number = Date.now(),
): { buyerId: string } | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, mac] = parts;

  let expected: Buffer;
  let received: Buffer;
  try {
    expected = Buffer.from(sign(body), "base64url");
    received = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    if (typeof payload.b !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp <= now) return null;
    return { buyerId: payload.b };
  } catch {
    return null;
  }
}
