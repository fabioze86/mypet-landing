import { notFound } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { getCategories } from "@mypet/core/catalog";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { POLITICAS, getPolitica } from "@/lib/politicas";

const { palette: PALETTE } = clientConfig;

export function generateStaticParams() {
  return POLITICAS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const politica = getPolitica(slug);
  if (!politica) return { title: `Página não encontrada — ${clientConfig.name}` };
  return {
    title: `${politica.titulo} — ${clientConfig.name}`,
    description: politica.resumo,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/politicas/${politica.slug}`) },
  };
}

export default async function PoliticaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const politica = getPolitica(slug);
  if (!politica) notFound();
  const categories = await getCategories();

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <SiteNav categories={categories} audienceLabel={null} />
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ fontFamily: "var(--font-baloo)", fontSize: 32, fontWeight: 800, color: PALETTE.navy }}>
          {politica.titulo}
        </h1>
        <p style={{ marginTop: 8, fontSize: 16, color: PALETTE.gray600 }}>{politica.resumo}</p>
        {politica.secoes.map((secao) => (
          <section key={secao.titulo} style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>{secao.titulo}</h2>
            {secao.paragrafos.map((p) => (
              <p key={p} style={{ fontSize: 15, lineHeight: 1.65, color: PALETTE.gray600, marginTop: 8 }}>{p}</p>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
