import { Suspense } from "react";
import { getProductById, getCategories } from "@mypet/core/catalog";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { ProductVariantPanel } from "@mypet/core/components/product-variant-panel";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id, clientConfig.catalogChannel);
  if (!product) return { title: `Produto não encontrado — ${clientConfig.name}` };
  return {
    title: `${product.name} — ${clientConfig.name}`,
    description: `${product.name} na ${clientConfig.name}. Preço à vista e pedido pelo WhatsApp.`,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/produtos/${id}`) },
    openGraph: {
      title: product.name,
      description: `${product.name} na ${clientConfig.name}.`,
      images: [product.img],
    },
    twitter: { card: "summary_large_image", images: [product.img] },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const categories = await getCategories();

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        .back-link {
          display: inline-flex; align-items: center; gap: 6px; color: ${PALETTE.gray600};
          font-size: 14px; font-weight: 700; text-decoration: none; margin-bottom: 24px;
        }
      `}</style>
      <SiteNav categories={categories} audienceLabel={null} />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px" }}>
        <Link href="/" className="back-link">← Voltar</Link>
        <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando produto…</p>}>
          <ProductDetail params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id, clientConfig.catalogChannel);
  if (!product) notFound();

  return <ProductVariantPanel product={product} />;
}
