import { Suspense } from "react";
import Link from "next/link";
import { CatalogSection } from "@mypet/core/components/catalog-section";
import { SiteNav } from "@mypet/core/components/site-nav";
import { getCategories } from "@mypet/core/catalog";
import { clientConfig } from "@/client.config";
import { canonicalUrl } from "@mypet/core/seo";

const { palette: PALETTE } = clientConfig;
// Acento pontual (selos/etiquetas) fora do token set do core — uso local, só na home.
const LIME = "#C6F135";

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
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <h2 style={{ fontFamily: "var(--font-baloo)", fontSize: 28, fontWeight: 800, color: PALETTE.navy }}>
          Catálogo completo
        </h2>
      </div>
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

function Hero() {
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 8px" }}>
      <div className="hero-grid">
        <div>
          <span className="eyebrow">Loja online AZ Pet Shop</span>
          <h1 className="hero-title">
            Tudo que seu <span style={{ color: PALETTE.orange }}>bicho</span> pede,{" "}
            <br className="hero-break" />
            com o{" "}
            <span style={{ color: PALETTE.cyan, textDecoration: `underline ${LIME}`, textDecorationThickness: 6, textUnderlineOffset: 6 }}>
              preço que cabe
            </span>{" "}
            no seu bolso.
          </h1>
          <p style={{ marginTop: 18, fontSize: 17, color: PALETTE.gray600, maxWidth: "46ch", lineHeight: 1.5 }}>
            Ração, petisco, banho e brincadeira — separado e entregue rapidinho.
            Já colocou tudo no carrinho? Finalize pelo WhatsApp, sem precisar criar conta.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 26, flexWrap: "wrap" }}>
            <a href="#catalogo" className="btn-primary">Ver ofertas da semana</a>
            <Link href="/cotacao" className="btn-secondary">Finalizar pelo WhatsApp</Link>
          </div>
          <div style={{ display: "flex", gap: 26, marginTop: 32, flexWrap: "wrap" }}>
            {[
              ["+1.200", "produtos no catálogo"],
              ["24h", "resposta da cotação"],
              ["4.8★", "avaliação dos tutores"],
            ].map(([n, l]) => (
              <div key={l} style={{ display: "flex", flexDirection: "column" }}>
                <b style={{ fontFamily: "var(--font-baloo)", fontSize: 22, color: PALETTE.cyan }}>{n}</b>
                <span style={{ fontSize: 12.5, color: PALETTE.gray600, fontWeight: 600 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-art">
          <div className="blob-card bc1"><span className="blob-emoji">🍖</span><b>Ração premium</b><span>até 25% OFF</span></div>
          <div className="blob-card bc2"><span className="blob-emoji">🎾</span><b>Brinquedos</b><span>bola, corda &amp; +</span></div>
          <div className="blob-card bc3"><span className="blob-emoji">🦴</span><b>Petiscos naturais</b><span>cães &amp; gatos</span></div>
          <div className="blob-card bc4"><span className="blob-emoji">🏠</span><b>Casinhas</b><span>e camas confort</span></div>
          <div className="sticker">bipou, chegou! 🚀</div>
        </div>
      </div>
    </section>
  );
}

function PromoStrip() {
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
      <div className="promo-grid">
        <div className="promo-card" style={{ background: PALETTE.orange, color: PALETTE.white }}>
          <span className="promo-tag" style={{ background: "rgba(255,255,255,.25)" }}>Clube AZ</span>
          <h3>Assine e ganhe 10% em toda ração</h3>
          <p>Entrega programada, sem taxa, cancele quando quiser.</p>
        </div>
        <div className="promo-card" style={{ background: PALETTE.navy, color: PALETTE.gray50 }}>
          <span className="promo-tag" style={{ background: "rgba(255,255,255,.18)" }}>Novidade</span>
          <h3>Linha natural pet</h3>
          <p>Petiscos sem conservante, direto da fábrica.</p>
        </div>
        <div className="promo-card" style={{ background: PALETTE.white, color: PALETTE.navy, border: `2px solid ${PALETTE.navy}` }}>
          <span className="promo-tag" style={{ background: LIME, color: PALETTE.navy }}>Sem conta</span>
          <h3>Cotação por WhatsApp</h3>
          <p>Monte o carrinho e finalize direto pelo Zap.</p>
        </div>
      </div>
    </section>
  );
}

function QuoteCta() {
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 24px 40px" }}>
      <div className="quote-box">
        <div style={{ position: "relative" }}>
          <h2 style={{ fontFamily: "var(--font-baloo)", fontSize: 26, fontWeight: 800, maxWidth: "22ch" }}>
            Não achou o produto ou quer preço pra revenda?
          </h2>
          <p style={{ fontSize: 15, opacity: 0.85, margin: "10px 0 0", maxWidth: "48ch" }}>
            Manda a lista pro nosso WhatsApp — sem precisar criar login. A gente confere
            estoque e responde com valor e prazo de entrega.
          </p>
        </div>
        <Link href="/cotacao" className="btn-whats">Chamar no WhatsApp</Link>
      </div>
    </section>
  );
}

function TrustRow() {
  const items = [
    ["🚚", "Entrega rápida", "Mesmo dia na capital, em até 3 dias no resto do país."],
    ["💳", "Pagamento seguro", "Pix, cartão em até 6x e boleto para revenda."],
    ["💬", "Atendimento humano", "Time que entende de bicho responde sua dúvida."],
    ["🛡️", "Garantia do tutor", "Produto com problema, troca sem burocracia."],
  ];
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 24px 20px" }}>
      <div className="trust-grid">
        {items.map(([icon, title, desc]) => (
          <div key={title} className="trust-item">
            <div className="trust-ic">{icon}</div>
            <div>
              <b style={{ display: "block", fontSize: 14, marginBottom: 3, color: PALETTE.navy }}>{title}</b>
              <span style={{ fontSize: 12.5, color: PALETTE.gray600, fontWeight: 600 }}>{desc}</span>
            </div>
          </div>
        ))}
      </div>
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

        .eyebrow {
          font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
          color: ${PALETTE.orange}; display: inline-block; margin-bottom: 14px;
        }
        .hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 36px; align-items: center; }
        .hero-title {
          font-family: var(--font-baloo), sans-serif; font-weight: 800;
          font-size: clamp(30px, 4.4vw, 50px); line-height: 1.06; color: ${PALETTE.navy};
        }
        .hero-art { position: relative; height: 380px; }
        .blob-card {
          position: absolute; border-radius: 26px; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 6px; text-align: center; padding: 14px;
          box-shadow: 6px 6px 0 rgba(36,18,51,0.16);
        }
        .blob-emoji { font-size: 34px; }
        .blob-card b { font-family: var(--font-baloo), sans-serif; font-size: 15px; }
        .blob-card span { font-size: 11.5px; font-weight: 700; opacity: 0.8; }
        .bc1 { width: 180px; height: 180px; background: ${PALETTE.cyan}; color: ${PALETTE.white}; top: 0; left: 20px; transform: rotate(-8deg); }
        .bc2 { width: 160px; height: 160px; background: ${LIME}; color: ${PALETTE.navy}; top: 10px; right: 0; transform: rotate(7deg); }
        .bc3 { width: 190px; height: 140px; background: ${PALETTE.pink}; color: ${PALETTE.white}; bottom: 0; left: 0; transform: rotate(5deg); }
        .bc4 { width: 150px; height: 150px; background: ${PALETTE.gray100}; color: ${PALETTE.navy}; border: 2px solid ${PALETTE.navy}; bottom: 4px; right: 20px; transform: rotate(-6deg); }
        .sticker {
          position: absolute; background: ${PALETTE.navy}; color: ${PALETTE.gray50}; border-radius: 100px;
          padding: 9px 15px; font-weight: 800; font-size: 12px; transform: rotate(-10deg);
          top: 165px; left: 170px; box-shadow: 3px 3px 0 ${PALETTE.orange};
        }

        .btn-primary {
          background: ${PALETTE.orange}; color: ${PALETTE.white}; border: none; border-radius: 100px;
          padding: 15px 26px; font-weight: 800; font-size: 15px; cursor: pointer;
          box-shadow: 5px 5px 0 ${PALETTE.navy}; text-decoration: none; display: inline-block;
          font-family: var(--font-nunito), sans-serif;
        }
        .btn-secondary {
          background: ${PALETTE.white}; color: ${PALETTE.navy}; border: 2px solid ${PALETTE.navy};
          border-radius: 100px; padding: 13px 24px; font-weight: 800; font-size: 15px; cursor: pointer;
          text-decoration: none; display: inline-block; font-family: var(--font-nunito), sans-serif;
        }

        .promo-grid { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 18px; }
        .promo-card { border-radius: 22px; padding: 26px; min-height: 140px; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
        .promo-card h3 { font-family: var(--font-baloo), sans-serif; font-size: 21px; font-weight: 800; }
        .promo-card p { margin: 0; font-size: 13.5px; font-weight: 600; opacity: 0.85; }
        .promo-tag {
          align-self: flex-start; border-radius: 100px; padding: 4px 12px; font-size: 11px;
          font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px;
        }

        .quote-box {
          background: ${PALETTE.cyan}; border-radius: 26px; padding: 40px;
          display: grid; grid-template-columns: 1.2fr auto; gap: 26px; align-items: center;
          color: ${PALETTE.white}; position: relative; overflow: hidden;
        }
        .btn-whats {
          background: ${LIME}; color: ${PALETTE.navy}; border: none; border-radius: 100px;
          padding: 16px 26px; font-weight: 800; font-size: 15px; white-space: nowrap;
          text-decoration: none; display: inline-block; box-shadow: 5px 5px 0 ${PALETTE.navyDark};
          font-family: var(--font-nunito), sans-serif;
        }

        .trust-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .trust-item {
          background: ${PALETTE.white}; border: 2px solid ${PALETTE.navy}; border-radius: 16px;
          padding: 18px; display: flex; gap: 12px; align-items: flex-start;
        }
        .trust-ic {
          width: 36px; height: 36px; border-radius: 10px; background: ${PALETTE.gray100};
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 18px;
        }

        .cta-primary {
          background: ${PALETTE.orange}; color: ${PALETTE.white}; border: none;
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

        footer.site-footer { background: ${PALETTE.navy}; border-radius: 28px 28px 0 0; }

        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr; }
          .hero-art { height: 320px; margin-top: 10px; }
          .promo-grid { grid-template-columns: 1fr; }
          .quote-box { grid-template-columns: 1fr; text-align: left; }
          .trust-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
        }
      `}</style>

      <SiteNav categories={categories} audienceLabel={null} />

      <Hero />
      <PromoStrip />

      <div id="catalogo">
        <Suspense fallback={<p style={{ padding: 24, color: PALETTE.gray600 }}>Carregando catálogo…</p>}>
          <Catalog searchParams={searchParams} />
        </Suspense>
      </div>

      <QuoteCta />
      <TrustRow />

      <footer className="site-footer" style={{ padding: "28px 24px", marginTop: 10 }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          © 2026 {clientConfig.name}. Todos os direitos reservados.
        </span>
      </footer>
    </div>
  );
}
