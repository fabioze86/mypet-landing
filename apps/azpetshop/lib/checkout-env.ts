import type { AsaasConfig } from "@mypet/core/asaas";
import type { MelhorEnvioConfig } from "@mypet/core/melhor-envio";
import { clientConfig } from "@/client.config";
import { EMPRESA } from "@/lib/empresa";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

export function checkoutEnv(): { asaas: AsaasConfig; melhorEnvio: MelhorEnvioConfig; siteUrl: string; equipeEmail: string } {
  return {
    asaas: {
      baseUrl: process.env.ASAAS_BASE_URL ?? "https://api-sandbox.asaas.com",
      apiKey: required("ASAAS_API_KEY"),
      webhookToken: required("ASAAS_WEBHOOK_TOKEN"),
    },
    melhorEnvio: {
      baseUrl: process.env.MELHOR_ENVIO_BASE_URL ?? "https://sandbox.melhorenvio.com.br",
      token: required("MELHOR_ENVIO_TOKEN"),
      userAgent: `${EMPRESA.nomeFantasia} (${EMPRESA.email})`,
      fromCep: required("LOJA_CEP_ORIGEM"),
    },
    siteUrl: process.env.SITE_URL ?? `https://${clientConfig.domain}`,
    equipeEmail: required("PEDIDOS_EMAIL_EQUIPE"),
  };
}

/** Só o que o webhook do Asaas precisa (não exige credenciais de frete). */
export function webhookEnv(): { asaas: AsaasConfig; siteUrl: string; equipeEmail: string } {
  return {
    asaas: {
      baseUrl: process.env.ASAAS_BASE_URL ?? "https://api-sandbox.asaas.com",
      apiKey: required("ASAAS_API_KEY"),
      webhookToken: required("ASAAS_WEBHOOK_TOKEN"),
    },
    siteUrl: process.env.SITE_URL ?? `https://${clientConfig.domain}`,
    equipeEmail: required("PEDIDOS_EMAIL_EQUIPE"),
  };
}
