import { Suspense } from "react";
import { getProductById, getCategories } from "@mypet/core/catalog";
import { getCategoryPath } from "@mypet/core/catalog-utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { SearchBar } from "@mypet/core/components/search-bar";
import { ProductVariantPanel } from "@mypet/core/components/product-variant-panel";
import {
  canonicalUrl,
  metaDescription,
  productJsonLd,
  productGroupJsonLd,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@mypet/core/seo";
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
  const desc = metaDescription(
    product.channelMetaDescription ?? product.channelDescription ?? product.description,
    `${product.name} na ${clientConfig.name}. Preço à vista e pedido pelo WhatsApp.`,
  );
  return {
    title: `${product.name} — ${clientConfig.name}`,
    description: desc,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/produtos/${id}`) },
    openGraph: { title: product.name, description: desc, images: [product.img] },
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
        h1 { font-family: var(--font-baloo), sans-serif; font-weight: 800 !important; }
        .back-link {
          display: inline-flex; align-items: center; gap: 8px; color: ${PALETTE.navy};
          background: ${PALETTE.white}; border: 2px solid ${PALETTE.navy}; border-radius: 100px;
          padding: 9px 18px; font-family: var(--font-nunito), sans-serif;
          font-size: 14px; font-weight: 800; text-decoration: none; margin-bottom: 24px;
          transition: background 0.15s, color 0.15s;
        }
        .back-link:hover { background: ${PALETTE.navy}; color: ${PALETTE.gray50}; }
        .info-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .info-table td { padding: 10px 0; border-bottom: 1px solid ${PALETTE.gray100}; font-size: 14px; }
        .info-table td.label { color: ${PALETTE.gray600}; font-weight: 600; width: 35%; }
        .info-table td.value { color: ${PALETTE.navyDark}; font-weight: 700; }
      `}</style>
      <SiteNav categories={categories} audienceLabel={null} />
      <SearchBar action="/busca" />
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
  const [product, categories] = await Promise.all([
    getProductById(id, clientConfig.catalogChannel),
    getCategories(),
  ]);
  if (!product) notFound();

  const categoryPath = product.categoryId ? getCategoryPath(categories, product.categoryId) : [];
  const breadcrumbItems = [
    { name: "Início", path: "/" },
    ...categoryPath.map((c) => ({ name: c.name, path: `/categoria/${c.slug}` })),
    { name: product.name, path: `/produtos/${product.id}` },
  ];

  const jsonLd =
    productGroupJsonLd(product, clientConfig.domain) ??
    productJsonLd(product, clientConfig.domain, { offers: true });

  const inStock = (product.stockQty ?? 0) > 0;
  const description = product.channelDescription ?? product.description;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(breadcrumbJsonLd(breadcrumbItems, clientConfig.domain)),
        }}
      />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
      )}

      <nav aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
        <ol
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            listStyle: "none",
            margin: 0,
            padding: 0,
            fontSize: 13,
            color: PALETTE.gray600,
          }}
        >
          {breadcrumbItems.map((item, i) => (
            <li key={item.path} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span aria-hidden="true">/</span>}
              {i === breadcrumbItems.length - 1 ? (
                <span style={{ color: PALETTE.navy, fontWeight: 700 }} aria-current="page">
                  {item.name}
                </span>
              ) : (
                <Link href={item.path} style={{ color: PALETTE.gray600, textDecoration: "none" }}>
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 800,
            padding: "4px 12px",
            borderRadius: 100,
            background: inStock ? PALETTE.green : PALETTE.gray200,
            color: inStock ? PALETTE.white : PALETTE.gray600,
          }}
        >
          {inStock ? "Em estoque" : "Esgotado"}
        </span>
      </div>

      <ProductVariantPanel product={product} />

      <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 10 }}>
            Descrição do Produto
          </h2>
          <div
            style={{ fontSize: 15, color: PALETTE.gray600, lineHeight: 1.6, whiteSpace: "pre-line" }}
          >
            {description || (
              <span style={{ color: PALETTE.gray400, fontStyle: "italic" }}>
                Descrição detalhada não cadastrada no catálogo.
              </span>
            )}
          </div>
        </div>

        {(product.weight_kg || product.width_cm || product.height_cm || product.length_cm) && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>
              Especificações Físicas
            </h2>
            <table className="info-table">
              <tbody>
                {product.weight_kg && (
                  <tr>
                    <td className="label">Peso</td>
                    <td className="value">{product.weight_kg} kg</td>
                  </tr>
                )}
                {product.width_cm && (
                  <tr>
                    <td className="label">Largura</td>
                    <td className="value">{product.width_cm} cm</td>
                  </tr>
                )}
                {product.height_cm && (
                  <tr>
                    <td className="label">Altura</td>
                    <td className="value">{product.height_cm} cm</td>
                  </tr>
                )}
                {product.length_cm && (
                  <tr>
                    <td className="label">Comprimento</td>
                    <td className="value">{product.length_cm} cm</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
