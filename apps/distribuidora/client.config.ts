import type { ClientConfig } from "@mypet/core/theme";
import { SITES } from "@mypet/core/features";

// Liga/desliga visual: não altera o catálogo nem as categorias do Admin.
export const SHOW_ONLY_CATEGORIES_WITH_PRODUCTS = true;

// Mesma marca do mypet (My Pet Brasil): paleta identica a apps/mypet/client.config.ts.
// Este site e material de vendas de apoio ao site principal www.mypetbrasil.com.
// As chaves "pink*" sao o acento da paleta usado pelos componentes do core
// (verde da marca); navy* e o azul institucional.
export const clientConfig: ClientConfig = {
  name: "My Pet Brasil",
  tagline: "Catálogo de atacado para pet shops",
  domain: "www.distribuidorapetshop.com.br",
  catalogChannel: "mypetbrasil",
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
  features: SITES.distribuidora.features,
};
