import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import {
  mapProduct,
  mapVariant,
  formatPrice,
  pageRange,
  salePriceFromChannelPrices,
  channelUsesErpPrice,
  applyErpPrice,
  totalPages,
  mainImage,
  pickActiveBadge,
  filterCategoriesWithProducts,
  type CatalogResult,
  type RawProductRow,
  type RawVariantRow,
  type ProductVariant,
  type VariantAxisEntry,
  type CategoryNode,
  type RawCategory,
} from "./catalog-utils";

export const CATALOG_SELECT =
  "id, name, reference, brand, category_id, categories(id, name, slug), product_assets(url, type), product_badges(code, label, kind, priority, starts_at, ends_at), product_channel_prices(channel, sale_price, sale_updated_at)";

/**
 * Preços do espelho do Bling (view `v_precos_erp`, indexada por referência).
 * Usado nos canais listados em `ERP_PRICE_CHANNELS` (ver catalog-utils), onde o
 * ERP é a fonte única de preço. Retorna mapa `referência -> preço`.
 */
async function fetchErpPrices(references: (string | null | undefined)[]): Promise<Map<string, number>> {
  const unique = [...new Set(references.filter((r): r is string => !!r))];
  if (unique.length === 0) return new Map();

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("v_precos_erp")
    .select("reference, preco")
    .in("reference", unique);

  if (error) {
    console.error("[catalog] erro ao consultar preços do ERP:", error.message);
    return new Map();
  }

  const map = new Map<string, number>();
  for (const row of (data as { reference: string | null; preco: number | string | null }[]) ?? []) {
    if (!row.reference || row.preco === null || row.preco === undefined) continue;
    const value = typeof row.preco === "number" ? row.preco : Number(row.preco);
    if (Number.isFinite(value)) map.set(row.reference, value);
  }
  return map;
}

type RawCatalogVariantPriceRow = {
  parent_product_id: string | null;
  reference: string | null;
  product_channel_prices: { sale_price: number | string | null }[] | null;
};

/**
 * Produtos-pai não têm necessariamente preço próprio. Para a listagem, eles
 * representam as variações pelo menor preço disponível ("A partir de").
 */
async function applyStartingVariantPrices(items: CatalogResult["items"], channel: string) {
  if (items.length === 0) return items;

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select("parent_product_id, reference, product_channel_prices(sale_price), product_channel_links!inner(channel)")
    .eq("status", "active")
    .eq("product_role", "variant")
    .in("parent_product_id", items.map((item) => item.id))
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel);

  if (error || !data) {
    if (error) console.error("[catalog] erro ao buscar preços das variações:", error.message);
    return items;
  }

  const variants = data as unknown as RawCatalogVariantPriceRow[];
  const erpPrices = channelUsesErpPrice(channel)
    ? await fetchErpPrices(variants.map((variant) => variant.reference))
    : null;
  const lowestPriceByParent = new Map<string, number>();

  for (const variant of variants) {
    if (!variant.parent_product_id) continue;
    const rawPrice = erpPrices
      ? (variant.reference ? erpPrices.get(variant.reference) : null)
      : (() => {
          const raw = variant.product_channel_prices?.find((price) => price.sale_price != null)?.sale_price;
          return raw == null ? null : Number(raw);
        })();
    if (rawPrice == null || !Number.isFinite(rawPrice)) continue;

    const currentLowest = lowestPriceByParent.get(variant.parent_product_id);
    if (currentLowest == null || rawPrice < currentLowest) {
      lowestPriceByParent.set(variant.parent_product_id, rawPrice);
    }
  }

  return items.map((item) => {
    const lowestPrice = lowestPriceByParent.get(item.id);
    return lowestPrice == null
      ? item
      : { ...item, salePrice: lowestPrice, priceLabel: `A partir de ${formatPrice(lowestPrice)}` };
  });
}

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
    .neq("product_role", "variant")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel)
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

  let items = ((data as unknown as RawProductRow[]) ?? []).map((row) => mapProduct(row));

  if (channelUsesErpPrice(channel)) {
    const erpPrices = await fetchErpPrices(items.map((item) => item.sku));
    items = items.map((item) => applyErpPrice(item, erpPrices));
  }

  items = await applyStartingVariantPrices(items, channel);

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
    .neq("product_role", "variant")
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
    .neq("product_role", "variant")
    .eq("product_channel_links.channel", channel);
  if (error) {
    console.error("[catalog] erro ao contar produtos:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getProductCategoryIds(channel: string): Promise<string[]> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select("category_id, product_channel_links!inner(channel), product_channel_prices!inner(channel)")
    .eq("status", "active")
    .neq("product_role", "variant")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel)
    .not("category_id", "is", null);

  if (error) {
    console.error("[catalog] erro ao consultar categorias com produtos:", error.message);
    return [];
  }

  return [...new Set(
    ((data as { category_id: string | null }[]) ?? [])
      .map((row) => row.category_id)
      .filter((categoryId): categoryId is string => Boolean(categoryId)),
  )];
}

