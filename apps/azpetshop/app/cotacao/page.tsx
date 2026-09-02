import Link from "next/link";
import { getCategories } from "@mypet/core/catalog";
import { SiteNav } from "@mypet/core/components/site-nav";
import { clientConfig } from "@/client.config";
import { CotacaoContent } from "./cotacao-content";

const { palette: PALETTE } = clientConfig;

export const metadata = { robots: { index: false } };

export default async function CotacaoPage() {
  const categories = await getCategories();
  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        .cta-primary {
          background: ${PALETTE.pink}; color: #fff; border: none; border-radius: 100px;
          padding: 10px 22px; font-size: 14px; font-weight: 800; cursor: pointer;
        }
      `}</style>
      <SiteNav categories={categories} audienceLabel={null} />
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px" }}>
        <Link href="/" style={{ color: PALETTE.gray600, fontSize: 14, fontWeight: 700, textDecoration: "none", display: "inline-block", marginBottom: 24 }}>← Continuar comprando</Link>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 20 }}>Seu pedido</h1>
        <CotacaoContent palette={clientConfig.palette} />
      </div>
    </div>
  );
}
