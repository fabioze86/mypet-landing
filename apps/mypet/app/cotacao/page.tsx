import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { agendarLocalizacao } from "@/lib/localizacao";
import { zonaDoComprador } from "@/lib/zona";
import { VITRINES, type VitrineId } from "@/lib/vitrines";
import { BUYER_STYLES } from "../_components/buyer-area/styles";
import { HubNav } from "../_components/hub/hub-nav";
import { cadastroHref, viewerFromBuyer } from "../_components/hub/doors";
import { CotacaoContent } from "./cotacao-content";

const { palette: PALETTE } = clientConfig;

export default function CotacaoPage() {
  return (
    <Suspense fallback={null}>
      <CotacaoPageBody vitrineId="completo" />
    </Suspense>
  );
}

// exported for tests
export async function CotacaoPageBody({ vitrineId }: { vitrineId: VitrineId }) {
  const vitrine = VITRINES[vitrineId];
  const buyer = await requireBuyer();
  if (!buyer) redirect(cadastroHref(`${vitrine.basePath}/cotacao`));
  agendarLocalizacao(buyer);

  return (
    <div className="ba-page">
      <style>{BUYER_STYLES}</style>

      <LeadGateProvider>
        <HubNav viewer={viewerFromBuyer(buyer)} />

        <main className="ba-main ba-main--narrow">
          <Link href={vitrine.homePath} className="ba-back">
            ← Continuar escolhendo
          </Link>

          <h1 className="ba-h1" style={{ marginBottom: 20 }}>Seu pedido · {vitrine.rotulo}</h1>

          <CotacaoContent palette={PALETTE} vitrine={vitrine} zona={zonaDoComprador(buyer)} />
        </main>
      </LeadGateProvider>
    </div>
  );
}
