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
import { BUYER_STYLES } from "../_components/buyer-area/styles";
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
    <div className="ba-page">
      <style>{BUYER_STYLES}</style>
      <SiteNav
        categories={categories}
        showMegaMenu={false}
        homeHref="/pedido-rapido"
        pedidoRapidoHref="/pedido-rapido"
        pedidosHref="/pedidos"
        faqHref="/perguntas-frequentes"
      />
      <main className="ba-main">
        <h1 className="ba-h1">Consulte preços e monte seu pedido</h1>
        <p className="ba-lead">
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
