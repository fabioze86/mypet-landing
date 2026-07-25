import { madPetPalette as palette } from "@/client-theme";

const FAQ_ITEMS = [
  {
    q: "Quais tamanhos estão disponíveis?",
    a: "Bandanas e laços vêm em tamanho único ajustável. Peitorais e coleiras têm de P a GG, com tabela de medidas descrita em cada produto.",
  },
  {
    q: "Quais materiais são usados?",
    a: "Tecidos resistentes e de fácil lavagem nas bandanas e laços; nylon reforçado com costuras duplas em peitorais e coleiras.",
  },
  {
    q: "Como lavar e cuidar dos produtos?",
    a: "Lavar à mão com água fria e sabão neutro, secar à sombra. Evitar máquina de lavar e secadora pra preservar a cor e o tecido.",
  },
  {
    q: "Vocês vendem para revenda ou atacado?",
    a: "Sim! Pet shops e lojistas podem comprar em volume pela Distribuidora My Pet Brasil — fale com a gente pelo WhatsApp ou acesse o link na seção 'Onde encontrar'.",
  },
  {
    q: "Qual o prazo de entrega?",
    a: "O prazo varia por região e canal de compra (loja própria, WhatsApp ou marketplace) — a gente confirma certinho assim que você fala com a gente.",
  },
];

export function Faq() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section style={{ maxWidth: 780, margin: "0 auto", padding: "64px 24px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <h2
        style={{
          fontFamily: "var(--font-fredoka)",
          fontSize: 28,
          fontWeight: 700,
          color: palette.purple,
          marginBottom: 28,
          textAlign: "center",
        }}
      >
        Perguntas frequentes
      </h2>
      {FAQ_ITEMS.map((item) => (
        <div key={item.q} style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: palette.gray800, marginBottom: 6 }}>{item.q}</h3>
          <p style={{ fontSize: 15, color: palette.gray600, lineHeight: 1.6 }}>{item.a}</p>
        </div>
      ))}
    </section>
  );
}
