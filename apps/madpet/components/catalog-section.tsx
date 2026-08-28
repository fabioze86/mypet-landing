import { madPetPalette as palette, theme } from "@/client-theme";

export function CatalogSection({ children }: { children: React.ReactNode }) {
  return (
    <section id="catalogo" style={{ background: palette.white }}>
      <div style={{ maxWidth: theme.maxWidth, margin: "0 auto", padding: "72px 24px 24px" }}>
        <h2
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: "clamp(26px, 4vw, 34px)",
            fontWeight: 700,
            color: palette.gray800,
            lineHeight: 1.15,
            marginBottom: 12,
          }}
        >
          O catálogo que vai pra sua prateleira
        </h2>
        <p
          style={{
            fontSize: 16,
            color: palette.gray600,
            lineHeight: 1.65,
            maxWidth: "60ch",
          }}
        >
          Quatro linhas, portes do mini ao extra grande. Toque em qualquer item para pedir pelo
          WhatsApp com a condição de revenda.
        </p>
      </div>
      {children}
    </section>
  );
}