export async function getCategoriesWithProducts(channel: string): Promise<CategoryNode[]> {
  const [categories, productCategoryIds] = await Promise.all([
    getCategories(),
    getProductCategoryIds(channel),
  ]);
  return filterCategoriesWithProducts(categories, productCategoryIds);
}

export async function getProductById(id: string, channel: string) {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("v_produtos_resolvidos")
    .select(
      "id, name, reference, brand, description, barcode, weight_kg, width_cm, height_cm, length_cm, product_role, parent_product_id, variant_axis, category_id, categories(id, name, slug), product_assets(url, type), product_badges(code, label, kind, priority, starts_at, ends_at), product_channel_prices(channel, sale_price, sale_updated_at), product_channel_links!inner(channel)"
    )
    .eq("id", id)
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel)
    .single();

  if (error || !data) {
    console.error("[catalog] erro ao buscar produto por id:", error?.message);
    return null;
  }

  let variants = data.product_role === "parent" ? await getVariantsByParentId(id, channel) : [];

  const channelSalePrice = salePriceFromChannelPrices(data.product_channel_prices);
  let product = {
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
    salePrice: channelSalePrice,
    priceLabel: formatPrice(channelSalePrice),
    productRole: data.product_role as "simple" | "parent" | "variant",
    parentProductId: data.parent_product_id,
    categoryId: data.category_id as string | null,
    category: (data.categories as unknown as RawCategory | null) ?? null,
    variantAxis: (data.variant_axis as VariantAxisEntry[] | null) ?? [],
    variants,
  };

  if (channelUsesErpPrice(channel)) {
    const erpPrices = await fetchErpPrices([product.sku, ...variants.map((v) => v.sku)]);
    variants = variants.map((v) => applyErpPrice(v, erpPrices));
    product = { ...applyErpPrice(product, erpPrices), variants };
  }

  return product;
}

async function getVariantsByParentId(parentId: string, channel: string): Promise<ProductVariant[]> {
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, reference, barcode, variant_axis, product_assets(url, type), product_channel_prices(channel, sale_price, sale_updated_at), product_channel_links!inner(channel)"
    )
    .eq("parent_product_id", parentId)
    .eq("status", "active")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel)
    .order("name", { ascending: true });

  if (error) {
    console.error("[catalog] erro ao buscar variantes:", error.message);
    return [];
  }

  return ((data as unknown as RawVariantRow[]) ?? []).map(mapVariant);
}

export async function getSitemapProducts(
  channel: string,
): Promise<{ id: string; updatedAt: string }[]> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const pageSize = 1000;
  const all: { id: string; updatedAt: string }[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, updated_at, product_channel_links!inner(channel)")
      .eq("status", "active")
      .neq("product_role", "variant")
      .eq("product_channel_links.channel", channel)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("[catalog] erro ao consultar produtos para sitemap:", error.message);
      break;
    }

    const rows = (data as { id: string; updated_at: string }[]) ?? [];
    all.push(...rows.map((r) => ({ id: r.id, updatedAt: r.updated_at })));
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export async function getCategories(): Promise<CategoryNode[]> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, slug, name, level, sort_order")
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[catalog] erro ao consultar categorias:", error.message);
    return [];
  }

  return (
    (data as { id: string; parent_id: string | null; slug: string; name: string; level: number | null; sort_order: number }[]) ?? []
  ).map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    slug: row.slug,
    name: row.name,
    level: row.level,
    sortOrder: row.sort_order,
  }));
}

/** Categorias de navegaÃ§Ã£o exclusivas de um canal, sem afetar a taxonomia global. */
export async function getChannelCategories(channel: string): Promise<CategoryNode[]> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("channel_categories")
    .select("id, name, slug, sort_order")
    .eq("channel", channel)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[catalog] erro ao consultar categorias do canal:", error.message);
    return [];
  }

  return ((data as { id: string; name: string; slug: string; sort_order: number }[]) ?? []).map((row) => ({
    id: row.id,
    parentId: null,
    name: row.name,
    slug: row.slug,
    level: 1,
    sortOrder: row.sort_order,
  }));
}

export async function queryCatalogByChannelCategory(params: {
  channel: string;
  categoryId: string;
  page: number;
}): Promise<CatalogResult> {
  const { channel, categoryId, page } = params;
  const supabase = getHubClient();
  const { from, to } = pageRange(page);
  const { data, count, error } = await supabase
    .from("products")
    .select(`${CATALOG_SELECT}, product_channel_links!inner(channel), product_channel_categories!inner(channel, category_id)`, { count: "exact" })
    .eq("status", "active")
    .neq("product_role", "variant")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel)
    .eq("product_channel_categories.channel", channel)
    .eq("product_channel_categories.category_id", categoryId)
    .order("name", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("[catalog] erro ao consultar categoria do canal:", error.message);
    return { items: [], total: 0, page, totalPages: 1 };
  }
  const items = ((data as unknown as RawProductRow[]) ?? []).map((row) => mapProduct(row));
  return { items, total: count ?? 0, page, totalPages: totalPages(count ?? 0) };
}
