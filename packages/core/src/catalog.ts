import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import {
  mapProduct,
  pageRange,
  totalPages,
  mainImage,
  pickActiveBadge,
  type CatalogResult,
  type RawProductRow,
  type CategoryNode,
} from "./catalog-utils";

export const CATALOG_SELECT =
  "id, name, reference, brand, category_id, categories(id, name, slug), product_assets(url, type), product_badges(code, label, kind, priority, starts_at, ends_at)";

export async function queryCatalog(params: {
  q?: string;
  brand?: string;
  categoryId?: string | string[];
  page: number;
  channel: string;
}): Promise<CatalogResult> {
  const { q, brand, categoryId, page, channel } = params;
  const supabase = getHubClient();
  const { from, to } = pageRange(page);

  let query = supabase
    .from("products")
    .select(`${CATALOG_SELECT}, product_channel_links!inner(channel)`, { count: "exact" })
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
    .order("name", { ascending: true });

  if (q) query = query.ilike("name", `%${q}%`);
  if (brand) query = query.eq("brand", brand);
  if (Array.isArray(categoryId)) {
    if (categoryId.length > 0) query = query.in("category_id", categoryId);
  } else if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error("[catalog] erro ao consultar produtos:", error.message);
    return { items: [], total: 0, page, totalPages: 1 };
  }

  const items = ((data as unknown as RawProductRow[]) ?? []).map((row) => mapProduct(row));
  const total = count ?? 0;
  return { items, total, page, totalPages: totalPages(total) };
}

export async function getCatalog(params: {
  q?: string;
  brand?: string;
  categoryId?: string | string[];
  page: number;
  channel: string;
}): Promise<CatalogResult> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  return queryCatalog(params);
}

export async function getBrands(channel: string): Promise<string[]> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select("brand, product_channel_links!inner(channel)")
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
    .not("brand", "is", null);
  if (error) {
    console.error("[catalog] erro ao consultar marcas:", error.message);
    return [];
  }
  const set = new Set<string>();
  for (const r of (data as { brand: string | null }[]) ?? []) {
    if (r.brand) set.add(r.brand);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function getProductCount(channel: string): Promise<number> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { count, error } = await supabase
    .from("products")
    .select("id, product_channel_links!inner(channel)", { count: "exact", head: true })
    .eq("status", "active")
    .eq("product_channel_links.channel", channel);
  if (error) {
    console.error("[catalog] erro ao contar produtos:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getProductById(id: string, channel: string) {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, reference, brand, description, barcode, weight_kg, width_cm, height_cm, length_cm, product_assets(url, type), product_badges(code, label, kind, priority, starts_at, ends_at), product_channel_links!inner(channel)"
    )
    .eq("id", id)
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
    .single();

  if (error || !data) {
    console.error("[catalog] erro ao buscar produto por id:", error?.message);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    sku: data.reference ?? "",
    brand: data.brand,
    description: data.description,
    barcode: data.barcode,
    weight_kg: data.weight_kg,
    width_cm: data.width_cm,
    height_cm: data.height_cm,
    length_cm: data.length_cm,
    img: mainImage(data.product_assets),
    badge: pickActiveBadge(data.product_badges),
  };
}

export async function getCategories(): Promise<CategoryNode[]> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, slug, name, level")
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[catalog] erro ao consultar categorias:", error.message);
    return [];
  }

  return (
    (data as { id: string; parent_id: string | null; slug: string; name: string; level: number | null }[]) ?? []
  ).map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    slug: row.slug,
    name: row.name,
    level: row.level,
  }));
}
