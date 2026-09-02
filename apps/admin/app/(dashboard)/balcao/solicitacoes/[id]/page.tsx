import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { getBalcaoRequestById } from "@mypet/core/balcao-server";
import { advanceStatus, adjustRequest } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  motivo_obrigatorio: "Informe o motivo da recusa.",
  justificativa_obrigatoria: "Informe a justificativa e os ajustes.",
  falha: "Não foi possível concluir a ação.",
};

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export default async function SolicitacaoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { id } = await params;
  const { error } = await searchParams;

  const req = await getBalcaoRequestById(supabase, id);
  if (!req) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-bold text-slate-800">Solicitação {req.id.slice(0, 8)}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {new Date(req.createdAt).toLocaleString("pt-BR")} · status <strong>{req.status}</strong> ·{" "}
        {req.logistics === "retirada" ? "Retirada" : "Frete próprio"}
      </p>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-bold text-slate-700">Comprador (snapshot)</h2>
        <p>{req.buyer.empresa ?? "—"} · {req.buyer.nome ?? "—"}</p>
        <p className="text-slate-500">{req.buyer.whatsapp}{req.buyer.cnpj ? ` · CNPJ ${req.buyer.cnpj}` : ""}</p>
        {req.note && <p className="mt-2 rounded bg-slate-50 p-2 text-slate-600">Obs.: {req.note}</p>}
      </div>

      <table className="mb-2 w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-3 py-2">Produto</th>
            <th className="px-3 py-2">Qtd</th>
            <th className="px-3 py-2">Base</th>
            <th className="px-3 py-2">Faixa</th>
            <th className="px-3 py-2">−vol.</th>
            <th className="px-3 py-2">−log.</th>
            <th className="px-3 py-2">Unit. est.</th>
            <th className="px-3 py-2">Total linha</th>
          </tr>
        </thead>
        <tbody>
          {req.items.map((it) => (
            <tr key={it.productId} className="border-b border-slate-100">
              <td className="px-3 py-2">{it.productName}<br /><span className="text-xs text-slate-400">{it.productReference}</span></td>
              <td className="px-3 py-2">{it.qty}</td>
              <td className="px-3 py-2">{brl(it.basePrice)}</td>
              <td className="px-3 py-2">{it.tierMinQty ? `${it.tierMinQty}+` : "—"}</td>
              <td className="px-3 py-2">{it.volumeDiscountPct}%</td>
              <td className="px-3 py-2">{it.logisticsDiscountPct}%</td>
              <td className="px-3 py-2">{brl(it.unitPrice)}</td>
              <td className="px-3 py-2">{brl(it.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mb-6 text-right text-sm font-bold text-slate-800">Total estimado: {brl(req.totalEstimated)}</p>

      <div className="mb-6 flex flex-wrap gap-3">
        {(["em_analise", "aprovada", "expirada"] as const).map((a) => (
          <form key={a} action={advanceStatus}>
            <input type="hidden" name="id" value={req.id} />
            <input type="hidden" name="action" value={a} />
            <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
              Marcar {a}
            </button>
          </form>
        ))}
        <form action={advanceStatus} className="flex items-end gap-2">
          <input type="hidden" name="id" value={req.id} />
          <input type="hidden" name="action" value="recusada" />
          <label className="text-sm">
            Motivo da recusa
            <input name="motivo" className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Recusar</button>
        </form>
      </div>

      <form action={adjustRequest} className="mb-8 grid gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="id" value={req.id} />
        <h2 className="text-sm font-bold text-slate-700">Ajustar (não altera o snapshot original)</h2>
        <label className="text-sm">
          Justificativa
          <input name="justificativa" className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          Ajustes (texto livre: linha, nova qtd, novo preço…)
          <textarea name="ajustes" rows={3} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="justify-self-start rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
          Registrar ajuste
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-bold text-slate-700">Histórico</h2>
        <ul className="space-y-1">
          {req.events.map((ev, i) => (
            <li key={i} className="text-slate-600">
              <span className="text-slate-400">{new Date(ev.createdAt).toLocaleString("pt-BR")}</span> — <strong>{ev.action}</strong>
              {ev.payload ? <> · <code className="text-xs">{JSON.stringify(ev.payload)}</code></> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
