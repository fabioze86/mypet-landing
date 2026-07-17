"use client";

import Link from "next/link";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { useClientConfig } from "../theme";
import type { CategoryTreeNode } from "../catalog-utils";

export function MegaMenu({ tree }: { tree: CategoryTreeNode[] }) {
  const { palette } = useClientConfig();

  if (tree.length === 0) return null;

  return (
    <NavigationMenu.Root style={{ position: "relative" }}>
      <NavigationMenu.List
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          listStyle: "none",
          margin: 0,
          padding: 0,
          flexWrap: "wrap",
        }}
      >
        {tree.map((category) => (
          <NavigationMenu.Item key={category.id}>
            {category.children.length > 0 ? (
              <>
                <NavigationMenu.Trigger className="mega-menu-trigger">
                  {category.name}
                </NavigationMenu.Trigger>
                <NavigationMenu.Content className="mega-menu-content">
                  <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
                    <Link
                      href={`/categoria/${category.slug}`}
                      className="mega-menu-see-all"
                      style={{ color: palette.pink }}
                    >
                      Ver todos os produtos de {category.name} →
                    </Link>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                        gap: 24,
                        marginTop: 20,
                      }}
                    >
                      {category.children.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/categoria/${sub.slug}`}
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: 700,
                            color: palette.navy,
                            textDecoration: "none",
                          }}
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </NavigationMenu.Content>
              </>
            ) : (
              <NavigationMenu.Link asChild>
                <Link href={`/categoria/${category.slug}`} className="mega-menu-trigger">
                  {category.name}
                </Link>
              </NavigationMenu.Link>
            )}
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>

      <div className="mega-menu-viewport-wrapper">
        <NavigationMenu.Viewport className="mega-menu-viewport" />
      </div>

      <style>{`
        .mega-menu-trigger {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 12px 14px;
          background: transparent;
          border: none;
          font-family: 'Nunito', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: ${palette.navy};
          text-decoration: none;
          cursor: pointer;
          border-radius: 8px;
        }
        .mega-menu-trigger:hover,
        .mega-menu-trigger:focus-visible {
          color: ${palette.pink};
          background: ${palette.gray50};
          outline: none;
        }
        .mega-menu-viewport-wrapper {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          z-index: 90;
        }
        .mega-menu-viewport {
          width: 100%;
          background: ${palette.white};
          border: 1px solid ${palette.gray200};
          border-top: none;
          border-radius: 0 0 16px 16px;
          box-shadow: 0 20px 40px rgba(26,52,114,0.12);
          overflow: hidden;
        }
        .mega-menu-content {
          animation: megaMenuFadeOut 0.15s ease forwards;
        }
        .mega-menu-content[data-state="open"] {
          animation: megaMenuFadeIn 0.2s ease forwards;
        }
        @keyframes megaMenuFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes megaMenuFadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-6px); }
        }
        .mega-menu-see-all {
          display: inline-block;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }
      `}</style>
    </NavigationMenu.Root>
  );
}
