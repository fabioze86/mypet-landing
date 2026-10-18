import Link from "next/link";
import { PAGES } from "@/lib/pages";

const OPTIONS = [
  { href: PAGES.diagnostico.path, cta: "trio_diagnostico", title: "Comece pelo diagnóstico", text: "Saiba o que trava as vendas e o que corrigir primeiro." },
  { href: PAGES.guias.path, cta: "trio_guias", title: "Aprenda com os guias", text: "Vendor ou seller, Buy Box, listings e Ads, na prática." },
  { href: PAGES.contato.path, cta: "trio_contato", title: "Fale com um especialista", text: "Para implantação ou gestão contínua da sua operação." },
];

export function CtaTrio() {
  return (
    <section className="mx-auto mt-20 max-w-7xl px-4">
      <h2 className="text-3xl font-extrabold tracking-tight text-ink md:text-4xl">Comece a vender melhor na Amazon</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {OPTIONS.map((option) => (
          <Link key={option.href} href={option.href} data-cta={option.cta} className="group rounded-lg border border-line p-6 transition hover:border-accent hover:shadow-md">
            <h3 className="text-lg font-bold text-ink group-hover:text-accent">{option.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{option.text}</p>
            <span aria-hidden className="mt-4 inline-block font-semibold text-accent">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
