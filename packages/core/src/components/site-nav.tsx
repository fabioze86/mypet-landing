"use client";

import Link from "next/link";
import { useClientConfig } from "../theme";
import { CartBadge } from "./cart-badge";
import { MegaMenu } from "./mega-menu";
import { MobileMenu } from "./mobile-menu";
import { buildCategoryTree, type CategoryNode } from "../catalog-utils";

export function SiteNav({ categories }: { categories: CategoryNode[] }) {
  const { name, tagline, palette, logo } = useClientConfig();
  const tree = buildCategoryTree(categories);

  return (
    <nav style={{ background: palette.white, borderBottom: `1px solid ${palette.gray200}`, position: "sticky", top: 0, zIndex: 100 }}>
      <div className="site-nav-shell" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div className="site-nav-brand-area" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div className="site-nav-mobile-trigger">
            <MobileMenu tree={tree} />
          </div>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", minWidth: 0 }}>
            <div className="site-nav-logo" style={{ width: 34, height: 34, background: palette.pink, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              <span style={{ fontSize: 18 }}>{logo.emoji}</span>
            </div>
            <div className="site-nav-brand-copy" style={{ minWidth: 0 }}>
              <div className="site-nav-name" style={{ fontWeight: 900, fontSize: 15, color: palette.navy, lineHeight: 1 }}>{name}</div>
              <div className="site-nav-tagline" style={{ fontSize: 10, fontWeight: 600, color: palette.pink, letterSpacing: "0.12em", textTransform: "uppercase" }}>{tagline}</div>
            </div>
          </Link>
        </div>
        <div className="site-nav-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="site-nav-audience" style={{ fontSize: 13, color: palette.gray600, fontWeight: 600 }}>Exclusivo para lojistas</span>
          <CartBadge />
        </div>
      </div>

      <div className="site-nav-mega-menu-row" style={{ borderTop: `1px solid ${palette.gray100}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 12px" }}>
          <MegaMenu tree={tree} />
        </div>
      </div>

      <style>{`
        .site-nav-mobile-trigger { display: none; }
        .site-nav-name {
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 768px) {
          .site-nav-mega-menu-row { display: none; }
          .site-nav-mobile-trigger { display: flex; }
          .site-nav-shell {
            height: 56px !important;
            padding: 0 12px !important;
            gap: 8px !important;
          }
          .site-nav-brand-area {
            flex: 1 1 auto;
            overflow: hidden;
          }
          .site-nav-logo {
            width: 30px !important;
            height: 30px !important;
            border-radius: 8px !important;
          }
          .site-nav-name {
            max-width: 150px;
            font-size: 13px !important;
            line-height: 1.05 !important;
          }
          .site-nav-tagline {
            font-size: 9px !important;
            letter-spacing: 0.06em !important;
            white-space: nowrap;
          }
          .site-nav-actions {
            flex: 0 0 auto;
            gap: 8px !important;
          }
          .site-nav-audience {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
}
