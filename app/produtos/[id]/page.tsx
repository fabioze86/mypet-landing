import { Suspense } from "react";
import { PALETTE, badgeStyle } from "@/lib/theme";
import { getProductById } from "@/lib/catalog";
import { LeadGateProvider, UnlockButton } from "@/components/lead-gate";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return { title: "Produto não encontrado — My Pet Brasil" };

  return {
    title: `${product.name} — My Pet Brasil Atacado`,
    description: `Confira os detalhes de ${product.name} no atacado B2B da My Pet Brasil. Solicite cotação sem compromisso.`,
  };
}

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      {/* GOOGLE FONTS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
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
          font-family: 'Nunito', sans-serif;
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
          font-family: 'Nunito', sans-serif;
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

        @media (max-width: 768px) {
          .detail-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .img-container { height: 300px !important; }
        }
      `}</style>

      <LeadGateProvider>
        {/* NAV */}
        <nav style={{ background: PALETTE.white, borderBottom: `1px solid ${PALETTE.gray200}`, position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <div style={{ width: 34, height: 34, background: PALETTE.pink, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 18 }}>🐾</span>
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, color: PALETTE.navy, lineHeight: 1 }}>My Pet Brasil</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: PALETTE.pink, letterSpacing: "0.12em", textTransform: "uppercase" }}>Atacado B2B</div>
              </div>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: PALETTE.gray600, fontWeight: 600 }}>Exclusivo para lojistas</span>
              <UnlockButton className="cta-primary">
                Solicitar cotação
              </UnlockButton>
            </div>
          </div>
        </nav>

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

async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const styleBadge = product.badge ? badgeStyle(product.badge.code) : null;

  return (
    <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
      {/* COLUNA ESQUERDA - IMAGEM */}
            <div style={{
              background: PALETTE.white,
              border: `1px solid ${PALETTE.gray200}`,
              borderRadius: 20,
              padding: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 4px 20px rgba(26,52,114,0.04)"
            }}>
              <div className="img-container" style={{ width: "100%", height: 450, position: "relative" }}>
                <img
                  src={product.img}
                  alt={product.name}
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              </div>

              {product.badge && styleBadge && (
                <span style={{ position: "absolute", top: 20, left: 20, background: styleBadge.bg, color: styleBadge.color, fontSize: 12, fontWeight: 800, padding: "6px 14px", borderRadius: 100, letterSpacing: "0.02em", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                  {product.badge.label}
                </span>
              )}

              {product.brand && (
                <span style={{ position: "absolute", top: 20, right: 20, background: PALETTE.navyLight, color: PALETTE.navy, fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 100, letterSpacing: "0.04em" }}>
                  {product.brand.toUpperCase()}
                </span>
              )}
            </div>

            {/* COLUNA DIREITA - INFORMAÇÕES */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                {product.brand && (
                  <p style={{ fontSize: 13, color: PALETTE.pink, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                    {product.brand}
                  </p>
                )}
                <h1 style={{ fontSize: 32, fontWeight: 900, color: PALETTE.navy, lineHeight: 1.25, marginBottom: 12 }}>
                  {product.name}
                </h1>
                
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {product.sku && (
                    <span style={{ fontSize: 13, color: PALETTE.gray600, background: PALETTE.gray100, padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>
                      SKU/Ref: {product.sku}
                    </span>
                  )}
                  {product.barcode && (
                    <span style={{ fontSize: 13, color: PALETTE.gray600, background: PALETTE.gray100, padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>
                      EAN/EAC: {product.barcode}
                    </span>
                  )}
                </div>
              </div>

              {/* CARD DE PREÇO / COTAÇÃO */}
              <div style={{
                background: PALETTE.white,
                border: `1px solid ${PALETTE.gray200}`,
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 4px 20px rgba(26,52,114,0.04)"
              }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: PALETTE.gray600, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Atacado B2B</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: PALETTE.pink }}>Preço sob consulta</div>
                  <p style={{ fontSize: 13, color: PALETTE.gray600, marginTop: 4 }}>
                    Venda exclusiva para CNPJ de pet shops e revendedores.
                  </p>
                </div>

                <UnlockButton className="unlock-btn">
                  <span>💬</span> Solicitar cotação deste produto
                </UnlockButton>
              </div>

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
          </div>
  );
}
