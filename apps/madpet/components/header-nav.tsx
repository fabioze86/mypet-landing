import { madPetPalette as palette } from "@/client-theme";

const NAV_LINKS = [
  { href: "#bandanas", label: "Bandanas" },
  { href: "#lacos", label: "Laços" },
  { href: "#peitorais", label: "Peitorais" },
  { href: "#coleiras", label: "Coleiras" },
  { href: "#onde-comprar", label: "Onde Comprar" },
];

export function HeaderNav({
  whatsappLink,
  mainSiteUrl,
}: {
  whatsappLink: string;
  mainSiteUrl: string;
}) {
  return (
    <header
      style={{
        background: palette.white,
        borderBottom: `2px solid ${palette.purpleLight}`,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <a
          href="#topo"
          style={{
            fontFamily: "var(--font-fredoka)",
            fontWeight: 700,
            fontSize: 24,
            color: palette.purple,
            textDecoration: "none",
            transform: "rotate(-3deg)",
            display: "inline-block",
          }}
        >
          MAD PET
        </a>
        <nav aria-label="Seções da página" style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              style={{ color: palette.gray800, fontWeight: 700, fontSize: 14, textDecoration: "none" }}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: palette.green, fontWeight: 800, fontSize: 14, textDecoration: "none" }}
          >
            💬 WhatsApp
          </a>
          <a href={mainSiteUrl} style={{ color: palette.gray600, fontSize: 12, textDecoration: "underline" }}>
            Voltar pro site principal
          </a>
        </div>
      </div>
    </header>
  );
}
