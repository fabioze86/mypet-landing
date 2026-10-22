import { Suspense } from "react";
import { requireBuyer } from "@/lib/require-buyer";
import { VISITANTE, viewerFromBuyer, type HubDoorId } from "./doors";
import { HubNav } from "./hub-nav";

// Cabeçalho das páginas públicas. O cookie só é lido dentro do Suspense, então
// a página continua pré-renderizada; até o cliente ser identificado aparece o
// cabeçalho de visitante.
export async function HubHeader({ current }: { current?: HubDoorId }) {
  const buyer = await requireBuyer();
  return <HubNav viewer={viewerFromBuyer(buyer)} current={current} />;
}

export function HubHeaderSlot({ current }: { current?: HubDoorId }) {
  return (
    <Suspense fallback={<HubNav viewer={VISITANTE} current={current} />}>
      <HubHeader current={current} />
    </Suspense>
  );
}
