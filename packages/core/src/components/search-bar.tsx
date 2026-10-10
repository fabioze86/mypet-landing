"use client";

import { useClientConfig } from "../theme";

export function SearchBar({
  action = "/busca",
  placeholder = "Buscar produtos, marcas...",
}: {
  action?: string;
  placeholder?: string;
}) {
  const { palette } = useClientConfig();
  return (
    <form
      method="get"
      action={action}
      role="search"
      style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 24px", display: "flex", gap: 8 }}
    >
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        aria-label="Buscar produtos"
        style={{
          flex: 1,
          padding: "10px 16px",
          borderRadius: 100,
          border: `1.5px solid ${palette.gray200}`,
          fontSize: 14,
          outline: "none",
          color: palette.gray800,
          background: palette.white,
        }}
      />
      <button
        type="submit"
        style={{
          padding: "10px 20px",
          borderRadius: 100,
          border: "none",
          background: palette.pink,
          color: palette.white,
          fontWeight: 800,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Buscar
      </button>
    </form>
  );
}
