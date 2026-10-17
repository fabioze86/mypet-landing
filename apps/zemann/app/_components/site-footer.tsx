import Link from "next/link";
import { MENU_GROUPS } from "@/lib/pages";
import { siteConfig } from "@/site.config";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-footer text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold">Zemann</p>
          <p className="mt-2 text-sm text-white/70">{siteConfig.tagline}.</p>
          <p className="mt-4 text-sm">
            <a href={`mailto:${siteConfig.email}`} className="font-medium text-accent-soft hover:underline">
              {siteConfig.email}
            </a>
          </p>
        </div>
        {MENU_GROUPS.map((group) => (
          <nav key={group.label} aria-label={`Rodapé — ${group.label}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-white/50">{group.label}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {group.items.map(({ page }) => (
                <li key={page.path}>
                  <Link href={page.path} className="text-white/80 hover:text-white">
                    {page.nav ?? page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl space-y-1 px-4 py-6 text-xs leading-relaxed text-white/60">
          <p>
            {siteConfig.legalName} · CNPJ {siteConfig.cnpj}
          </p>
          <p>Amazon é marca registrada da Amazon.com, Inc. ou de suas afiliadas. A Zemann não é afiliada à Amazon.</p>
          <p>© {year} Zemann. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
