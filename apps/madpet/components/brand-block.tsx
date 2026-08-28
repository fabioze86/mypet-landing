import { madPetPalette as palette, theme } from "@/client-theme";

export function BrandBlock() {
  return (
    <section style={{ background: palette.white }}>
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "64px 24px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: "clamp(20px, 3vw, 26px)",
            fontWeight: 600,
            color: palette.gray800,
            lineHeight: 1.5,
          }}
        >
          A MAD PET é a linha própria de acessórios do Grupo AZ. A gente fabrica bandana, laço,
          peitoral e coleira com o mesmo cuidado de acabamento que você cobraria, e coloca na sua
          loja num preço que dá pra revender bem.
        </p>
        <p
          style={{
            marginTop: 16,
            fontSize: 15,
            color: palette.gray600,
            lineHeight: 1.7,
            maxWidth: "60ch",
            marginInline: "auto",
          }}
        >
          Alegria que aproxima o cliente da prateleira, qualidade que segura a recompra. É o que a
          marca entrega, e é o que faz o item girar.
        </p>
        <span
          aria-hidden="true"
          style={{
            display: "block",
            width: 64,
            height: 4,
            borderRadius: theme.radiusPill,
            background: palette.green,
            margin: "28px auto 0",
          }}
        />
      </div>
    </section>
  );
}
