"use client";

import Image from "next/image";
import Link from "next/link";
import { useClientConfig } from "../theme";
import { OfferPrice } from "./offer-price";
import { AddToCartControl } from "./add-to-cart-control";
import type { OfferItem } from "../offers-calc";

export function OfferCard({
  item,
  campaignId,
  campaignSlug,
}: {
  item: OfferItem;
  campaignId: string;
  campaignSlug: string;
}) {
  const { palette } = useClientConfig();
  const href = `/ofertas-para-lojistas/${campaignSlug}`;

  return (
    <div
      style={{
        background: palette.white,
        border: `1px solid ${palette.gray200}`,
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 2px 10px rgba(6,28,92,0.06)",
      }}
    >
      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        <div style={{ position: "relative", aspectRatio: "1 / 1", width: "100%", background: palette.gray50 }}>
          <Image src={item.img} alt={item.name} fill sizes="(max-width: 640px) 50vw, 280px" style={{ objectFit: "contain" }} />
        </div>
        <div style={{ padding: "12px 14px 0" }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: palette.navy, lineHeight: 1.3, marginBottom: 8 }}>
            {item.name}
          </h3>
        </div>
      </Link>
      <div style={{ padding: "0 14px 14px" }}>
        <OfferPrice listPrice={item.listPrice} promotionalPrice={item.promotionalPrice} discountPercentage={item.discountPercentage} />
        <AddToCartControl
          product={{
            id: item.productId,
            name: item.name,
            sku: item.cpro,
            brand: null,
            img: item.img,
            campaignId,
            campaignSlug,
            unitPrice: item.promotionalPrice,
            listPrice: item.listPrice,
          }}
          minQty={item.minQuantity}
        />
      </div>
    </div>
  );
}
