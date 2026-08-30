import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { provisionBuyer, PreAccessError } from "@mypet/core/pre-access-server";
import { signAccessToken, ACCESS_COOKIE, ACCESS_COOKIE_OPTS } from "@mypet/core/access-session";

const MESSAGES: Record<string, { status: number; message: string; field?: "cnpj" | "whatsapp" | "email" }> = {
  INVALID_INPUT: { status: 400, message: "Confira os dados informados e tente novamente." },
  INVALID_CNPJ: { status: 400, field: "cnpj", message: "Informe um CNPJ válido." },
  INVALID_WHATSAPP: { status: 400, field: "whatsapp", message: "Informe o WhatsApp com DDD e número." },
  INVALID_EMAIL: { status: 400, field: "email", message: "Informe um e-mail válido." },
  WHATSAPP_MISMATCH: {
    status: 400,
    field: "whatsapp",
    message: "Este WhatsApp não confere com o cadastro deste CNPJ.",
  },
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
    if (!(error instanceof PreAccessError)) {
      console.error("[pre-acesso] falha inesperada ao liberar acesso", error);
    }
    const code = error instanceof PreAccessError ? error.code : "UNAVAILABLE";
    const { status, message, field } = MESSAGES[code] ?? MESSAGES.UNAVAILABLE;
    return Response.json({ error: { code, message, ...(field ? { field } : {}) } }, { status });
  }
}
