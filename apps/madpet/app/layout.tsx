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
  title: "MAD PET | Acessórios de fabricação própria para revenda em pet shop",
  description:
    "Canal de compra para lojistas: bandanas, laços, peitorais e coleiras MAD PET de fabricação própria. Cor que vende na gôndola, giro rápido e frete grátis por faixa de pedido. Peça sua tabela no WhatsApp.",
  openGraph: {
    title: "MAD PET | Revenda de acessórios para pet shop",
    description:
      "Fabricação própria, giro rápido e frete grátis por faixa de pedido. Peça a tabela de revenda no WhatsApp.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${fredoka.variable} ${nunito.variable}`}>
      <body style={{ margin: 0, fontFamily: "var(--font-nunito), sans-serif" }}>{children}</body>
    </html>
  );
}
