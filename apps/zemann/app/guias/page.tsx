import Link from "next/link";
import { listGuides } from "@/lib/content";
import { formatDateBR } from "@/lib/format";
import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "../_components/breadcrumbs";

const page = PAGES.guias;
export const metadata = pageMetadata(page);

export default function GuiasPage() {
  const guides = listGuides();
  return (
    <main className="mx-auto max-w-4xl px-4 pt-10">
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: "Guias", path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">{page.title}</h1>
      <p className="mt-4 text-lg text-ink-soft">Escritos por quem opera uma marca na Amazon todos os dias.</p>
      {guides.length === 0 ? (
        <p className="mt-10 text-ink-soft">Os primeiros guias estão em revisão e serão publicados em breve.</p>
      ) : (
        <ul className="mt-10 divide-y divide-line">
          {guides.map((guide) => (
            <li key={guide.slug} className="py-6">
              <Link href={`/guias/${guide.slug}`} className="group block">
                <h2 className="text-xl font-semibold text-ink group-hover:text-accent">{guide.title}</h2>
                <p className="mt-2 text-ink-soft">{guide.description}</p>
                <p className="mt-2 text-sm text-muted">Atualizado em {formatDateBR(guide.updatedAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
