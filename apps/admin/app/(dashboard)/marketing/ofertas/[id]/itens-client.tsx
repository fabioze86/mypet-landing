"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addCampaignItem, removeCampaignItem, type AddItemFormState } from "../actions";

type ItemRow = {
  id: string;
  product_id: string;
  promotional_price: number;
  min_quantity: number;
  sort_order: number;
  products: { name: string; reference: string | null } | null;
};

export default function ItensPageClient({
  campaign,
  items,
}: {
  campaign: { id: string; slug: string; title: string | null; channel: string };
  items: ItemRow[];
}) {
  const [state, formAction, pending] = useActionState<AddItemFormState, FormData>(addCampaignItem, undefined);

  return (
    <div>
      <Link href="/marketing/ofertas" className="mb-4 inline-block text-sm text-slate-500 hover:underline">
        ← Voltar para campanhas
      </Link>
      <h1 className="mb-1 text-xl font-bold text-slate-800">{campaign.title ?? campaign.slug}</h1>
      <p className="mb-6 text-sm text-slate-500">/ofertas-para-lojistas/{campaign.slug} · {campaign.channel}</p>

      <form action={formAction} className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-6">
        <input type="hidden" name="campaignId" value={campaign.id} />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Referência (CPRO/SKU)</label>
          <input name="productReference" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Preço promocional</label>
          <input name="promotionalPrice" type="number" step="0.01" min="0.01" required className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Qtd. mínima</label>
          <input name="minQuantity" type="number" min={1} defaultValue={1} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
          <input name="sortOrder" type="number" defaultValue={0} className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={pending} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Adicionando…" : "Adicionar item"}
        </button>
        {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      </form>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">{item.products?.name ?? item.product_id}</p>
              <p className="text-xs text-slate-500">
                Ref: {item.products?.reference ?? "—"} · Promo: R$ {Number(item.promotional_price).toFixed(2)} · Mín: {item.min_quantity} · Ordem: {item.sort_order}
              </p>
            </div>
            <form action={removeCampaignItem}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                Remover
              </button>
            </form>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">Nenhum produto nessa campanha ainda.</p>}
      </div>
    </div>
  );
}
