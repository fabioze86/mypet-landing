import { notFound } from "next/navigation";
import { getCategories } from "@mypet/core/catalog";
import { buildCategoryTree } from "@mypet/core/catalog-utils";
import { requireAdminSession } from "@/lib/auth";
import { flattenForSelect } from "@/lib/categories";
import { updateCategory } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  slug_duplicado: "Já existe uma categoria com esse slug. Escolha outro.",
  falha_ao_salvar: "Não foi possível salvar a categoria. Tente novamente.",
};

export default async function EditCategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const { error } = await searchParams;
  const categories = await getCategories();
  const node = categories.find((c) => c.id === id);
  if (!node) notFound();

  const tree = buildCategoryTree(categories);
  const options = flattenForSelect(tree).filter((o) => o.id !== id);
  const updateWithId = updateCategory.bind(null, id);

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-xl font-bold text-slate-800">Editar categoria</h1>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={updateWithId} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nome</label>
          <input name="name" defaultValue={node.name} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug</label>
          <input name="slug" defaultValue={node.slug} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Categoria pai</label>
          <select name="parentId" defaultValue={node.parentId ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">— nenhuma (nível 1) —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
          <input name="sortOrder" type="number" defaultValue={0} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Salvar
        </button>
      </form>
    </div>
  );
}
