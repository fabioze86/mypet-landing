import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { getCategories, getBrands } from "@mypet/core/catalog";
import { getCatalogLineItems } from "@mypet/core/catalog-line-items";
import { buildCategoryTree, flattenCategoryTree } from "@mypet/core/catalog-utils";
import type { Channel } from "@mypet/core/channels";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { PedidoRapidoTable } from "./pedido-rapido-table";

const { palette: PALETTE } = clientConfig;

export const metadata: Metadata = {
  title: "Pedido Rápido | My Pet Brasil",
  robots: { index: false, follow: false },
};

export default function PedidoRapidoPage() {
  return (
    <Suspense fallback={null}>
      <PedidoRapidoPageBody />
    </Suspense>
  );
}

// exported for tests
export async function PedidoRapidoPageBody() {
  const buyer = await requireBuyer();
  if (!buyer) redirect("/entrar");

  const channel = clientConfig.catalogChannel as Channel;
  const [categories, brands, firstPage] = await Promise.all([
    getCategories(),
    getBrands(channel),
    getCatalogLineItems({ page: 1, channel }),
  ]);
  const orderedCategories = flattenCategoryTree(buildCategoryTree(categories));

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <SiteNav categories={categories} showMegaMenu={false} pedidoRapidoHref="/pedido-rapido" faqHref="/perguntas-frequentes" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 120px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: PALETTE.navy, marginBottom: 4 }}>
          Consulte preços e monte seu pedido
        </h1>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Pesquise por produto, SKU, categoria ou marca. Informe a quantidade e adicione os itens que deseja.
        </p>
        <PedidoRapidoTable
          initialResult={firstPage}
          brands={brands}
          categories={orderedCategories}
          palette={PALETTE}
        />
      </main>
    </div>
  );
}
