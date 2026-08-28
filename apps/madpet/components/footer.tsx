import { madPetPalette as palette, theme } from "@/client-theme";
import { Logo } from "./logo";

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
    <footer style={{ background: palette.purpleDark, padding: "48px 24px" }}>
      <div
        style={{
          maxWidth: theme.maxWidth,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 28,
        }}
      >
        <div style={{ maxWidth: 320 }}>
          <Logo size={22} variant="plain" />
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", marginTop: 14, lineHeight: 1.6 }}>
            Linha própria de acessórios do Grupo AZ. Fabricação própria, venda para revenda.
          </p>
        </div>

        <nav aria-label="Links do rodapé" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mp-link"
            style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, textDecoration: "none" }}
          >
            Falar com o comercial
          </a>
          <a href="#como-comprar" className="mp-link" style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, textDecoration: "none" }}>
            Como comprar para revender
          </a>
          <a href={mainSiteUrl} className="mp-link" style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, textDecoration: "none" }}>
            My Pet Brasil
          </a>
          <a href={distribuidoraUrl} className="mp-link" style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, textDecoration: "none" }}>
            Distribuidora Petshop
          </a>
        </nav>

        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", maxWidth: 260, lineHeight: 1.6 }}>
          © 2026 MAD PET, Grupo AZ. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
