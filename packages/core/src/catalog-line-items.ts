import { cacheLife, cacheTag } from "next/cache";
import { getCatalogClient } from "./supabase";
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

// Busca do agente: cada palavra precisa aparecer no nome (ou na referência),
// em qualquer ordem, com ou sem acento e no singular.
function wordFilters(q: string): string[] {
  const words = q
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .slice(0, 6);
  return words.map((word) => {
    const plain = word.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const variants = new Set([word, plain]);
    if (plain.length > 4 && plain.endsWith("s")) variants.add(plain.slice(0, -1));
    const parts = [...variants].map((v) => `name.ilike.%${escapeOrFilterValue(v)}%`);
    parts.push(`reference.ilike.%${escapeOrFilterValue(word)}%`);
    return parts.join(",");
  });
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

  const supabase = getCatalogClient();
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
  matchWords?: boolean;
}): Promise<CatalogLineItemsResult> {
  const { q, brand, categoryId, page, channel, matchWords } = params;
  const supabase = getCatalogClient();
  const { from, to } = pageRange(page);

  let query = supabase
    .from("products")
    .select(`${LINE_ITEM_PRODUCT_SELECT}, product_channel_links!inner(channel)`, { count: "exact" })
    .eq("status", "active")
    .neq("product_role", "variant")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel)
    .order("name", { ascending: true });

  if (q && matchWords) {
    for (const filter of wordFilters(q)) query = query.or(filter);
  } else if (q) {
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
  matchWords?: boolean;
}): Promise<CatalogLineItemsResult> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  return queryCatalogLineItems(params);
}

const MAX_IDS = 50;

type RawLineItemByIdRow = RawLineItemProductRow & {
  parent_product_id: string | null;
  variant_axis: VariantAxisEntry[] | null;
};

type RawParentRow = {
  id: string;
  name: string;
  brand: string | null;
  product_assets: { url: string; type: string }[] | null;
};

function variantLabelOrNull(axis: VariantAxisEntry[] | null, sku: string): string | null {
  const label = (axis ?? [])
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((a) => a.valor)
    .join(" / ")
    .trim();
  if (!label || label.toLowerCase() === sku.trim().toLowerCase()) return null;
  return label;
}

/**
 * Linhas da tabela pelos ids (produto simples ou variação), com o preço atual
 * do canal. Usado pelo agente para pôr produtos no pedido e sugerir reposição.
 * Sem cache: o preço precisa ser o de agora.
 */
export async function queryLineItemsByIds(ids: string[], channel: string): Promise<CatalogLineItem[]> {
  const unique = [...new Set(ids)].slice(0, MAX_IDS);
  if (unique.length === 0) return [];
  const supabase = getCatalogClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `${LINE_ITEM_PRODUCT_SELECT}, parent_product_id, variant_axis, product_channel_links!inner(channel)`,
    )
    .in("id", unique)
    .eq("status", "active")
    .neq("product_role", "parent")
    .eq("product_channel_links.channel", channel)
    .eq("product_channel_prices.channel", channel);

  if (error) {
    console.error("[catalog-line-items] erro ao buscar produtos por id:", error.message, error);
    // Lança: o agente não pode tratar falha de consulta como "produto não existe".
    // Mensagem genérica: o texto cru do banco não vai para o modelo.
    throw new Error("Falha ao consultar produtos.");
  }

  const rows = (data as unknown as RawLineItemByIdRow[]) ?? [];
  const parentIds = [...new Set(rows.map((r) => r.parent_product_id).filter((id): id is string => Boolean(id)))];
  const parents = new Map<string, RawParentRow>();
  if (parentIds.length > 0) {
    const { data: parentData, error: parentError } = await supabase
      .from("products")
      .select("id, name, brand, product_assets(url, type)")
      .in("id", parentIds);
    if (parentError) console.error("[catalog-line-items] erro ao buscar produtos-pai:", parentError.message);
    for (const parent of (parentData as unknown as RawParentRow[]) ?? []) parents.set(parent.id, parent);
  }

  const byId = new Map<string, CatalogLineItem>();
  for (const row of rows) {
    const unitPrice = salePriceFromChannelPrices(row.product_channel_prices);
    const sku = row.reference ?? "";
    const parent = row.parent_product_id ? parents.get(row.parent_product_id) : undefined;
    const ownImg = mainImage(row.product_assets);
    byId.set(row.id, {
      id: row.id,
      name: parent?.name ?? row.name,
      sku,
      brand: parent?.brand ?? row.brand,
      img: ownImg !== PLACEHOLDER_IMAGE || !parent ? ownImg : mainImage(parent.product_assets),
      unitPrice,
      priceLabel: formatPrice(unitPrice),
      variantLabel: row.product_role === "variant" ? variantLabelOrNull(row.variant_axis, sku) : null,
    });
  }
  return unique.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}
