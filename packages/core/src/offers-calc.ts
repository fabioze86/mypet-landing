export type OfferCampaignStatus = "draft" | "scheduled" | "active" | "expired";

export type OfferItem = {
  id: string;
  productId: string;
  cpro: string;
  name: string;
  shortDescription: string | null;
  img: string;
  listPrice: number;
  promotionalPrice: number;
  discountPercentage: number;
  minQuantity: number;
  sortOrder: number;
};

export type OfferCoupon = {
  code: string;
  description: string | null;
  discountPct: number | null;
  validUntil: string | null;
};

export type OfferCampaign = {
  id: string;
  channel: string;
  slug: string;
  status: OfferCampaignStatus;
  title: string | null;
  subtitle: string | null;
  badge: string | null;
  coupon: OfferCoupon | null;
  freightMessage: string | null;
  primaryCtaLabel: string | null;
  secondaryCtaLabel: string | null;
  heroPriority: number;
  flashOffer: boolean;
  startsAt: string | null;
  endsAt: string | null;
  items: OfferItem[];
};

export function resolveCampaignStatus(
  row: { active: boolean; starts_at: string | null; ends_at: string | null },
  now: Date = new Date(),
): OfferCampaignStatus {
  if (!row.active) return "draft";
  if (row.starts_at && new Date(row.starts_at) > now) return "scheduled";
  if (row.ends_at && new Date(row.ends_at) < now) return "expired";
  return "active";
}

export function isCampaignLiveAt(
  row: { active: boolean; starts_at: string | null; ends_at: string | null },
  now: Date = new Date(),
): boolean {
  return resolveCampaignStatus(row, now) === "active";
}

export function calculateDiscountPct(listPrice: number, promotionalPrice: number): number {
  if (!Number.isFinite(listPrice) || listPrice <= 0) return 0;
  const pct = ((listPrice - promotionalPrice) / listPrice) * 100;
  return Math.max(0, Math.round(pct));
}

export function applyCouponDiscount(price: number, couponDiscountPct: number | null | undefined): number {
  if (!couponDiscountPct || couponDiscountPct <= 0) return price;
  return Math.round(price * (1 - couponDiscountPct / 100) * 100) / 100;
}

export type ResolvedProductInfo = {
  id: string;
  name: string;
  reference: string | null;
  description: string | null;
  img: string;
};

export type RawOfferItemRow = {
  id: string;
  product_id: string;
  promotional_price: number | string;
  min_quantity: number;
  sort_order: number;
};

export type RawOfferCampaignRow = {
  id: string;
  channel: string;
  slug: string;
  title: string | null;
  subtitle: string | null;
  badge: string | null;
  coupon_code: string | null;
  coupon_description: string | null;
  coupon_discount_pct: number | string | null;
  coupon_valid_until: string | null;
  freight_message: string | null;
  primary_cta_label: string | null;
  secondary_cta_label: string | null;
  hero_priority: number;
  flash_offer: boolean;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  offer_campaign_items: RawOfferItemRow[] | null;
};

export function buildOfferItem(
  row: RawOfferItemRow,
  productById: Map<string, ResolvedProductInfo>,
  realPriceByProductId: Map<string, number>,
): OfferItem | null {
  const product = productById.get(row.product_id);
  if (!product) return null;

  const listPrice = realPriceByProductId.get(row.product_id);
  if (listPrice == null || !Number.isFinite(listPrice) || listPrice <= 0) return null;

  const promotionalPrice = Number(row.promotional_price);
  if (!Number.isFinite(promotionalPrice) || promotionalPrice <= 0) return null;

  return {
    id: row.id,
    productId: row.product_id,
    cpro: product.reference ?? "",
    name: product.name,
    shortDescription: product.description,
    img: product.img,
    listPrice,
    promotionalPrice,
    discountPercentage: calculateDiscountPct(listPrice, promotionalPrice),
    minQuantity: row.min_quantity,
    sortOrder: row.sort_order,
  };
}

export function buildOfferCampaign(
  row: RawOfferCampaignRow,
  productById: Map<string, ResolvedProductInfo>,
  realPriceByProductId: Map<string, number>,
  now: Date = new Date(),
): OfferCampaign | null {
  const items = (row.offer_campaign_items ?? [])
    .map((item) => buildOfferItem(item, productById, realPriceByProductId))
    .filter((item): item is OfferItem => item !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (items.length === 0) return null;

  const couponDiscountPct = row.coupon_discount_pct == null ? null : Number(row.coupon_discount_pct);

  return {
    id: row.id,
    channel: row.channel,
    slug: row.slug,
    status: resolveCampaignStatus(row, now),
    title: row.title,
    subtitle: row.subtitle,
    badge: row.badge,
    coupon: row.coupon_code
      ? {
          code: row.coupon_code,
          description: row.coupon_description,
          discountPct: couponDiscountPct,
          validUntil: row.coupon_valid_until,
        }
      : null,
    freightMessage: row.freight_message,
    primaryCtaLabel: row.primary_cta_label,
    secondaryCtaLabel: row.secondary_cta_label,
    heroPriority: row.hero_priority,
    flashOffer: row.flash_offer,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    items,
  };
}
