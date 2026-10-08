"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useClientConfig } from "../theme";
import { CartBadge } from "./cart-badge";
import { MegaMenu } from "./mega-menu";
import { MobileMenu, type MobileMenuLink } from "./mobile-menu";
import { buildCategoryTree, type CategoryNode } from "../catalog-utils";

export function SiteNav({
  categories,
  balcaoHref,
  pedidoRapidoHref,
  pedidosHref,
  faqHref,
  homeHref = "/",
  audienceLabel,
  showMegaMenu = true,
}: {
  categories: CategoryNode[];
  balcaoHref?: string;
  pedidoRapidoHref?: string;
  pedidosHref?: string;
  faqHref?: string;
  homeHref?: string;
  audienceLabel?: string | null;
  showMegaMenu?: boolean;
}) {
  const { name, tagline, palette, logo } = useClientConfig();
  const tree = buildCategoryTree(categories);
  const navRef = useRef<HTMLElement>(null);

  // Publica a altura real da barra (a linha do mega-menu pode quebrar em mais
  // de uma linha) para elementos fixos logo abaixo, como a busca.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--site-nav-height", `${el.getBoundingClientRect().height}px`);
    publish();
    if (typeof ResizeObserver === "undefined") {
      return () => root.style.removeProperty("--site-nav-height");
    }
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--site-nav-height");
    };
  }, []);

  // No mobile os links de texto saem da barra e vão para o menu (☰), para a
  // marca e o carrinho não disputarem espaço com eles.
  const links: MobileMenuLink[] = [
    ...(pedidoRapidoHref ? [{ href: pedidoRapidoHref, label: "Consulte preços" }] : []),
    ...(balcaoHref ? [{ href: balcaoHref, label: "Balcão de Negócios" }] : []),
    ...(pedidosHref ? [{ href: pedidosHref, label: "Meus pedidos" }] : []),
    ...(faqHref ? [{ href: faqHref, label: "Todas as dúvidas" }] : []),
  ];

  return (
    <nav ref={navRef} style={{ background: palette.white, borderBottom: `1px solid ${palette.gray200}`, position: "sticky", top: 0, zIndex: 100 }}>
      <div className="site-nav-shell" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div className="site-nav-brand-area" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div className="site-nav-mobile-trigger">
            <MobileMenu tree={tree} links={links} />
          </div>
          <Link href={homeHref} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", minWidth: 0 }}>
            <div className="site-nav-logo" style={{ width: 34, height: 34, background: palette.pink, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              <span style={{ fontSize: 18 }}>{logo.emoji}</span>
            </div>
            <div className="site-nav-brand-copy" style={{ minWidth: 0 }}>
              <div className="site-nav-name" style={{ fontWeight: 800, fontSize: 15, color: palette.navy, lineHeight: 1.1 }}>{name}</div>
              <div className="site-nav-tagline" style={{ fontSize: 10, fontWeight: 600, color: palette.pink, letterSpacing: "0.12em", textTransform: "uppercase" }}>{tagline}</div>
            </div>
          </Link>
        </div>
        <div className="site-nav-actions" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {audienceLabel !== null && (
            <span className="site-nav-audience" style={{ fontSize: 13, color: palette.gray600, fontWeight: 600 }}>
              {audienceLabel ?? "Exclusivo para lojistas"}
            </span>
          )}
          {balcaoHref && (
            <Link
              href={balcaoHref}
              className="site-nav-text-link"
              style={{ fontSize: 13, fontWeight: 800, color: palette.pink, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Balcão de Negócios
            </Link>
          )}
          {pedidoRapidoHref && (
            <Link
              href={pedidoRapidoHref}
              className="site-nav-text-link"
              style={{ fontSize: 13, fontWeight: 800, color: palette.pink, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Consulte preços
            </Link>
          )}
          {pedidosHref && (
            <Link
              href={pedidosHref}
              className="site-nav-text-link"
              style={{ fontSize: 13, fontWeight: 600, color: palette.gray600, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Meus pedidos
            </Link>
          )}
          {faqHref && (
            <Link
              href={faqHref}
              className="site-nav-faq-link site-nav-text-link"
              style={{ fontSize: 13, fontWeight: 600, color: palette.gray600, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Todas as dúvidas
            </Link>
          )}
          <CartBadge />
        </div>
      </div>

      {showMegaMenu && (
        <div className="site-nav-mega-menu-row" style={{ borderTop: `1px solid ${palette.gray100}` }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 12px" }}>
            <MegaMenu tree={tree} />
          </div>
        </div>
      )}

      <style>{`
        :root { --site-nav-height: ${showMegaMenu ? 109 : 65}px; }
        .site-nav-mobile-trigger { display: none; }
        .site-nav-name,
        .site-nav-tagline {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media (max-width: 768px) {
          :root { --site-nav-height: 57px; }
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
            font-size: 14px !important;
          }
          .site-nav-tagline {
            font-size: 9px !important;
            letter-spacing: 0.08em !important;
          }
          .site-nav-actions {
            flex: 0 0 auto;
            gap: 8px !important;
          }
          .site-nav-audience,
          .site-nav-text-link {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
}
