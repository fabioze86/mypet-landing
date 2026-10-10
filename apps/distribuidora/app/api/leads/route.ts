import { createIdentityLeadHandler } from "@mypet/core/identity-leads-server";
import type { Channel } from "@mypet/core/channels";
import { clientConfig } from "@/client.config";

// Pop-up de identificação (nome + WhatsApp, CNPJ opcional) grava em leads.
export const POST = createIdentityLeadHandler(clientConfig.catalogChannel as Channel);
