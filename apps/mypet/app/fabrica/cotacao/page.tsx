import { Suspense } from "react";
import { CotacaoPageBody } from "../../cotacao/page";

export const metadata = { title: "Seu pedido · Linha de Fábrica | My Pet Brasil", robots: { index: false, follow: false } };

export default function FabricaCotacaoPage() {
  return (
    <Suspense fallback={null}>
      <CotacaoPageBody vitrineId="fabrica" />
    </Suspense>
  );
}
