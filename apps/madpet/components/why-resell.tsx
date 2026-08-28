import { madPetPalette as palette, theme } from "@/client-theme";

const cardBase: React.CSSProperties = {
  borderRadius: theme.radiusCard,
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

export function WhyResell() {
  return (
    <section style={{ background: palette.white }}>
      <div style={{ maxWidth: theme.maxWidth, margin: "0 auto", padding: "24px 24px 72px" }}>
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
          Por que colocar MAD PET na sua loja
        </h2>
        <p
          style={{
            fontSize: 16,
            color: palette.gray600,
            lineHeight: 1.65,
            maxWidth: "60ch",
            marginBottom: 32,
          }}
        >
          Não é acessório de importadora que some do estoque. É fabricação própria, com reposição
          rápida e um preço pensado pra você revender bem.
        </p>

        <div className="mp-why">
          <article
            className="mp-card"
            style={{
              ...cardBase,
              padding: 0,
              overflow: "hidden",
              background: palette.purpleLight,
              border: `1px solid ${palette.purpleLight}`,
            }}
          >
            {/* TODO: foto real de close (costura, fecho, tecido - brand guide "detalhe que prova"), 900x760,
                e migrar para next/image quando a origem final estiver definida. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://picsum.photos/seed/madpet-costura-detalhe/900/760"
              alt="Close da costura reforçada de um peitoral MAD PET"
              width={900}
              height={760}
              style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }}
            />
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <h3 style={{ fontSize: 19, fontWeight: 800, color: palette.gray800 }}>
                Fabricação própria
              </h3>
              <p style={{ fontSize: 14.5, color: palette.gray600, lineHeight: 1.6 }}>
                A linha é nossa, do corte ao acabamento. Você repõe o que vende sem esperar
                contêiner e sem ficar com prateleira furada.
              </p>
            </div>
          </article>

          <article style={{ ...cardBase, background: palette.purple }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: palette.white }}>
              Cor que vende sozinha
            </h3>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", lineHeight: 1.6 }}>
              Roxo chama o olhar na gôndola, o resto da paleta direciona pra escolha. O cliente
              para na prateleira antes de você falar qualquer coisa.
            </p>
          </article>

          <article style={{ ...cardBase, background: palette.greenLight }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: palette.gray800 }}>
              Material que aguenta
            </h3>
            <p style={{ fontSize: 14, color: palette.gray600, lineHeight: 1.6 }}>
              Nylon reforçado, costura dupla e tecido de lavar fácil. Menos troca no balcão, menos
              reclamação depois da venda.
            </p>
          </article>

          <article
            style={{
              ...cardBase,
              background: palette.white,
              border: `1px solid ${palette.purpleLight}`,
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, color: palette.gray800 }}>
              Margem que fecha a conta
            </h3>
            <p style={{ fontSize: 14, color: palette.gray600, lineHeight: 1.6 }}>
              Preço de fábrica, sem atravessador no meio. Dá pra marcar o preço de venda com folga
              e ainda ficar competitivo na sua região.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
