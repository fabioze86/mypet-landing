import { createSupportAssistantHandler } from "@mypet/core/support-assistant-server";
import { clientConfig } from "@/client.config";
import { commercialFaq } from "../../pre-access-content";

export const POST = createSupportAssistantHandler({
  channel: clientConfig.catalogChannel,
  siteName: clientConfig.name,
  faq: commercialFaq,
});
