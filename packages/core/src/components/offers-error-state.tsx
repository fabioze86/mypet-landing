"use client";

import { useClientConfig } from "../theme";

export function OffersErrorState({ message = "Não foi possível carregar as ofertas agora." }: { message?: string }) {
  const { palette } = useClientConfig();
  return (
    <div
      style={{
        maxWidth: 480,
        margin: "60px auto",
        textAlign: "center",
        padding: "32px 24px",
        background: palette.white,
        border: `1px solid ${palette.gray200}`,
        borderRadius: 16,
      }}
    >
      <p style={{ fontSize: 32, marginBottom: 12 }}>⚠️</p>
      <p style={{ fontSize: 15, color: palette.gray800, fontWeight: 700, marginBottom: 8 }}>{message}</p>
      <p style={{ fontSize: 13, color: palette.gray600, marginBottom: 20 }}>
        Isso costuma ser temporário. Tente novamente em instantes.
      </p>
      <a
        href="."
        style={{
          display: "inline-block",
          background: palette.navy,
          color: palette.white,
          borderRadius: 100,
          padding: "10px 24px",
          fontSize: 14,
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        Tentar novamente
      </a>
    </div>
  );
}
