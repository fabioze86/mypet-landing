"use server";

import { getCatalogLineItems, type CatalogLineItemsResult } from "@mypet/core/catalog-line-items";
import type { Channel } from "@mypet/core/channels";
import { clientConfig } from "@/client.config";

export async function searchLineItems(params: {
  q?: string;
  brand?: string;
  page: number;
}): Promise<CatalogLineItemsResult> {
  return getCatalogLineItems({ ...params, channel: clientConfig.catalogChannel as Channel });
}
