import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@mypet/core/supabase-server";
import { getOrdersByBuyer } from "@mypet/core/orders-server";
import { getCategories } from "@mypet/core/catalog";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { SiteNav } from "@mypet/core/components/site-nav";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

async function PedidosContent() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar?next=%2Fpedidos");
  }

  const orders = await getOrdersByBuyer(supabase, user.id);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: PALETTE.navy, marginBottom: 24 }}>
        Meus pedidos
      </h1>

      {orders.length === 0 ? (
        <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: PALETTE.gray600 }}>Você ainda não fez nenhum pedido.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {orders.map((order) => (
            <div key={order.id} style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: PALETTE.gray400 }}>
                  {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: PALETTE.pink, textTransform: "uppercase" }}>
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>
              <ul style={{ listStyle: "none" }}>
                {order.items.map((item) => (
                  <li key={item.productId} style={{ fontSize: 14, color: PALETTE.gray800, marginBottom: 4 }}>
                    {item.name} — Qtd: {item.qty}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default async function PedidosPage() {
  const categories = await getCategories();

  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <LeadGateProvider>
        <SiteNav categories={categories} />
        <Suspense fallback={null}>
          <PedidosContent />
        </Suspense>
      </LeadGateProvider>
    </div>
  );
}
