import type { NextRequest } from "next/server";

// Rotas anônimas de escrita: só JSON e só do próprio site (bloqueia <form> cross-site text/plain).
export function rejectForeignRequest(req: NextRequest): Response | null {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Pedido inválido." }, { status: 415 });
  }
  const origin = req.headers.get("origin");
  if (origin !== null) {
    const host = req.headers.get("host") ?? req.nextUrl?.host;
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (!originHost || !host || originHost !== host) {
      return Response.json({ error: "Origem não permitida." }, { status: 403 });
    }
  }
  return null;
}
