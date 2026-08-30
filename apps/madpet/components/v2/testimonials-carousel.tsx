"use client";

import { useState } from "react";
import { madPetPalette as palette, theme } from "@/client-theme";
import { TESTIMONIALS } from "@/lib/testimonials";

const arrowStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: "none",
  background: palette.white,
  boxShadow: theme.shadowCard,
  fontSize: 22,
  lineHeight: 1,
  color: palette.purple,
  cursor: "pointer",
};

export function TestimonialsCarousel() {
  const [i, setI] = useState(0);
  const total = TESTIMONIALS.length;
  const t = TESTIMONIALS[i];

  const go = (next: number) => setI((next + total) % total);

  return (
    <section id="depoimentos" style={{ background: palette.purpleLight, scrollMarginTop: 96 }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "64px 24px", textAlign: "center" }}>
        <h2
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: "clamp(22px, 3.4vw, 30px)",
            fontWeight: 700,
            color: palette.gray800,
            marginBottom: 28,
          }}
        >
          O que dizem os lojistas
        </h2>

        <div
          style={{
            background: palette.white,
            borderRadius: theme.radiusCard,
            boxShadow: theme.shadowCard,
            padding: "36px 28px",
          }}
        >
          <p
            style={{
              fontSize: 17,
              color: palette.gray800,
              lineHeight: 1.7,
              fontStyle: "italic",
              marginBottom: 18,
            }}
          >
            &ldquo;{t.quote}&rdquo;
          </p>
          <p style={{ fontSize: 14, fontWeight: 800, color: palette.gray800 }}>{t.name}</p>
          <p style={{ fontSize: 13, color: palette.gray600 }}>{t.city}</p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginTop: 22,
          }}
        >
          <button
            type="button"
            aria-label="Depoimento anterior"
            onClick={() => go(i - 1)}
            style={arrowStyle}
          >
            &lsaquo;
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {TESTIMONIALS.map((_, d) => (
              <button
                key={d}
                type="button"
                aria-label={`Ir para depoimento ${d + 1}`}
                aria-current={d === i}
                onClick={() => setI(d)}
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  background: d === i ? palette.purple : "rgba(113,68,164,0.3)",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Próximo depoimento"
            onClick={() => go(i + 1)}
            style={arrowStyle}
          >
            &rsaquo;
          </button>
        </div>
      </div>
    </section>
  );
}
