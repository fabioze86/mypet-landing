import { madPetPalette as palette } from "@/client-theme";

const FAQ_ITEMS = [
  {
    q: "Qual o pedido mínimo?",
    a: "Em São Paulo capital o frete sai grátis a partir de R$ 99 em produtos. No ABC e Região Metropolitana, a partir de R$ 299. No interior de São Paulo, a partir de R$ 400. Para outras regiões, a equipe comercial passa o valor mínimo no atendimento.",
  },
  {
    q: "Como funciona o pagamento?",
    a: "PIX com 3% de desconto sobre o total do pedido, ou cartão de crédito em até 6x sem juros, com parcela mínima de R$ 200.",
  },
  {
    q: "Como recebo a tabela de preços de revenda?",
    a: "Você chama no WhatsApp, informa o nome e a cidade da loja, e a gente envia a tabela por linha com as grades disponíveis. Sem cadastro burocrático.",
  },
  {
    q: "As peças vêm em grade fechada?",
    a: "Sim. Peitorais e coleiras têm grade de P a GG; bandanas e laços saem em sortimento de estampas. A composição exata de cada grade vai junto com a tabela.",
  },
  {
    q: "Quais materiais são usados?",
    a: "Nylon reforçado com costura dupla em peitorais e coleiras; tecidos resistentes e de fácil lavagem em bandanas e laços. Fivelas de encaixe rápido e argolas reforçadas nas linhas de passeio.",
  },
  {
    q: "E se chegar alguma peça com defeito?",
    a: "Peça com defeito de fabricação é trocada. Registre no WhatsApp com foto em até 7 dias do recebimento e a gente resolve na reposição seguinte ou no próximo pedido.",
  },
  {
    q: "Qual o prazo de entrega?",
    a: "Depende da região e da forma de envio combinada. A equipe comercial confirma o prazo no fechamento do pedido, junto com o código de rastreio quando disponível.",
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
    <section style={{ background: palette.purpleLight }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "72px 24px" }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <h2
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: "clamp(24px, 4vw, 32px)",
            fontWeight: 700,
            color: palette.gray800,
            marginBottom: 28,
          }}
        >
          Perguntas de quem vai revender
        </h2>
        {FAQ_ITEMS.map((item) => (
          <div key={item.q} style={{ marginBottom: 22 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: palette.gray800, marginBottom: 6 }}>{item.q}</h3>
            <p style={{ fontSize: 15, color: palette.gray600, lineHeight: 1.65 }}>{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
