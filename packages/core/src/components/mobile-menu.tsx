"use client";

import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import * as Accordion from "@radix-ui/react-accordion";
import { useClientConfig } from "../theme";
import type { CategoryTreeNode } from "../catalog-utils";

export function MobileMenu({ tree }: { tree: CategoryTreeNode[] }) {
  const { palette } = useClientConfig();
  const [open, setOpen] = useState(false);

  if (tree.length === 0) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Abrir menu de categorias"
          style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: palette.navy, padding: 6 }}
        >
          ☰
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="mobile-menu-overlay" />
        <Dialog.Content className="mobile-menu-content" aria-describedby={undefined}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${palette.gray200}` }}>
            <Dialog.Title style={{ fontSize: 16, fontWeight: 800, color: palette.navy, margin: 0 }}>
              Categorias
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar menu"
                style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: palette.gray600 }}
              >
                ×
              </button>
            </Dialog.Close>
          </div>

          <Accordion.Root type="multiple" style={{ padding: "8px 0" }}>
            {tree.map((category) =>
              category.children.length > 0 ? (
                <Accordion.Item key={category.id} value={category.id} style={{ borderBottom: `1px solid ${palette.gray100}` }}>
                  <Accordion.Header>
                    <Accordion.Trigger className="mobile-menu-accordion-trigger" style={{ color: palette.navy }}>
                      {category.name}
                      <span aria-hidden="true" className="mobile-menu-chevron">⌄</span>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="mobile-menu-accordion-content">
                    <div style={{ padding: "4px 20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                      <Link
                        href={`/categoria/${category.slug}`}
                        onClick={() => setOpen(false)}
                        style={{ fontSize: 13, fontWeight: 800, color: palette.pink, textDecoration: "none" }}
                      >
                        Ver todos de {category.name}
                      </Link>
                      {category.children.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/categoria/${sub.slug}`}
                          onClick={() => setOpen(false)}
                          style={{ fontSize: 14, color: palette.gray600, textDecoration: "none" }}
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              ) : (
                <div key={category.id} style={{ borderBottom: `1px solid ${palette.gray100}` }}>
                  <Link
                    href={`/categoria/${category.slug}`}
                    onClick={() => setOpen(false)}
                    style={{ display: "block", padding: "14px 20px", fontSize: 15, fontWeight: 700, color: palette.navy, textDecoration: "none" }}
                  >
                    {category.name}
                  </Link>
                </div>
              ),
            )}
          </Accordion.Root>

          <style>{`
            .mobile-menu-overlay {
              position: fixed;
              inset: 0;
              background: rgba(15,31,69,0.5);
              z-index: 998;
            }
            .mobile-menu-overlay[data-state="open"] { animation: mobileMenuOverlayShow 0.15s ease; }
            .mobile-menu-content {
              position: fixed;
              inset: 0;
              background: ${palette.white};
              z-index: 999;
              overflow-y: auto;
            }
            .mobile-menu-content[data-state="open"] { animation: mobileMenuSlideIn 0.2s ease; }
            .mobile-menu-content[data-state="closed"] { animation: mobileMenuSlideOut 0.15s ease; }
            .mobile-menu-accordion-trigger {
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 14px 20px;
              background: transparent;
              border: none;
              font-family: 'Nunito', sans-serif;
              font-size: 15px;
              font-weight: 700;
              cursor: pointer;
              text-align: left;
            }
            .mobile-menu-chevron { transition: transform 0.2s; font-size: 16px; }
            .mobile-menu-accordion-trigger[data-state="open"] .mobile-menu-chevron { transform: rotate(180deg); }
            .mobile-menu-accordion-content { overflow: hidden; }
            .mobile-menu-accordion-content[data-state="open"] { animation: mobileAccordionOpen 0.2s ease; }
            .mobile-menu-accordion-content[data-state="closed"] { animation: mobileAccordionClose 0.2s ease; }
            @keyframes mobileMenuOverlayShow { from { opacity: 0; } to { opacity: 1; } }
            @keyframes mobileMenuSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
            @keyframes mobileMenuSlideOut { from { transform: translateX(0); } to { transform: translateX(100%); } }
            @keyframes mobileAccordionOpen { from { height: 0; opacity: 0; } to { height: var(--radix-accordion-content-height); opacity: 1; } }
            @keyframes mobileAccordionClose { from { height: var(--radix-accordion-content-height); opacity: 1; } to { height: 0; opacity: 0; } }
          `}</style>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
