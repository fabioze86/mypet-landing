import { madPetPalette as palette, theme } from "@/client-theme";
import { Logo } from "./logo";

const NAV_LINKS = [
  { href: "#bandanas", label: "Bandanas" },
  { href: "#lacos", label: "Laços" },
  { href: "#peitorais", label: "Peitorais" },
  { href: "#coleiras", label: "Coleiras" },
  { href: "#como-comprar", label: "Como comprar" },
];

export function HeaderNav({ whatsappLink }: { whatsappLink: string }) {
  return (
    <header
      style={{
        background: palette.white,
        borderBottom: `1px solid ${palette.purpleLight}`,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: theme.maxWidth,
          margin: "0 auto",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <a href="#topo" aria-label="MAD PET, ir para o início" style={{ display: "inline-flex", flexShrink: 0 }}>
          <Logo size={20} />
        </a>

        <nav
          aria-label="Seções da página"
          style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="mp-link"
              style={{
                color: palette.gray800,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mp-btn mp-btn-green"
            style={{
              background: palette.greenDark,
              color: palette.white,
              fontWeight: 800,
              fontSize: 14,
              padding: "10px 20px",
              borderRadius: theme.radiusPill,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Quero revender
          </a>
        </div>
      </div>
    </header>
  );
}
