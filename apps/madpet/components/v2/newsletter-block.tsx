"use client";

import { useState } from "react";
import { madPetPalette as palette, theme } from "@/client-theme";

export function NewsletterBlock() {
  const [sent, setSent] = useState(false);

  return (
    <section style={{ background: palette.white }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "56px 24px", textAlign: "center" }}>
        <h2
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: "clamp(20px, 3vw, 26px)",
            fontWeight: 700,
            color: palette.gray800,
            marginBottom: 8,
          }}
        >
          Receba novidades e reajustes de tabela
        </h2>
        <p style={{ fontSize: 14.5, color: palette.gray600, lineHeight: 1.6, marginBottom: 22 }}>
          Seja o primeiro a saber de lançamentos de linha e mudanças na condição de revenda.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}
        >
          <input
            type="email"
            required
            aria-label="Seu e-mail"
            placeholder="seu@email.com.br"
            disabled={sent}
            style={{
              flex: "1 1 260px",
              maxWidth: 340,
              padding: "13px 16px",
              fontSize: 15,
              borderRadius: theme.radiusInput,
              border: `1px solid ${palette.purpleLight}`,
              fontFamily: "inherit",
            }}
          />
          <button
            type="submit"
            className="mp-btn mp-btn-green"
            disabled={sent}
            style={{
              background: palette.greenDark,
              color: palette.white,
              fontWeight: 800,
              fontSize: 15,
              padding: "13px 26px",
              borderRadius: theme.radiusPill,
              border: "none",
              cursor: sent ? "default" : "pointer",
            }}
          >
            Enviar
          </button>
        </form>

        <p
          aria-live="polite"
          style={{ minHeight: 20, marginTop: 14, fontSize: 13.5, color: palette.green }}
        >
          {sent ? "Pronto! Em breve você recebe nossas novidades." : ""}
        </p>
      </div>
    </section>
  );
}
