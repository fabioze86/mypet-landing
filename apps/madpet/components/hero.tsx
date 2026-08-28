import { madPetPalette as palette, theme } from "@/client-theme";
import { BonePattern } from "./bone-pattern";
import { WaveDivider } from "./wave-divider";

export function Hero({ whatsappLink }: { whatsappLink: string }) {
  return (
    <section
      id="topo"
      style={{ position: "relative", overflow: "hidden", background: palette.purple }}
    >
      <BonePattern color={palette.white} opacity={0.07} />
      <div
        className="mp-hero-grid"
        style={{
          position: "relative",
          maxWidth: theme.maxWidth,
          margin: "0 auto",
          padding: "72px 24px 64px",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.82)",
              marginBottom: 16,
            }}
          >
            Para lojistas e pet shops
          </p>
          <h1
            style={{
              fontFamily: "var(--font-fredoka)",
              fontSize: "clamp(34px, 5vw, 50px)",
              fontWeight: 700,
              color: palette.white,
              lineHeight: 1.08,
              marginBottom: 18,
            }}
          >
            Fabricação própria que gira na gôndola.
          </h1>
          <p
            style={{
              fontSize: 17,
              color: "rgba(255,255,255,0.9)",
              lineHeight: 1.6,
              maxWidth: "46ch",
              marginBottom: 28,
            }}
          >
            Bandana, laço, peitoral e coleira com cor que para o cliente na prateleira e margem
            que fecha a conta.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mp-btn mp-btn-light"
              style={{
                background: palette.white,
                color: palette.purple,
                fontWeight: 800,
                fontSize: 16,
                padding: "14px 30px",
                borderRadius: theme.radiusPill,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Quero revender
            </a>
            <a
              href="#como-comprar"
              className="mp-btn"
              style={{
                border: "2px solid rgba(255,255,255,0.7)",
                color: palette.white,
                fontWeight: 800,
                fontSize: 16,
                padding: "12px 28px",
                borderRadius: theme.radiusPill,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Ver condições
            </a>
          </div>
        </div>

        <div
          style={{
            borderRadius: theme.radiusCard,
            overflow: "hidden",
            border: "6px solid rgba(255,255,255,0.14)",
            boxShadow: theme.shadowSoft,
            aspectRatio: "4 / 3",
            background: palette.purpleDark,
          }}
        >
          {/* TODO: trocar por foto real (pet usando o produto, luz clara - brand guide), 1200x900,
              e migrar para next/image quando a origem final estiver definida. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://picsum.photos/seed/madpet-hero-peitoral/1200/900"
            alt="Cachorro usando peitoral MAD PET durante o passeio"
            width={1200}
            height={900}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      </div>
      <WaveDivider color={palette.white} />
    </section>
  );
}
