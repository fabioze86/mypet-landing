import { Barlow, Barlow_Condensed } from "next/font/google";

// Fontes do visual "pop" das landings de campanha. As variáveis CSS são
// lidas por POP_STYLES (--font-cp-display / --font-cp-body).
const display = Barlow_Condensed({
  variable: "--font-cp-display",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["700", "800", "900"],
});

const body = Barlow({
  variable: "--font-cp-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const popFontVariables = `${display.variable} ${body.variable}`;
