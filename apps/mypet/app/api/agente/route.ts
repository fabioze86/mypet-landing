import { createAgentHandler } from "@mypet/core/agent-server";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { commercialFaq } from "../../pre-access-content";

export const POST = createAgentHandler({
  channel: clientConfig.catalogChannel,
  siteName: clientConfig.name,
  faq: commercialFaq,
  resolveBuyer: async () => {
    const buyer = await requireBuyer();
    return buyer ? { id: buyer.id, empresa: buyer.empresa } : null;
  },
});
