import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "MAD PET — acessórios de fabricação própria para cães e gatos",
  description:
    "Bandanas, laços, peitorais e coleiras MAD PET: cores vibrantes, materiais resistentes e preço-benefício. Fale no WhatsApp e descubra onde comprar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${fredoka.variable} ${nunito.variable}`}>
      <body style={{ margin: 0, fontFamily: "var(--font-nunito), sans-serif" }}>{children}</body>
    </html>
  );
}
