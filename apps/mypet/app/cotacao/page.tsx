import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCategories } from "@mypet/core/catalog";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { SiteNav } from "@mypet/core/components/site-nav";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { BUYER_STYLES } from "../_components/buyer-area/styles";
import { CotacaoContent } from "./cotacao-content";

const { palette: PALETTE } = clientConfig;

export default function CotacaoPage() {
  return (
    <Suspense fallback={null}>
      <CotacaoPageBody />
    </Suspense>
  );
}

// exported for tests
export async function CotacaoPageBody() {
  const buyer = await requireBuyer();
  if (!buyer) redirect("/");

  const categories = await getCategories();

  return (
    <div className="ba-page">
      <style>{BUYER_STYLES}</style>

      <LeadGateProvider>
        <SiteNav
          categories={categories}
          showMegaMenu={false}
          homeHref="/pedido-rapido"
          pedidoRapidoHref="/pedido-rapido"
          pedidosHref="/pedidos"
          faqHref="/perguntas-frequentes"
        />

        <main className="ba-main ba-main--narrow">
          <Link href="/pedido-rapido" className="ba-back">
            ← Voltar para a tabela
          </Link>

          <h1 className="ba-h1" style={{ marginBottom: 20 }}>Seu pedido</h1>

          <CotacaoContent palette={PALETTE} />
        </main>
      </LeadGateProvider>
    </div>
  );
}
