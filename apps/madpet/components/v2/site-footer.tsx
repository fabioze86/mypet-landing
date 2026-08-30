import { madPetPalette as palette, theme } from "@/client-theme";
import { Logo } from "@/components/logo";

const SOCIALS = [
  {
    label: "Instagram",
    d: "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.5.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .5 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.5 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.5-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.5a3.8 3.8 0 0 1-1.4-.9 3.8 3.8 0 0 1-.9-1.4c-.2-.4-.4-1-.5-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.5-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.5C8.4 2.2 8.8 2.2 12 2.2zm0 3.3a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm0 10.7a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4zm6.8-10.9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z",
  },
  {
    label: "Facebook",
    d: "M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3V13h2.5v8h3.7z",
  },
  {
    label: "YouTube",
    d: "M21.6 7.2s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16 4.1 12 4.1 12 4.1s-4 0-6.8.2c-.4.1-1.3.1-2 .9-.6.6-.8 2-.8 2S2.2 8.8 2.2 10.5v1.6c0 1.6.2 3.3.2 3.3s.2 1.4.8 2c.8.8 1.8.8 2.3.9 1.6.2 6.5.2 6.5.2s4 0 6.8-.2c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.3v-1.6c0-1.6-.2-3.3-.2-3.3zM9.9 14.6V8.9l5.3 2.9-5.3 2.8z",
  },
  {
    label: "TikTok",
    d: "M16.5 3c.4 2.3 1.7 3.7 3.9 3.9v2.7c-1.3.1-2.5-.3-3.9-1.1v5.6c0 4.2-3.4 6.4-6.7 5.3-2.6-.9-3.7-3.9-2.6-6.4.9-2 3-3.1 5.2-2.8v2.8c-.4-.1-.8-.2-1.2-.1-1.2.1-2 1-1.9 2.3.1 1.3 1.3 2.1 2.6 1.8 1-.3 1.6-1.2 1.6-2.4V3h2.9z",
  },
];

export function SiteFooter({
  mainSiteUrl,
  distribuidoraUrl,
  whatsappLink,
}: {
  mainSiteUrl: string;
  distribuidoraUrl: string;
  whatsappLink: string;
}) {
  const linkStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    textDecoration: "none",
    lineHeight: 2,
  };
  const headStyle: React.CSSProperties = {
    color: palette.white,
    fontSize: 13,
    marginBottom: 6,
    fontWeight: 800,
  };

  return (
    <footer style={{ background: palette.purpleDark, padding: "56px 24px 32px" }}>
      <div style={{ maxWidth: theme.maxWidth, margin: "0 auto" }}>
        <div className="mpv2-footer">
          <div style={{ maxWidth: 300 }}>
            <Logo size={22} variant="plain" />
            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.72)",
                marginTop: 14,
                lineHeight: 1.6,
              }}
            >
              Linha própria de acessórios do Grupo AZ. Fabricação própria, venda para revenda.
            </p>
          </div>

          <nav aria-label="Catálogo" style={{ display: "flex", flexDirection: "column" }}>
            <strong style={headStyle}>Catálogo</strong>
            <a href="#bandanas" className="mp-link" style={linkStyle}>Bandanas</a>
            <a href="#lacos" className="mp-link" style={linkStyle}>Laços</a>
            <a href="#peitorais" className="mp-link" style={linkStyle}>Peitorais</a>
            <a href="#coleiras" className="mp-link" style={linkStyle}>Coleiras</a>
          </nav>

          <nav aria-label="Institucional" style={{ display: "flex", flexDirection: "column" }}>
            <strong style={headStyle}>Institucional</strong>
            <a href="#vantagens" className="mp-link" style={linkStyle}>Como comprar para revender</a>
            <a href={mainSiteUrl} className="mp-link" style={linkStyle}>My Pet Brasil</a>
            <a href={distribuidoraUrl} className="mp-link" style={linkStyle}>Distribuidora Petshop</a>
          </nav>

          <nav aria-label="Contato" style={{ display: "flex", flexDirection: "column" }}>
            <strong style={headStyle}>Contato</strong>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mp-link"
              style={linkStyle}
            >
              Falar com o comercial
            </a>
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="mp-link"
                  style={{ color: "rgba(255,255,255,0.82)" }}
                >
                  {/* TODO: apontar para as URLs reais das redes MAD PET */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={s.d} />
                  </svg>
                </a>
              ))}
            </div>
          </nav>
        </div>

        <p
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            marginTop: 40,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          © 2026 MAD PET, Grupo AZ. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
