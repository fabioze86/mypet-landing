import { madPetPalette as palette } from "@/client-theme";

export function Footer({
  mainSiteUrl,
  distribuidoraUrl,
  whatsappLink,
}: {
  mainSiteUrl: string;
  distribuidoraUrl: string;
  whatsappLink: string;
}) {
  return (
    <footer style={{ background: palette.purpleDark, padding: "40px 24px" }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div>
          <p style={{ fontFamily: "var(--font-fredoka)", fontSize: 20, color: palette.white, fontWeight: 700, marginBottom: 8 }}>
            MAD PET
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Uma marca do Grupo AZ (My Pet Brasil)</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, textDecoration: "none" }}>
            Fale no WhatsApp
          </a>
          <a href={mainSiteUrl} style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, textDecoration: "none" }}>
            My Pet Brasil
          </a>
          <a href={distribuidoraUrl} style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, textDecoration: "none" }}>
            Distribuidora Petshop
          </a>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", maxWidth: 320 }}>
          © 2026 MAD PET — Grupo AZ. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
