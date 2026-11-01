export type ListmonkConfig = { baseUrl: string; apiUser: string; apiToken: string };

/** E-mail transacional pelo Listmonk (POST /api/tx). Devolve false em qualquer falha. */
export async function sendListmonkTx(
  cfg: ListmonkConfig,
  msg: { templateId: number; email: string; data: Record<string, unknown> },
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchFn(`${cfg.baseUrl.replace(/\/$/, "")}/api/tx`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `token ${cfg.apiUser}:${cfg.apiToken}` },
      // "external": o cliente do varejo não é assinante do Listmonk (exige Listmonk >= 5;
      // versões antigas exigem que o assinante já exista).
      body: JSON.stringify({
        subscriber_email: msg.email,
        template_id: msg.templateId,
        data: msg.data,
        content_type: "html",
        subscriber_mode: "external",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[listmonk] HTTP", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (err) {
    console.error("[listmonk] falha:", (err as Error).message);
    return false;
  }
}
