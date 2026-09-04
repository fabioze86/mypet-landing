"use client";

import Image from "next/image";
import Link from "next/link";
import { badgeStyle, useClientConfig } from "../theme";
import { showsListPrice } from "../features";
import { PriceLockSlot } from "./lead-gate";
import { AddToCartControl } from "./add-to-cart-control";
import type { CatalogProduct } from "../catalog-utils";

export function ProductCard({ product }: { product: CatalogProduct }) {
  const { palette, features } = useClientConfig();
  const style = product.badge ? badgeStyle(product.badge.code, palette) : null;
  return (
    <div className="product-card">
      <Link href={`/produtos/${product.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        <div
          className="product-card-media"
          style={{
            position: "relative",
            aspectRatio: "1 / 1.22",
            width: "100%",
            background: palette.white,
            overflow: "hidden",
          }}
        >
          <Image
            src={product.img}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
            style={{ objectFit: "contain" }}
          />
          {product.badge && style && (
            <span style={{ position: "absolute", top: 10, left: 10, background: style.bg, color: style.color, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 100, letterSpacing: "0.02em" }}>
              {product.badge.label}
            </span>
          )}
        </div>
        <div style={{ padding: "10px 12px 0" }}>
          {product.sku && (
            <p style={{ fontSize: 9, color: palette.gray400, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>
              SKU: {product.sku}
            </p>
          )}
          <h3
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: palette.navy,
              lineHeight: 1.28,
              marginBottom: 10,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.name}
          </h3>
        </div>
      </Link>
      <div style={{ padding: "0 12px 12px" }}>
        {showsListPrice(features) ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: palette.navy }}>
              {product.priceLabel ?? "Preço indisponível"}
            </div>
          </div>
        ) : (
          <PriceLockSlot priceLabel={product.priceLabel} category={product.category} />
        )}
        <AddToCartControl
          product={{ id: product.id, name: product.name, sku: product.sku, brand: product.brand, img: product.img }}
          compact
        />
      </div>
    </div>
  );
}
