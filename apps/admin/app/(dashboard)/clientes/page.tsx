import { requireAdminSession } from "@/lib/auth";
import { LEAD_STATUSES, type LeadRow } from "@/lib/leads";
import { updateLeadStatus } from "./actions";
import { StatusSelect } from "./status-select";

const CHANNEL_LABEL: Record<string, string> = {
  mypetbrasil: "My Pet Brasil",
  distribuidora: "Distribuidora",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { channel, status } = await searchParams;

  let query = supabase
    .from("leads")
    .select("id, nome, empresa, whatsapp, cnpj, channel, status, created_at")
    .order("created_at", { ascending: false });

  if (channel) query = query.eq("channel", channel);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  const leads = (data ?? []) as LeadRow[];

  const exportHref = `/clientes/export${channel || status ? "?" : ""}${[
    channel ? `channel=${channel}` : "",
    status ? `status=${status}` : "",
  ]
    .filter(Boolean)
    .join("&")}`;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Clientes</h1>
        <a
          href={exportHref}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Exportar CSV
        </a>
      </div>

      <form method="get" className="mb-4 flex gap-3">
        <select name="channel" defaultValue={channel ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os canais</option>
          <option value="mypetbrasil">My Pet Brasil</option>
          <option value="distribuidora">Distribuidora</option>
        </select>
        <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Filtrar
        </button>
      </form>

      {error && <p className="text-sm text-red-600">Erro ao carregar clientes: {error.message}</p>}

      <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Empresa</th>
            <th className="px-4 py-3">WhatsApp</th>
            <th className="px-4 py-3">Canal</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Data</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-slate-100">
              <td className="px-4 py-3">{lead.nome}</td>
              <td className="px-4 py-3">{lead.empresa}</td>
              <td className="px-4 py-3">{lead.whatsapp}</td>
              <td className="px-4 py-3">{CHANNEL_LABEL[lead.channel] ?? lead.channel}</td>
              <td className="px-4 py-3">
                <StatusSelect leadId={lead.id} currentStatus={lead.status} action={updateLeadStatus} />
              </td>
              <td className="px-4 py-3 text-slate-500">
                {new Date(lead.created_at).toLocaleString("pt-BR")}
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                Nenhum cliente encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
