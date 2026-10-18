import Link from "next/link";
import type { CtaTarget, GuideMeta } from "@/lib/content";
import { formatDateBR } from "@/lib/format";
import { PAGES } from "@/lib/pages";
import { siteConfig } from "@/site.config";

export const CTA_BY_TARGET: Record<CtaTarget, { title: string; text: string; href: string; label: string }> = {
  marcas: {
    title: "Sua marca na Amazon com método",
    text: "Veja como a Zemann trabalha com marcas e indústrias.",
    href: PAGES.marcas.path,
    label: "Consultoria para marcas",
  },
  sellers: {
    title: "Voltar a crescer na Amazon",
    text: "Veja como a Zemann trabalha com sellers estabelecidos.",
    href: PAGES.sellers.path,
    label: "Consultoria para sellers",
  },
  diagnostico: {
    title: "Quer esse olhar na sua conta?",
    text: "O diagnóstico mostra o que trava as vendas e o que corrigir primeiro.",
    href: PAGES.diagnostico.path,
    label: "Agendar diagnóstico",
  },
};

export function ContentHeader({ meta }: { meta: GuideMeta }) {
  return (
    <header>
      <h1 className="mt-6 text-3xl font-extrabold leading-tight text-ink md:text-5xl">{meta.title}</h1>
      {/* Resposta direta logo abaixo do título: o trecho que buscadores e assistentes de IA citam. */}
      <p className="mt-6 rounded-lg border-l-4 border-accent bg-accent-soft/50 p-5 text-lg leading-relaxed text-ink">
        {meta.answer}
      </p>
      <p className="mt-4 text-sm text-muted">
        Por <Link href={PAGES.sobre.path} className="font-medium text-ink hover:text-accent">{siteConfig.founder.name}</Link>
        {" · "}Publicado em <time dateTime={meta.publishedAt}>{formatDateBR(meta.publishedAt)}</time>
        {meta.updatedAt !== meta.publishedAt ? (
          <>
            {" · "}Atualizado em <time dateTime={meta.updatedAt}>{formatDateBR(meta.updatedAt)}</time>
          </>
        ) : null}
      </p>
    </header>
  );
}
