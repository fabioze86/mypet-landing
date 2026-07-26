import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hub — Monorepo My Pet",
  description: "Acesso rápido aos sites e ao admin em desenvolvimento local.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F4F5F7" }}>
        {children}
      </body>
    </html>
  );
}
