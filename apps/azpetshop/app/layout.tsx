import type { Metadata, Viewport } from "next";
import { Nunito, Nunito_Sans, Baloo_2 } from "next/font/google";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { organizationJsonLd, jsonLdScript } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { EMPRESA, cepFormatado, ruaEmLinha } from "@/lib/empresa";
import { GoogleAnalytics } from "./google-analytics";
import { SiteFooter } from "./site-footer";
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

// Fonte de destaque da identidade visual da home (títulos e chamadas).
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${clientConfig.domain}`),
  title: `${clientConfig.name} — ${clientConfig.tagline}`,
  description:
    "Loja online de produtos para cães, gatos e outros pets. Pix ou cartão parcelado, entrega para todo o Brasil.",
};

export const viewport: Viewport = {
  themeColor: clientConfig.palette.navy,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${nunito.variable} ${nunitoSans.variable} ${baloo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(
              organizationJsonLd(clientConfig, {
                legalName: EMPRESA.razaoSocial,
                taxID: EMPRESA.cnpj,
                email: EMPRESA.email,
                telephone: `+${EMPRESA.whatsapp}`,
                address: {
                  streetAddress: ruaEmLinha(EMPRESA.endereco),
                  addressLocality: EMPRESA.endereco.cidade,
                  addressRegion: EMPRESA.endereco.uf,
                  postalCode: cepFormatado(EMPRESA.endereco.cep),
                },
              }),
            ),
          }}
        />
        <ClientConfigProvider config={clientConfig}>
          <CartProvider>
            {children}
            <SiteFooter />
          </CartProvider>
        </ClientConfigProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
