import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { clientConfig } from "@/client.config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${clientConfig.name} — ${clientConfig.tagline}`,
  description:
    "Catálogo de atacado para pet shops e distribuidores. Cadastro gratuito, cotações sob consulta.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClientConfigProvider config={clientConfig}>
          <CartProvider>{children}</CartProvider>
        </ClientConfigProvider>
      </body>
    </html>
  );
}
