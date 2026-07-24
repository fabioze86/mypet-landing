import { getBanners } from "../banners";
import { UnlockButton } from "./lead-gate";
import type { Palette } from "../theme";
import type { Channel } from "../channels";

export async function HeroSection({ channel, palette }: { channel: Channel; palette: Palette }) {
  const [banner] = await getBanners(channel, "principal");

  if (banner) {
    const image = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={banner.imageUrl} alt={banner.title ?? ""} style={{ width: "100%", display: "block" }} />
    );
    return (
      <section style={{ position: "relative", overflow: "hidden" }}>
        {banner.linkUrl ? <a href={banner.linkUrl}>{image}</a> : image}
      </section>
    );
  }

  return (
    <section style={{
      background: `linear-gradient(135deg, ${palette.navyDark} 0%, ${palette.navy} 60%, #1e4d8a 100%)`,
      padding: "80px 24px 72px",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: "50%", background: palette.pink, opacity: 0.08 }} />
      <div style={{ position: "absolute", bottom: -80, left: "30%", width: 400, height: 400, borderRadius: "50%", background: palette.cyan, opacity: 0.06 }} />

      <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center", position: "relative" }}>
        <div className="fade-up" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 100, padding: "6px 16px", marginBottom: 28,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: palette.cyan, display: "inline-block" }} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>Atacado exclusivo para pet shops • Sem intermediários</span>
        </div>

        <h1 className="fade-up fade-up-1 hero-title" style={{
          fontSize: 52, fontWeight: 900, color: palette.white, lineHeight: 1.15,
          marginBottom: 20, letterSpacing: "-0.02em",
        }}>
          Monte seu pedido em minutos.<br />
          <span style={{ color: palette.cyan }}>Sem precisar falar com ninguém.</span>
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
  );
}
