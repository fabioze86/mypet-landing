/**
 * Sistema visual MAD PET — Brand Guide 2026.
 *
 * Proporção de uso (do guia): base clara / lavanda dominante » Roxo Mad em
 * assinatura e grandes áreas » Verde Mad restrito a AÇÃO e sinais de conforto
 * (botões de pedido, selo de frete grátis, desconto PIX). Nunca usar Verde Mad
 * como fundo de grande área nem para texto corrido.
 *
 * Azul e amarelo existem SOMENTE dentro do logotipo (asset fixo). Não usar como
 * cor de UI.
 */
export type MadPetPalette = {
  // Verde Mad — energia, bem-estar, AÇÃO. Uso pontual.
  green: string;
  greenDark: string;
  greenLight: string;
  // Roxo Mad — cor principal, assinatura, grandes áreas.
  purple: string;
  purpleDark: string;
  purpleLight: string;
  white: string;
  // Grafite — texto corrido e informação funcional.
  gray600: string;
  gray800: string;
};

export const madPetPalette: MadPetPalette = {
  green: "#489876", // Verde Mad — acentos sem texto (barras, chips)
  greenDark: "#37795D", // botões verdes: texto branco passa WCAG AA (~4.5:1)
  greenLight: "#DDF2E8", // Verde Claro — sinais de conforto e apoio
  purple: "#7144A4", // Roxo Mad
  purpleDark: "#523078", // Roxo Profundo — fundos de impacto e destaques
  purpleLight: "#EDE6F5", // Lavanda Clara — fundo leve, padrão, respiro
  white: "#FFFFFF",
  gray600: "#505A64", // grafite suave — texto secundário (AA em branco e lavanda)
  gray800: "#263037", // Grafite — texto corrido
};

/** Cores do logotipo. Uso exclusivo dentro do wordmark. */
export const madPetLogo = {
  blue: "#2FA9E0",
  yellow: "#F6A91B",
  graphite: "#263037",
} as const;

/** Tokens estruturais. Um raio por tipo de elemento, aplicado no site todo. */
export const theme = {
  maxWidth: 1200,
  radiusCard: 16,
  radiusInput: 12,
  radiusPill: 999,
  // sombra tingida de roxo, nunca preto puro sobre fundo claro
  shadowSoft: "0 10px 30px rgba(82, 48, 120, 0.12)",
  shadowCard: "0 6px 20px rgba(82, 48, 120, 0.10)",
} as const;
