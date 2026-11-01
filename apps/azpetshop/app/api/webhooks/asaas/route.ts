import { after } from "next/server";
import { getHubServiceClient } from "@mypet/core/supabase";
import { handleAsaasWebhook } from "@mypet/core/retail-webhook-server";
import { getRetailOrderById } from "@mypet/core/retail-orders-server";
import { webhookEnv } from "@/lib/checkout-env";
import { avisarPedidoPago, pedidoParaEmail, smtpMailer } from "@/lib/pedido-emails";

export async function POST(request: Request) {
  let env: ReturnType<typeof webhookEnv>;
  try {
    env = webhookEnv();
  } catch (err) {
    console.error("[asaas-webhook] configuração inválida:", (err as Error).message);
    return new Response("erro de configuração", { status: 500 });
  }
  const supabase = getHubServiceClient();
  const body = await request.json().catch(() => null);

  const result = await handleAsaasWebhook(
    {
      supabase,
      asaas: env.asaas,
      // Os e-mails saem depois da resposta, para o Asaas não esperar o SMTP.
      onPaid: async (orderId) => {
        after(async () => {
          try {
            const order = await getRetailOrderById(supabase, orderId);
            if (!order?.accessToken) return;
            await avisarPedidoPago(pedidoParaEmail(order, env.siteUrl, order.accessToken), smtpMailer(), env.equipeEmail);
          } catch (err) {
            console.error("[asaas-webhook] aviso de pedido pago falhou:", (err as Error).message);
          }
        });
      },
    },
    { token: request.headers.get("asaas-access-token"), body },
  );
  return new Response(result.body, { status: result.status });
}
