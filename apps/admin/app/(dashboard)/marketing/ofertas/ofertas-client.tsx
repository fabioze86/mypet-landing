"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createCampaign, deleteCampaign, toggleCampaignActive, type CampaignFormState } from "./actions";

type CampaignRow = {
  id: string;
  channel: string;
  slug: string;
  title: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  hero_priority: number;
  flash_offer: boolean;
};

export default function OfertasPageClient({ campaigns }: { campaigns: CampaignRow[] }) {
  const [state, formAction, pending] = useActionState<CampaignFormState, FormData>(createCampaign, undefined);

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Marketing → Ofertas</h1>

      <form action={formAction} className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Canal</label>
            <select name="channel" defaultValue="ffa_fabrica" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="ffa_fabrica">FFA Fábrica (Distribuidora)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Slug (URL da campanha)</label>
            <input name="slug" placeholder="kit-11-vestidos" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Prioridade no hero</label>
            <input name="heroPriority" type="number" defaultValue={0} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Título</label>
            <input name="title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Subtítulo</label>
            <input name="subtitle" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Selo</label>
            <input name="badge" placeholder="Oferta para lojistas" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cupom (código)</label>
            <input name="couponCode" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Descrição do cupom</label>
            <input name="couponDescription" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Desconto do cupom (%)</label>
            <input name="couponDiscountPct" type="number" min={0} max={100} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Mensagem de frete</label>
          <input name="freightMessage" placeholder="Frete grátis acima de R$ 500" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">CTA principal</label>
            <input name="primaryCtaLabel" placeholder="Aproveitar oferta" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">CTA secundário</label>
            <input name="secondaryCtaLabel" placeholder="Falar com atendimento" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Início da vigência</label>
            <input name="startsAt" type="datetime-local" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Fim da vigência</label>
            <input name="endsAt" type="datetime-local" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <input id="flashOffer" name="flashOffer" type="checkbox" />
            <label htmlFor="flashOffer" className="text-sm text-slate-600">Oferta relâmpago</label>
          </div>
          <div className="flex items-end gap-2">
            <input id="active" name="active" type="checkbox" />
            <label htmlFor="active" className="text-sm text-slate-600">Ativa</label>
          </div>
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button type="submit" disabled={pending} className="w-fit rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Enviando…" : "Criar campanha"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {campaigns.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">{c.title ?? c.slug}</p>
              <p className="text-xs text-slate-500">
                /{c.slug} · {c.channel} · prioridade {c.hero_priority} {c.flash_offer ? "· relâmpago" : ""} {c.active ? "· ativa" : "· inativa"}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/marketing/ofertas/${c.id}`}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Itens
              </Link>
              <form action={toggleCampaignActive}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={String(c.active)} />
                <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  {c.active ? "Desativar" : "Ativar"}
                </button>
              </form>
              <form action={deleteCampaign}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                  Excluir
                </button>
              </form>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && <p className="text-sm text-slate-400">Nenhuma campanha cadastrada.</p>}
      </div>
    </div>
  );
}
