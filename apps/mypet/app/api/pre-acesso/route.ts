import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { provisionBuyer, PreAccessError } from "@mypet/core/pre-access-server";
import { signAccessToken, ACCESS_COOKIE, ACCESS_COOKIE_OPTS } from "@mypet/core/access-session";

const MESSAGES: Record<string, { status: number; message: string }> = {
  INVALID_INPUT: { status: 400, message: "Confira os dados informados e tente novamente." },
  RATE_LIMITED: { status: 429, message: "Aguarde alguns instantes antes de tentar novamente." },
  UNAVAILABLE: {
    status: 503,
    message: "Não foi possível liberar seu acesso agora. Tente novamente em instantes.",
  },
};

function hashIp(header: string | null): string | null {
  const ip = header?.split(",")[0]?.trim();
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function serializeCookie(name: string, value: string, opts: typeof ACCESS_COOKIE_OPTS): string {
  return [
    `${name}=${value}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    `SameSite=${opts.sameSite === "lax" ? "Lax" : opts.sameSite}`,
    opts.httpOnly ? "HttpOnly" : "",
    opts.secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.json().catch(() => null);
  try {
    const { buyerId } = await provisionBuyer(body, {
      ipHash: hashIp(request.headers.get("x-forwarded-for")),
    });
    const res = Response.json({ ok: true }, { status: 201 });
    res.headers.append(
      "Set-Cookie",
      serializeCookie(ACCESS_COOKIE, signAccessToken(buyerId), ACCESS_COOKIE_OPTS),
    );
    return res;
  } catch (error) {
    const code = error instanceof PreAccessError ? error.code : "UNAVAILABLE";
    const { status, message } = MESSAGES[code] ?? MESSAGES.UNAVAILABLE;
    return Response.json({ error: { code, message } }, { status });
  }
}
