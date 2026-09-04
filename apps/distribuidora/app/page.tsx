import { Suspense } from "react";
import type { Palette } from "@mypet/core/theme";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { CatalogSection } from "@mypet/core/components/catalog-section";
import { getProductCount, getCategories, getCategoriesWithProducts } from "@mypet/core/catalog";
import { SiteNav } from "@mypet/core/components/site-nav";
import { AssistantSearch } from "@mypet/core/components/assistant-search";
import { CategoryChips } from "@mypet/core/components/category-chips";
import { clientConfig, SHOW_ONLY_CATEGORIES_WITH_PRODUCTS } from "@/client.config";
import { canonicalUrl } from "@mypet/core/seo";

const { palette: PALETTE } = clientConfig;

const STATS_STATIC = [
  { icon: "🏪", value: "18 anos", label: "No Mercado Pet" },
  { icon: "📦", value: "…", label: "SKUs no catálogo" },
  { icon: "🚚", value: "99,90", label: "Entrega grátis SP" },
  { icon: "✅", value: "3x", label: "Sem Juros no Cartão" },
];

async function StatsCount({ channel }: { channel: string }) {
  const total = await getProductCount(channel);
  const totalLabel = `${total.toLocaleString("pt-BR")}+`;
  const STATS = [
    { icon: "🏪", value: "18 anos", label: "No Mercado Pet" },
    { icon: "📦", value: totalLabel, label: "SKUs no catálogo" },
    { icon: "🚚", value: "99,90", label: "Entrega grátis SP" },
    { icon: "✅", value: "3x", label: "Sem Juros no Cartão" },
  ];
  return (
    <>
      {STATS.map((s) => (
        <div key={s.label} style={{ padding: "16px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: PALETTE.pink, marginBottom: 2 }}>{s.value}</div>
          <div style={{ fontSize: 12, color: PALETTE.gray600, fontWeight: 600 }}>{s.label}</div>
        </div>
      ))}
    </>
  );
}

async function CatalogContent({
  q,
  brand,
  page,
  channel,
  palette,
}: {
  q?: string;
  brand?: string;
  page?: string;
  channel: string;
  palette: Palette;
}) {
  const total = await getProductCount(channel);
  const totalLabel = `${total.toLocaleString("pt-BR")}+`;
  return (
    <>
      <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
        Mais de {totalLabel} produtos disponíveis no atacado
      </p>
      <CatalogSection q={q} brand={brand} page={page} channel={channel} palette={palette} />
    </>
  );
}

async function DynamicCatalog({
  searchParams,
  channel,
  palette,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
  channel: string;
  palette: Palette;
}) {
  const sp = await searchParams;
  return (
    <section id="catalogo" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 4 }}>Catálogo completo</h2>
      </div>
      <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando catálogo…</p>}>
        <CatalogContent q={sp.q} brand={sp.brand} page={sp.page} channel={channel} palette={palette} />
      </Suspense>
    </section>
  );
}

