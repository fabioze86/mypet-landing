import { badgeStyle, PALETTE } from "../theme";
import { PriceLockSlot, UnlockButton } from "./lead-gate";
import type { CatalogProduct } from "../catalog-utils";
import Link from "next/link";
import { AddToCartControl } from "./add-to-cart-control";

export function ProductCard({ product }: { product: CatalogProduct }) {
  const style = product.badge ? badgeStyle(product.badge.code) : null;
  return (
    <div className="product-card">
      <Link href={`/produtos/${product.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        <div style={{ position: "relative" }}>
          <img src={product.img} alt={product.name} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
          {product.badge && style && (
            <span style={{ position: "absolute", top: 10, left: 10, background: style.bg, color: style.color, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 100, letterSpacing: "0.02em" }}>
              {product.badge.label}
            </span>
          )}
          {product.brand && (
            <span style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.92)", color: PALETTE.gray600, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 100, letterSpacing: "0.04em" }}>
              {product.brand.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ padding: "14px 14px 0" }}>
          {product.sku && (
            <p style={{ fontSize: 10, color: PALETTE.gray400, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>
              SKU: {product.sku}
            </p>
          )}
          <h3 style={{ fontSize: 14, fontWeight: 800, color: PALETTE.navy, lineHeight: 1.35, marginBottom: 14, minHeight: 38 }}>
            {product.name}
          </h3>
        </div>
      </Link>
      <div style={{ padding: "0 14px 16px" }}>
        <PriceLockSlot />
        <UnlockButton className="unlock-btn">
          <><span>💬</span> Solicitar cotação</>
        </UnlockButton>
        <AddToCartControl
          product={{ id: product.id, name: product.name, sku: product.sku, brand: product.brand, img: product.img }}
        />
      </div>
    </div>
  );
}
