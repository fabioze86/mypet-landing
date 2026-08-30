import { madPetPalette as palette, theme } from "@/client-theme";
import { BonePattern } from "@/components/bone-pattern";

export function AboutBlock({ whatsappLink }: { whatsappLink: string }) {
  return (
    <section
      id="sobre"
      style={{
        position: "relative",
        overflow: "hidden",
        background: palette.purpleDark,
        scrollMarginTop: 96,
      }}
    >
      <BonePattern color={palette.white} opacity={0.06} />
      <div
        className="mpv2-about"
        style={{
          position: "relative",
          maxWidth: theme.maxWidth,
          margin: "0 auto",
          padding: "72px 24px",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-fredoka)",
              fontSize: "clamp(24px, 3.8vw, 34px)",
              fontWeight: 700,
              color: palette.white,
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            Sobre a MAD PET
          </h2>
          <p
            style={{
              fontSize: 15.5,
              color: "rgba(255,255,255,0.9)",
              lineHeight: 1.7,
              marginBottom: 14,
            }}
          >
            A MAD PET é a linha própria de acessórios do Grupo AZ: bandana, laço, peitoral e coleira
            fabricados do corte ao acabamento na nossa produção. Sem importadora no meio, a reposição
            é rápida e o preço nasce pensado para você revender bem.
          </p>
          <p
            style={{
              fontSize: 15.5,
              color: "rgba(255,255,255,0.9)",
              lineHeight: 1.7,
              marginBottom: 28,
            }}
          >
            Cor que chama o olhar na gôndola, material que aguenta o uso e uma grade enxuta que cobre
            do mini ao extra grande. É o acessório que gira sem esforço de venda no seu balcão.
          </p>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mp-btn mp-btn-light"
            style={{
              background: palette.white,
              color: palette.purple,
              fontWeight: 800,
              fontSize: 15,
              padding: "14px 28px",
              borderRadius: theme.radiusPill,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Seja nosso cliente atacadista
          </a>
        </div>

        <div
          style={{
            position: "relative",
            borderRadius: theme.radiusCard,
            overflow: "hidden",
            border: "6px solid rgba(255,255,255,0.14)",
            aspectRatio: "4 / 3",
            background: palette.purple,
          }}
        >
          {/* TODO: trocar por vídeo institucional real quando disponível. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://picsum.photos/seed/madpet-sobre-video/1200/900"
            alt="Bastidores da produção MAD PET"
            width={1200}
            height={900}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(38,16,60,0.28)",
            }}
          >
            <span
              style={{
                width: 66,
                height: 66,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.92)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill={palette.purple} aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
