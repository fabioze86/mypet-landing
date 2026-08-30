import { madPetPalette as palette, theme } from "@/client-theme";

const ITEMS = [
  {
    title: "Fabricação própria",
    copy: "Linha nossa, do corte ao acabamento. Você repõe o que vende sem esperar contêiner.",
    d: "M3 21V9l9-6 9 6v12M9 21v-6h6v6",
  },
  {
    title: "Giro rápido na gôndola",
    copy: "Cor que para o cliente na prateleira antes de qualquer argumento de venda.",
    d: "M3 17l6-6 4 4 8-8M15 7h6v6",
  },
  {
    title: "Frete grátis por faixa",
    copy: "Fechou a faixa de pedido, o frete sai de graça para todo o Brasil.",
    d: "M3 7h11v8H3zM14 10h4l3 3v2h-7M6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  },
  {
    title: "Pedido pelo WhatsApp",
    copy: "Sem cadastro em portal. Você fala com o comercial e já sai com a condição.",
    d: "M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z",
  },
];

export function AdvantagesStrip() {
  return (
    <section id="vantagens" style={{ background: palette.white, scrollMarginTop: 96 }}>
      <div style={{ maxWidth: theme.maxWidth, margin: "0 auto", padding: "24px 24px 64px" }}>
        <h2
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: "clamp(22px, 3.4vw, 30px)",
            fontWeight: 700,
            color: palette.gray800,
            textAlign: "center",
            marginBottom: 36,
          }}
        >
          Vantagens em revender MAD PET
        </h2>
        <div className="mpv2-adv">
          {ITEMS.map((item) => (
            <div key={item.title} style={{ textAlign: "center", padding: "0 8px" }}>
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke={palette.purple}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ marginBottom: 12 }}
              >
                <path d={item.d} />
              </svg>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: palette.gray800, marginBottom: 6 }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 13.5, color: palette.gray600, lineHeight: 1.6 }}>{item.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
