"use client";

import Link from "next/link";
import { useClientConfig } from "../theme";
import { UnlockButton } from "./lead-gate";
import { CartBadge } from "./cart-badge";
import { MegaMenu } from "./mega-menu";
import { MobileMenu } from "./mobile-menu";
import { buildCategoryTree, type CategoryNode } from "../catalog-utils";

export function SiteNav({ categories }: { categories: CategoryNode[] }) {
  const { name, tagline, palette, logo } = useClientConfig();
  const tree = buildCategoryTree(categories);

  return (
    <nav style={{ background: palette.white, borderBottom: `1px solid ${palette.gray200}`, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="site-nav-mobile-trigger">
            <MobileMenu tree={tree} />
          </div>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 34, height: 34, background: palette.pink, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 18 }}>{logo.emoji}</span>
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: palette.navy, lineHeight: 1 }}>{name}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: palette.pink, letterSpacing: "0.12em", textTransform: "uppercase" }}>{tagline}</div>
            </div>
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: palette.gray600, fontWeight: 600 }}>Exclusivo para lojistas</span>
          <CartBadge />
          <UnlockButton className="cta-primary" style={{ padding: "10px 22px", fontSize: 14 }}>
            Solicitar cotação
          </UnlockButton>
        </div>
      </div>

      <div className="site-nav-mega-menu-row" style={{ borderTop: `1px solid ${palette.gray100}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 12px" }}>
          <MegaMenu tree={tree} />
        </div>
      </div>

      <style>{`
        .site-nav-mobile-trigger { display: none; }
        @media (max-width: 768px) {
          .site-nav-mega-menu-row { display: none; }
          .site-nav-mobile-trigger { display: flex; }
        }
      `}</style>
    </nav>
  );
}
