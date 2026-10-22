import { Suspense } from "react";
import type { Metadata } from "next";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { LANDING_STYLES } from "../_components/pre-access/styles";
import { viewerFromBuyer } from "../_components/hub/doors";
import { AGENT_STYLES } from "./styles";
import { AgentShell } from "./agent-shell";
import { initialQuestionFrom } from "./agent-params";

export const metadata: Metadata = {
  title: `Agente My Pet - ${clientConfig.name}`,
  alternates: { canonical: canonicalUrl(clientConfig.domain, "/agente") },
  description:
    "Tire dúvidas sobre pedido, entrega e pagamento e encontre produtos da tabela de preços da My Pet Brasil.",
};

type AgentePageSearchParams = Promise<{ pergunta?: string | string[] }>;

export default function AgentePage({ searchParams }: { searchParams: AgentePageSearchParams }) {
  return (
    <>
      <style>{LANDING_STYLES}</style>
      <style>{AGENT_STYLES}</style>
      <Suspense fallback={null}>
        <AgentePageBody searchParams={searchParams} />
      </Suspense>
    </>
  );
}

// exported for tests
export async function AgentePageBody({ searchParams }: { searchParams?: AgentePageSearchParams } = {}) {
  const buyer = await requireBuyer();
  const initialQuestion = initialQuestionFrom((await searchParams)?.pergunta);
  // nome de exibição do cliente: nome do cadastro, senão a empresa
  const viewer = viewerFromBuyer(buyer);
  const displayName = viewer.kind === "cliente" ? viewer.displayName : null;
  return <AgentShell mode={buyer ? "cliente" : "visitante"} initialQuestion={initialQuestion} displayName={displayName} />;
}
