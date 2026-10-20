import type { NextRequest } from "next/server";
import { expiredAccessCookie } from "@mypet/core/access-session";
import { rejectForeignRequest } from "@mypet/core/request-guards";

// Logout: apaga o cookie de acesso. Só do próprio site, para outro site não
// deslogar o cliente.
export async function POST(req: NextRequest): Promise<Response> {
  const foreign = rejectForeignRequest(req);
  if (foreign) return foreign;
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", expiredAccessCookie());
  return res;
}
