import { createOrdersPostHandler } from "@mypet/core/guest-orders-server";
import { clientConfig } from "@/client.config";

// Preço vem do catálogo (mypetbrasil); o pedido fica marcado como da
// distribuidora para não se misturar com os pedidos do app mypet.
export const POST = createOrdersPostHandler({
  orderChannel: "distribuidora",
  priceChannel: clientConfig.catalogChannel,
});
