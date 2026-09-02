import { Suspense } from "react";
import { getCategories } from "@mypet/core/catalog";
import { CategoryListing } from "@mypet/core/components/category-listing";
import { SiteNav } from "@mypet/core/components/site-nav";
import type { Palette } from "@mypet/core/theme";
import { clientConfig } from "@/client.config";
import { canonicalUrl } from "@mypet/core/seo";

const { palette: PALETTE } = clientConfig;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categories = await getCategories();
  const node = categories.find((c) => c.slug === slug);
  if (!node) return { title: `Categoria não encontrada — ${clientConfig.name}` };
  return {
    title: `${node.name} — ${clientConfig.name}`,
    description: `Produtos de ${node.name} na ${clientConfig.name}. Preços à vista, pedido pelo WhatsApp.`,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/categoria/${slug}`) },
    openGraph: { title: node.name, description: `Produtos de ${node.name} na ${clientConfig.name}.` },
  };
}

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const categories = await getCategories();

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        .cat-btn {
          padding: 8px 18px; border-radius: 100px; border: 1.5px solid ${PALETTE.gray200};
          background: ${PALETTE.white}; color: ${PALETTE.gray600};
          font-family: var(--font-nunito), sans-serif; font-size: 14px; font-weight: 600;
          cursor: pointer; text-decoration: none;
        }
        .product-card {
          background: ${PALETTE.white}; border-radius: 16px; border: 1px solid ${PALETTE.gray200};
          overflow: hidden; display: flex; flex-direction: column; cursor: pointer;
        }
        @media (max-width: 640px) {
          .products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
        }
      `}</style>
      <SiteNav categories={categories} audienceLabel={null} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando…</p>}>
          <CategoryListingResolved
            params={params}
            searchParams={searchParams}
            channel={clientConfig.catalogChannel}
            palette={PALETTE}
          />
        </Suspense>
      </div>
    </div>
  );
}

async function CategoryListingResolved({
  params,
  searchParams,
  channel,
  palette,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
  channel: string;
  palette: Palette;
}) {
  const { slug } = await params;
  const { page } = await searchParams;
  return (
    <CategoryListing
      slug={slug}
      page={page}
      channel={channel}
      palette={palette}
      domain={clientConfig.domain}
    />
  );
}
