import Link from "next/link";
import { redirect } from "next/navigation";
import { getCategories } from "@mypet/core/catalog";
import { SiteNav } from "@mypet/core/components/site-nav";
import { checkoutOptions } from "@mypet/core/features";
import { clientConfig } from "@/client.config";
import { CheckoutForm } from "./checkout-form";

const { palette: PALETTE } = clientConfig;

export const metadata = { title: `Finalizar compra — ${clientConfig.name}`, robots: { index: false } };

export default async function CheckoutPage() {
  if (!checkoutOptions(clientConfig.features).online) redirect("/cotacao");
  const categories = await getCategories();
  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        .cta-primary { background: ${PALETTE.pink}; color: #fff; border: none; border-radius: 100px; padding: 10px 22px; font-size: 14px; font-weight: 800; cursor: pointer; }
        .cta-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
      <SiteNav categories={categories} audienceLabel={null} />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        <Link href="/cotacao" style={{ color: PALETTE.gray600, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>← Voltar ao carrinho</Link>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, margin: "16px 0 20px" }}>Finalizar compra</h1>
        <CheckoutForm />
      </main>
    </div>
  );
}
