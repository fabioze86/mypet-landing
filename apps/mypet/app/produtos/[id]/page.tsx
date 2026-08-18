import { Suspense } from "react";
import { getProductById, getCategories } from "@mypet/core/catalog";
import { getCategoryPath } from "@mypet/core/catalog-utils";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { ProductVariantPanel } from "@mypet/core/components/product-variant-panel";
import { productGroupJsonLd, productJsonLd, breadcrumbJsonLd, canonicalUrl, jsonLdScript } from "@mypet/core/seo";
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
    title: `${product.name} — ${clientConfig.name} Atacado`,
    description: `Confira os detalhes de ${product.name} no atacado B2B da ${clientConfig.name}. Solicite cotação sem compromisso.`,
    alternates: { canonical: canonicalUrl(clientConfig.domain, `/produtos/${id}`) },
    openGraph: {
      title: product.name,
      description: `Confira os detalhes de ${product.name} no atacado B2B da ${clientConfig.name}.`,
      images: [product.img],
    },
    twitter: {
      card: "summary_large_image",
      images: [product.img],
    },
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
        html { scroll-behavior: smooth; }
        body { margin: 0; }

        .unlock-btn {
          width: 100%;
          padding: 14px 28px;
          background: ${PALETTE.pink};
          color: ${PALETTE.white};
          border: none;
          border-radius: 12px;
          font-family: var(--font-nunito), sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          letter-spacing: 0.01em;
          box-shadow: 0 4px 12px rgba(229,25,122,0.2);
        }
        .unlock-btn:hover { background: ${PALETTE.pinkDark}; transform: translateY(-1px); }
        .unlock-btn:active { transform: translateY(0); }

        .cta-primary {
          background: ${PALETTE.pink};
          color: ${PALETTE.white};
          border: none;
          border-radius: 100px;
          padding: 10px 22px;
          font-family: var(--font-nunito), sans-serif;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s;
        }
        .cta-primary:hover { background: ${PALETTE.pinkDark}; }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: ${PALETTE.gray600};
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          margin-bottom: 24px;
          transition: color 0.2s;
        }
        .back-link:hover { color: ${PALETTE.pink}; }

        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(15,31,69,0.6);
          display: flex; align-items: center; justify-content: center;
          z-index: 999;
          padding: 16px;
        }
        .modal {
          background: ${PALETTE.white};
          border-radius: 20px;
          padding: 40px 36px;
          width: 100%;
          max-width: 440px;
        }
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid ${PALETTE.gray200};
          border-radius: 10px;
          font-family: var(--font-nunito-sans), sans-serif;
          font-size: 15px;
          color: ${PALETTE.gray800};
          outline: none;
          transition: border-color 0.2s;
          margin-bottom: 12px;
        }
        .form-input:focus { border-color: ${PALETTE.pink}; }
        .form-submit {
          width: 100%;
          padding: 14px;
          background: ${PALETTE.pink};
          color: white;
          border: none;
          border-radius: 10px;
          font-family: var(--font-nunito), sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          margin-top: 4px;
          transition: background 0.2s;
        }
        .form-submit:hover { background: ${PALETTE.pinkDark}; }

        .info-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
        }
        .info-table td {
          padding: 10px 0;
          border-bottom: 1px solid ${PALETTE.gray100};
          font-size: 14px;
        }
        .info-table td.label {
          color: ${PALETTE.gray600};
          font-weight: 600;
          width: 35%;
        }
        .info-table td.value {
          color: ${PALETTE.navyDark};
          font-weight: 700;
        }
      `}</style>

      <LeadGateProvider>
        {/* NAV */}
        <SiteNav categories={categories} />

        {/* CONTAINER */}
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px" }}>
          {/* VOLTAR */}
          <Link href="/" className="back-link">
            ← Voltar ao catálogo
          </Link>

          {/* GRID */}
          <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando produto…</p>}>
            <ProductDetail params={params} />
          </Suspense>
        </main>

        {/* FOOTER */}
        <footer style={{ background: PALETTE.navyDark, padding: "32px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>{clientConfig.logo.emoji}</span>
              <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 14 }}>{clientConfig.name} — {clientConfig.tagline}</span>
            </div>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>© 2026 {clientConfig.name}. Todos os direitos reservados.</span>
          </div>
        </footer>
      </LeadGateProvider>
    </div>
  );
}

async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProductById(id, clientConfig.catalogChannel),
    getCategories(),
  ]);

  if (!product) {
    notFound();
  }

  const categoryPath = product.categoryId ? getCategoryPath(categories, product.categoryId) : [];
  const breadcrumbItems = [
    { name: "Início", path: "/" },
    ...categoryPath.map((c) => ({ name: c.name, path: `/categoria/${c.slug}` })),
    { name: product.name, path: `/produtos/${product.id}` },
  ];

  const jsonLd = productGroupJsonLd(product, clientConfig.domain) ?? productJsonLd(product, clientConfig.domain);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(breadcrumbItems, clientConfig.domain)) }}
      />
      <nav aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
        <ol style={{ display: "flex", flexWrap: "wrap", gap: 6, listStyle: "none", margin: 0, padding: 0, fontSize: 13, color: PALETTE.gray600 }}>
          {breadcrumbItems.map((item, i) => (
            <li key={item.path} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span aria-hidden="true">/</span>}
              {i === breadcrumbItems.length - 1 ? (
                <span style={{ color: PALETTE.navy, fontWeight: 700 }} aria-current="page">{item.name}</span>
              ) : (
                <Link href={item.path} style={{ color: PALETTE.gray600, textDecoration: "none" }}>{item.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      )}

      <ProductVariantPanel product={product} />

      <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 24 }}>
        {/* DESCRIÇÃO */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 10 }}>
            Descrição do Produto
          </h2>
          <div style={{ fontSize: 15, color: PALETTE.gray600, lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {product.description || (
              <span style={{ color: PALETTE.gray400, fontStyle: "italic" }}>
                Descrição detalhada não cadastrada no catálogo. Solicite informações adicionais no momento da cotação.
              </span>
            )}
          </div>
        </div>

        {/* ESPECIFICAÇÕES TÉCNICAS */}
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
