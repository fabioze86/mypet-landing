"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { MENU_GROUPS, PAGES } from "@/lib/pages";
import { CtaLink } from "./cta-link";

// Fecha o menu quando o clique foi em um link dentro do painel.
function closeOnLink(close: () => void) {
  return (e: React.MouseEvent) => {
    if ((e.target as Element).closest("a")) close();
  };
}

export function HeaderMenus() {
  const pathname = usePathname();
  const baseId = useId();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const desktopRef = useRef<HTMLElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  // Fecha tudo quando a rota muda (o cabeçalho não é remontado na navegação do cliente).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpenGroup(null);
    setMobileOpen(false);
  }

  const anyOpen = openGroup !== null || mobileOpen;
  useEffect(() => {
    if (!anyOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (openGroup) buttons.current.get(openGroup)?.focus();
      setOpenGroup(null);
      setMobileOpen(false);
    }
    function onPointer(e: Event) {
      const t = e.target as Node;
      if (!desktopRef.current?.contains(t)) setOpenGroup(null);
      if (!mobileRef.current?.contains(t)) setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [anyOpen, openGroup]);

  return (
    <>
      {/* Mega menu: abre por clique/toque e também no hover (desktop); Esc e clique fora fecham. */}
      <nav ref={desktopRef} aria-label="Principal" className="hidden flex-1 items-center gap-1 lg:flex">
        {MENU_GROUPS.map((group, i) => {
          const panelId = `${baseId}-panel-${i}`;
          const open = openGroup === group.label;
          return (
            <div key={group.label} className="group relative">
              <button
                type="button"
                ref={(el) => {
                  if (el) buttons.current.set(group.label, el);
                  else buttons.current.delete(group.label);
                }}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenGroup(open ? null : group.label)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-ink hover:text-accent"
              >
                {group.label} <span aria-hidden>▾</span>
              </button>
              <div
                id={panelId}
                onClick={closeOnLink(() => setOpenGroup(null))}
                className={`absolute left-0 top-full w-80 rounded-lg border border-line bg-white p-2 shadow-xl transition group-hover:visible group-hover:opacity-100 ${open ? "visible opacity-100" : "invisible opacity-0"}`}
              >
                {group.items.map(({ page, hint }) => (
                  <Link key={page.path} href={page.path} className="block rounded-md px-3 py-2 hover:bg-surface">
                    <span className="block text-sm font-semibold text-ink">{page.nav ?? page.title}</span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div ref={mobileRef} className="relative lg:hidden">
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls={`${baseId}-mobile`}
          onClick={() => setMobileOpen(!mobileOpen)}
          className="cursor-pointer rounded-md border border-line px-3 py-2 text-sm font-semibold"
        >
          Menu
        </button>
        <nav
          id={`${baseId}-mobile`}
          aria-label="Principal (celular)"
          hidden={!mobileOpen}
          onClick={closeOnLink(() => setMobileOpen(false))}
          className="absolute right-0 mt-2 w-72 rounded-lg border border-line bg-white p-3 shadow-xl"
        >
          {MENU_GROUPS.map((group) => (
            <div key={group.label} className="py-2">
              <p className="px-3 text-xs font-bold uppercase tracking-wide text-muted">{group.label}</p>
              {group.items.map(({ page }) => (
                <Link key={page.path} href={page.path} className="block rounded-md px-3 py-2 text-sm text-ink hover:bg-surface">
                  {page.nav ?? page.title}
                </Link>
              ))}
            </div>
          ))}
          <CtaLink href={PAGES.diagnostico.path} cta="menu_diagnostico" className="mt-2 w-full">
            Agendar diagnóstico
          </CtaLink>
        </nav>
      </div>
    </>
  );
}
