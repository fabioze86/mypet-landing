import { madPetPalette as palette } from "@/client-theme";
import { MascotCat } from "./mascot-cat";
import { WaveDivider } from "./wave-divider";

export function Hero({ whatsappLink }: { whatsappLink: string }) {
  return (
    <section
      id="topo"
      style={{
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(120deg, ${palette.green} 0%, ${palette.green} 45%, ${palette.purple} 45%, ${palette.purple} 100%)`,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "72px 24px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <p
            style={{
              fontFamily: "var(--font-fredoka)",
              fontSize: 44,
              fontWeight: 700,
              color: palette.white,
              lineHeight: 1.1,
              marginBottom: 16,
              transform: "rotate(-1deg)",
            }}
          >
            Acessórios com aquele toque mad.
          </p>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.9)", marginBottom: 28, lineHeight: 1.6 }}>
            Bandanas, laços, peitorais e coleiras de fabricação própria — cores vibrantes,
            materiais resistentes, preço-benefício sem enrolação.
          </p>
          <a
            href="#onde-comprar"
            style={{
              display: "inline-block",
              background: palette.white,
              color: palette.purple,
              fontWeight: 800,
              fontSize: 16,
              padding: "14px 32px",
              borderRadius: 100,
              textDecoration: "none",
            }}
          >
            Onde encontrar
          </a>
        </div>
        <MascotCat width={220} color={palette.white} style={{ flexShrink: 0 }} />
      </div>
      <WaveDivider color={palette.white} />
    </section>
  );
}
