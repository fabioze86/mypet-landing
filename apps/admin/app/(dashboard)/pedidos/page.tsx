import { Suspense } from "react";
import { requireAdminSession } from "@/lib/auth";
import { formatPrice } from "@mypet/core/catalog-utils";
import { formatWhatsapp } from "@mypet/core/br-validation";
import { ORDER_STATUSES, ORDERS_SELECT, itemUnitPrice, orderCustomer, orderTotal, type OrderRow } from "@/lib/orders";
import { RETAIL_STATUS_LABEL, type RetailOrderStatus } from "@mypet/core/retail-order-status";
import { markOrderShipped, updateOrderStatus } from "./actions";
import { ShippingForm } from "./shipping-form";
import { OrderStatusSelect } from "./order-status-select";

const CHANNEL_LABEL: Record<string, string> = {
  mypetbrasil: "My Pet Brasil",
  distribuidora: "Distribuidora",
  azpetshop: "AZ Pet Shop",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aguardando",
  PAID: "Pago",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
};

async function PedidosContent({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { channel, status } = await searchParams;

  let query = supabase
    .from("orders")
    .select(ORDERS_SELECT)
    .order("created_at", { ascending: false });

  if (channel) query = query.eq("channel", channel);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  const orders = (data ?? []) as unknown as OrderRow[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Pedidos</h1>
      </div>

      <form method="get" className="mb-4 flex gap-3">
        <select name="channel" defaultValue={channel ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os canais</option>
          <option value="mypetbrasil">My Pet Brasil</option>
          <option value="distribuidora">Distribuidora</option>
          <option value="azpetshop">AZ Pet Shop</option>
        </select>
        <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{RETAIL_STATUS_LABEL[s as RetailOrderStatus] ?? s}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Filtrar
        </button>
      </form>

      {error && <p className="text-sm text-red-600">Erro ao carregar pedidos: {error.message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Comprador</th>
              <th className="px-4 py-3">Canal</th>
              <th className="px-4 py-3">Itens</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => {
              const customer = orderCustomer(order);
              const total = orderTotal(order);
              return (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-semibold text-slate-700">{order.number != null ? `#${order.number}` : "—"}</td>
                  <td className="px-4 py-3">{new Date(order.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    {customer.nome} — {customer.empresa}
                    <div className="text-xs text-slate-400">{formatWhatsapp(customer.whatsapp)}</div>
                    {customer.cnpj && <div className="text-xs text-slate-400">CNPJ: {customer.cnpj}</div>}
                    {!order.buyers && !order.order_shipping && <div className="text-xs text-slate-400">Sem cadastro</div>}
                    {order.order_shipping && (
                      <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                        {order.customer_email && <div>{order.customer_email}</div>}
                        <div>
                          {order.order_shipping.logradouro}, {order.order_shipping.numero}
                          {order.order_shipping.complemento ? ` ${order.order_shipping.complemento}` : ""} — {order.order_shipping.bairro},{" "}
                          {order.order_shipping.cidade}/{order.order_shipping.uf} — CEP {order.order_shipping.cep}
                        </div>
                        <div>
                          Frete: {order.order_shipping.service_name} ({formatPrice(Number(order.order_shipping.price))})
                        </div>
                        {order.order_payments && <div>Pagamento: {PAYMENT_STATUS_LABEL[order.order_payments.status] ?? order.order_payments.status}</div>}
                        {order.order_shipping.tracking_code && <div>Rastreio: {order.order_shipping.tracking_code}</div>}
                        {order.status === "pago" && <ShippingForm orderId={order.id} action={markOrderShipped} />}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{CHANNEL_LABEL[order.channel] ?? order.channel}</td>
                  <td className="px-4 py-3">
                    <ul className="text-xs text-slate-600">
                      {order.order_items.map((item) => {
                        const unitPrice = itemUnitPrice(item);
                        return (
                          <li key={item.product_id}>
                            {item.product_name_snapshot} — Qtd: {item.qty}
                            {unitPrice !== null && <> × {formatPrice(unitPrice)}</>}
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                    {total !== null ? formatPrice(total) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusSelect orderId={order.id} channel={order.channel} currentStatus={order.status} action={updateOrderStatus} />
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <PedidosContent searchParams={searchParams} />
    </Suspense>
  );
}
