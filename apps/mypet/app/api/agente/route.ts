import { createAgentHandler } from "@mypet/core/agent-server";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { commercialFaq } from "../../pre-access-content";

// Timeout total do modelo é 45s (agent-server.ts); folga para histórico e gravação.
export const maxDuration = 60;

export const POST = createAgentHandler({
  channel: clientConfig.catalogChannel,
  siteName: clientConfig.name,
  faq: commercialFaq,
  resolveBuyer: async () => {
    const buyer = await requireBuyer();
    return buyer ? { id: buyer.id, empresa: buyer.empresa } : null;
  },
});
