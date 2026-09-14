import type { ClientConfig } from "@mypet/core/theme";
import { SITES } from "@mypet/core/features";

// Identidade Distribuidora Pet Shop — hotsite de ofertas para lojistas (tráfego Instagram).
// Papéis do briefing mapeados nos slots semânticos do core (mesma estrutura de Palette
// usada por todos os apps — não existe slot "coral"/"dourado" nativo, então:
//  pink*  -> Coral promocional (#F52D45) — CTA, preço, ação
//  cyan*  -> Dourado de destaque (#F5B51B) — selos, badges, prioridade
//  navy*  -> Azul-marinho institucional (#061C5C) — cabeçalhos, fundos de impacto
//  gray*  -> Grafite (#222222) sobre branco aquecido (#F7F5F2)
export const clientConfig: ClientConfig = {
  name: "Distribuidora Pet Shop",
  tagline: "O atacado pet de todo dia",
  domain: "ofertas.distribuidorapetshop.com.br",
  catalogChannel: "ffa_fabrica",
  palette: {
    pink: "#F52D45",
    pinkDark: "#C81F34",
    pinkLight: "#FDE4E7",
    cyan: "#F5B51B",
    cyanDark: "#C68E0E",
    cyanLight: "#FDF1D6",
    navy: "#061C5C",
    navyDark: "#04123E",
    navyLight: "#E7EAF5",
    orange: "#B45309",
    green: "#16794F",
    white: "#FFFFFF",
    gray50: "#F7F5F2",
    gray100: "#EFEDEA",
    gray200: "#E2DFDB",
    gray400: "#A8A29B",
    gray600: "#5C5850",
    gray800: "#222222",
  },
  logo: { emoji: "🐾" },
  features: SITES.distribuidoraInstagram.features,
};
