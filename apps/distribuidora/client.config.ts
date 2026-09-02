import type { ClientConfig } from "@mypet/core/theme";
import { SITES } from "@mypet/core/features";

// Liga/desliga visual: não altera o catálogo nem as categorias do Admin.
export const SHOW_ONLY_CATEGORIES_WITH_PRODUCTS = true;

// Identidade MadPet — Brand Guide 2026 (ref.: apps/madpet/client-theme.ts).
// Papeis do guia mapeados nos slots da paleta semantica do core:
//  pink*  -> Roxo Mad      (assinatura, CTAs, grandes areas)
//  cyan*  -> Verde Mad     (acao e sinais de conforto, uso pontual)
//  navy*  -> Roxo Profundo (fundos de impacto, footer, titulos, theme-color)
//  gray*  -> Grafite       (texto) sobre base branca / lavanda
export const clientConfig: ClientConfig = {
  name: "MadPet",
  tagline: "MyPet Fábrica agora é MadPet",
  domain: "www.distribuidorapetshop.com.br",
  catalogChannel: "ffa_fabrica",
  palette: {
    pink: "#7144A4", // Roxo Mad — cor principal / assinatura
    pinkDark: "#523078", // Roxo Profundo — hover, fim de gradiente
    pinkLight: "#EDE6F5", // Lavanda Clara — fundos leves, badges
    cyan: "#489876", // Verde Mad — acentos sem texto (barras, chips)
    cyanDark: "#37795D", // Verde Escuro — texto branco passa WCAG AA
    cyanLight: "#DDF2E8", // Verde Claro — frete gratis, desconto PIX
    navy: "#523078", // Roxo Profundo — titulos, theme-color, PWA
    navyDark: "#3B2357", // Roxo mais profundo — footer, OG image
    navyLight: "#EDE6F5", // Lavanda Clara — badges
    orange: "#B45309", // erro / aviso — funcional, fora da identidade
    green: "#37795D", // Verde Escuro — estado de sucesso
    white: "#FFFFFF",
    gray50: "#F7F5FB", // base clara com leve tingimento lavanda
    gray100: "#EDE6F5", // Lavanda Clara — divisorias
    gray200: "#E1D7F0", // bordas de card / input (tingidas de roxo)
    gray400: "#9E93B4", // grafite tingido de roxo — apoio
    gray600: "#505A64", // Grafite suave — texto secundario
    gray800: "#263037", // Grafite — texto corrido
  },
  logo: { emoji: "🐾" },
  features: SITES.distribuidora.features,
};
