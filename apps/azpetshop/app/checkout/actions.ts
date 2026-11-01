"use server";

import { checkoutOptions } from "@mypet/core/features";
import { getHubServiceClient } from "@mypet/core/supabase";
import { parseCep, parseCheckoutInput, parseCheckoutLines } from "@mypet/core/retail-checkout";
import { quoteCheckout, startCheckout, type CheckoutDeps } from "@mypet/core/retail-checkout-server";
import type { ShippingOption } from "@mypet/core/melhor-envio";
import { clientConfig } from "@/client.config";
import { checkoutEnv } from "@/lib/checkout-env";
import { RETAIL } from "@/lib/empresa";

const INDISPONIVEL = "Pagamento indisponível no momento. Tente novamente mais tarde.";

function deps(): CheckoutDeps | null {
  let env: ReturnType<typeof checkoutEnv>;
  try {
    env = checkoutEnv();
  } catch (e) {
    console.error("[checkout] configuração ausente:", e instanceof Error ? e.message : e);
    return null;
  }
  return {
    supabase: getHubServiceClient(),
    channel: clientConfig.catalogChannel,
    melhorEnvio: env.melhorEnvio,
    asaas: env.asaas,
    installments: RETAIL.installments,
    siteUrl: env.siteUrl,
  };
}

export async function cotarFrete(input: {
  items: unknown;
  cep: unknown;
}): Promise<{ ok: true; subtotal: number; options: ShippingOption[] } | { ok: false; error: string }> {
  if (!checkoutOptions(clientConfig.features).online) return { ok: false, error: INDISPONIVEL };
  const items = parseCheckoutLines(input.items);
  if (!items.ok) return items;
  const cep = parseCep(input.cep);
  if (!cep.ok) return cep;
  const d = deps();
  if (!d) return { ok: false, error: INDISPONIVEL };
  return quoteCheckout(d, { items: items.value, cep: cep.value });
}

export async function iniciarPagamento(input: unknown): Promise<{ ok: true; paymentUrl: string } | { ok: false; error: string }> {
  if (!checkoutOptions(clientConfig.features).online) return { ok: false, error: INDISPONIVEL };
  const parsed = parseCheckoutInput(input);
  if (!parsed.ok) return parsed;
  const d = deps();
  if (!d) return { ok: false, error: INDISPONIVEL };
  const result = await startCheckout(d, parsed.value);
  return result.ok ? { ok: true, paymentUrl: result.paymentUrl } : result;
}
