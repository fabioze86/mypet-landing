import { Suspense } from "react";
import { getCategories } from "@mypet/core/catalog";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { CategoryListing } from "@mypet/core/components/category-listing";
import { SiteNav } from "@mypet/core/components/site-nav";
import { clientConfig } from "@/client.config";

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
    title: `${node.name} — ${clientConfig.name} Atacado`,
    description: `Confira os produtos de ${node.name} no atacado B2B da ${clientConfig.name}. Preços sob consulta para lojistas.`,
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
  const { slug } = await params;
  const { page } = await searchParams;

  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { margin: 0; }

        .cat-btn {
          padding: 8px 18px;
          border-radius: 100px;
          border: 1.5px solid ${PALETTE.gray200};
          background: ${PALETTE.white};
          color: ${PALETTE.gray600};
          font-family: 'Nunito', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .cat-btn:hover { border-color: ${PALETTE.pink}; color: ${PALETTE.pink}; }

        .product-card {
          background: ${PALETTE.white};
          border-radius: 16px;
          border: 1px solid ${PALETTE.gray200};
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
          cursor: pointer;
          display: flex;
          flex-direction: column;
        }
        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(26,52,114,0.10);
        }

        .unlock-btn {
          width: 100%;
          padding: 11px 0;
          background: ${PALETTE.navy};
          color: ${PALETTE.white};
          border: none;
          border-radius: 10px;
          font-family: 'Nunito', sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          letter-spacing: 0.01em;
        }
        .unlock-btn:hover { background: ${PALETTE.navyDark}; }
        .unlock-btn.revealed { background: ${PALETTE.green}; cursor: default; }

        .cta-primary {
          background: ${PALETTE.pink};
          color: ${PALETTE.white};
          border: none;
          border-radius: 100px;
          padding: 10px 22px;
          font-family: 'Nunito', sans-serif;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s;
        }
        .cta-primary:hover { background: ${PALETTE.pinkDark}; }

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
          font-family: 'Nunito Sans', sans-serif;
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
          font-family: 'Nunito', sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          margin-top: 4px;
          transition: background 0.2s;
        }
        .form-submit:hover { background: ${PALETTE.pinkDark}; }

        @media (max-width: 640px) {
          .products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
          .product-card-media { aspect-ratio: 1 / 1.08 !important; }
          .modal { padding: 28px 20px; }
        }
      `}</style>

      <LeadGateProvider>
        <SiteNav categories={categories} />

        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px" }}>
          <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando categoria…</p>}>
            <CategoryListing slug={slug} page={page} channel={clientConfig.catalogChannel} palette={PALETTE} />
          </Suspense>
        </main>

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
