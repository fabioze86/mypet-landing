import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getHubServiceClient } from "@mypet/core/supabase";
import { getOrdersByBuyer } from "@mypet/core/orders-server";
import { getCategories } from "@mypet/core/catalog";
import { requireBuyer } from "@/lib/require-buyer";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { SiteNav } from "@mypet/core/components/site-nav";
import { clientConfig } from "@/client.config";
import { BUYER_STYLES } from "../_components/buyer-area/styles";

const { palette: PALETTE } = clientConfig;

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  pendente: { bg: "#FFF4E5", fg: "#B35C00" },
  confirmado: { bg: "#E3F5EC", fg: "#068A47" },
  entregue: { bg: PALETTE.navyLight, fg: PALETTE.navy },
  cancelado: { bg: PALETTE.gray100, fg: PALETTE.gray600 },
};

// exported for tests
export async function PedidosContent() {
  const buyer = await requireBuyer();
  if (!buyer) redirect("/");

  const orders = await getOrdersByBuyer(getHubServiceClient(), buyer.id);

  return (
    <main className="ba-main ba-main--narrow">
      <h1 className="ba-h1" style={{ marginBottom: 20 }}>Meus pedidos</h1>

      {orders.length === 0 ? (
        <div className="ba-card" style={{ padding: "32px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: PALETTE.gray600, margin: "0 0 20px" }}>Você ainda não fez nenhum pedido.</p>
          <Link href="/pedido-rapido" className="ba-btn ba-btn-primary">
            Consultar preços
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {orders.map((order) => {
            const color = STATUS_COLOR[order.status] ?? STATUS_COLOR.cancelado;
            const totalQty = order.items.reduce((sum, item) => sum + item.qty, 0);
            return (
              <div key={order.id} className="ba-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: PALETTE.navy }}>
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: PALETTE.gray600 }}>
                      {order.items.length} {order.items.length === 1 ? "produto" : "produtos"} · {totalQty} un.
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: color.bg,
                      color: color.fg,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${PALETTE.gray100}` }}>
                  {order.items.map((item) => (
                    <li
                      key={item.productId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "8px 0",
                        borderBottom: `1px solid ${PALETTE.gray100}`,
                        fontSize: 14,
                        lineHeight: 1.4,
                        color: PALETTE.gray800,
                      }}
                    >
                      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{item.name}</span>
                      <span style={{ flex: "0 0 auto", fontWeight: 600, color: PALETTE.navy, fontVariantNumeric: "tabular-nums" }}>
                        {item.qty}×
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default async function PedidosPage() {
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
        <Suspense fallback={null}>
          <PedidosContent />
        </Suspense>
      </LeadGateProvider>
    </div>
  );
}
