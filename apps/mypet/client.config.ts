import type { ClientConfig } from "@mypet/core/theme";
import { SITES } from "@mypet/core/features";

export const clientConfig: ClientConfig = {
  name: "My Pet Brasil",
  tagline: "Tabela de Preços",
  domain: "mypetbrasil.com.br",
  catalogChannel: "mypetbrasil",
  // As chaves "pink*" são o acento da paleta usado pelos componentes do core.
  // No mypet o acento é o verde da landing (styles.ts: --pa-green*), para que
  // as telas pós-login tenham a mesma identidade visual navy + verde.
  palette: {
    pink: "#00A651",
    pinkDark: "#068A47",
    pinkLight: "#E3F5EC",
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
  },
  logo: { emoji: "🐾" },
  priceEyebrow: "Tabela de Preços My Pet",
  features: SITES.mypet.features,
};
