import { Suspense } from "react";
import { PALETTE } from "@mypet/core/theme";
import { LeadGateProvider, UnlockButton } from "@mypet/core/components/lead-gate";
import { CatalogSection } from "@mypet/core/components/catalog-section";
import { getProductCount } from "@mypet/core/catalog";
import { SiteNav } from "@mypet/core/components/site-nav";

const STATS_STATIC = [
  { value: "10.000+", label: "Pet shops ativos" },
  { value: "…", label: "SKUs no catálogo" },
  { value: "48h", label: "Entrega média SP" },
  { value: "R$0", label: "Taxa de cadastro" },
];

async function StatsCount() {
  const total = await getProductCount();
  const totalLabel = `${total.toLocaleString("pt-BR")}+`;
  const STATS = [
    { value: "10.000+", label: "Pet shops ativos" },
    { value: totalLabel, label: "SKUs no catálogo" },
    { value: "48h", label: "Entrega média SP" },
    { value: "R$0", label: "Taxa de cadastro" },
  ];
  return (
    <>
      {STATS.map((s, i) => (
        <div key={s.label} style={{
          padding: "28px 24px",
          borderRight: i < 3 ? `1px solid ${PALETTE.gray200}` : "none",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: PALETTE.pink, marginBottom: 4 }}>{s.value}</div>
          <div style={{ fontSize: 14, color: PALETTE.gray600, fontWeight: 600 }}>{s.label}</div>
        </div>
      ))}
    </>
  );
}

async function CatalogContent({
  q,
  brand,
  page,
}: {
  q?: string;
  brand?: string;
  page?: string;
}) {
  const total = await getProductCount();
  const totalLabel = `${total.toLocaleString("pt-BR")}+`;
  return (
    <>
      <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
        Mais de {totalLabel} produtos disponíveis no atacado
      </p>
      <CatalogSection q={q} brand={brand} page={page} />
    </>
  );
}

async function DynamicCatalog({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  const sp = await searchParams;
  return (
    <section id="catalogo" style={{ maxWidth: 1200, margin: "0 auto", padding: "52px 24px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 4 }}>Catálogo completo</h2>
      </div>
      <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando catálogo…</p>}>
        <CatalogContent q={sp.q} brand={sp.brand} page={sp.page} />
      </Suspense>
    </section>
  );
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>

      {/* GOOGLE FONTS */}
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
        .cat-btn.active {
          background: ${PALETTE.pink};
          border-color: ${PALETTE.pink};
          color: ${PALETTE.white};
        }

        .product-card {
          background: ${PALETTE.white};
          border-radius: 16px;
          border: 1px solid ${PALETTE.gray200};
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
          cursor: pointer;
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
          font-family: 'Nunito', sans-serif;
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
          font-family: 'Nunito', sans-serif;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }
        .cta-secondary:hover { border-color: white; background: rgba(255,255,255,0.12); }

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

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.6s ease both; }
        .fade-up-1 { animation-delay: 0.1s; }
        .fade-up-2 { animation-delay: 0.2s; }
        .fade-up-3 { animation-delay: 0.3s; }

        @media (max-width: 640px) {
          .hero-title { font-size: 32px !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .products-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .modal { padding: 28px 20px; }
        }
      `}</style>

      <LeadGateProvider>

        {/* NAV */}
        <SiteNav />

        {/* HERO */}
        <section style={{
          background: `linear-gradient(135deg, ${PALETTE.navyDark} 0%, ${PALETTE.navy} 60%, #1e4d8a 100%)`,
          padding: "80px 24px 72px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* decorative circles */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: "50%", background: PALETTE.pink, opacity: 0.08 }} />
          <div style={{ position: "absolute", bottom: -80, left: "30%", width: 400, height: 400, borderRadius: "50%", background: PALETTE.cyan, opacity: 0.06 }} />

          <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center", position: "relative" }}>
            <div className="fade-up" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 100, padding: "6px 16px", marginBottom: 28,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: PALETTE.cyan, display: "inline-block" }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>Atacado exclusivo para pet shops • Sem intermediários</span>
            </div>

            <h1 className="fade-up fade-up-1 hero-title" style={{
              fontSize: 52, fontWeight: 900, color: PALETTE.white, lineHeight: 1.15,
              marginBottom: 20, letterSpacing: "-0.02em",
            }}>
              Monte seu pedido em minutos.<br />
              <span style={{ color: PALETTE.cyan }}>Sem precisar falar com ninguém.</span>
            </h1>

            <p className="fade-up fade-up-2" style={{ fontSize: 18, color: "rgba(255,255,255,0.75)", marginBottom: 36, maxWidth: 580, margin: "0 auto 36px", lineHeight: 1.6 }}>
              Catálogo completo de ração, higiene, brinquedos e mais com preços sob consulta para lojistas.
            </p>

            <div className="fade-up fade-up-3" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 48 }}>
              <UnlockButton className="cta-primary">
                💬 Solicitar cotação
              </UnlockButton>
              <a href="#catalogo" className="cta-secondary" style={{ textDecoration: "none", display: "inline-block" }}>
                Ver catálogo
              </a>
            </div>

            {/* pills */}
            <p className="fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {["✅ Cadastro em 10 segundos", "📦 Estoque em tempo real", "🚚 Entrega em 48h SP", "💬 Sem atendimento necessário", "🏷️ Preços sob consulta"].map((t) => (
                <span key={t} style={{
                  background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 100, padding: "6px 14px", fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 600,
                }}>{t}</span>
              ))}
            </p>
          </div>
        </section>

        {/* STATS */}
        <section style={{ background: PALETTE.white, borderBottom: `1px solid ${PALETTE.gray200}` }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
            <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
              <Suspense fallback={
                <>
                  {STATS_STATIC.map((s, i) => (
                    <div key={s.label} style={{
                      padding: "28px 24px",
                      borderRight: i < 3 ? `1px solid ${PALETTE.gray200}` : "none",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 30, fontWeight: 900, color: PALETTE.pink, marginBottom: 4 }}>{s.value}</div>
                      <div style={{ fontSize: 14, color: PALETTE.gray600, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </>
              }>
                <StatsCount />
              </Suspense>
            </div>
          </div>
        </section>

        {/* CATALOG */}
        <Suspense fallback={
          <section style={{ maxWidth: 1200, margin: "0 auto", padding: "52px 24px 80px" }}>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 4 }}>Catálogo completo</h2>
            </div>
            <p style={{ color: PALETTE.gray600 }}>Carregando catálogo…</p>
          </section>
        }>
          <DynamicCatalog searchParams={searchParams} />
        </Suspense>

        {/* CTA BANNER */}
        <section style={{
          background: `linear-gradient(135deg, ${PALETTE.pink} 0%, ${PALETTE.pinkDark} 100%)`,
          padding: "64px 24px",
        }}>
          <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🐾</div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: PALETTE.white, marginBottom: 12 }}>
              Pronto para comprar no atacado?
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.82)", marginBottom: 32, lineHeight: 1.6 }}>
              Mais de 10.000 pet shops já compram pela My Pet Brasil. Cadastro gratuito, sem burocracia e cotações sob consulta.
            </p>
            <UnlockButton className="cta-secondary" style={{ fontSize: 16 }}>
              Solicitar cotação agora
            </UnlockButton>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ background: PALETTE.navyDark, padding: "32px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🐾</span>
              <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 14 }}>My Pet Brasil — Atacado B2B</span>
            </div>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>© 2026 My Pet Brasil. Todos os direitos reservados.</span>
          </div>
        </footer>

      </LeadGateProvider>
    </div>
  );
}
