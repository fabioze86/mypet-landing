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

export type RawProductRow = {
  id: string;
  name: string;
  reference: string | null;
  brand: string | null;
  category_id: string | null;
  categories: RawCategory | null;
  product_assets: { url: string; type: string }[] | null;
  product_badges: RawBadge[] | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  badge: Badge | null;
  category: RawCategory | null;
};

export type CatalogResult = {
  items: CatalogProduct[];
  total: number;
  page: number;
  totalPages: number;
};

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
  return {
    id: row.id,
    name: row.name,
    sku: row.reference ?? "",
    brand: row.brand,
    img: mainImage(row.product_assets),
    badge: pickActiveBadge(row.product_badges, now),
    category: row.categories ?? null,
  };
}
