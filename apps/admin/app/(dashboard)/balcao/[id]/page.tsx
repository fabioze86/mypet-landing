import { notFound } from "next/navigation";
import { getCategories } from "@mypet/core/catalog";
import { getHubClient } from "@mypet/core/supabase";
import { requireAdminSession } from "@/lib/auth";
import { previewUnitPrice } from "@/lib/balcao";
import { updateRule } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  dados_invalidos: "Dados inválidos. Revise os campos.",
  faixas_invalidas: "As faixas informadas são inválidas.",
  sem_faixas: "Adicione ao menos uma faixa.",
  falha_ao_salvar: "Não foi possível salvar. Tente novamente.",
};

export default async function EditBalcaoRulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; previewQty?: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const { error, previewQty } = await searchParams;

  const { data } = await getHubClient()
    .from("balcao_rules")
    .select(
      "id, scope, category_id, product_reference, excluded, active, starts_at, ends_at, balcao_rule_tiers(min_qty, discount_pct)",
    )
    .eq("id", id)
    .single();
  if (!data) notFound();

  const rule = data as {
    id: string;
    scope: "categoria" | "sku";
    category_id: string | null;
    product_reference: string | null;
    active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    balcao_rule_tiers: { min_qty: number; discount_pct: number }[] | null;
  };

  const categories = await getCategories();
  const alvo =
    rule.scope === "categoria"
      ? categories.find((c) => c.id === rule.category_id)?.name ?? rule.category_id
      : rule.product_reference;

  const tiers = (rule.balcao_rule_tiers ?? [])
    .map((t) => ({ minQty: t.min_qty, discountPct: t.discount_pct }))
    .sort((a, b) => a.minQty - b.minQty);
  const tiersJson = JSON.stringify(tiers);

  // Prévia com preço-base do ERP (por referência). Só quando escopo = sku.
  let previewBase: number | null = null;
  if (rule.scope === "sku" && rule.product_reference) {
    const { data: p } = await getHubClient()
      .from("v_precos_erp")
      .select("preco")
      .eq("reference", rule.product_reference)
      .maybeSingle();
    previewBase = p?.preco != null ? Number(p.preco) : null;
  }
  const qty = Number(previewQty) > 0 ? Math.floor(Number(previewQty)) : 15;
  const preview = previewBase != null ? previewUnitPrice(previewBase, tiers, qty) : null;
  const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  return (
    <div className="max-w-xl">
      <h1 className="mb-2 text-xl font-bold text-slate-800">Editar regra do Balcão</h1>
      <p className="mb-6 text-sm text-slate-500">
        {rule.scope} · <strong>{alvo}</strong>
      </p>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={updateRule.bind(null, id)} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={rule.active} /> Regra ativa
        </label>
        <label className="text-sm">
          Faixas (JSON)
          <input name="tiers" defaultValue={tiersJson} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs" />
        </label>
        <label className="text-sm">
          Início da vigência
          <input type="datetime-local" name="startsAt" defaultValue={rule.starts_at?.slice(0, 16) ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          Fim da vigência
          <input type="datetime-local" name="endsAt" defaultValue={rule.ends_at?.slice(0, 16) ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Salvar
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-2 text-sm font-bold text-slate-700">Prévia</h2>
        {rule.scope !== "sku" ? (
          <p className="text-sm text-slate-500">Prévia disponível apenas para regras de SKU (preço-base do ERP por referência).</p>
        ) : previewBase == null ? (
          <p className="text-sm text-slate-500">Sem preço no espelho do ERP para <code>{rule.product_reference}</code>.</p>
        ) : (
          <form method="get" className="text-sm text-slate-700">
            <p>Preço-base ERP: <strong>{brl(previewBase)}</strong></p>
            <label className="mt-2 block">
              Quantidade para simular
              <input name="previewQty" type="number" min={1} defaultValue={qty} className="ml-2 w-24 rounded border border-slate-300 px-2 py-1" />
            </label>
            <button type="submit" className="mt-2 rounded-lg bg-slate-200 px-3 py-1 text-xs font-semibold">Recalcular</button>
            {preview && (
              <div className="mt-3">
                <p>Faixa atingida: <strong>{preview.tierMinQty ? `${preview.tierMinQty}+` : "nenhuma"}</strong> (−{preview.volumePct}%)</p>
                <p>Unitário com retirada/frete próprio (−5%): <strong>{brl(preview.unitPriceWithLogistics)}</strong></p>
                <p className="text-slate-500">Sem vantagem logística: {brl(preview.unitPriceNoLogistics)}</p>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
