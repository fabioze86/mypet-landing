import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import {
  mapVariant,
  formatPrice,
  pageRange,
  salePriceFromChannelPrices,
  totalPages,
  mainImage,
  PLACEHOLDER_IMAGE,
  type RawVariantRow,
  type VariantAxisEntry,
  type ProductVariant,
} from "./catalog-utils";

const LINE_ITEM_PRODUCT_SELECT =
  "id, name, reference, brand, product_role, product_assets(url, type), product_channel_prices(channel, sale_price, sale_updated_at)";

type RawLineItemProductRow = {
  id: string;
  name: string;
  reference: string | null;
  brand: string | null;
  product_role: "simple" | "parent" | "variant";
  product_assets: { url: string; type: string }[] | null;
  product_channel_prices: { channel: string | null; sale_price: number | string | null }[] | null;
};

export type CatalogLineItem = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  unitPrice: number | null;
  priceLabel: string | null;
  variantLabel: string | null;
};

export type CatalogLineItemsResult = {
  items: CatalogLineItem[];
  total: number;
  page: number;
  totalPages: number;
};

// `.or()` do PostgREST usa vírgula e parênteses como caracteres estruturais
// do filtro — escapa esses caracteres em `q` para que um valor de busca com
// vírgula/parênteses não quebre a sintaxe do filtro (mesmo nível de cuidado
// que os `.ilike()` já existentes neste arquivo, que não escapam nada porque
// `%`/`_` não quebram estrutura, só o resultado do match).
export function escapeOrFilterValue(value: string): string {
  return value.replace(/[,()]/g, (c) => `\\${c}`);
}

function lineItemVariantLabel(axis: VariantAxisEntry[], sku: string, fallbackIndex: number): string {
  const label = axis.map((a) => a.valor).join(" / ");
  const isJustReference = label.trim().toLowerCase() === sku.trim().toLowerCase();
  if (label && !isJustReference) return label;
  return `N.${fallbackIndex + 1}`;
}

async function fetchVariantsByParentIds(
  parentIds: string[],
  channel: string,
): Promise<Map<string, ProductVariant[]>> {
  const map = new Map<string, ProductVariant[]>();
  if (parentIds.length === 0) return map;

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, reference, barcode, parent_product_id, variant_axis, product_assets(url, type), product_channel_prices(channel, sale_price, sale_updated_at), product_channel_links!inner(channel)",
    )
    .in("parent_product_id", parentIds)
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel)
    .order("name", { ascending: true });

  if (error) {
    console.error("[catalog-line-items] erro ao buscar variantes:", error.message);
    return map;
  }

  for (const row of (data as unknown as (RawVariantRow & { parent_product_id: string })[]) ?? []) {
    const variant = mapVariant(row);
    const list = map.get(row.parent_product_id) ?? [];
    list.push(variant);
    map.set(row.parent_product_id, list);
  }
  return map;
}

export async function queryCatalogLineItems(params: {
  q?: string;
  brand?: string;
  categoryId?: string | string[];
  page: number;
  channel: string;
}): Promise<CatalogLineItemsResult> {
  const { q, brand, categoryId, page, channel } = params;
  const supabase = getHubClient();
  const { from, to } = pageRange(page);

  let query = supabase
    .from("products")
    .select(`${LINE_ITEM_PRODUCT_SELECT}, product_channel_links!inner(channel)`, { count: "exact" })
    .eq("status", "active")
    .neq("product_role", "variant")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel)
    .order("name", { ascending: true });

  if (q) {
    const safeQ = escapeOrFilterValue(q);
    query = query.or(`name.ilike.%${safeQ}%,reference.ilike.%${safeQ}%`);
  }
  if (brand) query = query.eq("brand", brand);
  if (Array.isArray(categoryId)) {
    if (categoryId.length > 0) query = query.in("category_id", categoryId);
  } else if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error("[catalog-line-items] erro ao consultar produtos:", error.message);
    return { items: [], total: 0, page, totalPages: 1 };
  }

  const rows = (data as unknown as RawLineItemProductRow[]) ?? [];
  const parentIds = rows.filter((r) => r.product_role === "parent").map((r) => r.id);
  const variantsByParent = await fetchVariantsByParentIds(parentIds, channel);

  const items: CatalogLineItem[] = [];
  for (const row of rows) {
    if (row.product_role === "parent") {
      const variants = variantsByParent.get(row.id) ?? [];
      const parentImg = mainImage(row.product_assets);
      variants.forEach((variant, index) => {
        items.push({
          id: variant.id,
          name: row.name,
          sku: variant.sku,
          brand: row.brand,
          img: variant.img !== PLACEHOLDER_IMAGE ? variant.img : parentImg,
          unitPrice: variant.salePrice,
          priceLabel: variant.priceLabel,
          variantLabel: lineItemVariantLabel(variant.axis, variant.sku, index),
        });
      });
    } else {
      const salePrice = salePriceFromChannelPrices(row.product_channel_prices);
      items.push({
        id: row.id,
        name: row.name,
        sku: row.reference ?? "",
        brand: row.brand,
        img: mainImage(row.product_assets),
        unitPrice: salePrice,
        priceLabel: formatPrice(salePrice),
        variantLabel: null,
      });
    }
  }

  const total = count ?? 0;
  return { items, total, page, totalPages: totalPages(total) };
}

export async function getCatalogLineItems(params: {
  q?: string;
  brand?: string;
  categoryId?: string | string[];
  page: number;
  channel: string;
}): Promise<CatalogLineItemsResult> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  return queryCatalogLineItems(params);
}
