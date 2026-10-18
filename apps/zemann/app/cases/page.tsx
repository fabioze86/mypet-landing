import Link from "next/link";
import { listCases } from "@/lib/content";
import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "../_components/breadcrumbs";

const page = PAGES.cases;
export const metadata = pageMetadata(page);

export default function CasesPage() {
  const cases = listCases();
  return (
    <main id="conteudo" className="mx-auto max-w-5xl px-4 pt-10">
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: "Cases", path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">{page.title}</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">
        Cada case mostra o problema, a solução e o impacto — com o que foi construído e por quê.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {cases.map((item) => (
          <Link key={item.slug} href={`/cases/${item.slug}`} className="rounded-lg border border-line p-6 transition-colors hover:border-accent">
            <p className="text-sm font-semibold text-accent">{item.client}</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">{item.title}</h2>
            <p className="mt-2 text-ink-soft">{item.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
