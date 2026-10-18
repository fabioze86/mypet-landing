import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { siteConfig } from "@/site.config";
import { organizationJsonLd, websiteJsonLd } from "@/lib/jsonld";
import { JsonLd } from "./_components/json-ld";
import { SkipLink } from "./_components/skip-link";
import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";
import { GoogleAnalytics } from "./_components/google-analytics";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: "%s | Zemann" },
  description: siteConfig.tagline,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} antialiased`}>
      <body className="flex min-h-screen flex-col font-sans">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <SkipLink />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
