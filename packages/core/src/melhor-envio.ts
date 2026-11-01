import type { ShippingPackage } from "./shipping-package";

export type MelhorEnvioConfig = { baseUrl: string; token: string; userAgent: string; fromCep: string };
export type ShippingOption = { serviceId: number; name: string; company: string; price: number; deliveryDays: number | null };

type RawOption = {
  id: number;
  name?: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  company?: { name?: string };
  error?: string;
};

const ERRO_COTACAO = "Não conseguimos calcular o frete agora. Tente novamente.";

export async function quoteShipping(
  cfg: MelhorEnvioConfig,
  input: { toCep: string; pkg: ShippingPackage; insuranceValue: number },
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: true; options: ShippingOption[] } | { ok: false; error: string }> {
  let raw: RawOption[];
  try {
    const res = await fetchFn(`${cfg.baseUrl}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
        "User-Agent": cfg.userAgent,
      },
      body: JSON.stringify({
        from: { postal_code: cfg.fromCep },
        to: { postal_code: input.toCep },
        package: { width: input.pkg.widthCm, height: input.pkg.heightCm, length: input.pkg.lengthCm, weight: input.pkg.weightKg },
        options: { insurance_value: input.insuranceValue, receipt: false, own_hand: false },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[melhor-envio] HTTP", res.status);
      return { ok: false, error: ERRO_COTACAO };
    }
    raw = (await res.json()) as RawOption[];
  } catch (err) {
    console.error("[melhor-envio] falha:", (err as Error).message);
    return { ok: false, error: ERRO_COTACAO };
  }

  // Vazio, nulo ou não numérico conta como ausente (Number("") seria 0 = frete grátis falso).
  const parsePrice = (v: unknown): number | null => {
    if (typeof v !== "string" && typeof v !== "number") return null;
    if (typeof v === "string" && v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const options = (Array.isArray(raw) ? raw : [])
    .filter((o) => !o.error)
    .map((o) => ({
      serviceId: o.id,
      name: o.name ?? "Entrega",
      company: o.company?.name ?? "",
      price: parsePrice(o.custom_price) ?? parsePrice(o.price),
      deliveryDays: o.custom_delivery_time ?? o.delivery_time ?? null,
    }))
    .filter((o): o is ShippingOption => o.price !== null && o.price > 0)
    .sort((a, b) => a.price - b.price);

  if (options.length === 0) return { ok: false, error: "Não há opção de entrega para este CEP." };
  return { ok: true, options };
}
