export const PAGE_SIZE = 24;
export const PLACEHOLDER_IMAGE = "/placeholder-produto.svg";

export type Badge = { code: string; label: string };

export type RawBadge = {
  code: string;
  label: string;
  kind: string;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type RawCategory = { id: string; name: string; slug: string };

export type RawChannelPrice = {
  channel: string | null;
  sale_price: number | string | null;
  sale_updated_at?: string | null;
};

export type CategoryNode = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  level: number | null;
  sortOrder: number;
};

export type CategoryTreeNode = CategoryNode & { children: CategoryTreeNode[] };

export type RawProductRow = {
  id: string;
  name: string;
  reference: string | null;
  brand: string | null;
  category_id: string | null;
  categories: RawCategory | null;
  product_assets: { url: string; type: string }[] | null;
  product_badges: RawBadge[] | null;
  product_channel_prices?: RawChannelPrice[] | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  badge: Badge | null;
  category: RawCategory | null;
  salePrice: number | null;
  priceLabel: string | null;
};

export type CatalogResult = {
  items: CatalogProduct[];
  total: number;
  page: number;
  totalPages: number;
};

export type VariantAxisEntry = { eixo: string; valor: string; ordem?: number };

export type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  img: string;
  axis: VariantAxisEntry[];
  salePrice: number | null;
  priceLabel: string | null;
};

export type RawVariantRow = {
  id: string;
  name: string;
  reference: string | null;
  barcode: string | null;
  variant_axis: VariantAxisEntry[] | null;
  product_assets: { url: string; type: string }[] | null;
  product_channel_prices?: RawChannelPrice[] | null;
};

export function mapVariant(row: RawVariantRow): ProductVariant {
  const axis = (row.variant_axis ?? []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const salePrice = salePriceFromChannelPrices(row.product_channel_prices);
  return {
    id: row.id,
    name: row.name,
    sku: row.reference ?? "",
    barcode: row.barcode,
    img: mainImage(row.product_assets),
    axis,
    salePrice,
    priceLabel: formatPrice(salePrice),
  };
}

export function salePriceFromChannelPrices(prices: RawChannelPrice[] | null | undefined): number | null {
  const raw = prices?.find((price) => price.sale_price !== null && price.sale_price !== undefined)?.sale_price;
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function formatPrice(value: number | null): string | null {
  if (value === null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function pageRange(page: number, pageSize: number = PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function totalPages(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function pickActiveBadge(
  badges: RawBadge[] | null | undefined,
  now: Date = new Date(),
): Badge | null {
  if (!badges || badges.length === 0) return null;
  const vigentes = badges.filter((b) => {
    const startOk = !b.starts_at || new Date(b.starts_at) <= now;
    const endOk = !b.ends_at || new Date(b.ends_at) >= now;
    return startOk && endOk;
  });
  if (vigentes.length === 0) return null;
  vigentes.sort((a, b) => b.priority - a.priority);
  const top = vigentes[0];
  return { code: top.code, label: top.label };
}

export function mainImage(assets: RawProductRow["product_assets"]): string {
  const main = assets?.find((a) => a.type === "main_image");
  return main?.url ?? PLACEHOLDER_IMAGE;
}

export function mapProduct(row: RawProductRow, now: Date = new Date()): CatalogProduct {
  const salePrice = salePriceFromChannelPrices(row.product_channel_prices);
  return {
    id: row.id,
    name: row.name,
    sku: row.reference ?? "",
    brand: row.brand,
    img: mainImage(row.product_assets),
    badge: pickActiveBadge(row.product_badges, now),
    category: row.categories ?? null,
    salePrice,
    priceLabel: formatPrice(salePrice),
  };
}

export function buildCategoryTree(categories: CategoryNode[]): CategoryTreeNode[] {
  const nodesById = new Map<string, CategoryTreeNode>();
  for (const c of categories) {
    nodesById.set(c.id, { ...c, children: [] });
  }
  const roots: CategoryTreeNode[] = [];
  for (const c of categories) {
    const node = nodesById.get(c.id)!;
    if (c.parentId && nodesById.has(c.parentId)) {
      nodesById.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function topLevelCategories(categories: CategoryNode[]): CategoryNode[] {
  return categories.filter((c) => c.parentId === null);
}

export function collectCategorySubtreeIds(categories: CategoryNode[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const siblings = childrenByParent.get(c.parentId) ?? [];
    siblings.push(c.id);
    childrenByParent.set(c.parentId, siblings);
  }
  const ids: string[] = [];
  const visit = (id: string) => {
    ids.push(id);
    for (const childId of childrenByParent.get(id) ?? []) visit(childId);
  };
  visit(rootId);
  return ids;
}

export function getCategoryPath(categories: CategoryNode[], nodeId: string): CategoryNode[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path: CategoryNode[] = [];
  let current = byId.get(nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}
