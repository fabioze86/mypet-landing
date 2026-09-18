"use server";

import { getCatalogLineItems, type CatalogLineItemsResult } from "@mypet/core/catalog-line-items";
import type { Channel } from "@mypet/core/channels";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";

export async function searchLineItems(params: {
  q?: string;
  brand?: string;
  page: number;
}): Promise<CatalogLineItemsResult> {
  const buyer = await requireBuyer();
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  if (!buyer) {
    return { items: [], total: 0, page, totalPages: 1 };
  }
  return getCatalogLineItems({ ...params, page, channel: clientConfig.catalogChannel as Channel });
}
