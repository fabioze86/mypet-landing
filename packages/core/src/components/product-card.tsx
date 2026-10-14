"use client";

import Image from "next/image";
import Link from "next/link";
import { badgeStyle, useClientConfig } from "../theme";
import { showsListPrice } from "../features";
import { PriceLockSlot } from "./lead-gate";
import { AddToCartControl } from "./add-to-cart-control";
import { CartStepperControl } from "./cart-stepper-control";
import type { CatalogProduct } from "../catalog-utils";

export function ProductCard({
  product,
  addControl = "default",
  layout = "grid",
}: {
  product: CatalogProduct;
  addControl?: "default" | "stepper";
  /** "masonry": estilo Pinterest — imagem na proporção natural, sem moldura de card. */
  layout?: "grid" | "masonry";
}) {
  const { palette, features } = useClientConfig();
  const style = product.badge ? badgeStyle(product.badge.code, palette) : null;
  const masonry = layout === "masonry";
  return (
    <div className={masonry ? "product-card product-card--masonry" : "product-card"}>
      <Link href={`/produtos/${product.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        <div
          className="product-card-media"
          style={
            masonry
              ? { position: "relative", width: "100%", background: palette.gray50, borderRadius: 16, overflow: "hidden" }
              : { position: "relative", aspectRatio: "1 / 1.22", width: "100%", background: palette.white, overflow: "hidden" }
          }
        >
          {masonry ? (
            // width/height só reservam espaço; height:auto mantém a proporção real da foto.
            <Image
              src={product.img}
              alt={product.name}
              width={600}
              height={600}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          ) : (
            <Image
              src={product.img}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
              style={{ objectFit: "contain" }}
            />
          )}
          {product.badge && style && (
            <span style={{ position: "absolute", top: 10, left: 10, background: style.bg, color: style.color, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 100, letterSpacing: "0.02em" }}>
              {product.badge.label}
            </span>
          )}
        </div>
        <div style={{ padding: masonry ? "8px 4px 0" : "10px 12px 0" }}>
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
              marginBottom: masonry ? 6 : 10,
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
      <div style={{ padding: masonry ? "0 4px 4px" : "0 12px 12px" }}>
        {showsListPrice(features) ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: palette.navy }}>
              {product.priceLabel ?? "Preço indisponível"}
            </div>
          </div>
        ) : (
          <PriceLockSlot priceLabel={product.priceLabel} category={product.category} />
        )}
        {(() => {
          const cartProduct = {
            id: product.id,
            name: product.name,
            sku: product.sku,
            brand: product.brand,
            img: product.img,
            unitPrice: product.salePrice ?? undefined,
          };
          if (addControl !== "stepper") return <AddToCartControl product={cartProduct} compact />;
          if (product.hasVariants) {
            return (
              <Link
                href={`/produtos/${product.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 38,
                  marginTop: 8,
                  border: `1.5px solid ${palette.pink}`,
                  borderRadius: 10,
                  color: palette.pink,
                  fontSize: 14,
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                Ver opções
              </Link>
            );
          }
          return <CartStepperControl product={cartProduct} />;
        })()}
      </div>
    </div>
  );
}
