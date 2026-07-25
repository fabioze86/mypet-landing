import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAD PET",
  description: "MAD PET — acessórios de fabricação própria para cães e gatos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
