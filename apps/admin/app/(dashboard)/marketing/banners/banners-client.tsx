"use client";

import { useActionState } from "react";
import { useEffect, useState } from "react";
import { createBanner, deleteBanner, toggleBannerActive, type BannerFormState } from "./actions";

type CategoryOption = { id: string; label: string };
type BannerRow = {
  id: string;
  type: "principal" | "mini" | "categoria";
  channel: string;
  category_id: string | null;
  image_url: string;
  link_url: string | null;
  title: string | null;
  active: boolean;
};

export default function BannersPageClient({
  banners,
  categoryOptions,
}: {
  banners: BannerRow[];
  categoryOptions: CategoryOption[];
}) {
  const [state, formAction, pending] = useActionState<BannerFormState, FormData>(createBanner, undefined);
  const [type, setType] = useState<"principal" | "mini" | "categoria">("principal");

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Marketing → Banners</h1>

      <form action={formAction} className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="principal">Principal</option>
              <option value="mini">Mini</option>
              <option value="categoria">Categoria</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Canal</label>
            <select name="channel" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="mypetbrasil">My Pet Brasil</option>
              <option value="distribuidora">Distribuidora</option>
            </select>
          </div>
          {type === "categoria" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Categoria</label>
              <select name="categoryId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">— selecione —</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Imagem</label>
          <input name="image" type="file" accept="image/*" required className="text-sm" />
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Título / alt</label>
            <input name="title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Link de destino</label>
            <input name="linkUrl" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
            <input name="sortOrder" type="number" defaultValue={0} className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <input id="active" name="active" type="checkbox" defaultChecked />
            <label htmlFor="active" className="text-sm text-slate-600">Ativo</label>
          </div>
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button type="submit" disabled={pending} className="w-fit rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Enviando…" : "Adicionar banner"}
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banners.map((b) => (
          <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.image_url} alt={b.title ?? ""} className="mb-3 h-32 w-full rounded-lg object-cover" />
            <p className="text-sm font-semibold text-slate-800">{b.title ?? "(sem título)"}</p>
            <p className="mb-3 text-xs text-slate-500">{b.type} · {b.channel} {b.active ? "· ativo" : "· inativo"}</p>
            <div className="flex gap-2">
              <form action={toggleBannerActive}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="active" value={String(b.active)} />
                <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  {b.active ? "Desativar" : "Ativar"}
                </button>
              </form>
              <form action={deleteBanner}>
                <input type="hidden" name="id" value={b.id} />
                <button type="submit" className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                  Excluir
                </button>
              </form>
            </div>
          </div>
        ))}
        {banners.length === 0 && <p className="text-sm text-slate-400">Nenhum banner cadastrado.</p>}
      </div>
    </div>
  );
}
