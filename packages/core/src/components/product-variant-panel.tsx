"use client";

import { Suspense } from "react";
import Image from "next/image";
import { badgeStyle, useClientConfig } from "../theme";
import { AddToCartControl } from "./add-to-cart-control";
import { VariantSelector, useSelectedVariant } from "./variant-selector";
import type { Badge, ProductVariant } from "../catalog-utils";

export type PdpProduct = {
  id: string;
  name: string;
  brand: string | null;
  sku: string;
  barcode: string | null;
  img: string;
  badge: Badge | null;
  variants: ProductVariant[];
  salePrice?: number | null;
  priceLabel?: string | null;
};

export function ProductVariantPanel({ product }: { product: PdpProduct }) {
  return (
    <Suspense fallback={<ProductMedia product={product} variantOverride={null} />}>
      <ProductVariantPanelInner product={product} />
    </Suspense>
  );
}

function ProductVariantPanelInner({ product }: { product: PdpProduct }) {
  const hasVariants = product.variants.length > 0;
  const { selected, select } = useSelectedVariant(
    hasVariants ? product.variants : [toSelfVariant(product)],
  );

  const variantOverride = hasVariants
    ? { id: selected.id, sku: selected.sku, barcode: selected.barcode, img: selected.img, name: selected.name }
    : null;

  return (
    <>
      <ProductMedia product={product} variantOverride={variantOverride} />
      {hasVariants && (
        <div style={{ marginTop: 16 }}>
          <VariantSelector variants={product.variants} selectedId={selected.id} onSelect={select} />
        </div>
      )}
    </>
  );
}

function toSelfVariant(product: PdpProduct): ProductVariant {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    img: product.img,
    axis: [],
    salePrice: product.salePrice ?? null,
    priceLabel: product.priceLabel ?? null,
  };
}

function ProductMedia({
  product,
  variantOverride,
}: {
  product: PdpProduct;
  variantOverride: { id: string; sku: string; barcode: string | null; img: string; name: string } | null;
}) {
  const { palette: PALETTE } = useClientConfig();
  const styleBadge = product.badge ? badgeStyle(product.badge.code, PALETTE) : null;
  const img = variantOverride?.img ?? product.img;
  const sku = variantOverride?.sku ?? product.sku;
  const barcode = variantOverride?.barcode ?? product.barcode;
  const cartId = variantOverride?.id ?? product.id;
  const cartName = variantOverride?.name ?? product.name;
  const priceLabel = product.variants.find((variant) => variant.id === cartId)?.priceLabel ?? product.priceLabel;

  return (
    <>
      <div
        style={{
          background: PALETTE.white,
          border: `1px solid ${PALETTE.gray200}`,
          borderRadius: 20,
          padding: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(26,52,114,0.04)",
        }}
      >
        <div className="img-container" style={{ width: "100%", height: 450, position: "relative" }}>
          <Image
            src={img}
            alt={cartName}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 450px"
            style={{ objectFit: "contain" }}
          />
        </div>

        {product.badge && styleBadge && (
          <span
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              background: styleBadge.bg,
              color: styleBadge.color,
              fontSize: 12,
              fontWeight: 800,
              padding: "6px 14px",
              borderRadius: 100,
              letterSpacing: "0.02em",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            {product.badge.label}
          </span>
        )}

        {product.brand && (
          <span
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: PALETTE.navyLight,
              color: PALETTE.navy,
              fontSize: 11,
              fontWeight: 700,
              padding: "5px 12px",
              borderRadius: 100,
              letterSpacing: "0.04em",
            }}
          >
            {product.brand.toUpperCase()}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
        {sku && (
          <span style={{ fontSize: 13, color: PALETTE.gray600, background: PALETTE.gray100, padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>
            SKU/Ref: {sku}
          </span>
        )}
        {barcode && (
          <span style={{ fontSize: 13, color: PALETTE.gray600, background: PALETTE.gray100, padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>
            EAN/EAC: {barcode}
          </span>
        )}
      </div>

      <div
        style={{
          background: PALETTE.white,
          border: `1px solid ${PALETTE.gray200}`,
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 4px 20px rgba(26,52,114,0.04)",
          marginTop: 16,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: PALETTE.gray600, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            Atacado B2B
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: PALETTE.pink }}>{priceLabel ?? "Preço sob consulta"}</div>
          <p style={{ fontSize: 13, color: PALETTE.gray600, marginTop: 4 }}>
            Venda exclusiva para CNPJ de pet shops e revendedores.
          </p>
        </div>

        <AddToCartControl
          product={{ id: cartId, name: cartName, sku, brand: product.brand, img }}
        />
      </div>
    </>
  );
}
