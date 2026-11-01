import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories } from "@mypet/core/catalog";
import { SiteNav } from "@mypet/core/components/site-nav";
import { formatBRL } from "@mypet/core/catalog-utils";
import { formatCep } from "@mypet/core/br-validation";
import { getHubServiceClient } from "@mypet/core/supabase";
import { getRetailOrder } from "@mypet/core/retail-orders-server";
import { RETAIL_STATUS_LABEL, type RetailOrderStatus } from "@mypet/core/retail-order-status";
import { clientConfig } from "@/client.config";

const { palette: P } = clientConfig;

export const metadata = { title: `Seu pedido — ${clientConfig.name}`, robots: { index: false } };

type PedidoProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
};

export default function PedidoPage(props: PedidoProps) {
  return (
    <Suspense fallback={<p style={{ padding: 24, color: P.gray600 }}>Carregando pedido…</p>}>
      <PedidoConteudo {...props} />
    </Suspense>
  );
}

async function PedidoConteudo({ params, searchParams }: PedidoProps) {
  const { id } = await params;
  const { t } = await searchParams;
  const token = Array.isArray(t) ? t[0] : t;
  const order = await getRetailOrder(getHubServiceClient(), id, token ?? "");
  if (!order) notFound();
  const categories = await getCategories();
  const label = RETAIL_STATUS_LABEL[order.status as RetailOrderStatus] ?? order.status;

  return (
    <div style={{ background: P.gray50, minHeight: "100vh", color: P.gray800 }}>
      <SiteNav categories={categories} audienceLabel={null} />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 24, display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: P.navy }}>Pedido {order.number}</h1>
        <p style={{ fontSize: 16, fontWeight: 800 }}>{label}</p>
        {order.status === "aguardando_pagamento" && order.paymentUrl && (
          <p>
            Ainda não recebemos a confirmação do pagamento. Se você já pagou, ela chega em instantes.{" "}
            <a href={order.paymentUrl}>Voltar ao pagamento</a>
          </p>
        )}
        {order.status === "expirado" && <p>O prazo para pagar terminou e nada foi cobrado. <Link href="/cotacao">Fazer o pedido de novo</Link></p>}
        <section style={{ background: P.white, border: `1px solid ${P.gray200}`, borderRadius: 12, padding: 16, display: "grid", gap: 6 }}>
          {order.items.map((i) => (
            <div key={i.name} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{i.qty}x {i.name}</span><span>{formatBRL(i.unitPrice * i.qty)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Frete</span><span>{formatBRL(order.shippingPrice)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900 }}><span>Total</span><span>{formatBRL(order.total)}</span></div>
        </section>
        {order.shipping && (
          <section style={{ fontSize: 14, lineHeight: 1.6 }}>
            <b>Entrega:</b> {[order.shipping.logradouro, order.shipping.numero, order.shipping.complemento].filter(Boolean).join(", ")} — {order.shipping.bairro}, {order.shipping.cidade}/{order.shipping.uf} — CEP {formatCep(order.shipping.cep)}
            <br />
            {order.shipping.serviceName}{order.shipping.deliveryDays ? `, até ${order.shipping.deliveryDays} dias úteis após a confirmação do pagamento` : ""}
            {order.shipping.trackingCode && (<><br /><b>Rastreio:</b> {order.shipping.trackingCode}</>)}
          </section>
        )}
      </main>
    </div>
  );
}
