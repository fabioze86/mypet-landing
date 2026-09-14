import type { Metadata, Viewport } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { organizationJsonLd, jsonLdScript } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { HotsiteHeader } from "./hotsite-header";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${clientConfig.domain}`),
  title: `${clientConfig.name} — ${clientConfig.tagline}`,
  description: "Ofertas para lojistas: preço promocional, cupom e reposição de estoque para pet shops.",
};

export const viewport: Viewport = {
  themeColor: clientConfig.palette.navy,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${nunitoSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd(clientConfig)) }}
        />
        <ClientConfigProvider config={clientConfig}>
          <CartProvider>
            <HotsiteHeader />
            {children}
          </CartProvider>
          <Analytics />
        </ClientConfigProvider>
      </body>
    </html>
  );
}
