"use server";

import { getCatalogLineItems, type CatalogLineItemsResult } from "@mypet/core/catalog-line-items";
import { getCategories } from "@mypet/core/catalog";
import { collectCategorySubtreeIds } from "@mypet/core/catalog-utils";
import type { Channel } from "@mypet/core/channels";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";

export async function searchLineItems(params: {
  q?: string;
  brand?: string;
  categoryId?: string;
  page: number;
}): Promise<CatalogLineItemsResult> {
  const buyer = await requireBuyer();
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  if (!buyer) {
    return { items: [], total: 0, page, totalPages: 1 };
  }

  let categoryId: string[] | undefined;
  if (params.categoryId) {
    const categories = await getCategories();
    categoryId = collectCategorySubtreeIds(categories, params.categoryId);
  }

  return getCatalogLineItems({
    q: params.q,
    brand: params.brand,
    categoryId,
    page,
    channel: clientConfig.catalogChannel as Channel,
  });
}
