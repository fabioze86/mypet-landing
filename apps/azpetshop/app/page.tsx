import { Suspense } from "react";
import { CatalogSection } from "@mypet/core/components/catalog-section";
import { SiteNav } from "@mypet/core/components/site-nav";
import { getCategories } from "@mypet/core/catalog";
import { clientConfig } from "@/client.config";
import { canonicalUrl } from "@mypet/core/seo";

const { palette: PALETTE } = clientConfig;

export async function generateMetadata() {
  return {
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/") },
  };
}

async function Catalog({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  const sp = await searchParams;
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 80px" }}>
      <h2 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 16 }}>
        Catálogo
      </h2>
      <CatalogSection
        q={sp.q}
        brand={sp.brand}
        page={sp.page}
        channel={clientConfig.catalogChannel}
        palette={clientConfig.palette}
      />
    </section>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  const categories = await getCategories();
  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        .cta-primary {
          background: ${PALETTE.pink}; color: ${PALETTE.white}; border: none;
          border-radius: 100px; padding: 10px 20px;
          font-family: var(--font-nunito), sans-serif; font-size: 14px; font-weight: 800;
          cursor: pointer; transition: background 0.2s;
        }
        .cta-primary:hover { background: ${PALETTE.pinkDark}; }
        .cat-btn {
          padding: 8px 18px; border-radius: 100px; border: 1.5px solid ${PALETTE.gray200};
          background: ${PALETTE.white}; color: ${PALETTE.gray600};
          font-family: var(--font-nunito), sans-serif; font-size: 14px; font-weight: 600;
          cursor: pointer; text-decoration: none;
        }
        .product-card {
          background: ${PALETTE.white}; border-radius: 16px; border: 1px solid ${PALETTE.gray200};
          overflow: hidden; display: flex; flex-direction: column; cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .product-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.10); }
        @media (max-width: 640px) {
          .products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
        }
      `}</style>

      <SiteNav categories={categories} audienceLabel={null} />

      <Suspense fallback={<p style={{ padding: 24, color: PALETTE.gray600 }}>Carregando catálogo…</p>}>
        <Catalog searchParams={searchParams} />
      </Suspense>

      <footer style={{ background: PALETTE.navyDark, padding: "24px" }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          © 2026 {clientConfig.name}. Todos os direitos reservados.
        </span>
      </footer>
    </div>
  );
}
