import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { getBalcaoRequests, type BalcaoRequestStatus } from "@mypet/core/balcao-server";

const STATUSES: BalcaoRequestStatus[] = [
  "enviada",
  "em_analise",
  "aprovada",
  "ajustada",
  "recusada",
  "expirada",
];

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { status } = await searchParams;
  const active = STATUSES.includes(status as BalcaoRequestStatus)
    ? (status as BalcaoRequestStatus)
    : undefined;

  const rows = await getBalcaoRequests(supabase, { status: active });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Balcão — Solicitações</h1>
        <Link href="/balcao" className="text-sm font-semibold text-slate-700 underline">← Regras</Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/balcao/solicitacoes" className={`rounded-full px-3 py-1 text-xs font-semibold ${!active ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>
          Todas
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/balcao/solicitacoes?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${active === s ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Comprador</th>
            <th className="px-4 py-3">Logística</th>
            <th className="px-4 py-3">Total estimado</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhuma solicitação.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleString("pt-BR")}</td>
              <td className="px-4 py-3">
                {r.buyer.empresa ?? r.buyer.nome ?? "—"}<br />
                <span className="text-xs text-slate-400">{r.buyer.whatsapp}{r.buyer.cnpj ? ` · ${r.buyer.cnpj}` : ""}</span>
              </td>
              <td className="px-4 py-3">{r.logistics === "retirada" ? "Retirada" : "Frete próprio"}</td>
              <td className="px-4 py-3">{brl(r.totalEstimated)}</td>
              <td className="px-4 py-3">{r.status}</td>
              <td className="px-4 py-3">
                <Link href={`/balcao/solicitacoes/${r.id}`} className="font-semibold text-slate-700 underline">Abrir</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