export async function generateMetadata() {
  return {
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/") },
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  const categories = SHOW_ONLY_CATEGORIES_WITH_PRODUCTS
    ? await getCategoriesWithProducts(clientConfig.catalogChannel)
    : await getCategories();
  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>

      {/* GOOGLE FONTS */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { margin: 0; }

        .cat-btn {
          padding: 8px 18px;
          border-radius: 100px;
          border: 1.5px solid ${PALETTE.gray200};
          background: ${PALETTE.white};
          color: ${PALETTE.gray600};
          font-family: var(--font-nunito), sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .cat-btn:hover { border-color: ${PALETTE.pink}; color: ${PALETTE.pink}; }
        .cat-btn.active {
          background: ${PALETTE.pink};
          border-color: ${PALETTE.pink};
          color: ${PALETTE.white};
        }

        .chip-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 10px 16px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .chip-row::-webkit-scrollbar { display: none; }

        .banner-row {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding: 0 16px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .banner-row::-webkit-scrollbar { display: none; }
        .banner-row-item { scroll-snap-align: start; flex: 0 0 auto; }
        .banner-row-item img { min-width: 280px; }

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
          box-shadow: 0 12px 32px rgba(82,48,120,0.12);
        }

        .unlock-btn {
          width: 100%;
          padding: 11px 0;
          background: ${PALETTE.navy};
          color: ${PALETTE.white};
          border: none;
          border-radius: 10px;
          font-family: var(--font-nunito), sans-serif;
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
        .unlock-btn.revealed {
          background: ${PALETTE.green};
          cursor: default;
        }

        .cta-primary {
          background: ${PALETTE.pink};
          color: ${PALETTE.white};
          border: none;
          border-radius: 100px;
          padding: 16px 36px;
          font-family: var(--font-nunito), sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s;
        }
        .cta-primary:hover { background: ${PALETTE.pinkDark}; transform: scale(1.03); }

        .cta-secondary {
          background: transparent;
          color: ${PALETTE.white};
          border: 2px solid rgba(255,255,255,0.5);
          border-radius: 100px;
          padding: 14px 32px;
          font-family: var(--font-nunito), sans-serif;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }
        .cta-secondary:hover { border-color: white; background: rgba(255,255,255,0.12); }

        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(59,35,87,0.55);
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

        .footer-row {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
          .product-card-media { aspect-ratio: 1 / 1.08 !important; }
          .modal { padding: 28px 20px; }
          .footer-row { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <LeadGateProvider>

        {/* NAV */}
        <SiteNav categories={categories} />

        {/* CATEGORY CHIPS */}
        <CategoryChips categories={categories} />

        {/* COMPACT BANNER — canal de banner é por site, desacoplado do catálogo (ffa_fabrica) */}

        {/* MINI BANNER STRIP */}

        {/* CATALOG */}
        <Suspense fallback={
          <section style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 80px" }}>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 4 }}>Catálogo completo</h2>
            </div>
            <p style={{ color: PALETTE.gray600 }}>Carregando catálogo…</p>
          </section>
        }>
          <DynamicCatalog searchParams={searchParams} channel={clientConfig.catalogChannel} palette={clientConfig.palette} />
        </Suspense>

        {/* ASSISTENTE DE BUSCA COM IA */}
        <div style={{ padding: "0 24px", marginTop: 8 }}>
          <AssistantSearch channel={clientConfig.catalogChannel} palette={clientConfig.palette} />
        </div>

        {/* STATS */}
        <section style={{ background: PALETTE.white, borderBottom: `1px solid ${PALETTE.gray200}`, marginTop: 32 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
            <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
              <Suspense fallback={
                <>
                  {STATS_STATIC.map((s) => (
                    <div key={s.label} style={{ padding: "16px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: PALETTE.pink, marginBottom: 2 }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: PALETTE.gray600, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </>
              }>
                <StatsCount channel={clientConfig.catalogChannel} />
              </Suspense>
            </div>
          </div>
        </section>

        {/* CTA BANNER */}
        <section style={{
          background: `linear-gradient(135deg, ${PALETTE.pink} 0%, ${PALETTE.pinkDark} 100%)`,
          padding: "44px 24px",
        }}>
          <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, margin: "0 auto 16px",
            }}>🐾</div>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: PALETTE.white, marginBottom: 12 }}>
              Um mix pensado para a sua loja vender mais
            </h2>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.88)", lineHeight: 1.65, textAlign: "left" }}>
              <p style={{ marginBottom: 14 }}>
                Reponha o estoque com praticidade: linha de fabricação própria, kits prontos para revenda e produtos de giro para pet shops, banho e tosa.
              </p>
              <p style={{ marginBottom: 14 }}>
                Coleiras, peitorais, guias, laços, bandanas e camas para ampliar seu mix, manter os itens essenciais disponíveis e buscar uma margem mais saudável em cada venda.
              </p>
              <p style={{ marginBottom: 0 }}>
                Conte com entrega em todo o Brasil calculada pelo CEP, campanhas de frete selecionadas, até 3x sem juros no cartão ou desconto no Pix, e atendimento profissional de segunda a sexta. Monte seu pedido com kits de entrada, reposições e itens de alta saída em um só lugar.
              </p>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ background: PALETTE.navyDark, padding: "24px 24px calc(24px + env(safe-area-inset-bottom))" }}>
          <div className="footer-row">
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
