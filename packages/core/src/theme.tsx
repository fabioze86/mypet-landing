"use client";

import { createContext, useContext } from "react";

export type Palette = {
  pink: string;
  pinkDark: string;
  pinkLight: string;
  cyan: string;
  cyanDark: string;
  cyanLight: string;
  navy: string;
  navyDark: string;
  navyLight: string;
  orange: string;
  green: string;
  white: string;
  gray50: string;
  gray100: string;
  gray200: string;
  gray400: string;
  gray600: string;
  gray800: string;
};

export type ClientConfig = {
  name: string;
  tagline: string;
  domain: string;
  catalogChannel: string;
  palette: Palette;
  logo: { emoji: string };
};

const ClientConfigContext = createContext<ClientConfig | null>(null);

export function ClientConfigProvider({
  config,
  children,
}: {
  config: ClientConfig;
  children: React.ReactNode;
}) {
  return <ClientConfigContext.Provider value={config}>{children}</ClientConfigContext.Provider>;
}

export function useClientConfig(): ClientConfig {
  const ctx = useContext(ClientConfigContext);
  if (!ctx) throw new Error("useClientConfig deve ser usado dentro de ClientConfigProvider");
  return ctx;
}

const BADGE_STYLES: Record<string, (palette: Palette) => { bg: string; color: string }> = {
  escolha_mypet: (p) => ({ bg: p.pinkLight, color: p.pink }),
  novidade: (p) => ({ bg: p.navyLight, color: p.navy }),
  promocao: () => ({ bg: "#FFF0E5", color: "#FF6A00" }),
};

export function badgeStyle(code: string, palette: Palette): { bg: string; color: string } {
  const fn = BADGE_STYLES[code];
  return fn ? fn(palette) : { bg: palette.gray100, color: palette.gray600 };
}
