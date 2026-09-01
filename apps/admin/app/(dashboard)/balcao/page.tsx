import Link from "next/link";
import { getCategories } from "@mypet/core/catalog";
import { getHubClient } from "@mypet/core/supabase";
import { requireAdminSession } from "@/lib/auth";
import { createRule, deleteRule, setExcluded } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  dados_invalidos: "Dados inválidos. Revise os campos.",
  faixas_invalidas: "As faixas informadas são inválidas.",
  sem_faixas: "Adicione ao menos uma faixa (quantidade mínima + desconto).",
  falha_ao_salvar: "Não foi possível salvar. Tente novamente.",
};

type RuleRow = {
  id: string;
  scope: "categoria" | "sku";
  category_id: string | null;
  product_reference: string | null;
  excluded: boolean;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  balcao_rule_tiers: { min_qty: number; discount_pct: number }[] | null;
};

export default async function BalcaoRegrasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminSession();
  const { error } = await searchParams;
  const categories = await getCategories();
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const { data } = await getHubClient()
    .from("balcao_rules")
    .select(
      "id, scope, category_id, product_reference, excluded, active, starts_at, ends_at, balcao_rule_tiers(min_qty, discount_pct)",
    )
    .eq("channel", "mypetbrasil")
    .order("scope", { ascending: true });
  const rules = (data as RuleRow[] | null) ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Balcão de Negócios — Regras</h1>
        <Link href="/balcao/solicitacoes" className="text-sm font-semibold text-slate-700 underline">
          Ver solicitações →
        </Link>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        Canal: <strong>My Pet Brasil</strong>
        <select disabled className="ml-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-400">
          <option>My Pet Brasil</option>
        </select>
      </p>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      {/* Criar regra */}
      <form action={createRule} className="mb-8 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <label className="text-sm">
          Escopo
          <select name="scope" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="categoria">Categoria</option>
            <option value="sku">SKU específico</option>
          </select>
        </label>
        <label className="text-sm">
          Categoria (se escopo = categoria)
          <select name="categoryId" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Referência do produto (se escopo = SKU)
          <input name="productReference" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          Faixas — JSON <code>{'[{"minQty":10,"discountPct":8}]'}</code>
          <input name="tiers" defaultValue='[{"minQty":10,"discountPct":8},{"minQty":25,"discountPct":12}]' className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs" />
        </label>
        <label className="text-sm">
          Início da vigência (opcional)
          <input type="datetime-local" name="startsAt" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          Fim da vigência (opcional)
          <input type="datetime-local" name="endsAt" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <div className="md:col-span-2">
          <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
            Criar regra
          </button>
        </div>
      </form>

      {/* Excluir SKU de uma categoria habilitada */}
      <form action={setExcluded} className="mb-8 flex items-end gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <label className="text-sm">
          Excluir SKU do Balcão (referência)
          <input name="productReference" className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
          Excluir SKU
        </button>
      </form>

      <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-4 py-3">Escopo</th>
            <th className="px-4 py-3">Alvo</th>
            <th className="px-4 py-3">Faixas</th>
            <th className="px-4 py-3">Vigência</th>
            <th className="px-4 py-3">Ativa</th>
            <th className="px-4 py-3"></th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="px-4 py-3">{r.scope}</td>
              <td className="px-4 py-3">
                {r.scope === "categoria" ? catName.get(r.category_id ?? "") ?? r.category_id : r.product_reference}
                {r.excluded && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">excluído</span>}
              </td>
              <td className="px-4 py-3">
                {(r.balcao_rule_tiers ?? [])
                  .slice()
                  .sort((a, b) => a.min_qty - b.min_qty)
                  .map((t) => `${t.min_qty}+ (−${t.discount_pct}%)`)
                  .join(" · ") || "—"}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {r.starts_at ? new Date(r.starts_at).toLocaleDateString("pt-BR") : "—"} …{" "}
                {r.ends_at ? new Date(r.ends_at).toLocaleDateString("pt-BR") : "—"}
              </td>
              <td className="px-4 py-3">{r.active ? "sim" : "não"}</td>
              <td className="px-4 py-3">
                {!r.excluded && (
                  <Link href={`/balcao/${r.id}`} className="font-semibold text-slate-700 underline">
                    Editar
                  </Link>
                )}
              </td>
              <td className="px-4 py-3">
                <form action={deleteRule}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="font-semibold text-red-600 hover:underline">Excluir</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
