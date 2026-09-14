import { describe, it, expect } from "vitest";
import {
  resolveCampaignStatus,
  isCampaignLiveAt,
  calculateDiscountPct,
  applyCouponDiscount,
  buildOfferItem,
  buildOfferCampaign,
  type RawOfferCampaignRow,
  type RawOfferItemRow,
  type ResolvedProductInfo,
} from "./offers-calc";

describe("resolveCampaignStatus", () => {
  const now = new Date("2026-09-13T12:00:00Z");

  it("é draft quando active é false", () => {
    expect(resolveCampaignStatus({ active: false, starts_at: null, ends_at: null }, now)).toBe("draft");
  });

  it("é scheduled quando starts_at é futuro", () => {
    expect(
      resolveCampaignStatus({ active: true, starts_at: "2026-09-20T00:00:00Z", ends_at: null }, now),
    ).toBe("scheduled");
  });

  it("é expired quando ends_at já passou", () => {
    expect(
      resolveCampaignStatus({ active: true, starts_at: null, ends_at: "2026-09-01T00:00:00Z" }, now),
    ).toBe("expired");
  });

  it("é active dentro da janela de vigência", () => {
    expect(
      resolveCampaignStatus(
        { active: true, starts_at: "2026-09-01T00:00:00Z", ends_at: "2026-09-30T00:00:00Z" },
        now,
      ),
    ).toBe("active");
  });
});

describe("isCampaignLiveAt", () => {
  it("só é true quando o status é active", () => {
    const now = new Date("2026-09-13T12:00:00Z");
    expect(isCampaignLiveAt({ active: true, starts_at: null, ends_at: null }, now)).toBe(true);
    expect(isCampaignLiveAt({ active: false, starts_at: null, ends_at: null }, now)).toBe(false);
  });
});

describe("calculateDiscountPct", () => {
  it("calcula o percentual de desconto arredondado", () => {
    expect(calculateDiscountPct(299, 199)).toBe(33);
  });

  it("nunca retorna negativo quando o preço promocional é maior que o de tabela", () => {
    expect(calculateDiscountPct(100, 150)).toBe(0);
  });

  it("retorna 0 quando o preço de tabela é inválido", () => {
    expect(calculateDiscountPct(0, 50)).toBe(0);
  });
});

describe("applyCouponDiscount", () => {
  it("aplica o percentual do cupom sobre o preço", () => {
    expect(applyCouponDiscount(100, 10)).toBe(90);
  });

  it("devolve o preço original quando não há cupom", () => {
    expect(applyCouponDiscount(100, null)).toBe(100);
    expect(applyCouponDiscount(100, undefined)).toBe(100);
    expect(applyCouponDiscount(100, 0)).toBe(100);
  });
});

const product: ResolvedProductInfo = {
  id: "prod-1",
  name: "Kit 11 vestidos",
  reference: "SKU-1",
  description: "Kit com 11 vestidos sortidos para revenda.",
  img: "https://imagedelivery.net/kit.jpg",
};

const itemRow: RawOfferItemRow = {
  id: "item-1",
  product_id: "prod-1",
  promotional_price: "199.00",
  min_quantity: 1,
  sort_order: 0,
};

describe("buildOfferItem", () => {
  it("monta o item com desconto calculado a partir do preço real", () => {
    const item = buildOfferItem(itemRow, new Map([["prod-1", product]]), new Map([["prod-1", 299]]));
    expect(item).toMatchObject({
      productId: "prod-1",
      cpro: "SKU-1",
      name: "Kit 11 vestidos",
      listPrice: 299,
      promotionalPrice: 199,
      discountPercentage: 33,
    });
  });

  it("retorna null quando o produto não tem preço real válido", () => {
    const item = buildOfferItem(itemRow, new Map([["prod-1", product]]), new Map());
    expect(item).toBeNull();
  });

  it("retorna null quando o produto não é encontrado", () => {
    const item = buildOfferItem(itemRow, new Map(), new Map([["prod-1", 299]]));
    expect(item).toBeNull();
  });

  it("retorna null quando o preço promocional cadastrado é inválido", () => {
    const invalid: RawOfferItemRow = { ...itemRow, promotional_price: "0" };
    const item = buildOfferItem(invalid, new Map([["prod-1", product]]), new Map([["prod-1", 299]]));
    expect(item).toBeNull();
  });
});

const campaignRow: RawOfferCampaignRow = {
  id: "camp-1",
  channel: "ffa_fabrica",
  slug: "kit-11-vestidos",
  title: "Kit 11 vestidos",
  subtitle: "Reposição para o verão",
  badge: "Oferta para lojistas",
  coupon_code: "PRIMEIRACOMPRA",
  coupon_description: "10% de desconto na primeira compra",
  coupon_discount_pct: 10,
  coupon_valid_until: null,
  freight_message: "Frete grátis acima de R$ 500",
  primary_cta_label: "Aproveitar oferta",
  secondary_cta_label: "Falar com atendimento",
  hero_priority: 5,
  flash_offer: false,
  active: true,
  starts_at: null,
  ends_at: null,
  offer_campaign_items: [itemRow],
};

describe("buildOfferCampaign", () => {
  const now = new Date("2026-09-13T12:00:00Z");
  const productById = new Map([["prod-1", product]]);
  const realPriceByProductId = new Map([["prod-1", 299]]);

  it("monta a campanha com status active e cupom", () => {
    const campaign = buildOfferCampaign(campaignRow, productById, realPriceByProductId, now);
    expect(campaign).toMatchObject({
      slug: "kit-11-vestidos",
      status: "active",
      coupon: { code: "PRIMEIRACOMPRA", discountPct: 10 },
      items: [{ productId: "prod-1", discountPercentage: 33 }],
    });
  });

  it("retorna null quando nenhum item tem preço real válido", () => {
    const campaign = buildOfferCampaign(campaignRow, productById, new Map(), now);
    expect(campaign).toBeNull();
  });

  it("marca status expired sem descartar a campanha, desde que tenha item válido", () => {
    const expiredRow: RawOfferCampaignRow = { ...campaignRow, ends_at: "2026-09-01T00:00:00Z" };
    const campaign = buildOfferCampaign(expiredRow, productById, realPriceByProductId, now);
    expect(campaign?.status).toBe("expired");
  });

  it("não inclui cupom quando não há coupon_code", () => {
    const noCoupon: RawOfferCampaignRow = { ...campaignRow, coupon_code: null };
    const campaign = buildOfferCampaign(noCoupon, productById, realPriceByProductId, now);
    expect(campaign?.coupon).toBeNull();
  });
});
