"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  addCampaignItem,
  removeCampaignItem,
  updateCampaign,
  updateCampaignItem,
  type AddItemFormState,
  type CampaignFormState,
} from "../actions";

type ItemRow = {
  id: string;
  product_id: string;
  promotional_price: number;
  min_quantity: number;
  sort_order: number;
  products: { name: string; reference: string | null } | null;
};

type CampaignDetail = {
  id: string;
  slug: string;
  title: string | null;
  channel: string;
  subtitle: string | null;
  badge: string | null;
  coupon_code: string | null;
  coupon_description: string | null;
  coupon_discount_pct: number | null;
  freight_message: string | null;
  primary_cta_label: string | null;
  secondary_cta_label: string | null;
  hero_priority: number;
  flash_offer: boolean;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

// Converte um timestamp ISO (UTC) para o formato aceito por
// <input type="datetime-local">, já no horário de Brasília (UTC-3, fixo —
// ver packages/core/src/datetime.ts). Contraparte de localDateTimeToIsoUtc.
function isoUtcToLocalDateTimeInput(iso: string | null, offsetHours = -3): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() + offsetHours * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

function CampaignEditForm({ campaign }: { campaign: CampaignDetail }) {
  const [state, formAction, pending] = useActionState<CampaignFormState, FormData>(updateCampaign, undefined);

  return (
    <form action={formAction} className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
      <input type="hidden" name="id" value={campaign.id} />

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Canal</label>
          <input value={campaign.channel} disabled className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug (URL da campanha)</label>
          <input value={campaign.slug} disabled className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500" />
          <p className="mt-1 text-[11px] text-slate-400">Canal e slug não podem ser alterados após a criação.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Prioridade no hero</label>
          <input name="heroPriority" type="number" defaultValue={campaign.hero_priority} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Título</label>
          <input name="title" defaultValue={campaign.title ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Subtítulo</label>
          <input name="subtitle" defaultValue={campaign.subtitle ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Selo</label>
          <input name="badge" defaultValue={campaign.badge ?? ""} placeholder="Oferta para lojistas" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Cupom (código)</label>
          <input name="couponCode" defaultValue={campaign.coupon_code ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Descrição do cupom</label>
          <input name="couponDescription" defaultValue={campaign.coupon_description ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Desconto do cupom (%)</label>
          <input
            name="couponDiscountPct"
            type="number"
            min={0}
            max={100}
            defaultValue={campaign.coupon_discount_pct ?? undefined}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Mensagem de frete</label>
        <input
          name="freightMessage"
          defaultValue={campaign.freight_message ?? ""}
          placeholder="Frete grátis acima de R$ 500"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">CTA principal</label>
          <input name="primaryCtaLabel" defaultValue={campaign.primary_cta_label ?? ""} placeholder="Aproveitar oferta" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">CTA secundário</label>
          <input
            name="secondaryCtaLabel"
            defaultValue={campaign.secondary_cta_label ?? ""}
            placeholder="Falar com atendimento"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Início da vigência</label>
          <input
            name="startsAt"
            type="datetime-local"
            defaultValue={isoUtcToLocalDateTimeInput(campaign.starts_at)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-400">Horário de Brasília (UTC-3)</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Fim da vigência</label>
          <input
            name="endsAt"
            type="datetime-local"
            defaultValue={isoUtcToLocalDateTimeInput(campaign.ends_at)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-400">Horário de Brasília (UTC-3)</p>
        </div>
        <div className="flex items-end gap-2">
          <input id="flashOffer" name="flashOffer" type="checkbox" defaultChecked={campaign.flash_offer} />
          <label htmlFor="flashOffer" className="text-sm text-slate-600">Oferta relâmpago</label>
        </div>
        <div className="flex items-end gap-2">
          <input id="active" name="active" type="checkbox" defaultChecked={campaign.active} />
          <label htmlFor="active" className="text-sm text-slate-600">Ativa</label>
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="w-fit rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Salvando…" : "Salvar campanha"}
      </button>
    </form>
  );
}

function ItemEditForm({ item }: { item: ItemRow }) {
  const [state, formAction, pending] = useActionState<AddItemFormState, FormData>(updateCampaignItem, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={item.id} />
      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-500">Preço promocional</label>
        <input
          name="promotionalPrice"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={item.promotional_price}
          required
          className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-500">Qtd. mínima</label>
        <input name="minQuantity" type="number" min={1} defaultValue={item.min_quantity} className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-500">Ordem</label>
        <input name="sortOrder" type="number" defaultValue={item.sort_order} className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
      </div>
      <button type="submit" disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
        {pending ? "Salvando…" : "Salvar"}
      </button>
      {state?.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export default function ItensPageClient({
  campaign,
  items,
}: {
  campaign: CampaignDetail;
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

      <CampaignEditForm campaign={campaign} />

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
          <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">{item.products?.name ?? item.product_id}</p>
              <p className="text-xs text-slate-500">
                Ref: {item.products?.reference ?? "—"} · Promo: R$ {Number(item.promotional_price).toFixed(2)} · Mín: {item.min_quantity} · Ordem: {item.sort_order}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <ItemEditForm item={item} />
              <form action={removeCampaignItem}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                  Remover
                </button>
              </form>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">Nenhum produto nessa campanha ainda.</p>}
      </div>
    </div>
  );
}
