import { createAgentHandler } from "@mypet/core/agent-server";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { commercialFaq } from "../../pre-access-content";

// Timeout total do modelo é 45s por provedor (agent-server.ts). Se o primeiro
// travar antes do primeiro trecho, só cai no fallback aos 45s; o segundo
// precisa dos seus 45s inteiros, mais folga para histórico e gravação.
export const maxDuration = 120;

export const POST = createAgentHandler({
  channel: clientConfig.catalogChannel,
  siteName: clientConfig.name,
  faq: commercialFaq,
  resolveBuyer: async () => {
    const buyer = await requireBuyer();
    return buyer ? { id: buyer.id, empresa: buyer.empresa } : null;
  },
});
