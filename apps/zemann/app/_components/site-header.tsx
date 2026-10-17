import Link from "next/link";
import { MENU_GROUPS, PAGES } from "@/lib/pages";
import { siteConfig } from "@/site.config";
import { CtaLink } from "./cta-link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-white">
      {/* Barra utilitária, como no topo do site da Cloudflare. */}
      <div className="hidden border-b border-line bg-surface md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-6 px-4 py-1.5 text-xs text-ink-soft">
          <a href={`mailto:${siteConfig.email}`} className="hover:text-accent">{siteConfig.email}</a>
          <Link href={PAGES.contato.path} className="hover:text-accent">Fale com um especialista</Link>
        </div>
      </div>

      <div className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-ink">
            Zemann
          </Link>

          {/* Mega menu: abre no hover e no foco do teclado (focus-within), sem JavaScript. */}
          <nav aria-label="Principal" className="hidden flex-1 items-center gap-1 lg:flex">
            {MENU_GROUPS.map((group) => (
              <div key={group.label} className="group relative">
                <button type="button" className="rounded-md px-3 py-2 text-sm font-semibold text-ink hover:text-accent">
                  {group.label} <span aria-hidden>▾</span>
                </button>
                <div className="invisible absolute left-0 top-full w-80 rounded-lg border border-line bg-white p-2 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  {group.items.map(({ page, hint }) => (
                    <Link key={page.path} href={page.path} className="block rounded-md px-3 py-2 hover:bg-surface">
                      <span className="block text-sm font-semibold text-ink">{page.nav ?? page.title}</span>
                      <span className="block text-xs text-muted">{hint}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <CtaLink href={PAGES.contato.path} cta="header_contato" variant="secondary">Falar com especialista</CtaLink>
            <CtaLink href={PAGES.diagnostico.path} cta="header_diagnostico">Agendar diagnóstico</CtaLink>
          </div>

          {/* Menu mobile sem JavaScript: <details> abre e fecha nativamente. */}
          <details className="relative lg:hidden">
            <summary className="cursor-pointer list-none rounded-md border border-line px-3 py-2 text-sm font-semibold">
              Menu
            </summary>
            <nav aria-label="Principal (celular)" className="absolute right-0 mt-2 w-72 rounded-lg border border-line bg-white p-3 shadow-xl">
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
          </details>
        </div>
      </div>
    </header>
  );
}
