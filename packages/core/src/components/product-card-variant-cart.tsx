"use client";

import { useState } from "react";
import { badgeStyle, useClientConfig } from "../theme";
import { useCart } from "./cart-provider";
import { variantLabel } from "./variant-selector";
import type { CatalogProduct, ProductVariant } from "../catalog-utils";

export type ProductCardVariantCartProduct = CatalogProduct & {
  variants: ProductVariant[];
  demoPriceLabel?: string;
  demoInstallmentLabel?: string;
};

function toSelfVariant(product: ProductCardVariantCartProduct): ProductVariant {
  return { id: product.id, name: product.name, sku: product.sku, barcode: null, img: product.img, axis: [], salePrice: product.salePrice, priceLabel: product.priceLabel };
}

export function ProductCardVariantCart({ product }: { product: ProductCardVariantCartProduct }) {
  const { palette } = useClientConfig();
  const { addItem } = useCart();
  const variants = product.variants.length > 0 ? product.variants : [toSelfVariant(product)];
  const [selectedId, setSelectedId] = useState(variants[0].id);
  const [favorited, setFavorited] = useState(false);
  const [added, setAdded] = useState(false);

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  const badgeStyleValue = product.badge ? badgeStyle(product.badge.code, palette) : null;

  const handleAdd = () => {
    addItem(
      { id: selected.id, name: selected.name, sku: selected.sku, brand: product.brand, img: selected.img || product.img },
      1,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div
      className="product-card-variant-cart"
      style={{ position: "relative", background: palette.white, borderRadius: 16, overflow: "hidden", border: `1px solid ${palette.gray200}` }}
    >
      <div style={{ position: "relative", aspectRatio: "1 / 1.1", width: "100%", background: palette.white }}>
        <img
          src={selected.img || product.img}
          alt={product.name}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
        <button
          type="button"
          onClick={() => setFavorited((f) => !f)}
          aria-label={favorited ? "Remover dos favoritos" : "Favoritar"}
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.92)",
            cursor: "pointer",
            fontSize: 15,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: favorited ? palette.pink : palette.gray400,
          }}
        >
          {favorited ? "♥" : "♡"}
        </button>
        {product.badge && badgeStyleValue && (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: badgeStyleValue.bg,
              color: badgeStyleValue.color,
              fontSize: 11,
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 100,
              letterSpacing: "0.02em",
            }}
          >
            {product.badge.label}
          </span>
        )}
      </div>

      <div style={{ padding: "10px 12px 12px" }}>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: palette.navy,
            lineHeight: 1.28,
            marginBottom: 8,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {product.name}
        </h3>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: palette.navy }}>
            {product.demoPriceLabel ?? selected.priceLabel ?? "Preço sob consulta"}
          </div>
          {product.demoInstallmentLabel && (
            <div style={{ fontSize: 11, color: palette.gray600 }}>{product.demoInstallmentLabel}</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {variants.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
              {variants.map((variant) => {
                const active = variant.id === selectedId;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedId(variant.id)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 100,
                      border: `1.5px solid ${active ? palette.pink : palette.gray200}`,
                      background: active ? palette.pink : palette.white,
                      color: active ? palette.white : palette.gray800,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {variantLabel(variant)}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={handleAdd}
            aria-label="Adicionar ao carrinho"
            style={{
              marginLeft: variants.length > 1 ? 0 : "auto",
              width: 34,
              height: 34,
              minWidth: 34,
              borderRadius: "50%",
              border: "none",
              background: added ? palette.green : palette.pink,
              color: palette.white,
              fontSize: 18,
              fontWeight: 900,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
          >
            {added ? "✓" : "+"}
          </button>
        </div>
      </div>
    </div>
  );
}
