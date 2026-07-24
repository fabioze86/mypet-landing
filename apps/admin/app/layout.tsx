import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painel administrativo — My Pet Brasil",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <Suspense fallback={null}>
        <body>{children}</body>
      </Suspense>
    </html>
  );
}
