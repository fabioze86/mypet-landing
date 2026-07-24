import { createLeadsPostHandler } from "@mypet/core/leads-server";
import type { Channel } from "@mypet/core/channels";
import { clientConfig } from "@/client.config";

export const POST = createLeadsPostHandler(clientConfig.catalogChannel as Channel);

