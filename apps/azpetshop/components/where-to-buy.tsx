import { madPetPalette as palette } from "@/client-theme";

export function WhereToBuy({
  whatsappLink,
  marketplaceUrl,
  distribuidoraUrl,
}: {
  whatsappLink: string;
  marketplaceUrl: string;
  distribuidoraUrl: string;
}) {
  const channels = [
    {
      title: "WhatsApp direto",
      desc: "Manda mensagem e a gente te ajuda a escolher.",
      href: whatsappLink,
      cta: "Chamar no WhatsApp",
    },
    {
      title: "Marketplace",
      desc: "Compre com a comodidade do seu marketplace favorito.",
      href: marketplaceUrl,
      cta: "Ver no marketplace",
    },
    {
      title: "Distribuidora",
      desc: "Revenda ou compra em maior volume.",
      href: distribuidoraUrl,
      cta: "Falar com a Distribuidora",
    },
  ].filter((c) => c.href !== "");

  return (
    <section id="onde-comprar" style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 24px" }}>
      <h2
        style={{
          fontFamily: "var(--font-fredoka)",
          fontSize: 30,
          fontWeight: 700,
          color: palette.purple,
          marginBottom: 32,
          textAlign: "center",
        }}
      >
        Onde encontrar a MAD PET
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
        {channels.map((c) => (
          <div
            key={c.title}
            style={{ border: `2px solid ${palette.greenLight}`, borderRadius: 20, padding: 28, textAlign: "center" }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, color: palette.gray800, marginBottom: 8 }}>{c.title}</h3>
            <p style={{ fontSize: 14, color: palette.gray600, marginBottom: 20, lineHeight: 1.6 }}>{c.desc}</p>
            <a
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                background: palette.purple,
                color: palette.white,
                fontWeight: 800,
                fontSize: 14,
                padding: "10px 24px",
                borderRadius: 100,
                textDecoration: "none",
              }}
            >
              {c.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
