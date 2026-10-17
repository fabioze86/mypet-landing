import Link from "next/link";
import { PAGES } from "@/lib/pages";
import { siteConfig } from "@/site.config";
import { CtaLink } from "./cta-link";
import { HeaderMenus } from "./header-menus";

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

          <HeaderMenus />

          <div className="hidden items-center gap-2 lg:flex">
            <CtaLink href={PAGES.contato.path} cta="header_contato" variant="secondary">Falar com especialista</CtaLink>
            <CtaLink href={PAGES.diagnostico.path} cta="header_diagnostico">Agendar diagnóstico</CtaLink>
          </div>
        </div>
      </div>
    </header>
  );
}
