export const PALETTE = {
  pink: "#E5197A",
  pinkDark: "#B8115F",
  pinkLight: "#FCE4F0",
  cyan: "#00C4D4",
  cyanDark: "#009BAA",
  cyanLight: "#E0F9FB",
  navy: "#1A3472",
  navyDark: "#0F1F45",
  navyLight: "#EDF0F8",
  orange: "#FF6A00",
  green: "#00A651",
  white: "#FFFFFF",
  gray50: "#F8F9FB",
  gray100: "#F0F2F6",
  gray200: "#DDE2EC",
  gray400: "#9CA8C0",
  gray600: "#5A6580",
  gray800: "#2D3550",
} as const;

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  escolha_mypet: { bg: PALETTE.pinkLight, color: PALETTE.pink },
  novidade: { bg: PALETTE.navyLight, color: PALETTE.navy },
  promocao: { bg: "#FFF0E5", color: PALETTE.orange },
};

export function badgeStyle(code: string): { bg: string; color: string } {
  return BADGE_STYLES[code] ?? { bg: PALETTE.gray100, color: PALETTE.gray600 };
}
