import { getHubServiceClient } from "@mypet/core/supabase";
import { handleAsaasWebhook } from "@mypet/core/retail-webhook-server";
import { getRetailOrder } from "@mypet/core/retail-orders-server";
import { checkoutEnv } from "@/lib/checkout-env";
import { avisarPedidoPago, pedidoParaEmail, smtpMailer } from "@/lib/pedido-emails";

export async function POST(request: Request) {
  const env = checkoutEnv();
  const supabase = getHubServiceClient();
  const body = await request.json().catch(() => null);

  const result = await handleAsaasWebhook(
    {
      supabase,
      asaas: env.asaas,
      onPaid: async (orderId) => {
        const order = await getRetailOrder(supabase, orderId);
        const { data } = await supabase.from("orders").select("access_token").eq("id", orderId).maybeSingle();
        if (!order || !data?.access_token) return;
        await avisarPedidoPago(pedidoParaEmail(order, env.siteUrl, data.access_token as string), smtpMailer(), env.equipeEmail);
      },
    },
    { token: request.headers.get("asaas-access-token"), body },
  );
  return new Response(result.body, { status: result.status });
}
