import { Suspense } from "react";
import { CatalogSection } from "@mypet/core/components/catalog-section";
import { SiteNav } from "@mypet/core/components/site-nav";
import { SearchBar } from "@mypet/core/components/search-bar";
import { getCategories } from "@mypet/core/catalog";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

export const metadata = { robots: { index: false, follow: true } };

async function Resultados({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px 80px" }}>
      <h1
        style={{
          fontFamily: "var(--font-baloo)",
          fontSize: 26,
          fontWeight: 800,
          color: PALETTE.navy,
          marginBottom: 18,
        }}
      >
        {q ? `Resultados para "${q}"` : "Buscar produtos"}
      </h1>
      {q ? (
        <CatalogSection
          q={q}
          page={sp.page}
          channel={clientConfig.catalogChannel}
          palette={clientConfig.palette}
        />
      ) : (
        <p style={{ color: PALETTE.gray600 }}>Digite o que procura no campo acima.</p>
      )}
    </section>
  );
}

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const categories = await getCategories();
  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <SiteNav categories={categories} audienceLabel={null} />
      <SearchBar action="/busca" />
      <Suspense fallback={<p style={{ padding: 24, color: PALETTE.gray600 }}>Buscando…</p>}>
        <Resultados searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
