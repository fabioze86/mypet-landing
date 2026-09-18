import type { ClientConfig } from "@mypet/core/theme";
import { SITES } from "@mypet/core/features";

// Identidade visual AZ Pet Shop — direção "vibrante e ousada", aprovada em 2026-09-13.
// Nota: o campo `cyan` do tipo Palette é reaproveitado aqui como acento roxo
// (nenhum componente do core lê `cyan`, então essa realocação não afeta outros apps).
export const clientConfig: ClientConfig = {
  name: "AZ Pet Shop",
  tagline: "Loja online",
  domain: "loja.azpetshop.com.br",
  catalogChannel: "azpetshop",
  palette: {
    pink: "#FF3D7F",
    pinkDark: "#D91F63",
    pinkLight: "#FFE3EE",
    cyan: "#6C2BD9",
    cyanDark: "#54209E",
    cyanLight: "#EFE4FB",
    navy: "#241233",
    navyDark: "#170821",
    navyLight: "#F1E9F7",
    orange: "#FF6B35",
    green: "#1E9F5C",
    white: "#FFFFFF",
    gray50: "#FFF6E9",
    gray100: "#FCEBD2",
    gray200: "#EAD9BE",
    gray400: "#B7A489",
    gray600: "#5B4A63",
    gray800: "#241233",
  },
  logo: { emoji: "🐾" },
  features: SITES.azpetshop.features,
};
