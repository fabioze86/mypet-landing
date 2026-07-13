import { createAssistantHandler } from "@mypet/core/assistant-server";
import { clientConfig } from "@/client.config";

export const POST = createAssistantHandler(clientConfig.catalogChannel);
