"use client";

import { Suspense } from "react";
import Image from "next/image";
import { badgeStyle, useClientConfig } from "../theme";
import { AddToCartControl } from "./add-to-cart-control";
import { VariantSelector, hasAxisData, useSelectedVariant } from "./variant-selector";
import { VariantTable } from "./variant-table";
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
  const variants = product.variants.length > 0 ? product.variants : [toSelfVariant(product)];

  return (
    <>
      <style>{`
        .pdp-purchase-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
        @media (max-width: 768px) {
          .pdp-purchase-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .pdp-image-wrap { height: 300px !important; }
        }
      `}</style>
      <Suspense
        fallback={<PurchaseGrid product={product} variants={variants} selected={variants[0]} onSelect={() => {}} />}
      >
        <ProductVariantPanelInner product={product} variants={variants} />
      </Suspense>
    </>
  );
}

function ProductVariantPanelInner({
  product,
  variants,
}: {
  product: PdpProduct;
  variants: ProductVariant[];
}) {
  const { selected, select } = useSelectedVariant(variants);
  return <PurchaseGrid product={product} variants={variants} selected={selected} onSelect={select} />;
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

function PurchaseGrid({
  product,
  variants,
  selected,
  onSelect,
}: {
  product: PdpProduct;
  variants: ProductVariant[];
  selected: ProductVariant;
  onSelect: (id: string) => void;
}) {
  const { palette: PALETTE } = useClientConfig();
  const hasVariants = product.variants.length > 0;
  const useTable = hasVariants && !hasAxisData(product.variants);

  const variantOverride = hasVariants
    ? { id: selected.id, sku: selected.sku, barcode: selected.barcode, img: selected.img, name: selected.name }
    : null;

  const img = variantOverride?.img ?? product.img;
  const sku = variantOverride?.sku ?? product.sku;
  const barcode = variantOverride?.barcode ?? product.barcode;
  const cartId = variantOverride?.id ?? product.id;
  const cartName = variantOverride?.name ?? product.name;
  const priceLabel = product.variants.find((variant) => variant.id === cartId)?.priceLabel ?? product.priceLabel;

  return (
    <div className="pdp-purchase-grid">
      <ProductImage product={product} img={img} cartName={cartName} />

      <div>
        {product.brand && (
          <p
            style={{
              fontSize: 13,
              color: PALETTE.pink,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {product.brand}
          </p>
        )}
        <h1 style={{ fontSize: 32, fontWeight: 900, color: PALETTE.navy, lineHeight: 1.25, marginBottom: 12 }}>
          {product.name}
        </h1>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {sku && (
            <span
              style={{
                fontSize: 13,
                color: PALETTE.gray600,
                background: PALETTE.gray100,
                padding: "4px 10px",
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              SKU/Ref: {sku}
            </span>
          )}
          {barcode && (
            <span
              style={{
                fontSize: 13,
                color: PALETTE.gray600,
                background: PALETTE.gray100,
                padding: "4px 10px",
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              EAN/EAC: {barcode}
            </span>
          )}
        </div>

        {useTable ? (
          <VariantTable variants={product.variants} brand={product.brand} />
        ) : (
          <>
            {hasVariants && (
              <div style={{ marginTop: 16 }}>
                <VariantSelector variants={product.variants} selectedId={selected.id} onSelect={onSelect} />
              </div>
            )}

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
                <div
                  style={{
                    fontSize: 11,
                    color: PALETTE.gray600,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 4,
                  }}
                >
                  Atacado B2B
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: PALETTE.pink }}>
                  {priceLabel ?? "Preço sob consulta"}
                </div>
                <p style={{ fontSize: 13, color: PALETTE.gray600, marginTop: 4 }}>
                  Venda exclusiva para CNPJ de pet shops e revendedores.
                </p>
              </div>

              <AddToCartControl product={{ id: cartId, name: cartName, sku, brand: product.brand, img }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProductImage({
  product,
  img,
  cartName,
}: {
  product: PdpProduct;
  img: string;
  cartName: string;
}) {
  const { palette: PALETTE } = useClientConfig();
  const styleBadge = product.badge ? badgeStyle(product.badge.code, PALETTE) : null;

  return (
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
      <div className="pdp-image-wrap" style={{ width: "100%", height: 450, position: "relative" }}>
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
  );
}
