import { madPetPalette as palette, theme } from "@/client-theme";

const STEPS = [
  {
    n: "1",
    title: "Chame no WhatsApp",
    body: "Fala o nome da sua loja e a cidade. Sem cadastro longo, sem formulário.",
  },
  {
    n: "2",
    title: "Receba a tabela de revenda",
    body: "Preço por linha, grades disponíveis e a faixa de frete grátis da sua região.",
  },
  {
    n: "3",
    title: "Feche o pedido",
    body: "Confirma a grade, escolhe PIX ou cartão e a gente separa pra envio.",
  },
];

const FRETE = [
  { area: "São Paulo capital", value: "acima de R$ 99" },
  { area: "ABC e Região Metropolitana de SP", value: "acima de R$ 299" },
  { area: "Interior de São Paulo", value: "acima de R$ 400" },
  { area: "Demais regiões", value: "pedido mínimo com o comercial" },
];

export function HowToBuy({ whatsappLink }: { whatsappLink: string }) {
  return (
    <section id="como-comprar" style={{ background: palette.white, scrollMarginTop: 80 }}>
      <div style={{ maxWidth: theme.maxWidth, margin: "0 auto", padding: "72px 24px" }}>
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
          Como comprar para revender
        </h2>
        <p style={{ fontSize: 16, color: palette.gray600, lineHeight: 1.65, maxWidth: "60ch", marginBottom: 40 }}>
          Atendimento direto com a equipe comercial. Do primeiro contato ao pedido separado, sem
          intermediário.
        </p>

        <div className="mp-steps" style={{ marginBottom: 48 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.radiusPill,
                  background: palette.purpleLight,
                  color: palette.purple,
                  fontFamily: "var(--font-fredoka)",
                  fontWeight: 700,
                  fontSize: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s.n}
              </span>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: palette.gray800 }}>{s.title}</h3>
              <p style={{ fontSize: 14.5, color: palette.gray600, lineHeight: 1.6 }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div
          style={{
            background: palette.purpleDark,
            borderRadius: theme.radiusCard,
            padding: "36px 32px",
          }}
        >
          <div className="mp-cond">
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: palette.white, marginBottom: 16 }}>
                Frete grátis por faixa de pedido
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {FRETE.map((f) => (
                  <li key={f.area} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: palette.white }}>{f.area}</span>
                    <span style={{ fontSize: 14, color: palette.greenLight }}>{f.value}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: palette.white, marginBottom: 16 }}>
                Pagamento
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                <li style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: palette.white }}>PIX</span>
                  <span style={{ fontSize: 14, color: palette.greenLight }}>3% de desconto no total</span>
                </li>
                <li style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: palette.white }}>Cartão de crédito</span>
                  <span style={{ fontSize: 14, color: palette.greenLight }}>
                    até 6x sem juros, parcela mínima de R$ 200
                  </span>
                </li>
              </ul>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mp-btn mp-btn-green"
                style={{
                  display: "inline-block",
                  marginTop: 24,
                  background: palette.greenDark,
                  color: palette.white,
                  fontWeight: 800,
                  fontSize: 15,
                  padding: "12px 26px",
                  borderRadius: theme.radiusPill,
                  textDecoration: "none",
                }}
              >
                Quero revender
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
