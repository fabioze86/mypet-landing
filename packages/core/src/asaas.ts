import { timingSafeEqual } from "node:crypto";

export type AsaasConfig = { baseUrl: string; apiKey: string; webhookToken: string };
export type CreateCheckoutInput = {
  orderNumber: number;
  total: number;
  maxInstallments: number;
  customer: { nome: string; cpf: string; email: string; whatsapp: string };
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
  minutesToExpire: number;
};
export type AsaasCheckoutEvent = { id: string; event: string; checkoutId: string };

// PNG 1x1 transparente: o schema do Asaas exige imageBase64 em cada item.
const ITEM_IMAGE =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const ERRO_PAGAMENTO = "Não foi possível iniciar o pagamento. Tente novamente.";

export async function createAsaasCheckout(
  cfg: AsaasConfig,
  input: CreateCheckoutInput,
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: true; checkoutId: string; link: string } | { ok: false; error: string }> {
  const parcelado = input.maxInstallments >= 2;
  const body = {
    billingTypes: ["PIX", "CREDIT_CARD"],
    chargeTypes: parcelado ? ["DETACHED", "INSTALLMENT"] : ["DETACHED"],
    ...(parcelado ? { installment: { maxInstallmentCount: Math.min(21, input.maxInstallments) } } : {}),
    minutesToExpire: input.minutesToExpire,
    externalReference: String(input.orderNumber),
    callback: { successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.expiredUrl },
    items: [{ name: `Pedido ${input.orderNumber}`, quantity: 1, value: input.total, imageBase64: ITEM_IMAGE }],
    customerData: {
      name: input.customer.nome,
      cpfCnpj: input.customer.cpf,
      email: input.customer.email,
      phone: input.customer.whatsapp.replace(/^55/, ""),
    },
  };

  try {
    const res = await fetchFn(`${cfg.baseUrl}/v3/checkouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", access_token: cfg.apiKey },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; link?: string };
    if (!res.ok || !data.id || !data.link) {
      console.error("[asaas] checkout não criado:", res.status, JSON.stringify(data).slice(0, 500));
      return { ok: false, error: ERRO_PAGAMENTO };
    }
    return { ok: true, checkoutId: data.id, link: data.link };
  } catch (err) {
    console.error("[asaas] falha:", (err as Error).message);
    return { ok: false, error: ERRO_PAGAMENTO };
  }
}

export function isValidWebhookToken(cfg: AsaasConfig, header: string | null): boolean {
  if (!cfg.webhookToken || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(cfg.webhookToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseAsaasCheckoutEvent(body: unknown): AsaasCheckoutEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { id?: unknown; event?: unknown; checkout?: { id?: unknown } };
  if (typeof b.id !== "string" || typeof b.event !== "string" || typeof b.checkout?.id !== "string") return null;
  return { id: b.id, event: b.event, checkoutId: b.checkout.id };
}
